# Contributing

## Workflow

`main` is protected. Every change goes through a pull request; direct pushes are rejected.

1. Open or pick an issue. Each issue belongs to a phase milestone.
2. Create a branch from `main` named `<type>/<phase>-<short-desc>`, for example `feat/02-kanban-board`.
3. Make small commits, one logical step each, with its tests. Every commit should pass lint, format and type checks on its own.
4. Push and open a PR. Fill in the PR template and link the issue (`Closes #12`).
5. CI must pass: `lint`, `typecheck`, `test`, `migrations`, `build`, `e2e`, `pr-title` and `commit-messages`. Review conversations must be resolved.
6. PRs are **rebase-merged**: every commit lands on `main` as it is, and history stays linear. Rebase on `main` and squash any fixup commits before merging. The branch is deleted after merge.

## Commit messages and PR titles

Both follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <subject>

<optional body: why, not what>
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `revert`.
Scopes used here: `auth`, `orgs`, `board`, `sprints`, `clients`, `realtime`, `billing`, `ai`, `db`, `ui`.
Subjects start lowercase, have no trailing period, and stay under 100 characters.

To fix an earlier commit on your branch, use `git commit --fixup=<sha>` and then `git rebase --autosquash main`. CI rejects leftover fixup commits.

## Definition of done

- CI is green.
- New behaviour has tests. Bug fixes include a test that fails without the fix.
- No secrets in code. New settings are added to `.env.example` and `src/env.ts`.
- Schema changes include a Drizzle migration and RLS policies for tenant-scoped tables.
- UI changes are checked in light and dark mode, and on mobile.
- `CHANGELOG.md` is updated under `Unreleased`.

## Local setup

Requirements: Node.js 22 (see `.nvmrc`), [pnpm](https://pnpm.io) 10 and Docker.

```bash
cp .env.example .env.local     # every value has a local default; fill in only what you need
pnpm install                   # also installs the pre-commit hooks
pnpm db:up                     # start Postgres in Docker (port 5433) and wait until it's ready
pnpm db:migrate                # apply migrations
pnpm dev                       # http://localhost:3000
```

Check it works: `curl localhost:3000/api/health` should return `{"status":"ok","database":"ok"}`.

> Commands use `DATABASE_URL` from `.env.local`. Empty means the local Docker database. If it points at a Neon branch, `pnpm db:migrate` and the app act on that branch.

Compose publishes Postgres on host port **5433** so it doesn't clash with a local Postgres. Change it with `POSTGRES_HOST_PORT`.

## Checks

These are the same commands CI runs:

```bash
pnpm lint                      # ESLint (strict, type-aware), zero warnings allowed
pnpm format:check              # Prettier
pnpm typecheck                 # route types + tsc
pnpm test:coverage             # unit + integration tests; needs `pnpm db:up`
pnpm build && pnpm test:e2e    # Playwright against the production build
```

The pre-commit hook runs ESLint, Prettier and the type check on every commit.

- **Unit tests** (`tests/unit/`) need no services.
- **Integration tests** (`tests/integration/`) run against a fresh `stackboard_test` database (`TEST_DATABASE_URL`) that is dropped and recreated on every run. They never use `DATABASE_URL`.
- Coverage below 85% on `src/server` fails the run, and so does any unexpected `console.error`.

## Code layout

| Path                       | Holds                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| `src/app/`                 | Routes, layouts and pages only. Thin, no business logic               |
| `src/components/`          | UI components (`ui/` holds the shadcn/ui primitives)                  |
| `src/server/actions/`      | Server Actions: validate input, check auth and role, call a service   |
| `src/server/services/`     | Use cases (create task, start sprint, invite member)                  |
| `src/server/domain/`       | Pure business rules with no I/O (permissions, status transitions)     |
| `src/server/db/`           | Drizzle client and schema                                             |
| `src/server/integrations/` | Adapters for outside systems (email, billing, storage, AI, real-time) |
| `src/server/errors.ts`     | `AppError` classes and the one error format                           |
| `src/env.ts`               | Validated settings. Add every new setting here and to `.env.example`  |
| `tests/`, `e2e/`           | Vitest and Playwright tests                                           |

## Auth and organizations

Auth is [Better Auth](https://www.better-auth.com) with the organization plugin (`src/server/auth/`).

- **Emails** print to the server log by default (`EMAIL_MODE=console`), including the verification and invitation links, so everything works locally without an email account. Set `EMAIL_MODE=resend` and `RESEND_API_KEY` to send real emails.
- **Roles and permissions** live in `src/lib/roles.ts` and are shared by the server and the UI. The UI hides what a role can't do; the server enforces it.
- **Member changes** (invite, change role, remove, update or delete the organization) only go through Server Actions in `src/server/actions/`. The plugin's own HTTP endpoints for them are closed, so the permission matrix is enforced in one place.
- **Server Actions** receive organization ids from the browser, so they always re-check membership with `requireOrgMember()`. Pages use `requireOrg(slug)`, which returns 404 for organizations the user isn't in.
- **Auth schema:** `src/server/db/schema/auth.ts` is generated by the Better Auth CLI and then edited (timezone-aware timestamps, unique membership). After changing plugins, regenerate it and re-apply those edits.

## Tenant isolation (row-level security)

Every tenant-scoped query runs inside `withOrgContext({ userId, orgId }, (tx) => ...)` from `src/server/db/tenant.ts`. It switches to the restricted `app_user` role for one transaction, so Postgres policies decide which rows are visible.

- New tenant tables need policies in `src/server/db/schema/policies.ts` (or next to the table) and a test in `tests/integration/tenant-isolation.test.ts` showing another organization can't see them.
- `app_user` can't read `account`, `session` or `verification` at all.
- Code that runs outside `withOrgContext` (Better Auth, the invitation page) uses the owner connection and must filter by organization itself. Keep it rare and commented.

## Errors

Every error response has the same shape:

```json
{ "error": { "code": "not_found", "message": "Project not found", "requestId": "…" } }
```

Throw an `AppError` subclass (`NotFoundError`, `ForbiddenError`, …) and wrap Route Handlers in `withErrorHandling`. Server Actions return `ActionResult<T>` instead of throwing. Unexpected errors are logged with the request ID and return a generic `500`, so internals never leak.

## Database migrations

```bash
pnpm db:generate     # write a migration from schema changes, then read it
pnpm db:migrate      # apply it
pnpm db:studio       # browse the data
```

Rules (CI enforces the first two):

1. Every schema change ships with a migration in the same PR. CI fails if `db:generate` would produce a new one.
2. Migrations apply cleanly to an empty database.
3. Never edit a migration that is already on `main`. Add a new one.
4. The running version must keep working on the new schema while the new version deploys. Add columns as nullable or with a default; remove columns in a later release.
5. Migrations that change data must be safe to run twice.
6. Every tenant-scoped table gets row-level security policies.
