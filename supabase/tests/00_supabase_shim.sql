-- ============================================================================
-- Local test shim — NOT a migration, never applied to a Supabase project.
--
-- Supabase provides the auth schema and the anon/authenticated/service_role
-- roles. A bare Postgres does not, so this stands up just enough of them to
-- execute 0001_core.sql and exercise its policies for real.
-- ============================================================================

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- Supabase's service role bypasses RLS entirely; that is the whole point of
  -- guarding it as a server-only secret.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Mirrors Supabase: the subject claim of the verified JWT, or NULL when
-- anonymous. Tests set it with `set local request.jwt.claim.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
