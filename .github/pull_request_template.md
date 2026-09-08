## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- The problem, or the work item this belongs to, e.g. "Phase 0, item 0.6". -->

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No hard-coded currency symbol, colour, spacing or radius — tokens and `lib/money.ts` only (PRD §73)
- [ ] Every new route handler validates its input with Zod and returns the envelope from `lib/http.ts`
- [ ] Any new table has RLS enabled with explicit policies
- [ ] No secret, key or service-role credential is readable from client code
- [ ] `.env.example` updated if a new variable was introduced
- [ ] `docs/` updated if the architecture, database or deployment changed (PRD §64)

## Screenshots

<!-- For UI changes: light and dark, mobile and desktop. -->

## Notes for the reviewer

<!-- Anything deliberately left out, or a decision worth a second opinion. -->
