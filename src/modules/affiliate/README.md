# modules/affiliate

Empty by design (Phase 0 creates the shape, not the behaviour).

Each module owns four files when it is built:

| File | Responsibility |
|---|---|
| `types.ts` | The module's domain types. Nothing network- or table-shaped. |
| `schema.ts` | Zod schemas. Every external input and every AI output is parsed here before it goes anywhere (PRD §29, §69). |
| `repository.ts` | The only code that talks to Postgres. Server-only. |
| `service.ts` | Business logic. The single entry point for route handlers and server components. |

Route handlers under `src/app/api` are thin adapters: validate, authorise, call
`service.ts`, return the envelope from `lib/http.ts`. No SQL and no business
rules in a route handler.
