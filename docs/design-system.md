# Design system

> Source: **HugFab UI/UX Design Guide v1.0**. Where this document and the guide
> disagree, the guide wins and this file is wrong — say so in a PR.

Implemented in `src/styles/tokens.css` (raw values) and `src/styles/globals.css`
(the Tailwind mapping). Primitives live in `src/components/ui`.

## The one rule

**A component never hard-codes a colour, size, radius, shadow or currency
symbol.** It uses a token utility (`bg-surface`, `text-h2`, `rounded-lg`) or
`lib/money.ts`. A re-theme, or a second market, then happens in one file instead
of two hundred.

If you find yourself typing `#FF3B7A`, `text-[15px]` or `₹` inside a component,
the token you want either exists under another name or needs adding here first.

## Colour

Tokens are semantic. `bg-primary` says what the thing *is*; `bg-pink-500` says
what it looks like today.

| Token | Light | Role |
|---|---|---|
| `background` | `#F8F9FB` | Page ground |
| `surface` | `#FFFFFF` | Cards, inputs, header |
| `surface-2` | `#F1F3F7` | Secondary fills, hover |
| `text` | `#111827` | Primary text |
| `muted` | `#687280` | Secondary text |
| `border` / `border-strong` | `#E5E8EF` / `#CFD5E1` | Dividers / input outlines |
| `primary` | `#FF3B7A` | Brand. CTAs, active nav, selected chips |
| `secondary` | `#7C3AED` | Supporting brand accents |
| `accent` | `#00C896` | Positive signals — in stock, savings |
| `dark` | `#0F172A` | Deliberate dark panels (the guide's Plus banner) |
| `success` `warning` `error` | | Status, each with a `-soft` background pair |

Every colour also has a dark-theme value. **The dark palette is derived, not
given** — the guide is light-only. It is marked as such in `tokens.css` and
wants a designer's review before Phase 1 ships.

Theme resolution: an explicit choice stamps `data-theme="light|dark"` on
`<html>`; with no stamp, `prefers-color-scheme` decides.

## Type

Poppins, self-hosted by `next/font` — no runtime request to Google, which keeps
the CSP tight and the first paint independent of a third party.

| Token | Size | Weight | From |
|---|---|---|---|
| `text-display` | 56 | 700 | Addition — hero only |
| `text-h1` | 48 | 700 | Guide |
| `text-h2` | 32 | 600 | Guide |
| `text-h3` | 24 | 600 | Guide |
| `text-body` | 16 | 400 | Guide |
| `text-small` | 14 | 400 | Guide (named "Caption" there) |
| `text-caption` | 12 | 400 | Addition — overlines, micro-labels |
| `text-button` | 15 | 600 | Guide |

Two deliberate departures: `display` sits above the guide's H1 for hero type,
and `caption` is added at 12 for overlines — which moves the guide's 14 onto
`small`, where the rest of the system already expects it.

## Space, radius, elevation

Spacing is Tailwind's 4px scale. Radius follows the guide's soft chrome:

| Token | Value | Used for |
|---|---|---|
| `rounded-sm` | 8 | Chips, tags, badges |
| `rounded-md` | 12 | Buttons, inputs |
| `rounded-lg` | 16 | Cards |
| `rounded-xl` | 24 | Sheets, hero panels |
| `rounded-full` | — | Pill CTAs and the search field |

`shadow-sm` / `shadow-md` / `shadow-lg`, all theme-aware.

## Primitives

| Component | Notes |
|---|---|
| `Button` | `primary` `secondary` `outline` `text` from the guide; `accent` and `danger` added. `pill`, `loading`, `icon`, `fullWidth`. |
| `Input` | Label required (use `hideLabel` for visual-only omission), `hint`/`error` wired to `aria-describedby`, optional leading `icon` and `pill`. |
| `Card` | `Card` + `CardHeader` / `CardTitle` / `CardDescription` / `CardBody` / `CardFooter`. |
| `Modal` | Native `<dialog>`: focus trapping, top layer, page inertness and Escape are the browser's job, not ours. |
| `Sheet` | Same foundation, anchored left / right / bottom. |
| `Toast` | `ToastProvider` + `useToast()`. Errors announce assertively, everything else politely. |
| `Badge` | The guide's tags, discount and stock pills. |
| `Chip` | Filter chip with `aria-pressed` and an optional remove affordance. |
| `Header` `Footer` `BottomNavigation` | Navigation comes from one `nav-links.ts`, so the desktop and mobile bars cannot drift apart. Unbuilt destinations render as disabled hints rather than dead links. |

## Accessibility

Not a phase — a condition of merge.

- Every interactive element is reachable and operable by keyboard.
- `:focus-visible` gives a 2px `ring` outline; focus is never removed, only styled.
- State is announced, not merely coloured: `aria-pressed`, `aria-invalid`,
  `aria-busy`, `aria-current`, `role="alert"`.
- Icons inside a labelled control are `aria-hidden`; icon-only controls carry an
  `aria-label`.
- `prefers-reduced-motion: reduce` collapses every animation and transition
  globally in `globals.css`.
- Target contrast is WCAG AA (4.5:1 body, 3:1 large). Pink on white is the tight
  pair — `primary` is for fills and large text, not small body copy on `surface`.
- The layout ships a skip link to `#main`.

## Adding a token

1. Add the raw value to `:root` in `tokens.css`, and to **both** dark blocks.
2. Map it in the `@theme inline` block in `globals.css`.
3. Note it here, saying whether it comes from the guide or is derived.

Never define a colour only inside a media query — a token that exists in one
theme and not the other fails silently in the other.
