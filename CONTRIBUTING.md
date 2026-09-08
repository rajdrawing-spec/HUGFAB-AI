# Contributing to HugFab

## Branches

```
main        production. Protected. Merge only via a green PR.
develop     integration. The default working branch.
feature/*   one branch per work item, cut from develop.
```

Branch names: `feature/0.6-design-tokens`, `fix/price-rounding`,
`chore/bump-next`. Merge back into `develop`; `develop` reaches `main` when a
phase is releasable.

Nothing is pushed to `main` without explicit instruction.

### Repository settings still to be applied

These are GitHub settings, not code, so they cannot be committed. Apply them
once, in Settings → Branches:

- [ ] Create `develop` and set it as the default branch.
- [ ] Protect `main`: require a pull request, require the `CI` check to pass,
      require the branch to be up to date, and disallow force pushes.
- [ ] Protect `develop`: require the `CI` check to pass.

## Before you open a pull request

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

CI runs exactly this. Running it locally first saves a round trip.

If you touched anything under `supabase/`, also run:

```bash
npm run db:verify
```

It applies every migration to a throwaway database and asserts the RLS
guarantees behaviourally — that a user cannot promote themselves to admin, that
one user cannot read another's wishlist, and so on. CI runs it too, against a
`pgvector/pgvector:pg16` service container. It needs a local PostgreSQL 16 with
`pgvector`:

```bash
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector
sudo pg_ctlcluster 16 main start
```

## House rules

These are the ones that get a PR sent back.

**No hard-coded design values.** Colour, type, spacing, radius and shadow come
from tokens (`docs/design-system.md`). If the token does not exist, add it to
`tokens.css` first.

**No hard-coded currency symbols.** Every price goes through `lib/money.ts`,
which holds integer minor units and lets `Intl` decide the symbol, grouping and
placement. Never a float, never a `₹` in a component (PRD §73).

**Every route handler validates its input.** Use `parseJsonBody` /
`parseSearchParams` from `lib/http.ts`, wrap the handler in `handle()` from
`lib/api.ts`, and return `ok()` / `fail()`. No handler formats its own error
response, and no handler contains SQL.

**Every table has RLS.** Enabled at creation, with explicit policies *and*
explicit grants — RLS filters rows, grants decide whether the role may touch the
table at all, and you need both. Add an assertion to
`supabase/tests/01_rls_assertions.sql` proving the new policy does what you think
it does. "RLS is enabled" is not a test; "Mallory cannot read Alice's row" is.

**Migrations are never edited after they are applied anywhere.** Write a new
one. `0001_core.sql` is applied the moment a Supabase project exists.

**Secrets are server-only.** They are read in `lib/env.server.ts` and nowhere
else. `NEXT_PUBLIC_*` is public — treat it as printed on the home page. The
service-role key bypasses RLS entirely and may only be used by the ingestion
worker and audited admin actions.

**Module boundaries hold.** A route handler calls a module's `service.ts`, never
its `repository.ts` and never another module's internals. No affiliate-network
shape reaches the frontend; no AI SDK is imported outside `modules/ai`
(`docs/architecture.md` §2.2).

**Accessibility is a merge condition, not a phase.** Keyboard operable, visible
focus, state announced rather than only coloured, motion preference respected.

**No live data that is not real.** Until an affiliate feed is approved, catalogue
data is labelled `MOCK DATA` and no price, coupon or availability figure is
presented as live (PRD §60, §69).

## Commits

Present tense, and say what changed rather than which files moved:

```
Add magic-byte validation to image uploads
Fix lakh grouping in en-IN price formatting
```

## Documentation

`docs/` is part of the change, not a follow-up. If you altered the architecture,
the schema or the deploy, update the matching document in the same PR (PRD §64).

`docs/ui-ux-guide.md` and `docs/user-flows.md` are written at the **start of
Phase 1**, before any major screen is coded (PRD §56).
