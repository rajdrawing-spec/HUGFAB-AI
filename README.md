# HugFab

**See it. Style it. Shop it.** — AI fashion discovery, comparison, shopping and
community.

> **Phase 0 (foundation), partly built.** The scaffold, design system, security
> baseline, observability and CI are in place. The database and the deploy
> pipeline are not, and are waiting on decisions listed at the bottom of this
> file. See `docs/architecture.md` §6 for item-by-item status.

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
| [`docs/database.md`](docs/database.md) | Intended schema and the RLS rules it must satisfy |
| [`docs/deployment.md`](docs/deployment.md) | CI, and the deploy runbook awaiting the hosting decision |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Branches, house rules, what gets a PR sent back |

`docs/api.md` and `docs/affiliate-integrations.md` arrive with Phase 1;
`docs/ai.md` with Phase 2 (PRD §64).

## Still blocked

Phase 0 cannot finish without these. Nothing here has been guessed at.

| # | Needed | Blocks |
|---|---|---|
| 1 | Hostinger plan type — shared hosting cannot run Next.js SSR | The whole deploy half of 0.9 |
| 2 | Supabase project and keys | 0.4, and proving 0.5 works |
| 3 | AI provider and embedding model | Fixes `vector(N)` in migration 0001 — changing it later means re-embedding the catalogue |
| 4 | Domain and DNS control | TLS and the Cloudflare layer |
| 5 | Which affiliate networks are approved today | How long Phase 1 runs on `MOCK DATA` |
