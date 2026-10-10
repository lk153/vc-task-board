# VC Task Board — shortcuts for everyday commands.
# Run `make` (or `make help`) to list them. Each target wraps a pnpm script or
# Docker Compose command, so package.json stays the source of truth.
# Destructive targets ask first; pass CONFIRM=yes to skip the question.

PNPM    ?= pnpm
COMPOSE ?= docker compose
DB      ?= taskboard

.DEFAULT_GOAL := help

# Ask before doing something destructive: $(call confirm,Message)
define confirm
	@if [ "$(CONFIRM)" != "yes" ]; then \
		printf "%s [y/N] " "$(1)"; read answer; \
		case "$$answer" in [yY]|[yY][eE][sS]) ;; *) echo "Cancelled."; exit 1 ;; esac; \
	fi
endef

##@ Help

.PHONY: help
help: ## Show this list
	@awk 'BEGIN { FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m [VAR=value]\n" } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z0-9_-]+:.*##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo

##@ Getting started

.PHONY: setup install
setup: install .env.local db-up db-migrate db-seed ## First-time setup: install, .env.local, database, demo data
	@echo "Ready. Run 'make dev' and open http://localhost:3000 (viet@example.com / 1234567890)."

install: ## Install dependencies
	$(PNPM) install

.env.local:
	@cp .env.example .env.local
	@sed -i.bak "s|replace-with-a-long-random-string|$$(openssl rand -base64 32)|" .env.local && rm -f .env.local.bak
	@echo "Created .env.local with a fresh BETTER_AUTH_SECRET."

##@ Development

.PHONY: dev build start clean
dev: db-up ## Start the database (if needed) and the dev server on http://localhost:3000
	$(PNPM) dev

build: ## Production build
	$(PNPM) build

start: ## Run the production build (after 'make build')
	$(PNPM) start

clean: ## Remove build output and test reports
	rm -rf .next test-results playwright-report tsconfig.tsbuildinfo

##@ Database (local Docker)

.PHONY: db-up db-down db-admin db-studio db-psql db-logs db-migrate db-generate db-seed db-seed-reset db-reset
db-up: ## Start Postgres on localhost:5434
	$(PNPM) db:up

db-down: ## Stop Postgres and pgAdmin (data is kept)
	$(COMPOSE) down

db-admin: ## Start pgAdmin on http://localhost:5050 (no login)
	$(PNPM) db:admin

db-studio: ## Open Drizzle Studio (no Docker needed)
	$(PNPM) db:studio

db-psql: db-up ## psql shell; another database: make db-psql DB=taskboard_e2e
	$(COMPOSE) exec db psql -U postgres -d $(DB)

db-logs: ## Follow Postgres and pgAdmin logs
	$(COMPOSE) logs -f

db-migrate: ## Apply migrations
	$(PNPM) db:migrate

db-generate: ## Create a migration from schema changes: make db-generate NAME=add_due_date
	$(PNPM) db:generate $(if $(NAME),--name $(NAME))

db-seed: ## Create missing demo accounts and Demo board (never changes existing data)
	$(PNPM) db:seed

db-seed-reset: ## Delete and rebuild the Demo board (asks first)
	$(call confirm,Delete the Demo board with its tasks and invites and rebuild it?)
	$(PNPM) db:seed --reset

db-reset: ## Wipe ALL local data and start fresh: migrate + seed (asks first)
	$(call confirm,Delete ALL local databases including dev and e2e data?)
	$(COMPOSE) down -v
	$(MAKE) db-up db-migrate db-seed

##@ Quality and tests

.PHONY: lint typecheck format format-check test test-integration test-e2e check ci
lint: ## ESLint
	$(PNPM) lint

typecheck: ## TypeScript
	$(PNPM) typecheck

format: ## Format all files with Prettier
	$(PNPM) format

format-check: ## Check formatting
	$(PNPM) format:check

test: ## Unit tests
	$(PNPM) test

test-integration: ## Integration tests (in-process Postgres, no Docker needed)
	$(PNPM) test:integration

test-e2e: db-up ## End-to-end tests (builds the app; uses the taskboard_e2e database)
	$(PNPM) test:e2e

check: lint typecheck format-check test test-integration ## Everything fast: lint, types, format, unit, integration

ci: check build test-e2e ## Everything CI runs, including the build and e2e tests

##@ Accounts (maintainer tools)

.PHONY: users set-password delete-user
users: ## List accounts and their sign-in methods
	$(PNPM) user:admin list

set-password: ## Set a password: make set-password EMAIL=a@b.com [PASSWORD=...] (random if omitted)
	@test -n "$(EMAIL)" || { echo "Usage: make set-password EMAIL=you@example.com [PASSWORD=...]"; exit 1; }
	$(PNPM) user:admin set-password $(EMAIL) $(PASSWORD)

delete-user: ## Delete an account and boards only they own: make delete-user EMAIL=a@b.com (asks first)
	@test -n "$(EMAIL)" || { echo "Usage: make delete-user EMAIL=someone@example.com"; exit 1; }
	$(call confirm,Delete $(EMAIL) and every board only they own?)
	$(PNPM) user:admin delete-user $(EMAIL)
