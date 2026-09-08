# User flows

> Companion to `docs/ui-ux-guide.md`, written from the UI/UX concept screen set.
> Required at the **start of Phase 1, before any major screen is coded**
> (PRD §56). Nothing here is implemented yet.

The concept states the spine of the product as five steps:

```
Search  →  Discover  →  Compare  →  Shop  →  Share
```

Everything below is a path through that spine. The flows are numbered so a PR
can say which one it implements.

---

## F1 — Text search to affiliate click *(Phase 1, the revenue path)*

The one flow that has to work before anything else is worth building.

```
Home
  └─ search bar: "black oversized hoodie"
       └─ Results: grid + filters (gender, category, brand, price, retailer)
            └─ Product detail
                 ├─ Compare Prices  ──► comparison table, cheapest marked
                 └─ Buy on <retailer>  ──► /api/affiliate/click
                                             ├─ record click (user or anon)
                                             └─ 302 to the retailer's tagged URL
```

**Rules.** The click-out is a server route, never a bare `<a href>` to a
tracking URL: the redirect is where attribution is recorded and where a dead or
expired affiliate link is caught. It is rate-limited (`RATE_LIMITS.affiliateClick`).
Anonymous clicks are recorded without a user id — the flow never requires an
account.

**Failure paths.** No results → suggestions and a broadened query, not a blank
grid. One retailer only → the comparison table still renders, stating that.
Dead affiliate link → the user goes to the product page on the retailer's site,
and the failure is logged.

---

## F2 — Visual search *(Phase 2)*

```
Any screen: camera icon in the search bar
  └─ Capture or upload
       └─ Validate  (magic bytes, MIME, size — lib/upload.ts, already built)
            └─ Retake  |  Use Photo
                 └─ Detection: "AI Detected Items" — jacket, t-shirt, cargo pants, sneakers
                      └─ Select item(s)  ──► Find Similar Looks  ──► F1 from Results
```

**Rules.** The upload is validated before it reaches any model. The user picks
which detected item to search — the system never silently decides for them.
Results are labelled as AI-derived. The photo is not retained beyond the request
unless the user saves the look.

---

## F3 — AI stylist *(Phase 2)*

```
AI Stylist entry (header, bottom bar, or home CTA)
  └─ Prompt: "I need a college outfit under ₹3000"
       └─ Outfit proposal: items + per-item price + total
            ├─ Refine: "make it more formal", "add a jacket", "under ₹2000"
            └─ Shop This Look  ──► F1 per item
```

**Rules.** Every model response is schema-validated before it renders
(PRD §29, §69) — a proposal referencing a product id that does not exist is
dropped, not shown. The stated total is computed from real prices with
`addMoney()`, never from the model's arithmetic. Budget constraints in the
prompt are enforced in the query, not merely requested of the model.

---

## F4 — Community, and shop-the-look *(Phase 3)*

```
Feed (For You | Following | Trending)
  └─ Post: photo + caption + tagged products + poll
       ├─ Like · comment · share · follow
       └─ Tagged product  ──► Product detail  ──► F1
```

The centre button in the mobile bar composes a post. Until Phase 3 it is the
visual-search entry point instead.

---

## F5 — Sign-up and session *(Phase 0, built)*

```
/signup  ─ email + password  ──► confirmation email ──► /auth/callback ──► next
         └─ Continue with Google ──► OAuth ──► /auth/callback ──► next
/login   ─ same, minus confirmation
/settings ─ requires a session; anonymous visitors are redirected to /login?next=/settings
```

**Rules.** Browsing, searching, comparing and clicking out never require an
account. An account buys wishlists, price alerts, Style DNA and the community.
`?next=` is validated as a same-origin absolute path before redirect.

---

## F6 — Wishlist and price alerts *(Phase 1 / Phase 2)*

```
Heart on any product card or detail page
  ├─ signed in     ──► saved, toast confirms
  └─ signed out    ──► /login?next=<current path>, then saved
Wishlist
  └─ Notify me when the price drops  ──► alert on price_history changes  (Phase 2)
```

An alert is a promise, so it fires only on real observed history — never on
mock data, and never on a price we have seen only once.

---

## Cross-cutting rules

**No dead ends.** Every empty, error and unauthenticated state offers the next
action. A 404 links home; no results suggests a broader query; a failed load
retries.

**Nothing blocks on an account** except the features that are inherently
personal (F5, F6, F4).

**Every AI step is labelled and reversible.** A user can see what was inferred
and change it — Retake, Refine, edit Style DNA.

**Prices are honest end to end.** One formatter (`lib/money.ts`), one discount
calculation, an explicit "best price", and no figure presented as live until a
real feed provides it (PRD §60, §69).
