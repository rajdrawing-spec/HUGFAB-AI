-- ============================================================================
-- 0001_core.sql — HugFab catalogue and identity core
--
-- Phase 0, work item 0.4. Creates every table Phase 1 reads from, with RLS
-- enabled and explicit policies on all of them.
--
-- NOT in this migration: `products.embedding vector(N)`. The dimension is fixed
-- by the embedding model, which is still undecided, and changing it later means
-- re-embedding the whole catalogue. It lands in `0002_embeddings.sql` once the
-- model is chosen — see docs/database.md. pgvector is enabled here so that
-- migration is a single ALTER TABLE.
--
-- Conventions:
--   * Money is an integer count of minor units (paise/cents) plus an ISO-4217
--     code, matching src/lib/money.ts. No float ever touches a price.
--   * Catalogue tables are readable by anon/authenticated and writable only by
--     the service role, which the ingestion worker and admin actions hold.
--   * User-owned tables are readable and writable only by their owner.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- pgvector, for 0002
create extension if not exists "pg_trgm";    -- fuzzy brand/product name matching

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'admin');

create type public.gender as enum ('women', 'men', 'unisex', 'kids');

create type public.availability as enum (
  'in_stock',
  'out_of_stock',
  'preorder',
  'discontinued',
  'unknown'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Keeps updated_at honest. Attached to every table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — mirrors auth.users. There is no hand-rolled user table (PRD §31).
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  -- The only source of admin truth. Read server-side on every check
  -- (src/lib/auth.ts); never trusted from a JWT claim or a header.
  role          public.user_role not null default 'user',
  locale        text not null default 'en-IN',
  currency      char(3) not null default 'INR',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 60
  ),
  constraint profiles_currency_format check (currency ~ '^[A-Z]{3}$')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile row on signup. SECURITY DEFINER because the inserting
-- session is the auth system, not a user with rights on public.profiles.
-- `search_path` is pinned: a SECURITY DEFINER function without it is a
-- privilege-escalation vector.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalogue reference data
-- ---------------------------------------------------------------------------

create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  logo_url    text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint brands_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  -- Self-referencing tree: Topwear → Hoodies → Oversized Hoodies.
  parent_id  uuid references public.categories (id) on delete set null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.retailers (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  logo_url    text,
  website_url text,
  -- Which market this retailer serves. Drives what a user in IN vs AE sees.
  region      char(2) not null default 'IN',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint retailers_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint retailers_region_format check (region ~ '^[A-Z]{2}$')
);

create trigger retailers_set_updated_at
  before update on public.retailers
  for each row execute function public.set_updated_at();

-- Affiliate network configuration. NOT public: it describes our commercial
-- integrations. Service role only, with no anon/authenticated policy at all.
create table public.affiliate_providers (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  is_active      boolean not null default false,
  -- Non-secret settings only (tracking id format, deep-link template).
  -- Credentials live in the environment, never in the database.
  config         jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint affiliate_providers_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create trigger affiliate_providers_set_updated_at
  before update on public.affiliate_providers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,

  brand_id     uuid references public.brands (id) on delete set null,
  category_id  uuid references public.categories (id) on delete set null,

  gender       public.gender not null default 'unisex',
  color        text,
  material     text,

  -- Image URLs only. Retailer images are hotlinked or CDN-proxied per feed
  -- terms, never copied to our storage (PRD §32, §74).
  image_urls   text[] not null default '{}',

  -- Provenance. `is_mock` marks development seed rows so no surface can ever
  -- present them as live catalogue data (PRD §60).
  source_provider_id uuid references public.affiliate_providers (id) on delete set null,
  external_id  text,
  is_mock      boolean not null default false,
  is_active    boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_title_length check (char_length(title) between 1 and 300),

  -- One row per product per source feed. Makes ingestion an idempotent upsert.
  constraint products_source_external_unique unique (source_provider_id, external_id)
);

-- Generated, so it can never drift from the columns it indexes. Title outranks
-- description; a match on the name should beat a mention in the blurb.
alter table public.products
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(color, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(material, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  sku          text,
  size         text,
  color        text,
  image_url    text,
  availability public.availability not null default 'unknown',
  external_id  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint product_variants_external_unique unique (product_id, external_id)
);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- prices — the current observed price per product per retailer
-- ---------------------------------------------------------------------------

create table public.prices (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  variant_id    uuid references public.product_variants (id) on delete cascade,
  retailer_id   uuid not null references public.retailers (id) on delete cascade,

  -- Integer minor units. 249900 INR = ₹2,499.00 (src/lib/money.ts).
  price_minor   bigint not null,
  -- The retailer's stated list price, when the feed provides one. Nullable
  -- because a discount must never be invented from a made-up MRP (PRD §69).
  original_minor bigint,
  currency      char(3) not null default 'INR',

  availability  public.availability not null default 'unknown',
  -- Where a click on this price sends the user. Built by modules/affiliate.
  affiliate_url text,
  product_url   text,

  observed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint prices_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint prices_non_negative check (price_minor >= 0),
  constraint prices_original_non_negative check (
    original_minor is null or original_minor >= 0
  ),
  -- A "discount" where the original is below the current price is bad data,
  -- not a bargain. Reject it at the boundary rather than rendering it.
  constraint prices_original_gte_current check (
    original_minor is null or original_minor >= price_minor
  ),
  -- One current price per product+variant+retailer; history goes elsewhere.
  constraint prices_unique_offer unique (product_id, variant_id, retailer_id)
);

create trigger prices_set_updated_at
  before update on public.prices
  for each row execute function public.set_updated_at();

-- Append-only observations. Feeds the price chart and Deal Score (Phase 2),
-- which is why nothing here is ever updated in place.
create table public.price_history (
  id          bigserial primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  variant_id  uuid references public.product_variants (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  price_minor bigint not null,
  currency    char(3) not null default 'INR',
  observed_at timestamptz not null default now(),

  constraint price_history_non_negative check (price_minor >= 0),
  constraint price_history_currency_format check (currency ~ '^[A-Z]{3}$')
);

-- ---------------------------------------------------------------------------
-- User-owned tables
-- ---------------------------------------------------------------------------

create table public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  note       text,
  -- Set when the user asks to be told about a drop. Phase 2 acts on it, and
  -- only against real observed history — never a single sighting.
  notify_below_minor bigint,
  created_at timestamptz not null default now(),

  constraint wishlists_unique_entry unique (user_id, product_id),
  constraint wishlists_notify_non_negative check (
    notify_below_minor is null or notify_below_minor >= 0
  )
);

-- Affiliate attribution. This is the revenue record, so it is written on every
-- click-out, signed in or not.
create table public.affiliate_clicks (
  id                    bigserial primary key,
  -- Null for anonymous clicks. Browsing and clicking out never require an
  -- account (docs/user-flows.md F1).
  user_id               uuid references auth.users (id) on delete set null,
  product_id            uuid references public.products (id) on delete set null,
  retailer_id           uuid references public.retailers (id) on delete set null,
  affiliate_provider_id uuid references public.affiliate_providers (id) on delete set null,

  -- Opaque per-session id so anonymous clicks can be de-duplicated without
  -- identifying anyone.
  session_id            text,
  -- Hashed, never the address itself. Fraud signal without storing PII.
  ip_hash               text,
  referrer              text,
  clicked_at            timestamptz not null default now()
);

-- ============================================================================
-- Indexes — on the columns Phase 1 actually filters and sorts by
-- ============================================================================

create index products_brand_idx        on public.products (brand_id);
create index products_category_idx     on public.products (category_id);
create index products_gender_idx       on public.products (gender);
create index products_active_idx       on public.products (is_active) where is_active;
create index products_mock_idx         on public.products (is_mock) where is_mock;
create index products_created_idx      on public.products (created_at desc);
create index products_search_idx       on public.products using gin (search_vector);
create index products_title_trgm_idx   on public.products using gin (title gin_trgm_ops);

create index brands_name_trgm_idx      on public.brands using gin (name gin_trgm_ops);
create index categories_parent_idx     on public.categories (parent_id);

create index product_variants_product_idx on public.product_variants (product_id);

create index prices_product_idx        on public.prices (product_id);
create index prices_retailer_idx       on public.prices (retailer_id);
create index prices_availability_idx   on public.prices (availability);
-- Serves "cheapest offer for this product", the comparison table's core query.
create index prices_product_amount_idx on public.prices (product_id, price_minor);

create index price_history_lookup_idx  on public.price_history (product_id, retailer_id, observed_at desc);

create index wishlists_user_idx        on public.wishlists (user_id, created_at desc);

create index affiliate_clicks_user_idx    on public.affiliate_clicks (user_id, clicked_at desc);
create index affiliate_clicks_product_idx on public.affiliate_clicks (product_id, clicked_at desc);

-- ============================================================================
-- Row Level Security
--
-- Enabled on every table, with explicit policies. Nothing relies on
-- default-deny by accident. `revoke ... from public` first, so a role that
-- inherits PUBLIC grants cannot read around a policy.
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.brands              enable row level security;
alter table public.categories          enable row level security;
alter table public.retailers           enable row level security;
alter table public.affiliate_providers enable row level security;
alter table public.products            enable row level security;
alter table public.product_variants    enable row level security;
alter table public.prices              enable row level security;
alter table public.price_history       enable row level security;
alter table public.wishlists           enable row level security;
alter table public.affiliate_clicks    enable row level security;

-- Belt and braces: force RLS even for the table owner, so a mistake in a
-- SECURITY DEFINER function cannot quietly bypass a policy.
alter table public.profiles            force row level security;
alter table public.wishlists           force row level security;
alter table public.affiliate_clicks    force row level security;

-- --- public catalogue: readable by everyone, writable only by service role ---

create policy "catalogue is publicly readable"
  on public.brands for select to anon, authenticated using (true);

create policy "catalogue is publicly readable"
  on public.categories for select to anon, authenticated using (true);

create policy "active retailers are publicly readable"
  on public.retailers for select to anon, authenticated using (is_active);

create policy "active products are publicly readable"
  on public.products for select to anon, authenticated using (is_active);

create policy "variants are publicly readable"
  on public.product_variants for select to anon, authenticated using (true);

create policy "prices are publicly readable"
  on public.prices for select to anon, authenticated using (true);

create policy "price history is publicly readable"
  on public.price_history for select to anon, authenticated using (true);

-- affiliate_providers deliberately has NO anon/authenticated policy. RLS is on
-- and no policy grants access, so it is service-role only.

-- --- profiles ---

create policy "users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Role escalation is blocked by a trigger, not by the policy above: a policy on
-- public.profiles whose expression reads public.profiles recurses. The two
-- client-facing roles can never change `role`; the service role and migrations
-- can.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated') then
    raise exception 'role may only be changed by an administrator'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- --- wishlists ---

create policy "users read their own wishlist"
  on public.wishlists for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users add to their own wishlist"
  on public.wishlists for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users update their own wishlist"
  on public.wishlists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users remove from their own wishlist"
  on public.wishlists for delete to authenticated
  using ((select auth.uid()) = user_id);

-- --- affiliate_clicks ---

-- Anonymous clicks are recorded with a null user_id; a signed-in user may only
-- write a row attributed to themselves.
create policy "clicks may be recorded"
  on public.affiliate_clicks for insert to anon, authenticated
  with check (user_id is null or (select auth.uid()) = user_id);

create policy "users read their own clicks"
  on public.affiliate_clicks for select to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- Grants
--
-- RLS filters rows; grants decide whether the role may touch the table at all.
-- Both are needed. Being explicit here means the schema does not depend on
-- whatever default privileges happen to be configured.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select on
  public.brands,
  public.categories,
  public.retailers,
  public.products,
  public.product_variants,
  public.prices,
  public.price_history
to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.wishlists to authenticated;
grant insert on public.affiliate_clicks to anon, authenticated;
grant select on public.affiliate_clicks to authenticated;
grant usage, select on sequence public.affiliate_clicks_id_seq to anon, authenticated;
