import { handle } from '@/lib/api';
import { fail, ok, ApiError } from '@/lib/http';
import { clientIdentifier, enforceRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { productSlugSchema } from '@/modules/products/schema';
import { getProductBySlug } from '@/modules/products/service';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/** GET /api/products/:slug — one product with every retailer's offer. */
export const GET = handle<RouteContext>(
  'GET /api/products/[slug]',
  async (request, context) => {
    await enforceRateLimit(clientIdentifier(request), RATE_LIMITS.search);

    const raw = await context.params;
    const parsed = productSlugSchema.safeParse(raw);
    if (!parsed.success) {
      // A malformed slug cannot match anything, so it is a 404 rather than a
      // 400: there is no version of this URL that would have worked.
      return fail('NOT_FOUND', 'That product could not be found.');
    }

    const product = await getProductBySlug(parsed.data.slug);
    if (!product) {
      throw new ApiError('NOT_FOUND', 'That product could not be found.');
    }

    return ok(product, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  },
);
