# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The overview is now a dashboard: open tasks, due this week, overdue and done this week; each project's progress; what's due soon; recent activity and the team.
- Project cards show progress (done of total, with a bar), what's overdue and the next due date.
- Each person gets their own avatar colour, and new labels get colours that stand apart.
- Dates ("today", overdue, due this week) follow the viewer's time zone.
- The Activity page filters by search, dates (presets or any range), person, project and type of change, and the filters stay in the link.

- Checklists inside tasks: add, tick off, rename and remove steps. The card shows progress (3/5).
- Bulk actions: select tasks with their checkbox, Shift- or Cmd-click, or `x`, then move, assign, prioritise, label or delete them together from a bar at the bottom. Works in the list view too, with select all.
- Undo for deletes: deleting tasks shows an Undo toast for 5 seconds before anything is removed.
- My work: every task assigned to you across projects, grouped into Overdue, Today, Next 7 days, Later and No date, with done tasks on request.
- Reactions on comments (👍 ❤️ 🎉 👀 ✅ 😄), with who reacted shown on hover.
- "Grace is typing…" under the comments when a teammate is writing one.
- An Activity page with the whole history, grouped by day, 25 entries per page, filterable by project. The overview shows the latest 5 and links to it.
- The board scrolls sideways without a scrollbar: edges with more columns fade out and get an arrow.
- A floating sidebar with more space between links.

- Live boards: when someone adds, edits, moves or deletes a task, changes a column or comments, everyone else on the board sees it within a moment, without reloading. Built on a Cloudflare Worker with one Durable Object per board; the app stays the only source of truth.
- Presence: the board shows who else has it open, and a task shows who else is looking at it. A "Live" indicator turns to "Reconnecting…" if the connection drops, and the board catches up once it's back.
- An open task's description updates when someone else edits it, unless you're typing in it.

- Landing page motion: the hero's chart grows in and its numbers count up, the showcase board drags a card from In progress to Done on a loop with a teammate's cursor, sections and cards reveal as you scroll, the How it works steps connect with a line, feature cards follow the pointer, the FAQ opens smoothly and the header shows which section you're in. Everything is off with reduced motion, and loops pause off screen.
- Switching the theme reveals the new one as a circle growing from the theme button.
- Comments on tasks, with @mentions picked from a suggestion list. Authors edit and delete their own comments; owners and admins can remove any.
- An activity log that records who changed what, shown on each task, on each project and (for everyone but clients) on the overview. Older entries load on demand.
- In-app notifications for mentions and assignments, in a bell in the header that checks for new ones every 30 seconds. Each opens the task it's about.
- Task links (`?task=`) that open the task panel directly.
- Row-level security for comments, the activity log and notifications: people only see them for tasks and projects they can see, and only their own notifications.

- Projects: owners and admins create, edit, archive and restore projects and choose which members are on them. Members only see the projects they're added to.
- Kanban boards: drag tasks within and between columns (mouse or keyboard), with the new order saved instantly and kept after a reload. Add, rename, reorder and delete columns.
- Tasks: title, rich-text description, assignee, priority, due date and labels, edited in a side panel. Members can delete the tasks they created.
- A list view of every task, and filters by text, assignee, priority and label.
- Row-level security for projects, columns, tasks and labels, with tests proving members can't reach projects they aren't on.
- Landing page: hero, features, client portal and live board showcases, how it works, pricing, FAQ and footer, with sign-up and log-in links throughout. Works in light and dark mode and on mobile.
- Redesigned sign-in, sign-up, password reset, onboarding and invitation pages, sharing the landing page's header. Includes a show/hide password toggle.
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
- A hydration warning on the board (drag-and-drop ids differed between the server and the browser).
- A hydration warning on phones: the sidebar rendered its mobile drawer before it had hydrated.
