#!/usr/bin/env bash
#
# Applies every migration to a throwaway Postgres database and runs the RLS
# assertions against it.
#
# This is the only way to know a migration works before it touches a Supabase
# project: RLS bugs are invisible to lint, typecheck and the test suite.
#
#   ./scripts/verify-migration.sh
#
# Requires a local PostgreSQL 16 with pgvector and pg_trgm available.
# The database is dropped and recreated on every run, so it is always a clean
# apply — never an accidental "works because it was already there".

set -euo pipefail

DB_NAME="${HUGFAB_TEST_DB:-hugfab_migration_test}"
PSQL_USER="${HUGFAB_TEST_DB_USER:-postgres}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_sql() { psql -v ON_ERROR_STOP=1 -q -U "$PSQL_USER" -d "$1" -f "$2"; }

echo "==> Recreating $DB_NAME"
psql -q -U "$PSQL_USER" -d postgres -c "drop database if exists $DB_NAME;" >/dev/null
psql -q -U "$PSQL_USER" -d postgres -c "create database $DB_NAME;" >/dev/null

echo "==> Applying the Supabase shim (auth schema and roles)"
run_sql "$DB_NAME" "$ROOT/supabase/tests/00_supabase_shim.sql"

echo "==> Applying migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$migration")"
  run_sql "$DB_NAME" "$migration"
done

echo "==> Applying the development seed"
run_sql "$DB_NAME" "$ROOT/supabase/seed.sql"

echo "==> Asserting RLS and data-integrity guarantees"
psql -v ON_ERROR_STOP=1 -U "$PSQL_USER" -d "$DB_NAME" \
     -f "$ROOT/supabase/tests/01_rls_assertions.sql" 2>&1 |
  grep -E '^(NOTICE|ERROR|psql)' | sed 's/^NOTICE:  /    /'

echo "==> Migration verified"
