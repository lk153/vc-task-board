# VC Task Board — Implementation Plan

| | |
| --- | --- |
| **Status** | v1 implemented — 2026-10-08. All phases built and tested locally; going live needs your GitHub, Vercel, Neon and Google accounts (see §0). |
| **Inputs** | [Requirement.MD](Requirement.MD), [design/design.html](design/design.html) |
| **Target** | Vercel + Neon Postgres (connected through the Vercel Marketplace) |
| **Changes** | v2: tasks are stored in Postgres and people sign in to share boards. This replaces `localStorage`. v3: adds password sign-in alongside Google, open sign-up (no email-domain limit), and the default US East region. v4: password sign-in uses email (no usernames). v5: **the app sends no email at all** (no Resend). There is no email confirmation or password-reset email, and invites are shared as links that the owner copies. |

---

## 0. Implementation status

**Built:** everything in [Requirement.MD](Requirement.MD) and every phase in §5. Setup and day-to-day commands are in [README.md](README.md).

**Verified locally**

| Check | Result |
| --- | --- |
| Lint, typecheck, Prettier, production build | Clean |
| Unit tests (domain logic) | 25 passing |
| Integration tests (services, permissions, invites, Better Auth sign-up) on PGlite | 36 passing |
| End-to-end tests (Playwright, production build, desktop + mobile, axe accessibility checks) | 30 passing, stable over repeated runs |

**Still to do (needs your accounts)**

1. Create the GitHub repository, push, and protect `main` so CI (`.github/workflows/ci.yml`) must pass.
2. Import it in Vercel and add Neon with Preview branching (§4). Migrations run automatically during each build (`vercel.json`).
3. Create a Google OAuth client and set the Google variables. The Google button stays hidden until they're set.
4. On the first Production deploy: check Google sign-in on Production and a Preview URL, check that BotID works (it only runs on Vercel), run Lighthouse, do a quick pass in Safari and Firefox, and confirm Neon point-in-time restore.

**Decisions made while building** (the sections below are updated to match)

| Topic | What changed and why |
| --- | --- |
| Next.js 16.4 defaults | Cache Components and Partial Prefetching are on. Pages read the session inside `<Suspense>`, so each page has an instant static shell (skeleton) and streams the data. |
| Theme | Read from the cookie by a tiny inline `<head>` script instead of on the server, so pages keep their static shell and there's still no flash. |
| Sign-in / sign-out | Do a full page load. Otherwise the client router replays links it prefetched while signed out (found by the e2e tests). |
| Keyboard dragging | Press **M** to pick up a card (Enter/Space already open the editor, as in the design), arrows to move, Enter/Space to drop. Screen readers hear task and column names. |
| Drop targets | The whole column accepts a drop, not just the area with cards. |
| Delete button | Sits next to the card instead of inside it, so two controls aren't nested (accessibility). |
| Reduced motion | Animations are switched off when the system asks for reduced motion. |
| Local database | Postgres in Docker on port 5434 (`pnpm db:up`); e2e tests use a separate `taskboard_e2e` database. pgAdmin (`pnpm db:admin`, http://localhost:5050) browses it with no login, bound to localhost only. |
| Sign-up and existing emails | Sign-up says when an email is already registered. Without email confirmation this can't be hidden; rate limits and BotID slow down anyone probing. |

---

## 1. Summary

A Kanban board (Backlog → To Do → In Progress → In Review → Done) for teams. It has create/edit/delete, drag & drop, search, filters, dark mode and a mobile layout.

- **Sign in** with Google, or with email and password. Anyone can sign up.
- Each person can have **several boards**. An owner **shares a board by inviting an email address**: the app creates an **invite link**, and the owner copies it and sends it themselves.
- All data lives in **Postgres on the server**. Nothing is stored in `localStorage`.
- **The app sends no email.**

It's one Next.js app on Vercel. Server Components load the board, Route Handlers serve a small REST API, and a Neon Postgres database is connected through the Vercel Marketplace. Each Preview deployment gets its own database branch, so every PR can be tested end to end without touching production data.

**In scope (v1):** everything in [Requirement.MD](Requirement.MD).

**Out of scope (v1):**

- Sending any email: confirmation, password reset or invites
- Live push updates (we refresh by polling instead)
- Two-factor auth and passkeys
- A full account settings page (only **Change password** is in v1)
- Offline mode
- Comments, history, due dates

See [§9 Roadmap](#9-roadmap).

---

## 2. Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Cache Components) + **React 19** | Vercel detects it with no config. Server Components load the board on the server (streamed into a static shell), Route Handlers serve the API, and `proxy.ts` redirects signed-out users. |
| Language | **TypeScript** (`strict`) | Types are shared by client and server. Adding a status or type causes a compile error everywhere it must be handled. |
| Database | **Neon Postgres** via the Vercel Marketplace | Serverless Postgres. `DATABASE_URL` is added to the Vercel project automatically, and each Preview deployment gets its own copy of the database. |
| ORM & migrations | **Drizzle ORM** + **drizzle-kit**, `pg` driver with `attachDatabasePool` (`@vercel/functions`) | Typed queries, and migrations are plain SQL files committed to the repo. The standard driver works with Neon, the CI Postgres container and local Postgres. |
| Auth | **Better Auth**: Google OAuth, email & password, `oAuthProxy` and `captcha` plugins, `@better-auth/drizzle-adapter` | One library covers both sign-in methods. Users and sessions are stored in our own Postgres, with no per-user fees. Rate limiting and password hashing are built in. The Auth.js maintainers now recommend Better Auth for new projects. |
| Bot protection | Better Auth `captcha` plugin with **Vercel BotID** | Invisible checks on sign-up and sign-in. Needed because sign-up is open to everyone. |
| Server data on the client | **TanStack Query 5** | Caches board data, applies changes optimistically and rolls them back on error, and refetches when the window regains focus and on a timer. |
| UI state | **Zustand 5** (not persisted) | Search text, filters, open dialogs, toast, drag state. |
| Validation | **Zod 4** | The same schemas check the forms on the client and the request bodies on the server. |
| Ordering | **fractional-indexing** | Card order is a string key. Moving a card updates one row, and other cards never need renumbering. |
| Styling | **Tailwind CSS 4** + CSS custom properties | The design is built on tokens (light/dark + 13 color tones), and Tailwind's `@theme` turns them into utility classes. |
| UI primitives / icons / font | **Radix UI** (Dialog, AlertDialog, DropdownMenu), **lucide-react**, **Noto Sans** via `next/font` | Accessible behavior without imposing styles. Same icon style as the design. Self-hosted font. |
| Theme | Cookie + a one-line inline `<head>` script | Applies the saved theme before first paint without making every page dynamic. No flash and no `localStorage`. |
| Drag & drop | **@dnd-kit/core 6** + **@dnd-kit/sortable 10** | Moving between columns and reordering, with keyboard support. Turned off on mobile. |
| Tests | **Vitest** + React Testing Library; Drizzle on **PGlite** (Postgres running in-process) for integration tests; **Playwright** + `@axe-core/playwright` | Fast tests of the API and permissions without Docker, plus multi-user e2e tests in real browsers. |
| Code quality | ESLint (`eslint-config-next`), Prettier | Standard tooling. |
| Runtime / package manager | Node.js **24 LTS**, **pnpm** (via Corepack) | Matches the Node runtime Vercel supports. |
| CI/CD | GitHub Actions (with a Postgres service container) + Vercel Git integration | Each PR gets a Preview deployment with its own database branch. `main` deploys to Production. |
| Observability | Vercel Logs, Web Analytics, Speed Insights | Built in, with no extra infrastructure. |

---

## 3. Architecture

### 3.1 Layers

```text
 Browser
┌──────────────────────────────────────────────────────────────┐
│ UI  features/*, components/ui                                │
│  ├─ server data: TanStack Query hooks (features/*/api.ts)    │  optimistic + rollback
│  ├─ auth:        Better Auth client (lib/auth-client.ts)     │  sign-in, sign-up, password
│  └─ UI state:    Zustand ui-store                            │  search, filters, dialogs
└──────────────────────────┬───────────────────────────────────┘
                           │ fetch (JSON)
 Vercel Functions          ▼
┌──────────────────────────────────────────────────────────────┐
│ Route Handlers  app/api/**        session + Zod parse + HTTP │
│ Services        server/services/* permission checks + rules  │
│ Data            server/db/*       Drizzle schema + queries   │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
                     Neon Postgres

 domain/*  pure TS shared by both sides: types, Zod schemas, filter, ordering
```

#### Rules

1. **Permissions are checked in services, not in `proxy.ts`.** Every handler calls `requireSession()`, and every board-scoped service calls `requireMember(boardId, role?)`. `proxy.ts` only redirects signed-out visitors to `/sign-in`. The Next.js docs warn against relying on proxy alone.
2. **Components never call `fetch` directly.** They use the query and mutation hooks in `features/*/api.ts`, or the Better Auth client.
3. **`domain/` is pure and shared.** The same Zod schema checks the editor form and the API body.
4. **`server/**` imports `server-only`**, so database code and secrets can't end up in the browser bundle.
5. **Board vocabulary** (statuses, priorities, types, tones, timings, limits) is defined in **one** file: `src/config/board.ts`. Assignees are board members, not a hardcoded list.

### 3.2 Folder structure

```text
src/
├── proxy.ts                         # signed-out → /sign-in for / and /b/* (UX only, see Rules)
├── instrumentation-client.ts        # BotID client (only on Vercel)
├── app/
│   ├── layout.tsx                   # <html>, theme script, font, Providers, toasts
│   ├── providers.tsx                # TanStack Query client
│   ├── globals.css                  # Tailwind + design tokens (light-dark()), reduced motion
│   ├── page.tsx                     # → last-opened board (cookie) or first board
│   ├── (auth)/sign-in, sign-up      # static pages with client forms
│   ├── invite/[token]/page.tsx      # explains the invite; Join / Sign in / Create account
│   ├── b/[boardId]/page.tsx         # loads board on the server → <BoardApp initialView/>
│   ├── error.tsx, not-found.tsx
│   └── api/
│       ├── auth/[...all]/route.ts   # Better Auth handler
│       ├── boards/**/route.ts       # REST API (§3.5)
│       └── invites/[token]/accept/route.ts
├── config/board.ts                  # STATUSES, PRIORITIES, TASK_TYPES, TONES, BREAKPOINT, TOAST_MS, POLL_MS, INVITE_TTL_DAYS, LIMITS
├── domain/                          # task.ts (types + Zod), filter.ts, ordering.ts, tone.ts (+ unit tests)
├── server/                          # server-only
│   ├── auth.ts                      # Better Auth config (§3.6)
│   ├── config.ts                    # feature switches from env (googleEnabled)
│   ├── errors.ts, http.ts           # HttpError helpers; requireSession(), route() wrapper → JSON errors
│   ├── db/                          # client.ts (pg Pool + Drizzle), schema.ts, migrations/
│   └── services/                    # access.ts, boards.ts, tasks.ts, members.ts, invites.ts, accounts.ts
├── features/
│   ├── auth/auth-forms.tsx          # SignInForm, SignUpForm, Google button
│   ├── board/                       # BoardApp, Header, FilterBar, StatusTabs, BoardColumns (dnd), Column, TaskCard, Fab, api.ts, hotkeys
│   ├── task-editor/                 # TaskEditor (dialog / bottom sheet), PriorityPicker
│   ├── task-delete/                 # DeleteTaskDialog (confirm + Undo)
│   ├── boards/                      # BoardSwitcher, BoardDialogs (new / rename / delete)
│   ├── sharing/                     # ShareDialog (invite link, pending invites, members), invite page actions
│   └── account/                     # UserMenu, ThemeToggle, ChangePasswordDialog
├── components/                      # ui/ primitives (button, field, modal, menu, tag, avatar, toast…), board skeleton, message page
├── hooks/use-is-mobile.ts
├── store/ui-store.ts                # Zustand: UI-only state
└── lib/                             # api-client.ts, auth-client.ts, theme.ts, cn.ts
scripts/                             # seed.ts (local/Preview demo data), user-admin.ts (maintainer tools)
tests/
├── integration/                     # services, permissions, invites, auth — on PGlite
└── e2e/                             # Playwright specs (desktop + mobile), one per requirement area
docker-compose.yml                   # local Postgres (port 5434) + taskboard_e2e database; pgAdmin on localhost:5050
Makefile                             # shortcuts for every command (`make help`)
.github/workflows/ci.yml             # lint → typecheck → format → unit → integration → build → e2e
```

### 3.3 Rendering & data flow

- **First load:** `/b/[boardId]` is a dynamic Server Component. It checks the session and membership, then loads the board, members and tasks in one go and passes them to the client as TanStack Query `initialData`. The full board is in the first HTML, with no spinner. A non-member gets **404**, so we don't reveal that the board exists.
- **Changes:** update the cache optimistically → call the API → on error, roll back and show a toast ("Couldn't save — change undone") → refetch the board when the request finishes.
- **Seeing other people's changes:** refetch when the window regains focus, and every `POLL_MS` (15 s) while the tab is visible. Polling pauses during a drag. Live push is on the roadmap.
- **Edits at the same time:** `PATCH` sends only the fields that changed, and for each field the last write wins. A move only touches the moved task's `status` and `position`.
- **Theme:** an inline `<head>` script reads the `tb-theme` cookie and sets `data-theme` before first paint. With no cookie, CSS `light-dark()` follows the system setting. The toggle writes the cookie.
- **Signing in or out** does a full page load, so nothing cached or prefetched under the previous session is reused.

### 3.4 Data model (Postgres)

```text
user                                          ← Better Auth
  id · name · email (unique, lower-cased) · email_verified · image · created_at · updated_at
                                                email_verified is true only for Google accounts
session · account · verification · rate_limit ← Better Auth

board
  id uuid PK · name text (1–80) · created_by → user · created_at · updated_at

board_member                                  PK (board_id, user_id)
  board_id → board ON DELETE CASCADE · user_id → user ON DELETE CASCADE
  role text 'owner' | 'member' · created_at

board_invite                                  UNIQUE (board_id, email) WHERE accepted_at IS NULL
  id uuid PK · board_id → board ON DELETE CASCADE
  email text (lower-cased)                    the account that may accept it
  token text UNIQUE                           32 random bytes, base64url; the secret part of the link
  invited_by → user · created_at · expires_at (created_at + INVITE_TTL, 7 days)
  accepted_at NULL · accepted_by → user NULL

task                                          INDEX (board_id, status, position) WHERE deleted_at IS NULL
  id uuid PK · board_id → board ON DELETE CASCADE
  title text (1–200) · description text (≤ 5000, default '')
  status · priority · type NULL               text; allowed values come from config/board.ts, checked by Zod
  assignee_id → user NULL                     must be a member of the board
  points real NULL                            ≥ 0, step 0.5
  position text COLLATE "C"                   fractional-indexing key (byte order is required)
  created_by → user · created_at · updated_at
  deleted_at NULL                             soft delete, so Undo works for everyone
```

- Statuses, priorities and types are `text`, not Postgres enums. Adding a value is then a config change with no migration.
- Defaults on create: status = the column you clicked, priority `medium`, type `tech`, unassigned, `position` = after the last card in that column.
- Soft-deleted tasks are hidden everywhere. Purging them permanently is on the roadmap.

### 3.5 API

All endpoints return JSON. Errors are `{ error: { code, message } }` with status 401 / 403 / 404 / 410 / 422 / 429. Bodies are checked with the shared Zod schemas. Sign-in, sign-up and change-password endpoints are provided by Better Auth under `/api/auth/*`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/boards` | signed in | Boards I'm a member of |
| POST | `/api/boards` | signed in | Create a board (creator becomes owner) |
| GET | `/api/boards/:boardId` | member | Board + members + tasks (+ pending invites with links, for owners) |
| PATCH / DELETE | `/api/boards/:boardId` | owner | Rename / delete the board |
| POST | `/api/boards/:boardId/tasks` | member | Create a task |
| PATCH | `/api/boards/:boardId/tasks/:taskId` | member | Update fields or move (`status` + `position`) |
| DELETE | `/api/boards/:boardId/tasks/:taskId` | member | Soft delete |
| POST | `/api/boards/:boardId/tasks/:taskId/restore` | member | Undo a delete |
| POST | `/api/boards/:boardId/invites` | owner | Create an invite for an email. Returns the invite link |
| DELETE | `/api/boards/:boardId/invites/:inviteId` | owner | Cancel an invite |
| DELETE | `/api/boards/:boardId/members/:userId` | owner, or yourself (leave) | Remove a member or leave the board |
| POST | `/api/invites/:token/accept` | signed in, with the invited email | Join the board. 410 if expired or already used |

Tasks always sit under their board in the URL, so every query is filtered by `board_id` and membership is checked once per request.

### 3.6 Sign-in & sharing

#### Sign-in methods

Configured in `server/auth.ts`.

| Method | How it works |
| --- | --- |
| Google | Google OAuth. The email is verified by Google. Preview deployments sign in through `oAuthProxy` (§4). |
| Email + password | `emailAndPassword`, with `signUp.email` and `signIn.email`. Passwords are 8–128 characters and hashed with scrypt (Better Auth's default). **Email verification is off**, because the app can't send email. |

#### Accounts

1. **Sign-up** is open to anyone (no email-domain limit). It asks for name, email and password, and the person is signed in straight away.
   - The app doesn't check that a password account's email really belongs to that person, so it **never relies on that email** for anything sensitive. See linking (3) and invites below.
2. **No "Forgot password?"** in v1, because a reset link has to be sent by email.
   - Signed-in users can **change their password** from the user menu (Better Auth `changePassword`, which signs out other sessions).
   - If someone forgets their password: they can sign in with Google if they've connected it. Otherwise a maintainer runs `pnpm user:admin set-password <email>`, which sets a temporary password to share with them privately, and they change it after signing in.
3. **Linking accounts:** Better Auth's automatic linking is **turned off** (`disableImplicitLinking`). An unconfirmed password account must never be merged into someone's Google sign-in.
   - If Google sign-in finds an existing password account with the same email, we show: "An account with this email already exists. Sign in with your password, then connect Google from your account menu."
   - If someone else registered that email first, a maintainer removes the impostor account with `pnpm user:admin delete-user <email>`.
4. **Abuse protection:**
   - Better Auth rate limiting with `storage: "database"`, because in-memory counters aren't shared between Vercel instances. `/sign-in/email` is already limited more strictly by default (3 requests per 10 s).
   - The `captcha` plugin (Vercel BotID) on its default endpoints, which cover sign-up and sign-in.

#### Boards & sharing

1. **First sign-in:** if the person has no boards, a board called "My board" is created with them as owner.
2. **Invite:** the owner opens **Share** and enters an email. The app creates an invite and shows **Copy link** (`/invite/<token>`). The owner sends the link themselves, for example in chat. Pending invites stay in the Share dialog, so the link can be copied again or the invite cancelled.
3. **Accept:** the recipient opens the link and signs in or signs up. If the signed-in account's email **matches** the invite, they join and land on the board. Both the secret link **and** the matching email are needed, so a forwarded link alone isn't enough.
   - Otherwise they see a clear error: wrong account ("This invite is for a•••@company.com"), expired (after 7 days), already used, or cancelled.
4. **Roles:**
   - **Owner:** rename or delete the board, invite and remove members, cancel invites.
   - **Member:** every task action, and leaving the board.
   - A board always has at least one owner.
5. **Assignees** are the board's members. Removing someone unassigns their tasks on that board.

### 3.7 Behavior spec (taken from the design)

`design/design.html` is a self-unpacking bundle. Open it in a browser to see the design. This table records its behavior. Rows marked **(new)** are not in the design. Build them with the existing tokens and components, and get design sign-off.

| Area | Rule |
| --- | --- |
| Breakpoint | `< 720px` = mobile |
| Create entry points | Header **New task** (desktop), column **+** and **Add task**, **FAB** (mobile), `N` key |
| Create defaults | Status = clicked column, or `todo` (desktop header / `N`), or the active tab (mobile). Priority `medium`, type `tech` |
| Validation | Empty title → inline "Give the task a title." and focus moves to the title. Negative or NaN points → `null`. The server applies the same rules |
| Save | Button, or `⌘/Ctrl+Enter`. Toasts: "Task created in {Status}" / "Changes saved". On mobile, the tab switches to the new task's status |
| Edit | Click a card, or press `Enter`/`Space` on a focused card |
| Delete | Trash icon on hover (desktop), **Delete** in the editor, or `Delete`/`Backspace` on a focused card → confirm (Cancel has focus) → "Task deleted" toast + **Undo** (restores the task) |
| Toasts | One at a time. 2.8 s normally, 6 s with Undo. **(new)** On a save error: "Couldn't save — change undone" |
| Esc | Closes, in priority order: confirm → editor → filter panel |
| `/` | Focuses search. Shortcuts are ignored while typing or while a dialog is open |
| Search | Case-insensitive substring match on title + description (done on the client) |
| Filters | **(changed)** One multi-select dropdown each for Priority, Task type and Assignee (board members + Unassigned), with the same colored tags as the cards. OR within a dropdown, AND across them. Each trigger shows its selection ("High, Low") and a count; the Filter button shows the total. **Clear all**, or clear one dropdown from its menu |
| Counts | Header shows "N tasks". A column shows "x of y" when filtered. Mobile tab counts respect filters |
| Empty states | "No tasks yet" / "No matching tasks" / "Drop here" |
| Drag & drop | Desktop only. Move between columns + reorder; drop anywhere in a column. Column highlight, dragged card at 40% opacity (the gap where it will land shows the drop position). "Moved to {Status}" toast when the status changes |
| **(new)** Keyboard move | Focus a card, press **M**, use the arrow keys, then Enter/Space to drop or Esc to cancel. Screen readers announce task and column names |
| **(new)** Reduced motion | No slide-up, pop or fade animations when the system asks for reduced motion |
| Mobile | Status tabs (default **To Do**), single column, FAB, editor as a bottom sheet (max 92dvh), toast sits above the FAB, no dragging |
| Overlay | Clicking outside closes the editor only if the mouse-down also started outside |
| Card display | Title, one-line description preview, points (2 decimals), assignee/priority/type tags, colored bottom border by status |
| Assignee tag color | **(new)** The design hardcodes a color per person. We pick each member's color from the tone palette using a hash of their user id, so it's the same everywhere |
| **(new)** Header | The board title becomes the **board switcher** (list of boards, **New board**). Adds a **Share** button and a user avatar menu (name, email, **Connect Google**, **Change password**, **Sign out**) |
| **(new)** Share dialog | Members with their roles (remove / leave). Invite by email → **Copy link** (toast "Invite link copied"). Pending invites show their expiry, with **Copy link** and **Cancel** |
| **(new)** Auth pages | **Sign in:** Google button, email + password, link to sign up. **Sign up:** name, email, password → signed in straight away. Both keep an invite link's destination, so the person comes back to the invite afterwards |
| **(new)** Invite page | Shows the board name and who invited you, then **Join board**. If not signed in: **Sign in** / **Sign up**. Errors: wrong account, expired, already used, cancelled |
| **(new)** Other pages | Board not found / no access, loading skeleton, error page |

---

## 4. Deployment on Vercel

1. **Import** the GitHub repo in Vercel. The Next.js preset is detected automatically. The only `vercel.json` setting is the build command (step 4).
2. **Add Neon** from the Vercel Marketplace and connect it to the project. Under *Deployments Configuration*, turn on **Preview** and **"Resource must be active before deployment"**. Each Preview deployment then gets its own database branch (`preview/<git-branch>`) with its own `DATABASE_URL`.
3. **Region:** use Vercel's default Functions region **`iad1`** (Washington, D.C.) and create the Neon database in **`aws-us-east-1`** (N. Virginia). Always keep the two in the same region. If you move one, move both.
4. **Build:** nothing to configure in the dashboard. `vercel.json` sets the build command to `pnpm db:migrate && pnpm build`, so each environment's database (including every Preview branch) is migrated before its build.
5. **Environment variables:**

   | Variable | Set by | Environments |
   | --- | --- | --- |
   | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon integration | all (one branch per Preview) |
   | `BETTER_AUTH_SECRET` | you | all (different value in Production) |
   | `BETTER_AUTH_URL` | you | Production (Preview/Dev work it out from `VERCEL_BRANCH_URL` / localhost). Also used to build invite links |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud console | all |
   | `OAUTH_PROXY_SECRET` | you | Production + Preview (**must be the same value**) |

6. **Google OAuth:** register only `https://<prod-domain>/api/auth/callback/google` and the localhost callback. Preview deployments sign in through Better Auth's `oAuthProxy`, which sends the login through Production and back. Add the preview URL pattern to `trustedOrigins`. Don't expose the proxy secret to previews built from forks.
7. **Migrations must be expand → contract.** Never drop or rename a column in the same deploy that stops using it. Vercel's *Instant Rollback* runs old code against the new schema, so every migration must work with the previous release.
8. **Security headers** in `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy: same-origin` (so invite tokens in the URL aren't sent to other sites), `Permissions-Policy`, CSP `frame-ancestors 'none'`.
9. **Local development:** `pnpm db:up` (Postgres in Docker on port 5434) or `vercel env pull .env.local` (a Neon dev branch) → `pnpm db:migrate && pnpm db:seed && pnpm dev`. See [README.md](README.md).
10. **Maintainer tools:** run `pnpm user:admin <command> <email>` locally with the Production `DATABASE_URL` (pulled with `vercel env pull --environment=production`). Only maintainers have access.

**`package.json` scripts:** `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `test`, `test:integration`, `test:e2e`, `db:up`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`, `user:admin`.
**CI (GitHub Actions):** install → lint → typecheck → format check → unit + integration tests (PGlite) → build → Playwright against `next start` and a Postgres service container. Playwright's global setup migrates and empties the e2e database; every test signs up through the real form, and no test-only sign-in shortcut exists. Each browser context gets its own client IP, so auth rate limits don't leak between tests.

---

## 5. Phases

Production goes live in **Phase 0**. Each later phase is one or more PRs, each with a Preview URL and its own database branch. Estimates are rough, for one engineer.

| # | Phase | Est. | Status |
| --- | --- | --- | --- |
| 0 | Foundation & pipeline (Vercel + Neon) | 1 d | Code and CI done; Vercel, Neon and GitHub setup need your accounts |
| 1 | Design system & app shell | 1 d | Done |
| 2 | Data model & Google sign-in | 2 d | Done; Google needs OAuth credentials to test |
| 3 | Password sign-in | 1 d | Done |
| 4 | Domain, services & API | 1.5 d | Done |
| 5 | Board view | 1 d | Done |
| 6 | Create & edit | 1.5 d | Done |
| 7 | Delete & undo | 0.5 d | Done |
| 8 | Search & filters | 1 d | Done |
| 9 | Drag & drop | 1 d | Done |
| 10 | Multiple boards & sharing (invite links) | 2.5 d | Done |
| 11 | Hardening & launch | 1.5 d | Done locally; Production checks listed in §0 |
| | **Total** | **≈ 15.5 d** | |

### Phase 0 — Foundation & pipeline

- Scaffold with `create-next-app` (TS, App Router, Tailwind, ESLint, `src/`). Add Prettier, Vitest and Playwright.
- Connect Vercel and add Neon from the Marketplace with Preview branching (region `iad1` / `aws-us-east-1`). Set up Drizzle with a first (empty) migration and the `db:*` scripts. Set the build command to `db:migrate && build`.
- GitHub Actions with a Postgres service container. Branch protection on `main`.
- **Exit:** a placeholder page is live in Production. A test PR gets a Preview URL **and** its own database branch, with green CI.

### Phase 1 — Design system & app shell

- Port the tokens from the design into `globals.css` (light, `[data-theme="dark"]`, tones `--t-{tone}-{bg|fg|line}`). Expose them through Tailwind `@theme`. Add Noto Sans and the keyframes.
- Cookie-based theme: the server renders `data-theme`, CSS falls back to the system setting, and the toggle writes the cookie.
- UI primitives in `components/ui`. Add the `useIsMobile` hook. Header layout with empty slots for the board switcher, Share button and user menu.
- **Exit:** the header matches the design in both themes and at both breakpoints. The theme survives a reload with no flash, and nothing is written to `localStorage`.

### Phase 2 — Data model & Google sign-in

- Drizzle schema (§3.4) including the Better Auth tables (with `rate_limit`), and the first migration.
- Better Auth with Google, the Drizzle adapter and `oAuthProxy`. Add `/sign-in` (Google button for now), `proxy.ts`, `requireSession()` and the user menu with sign-out.
- First sign-in setup: create "My board".
- **Exit:** Google sign-in and sign-out work on Production, a Preview URL and localhost. Signed-out visitors are redirected to `/sign-in`.

### Phase 3 — Password sign-in

- `emailAndPassword` (verification off). Sign-up and sign-in pages, and **Change password** in the user menu.
- Turn off automatic account linking, and add **Connect Google** to the user menu.
- Rate limiting (database storage) and the captcha plugin with Vercel BotID.
- `scripts/user-admin.ts` (`set-password`, `delete-user`). Playwright global setup that creates test users.
- **Exit:**
  - e2e tests pass for sign-up → signed in → sign out → sign in again; a wrong password shows an error; repeated failures get 429; change password works.
  - A Google sign-in with an existing password account's email shows the "connect" message.
  - The admin script resets a password and deletes a user.

### Phase 4 — Domain, services & API

- `config/board.ts` and `domain/*` (Zod schemas, `matchTask`, ordering with `fractional-indexing`).
- Services with `requireMember` and the Route Handlers in §3.5, with consistent JSON error handling.
- Integration tests on PGlite, including permission tests: non-member → 404, member can't manage members, a task can't be moved to another board.
- **Exit:** tests pass, with ≥ 90% coverage on `domain/` and `server/services/`.

### Phase 5 — Board view

- `/b/[boardId]` loads the board on the server and passes it to TanStack Query as `initialData`. `/` redirects to a board.
- `Board`, `Column`, `TaskCard` (assignee colors from the hashed tone); on mobile, `StatusTabs` and the `Fab`. Loading skeleton and not-found pages.
- Polling (`POLL_MS`) and refetch when the window regains focus.
- **Exit:** the seeded board matches the design at 375 px and 1280 px in light and dark. A change made in another browser shows up within 15 s.

### Phase 6 — Create & edit

- `TaskEditor` on Radix Dialog: centered on desktop, bottom sheet on mobile. All fields; assignee options are the board's members. Validation and `⌘/Ctrl+Enter`.
- Wire every entry point plus `N` and card `Enter`/`Space`. Optimistic create/update with rollback and an error toast.
- **Exit:** e2e tests pass for create (each entry point), edit, validation, and a forced server error rolling back.

### Phase 7 — Delete & undo

- Hover trash icon, editor **Delete**, and `Delete`/`Backspace` on a focused card → AlertDialog → soft delete → **Undo** calls `restore`.
- **Exit:** e2e test passes: delete → undo puts the task back in the same column and position, and survives a reload.

### Phase 8 — Search & filters

- Search (desktop and mobile variants, `/` shortcut, clear button). Filter panel with chip groups (assignee chips come from the members), badge count and **Clear all**. "x of y" counts. Esc priority order.
- **Exit:** unit tests cover the filter combinations, and the e2e search + filter test passes.

### Phase 9 — Drag & drop

- `DndContext` + one `SortableContext` per column. Pointer and keyboard sensors, turned off on mobile.
- On drop, compute the new key from the neighboring cards and send **one** `PATCH`. Polling pauses during a drag.
- **Exit:** e2e tests pass for moving across columns and reordering. The order is the same after a reload and in a second browser.

### Phase 10 — Multiple boards & sharing (invite links)

- `BoardSwitcher` (list, **New board**). Rename and delete for owners.
- `ShareDialog`: members with their roles, invite by email → **Copy link**, pending invites (copy again / cancel), remove a member, leave the board. Keep at least one owner. Unassign tasks when a member is removed.
- `/invite/[token]` page and the accept endpoint (email must match, not expired, single use). The sign-in and sign-up pages return to the invite afterwards. Remember the last-opened board in a cookie (`tb-last-board`).
- **Exit:**
  - Two-user e2e test passes: the owner invites B's email and copies the link → B opens it, signs up with a password and joins → B's edits show up for the owner → the owner removes B → B gets 404.
  - More tests pass for: wrong account, expired link, reused link, cancelled invite, and joining through Google sign-in.

### Phase 11 — Hardening & launch

- Security review:
  - A permission test for every route, input size limits and a Vercel Firewall rate-limit rule on write endpoints.
  - Cookie flags, auth rate limits and captcha working on Production.
  - Invite tokens are unguessable and never logged, and `Referrer-Policy` is set.
  - Sign-up says when an email is taken (unavoidable without email confirmation); rate limits and BotID slow down probing.
- Accessibility (axe in every spec including the auth and invite pages, keyboard-only walkthrough, focus returns after dialogs close). Test in Chrome, Firefox and Safari (desktop and iOS). Lighthouse ≥ 95 for Performance and Accessibility.
- Confirm Neon point-in-time restore works. Error boundaries. `README.md` covering setup, environment variables, deployment, maintainer tools and how to extend (§8).
- **Exit:** every row in §6 is verified. Promote to Production.

---

## 6. Requirements Traceability

| Requirement | Phase | Verified by |
| --- | --- | --- |
| Create via header / column / `N`; title required; all fields | 6 | `e2e/create-task.spec.ts` |
| Edit via card click → form | 6 | `e2e/edit-task.spec.ts` |
| Drag between columns and reorder (desktop) | 9 | `e2e/drag-drop.spec.ts` |
| Delete via trash / form / `Delete` key → confirm → Undo | 7 | `e2e/delete-task.spec.ts` |
| Dark/light: system default, remembered | 1 | `e2e/theme.spec.ts` |
| Mobile < 720px: tabs, FAB, bottom sheet, no drag, status via form | 5, 6, 9 | `e2e/mobile.spec.ts` (mobile project) |
| Search + `/` shortcut | 8 | `e2e/search-filter.spec.ts` |
| Filters: priority, type, assignee | 8 | `e2e/search-filter.spec.ts`, `domain/filter.test.ts` |
| Sign in with Google | 2 | Manual check on Production + a Preview URL (needs OAuth credentials). First sign-in setup: `integration/auth.test.ts` |
| Sign up / sign in with email + password (open sign-up), change password, sign out | 2, 3 | `e2e/auth-password.spec.ts`, `integration/auth.test.ts` |
| Boards and sharing: several boards, invite by email via a copied link, owner/member roles, assignees are members | 10 | `e2e/sharing.spec.ts` (two users), `integration/invites.test.ts`, `integration/permissions.test.ts` |
| Storage: saved on the server, same board for every member on any device, others' changes appear | 4, 5 | `integration/tasks.test.ts`, `e2e/persistence.spec.ts` |

---

## 7. Definition of Done (every PR)

- CI passes: lint, typecheck, unit tests, integration tests, build, e2e.
- Preview URL (with its own database branch) checked at 375 px and 1280 px, in light and dark.
- Every new or changed endpoint has permission tests for a member and a non-member.
- Migrations are generated by `drizzle-kit`, committed, and work with the previous release (expand → contract).
- No board vocabulary or magic numbers outside `config/board.ts`. No `localStorage`.
- Short-lived branches off `main` with Conventional Commit messages.

---

## 8. Maintenance Guide

| To… | Change |
| --- | --- |
| Add a status / priority / task type | Add an entry to `src/config/board.ts`. TypeScript flags the rest. No migration is needed, because these are `text` columns. To **remove** a value, first migrate the rows that use it. |
| Change the database schema | Edit `server/db/schema.ts` → `pnpm db:generate` → review and commit the SQL → it runs on the next deploy. Follow expand → contract. |
| Add an API endpoint | Route Handler (session + Zod) → service function (`requireMember` + rules) → integration test with permission cases → a hook in `features/*/api.ts`. |
| Add a sign-in provider (GitHub, Microsoft…) | Add it in `server/auth.ts`, add its keys as environment variables, add a button in `features/auth`, and allow it in **Connect** in the user menu. |
| Help a user who forgot their password | `pnpm user:admin set-password <email>`, then share the temporary password with them privately. |
| Remove an account that took someone else's email | `pnpm user:admin delete-user <email>`. Their boards with no other owner are deleted too. |
| Change password or rate-limit rules | Better Auth options in `server/auth.ts`, plus the matching Zod rules in the sign-up form. |
| Change invite expiry | `INVITE_TTL_DAYS` in `config/board.ts`. |
| Add a new color tone | Add `--t-{tone}-bg/-fg/-line` to **both** the light and dark blocks in `globals.css`. |
| Change the breakpoint, toast timing or polling interval | Change `BREAKPOINT` / `TOAST_MS` / `POLL_MS` in `config/board.ts`. |
| Move to another region | Move the Vercel Functions region and the Neon database **together** (Neon: create a project in the new region and restore into it). |
| Add a feature | Create a new folder in `src/features/<name>`. Server logic goes in `server/services`, pure logic in `domain/`. |

---

## 9. Roadmap

| Enhancement | Approach |
| --- | --- |
| **Email** (first priority once a provider is set up) | Add a provider (e.g. Resend from the Vercel Marketplace) and a domain you own. Then turn on Better Auth's email confirmation (`requireEmailVerification`), "Forgot password?" (`sendResetPassword`) and invite emails. Once emails are confirmed, the `user:admin` workarounds are no longer needed, and invites can be accepted automatically by confirmed email. |
| **Live updates** | Replace polling with a hosted pub/sub service (e.g. Ably, Pusher, Liveblocks). Services publish task events, and the client updates the TanStack Query cache. |
| **Account settings** | Change name or email, unlink Google, delete account (Better Auth already has these endpoints). |
| **Two-factor auth & passkeys** | Better Auth `twoFactor` and `passkey` plugins. |
| **Purge deleted tasks** | A Vercel Cron job (declared in `vercel.json`) that permanently deletes rows with `deleted_at` older than 30 days. |
| **Activity history & comments** | `task_event` and `comment` tables, written by the services. |
| **More** | Viewer role, workspaces, due dates, URL-synced filters, offline mode, more sign-in providers (GitHub, Microsoft). |

---

## 10. Risks & Decisions

| Risk / decision | Mitigation / rationale |
| --- | --- |
| No email, so password accounts' emails are never confirmed | Unconfirmed emails are never trusted: invites need the secret link **and** a matching email, and Google is never linked automatically. A maintainer can remove impostor accounts. Adding email (roadmap) closes this gap. |
| No self-service password reset | Change password while signed in, sign in with a connected Google account, or a maintainer sets a temporary password (`user:admin`). |
| Invite links can be forwarded or leak | Joining also needs a signed-in account with the invited email. Links are single-use, expire after 7 days, can be cancelled, and `Referrer-Policy: same-origin` keeps them out of other sites' logs. |
| Open sign-up (no email-domain limit) attracts bots and spam accounts | Rate limits are stored in the database, and BotID captcha protects sign-up and sign-in. A new account only sees its own "My board". |
| Route Handlers + TanStack Query, not Server Actions | Gives an explicit REST contract: GET requests can be polled, endpoints are easy to test over HTTP, and future clients can reuse them. TanStack Query handles optimistic updates and rollback in one place. |
| Better Auth, not Clerk or Auth.js | One library for Google and password sign-in. Users stay in our own database with no per-user cost. The Auth.js team now maintains Better Auth and recommends it for new projects (Sep 2025). |
| Google login on changing Preview URLs | Better Auth `oAuthProxy` with the same `OAUTH_PROXY_SECRET` in Production and Preview. Only trusted previews get the secret. |
| Relying on `proxy.ts` alone for access control is unsafe | `proxy.ts` only redirects. Every service checks the session and membership, and every route has a permission test. |
| Two people editing at the same time | `PATCH` only sends changed fields, so the last write wins per field. 15 s polling plus refetch on focus keeps boards fresh. Live push is on the roadmap. |
| Rollback while the schema has changed | Migrations are expand → contract, so the previous release always works with the current schema. |
| Region | Vercel's default `iad1` + Neon `aws-us-east-1`, kept together to avoid slow cross-region database calls. Users far from US East see roughly 150–250 ms extra on each request. Changing region later is a documented move (§8). |
| Neon scale-to-zero cold start | The first request after idle is slower. Turn off scale-to-zero on the Production branch if that's noticeable. |
| Card order keys | Fractional string keys never need renumbering. The column must use `COLLATE "C"`, and ties are broken by `id`. |
| Demo data | `db:seed` only runs on local and Preview branches. Production starts empty. |
| Client router prefetches and sessions | Prefetches made while signed out (e.g. `/` → sign-in) would be replayed after signing in. Sign-in, sign-up and sign-out therefore do a full page load. |
| Sign-up reveals that an email is registered | Accepted for v1: hiding it needs email confirmation (roadmap). Auth rate limits (3 attempts per 10 s per IP) and BotID make probing slow. |
