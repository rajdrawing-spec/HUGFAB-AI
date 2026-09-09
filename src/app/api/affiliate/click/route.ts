import { NextResponse } from 'next/server';

import { handle } from '@/lib/api';
import { ApiError, parseSearchParams } from '@/lib/http';
import { clientEnv } from '@/lib/env.client';
import { clickParamsSchema } from '@/modules/affiliate/schema';
import { resolveClick } from '@/modules/affiliate/service';

/**
 * GET /api/affiliate/click — the click-out.
 *
 * The one route in the product that earns money. Every "Buy on <retailer>"
 * button goes through here rather than linking straight out, because this is
 * where attribution is recorded and where a dead offer is caught
 * (docs/user-flows.md F1).
 */

// Attribution must be recorded on every click, so nothing here may be cached
// or prerendered.
export const dynamic = 'force-dynamic';

export const GET = handle('GET /api/affiliate/click', async (request) => {
  const params = parseSearchParams(request.url, clickParamsSchema);

  try {
    const { destination } = await resolveClick(request, params);

    return NextResponse.redirect(destination, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store',
        // Do not leak our URL — including the product the user was looking at —
        // to the retailer.
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    /**
     * A person clicked a link, so a JSON error blob is the wrong answer. Send
     * them somewhere useful and let the page explain.
     *
     * Rate limiting is the exception: that is abuse, not a user, and it gets
     * the normal 429 from `handle()`.
     */
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      const home = new URL('/?notice=offer-unavailable', clientEnv.NEXT_PUBLIC_SITE_URL);
      return NextResponse.redirect(home, {
        status: 302,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    throw error;
  }
});
