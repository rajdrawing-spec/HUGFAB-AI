# PHASE 0 — FOUNDATION (proposal)

> **Approved and partly executed (2026-09-08).** The work items that needed none of the five
> open decisions are built. See `docs/architecture.md` §6 for item-by-item status, and the
> "What I need from you" table below for what is still blocking 0.4 and 0.9.

**Goal:** a deployable, type-safe, secure skeleton with a working
`GitHub → CI → Hostinger` pipeline and an empty-but-correct database.
**Explicitly not in scope:** product search, AI, community, real affiliate feeds.

**Definition of done:** a visitor can load a styled HugFab home shell over HTTPS on the real
domain; a developer can sign up and log in; `npm run lint && npm run typecheck && npm run build`
passes in CI; a failed build blocks deploy.

---

## Work items

### 0.1 Project scaffold
- Next.js (App Router) + React + **TypeScript strict mode**, Tailwind CSS.
- ESLint + Prettier + `tsc --noEmit`; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`.
- `next.config`: `output: 'standalone'`, custom image loader, no Vercel-only features.
- Folder structure exactly as in `docs/architecture.md` §2.3, with module folders created empty.

### 0.2 Git workflow
- Create `develop`; make it the default working branch. Protect `main` (PR + green CI required).
- `feature/*` convention documented in `CONTRIBUTING.md`.
- PR template with a lint/typecheck/build checklist.

### 0.3 Environment configuration
- `.env.example` committed with placeholders and a comment per variable; `.env*` stays ignored.
- Only variables actually used are wired up; the rest are listed as commented placeholders (PRD §36).
- `src/lib/env.server.ts` validates env at boot with Zod and fails fast on a missing required key.
- Split strictly: `NEXT_PUBLIC_*` (client) vs server-only. Service-role and affiliate/AI keys are
  server-only and guarded with `server-only`.

### 0.4 Supabase — database
- Create the project (region closest to India), enable `pgvector`.
- Migration `0001_core.sql`: profiles, brands, categories, retailers, affiliate_providers,
  products, product_variants, prices, price_history, affiliate_clicks, wishlists.
- Foreign keys, `updated_at` triggers, and indexes on the columns Phase 1 will filter on
  (brand, category, gender, price, retailer, availability) plus a GIN index for full-text.
- `products.embedding vector(N)` — N fixed once the embedding model is chosen.
- **RLS enabled on every table** with explicit policies; nothing relies on default-deny by accident.
- Seed script with a small, clearly labelled `MOCK DATA` catalogue for local development (PRD §60).

### 0.5 Authentication
- Supabase Auth with cookie-based SSR sessions; email + Google to start.
- `profiles` row created on signup via trigger.
- Middleware for session refresh; server-side `requireUser()` / `requireAdmin()` helpers.
- Minimal `/login`, `/signup`, `/settings` shells — real design lands in Phase 1.

### 0.6 Design tokens and UI primitives
- `styles/tokens.css`: colour (primary, secondary, background, surface, text, muted, border,
  success, warning, error, accent), type scale (display, h1–h3, body, small, caption, button),
  spacing, radius, shadow — mapped into the Tailwind theme. No hard-coded values in components.
- Primitives only: `Button`, `Input`, `Card`, `Modal`, `Sheet`, `Toast`, `Header`, `Footer`,
  `BottomNavigation` — responsive, keyboard-accessible, focus-visible, `prefers-reduced-motion` respected.
- `lib/money.ts` and `lib/locale.ts`: currency and locale abstractions used by every price display.
  No hard-coded `₹` anywhere in components (PRD §73).
- `docs/design-system.md` written alongside them.

### 0.7 Security baseline
- Zod validation on every route handler; typed error envelope.
- Rate limiting helper (in-memory locally, Upstash Redis in production) ready for Phase 1 endpoints.
- Security headers via middleware (CSP, HSTS, frame-ancestors, referrer-policy).
- Upload validation helper (MIME + magic-byte + size cap) for later image search/community use.
- Admin role stored on `profiles`, checked server-side only.

### 0.8 Observability
- Sentry (server + browser) and PostHog wired behind env flags so they no-op without keys.
- Structured server logger; `/api/health` returning build SHA and DB reachability.

### 0.9 CI/CD to Hostinger
- GitHub Actions: `npm ci → lint → typecheck → build` on every PR and on `main`. **Deploy only on green.**
- Deploy job: build standalone output, rsync over SSH to the VPS, `pm2 reload` with zero-downtime.
- Nginx reverse proxy + TLS; PM2 process file committed; documented rollback (previous release symlink).
- `docs/deployment.md` written with the runbook.

### 0.10 Documentation and tests
- `README.md` (setup in under 10 minutes), `docs/architecture.md` (this audit + target),
  `docs/database.md`, `docs/deployment.md`, `docs/design-system.md`, `CONTRIBUTING.md`.
- The remaining PRD §64 documents land with the phase that creates their subject:
  `api.md` and `affiliate-integrations.md` in Phase 1, `ai.md` in Phase 2.
- `docs/ui-ux-guide.md` and `docs/user-flows.md` are written at the **start of Phase 1**,
  before any major screen is coded (PRD §56).
- Vitest configured with two real tests to prove the harness: money formatting, env validation.

---

## Sequence

| Step | Work items | Depends on |
|---|---|---|
| 1 | 0.1, 0.2, 0.3 | — |
| 2 | 0.4, 0.5 | Supabase project + embedding model decision |
| 3 | 0.6, 0.7, 0.8 | step 1 |
| 4 | 0.9 | Hostinger plan confirmed, SSH key + secrets in GitHub |
| 5 | 0.10 | all of the above |

Each step ships as its own `feature/*` branch into `develop`, with lint/typecheck/build green
before merge. Nothing is pushed to `main` without explicit instruction.

---

## What I need from you before starting

| # | Needed | Why it blocks |
|---|---|---|
| 1 | Hostinger plan type (shared vs VPS/Cloud) and SSH access | Shared hosting cannot run Next.js SSR; determines the whole of 0.9 |
| 2 | Supabase project (or permission to create one) + keys | Blocks 0.4 and 0.5 |
| 3 | AI provider + embedding model choice | Fixes the `vector(N)` dimension in migration 0001 |
| 4 | Domain name and DNS control | TLS + Cloudflare setup in 0.9 |
| 5 | Which affiliate networks are approved today | Decides how long Phase 1 runs on `MOCK DATA` |

Items 1–4 can be supplied progressively: steps 1 and 3 of the sequence need none of them.

---

## Phase 0 → Phase 1 handover criteria

- CI is green on `develop` and `main`.
- A deploy from `main` reaches the live domain and can be rolled back.
- A seeded mock product can be read through `/api/products` with RLS active.
- A user can sign up, log in, and see their session server-side.
- Tokens and primitives are in place, so Phase 1 writes screens rather than CSS.
- `docs/` reflects what was actually built, so Phase 1 starts from an accurate map (PRD §64).
