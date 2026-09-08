# Database

> Status: **not yet created.** Work item 0.4 is blocked on one decision — the
> embedding model, which fixes the dimension of `products.embedding vector(N)`.
> Changing that dimension later means re-embedding the entire catalogue, so it
> is settled before the first migration runs.
>
> This document describes the intended shape. It is updated to describe the
> actual shape the moment `0001_core.sql` is applied (PRD §64).

## Platform

Supabase Postgres with `pgvector`, in the region closest to India. Users are
`auth.users` from Supabase Auth, mirrored by a `profiles` row — there is no
hand-rolled user table (PRD §31).

Migrations live in `supabase/migrations`, are applied in filename order, and are
never edited after being applied anywhere. Write a new migration instead.

## Tables in `0001_core.sql`

`profiles`, `brands`, `categories`, `retailers`, `affiliate_providers`,
`products`, `product_variants`, `prices`, `price_history`, `affiliate_clicks`,
`wishlists`.

Deferred to the phase that needs them: `coupons`, `saved_searches`,
`style_profiles`, `style_preferences`, `ai_sessions`, `ai_messages` (Phase 2);
`posts`, `comments`, `likes`, `follows`, `collections`, `collection_products`,
`reports` (Phase 3); `creator_profiles` (Phase 4); `subscriptions`,
`notifications`, `admin_actions` (with their features).

## Rules the migration must satisfy

**Row Level Security on every table, with explicit policies.** Nothing relies on
default-deny by accident. Public catalogue tables (`products`, `brands`,
`categories`, `retailers`, `prices`) are readable by `anon` and `authenticated`
and writable only by the service role, which is held by the ingestion worker and
audited admin actions. User-owned tables (`profiles`, `wishlists`,
`affiliate_clicks`) are readable and writable only by their owner.

**Money as integers.** Prices are stored in minor units (paise) with a currency
column, matching `lib/money.ts`. No `float` or `real` anywhere near a price.

**Foreign keys and `updated_at` triggers** on every table.

**Indexes on what Phase 1 actually filters by** — brand, category, gender, price,
retailer, availability — plus a GIN index for full-text search and an
`ivfflat`/`hnsw` index on the embedding column.

**`role` on `profiles`** is the only source of admin truth, and it is read
server-side on every check (`src/lib/auth.ts`). It is never trusted from a JWT
claim, header or query parameter.

## Seed data

A seed script loads a small catalogue for local development, every row clearly
labelled `MOCK DATA` (PRD §60). Until a real affiliate feed is approved, no live
price, coupon or availability figure is shown to any user, anywhere.

## Types

Once the migration is applied:

```bash
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

That file replaces the hand-written placeholders in
`src/lib/supabase/types.ts`, which is deleted at the same time.
