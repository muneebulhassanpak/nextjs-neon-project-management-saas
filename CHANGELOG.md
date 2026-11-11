# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sign up with email and password (with email verification) or a magic link; optional Google and GitHub sign-in.
- Password reset by email.
- Organizations: onboarding, an organization switcher and pages at `/[orgSlug]`.
- Roles (owner, admin, member, client) with a permission matrix enforced on the server.
- Members page: invite people by email, change roles, remove members, leave an organization.
- Invitation links that work for new and existing users; pending invitations show up during onboarding.
- Organization settings: rename, change the URL, transfer ownership, delete.
- Row-level security: tenant queries run as a restricted database role, with tests proving one organization can't see another's data.
- Emails in console mode (printed to the log) or sent through Resend.
- Sign-in rate limiting in production.

- Repository templates: pull request, issue forms, code owners, security policy and contributing guide.
- Next.js 16 app with strict TypeScript, ESLint (strict, type-aware), Prettier and pre-commit hooks.
- shadcn/ui with an indigo theme and light, dark and system modes.
- Validated environment settings with safe local defaults.
- Structured JSON logging with a request ID on every request and response.
- One error format for every error response.
- Local Postgres via Docker Compose, Drizzle ORM and migrations.
- `GET /api/health` with a database check.
- Unit and integration tests (Vitest) against a throwaway database, and end-to-end tests (Playwright).
- CI: lint, type check, tests with coverage, migration checks, build, end-to-end tests, PR title and commit message checks.
- Dependabot for npm packages and GitHub Actions.

### Changed

- Functions run in Singapore (`sin1`), next to the Neon database.
- Migrations run automatically on every Vercel deploy.
- Local and CI Postgres moved to 18 to match Neon.
- `DATABASE_URL` and `BETTER_AUTH_SECRET` are required on Vercel instead of falling back to local defaults.

### Fixed

- Neon connection strings use `sslmode=verify-full`, which silences the `pg` SSL warning and keeps strict certificate checks.
