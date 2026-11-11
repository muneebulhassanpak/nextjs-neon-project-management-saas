# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
