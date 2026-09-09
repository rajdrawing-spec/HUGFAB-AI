import { handle } from '@/lib/api';
import { ApiError, ok, parseSearchParams } from '@/lib/http';
import { clientIdentifier, enforceRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { productSearchParamsSchema } from '@/modules/products/schema';
import { searchProducts } from '@/modules/products/service';

/**
 * GET /api/search — keyword search.
 *
 * Today this is /api/products with `q` made mandatory, and it would be fair to
 * ask why it exists at all. It exists so the client has the URL it will keep:
 * Phase 2 adds vector similarity and query parsing behind this route, at which
 * point it stops resembling a catalogue listing. Splitting it later would mean
 * changing every caller.
 */
export const GET = handle('GET /api/search', async (request) => {
  await enforceRateLimit(clientIdentifier(request), RATE_LIMITS.search);

  const params = parseSearchParams(request.url, productSearchParamsSchema);

  if (!params.q) {
    throw new ApiError('BAD_REQUEST', 'A search term is required.', {
      fields: { q: ['required'] },
    });
  }

  const page = await searchProducts(params);

  return ok(page, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  });
});
