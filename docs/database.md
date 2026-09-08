# Database

> Status: **schema written and verified; not yet applied to a Supabase project.**
>
> `supabase/migrations/0001_core.sql` creates every table Phase 1 reads from. It
> has been applied to a real PostgreSQL 16 with pgvector and its guarantees
> asserted — see [Verification](#verification). What it has *not* had is contact
> with a hosted Supabase project, because none exists yet.

## Platform

Supabase Postgres with `pgvector`, in the region closest to India. Users are
`auth.users` from Supabase Auth, mirrored by a `profiles` row created by
trigger — there is no hand-rolled user table (PRD §31).

Migrations live in `supabase/migrations`, apply in filename order, and are never
edited after being applied anywhere. Write a new one instead.

## What 0001_core.sql creates

**Identity** — `profiles`.
**Catalogue** — `brands`, `categories` (a self-referencing tree),
`retailers`, `affiliate_providers`, `products`, `product_variants`.
**Commerce** — `prices`, `price_history`, `wishlists`, `affiliate_clicks`.

Deferred to the phase that needs them: `coupons`, `saved_searches`,
`style_profiles`, `style_preferences`, `ai_sessions`, `ai_messages` (Phase 2);
`posts`, `comments`, `likes`, `follows`, `collections`, `collection_products`,
`reports` (Phase 3); `creator_profiles` (Phase 4); `subscriptions`,
`notifications`, `admin_actions` (with their features).

## What it deliberately does not create

**`products.embedding vector(N)`.** The dimension is fixed by the embedding
model, which is still undecided, and changing it later means re-embedding the
whole catalogue. pgvector is enabled by 0001, so once the model is chosen the
follow-up migration is one statement plus an index:

```sql
-- supabase/migrations/0002_embeddings.sql
alter table public.products add column embedding vector(1536);  -- N from the model
create index products_embedding_idx on public.products
  using hnsw (embedding vector_cosine_ops);
```

Common dimensions, for when that decision is made:

| Model | N |
|---|---|
| OpenAI `text-embedding-3-small` | 1536 |
| OpenAI `text-embedding-3-large` | 3072 |
| Cohere `embed-english-v3.0` | 1024 |
| Voyage `voyage-3` | 1024 |

## Design decisions

**Money is an integer count of minor units** — `price_minor bigint` plus a
`currency char(3)`, matching `src/lib/money.ts`. No float goes near a price.

**A discount cannot be fabricated.** `prices` carries a CHECK that
`original_minor >= price_minor`, so a feed claiming a "discount" against a lower
list price is rejected at the boundary rather than rendered (PRD §69).
`original_minor` is nullable: no original, no discount shown.

**`role` on `profiles` is the only source of admin truth.** It is read
server-side on every check (`src/lib/auth.ts`), never from a JWT claim or a
header, and a trigger stops `anon` and `authenticated` changing it at all.

**Mock rows are marked in the schema, not by convention.** `products.is_mock`
is indexed, and Phase 1's repository layer filters on it. A development seed row
can never be presented as live catalogue data (PRD §60).

**Search is a generated column.** `products.search_vector` is
`generated always as (...) stored` over title, colour, material and description
with descending weights, so it cannot drift from the columns it indexes. GIN
index on it, plus `pg_trgm` indexes for fuzzy brand and product name matching.

**Ingestion is an idempotent upsert.** `unique (source_provider_id, external_id)`
on `products` and `unique (product_id, variant_id, retailer_id)` on `prices` mean
re-running a feed updates rather than duplicates.

## Row Level Security

RLS is enabled on **every** table, with explicit policies. Nothing relies on
default-deny by accident, and `profiles`, `wishlists` and `affiliate_clicks` also
set `force row level security` so a mistake in a `SECURITY DEFINER` function
cannot bypass a policy.

| Table | anon | authenticated | service role |
|---|---|---|---|
| `brands` `categories` `product_variants` `prices` `price_history` | read | read | all |
| `retailers` | read (active) | read (active) | all |
| `products` | read (active) | read (active) | all |
| `affiliate_providers` | — | — | all |
| `profiles` | — | own row (read/update, not `role`) | all |
| `wishlists` | — | own rows (full) | all |
| `affiliate_clicks` | insert (unattributed) | insert own, read own | all |

`affiliate_providers` has no anon/authenticated policy at all: it describes our
commercial integrations, so it is service-role only.

Anonymous inserts into `affiliate_clicks` are deliberate — browsing, comparing
and clicking out never require an account (`docs/user-flows.md` F1) — but the
policy's `WITH CHECK` stops an anonymous caller attributing a click to a real
user.

Grants are written explicitly alongside the policies. RLS filters rows; grants
decide whether a role may touch the table at all. Both are needed, and relying
on whatever default privileges happen to be configured is how a table ends up
readable by accident.

## Verification

RLS bugs are invisible to lint, typecheck and the unit tests. So the migration
is executed against a real Postgres and its guarantees asserted:

```bash
npm run db:verify
```

This drops and recreates a throwaway database, applies
`supabase/tests/00_supabase_shim.sql` (which stands up the `auth` schema and the
`anon` / `authenticated` / `service_role` roles that Supabase would provide),
applies every migration, applies the seed, then runs
`supabase/tests/01_rls_assertions.sql`.

The assertions are behavioural, not structural — they check what a caller can
actually do:

- RLS is enabled on every public table, and `affiliate_providers` is the only
  table with no policy
- a `profiles` row is created automatically on signup
- `anon` reads active products but not inactive ones
- `anon` cannot read `affiliate_providers` or anyone's wishlist
- `anon` cannot forge a click attributed to a real user
- a user reads only their own profile and wishlist
- **a user cannot promote themselves to admin**
- a user cannot write to another user's wishlist, or to the catalogue
- one user cannot read another user's wishlist
- a fabricated discount and a negative price are both rejected
- full-text search resolves through the generated column
- `updated_at` is advanced by trigger, not by the application

Requires a local PostgreSQL 16 with `pgvector` and `pg_trgm`:

```bash
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector
sudo pg_ctlcluster 16 main start
```

## Applying it to Supabase

Once a project exists:

```bash
npx supabase link --project-ref <ref>
npx supabase db push                 # applies supabase/migrations in order
npx supabase gen types typescript --project-id <ref> \
  > src/lib/supabase/database.types.ts
```

`src/lib/supabase/database.types.ts` is currently **hand-written** to match
0001. Regenerating it is the first thing to do after the first push, and the
diff should be empty in substance.

For local development against a full Supabase stack (requires Docker):

```bash
npx supabase start
npx supabase db reset      # migrations + supabase/seed.sql
```

## Seed data

`supabase/seed.sql` loads a small catalogue for local development. Every product
row sets `is_mock = true`, and the file is applied only by `supabase db reset`,
which never runs against a hosted project.

These are invented products at invented prices. They exist so a developer can
render a grid before an affiliate feed is approved. No price, discount,
availability figure, Deal Score or price chart derived from them may be shown to
a user (PRD §60, §69).
