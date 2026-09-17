'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Chip, Sheet } from '@/components/ui';
import { formatMoney, fromMajorUnits } from '@/lib/money';
import { DEFAULT_MARKET } from '@/lib/locale';

/**
 * Search filters: the applied-filter chip row, and the drawer that sets them
 * (docs/ui-ux-guide.md §5, build order item 5).
 *
 * **Every filter lives in the URL and nowhere else.** There is no local filter
 * state to fall out of step with the results, because the results are rendered
 * by a server component that reads the same query string. A filtered view is
 * therefore shareable, bookmarkable, and survives the back button — which is
 * also why removing a chip is a navigation rather than a state update.
 *
 * The parameter names are exactly those in `productSearchParamsSchema`; the
 * schema validates them on arrival, so a hand-edited URL degrades to the empty
 * state rather than a 500.
 */

const GENDERS = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'unisex', label: 'Unisex' },
  { value: 'kids', label: 'Kids' },
] as const;

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
] as const;

/** Keys the drawer owns. `q` and `perPage` are deliberately not among them. */
const FILTER_KEYS = [
  'brand',
  'category',
  'gender',
  'retailer',
  'minPrice',
  'maxPrice',
  'inStock',
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

function labelForPrice(raw: string): string | null {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  // Whole amounts already drop their decimals — ₹1,899, not ₹1,899.00.
  return formatMoney(fromMajorUnits(amount, DEFAULT_MARKET.currency));
}

export function SearchFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  /**
   * Any change resets to page 1. Staying on page 7 while narrowing the result
   * set to four products shows an empty page and reads as "no results".
   */
  const navigate = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete('page');
      const query = next.toString();
      router.push(query === '' ? '/search' : `/search?${query}`);
    },
    [params, router],
  );

  const applied = useMemo(() => {
    const chips: Array<{ key: FilterKey; value: string; label: string }> = [];

    for (const key of FILTER_KEYS) {
      const value = params.get(key);
      if (value === null || value === '') continue;

      if (key === 'minPrice' || key === 'maxPrice') {
        const money = labelForPrice(value);
        if (money === null) continue;
        chips.push({
          key,
          value,
          label: key === 'minPrice' ? `From ${money}` : `Up to ${money}`,
        });
        continue;
      }

      if (key === 'inStock') {
        if (value !== 'true') continue;
        chips.push({ key, value, label: 'In stock only' });
        continue;
      }

      if (key === 'gender') {
        const match = GENDERS.find((g) => g.value === value);
        if (!match) continue;
        chips.push({ key, value, label: match.label });
        continue;
      }

      // brand, category and retailer are slugs. Showing the slug is honest —
      // the display name lives in a table this component does not read — but
      // it is title-cased so "oversized-hoodie" does not shout URL at anyone.
      chips.push({
        key,
        value,
        label: value
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
      });
    }

    return chips;
  }, [params]);

  const sort = params.get('sort') ?? 'relevance';
  const hasFilters = applied.length > 0;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        icon={
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        }
      >
        Filters
        {hasFilters && (
          <span className="bg-primary text-primary-foreground text-caption ml-1 rounded-full px-1.5 py-0.5">
            {applied.length}
          </span>
        )}
      </Button>

      {applied.map((chip) => (
        <Chip
          key={`${chip.key}:${chip.value}`}
          label={chip.label}
          selected
          onClick={() => setOpen(true)}
          onRemove={() => navigate((next) => next.delete(chip.key))}
        />
      ))}

      {hasFilters && (
        <Button
          variant="text"
          size="sm"
          onClick={() =>
            navigate((next) => {
              for (const key of FILTER_KEYS) next.delete(key);
            })
          }
        >
          Clear all
        </Button>
      )}

      <FilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        params={params}
        sort={sort}
        onApply={navigate}
      />
    </div>
  );
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  params: URLSearchParams;
  sort: string;
  onApply: (mutate: (next: URLSearchParams) => void) => void;
}

/**
 * The drawer itself. Bottom-anchored, which is where a thumb reaches on a phone
 * and which matches the guide's mobile sheet.
 */
function FilterDrawer({ open, onClose, params, sort, onApply }: FilterDrawerProps) {
  const set = (key: string, value: string | null) => {
    onApply((next) => {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    });
  };

  const gender = params.get('gender');
  const inStock = params.get('inStock') === 'true';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      side="bottom"
      footer={
        <Button fullWidth onClick={onClose}>
          Show results
        </Button>
      }
    >
      <div className="grid gap-6">
        <Field label="Shop for">
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={gender === option.value}
                // A second press clears it, so the row behaves as a set of
                // toggles rather than a radio group nobody can reset.
                onClick={() =>
                  set('gender', gender === option.value ? null : option.value)
                }
              />
            ))}
          </div>
        </Field>

        <Field label={`Price (${DEFAULT_MARKET.currency})`}>
          <div className="flex items-center gap-3">
            <PriceInput
              id="filter-min-price"
              label="Minimum"
              value={minPrice}
              onCommit={(value) => set('minPrice', value)}
            />
            <span aria-hidden="true" className="text-muted">
              –
            </span>
            <PriceInput
              id="filter-max-price"
              label="Maximum"
              value={maxPrice}
              onCommit={(value) => set('maxPrice', value)}
            />
          </div>
        </Field>

        <Field label="Availability">
          <Chip
            label="In stock only"
            selected={inStock}
            onClick={() => set('inStock', inStock ? null : 'true')}
          />
        </Field>

        <Field label="Sort by">
          <div className="flex flex-wrap gap-2">
            {SORTS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={sort === option.value}
                onClick={() =>
                  set('sort', option.value === 'relevance' ? null : option.value)
                }
              />
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-small text-muted mb-2 font-medium">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Committed on blur and on Enter rather than on every keystroke: a filter that
 * navigates per character would fire a query for "1", "19", "199"…
 */
function PriceInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    onCommit(trimmed === '' ? null : trimmed);
  };

  return (
    <div className="flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        className="border-border-strong bg-surface text-body focus-visible:outline-primary w-full rounded-md border px-3 py-2 focus-visible:outline-2"
      />
    </div>
  );
}
