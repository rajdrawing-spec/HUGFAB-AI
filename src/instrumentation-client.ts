/**
 * Browser instrumentation. Loaded by Next on the client before hydration.
 *
 * Both SDKs are imported dynamically inside their key check, so a deployment
 * without them does not merely disable the integrations — it never ships their
 * code. Between them they are roughly 180 kB of JavaScript that an unconfigured
 * environment has no use for.
 */

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** Resolves once Sentry is live; null when there is no DSN. */
const sentryReady: Promise<typeof import('@sentry/nextjs') | null> = sentryDsn
  ? import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_BUILD_SHA,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
        // Bodies and URLs can carry search queries and affiliate identifiers.
        sendDefaultPii: false,
      });
      return Sentry;
    })
  : Promise.resolve(null);

if (posthogKey) {
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      // The App Router changes URL without a page load; pageviews come from
      // components/layout/analytics-provider.tsx instead.
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
  });
}

/**
 * Next calls this on every client-side navigation. It must exist whether or not
 * Sentry does, so it forwards once the SDK has resolved and is a no-op if it
 * never will.
 */
export function onRouterTransitionStart(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>
) {
  void sentryReady.then((Sentry) => Sentry?.captureRouterTransitionStart(...args));
}
