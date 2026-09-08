/**
 * Next.js server instrumentation hook. Runs once per server process, before
 * any request is handled.
 *
 * Sentry is initialised only when a DSN is present, so a developer without keys
 * gets a completely silent no-op rather than a stream of transport errors.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail fast: a production process missing a required key must not serve.
    // Imported dynamically so the Edge runtime never pulls in server-only code.
    const { assertServerEnvironment } = await import('@/lib/env.server');
    assertServerEnvironment();
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_BUILD_SHA,
      // Sampled rather than exhaustive: traces are for spotting slow paths, not
      // for billing us on every health check.
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
      // Bodies can carry user queries and affiliate identifiers.
      sendDefaultPii: false,
    });
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
