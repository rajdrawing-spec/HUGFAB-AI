import 'server-only';

import { getCurrentUser } from '@/lib/auth';
import { ApiError } from '@/lib/http';
import { clientIdentifier, enforceRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import type { ClickParams } from './schema';
import * as repository from './repository';

/**
 * Click-out. The one path in the product that earns money, so it is the one
 * that must not fail quietly (docs/user-flows.md F1).
 */

export interface ClickOutcome {
  destination: string;
  tracked: boolean;
}

export async function resolveClick(
  request: Request,
  params: ClickParams,
): Promise<ClickOutcome> {
  const user = await getCurrentUser();

  await enforceRateLimit(clientIdentifier(request, user?.id), RATE_LIMITS.affiliateClick);

  const destination = await repository.findOfferDestination(
    params.product,
    params.retailer,
  );

  if (!destination) {
    // Either the offer is gone or the product is no longer visible. Both are
    // "not found" to the caller; we do not confirm which.
    throw new ApiError('NOT_FOUND', 'That offer is no longer available.');
  }

  const headers = request.headers;
  const ip =
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  await repository.recordClick({
    userId: user?.id ?? null,
    productId: params.product,
    retailerId: params.retailer,
    sessionId: params.session ?? null,
    ipHash: repository.hashIp(ip),
    referrer: headers.get('referer'),
  });

  return { destination: destination.url, tracked: destination.tracked };
}
