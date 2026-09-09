# HugFab — Architecture

> Status: **partially implemented.** This document records the repository audit of 2026-09-06,
> the target architecture, and — from §6 — what has actually been built. Update it whenever
> architecture changes (PRD §64).

---

## 1. Repository audit (2026-09-06)

Repository: `rajdrawing-spec/HUGFAB-AI` — branch `main`, single commit `e68e79d "Initial commit"`.

| # | Area | Finding |
|---|------|---------|
| 1 | Project structure | Two files only: `README.md`, `.gitignore`. No source tree. |
| 2 | Framework | None installed. No `package.json`, no lockfile, no framework config. |
| 3 | Dependencies | None. Node toolchain not initialised. |
| 4 | Database | None. No Supabase project reference, no migrations, no schema. |
| 5 | Authentication | None. |
| 6 | Deployment | None. No CI workflow, no Dockerfile, no Hostinger config, no `.env.example`. |
| 7 | UI components | None. No design tokens, no Tailwind config. |
| 8 | Reusable | The `.gitignore` (comprehensive Node/Next template, already ignores `.env*` and allows `.env.example`) and the repository name/description. Nothing else. |
| 9 | Needs to change | Everything is greenfield. Branch model must be added (`main` / `develop` / `feature/*`, PRD §61) — currently only `main` exists and it is unprotected. |
| 10 | Sequence | See `docs/phase-0-foundation.md`. |

**Conclusion:** this is a clean greenfield build. No legacy constraints, no code to preserve,
no risk of overwriting working functionality. Phase 0 can be executed as a pure scaffold.

---

## 2. Target architecture

### 2.1 Shape

A **modular monolith** on Next.js (App Router). No microservices (PRD §35).
Domain modules live under `src/modules/*` and expose typed service functions;
route handlers under `src/app/api/*` are thin adapters over them.

```
Browser (Next.js RSC + client islands)
   │
   ├── Route handlers  /api/*        ← validation (Zod), auth, rate limit
   │        │
   │        ├── modules/search       ← keyword + filters + pgvector
   │        ├── modules/products     ← normalised catalogue reads
   │        ├── modules/affiliate    ← AffiliateProvider abstraction, click tracking
   │        ├── modules/ai           ← AI provider abstraction, output validation
   │        ├── modules/deals        ← price history, deal score, coupons
   │        └── modules/community    ← posts, likes, follows (Phase 3)
   │
   ├── Supabase Postgres (+ pgvector, RLS)
   ├── Supabase Auth / Storage
   ├── Upstash Redis (cache + rate limits, added when needed)
   └── Ingestion worker (separate Node process, cron-driven)
```

### 2.2 Layer rules

- **No AI provider SDK is ever imported into a client component.** All AI access goes through
  `/api/ai/*`, which calls `modules/ai` behind an `AIProvider` interface (PRD §29).
- **No affiliate-network shape reaches the frontend.** Every provider normalises into
  `HugFabProduct` before it leaves `modules/affiliate` (PRD §23, §24).
- **All AI output is schema-validated (Zod) before it touches the database** (PRD §29, §69).
- **Server-only secrets** live in `src/lib/env.server.ts`, which is import-guarded with
  `server-only` so a client import fails at build time (PRD §37).

### 2.3 Folder structure

Built as described below. Directories marked *(empty)* exist with a `README.md`
stating their contract; the code arrives with the phase that needs it.

```
src/
  app/
    (auth)/login, (auth)/signup        # Phase 0 shells
    (account)/settings                 # Phase 0 shell
    auth/callback/                     # OAuth + email confirmation exchange
    (marketing)/ (shop)/ (community)/  # (empty) Phase 1–3
    admin/                             # (empty) Phase 1
    api/health/                        # build SHA + dependency probe
    layout.tsx  page.tsx  error.tsx  global-error.tsx  not-found.tsx
  middleware.ts                        # CSP + security headers + session refresh
  modules/
    products/ search/ affiliate/ ai/ deals/ community/ admin/   # (empty)
      {service.ts, repository.ts, schema.ts, types.ts}
  components/
    ui/                    # Button, Input, Card, Modal, Sheet, Toast, Badge, Chip
    layout/                # Header, Footer, BottomNavigation, Logo, AnalyticsProvider
    product/ search/       # (empty) Phase 1
  lib/
    supabase/{server.ts, client.ts, admin.ts, types.ts}
    env.schema.ts  env.server.ts  env.client.ts
    money.ts  locale.ts    # currency/locale abstraction — no hard-coded ₹ (PRD §73)
    http.ts  api.ts        # Zod validation, typed error envelope, route wrapper
    auth.ts  ratelimit.ts  logger.ts  upload.ts  cn.ts  image-loader.ts
  styles/tokens.css        # single source of truth for colour/type/space
  types/assets.d.ts
instrumentation.ts         # server: env assertion + Sentry
instrumentation-client.ts  # browser: Sentry + PostHog, both lazily loaded
workers/
  ingestion/               # (empty) feed → validate → normalise → dedupe → classify → embed
supabase/
  migrations/              # (empty) 0001_core.sql blocked on the embedding model
docs/
```

### 2.4 Deployment topology

```
GitHub (main)
   │  push
   ▼
GitHub Actions:  npm ci → lint → typecheck → build   (blocking, PRD §62)
   │  on success
   ▼
Hostinger VPS
   ├── Nginx (TLS, reverse proxy, static cache)
   ├── Node — Next.js standalone server (PM2, port 3000)
   └── Node — ingestion worker (PM2, cron schedule)
   ▼
Cloudflare (DNS, CDN, image resizing)
```

`next.config` uses `output: 'standalone'` and a custom image loader so nothing depends on
Vercel-only behaviour (PRD §36).

---

## 3. Portability constraints

These exist so the platform is never locked to one vendor:

| Concern | Abstraction | Why |
|---|---|---|
| Affiliate networks | `AffiliateProvider` interface | Networks change; PRD §23 |
| AI models | `AIProvider` interface | Model/vendor swap without UI changes; PRD §29 |
| Search | repository layer over Postgres | Swap to Algolia/OpenSearch at scale; PRD §27 |
| Media | image URL resolver | Supabase Storage → Cloudflare R2 later; PRD §32 |
| Money/locale | `money.ts` / `locale.ts` | India first, US/UK/UAE later; PRD §73 |
| Payments | provider interface | Razorpay now, Stripe later; PRD §35 |

---

## 4. Open decisions (blocking or near-blocking)

1. **Hostinger plan type.** Next.js SSR requires a long-lived Node process. Hostinger *shared*
   hosting cannot run one; a **VPS (or Cloud) plan** is required. If only shared hosting is
   available, the realistic options are (a) upgrade to VPS, (b) deploy Next.js elsewhere and
   keep Hostinger for DNS/domain. This decision shapes all of Phase 0's deployment work.
2. **Affiliate network accounts.** Which of Cuelinks / Admitad / Impact / vCommission /
   Amazon Associates / Flipkart are approved today? Until real credentials exist, Phase 1 runs
   on clearly labelled `MOCK DATA` (PRD §60) and no live price, coupon or availability is shown.
3. **AI provider and budget.** Which model family for text (query parsing, stylist) and which
   for vision (visual search)? Embedding model choice fixes the pgvector column dimension, so it
   should be decided before the first migration.
4. **Image rights.** Retailer images are hotlinked or CDN-proxied per feed terms — not copied —
   unless the merchant terms permit rehosting (PRD §32, §74).
5. **Data sourcing.** Catalogue and price data come only from permitted feeds/APIs. No scraping
   of retailers whose terms prohibit it (PRD §74).

---

## 5. Data model (Phase 0 scope)

Phase 0 creates the catalogue and identity core only; community, creator and billing tables
arrive with their phases. See `docs/database.md` (written during Phase 0 execution) for column
detail. Phase 0 tables:

`profiles`, `brands`, `categories`, `retailers`, `affiliate_providers`, `products`,
`product_variants`, `prices`, `price_history`, `affiliate_clicks`, `wishlists`.

Deferred to their own phases: `coupons`, `saved_searches`, `style_profiles`, `style_preferences`,
`ai_sessions`, `ai_messages` (Phase 2); `posts`, `comments`, `likes`, `follows`, `collections`,
`collection_products`, `reports` (Phase 3); `creator_profiles` (Phase 4); `subscriptions`,
`notifications`, `admin_actions` (with the features that need them). Users are `auth.users`
from Supabase Auth, mirrored by a `profiles` row — no hand-rolled user table (PRD §31).

Every table gets RLS enabled at creation. Public catalogue tables are read-only to
`anon`/`authenticated` and writable only by the service role (ingestion + admin).

---

## 6. Implementation status (2026-09-08, updated)

Phase 0 was executed in part. The work items that needed none of the five open
decisions are built; the two that do are not started, and neither is guessed at.

| Item | Status | Note |
|---|---|---|
| 0.1 Project scaffold | **Done** | Next.js 15 App Router, React 19, TypeScript strict (plus `noUncheckedIndexedAccess`, `noUnusedLocals`), Tailwind v4, ESLint 9 flat config, Prettier. |
| 0.2 Git workflow | **Partial** | `CONTRIBUTING.md` and the PR template are committed. Creating `develop` and protecting `main` are repository settings — see the checklist in `CONTRIBUTING.md`. |
| 0.3 Environment config | **Done** | `.env.example`, Zod-validated env, `server-only` guard, fail-fast at server boot. |
| 0.4 Database | **Written and verified; not applied** | `0001_core.sql` creates all 11 tables with RLS, policies, grants, triggers and indexes. Executed against a real Postgres 16 + pgvector with 15 behavioural assertions (`npm run db:verify`). Only the `vector(N)` column is deferred to `0002`, since the embedding model is still undecided. Needs a Supabase project to be applied. |
| 0.5 Authentication | **Code done, schema-backed, unproven end to end** | Cookie-SSR clients (now typed against the schema), `requireUser`/`requireAdmin`, session refresh in middleware, login/signup/settings shells. The `profiles` row and the anti-escalation trigger it depends on now exist in 0001 and are asserted. Still needs a Supabase project for a real signup. |
| 0.6 Design tokens and primitives | **Done** | Tokens from the UI/UX Design Guide v1.0. Primitives: Button, Input, Card, Modal, Sheet, Toast, Badge, Chip, Header, Footer, BottomNavigation. |
| 0.7 Security baseline | **Done** | Zod validation helpers, typed error envelope, rate limiter, nonce CSP and security headers, magic-byte upload validation, server-side role checks. |
| 0.8 Observability | **Done** | Sentry and PostHog behind env flags and lazily imported; structured logger; `/api/health`. |
| 0.9 CI/CD | **CI live; deploy written and dormant** | CI blocking on every PR. `deploy.yml` implements build → rsync → symlink swap → `pm2 reload` → health check → automatic rollback, gated on the `DEPLOY_ENABLED` variable so it is inert until switched on. PM2 process file and Nginx template committed. Needs the plan decision plus SSH secrets. |
| 0.10 Docs and tests | **Done** | This document plus `database.md`, `deployment.md`, `design-system.md`, `ui-ux-guide.md`, `user-flows.md`, `CONTRIBUTING.md`, `README.md`. Vitest with 33 tests across money, env and upload validation, plus 15 database assertions run by `npm run db:verify`. |

### 6.1 Decisions taken while building

Recorded because they were not in the proposal and are worth disagreeing with
early rather than late.

1. **Environment strictness is enforced at server boot, not at build.**
   `next build` runs with `NODE_ENV=production` but must succeed in CI without
   production secrets — baking them into a build artefact is how they leak. So
   `assertServerEnvironment()` runs from `instrumentation.ts` at process start
   and refuses to serve a misconfigured production server. Client-side env is
   parsed leniently: a browser cannot fix a missing key, and throwing there
   would white-screen the app.

2. **Money is stored as integer minor units.** `{ amountMinor, currency }`, never
   a float. A price-comparison product that is a paisa out has lost its argument.

3. **Sentry and PostHog are imported dynamically.** Behind a flag they would
   still have shipped ~180 kB to every visitor. Lazy imports took shared
   first-load JS from 276 kB to 103 kB.

4. **CSP uses a per-request nonce with `strict-dynamic`.** `style-src` still
   permits `'unsafe-inline'` because Tailwind and next/font emit inline styles
   during hydration with no nonce hook.

5. **Uploads are validated by magic bytes, not by declared MIME type**, and SVG
   is refused outright as a script-execution vector.

6. **Dark theme is derived.** Both design references are light-only; the dark
   palette was extrapolated and is marked as derived in `tokens.css`. It needs a
   designer's eye before Phase 1 ships.

7. **The database schema is verified behaviourally, not structurally.**
   `npm run db:verify` applies every migration to a throwaway Postgres and then
   asserts what a caller can actually *do* — that a user cannot promote
   themselves to admin, that one user cannot read another's wishlist, that a
   fabricated discount is rejected. Checking `relrowsecurity` is true would have
   passed on a schema with no policies at all.

8. **Anti-escalation is a trigger, not a policy.** A policy on `public.profiles`
   whose expression reads `public.profiles` recurses, and Postgres rejects it at
   runtime. The trigger refuses any change to `role` from `anon` or
   `authenticated`, which is both simpler and harder to get wrong.

9. **The build SHA is referenced by its literal name in `env.server.ts`.** Next
   inlines `process.env.NEXT_PUBLIC_*` textually at build time; a whole-object
   read of `process.env` is not rewritten. Without this the standalone server
   reported `sha: "dev"`, and the deploy job's health check — which compares the
   reported SHA against the commit it just shipped — could never match, so every
   deploy would have rolled itself back.

10. **The UI/UX concept was captured as documentation, not as screens.** It
   arrived during Phase 0, so `docs/ui-ux-guide.md` and `docs/user-flows.md`
   were written early (PRD §56 puts them at the start of Phase 1). Only the
   primitives the concept contradicted were changed — navigation, a `dark`
   button variant, `Badge` variants, the mobile bar's centre action. No Phase 1
   screen was built ahead of its phase.

---

## 7. Phase 1 contracts (2026-09-08)

The parts of Phase 1 that needed none of the outstanding decisions. No screens:
the UI waits on the empty, loading and error states that neither design
reference settles (`docs/ui-ux-guide.md` §8).

| Built | Where |
|---|---|
| Catalogue domain types — `HugFabProduct`, `ProductOffer`, `ProductSummary`, `ProductDetail` | `src/modules/products/types.ts` |
| Input and row schemas | `src/modules/products/schema.ts` |
| Row → domain mapping, including offer ordering and discount derivation | `src/modules/products/mapper.ts` |
| Repository and service | `src/modules/products/` |
| `AffiliateProvider` interface and the `NormalisedProduct` boundary | `src/modules/affiliate/types.ts` |
| Click-out attribution | `src/modules/affiliate/` |
| `GET /api/products`, `/api/products/:slug`, `/api/search`, `/api/affiliate/click` | `src/app/api/` |
| Best-offer view and `search_products` function | `supabase/migrations/0002_catalogue_queries.sql` |

### 7.1 Decisions

11. **A read leak in 0001 was found by writing the test first.** 0001 made
    `prices`, `price_history` and `product_variants` readable with
    `using (true)`, on the reasoning that the catalogue is public. It is not
    quite: `products` has always hidden inactive rows from `anon`, and the child
    tables did not — so the offers, price history and variants of a withdrawn
    product stayed publicly enumerable. 0002 tightens all three. The condition
    belongs on the child tables, not on each consumer, so the fix covers the
    view, the function, PostgREST and anything Phase 1 adds later.

12. **The best-offer view is `SECURITY INVOKER`, and that is asserted.** A view
    in PostgreSQL 15+ runs with its *owner's* rights by default, which would
    have handed `anon` exactly the rows the policy refuses. The assertion checks
    the behaviour, not the flag.

13. **The client never sees a retailer's link.** `ProductOffer` carries
    `clickPath` — our own route — so attribution cannot be bypassed and a dead
    offer is caught before the user leaves. A test asserts no `http` appears in
    a serialised summary.

14. **Offer order is the render order.** In-stock first, then cheapest, computed
    once in the mapper. The comparison table renders that order directly, so
    "Best Price" and the top row agree by construction rather than by a second
    calculation that could disagree with it.

15. **`include_mock` is not a request parameter.** The repository decides it
    from `NODE_ENV`. A client must never be able to ask for invented prices
    (PRD §60, §69).

16. **Supabase's query-type inference is not depended on.** `rpc` and the click
    insert are narrowed explicitly, and rows are parsed with Zod. The
    `Database` types are hand-written until a project exists to generate them
    from, and inference against them proved fragile; a Zod parse at the boundary
    is a stronger guarantee than an inferred type and survives the switch to
    generated types. `@supabase/ssr` was also upgraded 0.6 → 0.12 to match
    `supabase-js` 2.116.
