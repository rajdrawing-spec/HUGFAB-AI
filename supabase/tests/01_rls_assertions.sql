-- ============================================================================
-- Proves the migration's guarantees hold. Not "is RLS enabled" — whether the
-- policies actually stop the things they are supposed to stop.
--
-- Any failure raises, so the runner's exit code is the verdict.
-- ============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Structural: every public table has RLS on, and every one either has a policy
-- or is deliberately service-role-only.
-- ---------------------------------------------------------------------------

do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ')
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception 'tables without RLS: %', unprotected;
  end if;
  raise notice 'PASS  RLS enabled on every public table';
end;
$$;

do $$
declare
  expected constant text[] := array['affiliate_providers'];
  actual   text[];
begin
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into actual
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if actual <> expected then
    raise exception 'service-role-only tables changed: expected %, got %',
      expected, actual;
  end if;
  raise notice 'PASS  affiliate_providers is the only service-role-only table';
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures, created as the owner before dropping into the client roles.
--
-- Note on SET: `SET LOCAL` applies only inside a transaction, and psql wraps
-- each statement in its own. Session-level `SET` is what actually switches
-- role here — with SET LOCAL these assertions run as the table owner and pass
-- vacuously.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@example.test');

-- Slugs are namespaced so these fixtures cannot collide with the development
-- seed, which the runner applies before this file.
insert into public.brands (id, slug, name) values
  ('33333333-3333-3333-3333-333333333333', 'test-brand', 'Test Brand');

insert into public.retailers (id, slug, name) values
  ('44444444-4444-4444-4444-444444444444', 'test-retailer', 'Test Retailer');

insert into public.products (id, slug, title, brand_id, is_active) values
  ('55555555-5555-5555-5555-555555555555', 'test-active-product',
   'Test Oversized Hoodie', '33333333-3333-3333-3333-333333333333', true),
  ('66666666-6666-6666-6666-666666666666', 'test-inactive-product',
   'Test Retired Product', '33333333-3333-3333-3333-333333333333', false);

insert into public.affiliate_providers (slug, name) values ('test-provider', 'Test Provider');

insert into public.wishlists (user_id, product_id) values
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555');

-- The signup trigger must have produced both profiles.
do $$
declare n integer;
begin
  select count(*) into n from public.profiles;
  if n <> 2 then
    raise exception 'handle_new_user did not create a profile per user (got %)', n;
  end if;
  raise notice 'PASS  profile row created automatically on signup';
end;
$$;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set role anon;

do $$
declare visible integer; hidden integer;
begin
  select count(*) into visible from public.products;
  select count(*) into hidden   from public.products where not is_active;
  if hidden <> 0 then
    raise exception 'anon must not see inactive products, saw %', hidden;
  end if;
  if visible = 0 then
    raise exception 'anon should see the active products';
  end if;
  raise notice 'PASS  anon reads active products and not inactive ones';
end;
$$;

do $$
declare n integer;
begin
  select count(*) into n from public.affiliate_providers;
  if n <> 0 then
    raise exception 'anon must not read affiliate_providers, saw % rows', n;
  end if;
  raise notice 'PASS  anon cannot read affiliate_providers (no rows)';
exception
  when insufficient_privilege then
    raise notice 'PASS  anon cannot read affiliate_providers (permission denied)';
end;
$$;

-- Either outcome is a pass: denied by the missing grant, or zero rows by
-- policy. Both mean an anonymous caller cannot read anyone's wishlist.
do $$
declare n integer;
begin
  select count(*) into n from public.wishlists;
  if n <> 0 then
    raise exception 'anon must not read wishlists, saw % rows', n;
  end if;
  raise notice 'PASS  anon cannot read wishlists (no rows)';
exception
  when insufficient_privilege then
    raise notice 'PASS  anon cannot read wishlists (permission denied)';
end;
$$;

-- Anonymous click-out attribution must work: the revenue path never requires
-- an account (docs/user-flows.md F1).
insert into public.affiliate_clicks (product_id, retailer_id)
values ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444');

do $$
begin
  insert into public.affiliate_clicks (user_id, product_id)
  values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555');
  raise exception 'anon must not attribute a click to a real user';
exception
  when insufficient_privilege then
    raise notice 'PASS  anon cannot forge a click attributed to a user';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- authenticated — Alice
-- ---------------------------------------------------------------------------

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;

do $$
declare n integer;
begin
  select count(*) into n from public.wishlists;
  if n <> 1 then
    raise exception 'Alice should see her 1 wishlist row, saw %', n;
  end if;
  raise notice 'PASS  a user reads their own wishlist';
end;
$$;

do $$
declare n integer;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then
    raise exception 'Alice should see only her own profile, saw %', n;
  end if;
  raise notice 'PASS  a user reads only their own profile';
end;
$$;

-- The escalation guard.
do $$
begin
  update public.profiles
     set role = 'admin'
   where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'a user must not be able to make themselves an admin';
exception
  when insufficient_privilege then
    raise notice 'PASS  a user cannot promote themselves to admin';
end;
$$;

-- Writing into someone else's wishlist.
do $$
begin
  insert into public.wishlists (user_id, product_id)
  values ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555');
  raise exception 'a user must not write to another user''s wishlist';
exception
  when insufficient_privilege then
    raise notice 'PASS  a user cannot write to another user''s wishlist';
end;
$$;

-- Writing to the catalogue.
do $$
begin
  insert into public.products (slug, title) values ('injected', 'Injected');
  raise exception 'a user must not write to the catalogue';
exception
  when insufficient_privilege then
    raise notice 'PASS  a user cannot write to the catalogue';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- authenticated — Mallory cannot see Alice's data
-- ---------------------------------------------------------------------------

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;

do $$
declare n integer;
begin
  select count(*) into n from public.wishlists;
  if n <> 0 then
    raise exception 'Mallory must not see Alice''s wishlist, saw % rows', n;
  end if;
  raise notice 'PASS  one user cannot read another user''s wishlist';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- Data-integrity constraints
-- ---------------------------------------------------------------------------

do $$
begin
  insert into public.prices (product_id, retailer_id, price_minor, original_minor)
  values ('55555555-5555-5555-5555-555555555555',
          '44444444-4444-4444-4444-444444444444', 249900, 199900);
  raise exception 'an "original" price below the current price must be rejected';
exception
  when check_violation then
    raise notice 'PASS  a fabricated discount is rejected by the schema';
end;
$$;

do $$
begin
  insert into public.prices (product_id, retailer_id, price_minor)
  values ('55555555-5555-5555-5555-555555555555',
          '44444444-4444-4444-4444-444444444444', -100);
  raise exception 'a negative price must be rejected';
exception
  when check_violation then
    raise notice 'PASS  a negative price is rejected';
end;
$$;

-- Full-text search actually resolves through the generated column + GIN index.
do $$
declare n integer;
begin
  select count(*) into n
    from public.products
   where search_vector @@ websearch_to_tsquery('english', 'hoodie');
  if n < 1 then
    raise exception 'full-text search should match at least 1 product, matched %', n;
  end if;
  raise notice 'PASS  full-text search matches on the generated column';
end;
$$;

-- updated_at is maintained by trigger, not by the application.
do $$
declare before timestamptz; after timestamptz;
begin
  select updated_at into before from public.products
   where id = '55555555-5555-5555-5555-555555555555';
  perform pg_sleep(0.01);
  update public.products set title = 'Test Oversized Hoodie (rev)'
   where id = '55555555-5555-5555-5555-555555555555';
  select updated_at into after from public.products
   where id = '55555555-5555-5555-5555-555555555555';
  if after <= before then
    raise exception 'updated_at was not advanced by the trigger';
  end if;
  raise notice 'PASS  updated_at is maintained by trigger';
end;
$$;

-- ---------------------------------------------------------------------------
-- 0002: the best-offer view and the search function must not become an RLS
-- bypass. A view in PostgreSQL 15+ runs with its owner's rights by default,
-- which would let anon read through it what the policy on the base table
-- refuses. These assertions fail loudly if security_invoker is ever dropped.
-- ---------------------------------------------------------------------------

-- Give the inactive product an offer, so "can anon see it through the view?"
-- is a question with a real answer rather than an empty set either way.
insert into public.prices (product_id, retailer_id, price_minor, currency, availability)
values ('66666666-6666-6666-6666-666666666666',
        '44444444-4444-4444-4444-444444444444', 500000, 'INR', 'in_stock');

insert into public.prices (product_id, retailer_id, price_minor, original_minor, currency, availability)
values ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444', 249900, 299900, 'INR', 'in_stock');

do $$
declare invoker boolean;
begin
  select c.reloptions @> array['security_invoker=true']
    into invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'product_best_offer';

  if not coalesce(invoker, false) then
    raise exception 'product_best_offer is not SECURITY INVOKER — it would bypass RLS';
  end if;
  raise notice 'PASS  product_best_offer is SECURITY INVOKER';
end;
$$;

set role anon;

-- An inactive product must be invisible through every route to it, not just
-- through `products`. This caught a real leak: 0001 made the child tables
-- `using (true)`, so a withdrawn product's offers stayed publicly enumerable.
do $$
declare leaked integer;
begin
  select count(*) into leaked from public.prices
   where product_id = '66666666-6666-6666-6666-666666666666';
  if leaked <> 0 then
    raise exception 'prices leaked % offers for an inactive product', leaked;
  end if;
  raise notice 'PASS  prices for an inactive product are not readable by anon';
end;
$$;

do $$
declare leaked integer;
begin
  select count(*) into leaked
    from public.product_best_offer
   where product_id = '66666666-6666-6666-6666-666666666666';
  if leaked <> 0 then
    raise exception 'the best-offer view leaked an inactive product to anon';
  end if;
  raise notice 'PASS  the best-offer view does not leak inactive products to anon';
end;
$$;

do $$
declare leaked integer;
begin
  select count(*) into leaked
    from public.search_products(include_mock => true)
   where slug = 'test-inactive-product';
  if leaked <> 0 then
    raise exception 'search_products leaked an inactive product to anon';
  end if;
  raise notice 'PASS  search_products does not leak inactive products to anon';
end;
$$;

-- Mock rows are excluded unless explicitly requested: production must never
-- serve invented prices as real ones (PRD §60, §69).
do $$
declare with_mock integer; without_mock integer;
begin
  select count(*) into with_mock    from public.search_products(include_mock => true);
  select count(*) into without_mock from public.search_products(include_mock => false);
  if without_mock >= with_mock then
    raise exception 'include_mock => false did not exclude the seeded mock rows (% vs %)',
      without_mock, with_mock;
  end if;
  raise notice 'PASS  search excludes mock rows unless they are asked for';
end;
$$;

-- Keyword search, filters and sort actually do something.
do $$
declare n integer;
begin
  select count(*) into n from public.search_products(search_query => 'hoodie', include_mock => true);
  if n < 1 then
    raise exception 'keyword search matched nothing';
  end if;
  raise notice 'PASS  keyword search returns matches';
end;
$$;

do $$
declare cheapest bigint; dearest bigint;
begin
  select best_price_minor into cheapest
    from public.search_products(sort_by => 'price_asc', include_mock => true)
   where best_price_minor is not null limit 1;
  select best_price_minor into dearest
    from public.search_products(sort_by => 'price_desc', include_mock => true)
   where best_price_minor is not null limit 1;
  if cheapest is null or dearest is null or cheapest > dearest then
    raise exception 'price sort is wrong: asc gave %, desc gave %', cheapest, dearest;
  end if;
  raise notice 'PASS  price sort orders both ways';
end;
$$;

do $$
declare n integer; over_budget integer;
begin
  select count(*) into n
    from public.search_products(max_price_minor => 180000, include_mock => true);
  select count(*) into over_budget
    from public.search_products(max_price_minor => 180000, include_mock => true)
   where best_price_minor > 180000;
  if over_budget <> 0 then
    raise exception 'a max price filter returned % rows over budget', over_budget;
  end if;
  if n = 0 then
    raise exception 'the max price filter excluded everything';
  end if;
  raise notice 'PASS  a max-price filter returns nothing over budget';
end;
$$;

-- A parent category must include its children: filtering "Topwear" has to
-- return the hoodies underneath it.
do $$
declare parent_hits integer; child_hits integer;
begin
  select count(*) into parent_hits
    from public.search_products(category_slug => 'topwear', include_mock => true);
  select count(*) into child_hits
    from public.search_products(category_slug => 'hoodies', include_mock => true);
  if parent_hits < child_hits or child_hits = 0 then
    raise exception 'category filter is not walking the tree (parent %, child %)',
      parent_hits, child_hits;
  end if;
  raise notice 'PASS  a category filter includes descendant categories';
end;
$$;

-- total_count describes the whole result set, not the page.
do $$
declare page_rows integer; reported bigint; everything integer;
begin
  select count(*), max(total_count) into page_rows, reported
    from public.search_products(include_mock => true, page_limit => 1);
  select count(*) into everything from public.search_products(include_mock => true);
  if page_rows <> 1 then
    raise exception 'page_limit => 1 returned % rows', page_rows;
  end if;
  if reported <> everything then
    raise exception 'total_count (%) disagrees with the full result set (%)',
      reported, everything;
  end if;
  raise notice 'PASS  total_count describes the result set, not the page';
end;
$$;

reset role;
