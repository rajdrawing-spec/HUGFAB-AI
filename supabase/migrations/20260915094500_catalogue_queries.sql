-- ============================================================================
-- 0002_catalogue_queries.sql — the reads Phase 1 is built on
--
-- Three parts: a fix to the child-table read policies from 0001, a view that
-- picks the best offer per product, and a search function that the discovery
-- and search screens call.
--
-- Both are SECURITY INVOKER. That is the whole point of this file's care:
-- in PostgreSQL 15+ a view runs with its *owner's* rights by default, so a
-- view over `products` created by the migration role would happily hand `anon`
-- the inactive rows that the RLS policy on the underlying table refuses. The
-- view is created `with (security_invoker = true)` and the function is left at
-- the default SECURITY INVOKER so both are filtered by the caller's policies.
-- `supabase/tests/01_rls_assertions.sql` asserts this rather than assuming it.
-- ============================================================================

-- ============================================================================
-- Part 1 — close a read leak in 0001's policies
--
-- 0001 made `prices`, `price_history` and `product_variants` readable with
-- `using (true)`, reasoning that the catalogue is public. It is not quite: a
-- product can be deactivated, and `products` has always hidden inactive rows
-- from anon. The child tables did not, so anyone could still enumerate the
-- offers, price history and variants of a withdrawn product.
--
-- The condition belongs on the child tables, not on the consumers: fixing it
-- here fixes it for the view, the search function, PostgREST, and anything
-- Phase 1 writes later. 0001 is left alone — a migration that has been applied
-- anywhere is never edited, it is corrected by the next one.
-- ============================================================================

drop policy if exists "prices are publicly readable" on public.prices;
create policy "prices for active products are publicly readable"
  on public.prices for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = prices.product_id and p.is_active
    )
  );

drop policy if exists "price history is publicly readable" on public.price_history;
create policy "price history for active products is publicly readable"
  on public.price_history for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = price_history.product_id and p.is_active
    )
  );

drop policy if exists "variants are publicly readable" on public.product_variants;
create policy "variants of active products are publicly readable"
  on public.product_variants for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- product_best_offer — one row per product: the offer we would send a user to
--
-- "Best" is not simply cheapest. An out-of-stock price is not an offer, so
-- availability sorts first; then price; then recency, so a stale duplicate
-- never beats a fresh observation at the same price.
-- ---------------------------------------------------------------------------

create view public.product_best_offer
with (security_invoker = true)
as
select distinct on (pr.product_id)
  pr.product_id,
  pr.id            as price_id,
  pr.retailer_id,
  pr.variant_id,
  pr.price_minor,
  pr.original_minor,
  pr.currency,
  pr.availability,
  pr.observed_at
from public.prices pr
order by
  pr.product_id,
  (pr.availability = 'in_stock') desc,
  pr.price_minor asc,
  pr.observed_at desc;

comment on view public.product_best_offer is
  'Cheapest in-stock offer per product. SECURITY INVOKER: RLS on prices and products still applies.';

grant select on public.product_best_offer to anon, authenticated;

-- ---------------------------------------------------------------------------
-- search_products — keyword + filters + sort + pagination, in one round trip
--
-- Returning `total_count` as a window function avoids a second COUNT query
-- that could disagree with the page it is meant to describe.
--
-- `include_mock` defaults to false. Development seed rows are excluded unless
-- a caller deliberately asks for them, so production can never serve invented
-- prices as real ones (PRD §60, §69).
-- ---------------------------------------------------------------------------

create function public.search_products(
  search_query    text    default null,
  brand_slugs     text[]  default null,
  category_slug   text    default null,
  gender_filter   public.gender default null,
  retailer_slugs  text[]  default null,
  min_price_minor bigint  default null,
  max_price_minor bigint  default null,
  in_stock_only   boolean default false,
  include_mock    boolean default false,
  sort_by         text    default 'relevance',
  page_limit      integer default 24,
  page_offset     integer default 0
)
returns table (
  id                  uuid,
  slug                text,
  title               text,
  description         text,
  gender              public.gender,
  color               text,
  material            text,
  image_urls          text[],
  is_mock             boolean,
  created_at          timestamptz,
  brand_id            uuid,
  brand_slug          text,
  brand_name          text,
  category_id         uuid,
  category_slug       text,
  category_name       text,
  best_price_minor    bigint,
  best_original_minor bigint,
  best_currency       char(3),
  best_availability   public.availability,
  best_retailer_id    uuid,
  best_retailer_slug  text,
  best_retailer_name  text,
  offer_count         bigint,
  total_count         bigint
)
language sql
stable
as $$
  -- Categories are a tree, so filtering by "Topwear" must include "Hoodies".
  with recursive category_tree as (
    select c.id from public.categories c where category_slug is not null and c.slug = category_slug
    union all
    select child.id
    from public.categories child
    join category_tree parent on child.parent_id = parent.id
  ),
  query as (
    select case
             when search_query is null or btrim(search_query) = '' then null
             else websearch_to_tsquery('english', search_query)
           end as tsq
  )
  select
    p.id, p.slug, p.title, p.description, p.gender, p.color, p.material,
    p.image_urls, p.is_mock, p.created_at,
    b.id as brand_id, b.slug as brand_slug, b.name as brand_name,
    c.id as category_id, c.slug as category_slug, c.name as category_name,
    bo.price_minor    as best_price_minor,
    bo.original_minor as best_original_minor,
    bo.currency       as best_currency,
    bo.availability   as best_availability,
    r.id   as best_retailer_id,
    r.slug as best_retailer_slug,
    r.name as best_retailer_name,
    (select count(*) from public.prices pc where pc.product_id = p.id) as offer_count,
    count(*) over () as total_count
  from public.products p
  cross join query q
  left join public.brands     b  on b.id  = p.brand_id
  left join public.categories c  on c.id  = p.category_id
  left join public.product_best_offer bo on bo.product_id = p.id
  left join public.retailers  r  on r.id  = bo.retailer_id
  where
        (include_mock or not p.is_mock)
    and (q.tsq is null or p.search_vector @@ q.tsq)
    and (brand_slugs is null or b.slug = any (brand_slugs))
    and (category_slug is null or p.category_id in (select id from category_tree))
    and (gender_filter is null or p.gender = gender_filter)
    and (retailer_slugs is null or exists (
          select 1
          from public.prices pr2
          join public.retailers r2 on r2.id = pr2.retailer_id
          where pr2.product_id = p.id and r2.slug = any (retailer_slugs)
        ))
    -- A price filter is a filter on having a price. A product with no offer
    -- cannot satisfy "under ₹2000", so it drops out rather than sorting last.
    and (min_price_minor is null or bo.price_minor >= min_price_minor)
    and (max_price_minor is null or bo.price_minor <= max_price_minor)
    and (not in_stock_only or bo.availability = 'in_stock')
  order by
    case when sort_by = 'price_asc'  then bo.price_minor end asc  nulls last,
    case when sort_by = 'price_desc' then bo.price_minor end desc nulls last,
    case when sort_by = 'newest'     then p.created_at   end desc nulls last,
    case when sort_by = 'relevance' and q.tsq is not null
         then ts_rank(p.search_vector, q.tsq) end desc nulls last,
    -- Deterministic tiebreak, so page 2 cannot repeat a row from page 1.
    p.created_at desc,
    p.id
  limit  greatest(1, least(page_limit, 100))
  offset greatest(0, page_offset);
$$;

comment on function public.search_products is
  'Keyword + filter + sort + pagination over the catalogue. SECURITY INVOKER: RLS applies.';

grant execute on function public.search_products to anon, authenticated;
