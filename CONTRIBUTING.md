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
