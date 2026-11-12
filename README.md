# Stackboard

[![CI](https://github.com/muneebulhassanpak/nextjs-neon-project-management-saas/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/muneebulhassanpak/nextjs-neon-project-management-saas/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Project management for agencies and teams. Plan work on Kanban boards and in sprints, track time, and give clients their own portal to follow progress and see invoices.

> **Status:** in active development. The full README, live demo and screenshots arrive with v1.0. This is a personal portfolio project, not client work.

## What it will do

- **Organizations and roles.** Invite your team as owners, admins or members, and your clients with read-only access.
- **Projects and Kanban boards.** Drag tasks between columns, assign people, set priorities and due dates.
- **Sprints.** Plan from the backlog, then track progress with burndown and velocity charts.
- **Client portal.** Clients see their projects' progress and the tasks you share, nothing else.
- **Time tracking and invoices.** Log hours on tasks and turn them into invoice PDFs.
- **Live updates.** Everyone sees changes on the board as they happen.
- **AI summaries.** Turn a sprint's activity into a standup note or a client update.

## Tech stack

| Area                | Tools                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| App                 | Next.js 16 (App Router, Server Actions), React 19, TypeScript (strict)    |
| UI                  | Tailwind CSS 4, shadcn/ui, dark mode                                      |
| Data                | Neon Postgres, Drizzle ORM, row-level security                            |
| Auth                | Better Auth                                                               |
| Real-time and files | Cloudflare Workers and Durable Objects (WebSockets), R2                   |
| Hosting             | Vercel                                                                    |
| Quality             | ESLint (strict, type-aware), Prettier, Vitest, Playwright, GitHub Actions |

## Run locally

Needs Node.js 22, pnpm and Docker. No API keys required.

```bash
cp .env.example .env.local
pnpm install
pnpm db:up && pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Live boards are optional locally. To try them, run `pnpm realtime:dev` in a second terminal (it starts the realtime Worker on port 8787, no Cloudflare account needed) and set `REALTIME_URL` and `REALTIME_SECRET` in `.env.local` to the example values in `.env.example`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for checks, project structure and workflow.

## License

[MIT](LICENSE) © Muhammad Muneeb-Ul-Hassan
