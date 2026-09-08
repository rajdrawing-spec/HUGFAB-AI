import { parseClientEnv, type ClientEnv } from './env.schema';

/**
 * Public environment. Safe to import from anywhere.
 *
 * Each variable is referenced by its literal name because Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time by textual substitution —
 * `process.env[name]` would silently become `undefined` in the browser bundle.
 */
const raw = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
};

/**
 * Parsed leniently on purpose. Shape and format are still enforced — a malformed
 * site URL or currency code throws — but a *missing* integration key does not.
 *
 * A browser cannot fix a missing key, and throwing here would replace the page
 * with a blank screen. Whether the deployment is adequately configured is the
 * server's question, answered by `assertServerEnvironment()` at boot.
 */
export const clientEnv: ClientEnv = parseClientEnv(raw, 'development');
