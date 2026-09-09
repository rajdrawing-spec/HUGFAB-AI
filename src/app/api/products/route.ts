import { handle } from '@/lib/api';
import { ok, parseSearchParams } from '@/lib/http';
import { clientIdentifier, enforceRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { productSearchParamsSchema } from '@/modules/products/schema';
import { searchProducts } from '@/modules/products/service';

/**
 * GET /api/products — the catalogue listing.
 *
 * Filters, sorts and paginates. A `q` is optional here; /api/search is the
 * keyword-first entry point.
 *
 * A thin adapter, as every route handler should be: validate, authorise, rate
 * limit, call the service, return the envelope (docs/architecture.md §2.1).
 */
export const GET = handle('GET /api/products', async (request) => {
  await enforceRateLimit(clientIdentifier(request), RATE_LIMITS.search);

  const params = parseSearchParams(request.url, productSearchParamsSchema);
  const page = await searchProducts(params);

  return ok(page, {
    headers: {
      // The catalogue changes when ingestion runs, not per request. Serving a
      // minute-old page is fine; serving a stale one for five minutes while it
      // refreshes behind the scenes is better than serving none.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
});
