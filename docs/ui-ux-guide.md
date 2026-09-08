# UI/UX guide

> Source: **HugFab UI/UX Design Guide v1.0** (tokens and primitives) and the
> **UI/UX Concept — Web & Mobile** screen set (layouts and patterns).
>
> The plan calls for this document at the **start of Phase 1, before any major
> screen is coded** (PRD §56). It exists early because the concept arrived
> during Phase 0. Tokens and primitives are already built and documented in
> `docs/design-system.md`; this file covers everything above that layer —
> screens, patterns and the rules that keep them consistent.
>
> Nothing here is implemented yet. Phase 0 ships the home shell only.

---

## 1. Product principles the design encodes

Read off the screens, because the layout is the argument:

1. **Search is the front door.** A full-width pill search bar with a camera
   affordance is the first thing on every surface, desktop and mobile. Category
   browsing sits underneath it, not above.
2. **Comparison is the payoff, not a feature.** Price across retailers is a
   first-class screen, not a tab on the product page. The product page's second
   button is "Compare Prices".
3. **The cheapest price is stated, not implied.** One row carries "Best Price";
   the rest do not. A user should never have to scan five numbers themselves.
4. **AI is an entry point, not a mode.** Visual search, AI search and the
   stylist are surfaces a user starts from, reachable in one tap from anywhere.
5. **Community is shopping.** Posts carry products; the "shop the look" path
   from a photo to a buyable list is the point of the feed.

---

## 2. Screen inventory

| # | Screen | Surface | Phase |
|---|---|---|---|
| 01 | Homepage | Desktop | 1 |
| 02 | Homepage | Mobile | 1 |
| 03 | AI Search results | Mobile | 2 |
| 04 | Visual Search (camera → detected items) | Mobile | 2 |
| 05 | Product detail | Desktop | 1 |
| 06 | Compare prices, price history, Deal Score | Desktop | 1 / 2 |
| 07 | AI Stylist chat | Mobile | 2 |
| 08 | Community feed | Mobile | 3 |
| 09 | Profile with Style DNA | Mobile | 2 / 3 |

Every screen has a counterpart on the other surface. The concept shows whichever
one carries the more demanding layout; the other follows the same content order.

---

## 3. Layout

**Desktop.** Content maxes at ~1200px, gutters 24px. Header is sticky, 64px, and
holds: wordmark · primary nav · search · wishlist · bag · avatar.

**Mobile.** Single column, 16px gutters. Header holds the wordmark, search icon
and avatar. The bottom bar has four destinations around a raised pink action
button; every scrollable page needs bottom padding to clear it.

**Breakpoint.** One that matters: `md` (768px). Below it the bottom bar appears
and the header nav collapses.

---

## 4. Recurring patterns

These appear on three or more screens, so they become components in
`src/components/product` and `src/components/search` rather than being rebuilt.

### Search bar
Pill, full width, magnifier left, camera right. The camera is the visual-search
entry point and is present on every instance. Placeholder names all four inputs:
*"Search for styles, brands, colors or upload a photo…"*

### Category rail
Circular thumbnails with labels beneath: Topwear, Bottomwear, Dresses, Footwear,
Accessories, Sports, Beauty, Home, Brands. Horizontally scrollable on mobile.

### Product card
Image, wishlist heart top-right, brand, product name, then the price cluster,
then the retailer. Retailer is shown with its logo and name — never a bare
domain. Cards go in a 2-up grid on mobile.

### Price cluster
The most repeated element in the product. Always in this order:

```
₹1,899        ₹2,999          37% OFF
current       original,       discount,
(h3, bold)    struck, muted   green, text-only badge
```

Rules: the discount is computed by `discountPercent()` in `lib/money.ts` and is
omitted when there is no genuine reduction — never rounded up to look better,
never shown when the "original" is a made-up MRP. Every figure comes from
`formatMoney()`; no component writes a currency symbol.

### Comparison table
One row per retailer: logo, name, current price, original, discount, action. The
cheapest row is marked "Best Price" as a solid pink badge. Rows are ordered by
price ascending, so the badge and the top row agree.

### Deal Score
A 0–100 ring with a verdict beneath ("Great Deal"). It is a claim about price
relative to history, so it renders only where real price history exists — never
against mock data, and never without the sentence explaining what it compares.

### Trust row
Free delivery · Easy returns · 100% authentic, with icons, under the product
buy box. These are retailer claims and must be sourced from the feed, not
asserted by HugFab.

### Style DNA bars
Labelled horizontal meters with percentages (Streetwear 89%, Minimal 76%…).
Bars use the primary→secondary gradient. Percentages are model output and carry
the same "how was this derived" affordance as any other AI claim.

---

## 5. Component build order for Phase 1

Built in this order, because each is used by the next:

1. `SearchBar` — used by every screen
2. `ProductCard` + `PriceDisplay` — the price cluster above
3. `ProductGrid`
4. `CategoryRail`
5. `FilterChip` / `FilterDrawer` (`Chip` and `Sheet` already exist)
6. `PriceComparison` table
7. `RetailerBadge`
8. `TrustRow`
9. `PriceHistoryChart` (Phase 2)
10. `DealScore` ring (Phase 2)

---

## 6. Content rules

**Nothing presented as live that is not.** Until an affiliate feed is approved,
every price, discount, coupon and availability figure carries a visible
`MOCK DATA` marker, and the Deal Score and price history do not render at all
(PRD §60, §69).

**Retailer names and logos are theirs.** Shown per feed terms, never restyled to
look like HugFab UI.

**Affiliate disclosure** appears on any surface with an outbound buy link, not
only in the footer (PRD §74).

**AI output is labelled as AI output.** "AI Finds Similar Looks", "AI Detected
Items" — the concept already does this consistently, and it should stay that
way rather than being softened into implied fact.

---

## 7. Typography beyond the token scale

The concept uses a **handwritten script** for editorial asides — *"Fashion made
simple with AI"*, *"Your style. Every store. One place."* This is a brand accent
with a narrow remit:

- Marketing surfaces only. Never in product UI, never in a control, never for
  anything a user must read to complete a task.
- Always paired with the same content in the type scale, or purely decorative.
- Needs a `--font-script` token and a licensed face before first use. Not yet
  added, because nothing in Phase 0 uses it.

---

## 8. What the concept does not settle

Flagged so Phase 1 does not discover them mid-build:

1. **Empty and loading states.** Every screen is drawn full. Search with no
   results, a product with one retailer, a feed with no follows, and skeletons
   for each need designing.
2. **Error states.** No screen shows a failed load, a dead affiliate link, or a
   stale price.
3. **Dark theme.** Both references are light-only. The dark palette in
   `tokens.css` is derived and needs review.
4. **Long content.** Product names, brand names and retailer names are all
   short in the mockups. Truncation and wrapping rules need deciding.
5. **Localisation.** Prices are drawn as `₹1,899` — the code formats by locale,
   so layouts must tolerate longer strings such as `AED 1,899.00`.
