# VC Task Board

A shared Kanban board (Backlog → To Do → In Progress → In Review → Done). People sign in with
email and password (or Google), keep several boards, and share them with an invite link.
Built with Next.js 16 on Vercel and Postgres (Neon).

- Requirements: [Requirement.MD](Requirement.MD)
- Design: [design/design.html](design/design.html) (open in a browser)
- Architecture, decisions and roadmap: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

## Quick start

Prerequisites: Node.js 24, pnpm (`corepack enable`), Docker.

```bash
make setup    # install, create .env.local (with a fresh secret), start Postgres, migrate, demo data
make dev      # http://localhost:3000 — sign in as viet@example.com / 1234567890
```

To use a Neon dev branch instead of Docker: `vercel link && vercel env pull .env.local`.

## Make commands

`make` (or `make help`) lists every command. The ones you'll use most:

| Command | What it does |
| --- | --- |
| `make dev` | Start Postgres if needed, then the dev server |
| `make db-admin` | pgAdmin at http://localhost:5050 |
| `make db-psql` | psql shell (`make db-psql DB=taskboard_e2e` for the test database) |
| `make db-migrate` / `make db-generate NAME=…` | Apply migrations / create one from schema changes |
| `make db-seed` | Create missing demo accounts and Demo board (never changes existing data) |
| `make check` | Lint, typecheck, formatting, unit and integration tests |
| `make ci` | Everything CI runs, including the build and e2e tests |
| `make verify` | **Final check before `git push`**: everything above, plus a migration drift check, a security audit, and a Vercel-style build of the exact commit in a fresh checkout against an empty database (~1 min) |
| `make users` / `make set-password EMAIL=… [PASSWORD=…]` | Account maintenance |
| `make db-down` | Stop Postgres and pgAdmin (data is kept) |

Destructive commands (`db-seed-reset`, `db-reset`, `delete-user`) ask before doing anything;
add `CONFIRM=yes` to skip the question in scripts. Each target wraps a pnpm script, so
`pnpm <script>` works too.

## Browsing the database

```bash
make db-admin    # starts pgAdmin in Docker → http://localhost:5050
```

pgAdmin opens without a login and is already connected to the local database (the server
"Task board (local Docker)"). Expand **Servers → Task board (local Docker) → Databases →
taskboard → Schemas → public → Tables**, then right-click a table → **View/Edit Data → All Rows**.
The `taskboard_e2e` database (used by the e2e tests) is listed there too.

It's only reachable from your own machine (bound to `127.0.0.1`) and is for local data only.
`make db-down` stops it along with Postgres. `make db-studio` (Drizzle Studio) is a lighter
alternative that needs no Docker.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js dev server, production build, production server |
| `pnpm lint` / `typecheck` / `format` | ESLint, TypeScript, Prettier |
| `pnpm test` | Unit tests (domain logic) |
| `pnpm test:integration` | Services and permissions against an in-process Postgres (PGlite) |
| `pnpm test:e2e` | Playwright against a production build and the `taskboard_e2e` database (needs `pnpm db:up`) |
| `pnpm db:generate` | Create a SQL migration from changes in `src/server/db/schema.ts` |
| `pnpm db:up` / `db:admin` | Start Postgres / start pgAdmin at http://localhost:5050 |
| `pnpm db:migrate` / `db:studio` | Apply migrations / browse the database (Drizzle Studio) |
| `pnpm db:seed` | Create the demo accounts and "Demo board" if they're missing; never changes existing data. `pnpm db:seed --reset` rebuilds the Demo board |
| `pnpm user:admin …` | Maintainer tools, see below |

## Environment variables

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection. On Vercel it comes from the Neon integration (one branch per Preview). |
| `DATABASE_URL_UNPOOLED` | Optional direct connection, used for migrations when set (Neon adds it). |
| `BETTER_AUTH_SECRET` | Long random string. Use a different value in Production. |
| `BETTER_AUTH_URL` | The app's URL, e.g. `http://localhost:3000`. On Vercel: Production only; Previews use their branch URL. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional. The Google button only appears when both are set. |
| `OAUTH_PROXY_SECRET` | Lets Google sign-in work on Preview URLs. Same value in Production and Preview. |

## Deploying to Vercel

1. Import the GitHub repository in Vercel (the Next.js preset is detected).
2. Add **Neon** from the Vercel Marketplace (region `aws-us-east-1`, next to Vercel's default
   `iad1`). Turn on **Preview** branching and "Resource must be active before deployment".
3. Set the environment variables above.
4. Deploy. `vercel.json` sets the build command to check the environment variables, run
   `db:migrate`, then `next build`. Every deployment (including each Preview database branch) is
   migrated automatically, and a missing `DATABASE_URL` or `BETTER_AUTH_SECRET` stops the build
   with a message saying what to set. Variables only apply to new deployments, so redeploy after
   changing them.
5. For Google sign-in, register `https://<your-domain>/api/auth/callback/google` (and the
   localhost callback for development) in the Google Cloud console.

Migrations must stay backward compatible with the previous release (expand → contract), because
Vercel's Instant Rollback runs old code against the new schema.

**One exception: the per-board statuses release** (migrations `0001_board_statuses` and
`0002_drop_task_status_key`). It replaces `task.status` with `task.status_id`, so older code can't
run against the new schema. While that deployment builds, the live (older) version shows errors
for a minute or two, and Instant Rollback to a deployment from before it won't work. Deploy it when
nobody is using the board. To go back, restore the Neon branch to a point before the deploy
(Neon → Branches → Restore) and then roll back in Vercel.

## Maintainer tools

The app sends no email, so account recovery is manual:

```bash
make users                                       # accounts and sign-in methods
make set-password EMAIL=<email> [PASSWORD=...]   # random if omitted; signs them out everywhere
make delete-user EMAIL=<email>                   # e.g. someone who registered another person's email
```

Against Production, run with the Production `DATABASE_URL` and `BETTER_AUTH_SECRET`
(`vercel env pull --environment=production .env.production.local`).

## Project layout

```text
src/app          routes: pages, API route handlers, auth pages, invite page
src/features     UI by feature: board, statuses, task-editor, task-delete, boards, sharing, account, auth
src/components   shared UI primitives (button, field, modal, menu, tag, toast…)
src/domain       pure logic shared by client and server: types, Zod schemas, filtering, ordering
src/server       server-only: Better Auth, Drizzle schema + migrations, services, HTTP helpers
src/config       board vocabulary (default statuses, priorities, types, tones) and tuning knobs
scripts          seed and user-admin
tests            integration (PGlite) and e2e (Playwright)
```

Common changes (adding a priority or task type, changing the schema, adding an endpoint) are
listed in the maintenance guide in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#8-maintenance-guide).
