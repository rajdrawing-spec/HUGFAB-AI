# supabase/migrations

Version-controlled SQL. Migrations are applied in filename order and are never
edited after they have been applied anywhere — write a new one instead.

`0001_core.sql` is Phase 0 work item 0.4 and is **not yet written**. It is
blocked on one decision: the embedding model, which fixes the dimension of
`products.embedding vector(N)`. Changing that later means re-embedding the whole
catalogue, so it is settled before the first migration runs, not after.

Tables in `0001_core.sql` when it lands: `profiles`, `brands`, `categories`,
`retailers`, `affiliate_providers`, `products`, `product_variants`, `prices`,
`price_history`, `affiliate_clicks`, `wishlists`.

Every table gets RLS enabled at creation with explicit policies — never relying
on default-deny by accident. Public catalogue tables are readable by `anon` and
`authenticated`, writable only by the service role.
