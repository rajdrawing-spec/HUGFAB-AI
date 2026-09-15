import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchBar } from '@/components/search';
import {
  ProductGrid,
  ProductGridEmpty,
  ProductGridError,
  ProductGridSkeleton,
} from '@/components/product';
import { productSearchParamsSchema } from '@/modules/products/schema';
import { searchProducts } from '@/modules/products/service';
import { Pagination } from './pagination';

export const metadata: Metadata = {
  title: 'Search',
  // Result pages are infinite and near-duplicate; they should not be indexed.
  robots: { index: false, follow: true },
};

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Search results.
 *
 * State lives entirely in the URL, so a result set is shareable, bookmarkable
 * and survives the back button. The page is a server component that calls the
 * products service directly rather than fetching its own API — a round trip
 * through HTTP to our own process would add latency for nothing.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const raw = await searchParams;

  // Repeated keys collapse to the first value; the schema owns everything else.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const parsed = productSearchParamsSchema.safeParse(flat);
  const query = typeof flat.q === 'string' ? flat.q : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <SearchBar defaultValue={query} size="lg" />

      {!parsed.success ? (
        // A malformed filter is the user's URL, not a server fault: show the
        // empty state with a way out rather than a 500.
        <ProductGridEmpty query={query} hasFilters />
      ) : (
        <Suspense key={JSON.stringify(flat)} fallback={<LoadingResults />}>
          <Results params={parsed.data} query={query} />
        </Suspense>
      )}
    </div>
  );
}

function LoadingResults() {
  return (
    <div className="mt-8">
      <div className="bg-surface-2 mb-6 h-4 w-40 animate-pulse rounded-sm" />
      <ProductGridSkeleton />
    </div>
  );
}

async function Results({
  params,
  query,
}: {
  params: Awaited<ReturnType<typeof productSearchParamsSchema.parse>>;
  query?: string;
}) {
  let page;
  try {
    page = await searchProducts(params);
  } catch {
    // Unreachable database or unmigrated schema. The user did nothing wrong,
    // and retrying may well work.
    return (
      <div className="mt-8">
        <ProductGridError retryHref="/search" />
      </div>
    );
  }

  if (page.items.length === 0) {
    const hasFilters = Boolean(
      params.brand ||
      params.category ||
      params.gender ||
      params.retailer ||
      params.minPrice ||
      params.maxPrice ||
      params.inStock,
    );
    return (
      <div className="mt-8">
        <ProductGridEmpty query={query} hasFilters={hasFilters} />
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-small text-muted mb-6" role="status">
        {page.total.toLocaleString()} {page.total === 1 ? 'result' : 'results'}
        {query && <> for “{query}”</>}
      </p>

      <ProductGrid products={page.items} />

      <Pagination page={page.page} totalPages={page.totalPages} />
    </div>
  );
}
