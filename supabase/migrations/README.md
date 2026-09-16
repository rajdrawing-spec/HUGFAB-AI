# supabase/migrations

Version-controlled SQL, applied in filename order and **never edited once
applied anywhere** — a correction is always a new migration.

## The migrations

| File | Was | What it does |
|---|---|---|
| `20260915093000_core.sql` | `0001` | The 11 core tables, RLS on every one with explicit policies and grants, the signup trigger, the role-escalation guard |
| `20260915094500_catalogue_queries.sql` | `0002` | Closes a read leak in the child-table policies; adds `product_best_offer` and `search_products()` |
| `20260915184500_product_identity.sql` | `0003` | Product identity and cross-provider matching, offer provenance and price movement, ingestion tracking, the match review queue, database-level mock containment |

Prose elsewhere in the codebase refers to these as migration 0001, 0002 and
0003. That numbering is still the right way to talk about them; the table above
is the mapping to filenames.

## Why the timestamps

The Supabase CLI derives a migration's version from the digits before the first
underscore and records it in `supabase_migrations.schema_migrations`. It
generates `20260916080406_name.sql`, and `supabase db push` is built around
that shape.

The files were renamed to match **before any of them had been applied to a
project**, which is the only safe moment to do it: once a version is recorded
as applied, renaming makes the tooling see an unapplied migration and try to
run it a second time, against a schema that already has it.

## How they get applied

`.github/workflows/database.yml`, on merge to `main`. Nobody applies migrations
by hand and nobody needs a local machine:

1. A pull request touching this directory gets a **dry run** — the workflow
   reports what would be applied and changes nothing.
2. Before either, every migration is applied to a throwaway PostgreSQL 16 with
   pgvector and the full assertion suite is run against it. Production is never
   touched by SQL that has not just been proved to apply cleanly.
3. On merge to `main`, `supabase db push` applies whatever is outstanding.

## Local verification

`npm run db:verify` — **local only**. It begins by dropping and recreating a
database called `hugfab_migration_test`, so it must never be pointed at a
hosted project. It proves the migrations apply to an empty database and that
the RLS policies stop what they are supposed to stop; it says nothing about
what is in production.
