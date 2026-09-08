'use client';

import { clientEnv } from './env.client';

/**
 * Thin analytics facade. Components call `track()`; whether anything is sent —
 * and whether the SDK is even downloaded — is decided here, once.
 *
 * PostHog is imported lazily so a deployment without a key ships none of it.
 * Swapping to another provider later touches this file only.
 */

const enabled = Boolean(clientEnv.NEXT_PUBLIC_POSTHOG_KEY);

type PostHog = typeof import('posthog-js').default;

let clientPromise: Promise<PostHog> | null = null;

function client(): Promise<PostHog> {
  clientPromise ??= import('posthog-js').then((m) => m.default);
  return clientPromise;
}

/**
 * Event names are a closed set so the funnel does not fill with typos. Add a
 * name here before using it.
 */
export type AnalyticsEvent =
  | 'page_viewed'
  | 'search_performed'
  | 'product_viewed'
  | 'affiliate_link_clicked'
  | 'wishlist_item_added'
  | 'signed_up'
  | 'signed_in';

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!enabled) return;
  void client().then((posthog) => posthog.capture(event, properties));
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!enabled) return;
  void client().then((posthog) => posthog.identify(userId, traits));
}

export function resetAnalyticsIdentity(): void {
  if (!enabled) return;
  void client().then((posthog) => posthog.reset());
}
