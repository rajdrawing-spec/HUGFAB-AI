# API

> Status: **Phase 1 read paths built.** Wishlist, AI and community endpoints
> arrive with their phases.
>
> Every route is a thin adapter: validate, authorise, rate limit, call a
> module's `service.ts`, return the envelope. No SQL and no business rules live
> in a route handler (`docs/architecture.md` §2.1).

## Envelope

Success and failure have one shape each, so a client writes one handler.

```jsonc
// 2xx
{ "data": { /* … */ } }

// non-2xx
{ "error": { "code": "BAD_REQUEST", "message": "…", "details": { /* optional */ } } }
```

`message` is safe to show a user. Internal detail goes to the logger, never into
the response. Every response carries an `x-request-id`; a 500 also returns it in
`details`, because it is the only thing a user can usefully quote back.

| Code | Status | Means |
|---|---|---|
| `BAD_REQUEST` | 400 | Input failed validation. `details.fields` maps field → messages. |
| `UNAUTHORIZED` | 401 | Sign-in required. |
| `FORBIDDEN` | 403 | Signed in, not allowed. |
| `NOT_FOUND` | 404 | No such resource — also returned instead of 403 for admin surfaces, which should not confirm they exist. |
| `CONFLICT` | 409 | Would violate a uniqueness rule. |
| `UNPROCESSABLE` | 422 | Well-formed but not actionable. |
| `RATE_LIMITED` | 429 | Budget spent. `details.retryAfter` in seconds. |
| `NOT_CONFIGURED` | 503 | The feature needs an integration this deployment does not have. |
| `INTERNAL` | 500 | Unhandled. Logged with the request id. |

## Money

Every price is `{ "amountMinor": 189900, "currency": "INR" }` — an integer count
of the currency's smallest unit. Never a float, never a formatted string:
formatting is locale-dependent and belongs to the client, via `lib/money.ts`.

`discountPercent` is a whole number or `null`. It is `null` whenever the
retailer gave no original price, and the schema refuses an "original" below the
current price, so it is never a flattering fiction (PRD §69).

---

## `GET /api/products`

The catalogue listing: filter, sort, paginate.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `q` | string | — | Full-text match on title, colour, material, description |
| `brand` | csv of slugs | — | `?brand=nike,adidas` |
| `category` | slug | — | Includes descendants: `topwear` returns hoodies |
| `gender` | `women` \| `men` \| `unisex` \| `kids` | — | |
| `retailer` | csv of slugs | — | Products carried by any of them |
| `minPrice` / `maxPrice` | number | — | **Major** units, as typed into a filter (`2000` = ₹2,000) |
| `inStock` | `true` \| `false` | `false` | |
| `sort` | `relevance` \| `price_asc` \| `price_desc` \| `newest` | `relevance` | |
| `page` | integer ≥ 1 | 1 | |
| `perPage` | 1–60 | 24 | |

```jsonc
{
  "data": {
    "items": [{
      "id": "…", "slug": "club-oversized-hoodie", "title": "Club Oversized Hoodie",
      "brand": { "id": "…", "slug": "nike", "name": "Nike" },
      "category": null, "gender": "unisex", "color": "Black",
      "imageUrls": ["https://…"], "isMock": false,
      "offerCount": 3,
      "bestOffer": {
        "retailer": { "id": "…", "slug": "myntra", "name": "Myntra" },
        "price": { "amountMinor": 189900, "currency": "INR" },
        "originalPrice": { "amountMinor": 299900, "currency": "INR" },
        "discountPercent": 37,
        "availability": "in_stock",
        "clickPath": "/api/affiliate/click?product=…&retailer=…"
      }
    }],
    "page": 1, "perPage": 24, "total": 42, "totalPages": 2
  }
}
```

`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. The catalogue
changes when ingestion runs, not per request.

## `GET /api/products/:slug`

One product with every retailer's offer, plus variants.

`offers` is ordered the way the comparison table renders it: in-stock first,
then cheapest. `bestOffer` is `offers[0]`, so the "Best Price" badge and the top
row agree by construction rather than by a second calculation. An out-of-stock
offer sorts below every available one however cheap it is — a price you cannot
buy at is not a competitive price.

404 when the slug does not exist, is inactive, or is a development seed row in
production.

## `GET /api/search`

`/api/products` with `q` required; 400 without it.

It exists as its own route so the client has the URL it will keep. Phase 2 puts
vector similarity and query parsing behind it, at which point it stops
resembling a catalogue listing.

## `GET /api/affiliate/click`

The click-out. **Redirects (302); it does not return JSON on success.**

| Parameter | Type | Required |
|---|---|---|
| `product` | uuid | yes |
| `retailer` | uuid | yes |
| `session` | string, 8–128 chars | no — de-duplicates anonymous clicks |

Every "Buy on <retailer>" button goes through here rather than linking straight
out. This is where attribution is recorded and where a dead offer is caught, and
it is why `ProductOffer` exposes `clickPath` and never the retailer's tracked
URL.

- Works signed out. Browsing, comparing and clicking out never require an
  account (`docs/user-flows.md` F1).
- Sends `Referrer-Policy: no-referrer`, so the retailer does not learn which
  page the user came from.
- A missing offer redirects to `/?notice=offer-unavailable` rather than
  returning a JSON blob — a person clicked a link. Rate limiting is the
  exception and still returns 429, because that is abuse, not a user.
- Attribution failure never blocks the redirect. Losing one row is a smaller
  failure than not sending the user to the retailer.

## `GET /api/health`

Liveness and readiness. Returns the build SHA, so the live commit is knowable
without SSH. 503 when the database is unreachable. Never cached.

---

## Rate limits

Per IP, or per user when signed in. In-memory in development, Upstash Redis in
production (`src/lib/ratelimit.ts`).

| Budget | Limit | Applies to |
|---|---|---|
| `search` | 60/min | `/api/products`, `/api/products/:slug`, `/api/search` |
| `affiliateClick` | 120/min | `/api/affiliate/click` |
| `ai` | 20/min | Phase 2 |
| `auth` | 10/min | Phase 1 |
| `write` | 30/min | Wishlist and community writes |

Behind Nginx and Cloudflare the socket address is the proxy's, so the limiter
reads `cf-connecting-ip`, `x-real-ip` then `x-forwarded-for`. The Nginx template
in `deploy/` sets them; without those headers every caller shares one budget.

## Mock data

`products.is_mock` marks development seed rows. **The repository excludes them
in production, and it is not a request parameter** — a client cannot ask for
invented prices. In development they are returned with `isMock: true` so the UI
can label them. No price, discount, availability figure, Deal Score or price
chart derived from them may be presented as real (PRD §60, §69).

## Authorisation

Reads are public: RLS grants `anon` the active catalogue, and the API adds
nothing on top. That is deliberate — the database is the authority on who sees
what, and these handlers hold no service-role key and cannot read past a policy.

Writes arrive with their features and go through `requireApiUser()` /
`requireApiAdmin()`, which read the role from `profiles` on every call.
