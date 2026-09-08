# HugFab

**See it. Style it. Shop it.** — AI fashion discovery, comparison, shopping and
community.

> **Phase 0 (foundation), substantially built.** Scaffold, design system,
> security baseline, observability, CI, the database schema and the deploy
> workflow are all in place. What remains needs credentials and one hosting
> decision, not code — see [Still blocked](#still-blocked).
> `docs/architecture.md` §6 has item-by-item status.

## Setup

Node 20.11 or newer (CI runs 22).

```bash
git clone https://github.com/rajdrawing-spec/HUGFAB-AI.git
cd HUGFAB-AI
npm ci
cp .env.example .env.local
npm run dev
```

The app runs at http://localhost:3000. **No credentials are needed to start it.**
Without Supabase keys, authentication is disabled and says so; everything else —
the home shell, tokens, primitives, `/api/health` — works.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (standalone output) |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writing changes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:verify` | Applies every migration to a throwaway Postgres and asserts the RLS guarantees |

CI runs lint, format check, typecheck, test and build on every pull request. A
red run blocks the merge.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
Supabase (Postgres + pgvector, Auth, Storage) · Zod · Vitest.

A modular monolith, not microservices. Deployed as a standalone Node server
behind Nginx — nothing depends on Vercel-only behaviour.

## Documentation

| Document | Covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Repository audit, target architecture, what is built, decisions taken |
| [`docs/phase-0-foundation.md`](docs/phase-0-foundation.md) | The Phase 0 plan and its work items |
| [`docs/design-system.md`](docs/design-system.md) | Tokens, type scale, primitives, accessibility rules |
| [`docs/ui-ux-guide.md`](docs/ui-ux-guide.md) | Screen inventory, recurring patterns, Phase 1 component build order |
| [`docs/user-flows.md`](docs/user-flows.md) | The six flows, their rules and their failure paths |
| [`docs/database.md`](docs/database.md) | Intended schema and the RLS rules it must satisfy |
| [`docs/deployment.md`](docs/deployment.md) | CI, and the deploy runbook awaiting the hosting decision |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Branches, house rules, what gets a PR sent back |

`docs/ui-ux-guide.md` and `docs/user-flows.md` are normally written at the start
of Phase 1 (PRD §56); they are here early because the UI/UX concept arrived
during Phase 0. `docs/api.md` and `docs/affiliate-integrations.md` arrive with
Phase 1; `docs/ai.md` with Phase 2 (PRD §64).

## Still blocked

Phase 0 cannot finish without these. Nothing here has been guessed at.

| # | Needed | Blocks |
|---|---|---|
| 1 | Hostinger plan type — shared hosting cannot run Next.js SSR | Enabling `deploy.yml`, which is written but dormant |
| 2 | Supabase project and keys | Applying `0001_core.sql`; proving signup and login work |
| 3 | AI provider and embedding model | `0002_embeddings.sql` only — `0001` no longer waits on it |
| 4 | Domain and DNS control | TLS and the Cloudflare layer |
| 5 | Which affiliate networks are approved today | How long Phase 1 runs on seed data |
