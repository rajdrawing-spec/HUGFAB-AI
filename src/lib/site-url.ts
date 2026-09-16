import { clientEnv } from './env.client';

/**
 * The canonical origin, and absolute URLs built from it.
 *
 * Every absolute HugFab URL in the application comes from here: canonical
 * links, Open Graph URLs, the sitemap, robots.txt, OAuth redirects and the
 * email-confirmation link Supabase sends. One source, so the site cannot end
 * up advertising two different hostnames for the same page — which is both an
 * SEO problem (duplicate content, split ranking signals) and, when the other
 * hostname has no certificate covering it, a broken sign-up flow.
 *
 * **Build-time, not runtime.** `NEXT_PUBLIC_SITE_URL` is substituted into the
 * browser bundle textually by Next at build time, so changing it in the host's
 * environment does nothing until the application is rebuilt. That is not a
 * detail — it is the reason a wrong value survives a restart and keeps sending
 * users to a certificate warning.
 */

/**
 * No trailing slash, ever.
 *
 * `new URL('/search', 'https://hugfab.com/')` and the un-slashed form agree,
 * but string concatenation does not: one yields `https://hugfab.com//search`.
 * Normalising once here means neither style can produce a wrong link.
 */
export function normaliseOrigin(raw: string): string {
  try {
    const url = new URL(raw);
    // Keep any base path a future deployment might sit under, minus the slash.
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    // env.schema.ts already rejects a malformed URL, so this is unreachable in
    // practice. Trimming the slash is still the right answer if it is not.
    return raw.replace(/\/+$/, '');
  }
}

export const SITE_URL = normaliseOrigin(clientEnv.NEXT_PUBLIC_SITE_URL);

/** The bare hostname, e.g. `hugfab.com`. */
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return SITE_URL;
  }
})();

/**
 * An absolute URL for a path on this site.
 *
 * `absoluteUrl('/products/levis-511')` → `https://hugfab.com/products/levis-511`
 */
export function absoluteUrl(path: string): string {
  if (path === '' || path === '/') return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * The `alternates.canonical` value for a page.
 *
 * Returned as a path rather than an absolute URL on purpose: Next resolves it
 * against `metadataBase`, which is set once in the root layout from `SITE_URL`.
 * Two mechanisms agreeing beats two mechanisms that can disagree.
 */
export function canonicalPath(path: string): string {
  return path === '' ? '/' : path.startsWith('/') ? path : `/${path}`;
}
