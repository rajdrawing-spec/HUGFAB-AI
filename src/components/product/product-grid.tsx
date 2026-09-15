import Link from 'next/link';
import type { ProductSummary } from '@/modules/products/types';
import { ProductCard, ProductCardSkeleton } from './product-card';

/**
 * The results grid, and the three states neither design reference settles
 * (docs/ui-ux-guide.md §8): loading, empty, and error.
 *
 * They are colocated on purpose. A grid that only knows how to render results
 * is the reason empty states end up as a blank page nobody designed.
 */

export function ProductGrid({ products }: { products: readonly ProductSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
      // Announce that results are coming rather than leaving a screen reader
      // with a silent page.
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  /** The search term, when there was one. Shown back so the user can see the typo. */
  query?: string;
  /** True when filters are narrowing the result set. */
  hasFilters?: boolean;
}

/**
 * No results is a dead end unless it offers the next move, so this always
 * offers one (docs/user-flows.md, cross-cutting rules).
 */
export function ProductGridEmpty({ query, hasFilters }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <SearchIcon />
      <h2 className="text-h3 mt-4">
        {query ? <>No matches for “{query}”</> : <>Nothing here yet</>}
      </h2>

      <p className="text-body text-muted mt-2 max-w-sm">
        {hasFilters
          ? 'Try removing a filter, or widening the price range.'
          : query
            ? 'Check the spelling, or try a broader search — a brand, or a category like “hoodies”.'
            : 'The catalogue is still being connected. Nothing is missing on your side.'}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasFilters && (
          <Link
            href="/search"
            className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
          >
            Clear filters
          </Link>
        )}
        <Link
          href="/"
          className="text-button bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center rounded-full px-6 font-semibold transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

/**
 * Shown when the catalogue could not be read at all — the database is
 * unreachable, or the schema has not been migrated. Distinct from "no results",
 * because the user did nothing wrong and retrying may well work.
 */
export function ProductGridError({ retryHref }: { retryHref?: string }) {
  return (
    <div className="flex flex-col items-center py-20 text-center" role="alert">
      <div className="bg-error-soft text-error flex size-12 items-center justify-center rounded-full">
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <h2 className="text-h3 mt-4">We could not load the catalogue</h2>
      <p className="text-body text-muted mt-2 max-w-sm">
        This is on our side, not yours. It is usually temporary.
      </p>
      {retryHref && (
        <Link
          href={retryHref}
          className="text-button bg-primary text-primary-foreground hover:bg-primary-hover mt-6 inline-flex h-11 items-center rounded-full px-6 font-semibold transition-colors"
        >
          Try again
        </Link>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <div className="bg-surface-2 text-muted flex size-12 items-center justify-center rounded-full">
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
