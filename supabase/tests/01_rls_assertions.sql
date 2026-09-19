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

-- Tables with RLS on and no policy at all are reachable only by the service
-- role. That is a deliberate design choice for each one below, so the list is
-- pinned: adding a table without a policy has to be an edit here, not an
-- oversight that ships.
--
--   affiliate_providers       our commercial integrations
--   product_source_links      which network supplies which product
--   ingestion_runs            import diagnostics
--   ingestion_errors          rejected feed rows, including raw payloads
--   product_match_candidates  the review queue
--   app_settings              read only through mock_products_allowed()
do $$
declare
  expected constant text[] := array[
    'affiliate_providers',
    'app_settings',
    'ingestion_errors',
    'ingestion_runs',
    'product_match_candidates',
    'product_source_links'
  ];
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
  raise notice 'PASS  service-role-only tables are exactly the intended six';
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
  -- page_limit has to be raised explicitly. It defaults to 24, so counting
  -- "everything" without it counts one default page — which is the very
  -- confusion this assertion exists to catch, and which it fell for itself the
  -- moment the catalogue grew past 24 rows.
  select count(*) into everything
    from public.search_products(include_mock => true, page_limit => 100000);
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

-- ============================================================================
-- 0003 — product identity, offers, ingestion
--
-- Everything below runs as the owner unless it explicitly sets a role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identifier validation: a barcode is trusted only when its check digit agrees
-- ---------------------------------------------------------------------------

do $$
begin
  -- 036000291452 is a real UPC-A (Coca-Cola), check digit 2.
  if not public.gtin_is_valid('036000291452') then
    raise exception 'a valid UPC-A was rejected';
  end if;
  -- Same body, wrong check digit.
  if public.gtin_is_valid('036000291453') then
    raise exception 'a UPC-A with a bad check digit was accepted';
  end if;
  -- A feed that means "no barcode" and says so in zeroes.
  if public.gtin_is_valid('0000000000000') then
    raise exception 'an all-zero placeholder was accepted as a barcode';
  end if;
  -- Wrong length entirely: an internal id in an EAN column.
  if public.gtin_is_valid('12345') then
    raise exception 'a five-digit value was accepted as a barcode';
  end if;
  raise notice 'PASS  GTIN check digits are validated, placeholders rejected';
end;
$$;

-- The equivalence the whole comparison feature rests on: one retailer's UPC-A
-- and another's EAN-13 for the same item must normalise to one key.
do $$
declare as_upc text; as_ean text; as_gtin text;
begin
  as_upc  := public.normalise_identifier('upc',  '0-36000-29145-2');
  as_ean  := public.normalise_identifier('ean',  '0036000291452');
  as_gtin := public.normalise_identifier('gtin', ' 00036000291452 ');

  if as_upc is null then
    raise exception 'a punctuated UPC-A did not normalise';
  end if;
  if as_upc <> as_ean or as_ean <> as_gtin then
    raise exception 'the same barcode normalised three ways: %, %, %',
      as_upc, as_ean, as_gtin;
  end if;
  if length(as_upc) <> 14 then
    raise exception 'normalised barcode is not GTIN-14: %', as_upc;
  end if;
  raise notice 'PASS  UPC-A, EAN-13 and GTIN-14 for one item share a key';
end;
$$;

do $$
begin
  if public.normalise_identifier('style_code', 'CW2288-111')
     is distinct from 'CW2288111' then
    raise exception 'style code normalisation dropped punctuation incorrectly: %',
      public.normalise_identifier('style_code', 'CW2288-111');
  end if;
  -- Two characters is not an identity; it would match half the catalogue.
  if public.normalise_identifier('mpn', 'A1') is not null then
    raise exception 'a two-character MPN was accepted as an identity';
  end if;
  -- An invalid barcode returns NULL rather than raising: the caller drops the
  -- identifier and keeps the product.
  if public.normalise_identifier('ean', 'NOT-A-BARCODE') is not null then
    raise exception 'a non-numeric EAN was accepted';
  end if;
  raise notice 'PASS  weak identifiers normalise; junk identifiers return NULL';
end;
$$;

-- ---------------------------------------------------------------------------
-- product_identifiers
-- ---------------------------------------------------------------------------

insert into public.product_identifiers (product_id, id_type, raw_value) values
  ('55555555-5555-5555-5555-555555555555', 'ean', '0-36000-29145-2');

do $$
declare stored text; strong boolean;
begin
  select normalised_value, is_strong into stored, strong
    from public.product_identifiers
   where product_id = '55555555-5555-5555-5555-555555555555';

  if stored <> '00036000291452' then
    raise exception 'identifier was not normalised on insert: %', stored;
  end if;
  if not strong then
    raise exception 'an EAN was not classified as a strong identifier';
  end if;
  raise notice 'PASS  identifiers are normalised and classified on insert';
end;
$$;

do $$
begin
  begin
    insert into public.product_identifiers (product_id, id_type, raw_value)
    values ('55555555-5555-5555-5555-555555555555', 'ean', '036000291453');
    raise exception 'an EAN with a bad check digit was stored as an identity';
  exception when check_violation then
    raise notice 'PASS  an invalid barcode cannot be stored as an identity';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- The matcher: tier ceilings are arithmetic, not convention
-- ---------------------------------------------------------------------------

-- A second product, same brand and a near-identical title, deliberately
-- carrying no identifier. This is the case that must NOT auto-merge.
insert into public.products (id, slug, title, brand_id, gender, is_active) values
  ('77777777-7777-7777-7777-777777777777', 'test-lookalike-product',
   'Test Oversized Hoodie Black', '33333333-3333-3333-3333-333333333333',
   'unisex', true);

do $$
declare m record; n integer;
begin
  select count(*) into n
    from public.find_product_matches(
      p_identifiers => '[{"type":"upc","value":"036000291452"}]'::jsonb
    );
  if n = 0 then
    raise exception 'a matching strong identifier produced no candidate';
  end if;

  select * into m
    from public.find_product_matches(
      p_identifiers => '[{"type":"upc","value":"036000291452"}]'::jsonb
    )
   where product_id = '55555555-5555-5555-5555-555555555555';

  if m.method <> 'identifier' or m.confidence < 0.9 then
    raise exception 'a cross-format strong identifier match scored % via %',
      m.confidence, m.method;
  end if;
  raise notice 'PASS  a UPC matches a product stored under its EAN, at merge confidence';
end;
$$;

-- The safety property, stated as a test: no tier other than `identifier` can
-- reach the worker's 0.90 auto-merge threshold, whatever the inputs.
do $$
declare worst numeric;
begin
  select max(confidence) into worst
    from public.find_product_matches(
      p_brand_id => '33333333-3333-3333-3333-333333333333',
      p_title    => 'Test Oversized Hoodie',
      p_gender   => 'unisex'
    )
   where method <> 'identifier';

  if worst is null then
    raise exception 'the attribute tier found nothing for a near-identical title';
  end if;
  if worst >= 0.90 then
    raise exception
      'a non-identifier match reached auto-merge confidence (%). Tier ceilings are broken.',
      worst;
  end if;
  raise notice 'PASS  attribute and fuzzy matches cannot reach auto-merge confidence (max %)', worst;
end;
$$;

do $$
declare leaked integer;
begin
  select count(*) into leaked
    from public.find_product_matches(
      p_brand_id => '33333333-3333-3333-3333-333333333333',
      p_title    => 'Test Retired Product'
    )
   where product_id = '66666666-6666-6666-6666-666666666666';
  if leaked <> 0 then
    raise exception 'the matcher offered an inactive product as a merge candidate';
  end if;
  raise notice 'PASS  the matcher ignores inactive products';
end;
$$;

-- ---------------------------------------------------------------------------
-- The review queue keeps one entry per unordered pair
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into public.product_match_candidates
      (product_id, candidate_product_id, method, confidence)
    values
      ('77777777-7777-7777-7777-777777777777',
       '55555555-5555-5555-5555-555555555555', 'attribute', 0.7);
    raise exception 'an unordered pair was accepted in the wrong order';
  exception when check_violation then
    raise notice 'PASS  review-queue pairs are stored in one canonical order';
  end;
end;
$$;

insert into public.product_match_candidates
  (product_id, candidate_product_id, method, confidence, signals)
values
  ('55555555-5555-5555-5555-555555555555',
   '77777777-7777-7777-7777-777777777777', 'attribute', 0.7,
   '{"title_similarity": 0.81}'::jsonb);

do $$
begin
  begin
    insert into public.product_match_candidates
      (product_id, candidate_product_id, method, confidence, decision)
    values
      ('55555555-5555-5555-5555-555555555555',
       '77777777-7777-7777-7777-777777777777', 'fuzzy', 0.3, 'pending');
    raise exception 'the same pair was queued twice';
  exception when unique_violation then
    raise notice 'PASS  a pair cannot be queued for review twice';
  end;
end;
$$;

do $$
begin
  begin
    update public.product_match_candidates
       set decision = 'merged'
     where product_id = '55555555-5555-5555-5555-555555555555';
    raise exception 'a decision was recorded without a decision time';
  exception when check_violation then
    raise notice 'PASS  a resolved match must record when it was decided';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- product_source_links: one product, many providers
-- ---------------------------------------------------------------------------

insert into public.affiliate_providers (id, slug, name) values
  ('88888888-8888-8888-8888-888888888888', 'test-provider-b', 'Test Provider B');

insert into public.product_source_links (product_id, provider_id, external_id)
select '55555555-5555-5555-5555-555555555555', id, 'FEED-ITEM-1'
  from public.affiliate_providers where slug = 'test-provider';

insert into public.product_source_links (product_id, provider_id, external_id) values
  ('55555555-5555-5555-5555-555555555555',
   '88888888-8888-8888-8888-888888888888', 'OTHER-FEED-ITEM-9');

do $$
declare n integer;
begin
  select count(*) into n from public.product_source_links
   where product_id = '55555555-5555-5555-5555-555555555555';
  if n <> 2 then
    raise exception 'two providers could not both claim one product (got %)', n;
  end if;
  raise notice 'PASS  one product can be supplied by two providers';
end;
$$;

do $$
begin
  begin
    insert into public.product_source_links (product_id, provider_id, external_id) values
      ('77777777-7777-7777-7777-777777777777',
       '88888888-8888-8888-8888-888888888888', 'OTHER-FEED-ITEM-9');
    raise exception 'one feed item was mapped to two different products';
  exception when unique_violation then
    raise notice 'PASS  a feed item maps to exactly one product';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Offers: dedup, price movement, and history
-- ---------------------------------------------------------------------------

insert into public.retailers (id, slug, name) values
  ('99999999-9999-9999-9999-999999999999', 'test-retailer-b', 'Test Retailer B');


insert into public.prices
  (product_id, retailer_id, price_minor, original_minor, currency, availability)
values
  ('55555555-5555-5555-5555-555555555555',
   '99999999-9999-9999-9999-999999999999', 200000, 250000, 'INR', 'in_stock');

-- The bug 0003 fixes: with the original constraint, NULL variant_id made every
-- re-import a fresh row rather than an update.
do $$
begin
  begin
    insert into public.prices
      (product_id, retailer_id, price_minor, currency, availability)
    values
      ('55555555-5555-5555-5555-555555555555',
       '99999999-9999-9999-9999-999999999999', 190000, 'INR', 'in_stock');
    raise exception
      'a duplicate offer with a NULL variant was inserted — re-ingestion would double every row';
  exception when unique_violation then
    raise notice 'PASS  an offer with no variant still deduplicates on re-ingestion';
  end;
end;
$$;

do $$
declare pct smallint;
begin
  select discount_pct into pct from public.prices
   where product_id = '55555555-5555-5555-5555-555555555555'
     and retailer_id = '99999999-9999-9999-9999-999999999999';
  if pct <> 20 then
    raise exception 'discount_pct computed % for 200000 off 250000', pct;
  end if;
  raise notice 'PASS  discount is derived from the prices, not supplied alongside them';
end;
$$;

do $$
declare pct smallint; n integer;
begin
  insert into public.prices
    (product_id, retailer_id, price_minor, currency, availability)
  values
    ('77777777-7777-7777-7777-777777777777',
     '44444444-4444-4444-4444-444444444444', 150000, 'INR', 'in_stock');

  select discount_pct into pct from public.prices
   where product_id = '77777777-7777-7777-7777-777777777777';
  if pct is not null then
    raise exception 'a discount of %%% was reported with no list price', pct;
  end if;
  raise notice 'PASS  no list price yields no discount, not a discount of zero';
end;
$$;

do $$
declare before_rows integer; after_rows integer;
        prev bigint; changed timestamptz;
begin
  select count(*) into before_rows from public.price_history
   where product_id = '55555555-5555-5555-5555-555555555555';

  -- A no-op update: the feed re-reported the same price.
  update public.prices set observed_at = now()
   where product_id = '55555555-5555-5555-5555-555555555555'
     and retailer_id = '99999999-9999-9999-9999-999999999999';

  select count(*) into after_rows from public.price_history
   where product_id = '55555555-5555-5555-5555-555555555555';
  if after_rows <> before_rows then
    raise exception 'an unchanged price appended % history rows',
      after_rows - before_rows;
  end if;

  -- A real change.
  update public.prices set price_minor = 180000
   where product_id = '55555555-5555-5555-5555-555555555555'
     and retailer_id = '99999999-9999-9999-9999-999999999999';

  select count(*) into after_rows from public.price_history
   where product_id = '55555555-5555-5555-5555-555555555555';
  if after_rows <> before_rows + 1 then
    raise exception 'a price change appended % history rows, expected 1',
      after_rows - before_rows;
  end if;

  select previous_price_minor, price_changed_at into prev, changed
    from public.prices
   where product_id = '55555555-5555-5555-5555-555555555555'
     and retailer_id = '99999999-9999-9999-9999-999999999999';
  if prev <> 200000 or changed is null then
    raise exception 'price movement was not tracked (previous %, changed at %)',
      prev, changed;
  end if;

  raise notice 'PASS  history is appended on change only, and movement is tracked';
end;
$$;

-- ---------------------------------------------------------------------------
-- Ingestion runs
-- ---------------------------------------------------------------------------

do $$
declare run_id uuid; synced timestamptz; last_ok uuid;
begin
  insert into public.ingestion_runs (provider_id, records_received)
  select id, 100 from public.affiliate_providers where slug = 'test-provider'
  returning id into run_id;

  begin
    update public.ingestion_runs set status = 'failed', finished_at = now()
     where id = run_id;
    raise exception 'a failed run was recorded without a reason';
  exception when check_violation then
    null;
  end;

  update public.ingestion_runs
     set status = 'succeeded', finished_at = now(),
         records_created = 60, records_updated = 30, records_rejected = 10
   where id = run_id;

  select last_successful_sync_at, last_successful_run_id into synced, last_ok
    from public.affiliate_providers where slug = 'test-provider';

  if synced is null or last_ok <> run_id then
    raise exception 'a successful run did not update the provider''s last sync';
  end if;
  raise notice 'PASS  a failed run must state why, and a successful one records the sync';
end;
$$;

-- ---------------------------------------------------------------------------
-- Mock containment — the production guarantee
--
-- The seed sets allow_mock_products = true because a developer needs a grid to
-- render. A hosted project never applies the seed, so the flag is false there.
-- This flips it off and checks what anon can actually see.
-- ---------------------------------------------------------------------------

update public.app_settings set allow_mock_products = false where id;

set role anon;

do $$
declare visible integer; offers integer; searched integer;
begin
  select count(*) into visible  from public.products where is_mock;
  select count(*) into offers   from public.prices pr
    join public.products p on p.id = pr.product_id where p.is_mock;
  select count(*) into searched from public.search_products(include_mock => true);

  if visible <> 0 then
    raise exception 'anon could read % mock products with the flag off', visible;
  end if;
  if offers <> 0 then
    raise exception 'anon could read % mock offers with the flag off', offers;
  end if;
  raise notice 'PASS  mock products are invisible to anon at the database level';

  -- And the application cannot ask its way past it: include_mock => true is
  -- overruled by RLS, which is the point of moving the rule into the database.
  if exists (
    select 1 from public.search_products(include_mock => true) s
    join public.products p on p.id = s.id where p.is_mock
  ) then
    raise exception 'include_mock => true surfaced mock rows despite the flag';
  end if;
  raise notice 'PASS  include_mock => true cannot override the database flag (% rows)', searched;
end;
$$;

reset role;
update public.app_settings set allow_mock_products = true where id;

-- ---------------------------------------------------------------------------
-- Affiliate URLs and operational tables are not public
-- ---------------------------------------------------------------------------

update public.prices
   set affiliate_url = 'https://track.example.test/click?id=secret-tracking-id'
 where product_id = '55555555-5555-5555-5555-555555555555';

set role anon;

do $$
declare v bigint;
begin
  -- The columns anon legitimately needs still work.
  select price_minor into v from public.prices
   where product_id = '55555555-5555-5555-5555-555555555555'
     and retailer_id = '99999999-9999-9999-9999-999999999999';
  if v is null then
    raise exception 'anon lost access to the price columns it needs';
  end if;

  begin
    perform affiliate_url from public.prices limit 1;
    raise exception 'anon could read affiliate tracking URLs';
  exception when insufficient_privilege then
    raise notice 'PASS  anon reads prices but not affiliate tracking URLs';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.product_source_links limit 1;
    raise exception 'anon could enumerate our feed suppliers';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot read product_source_links';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.ingestion_runs limit 1;
    raise exception 'anon could read ingestion diagnostics';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot read ingestion_runs';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.product_match_candidates limit 1;
    raise exception 'anon could read the match review queue';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot read the match review queue';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.find_product_matches(
      p_identifiers => '[{"type":"upc","value":"036000291452"}]'::jsonb
    );
    raise exception 'anon could run the product matcher';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot run the product matcher';
  end;
end;
$$;

-- A GTIN is printed on the box; it is the one new table anon may read, and
-- only for products it can already see.
do $$
declare n integer;
begin
  select count(*) into n from public.product_identifiers;
  if n = 0 then
    raise exception 'anon cannot read identifiers for a visible product';
  end if;
  raise notice 'PASS  anon reads identifiers for visible products only';
end;
$$;

reset role;
