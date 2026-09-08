# modules

Domain modules for the modular monolith (docs/architecture.md §2.1). Not
microservices — separate folders with explicit boundaries inside one deployable.

Two boundaries carry most of the architecture's weight:

- **No affiliate-network shape ever leaves `modules/affiliate`.** Every provider
  normalises into `HugFabProduct` first, so swapping Cuelinks for Admitad never
  reaches a component (PRD §23, §24).
- **No AI SDK is ever imported outside `modules/ai`.** All access goes through
  `/api/ai/*` behind an `AIProvider` interface, and every model output is
  schema-validated before it touches the database (PRD §29).

A module may import from `lib/`. A module may not import another module's
`repository.ts` — go through its `service.ts`.
