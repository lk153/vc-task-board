#!/usr/bin/env bash
# Final check before pushing to Vercel (`make verify`).
#
# Runs every check (lint, types, formatting, migration drift, security audit,
# unit and integration tests), then builds the exact commit you're about to push
# the way Vercel does: a fresh checkout, a frozen install, Vercel's build
# command (env check → next build → migrations) and a brand-new empty
# database, like a new Neon branch. Quiet while steps pass; prints the log
# of a step that fails.
#
#   ALLOW_DIRTY=1  verify even with uncommitted changes (they won't be deployed)
#   SKIP_AUDIT=1   skip the dependency security audit (e.g. offline)
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

E2E_PORT=3200
VERIFY_DB=taskboard_verify
VERIFY_DB_URL="postgres://postgres:postgres@localhost:5434/$VERIFY_DB"
LOG_DIR="$(mktemp -d)"
WORKTREE="$LOG_DIR/checkout"
STARTED=$SECONDS

bold=$'\033[1m' green=$'\033[32m' red=$'\033[31m' yellow=$'\033[33m' dim=$'\033[2m' reset=$'\033[0m'

cleanup() {
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  docker compose exec -T db psql -U postgres -qc "DROP DATABASE IF EXISTS $VERIFY_DB WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

section() { printf "\n%s%s%s\n" "$bold" "$1" "$reset"; }
warn() { printf "  %s⚠ %s%s\n" "$yellow" "$1" "$reset"; }
die() {
  printf "\n%s✖ %s%s\n" "$red" "$1" "$reset" >&2
  exit 1
}

# run "Label" command... — logs output, prints ✓ with timing or the log tail on failure.
run() {
  local label=$1
  shift
  local log="$LOG_DIR/$(printf '%s' "$label" | tr -c 'A-Za-z0-9' '-').log"
  local start=$SECONDS
  printf "  %-46s" "$label"
  if "$@" >"$log" 2>&1; then
    printf "%s✓%s %s%ss%s\n" "$green" "$reset" "$dim" $((SECONDS - start)) "$reset"
  else
    printf "%s✖%s\n\n" "$red" "$reset"
    tail -n 40 "$log"
    printf "\n%sFull log: %s%s\n" "$dim" "$log" "$reset"
    die "$label failed."
  fi
}

# ─── Steps ──────────────────────────────────────────────────────────────────

# Prints its own result line: its messages must stay visible, not go to a log.
check_git() {
  printf "  %-46s" "Committed, no secrets in git"
  local dirty env_files
  dirty=$(git status --porcelain)
  if [ -n "$dirty" ] && [ "${ALLOW_DIRTY:-}" != "1" ]; then
    printf "%s✖%s\n\n" "$red" "$reset"
    git status --short
    die "Uncommitted changes. Commit or stash them first (Vercel deploys commits only), or run with ALLOW_DIRTY=1."
  fi
  env_files=$(git ls-files | grep -E '(^|/)\.env' | grep -v '\.env\.example$' || true)
  if [ -n "$env_files" ]; then
    printf "%s✖%s\n" "$red" "$reset"
    die "Environment files are committed (secrets!): $env_files"
  fi
  printf "%s✓%s\n" "$green" "$reset"
  [ -z "$dirty" ] || warn "Uncommitted changes won't be deployed: Vercel builds commits only (verifying HEAD)."
}

check_node() {
  local want have
  want=$(node -p 'require("./package.json").engines.node')
  have=$(node -v)
  case "$have" in
    v"${want%.x}".*) ;;
    *) warn "Local Node is $have; Vercel builds with $want. Results may differ slightly." ;;
  esac
}

ensure_database() {
  pnpm db:up && docker compose exec -T db psql -U postgres -qc "SELECT 1"
}

# Fails when the Drizzle schema has changes that no migration covers.
migrations_match_schema() {
  local dir=node_modules/.cache/verify-migrations
  rm -rf "$dir" && mkdir -p "$dir" && cp -R src/server/db/migrations "$dir/" || return 1
  printf 'export default { dialect: "postgresql", schema: "./src/server/db/schema.ts", out: "./%s/migrations" };\n' "$dir" >"$dir/drizzle.config.js"
  local output
  output=$(pnpm exec drizzle-kit generate --config "$dir/drizzle.config.js" 2>&1)
  rm -rf "$dir"
  echo "$output"
  if ! grep -q "No schema changes" <<<"$output"; then
    echo
    echo "The schema in src/server/db/schema.ts has changes without a migration."
    echo "Create one with: make db-generate NAME=describe_the_change"
    return 1
  fi
}

audit_dependencies() {
  pnpm audit --prod --audit-level high
}

fresh_verify_database() {
  docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -q \
    -c "DROP DATABASE IF EXISTS $VERIFY_DB WITH (FORCE)" \
    -c "CREATE DATABASE $VERIFY_DB"
}

checkout_head() {
  git worktree add --detach --quiet "$WORKTREE" HEAD &&
    (cd "$WORKTREE" && CI=1 pnpm install --frozen-lockfile --prefer-offline)
}

# Vercel's build command from vercel.json, with only Vercel-style variables set.
vercel_build() {
  local build_command
  build_command=$(node -p 'require("./vercel.json").buildCommand') || return 1
  echo "\$ $build_command"
  (cd "$WORKTREE" && env -i PATH="$PATH" HOME="$HOME" \
    VERCEL=1 CI=1 VERCEL_ENV=production \
    VERCEL_PROJECT_PRODUCTION_URL=verify.invalid \
    DATABASE_URL="$VERIFY_DB_URL" \
    BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
    BETTER_AUTH_URL=https://verify.invalid \
    sh -c "$build_command")
}

e2e_tests() {
  if lsof -ti "tcp:$E2E_PORT" >/dev/null 2>&1; then
    echo "Port $E2E_PORT is in use, so Playwright would test that (possibly stale) server."
    echo "Stop it first: lsof -ti tcp:$E2E_PORT | xargs kill"
    return 1
  fi
  pnpm test:e2e
}

# ─── Run ────────────────────────────────────────────────────────────────────

printf "%sVerifying %s (%s) before pushing to Vercel%s\n" "$bold" \
  "$(git rev-parse --short HEAD)" "$(git branch --show-current)" "$reset"

section "Repository"
check_git
check_node
run "Dependencies (frozen lockfile)" pnpm install --frozen-lockfile
run "Local Postgres (Docker)" ensure_database

section "Code quality"
run "Lint" pnpm lint
run "Typecheck" pnpm typecheck
run "Formatting" pnpm format:check
run "Migrations match the schema" migrations_match_schema
if [ "${SKIP_AUDIT:-}" = "1" ]; then
  warn "Security audit skipped (SKIP_AUDIT=1)."
else
  run "Security audit (production deps, high+)" audit_dependencies
fi

section "Tests"
run "Unit tests" pnpm test
run "Integration tests" pnpm test:integration

section "Vercel build (fresh checkout of HEAD, empty database)"
run "Fresh database" fresh_verify_database
run "Checkout + frozen install" checkout_head
run "Env check, next build, migrate" vercel_build

section "End-to-end (production build, desktop + mobile)"
run "Playwright" e2e_tests

elapsed=$((SECONDS - STARTED))
printf "\n%s%s✓ All checks passed in %dm %02ds.%s\n" "$bold" "$green" $((elapsed / 60)) $((elapsed % 60)) "$reset"
if upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null); then
  ahead=$(git rev-list --count "$upstream"..HEAD)
  printf "%d commit(s) to push to %s:\n" "$ahead" "$upstream"
  git log --oneline "$upstream"..HEAD | sed 's/^/  /'
  printf "Next: git push\n"
else
  printf "No upstream branch yet. First push: git push -u origin %s\n" "$(git branch --show-current)"
fi
