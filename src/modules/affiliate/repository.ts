import 'server-only';

import { createHash } from 'node:crypto';

import { env } from '@/lib/env.server';
import { logger } from '@/lib/logger';
import { createServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * The row shape this function needs, parsed rather than inferred.
 *
 * Supabase can infer a select's result type from the query string, but that
 * inference is only as good as the `Database` types behind it — and ours are
 * hand-written until a project exists to generate them from. Parsing means a
 * drift between the two is a clear error here, not a silently undefined URL
 * that sends a user nowhere.
 */
const offerRowSchema = z.object({
  affiliate_url: z.string().url().nullable().catch(null),
  product_url: z.string().url().nullable().catch(null),
});

/** The only code that talks to Postgres about click-outs. */

export interface OfferDestination {
  /** Where the user is actually sent. */
  url: string;
  /** True when this is a tracked link rather than a bare retailer URL. */
  tracked: boolean;
}

/**
 * The link for one product at one retailer, or null when there isn't one.
 *
 * Reads through the request-scoped client, so RLS decides visibility: a
 * withdrawn product's offers are unreachable here for the same reason they are
 * unreachable everywhere else.
 */
export async function findOfferDestination(
  productId: string,
  retailerId: string,
): Promise<OfferDestination | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('prices')
    .select('affiliate_url, product_url')
    .eq('product_id', productId)
    .eq('retailer_id', retailerId)
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('offer lookup failed', error, { productId, retailerId });
    return null;
  }
  if (!data) return null;

  const offer = offerRowSchema.safeParse(data);
  if (!offer.success) {
    logger.error('offer row did not match the expected shape', offer.error, {
      productId,
      retailerId,
    });
    return null;
  }

  if (offer.data.affiliate_url) {
    return { url: offer.data.affiliate_url, tracked: true };
  }
  // No tracking wrapper yet — send the user to the retailer anyway. A missing
  // commission is better than a dead end.
  if (offer.data.product_url) {
    return { url: offer.data.product_url, tracked: false };
  }

  return null;
}

/**
 * IP addresses are never stored. With a salt configured we keep a hash, which
 * is enough to spot click fraud; without one we keep nothing, because an
 * unsalted hash of an IPv4 address is reversible by brute force in seconds and
 * would be personal data wearing a disguise.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip || !env.CLICK_IP_SALT) return null;
  return createHash('sha256').update(`${env.CLICK_IP_SALT}:${ip}`).digest('hex');
}

/**
 * The insert is narrowed explicitly for the same reason as the search RPC in
 * modules/products/repository.ts: postgrest-js derives its insert type from the
 * `Database` declaration, and ours is hand-written until there is a project to
 * generate it from. Writing the row shape out here keeps the call honest and
 * localises what has to change when generated types land.
 */
interface ClickInsertRow {
  user_id: string | null;
  product_id: string;
  retailer_id: string;
  session_id: string | null;
  ip_hash: string | null;
  referrer: string | null;
}

interface ClickWritableClient {
  from(table: 'affiliate_clicks'): {
    insert(row: ClickInsertRow): PromiseLike<{ error: { message: string } | null }>;
  };
}

export interface ClickRecord {
  userId: string | null;
  productId: string;
  retailerId: string;
  sessionId: string | null;
  ipHash: string | null;
  referrer: string | null;
}

/**
 * Records the click. Never throws: this is the revenue path, and losing one
 * attribution row is a smaller failure than refusing to send the user to the
 * retailer.
 */
export async function recordClick(click: ClickRecord): Promise<void> {
  try {
    const supabase = (await createServerSupabase()) as unknown as ClickWritableClient;
    const { error } = await supabase.from('affiliate_clicks').insert({
      user_id: click.userId,
      product_id: click.productId,
      retailer_id: click.retailerId,
      session_id: click.sessionId,
      ip_hash: click.ipHash,
      referrer: click.referrer,
    });
    if (error) throw error;
  } catch (error) {
    logger.error('click attribution not recorded', error, {
      productId: click.productId,
      retailerId: click.retailerId,
    });
  }
}
