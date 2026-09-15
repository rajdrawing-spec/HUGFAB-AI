-- ============================================================================
-- 0003_product_identity.sql — product identity, offers, and ingestion
--
-- 0001 and 0002 built a catalogue that can hold products and prices. They
-- cannot yet hold the *same* product sold by four retailers, which is the
-- entire proposition of HugFab. This migration fixes that, and builds the
-- machinery a real affiliate feed needs to land safely.
--
-- The problem being fixed
-- ----------------------
-- 0001 made `unique (source_provider_id, external_id)` the identity of a
-- product. That is dedup *within* one feed. Ingest the same jacket from two
-- retailers and you get two product rows with one offer each: a comparison
-- site with nothing to compare.
--
-- Identity therefore moves off the product row and into two places:
--
--   * `product_identifiers` — the real-world identifiers a product carries
--     (GTIN/EAN/UPC/ISBN, ASIN, and brand-scoped MPN/SKU/style codes), each
--     normalised to a canonical form and, for barcodes, check-digit validated.
--   * `product_source_links` — "provider P's item E is our product X". This is
--     what makes ingestion an idempotent upsert, and it is many-to-one, so one
--     product may be claimed by many providers and many retailers.
--
-- Matching strategy, in strict order of decreasing trust:
--
--   1. strong identifier (validated GTIN family, ASIN)      → auto-merge
--   2. brand + weak identifier (MPN / SKU / style code)     → auto-merge
--   3. brand + title similarity + gender + price proximity  → review queue
--   4. title similarity alone                               → review queue, capped
--
-- Tiers 3 and 4 can never auto-merge: `find_product_matches` caps their
-- confidence below the auto-merge threshold by construction, not by
-- convention. A wrong merge shows a shopper a price for a product that is not
-- the one in the photograph; two rows that should be one is merely untidy. The
-- schema is built around that asymmetry.
--
-- What else is here
-- -----------------
--   * Ingestion run and error tracking, so a half-finished import is visible
--     rather than silent.
--   * Offer provenance and price-change tracking on `prices`, with history
--     appended by trigger so it cannot be forgotten by a caller.
--   * A database-level guarantee that development seed rows cannot be served
--     to the public — see Part 9.
--   * Column-level revocation of `prices.affiliate_url` from the public roles.
--
-- 0001 and 0002 are not edited. Everything here is additive or a replacement.
-- ============================================================================


-- ============================================================================
-- Part 1 — enums
-- ============================================================================

-- Deliberately granular rather than a single 'gtin'. A feed that labels a
-- column "EAN" and fills it with an internal SKU is common; keeping the claimed
-- type lets us record what we were told and judge it separately.
create type public.identifier_type as enum (
  'gtin',        -- GTIN-8/12/13/14, already canonical
  'ean',         -- EAN-8/13 — a GTIN under another name
  'upc',         -- UPC-A/E — likewise
  'isbn',        -- ISBN-10/13, for books and printed goods
  'asin',        -- Amazon's own, not a GS1 code and not check-digit verifiable
  'mpn',         -- manufacturer part number — meaningless without a brand
  'sku',         -- retailer's own code — meaningless outside that retailer
  'style_code'   -- brand's style/article code, e.g. Nike CW2288-111
);

create type public.match_method as enum (
  'identifier',  -- tier 1/2: an exact identifier agreed
  'attribute',   -- tier 3: brand, gender, category and price all agreed
  'fuzzy',       -- tier 4: the titles looked alike
  'manual'       -- a human said so
);

create type public.match_decision as enum (
  'pending',
  'merged',
  'rejected',
  'expired'
);

create type public.ingestion_status as enum (
  'running',
  'succeeded',
  'partial',     -- finished, but rejected enough rows to be worth looking at
  'failed',
  'cancelled'
);


-- ============================================================================
-- Part 2 — identifier normalisation
--
-- Matching on a raw feed value is matching on formatting. "8901234567890",
-- "890-1234-56789-0" and " 8901234567890 " are one barcode; a naive equality
-- test says they are three. Everything is reduced to one canonical form before
-- it is stored, and barcodes are validated rather than trusted.
-- ============================================================================

-- GS1 mod-10 check digit for a body that does NOT include the check digit.
-- Weights alternate 3,1 leftwards from the rightmost body digit.
create or replace function public.gtin_check_digit(body text)
returns text
language plpgsql
immutable
as $$
declare
  n      integer;
  j      integer;
  total  integer := 0;
  digit  integer;
begin
  if body is null or body !~ '^[0-9]+$' then
    return null;
  end if;

  n := length(body);
  for j in 1..n loop
    digit := substr(body, n - j + 1, 1)::integer;
    -- j = 1 is the rightmost body digit and carries weight 3.
    total := total + digit * (case when j % 2 = 1 then 3 else 1 end);
  end loop;

  return ((10 - (total % 10)) % 10)::text;
end;
$$;

comment on function public.gtin_check_digit is
  'GS1 mod-10 check digit for a barcode body excluding the check digit.';

-- True only for a syntactically valid GTIN-8/12/13/14 whose check digit agrees.
-- A feed that puts an internal identifier in an "EAN" column fails here, which
-- is the point: an invalid barcode must never become a merge key.
create or replace function public.gtin_is_valid(digits text)
returns boolean
language plpgsql
immutable
as $$
declare
  n integer;
begin
  if digits is null or digits !~ '^[0-9]+$' then
    return false;
  end if;

  n := length(digits);
  if n not in (8, 12, 13, 14) then
    return false;
  end if;

  -- All-zero and other degenerate placeholders pass the check digit but are
  -- never real products. Feeds emit them as "unknown".
  if digits ~ '^0+$' then
    return false;
  end if;

  return substr(digits, n, 1) = public.gtin_check_digit(substr(digits, 1, n - 1));
end;
$$;

comment on function public.gtin_is_valid is
  'True for a GTIN-8/12/13/14 with a correct GS1 check digit. Rejects all-zero placeholders.';

-- ISBN-10 to GTIN-13. The 978 prefix plus the nine significant digits, with a
-- freshly computed GS1 check digit — the ISBN-10 mod-11 digit (which may be X)
-- is discarded rather than reused.
create or replace function public.isbn10_to_gtin13(isbn10 text)
returns text
language plpgsql
immutable
as $$
declare
  body text;
begin
  if isbn10 is null then
    return null;
  end if;

  body := upper(regexp_replace(isbn10, '[^0-9Xx]', '', 'g'));
  if length(body) <> 10 or substr(body, 1, 9) !~ '^[0-9]{9}$' then
    return null;
  end if;

  body := '978' || substr(body, 1, 9);
  return body || public.gtin_check_digit(body);
end;
$$;

-- The canonical form of one identifier, or NULL when the value cannot be
-- trusted. NULL is a decision, not an error: the caller drops the identifier
-- and keeps the product.
--
-- Barcode families all normalise to GTIN-14, zero-padded, so a UPC-A from one
-- retailer and the EAN-13 for the same item from another compare equal. That
-- equivalence is the whole reason cross-retailer comparison can work at all.
create or replace function public.normalise_identifier(
  id_type   public.identifier_type,
  raw_value text
)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  if raw_value is null or btrim(raw_value) = '' then
    return null;
  end if;

  if id_type in ('gtin', 'ean', 'upc', 'isbn') then
    cleaned := regexp_replace(raw_value, '[^0-9Xx]', '', 'g');

    if id_type = 'isbn' and length(cleaned) = 10 then
      cleaned := public.isbn10_to_gtin13(cleaned);
      if cleaned is null then
        return null;
      end if;
    else
      cleaned := regexp_replace(cleaned, '[^0-9]', '', 'g');
    end if;

    if not public.gtin_is_valid(cleaned) then
      return null;
    end if;

    return lpad(cleaned, 14, '0');
  end if;

  -- ASIN, MPN, SKU and style codes: case and punctuation carry no meaning.
  -- "CW2288-111" and "cw2288111" are one style code.
  cleaned := upper(regexp_replace(raw_value, '[^A-Za-z0-9]', '', 'g'));

  -- A two-character "part number" matches half the catalogue. Not an identity.
  if length(cleaned) < 3 then
    return null;
  end if;

  return cleaned;
end;
$$;

comment on function public.normalise_identifier is
  'Canonical form of an identifier, or NULL when it cannot be trusted. Barcodes normalise to a validated GTIN-14.';

-- Whether an identifier identifies a product on its own. A GTIN does. An MPN
-- does not: two brands can both ship part "100". Weak identifiers are only ever
-- matched within a brand — enforced in find_product_matches, Part 8.
create or replace function public.identifier_is_strong(id_type public.identifier_type)
returns boolean
language sql
immutable
as $$
  select id_type in ('gtin', 'ean', 'upc', 'isbn', 'asin');
$$;


-- ============================================================================
-- Part 3 — product_identifiers
-- ============================================================================

create table public.product_identifiers (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,

  id_type      public.identifier_type not null,
  -- Exactly as the feed gave it, for debugging a bad supplier.
  raw_value    text not null,
  -- Set by trigger from normalise_identifier(). Never written by a caller.
  normalised_value text not null,
  is_strong    boolean not null default false,

  -- Which feed asserted this. Two providers asserting the same GTIN for the
  -- same product is corroboration; it is worth being able to see that.
  provider_id  uuid references public.affiliate_providers (id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint product_identifiers_raw_length check (char_length(raw_value) between 1 and 200),
  -- One assertion of one identifier per product. Re-ingesting is an upsert.
  constraint product_identifiers_unique unique (product_id, id_type, normalised_value)
);

create or replace function public.set_identifier_normalisation()
returns trigger
language plpgsql
as $$
declare
  canonical text;
begin
  canonical := public.normalise_identifier(new.id_type, new.raw_value);

  if canonical is null then
    raise exception
      'identifier % of type % is not valid and cannot be used as an identity',
      new.raw_value, new.id_type
      using errcode = 'check_violation';
  end if;

  new.normalised_value := canonical;
  new.is_strong        := public.identifier_is_strong(new.id_type);
  new.updated_at       := now();
  return new;
end;
$$;

-- A trigger rather than a generated column: the normalisation rules will be
-- refined as real feeds arrive, and PostgreSQL will not let you change a
-- function a generated column depends on.
create trigger product_identifiers_normalise
  before insert or update of id_type, raw_value on public.product_identifiers
  for each row execute function public.set_identifier_normalisation();

-- The lookup that drives tier-1 matching.
create index product_identifiers_lookup_idx
  on public.product_identifiers (normalised_value, id_type);

create index product_identifiers_strong_idx
  on public.product_identifiers (normalised_value)
  where is_strong;

create index product_identifiers_product_idx
  on public.product_identifiers (product_id);

comment on table public.product_identifiers is
  'Real-world identifiers per product, normalised and (for barcodes) check-digit validated. The basis of cross-provider matching.';


-- ============================================================================
-- Part 4 — product_source_links
--
-- Replaces `products_source_external_unique` as the ingestion idempotency key.
-- That constraint made a product belong to one provider; this table lets one
-- product be claimed by every provider that carries it, which is the shape the
-- comparison table needs.
-- ============================================================================

create table public.product_source_links (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  provider_id  uuid not null references public.affiliate_providers (id) on delete cascade,
  -- The provider's own identifier for this item.
  external_id  text not null,
  -- Which retailer the provider is selling it through, when it says.
  retailer_id  uuid references public.retailers (id) on delete set null,
  source_url   text,

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  constraint product_source_links_external_length
    check (char_length(external_id) between 1 and 200),
  -- One item in one provider's feed maps to exactly one of our products.
  constraint product_source_links_unique unique (provider_id, external_id)
);

create index product_source_links_product_idx on public.product_source_links (product_id);
create index product_source_links_stale_idx   on public.product_source_links (provider_id, last_seen_at);

comment on table public.product_source_links is
  'Maps a provider feed item to our product. Ingestion idempotency key, and the record of which networks carry a product.';

-- The old identity constraint. Keeping it would forbid the very thing this
-- migration exists to allow: two providers resolving to one product row.
alter table public.products
  drop constraint if exists products_source_external_unique;

-- The columns stay. They record which feed first created the row, which is
-- useful provenance — they are simply no longer an identity.
comment on column public.products.source_provider_id is
  'The provider whose feed first created this row. Provenance only — identity lives in product_source_links (0003).';
comment on column public.products.external_id is
  'That first provider''s identifier. Provenance only — see product_source_links (0003).';


-- ============================================================================
-- Part 5 — offers: provenance, price movement, and a dedup fix
-- ============================================================================

alter table public.prices
  -- Which network supplied this offer. Needed to build the right tracked URL
  -- and to attribute the commission; never exposed to the browser (Part 10).
  add column affiliate_provider_id uuid references public.affiliate_providers (id) on delete set null,
  add column external_offer_id     text,
  -- The price before the most recent change, maintained by trigger below.
  add column previous_price_minor  bigint,
  add column price_changed_at      timestamptz,
  add column first_seen_at         timestamptz not null default now(),
  add column last_seen_at          timestamptz not null default now(),
  add column previous_availability public.availability;

-- Generated, so a displayed discount can never disagree with the two numbers
-- it is derived from. NULL rather than 0 when there is no list price: "no
-- discount known" and "a discount of nothing" are different claims.
alter table public.prices
  add column discount_pct smallint
  generated always as (
    case
      when original_minor is null or original_minor <= 0 then null
      when original_minor < price_minor then null
      else floor(((original_minor - price_minor)::numeric * 100) / original_minor)::smallint
    end
  ) stored;

comment on column public.prices.discount_pct is
  'Generated from original_minor and price_minor. NULL when no list price is known — never a fabricated zero.';

-- `unique (product_id, variant_id, retailer_id)` does not do what it looks
-- like it does. In SQL, NULL is distinct from NULL, so every offer with a NULL
-- variant_id — which is most of them, since few feeds give variants — is
-- unique by definition. Re-running an import would have inserted a second row
-- rather than updating the first, and the comparison table would have shown
-- the same retailer twice at yesterday's and today's prices.
alter table public.prices drop constraint prices_unique_offer;
alter table public.prices add constraint prices_unique_offer
  unique nulls not distinct (product_id, variant_id, retailer_id);

create index prices_provider_idx on public.prices (affiliate_provider_id);
create index prices_stale_idx    on public.prices (last_seen_at);

-- Keeps the movement columns honest without trusting the caller to do it.
create or replace function public.track_price_movement()
returns trigger
language plpgsql
as $$
begin
  if new.price_minor is distinct from old.price_minor then
    new.previous_price_minor := old.price_minor;
    new.price_changed_at     := now();
  end if;

  if new.availability is distinct from old.availability then
    new.previous_availability := old.availability;
  end if;

  new.last_seen_at := now();
  return new;
end;
$$;

-- Named to sort after `prices_set_updated_at`; BEFORE triggers on one table
-- fire in name order and both touch the row.
create trigger prices_track_movement
  before update on public.prices
  for each row execute function public.track_price_movement();


-- ============================================================================
-- Part 6 — price history, appended by the database
-- ============================================================================

alter table public.price_history
  add column original_minor bigint,
  add column availability   public.availability not null default 'unknown',
  add column provider_id    uuid references public.affiliate_providers (id) on delete set null,
  add column run_id         uuid,
  add constraint price_history_original_non_negative
    check (original_minor is null or original_minor >= 0);

-- An observation is only worth keeping when something changed. A nightly feed
-- over 50,000 offers writes 1.5 million rows a month otherwise, and every one
-- of them says the same thing as the row before it.
--
-- Doing this in a trigger rather than in the ingestion worker means history is
-- complete no matter who writes the price — the worker, an admin correction, or
-- a one-off backfill.
create or replace function public.append_price_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.price_minor is not distinct from old.price_minor
     and new.availability is not distinct from old.availability
     and new.original_minor is not distinct from old.original_minor then
    return null;
  end if;

  insert into public.price_history (
    product_id, variant_id, retailer_id,
    price_minor, original_minor, currency, availability,
    provider_id, observed_at
  )
  values (
    new.product_id, new.variant_id, new.retailer_id,
    new.price_minor, new.original_minor, new.currency, new.availability,
    new.affiliate_provider_id, coalesce(new.observed_at, now())
  );

  return null;
end;
$$;

create trigger prices_append_history
  after insert or update on public.prices
  for each row execute function public.append_price_history();

comment on function public.append_price_history is
  'Appends to price_history only when price, list price or availability actually moved.';

create index price_history_product_time_idx
  on public.price_history (product_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- product_price_stats — the honest foundation for "lowest price" and, later,
-- a Deal Score.
--
-- `observation_days` is published deliberately. A "lowest price in 90 days"
-- claim based on two days of history is a lie with a number in it, so the
-- consumer is given what it needs to refuse to render one. No score is
-- computed here: a Deal Score without history behind it is exactly the
-- fabricated figure we are not shipping.
-- ---------------------------------------------------------------------------
create view public.product_price_stats
with (security_invoker = true)
as
select
  h.product_id,
  h.currency,
  min(h.price_minor) filter (where h.availability = 'in_stock') as lowest_in_stock_minor,
  max(h.price_minor) filter (where h.availability = 'in_stock') as highest_in_stock_minor,
  min(h.price_minor)                                            as lowest_seen_minor,
  count(*)                                                      as observation_count,
  -- Whole days between the first and last observation we hold.
  greatest(
    0,
    (date_trunc('day', max(h.observed_at))::date - date_trunc('day', min(h.observed_at))::date)
  )                                                             as observation_days,
  min(h.observed_at)                                            as first_observed_at,
  max(h.observed_at)                                            as last_observed_at
from public.price_history h
group by h.product_id, h.currency;

comment on view public.product_price_stats is
  'Price extremes per product from observed history. Publishes observation_days so a caller can refuse to claim a low that is not backed by data.';


-- ============================================================================
-- Part 7 — ingestion tracking
-- ============================================================================

create table public.ingestion_runs (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.affiliate_providers (id) on delete cascade,

  status      public.ingestion_status not null default 'running',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,

  -- Counts. `received` is what the feed gave us; the rest must account for it.
  records_received int not null default 0,
  records_created  int not null default 0,
  records_updated  int not null default 0,
  records_rejected int not null default 0,
  -- Seen, valid, and deliberately not acted on — e.g. unchanged since the last
  -- run. Distinct from rejected, which means the row was unusable.
  records_skipped  int not null default 0,

  offers_created   int not null default 0,
  offers_updated   int not null default 0,
  price_changes    int not null default 0,
  -- Matches that needed a human. A run with a large number here is working
  -- correctly and needs attention, which is why it is not an error count.
  matches_queued   int not null default 0,

  error_message text,
  error_details jsonb,
  -- Provider pagination state, so an interrupted run resumes instead of
  -- restarting a 50,000-item feed from the beginning.
  cursor_state  jsonb,

  -- What the run was told to do, minus anything secret.
  options       jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint ingestion_runs_counts_non_negative check (
    records_received >= 0 and records_created >= 0 and records_updated >= 0
    and records_rejected >= 0 and records_skipped >= 0
    and offers_created >= 0 and offers_updated >= 0
    and price_changes >= 0 and matches_queued >= 0
  ),
  constraint ingestion_runs_finished_after_start check (
    finished_at is null or finished_at >= started_at
  ),
  -- A finished run says why it finished.
  constraint ingestion_runs_terminal_has_finish check (
    status = 'running' or finished_at is not null
  ),
  constraint ingestion_runs_failure_has_reason check (
    status <> 'failed' or error_message is not null
  )
);

create trigger ingestion_runs_set_updated_at
  before update on public.ingestion_runs
  for each row execute function public.set_updated_at();

create index ingestion_runs_provider_idx on public.ingestion_runs (provider_id, started_at desc);
create index ingestion_runs_status_idx   on public.ingestion_runs (status) where status = 'running';

comment on table public.ingestion_runs is
  'One row per feed import. A run that half-failed is visible here rather than silent.';

-- Now that runs have identity, history can point at the run that observed it.
alter table public.price_history
  add constraint price_history_run_fk
  foreign key (run_id) references public.ingestion_runs (id) on delete set null;

-- ---------------------------------------------------------------------------
-- ingestion_errors — the per-row detail behind records_rejected
--
-- A count of 12,000 rejections is a number. "brand missing" 11,998 times and
-- "price not parseable" twice is a bug report.
-- ---------------------------------------------------------------------------
create table public.ingestion_errors (
  id          bigserial primary key,
  run_id      uuid not null references public.ingestion_runs (id) on delete cascade,
  -- Which stage gave up on the row.
  stage       text not null,
  -- The provider's identifier for the offending item, when we got far enough
  -- to read one.
  external_id text,
  reason      text not null,
  -- The raw item, truncated by the worker. Useful once, then noise.
  payload     jsonb,
  occurred_at timestamptz not null default now(),

  constraint ingestion_errors_stage_known check (
    stage in ('fetch', 'normalise', 'validate', 'match', 'persist')
  )
);

create index ingestion_errors_run_idx on public.ingestion_errors (run_id, occurred_at desc);

-- Last successful sync, per provider, without scanning the run table.
alter table public.affiliate_providers
  add column last_successful_run_id uuid references public.ingestion_runs (id) on delete set null,
  add column last_successful_sync_at timestamptz;

comment on column public.affiliate_providers.last_synced_at is
  'When a run last finished for this provider, successful or not. For "is the data fresh?", use last_successful_sync_at (0003).';

-- Keeps both provider columns in step with reality.
create or replace function public.record_provider_sync()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'running' or new.status is not distinct from old.status then
    return null;
  end if;

  update public.affiliate_providers
     set last_synced_at = coalesce(new.finished_at, now()),
         last_successful_run_id =
           case when new.status in ('succeeded', 'partial')
                then new.id else last_successful_run_id end,
         last_successful_sync_at =
           case when new.status in ('succeeded', 'partial')
                then coalesce(new.finished_at, now()) else last_successful_sync_at end
   where id = new.provider_id;

  return null;
end;
$$;

create trigger ingestion_runs_record_sync
  after update of status on public.ingestion_runs
  for each row execute function public.record_provider_sync();


-- ============================================================================
-- Part 8 — the review queue and the matcher
-- ============================================================================

create table public.product_match_candidates (
  id           uuid primary key default gen_random_uuid(),
  -- The product the incoming feed item became.
  product_id   uuid not null references public.products (id) on delete cascade,
  -- The product it might be the same as.
  candidate_product_id uuid not null references public.products (id) on delete cascade,

  method     public.match_method not null,
  -- 0.000–1.000. Tiers 3 and 4 are capped below the auto-merge threshold by
  -- find_product_matches, so nothing here can be merged by confidence alone.
  confidence numeric(4, 3) not null,
  -- What actually agreed: title similarity, brand, gender, price delta. A
  -- reviewer needs to see the evidence, not just a number.
  signals    jsonb not null default '{}'::jsonb,

  decision   public.match_decision not null default 'pending',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  note       text,

  run_id     uuid references public.ingestion_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_match_candidates_confidence_range
    check (confidence >= 0 and confidence <= 1),
  constraint product_match_candidates_not_self
    check (product_id <> candidate_product_id),
  constraint product_match_candidates_decided_together check (
    (decision = 'pending' and decided_at is null)
    or (decision <> 'pending' and decided_at is not null)
  ),
  -- Order the pair consistently so A-vs-B and B-vs-A are one queue entry.
  constraint product_match_candidates_ordered check (product_id < candidate_product_id),
  constraint product_match_candidates_unique unique (product_id, candidate_product_id)
);

create trigger product_match_candidates_set_updated_at
  before update on public.product_match_candidates
  for each row execute function public.set_updated_at();

create index product_match_candidates_pending_idx
  on public.product_match_candidates (confidence desc, created_at)
  where decision = 'pending';

create index product_match_candidates_candidate_idx
  on public.product_match_candidates (candidate_product_id);

comment on table public.product_match_candidates is
  'Uncertain product matches awaiting a human. Nothing here is merged automatically, by design: a wrong merge misprices a product, a missed one merely splits it.';

-- ---------------------------------------------------------------------------
-- find_product_matches — the tiered matcher
--
-- Returns at most one row per candidate product: its best tier. Confidence is
-- assigned by tier, not learned, and the tier ceilings are the safety
-- mechanism:
--
--   identifier (strong)        0.99   auto-merge
--   identifier (brand + weak)  0.94   auto-merge
--   attribute                  ≤0.79  review queue
--   fuzzy                      ≤0.49  review queue
--
-- The ingestion worker's auto-merge threshold sits at 0.90. Tiers 3 and 4
-- cannot reach it whatever the inputs, so "never auto-merge on insufficient
-- confidence" is a property of the arithmetic rather than a rule someone has
-- to remember.
-- ---------------------------------------------------------------------------
create or replace function public.find_product_matches(
  p_identifiers        jsonb   default '[]'::jsonb,
  p_brand_id           uuid    default null,
  p_title              text    default null,
  p_gender             public.gender default null,
  p_category_id        uuid    default null,
  p_price_minor        bigint  default null,
  p_currency           char(3) default 'INR',
  p_exclude_product_id uuid    default null,
  p_limit              integer default 5
)
returns table (
  product_id uuid,
  method     public.match_method,
  confidence numeric,
  signals    jsonb
)
language sql
stable
as $$
  with incoming as (
    select
      public.normalise_identifier(
        (item ->> 'type')::public.identifier_type,
        item ->> 'value'
      ) as normalised_value,
      (item ->> 'type')::public.identifier_type as id_type
    from jsonb_array_elements(coalesce(p_identifiers, '[]'::jsonb)) as item
  ),
  usable as (
    select normalised_value, id_type, public.identifier_is_strong(id_type) as is_strong
    from incoming
    where normalised_value is not null
  ),

  -- Tier 1 — a validated strong identifier agreed. Barcode families are
  -- compared on the shared GTIN-14 form, so an EAN matches the same item's UPC.
  tier_identifier_strong as (
    select
      pi.product_id,
      'identifier'::public.match_method as method,
      0.99::numeric as confidence,
      jsonb_build_object(
        'tier', 'strong_identifier',
        'id_type', pi.id_type,
        'value', pi.normalised_value
      ) as signals
    from public.product_identifiers pi
    join usable u
      on u.normalised_value = pi.normalised_value
     and u.is_strong
    where pi.is_strong
  ),

  -- Tier 2 — a weak identifier, but only inside one brand. Part "100" is not
  -- an identity; Levi's part "100" is.
  tier_identifier_weak as (
    select
      pi.product_id,
      'identifier'::public.match_method as method,
      0.94::numeric as confidence,
      jsonb_build_object(
        'tier', 'brand_scoped_identifier',
        'id_type', pi.id_type,
        'value', pi.normalised_value
      ) as signals
    from public.product_identifiers pi
    join public.products p on p.id = pi.product_id
    join usable u
      on u.normalised_value = pi.normalised_value
     and u.id_type = pi.id_type
     and not u.is_strong
    where not pi.is_strong
      and p_brand_id is not null
      and p.brand_id = p_brand_id
  ),

  -- Tier 3 — no identifier agreed, but everything else did: same brand, same
  -- gender, similar name, and a price within 15%. Enough to be worth a look,
  -- never enough to merge unattended.
  tier_attribute as (
    select
      p.id as product_id,
      'attribute'::public.match_method as method,
      least(
        0.79,
        0.45
          + 0.30 * similarity(p.title, p_title)
          + case when p_category_id is not null and p.category_id = p_category_id
                 then 0.04 else 0 end
      )::numeric as confidence,
      jsonb_build_object(
        'tier', 'attribute',
        'title_similarity', round(similarity(p.title, p_title)::numeric, 3),
        'brand_match', true,
        'gender_match', p_gender is not null and p.gender = p_gender,
        'category_match', p_category_id is not null and p.category_id = p_category_id,
        'price_ratio',
          case when p_price_minor is null or bo.price_minor is null or bo.price_minor = 0
               then null
               else round(p_price_minor::numeric / bo.price_minor, 3) end
      ) as signals
    from public.products p
    left join public.product_best_offer bo on bo.product_id = p.id
    where p_brand_id is not null
      and p.brand_id = p_brand_id
      and p_title is not null
      and similarity(p.title, p_title) >= 0.45
      and (p_gender is null or p.gender = p_gender)
      and (
        p_price_minor is null
        or bo.price_minor is null
        or (bo.currency = p_currency
            and abs(bo.price_minor - p_price_minor)::numeric
                <= 0.15 * greatest(bo.price_minor, p_price_minor))
      )
  ),

  -- Tier 4 — the names look alike and nothing else is known. Capped low
  -- enough that it can only ever be a suggestion to a human.
  tier_fuzzy as (
    select
      p.id as product_id,
      'fuzzy'::public.match_method as method,
      least(0.49, 0.25 + 0.30 * similarity(p.title, p_title))::numeric as confidence,
      jsonb_build_object(
        'tier', 'fuzzy_title',
        'title_similarity', round(similarity(p.title, p_title)::numeric, 3),
        'brand_match', false
      ) as signals
    from public.products p
    where p_title is not null
      and similarity(p.title, p_title) >= 0.62
      and (p_brand_id is null or p.brand_id is distinct from p_brand_id)
  ),

  combined as (
    select * from tier_identifier_strong
    union all select * from tier_identifier_weak
    union all select * from tier_attribute
    union all select * from tier_fuzzy
  ),
  filtered as (
    select c.*
    from combined c
    join public.products p on p.id = c.product_id
    where (p_exclude_product_id is null or c.product_id <> p_exclude_product_id)
      and p.is_active
  )
  select distinct on (f.product_id)
    f.product_id, f.method, f.confidence, f.signals
  from filtered f
  order by f.product_id, f.confidence desc
  limit greatest(1, least(coalesce(p_limit, 5), 50));
$$;

comment on function public.find_product_matches is
  'Tiered product identity matching. Attribute and fuzzy tiers are capped below the auto-merge threshold by construction.';

-- Ingestion-only. The public roles have no business running the matcher, and
-- functions are EXECUTE-to-PUBLIC by default.
revoke execute on function public.find_product_matches(
  jsonb, uuid, text, public.gender, uuid, bigint, char(3), uuid, integer
) from public;


-- ============================================================================
-- Part 9 — development seed rows can never reach hugfab.com
--
-- `is_mock` has so far been enforced in application code: the repository
-- filters it and search_products defaults include_mock to false. That is a
-- correct policy in the wrong place. Anyone holding the anon key — which ships
-- in the browser bundle, by design — can query PostgREST directly and read
-- around it.
--
-- So the rule moves into the database. A single-row settings table decides
-- whether mock rows are visible at all, and the RLS policies consult it. The
-- production project leaves it false and no query, however it is constructed,
-- can return an invented price. The local seed sets it true, because that is
-- what the seed is for.
-- ============================================================================

create table public.app_settings (
  id boolean primary key default true,
  -- False in every hosted environment. See supabase/seed.sql for the local
  -- opt-in, which is the only place this is ever set true.
  allow_mock_products boolean not null default false,
  updated_at timestamptz not null default now(),

  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- SECURITY DEFINER because anon must not be able to read app_settings itself,
-- only to be filtered by it. It takes no arguments and returns one boolean, so
-- there is no input to smuggle anything through. search_path is pinned.
create or replace function public.mock_products_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select s.allow_mock_products from public.app_settings s where s.id), false);
$$;

-- The single definition of "this product may be shown to the public". The
-- product policy and all three child policies consult it, so the rule cannot
-- drift between them.
create or replace function public.product_is_visible(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.is_active
      and (not p.is_mock or public.mock_products_allowed())
  );
$$;

grant execute on function public.mock_products_allowed() to anon, authenticated;
grant execute on function public.product_is_visible(uuid) to anon, authenticated;

drop policy if exists "active products are publicly readable" on public.products;
create policy "live active products are publicly readable"
  on public.products for select to anon, authenticated
  using (is_active and (not is_mock or public.mock_products_allowed()));

-- 0002 scoped these to `p.is_active`. Mock rows need the same treatment, and
-- routing all four policies through one function keeps them honest.
drop policy if exists "prices for active products are publicly readable" on public.prices;
create policy "prices for visible products are publicly readable"
  on public.prices for select to anon, authenticated
  using (public.product_is_visible(prices.product_id));

drop policy if exists "price history for active products is publicly readable" on public.price_history;
create policy "price history for visible products is publicly readable"
  on public.price_history for select to anon, authenticated
  using (public.product_is_visible(price_history.product_id));

drop policy if exists "variants of active products are publicly readable" on public.product_variants;
create policy "variants of visible products are publicly readable"
  on public.product_variants for select to anon, authenticated
  using (public.product_is_visible(product_variants.product_id));


-- ============================================================================
-- Part 10 — RLS and grants for everything 0003 adds
-- ============================================================================

alter table public.product_identifiers      enable row level security;
alter table public.product_source_links     enable row level security;
alter table public.ingestion_runs           enable row level security;
alter table public.ingestion_errors         enable row level security;
alter table public.product_match_candidates enable row level security;
alter table public.app_settings             enable row level security;

-- Operational tables. RLS is on and no policy grants anon or authenticated
-- anything, so they are service-role only — the same pattern 0001 used for
-- affiliate_providers. Commercial relationships, feed identifiers and import
-- diagnostics are not public data.
--
-- product_source_links in particular would otherwise let anyone enumerate
-- which networks we buy from and what we pay them for.

-- Identifiers are the one exception: a GTIN is printed on the box, and a
-- client may legitimately want to show it. Only for visible products.
create policy "identifiers of visible products are publicly readable"
  on public.product_identifiers for select to anon, authenticated
  using (public.product_is_visible(product_identifiers.product_id));

grant select on public.product_identifiers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Affiliate URLs are not public data
--
-- `prices.affiliate_url` carries our tracking identifiers. It was readable by
-- anon, which means it was readable by anyone with the anon key — that is,
-- anyone who opened the site. A competitor could have lifted the entire
-- affiliate link set, and a scraper could have substituted their own tracking
-- id and monetised our catalogue.
--
-- The column-level grant below is the fix. The click-out path resolves the URL
-- server-side through the service-role client and returns only a redirect, so
-- the browser never needs the column at all.
--
-- `revoke select` then `grant select (columns)` rather than a column-level
-- revoke: the latter is a no-op against an existing table-wide grant.
-- ---------------------------------------------------------------------------
revoke select on public.prices from anon, authenticated;
grant select (
  id, product_id, variant_id, retailer_id,
  price_minor, original_minor, currency, discount_pct,
  previous_price_minor, price_changed_at, previous_availability,
  availability, product_url,
  first_seen_at, last_seen_at, observed_at, created_at, updated_at
) on public.prices to anon, authenticated;

grant select on public.product_price_stats to anon, authenticated;

comment on column public.prices.affiliate_url is
  'Our tracked destination. NOT granted to anon/authenticated (0003) — resolved server-side on click-out only.';
comment on column public.prices.affiliate_provider_id is
  'Which network supplied this offer. NOT granted to anon/authenticated (0003).';
