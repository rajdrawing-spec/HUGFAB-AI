import type { MetadataRoute } from 'next';

import { absoluteUrl, SITE_URL } from '@/lib/site-url';

/**
 * robots.txt, generated from the canonical origin.
 *
 * What is disallowed, and why:
 *
 *   /api/      — JSON endpoints. Nothing there is a page, and /api/affiliate/click
 *                is a redirect that writes an attribution row; a crawler walking
 *                it would manufacture click-outs that never happened.
 *   /auth/     — the OAuth callback. Single-use codes, never a landing page.
 *   /settings  — signed-in only; a crawler gets a redirect and nothing else.
 *   /search?   — result pages are near-duplicate and effectively infinite. The
 *                bare /search page is crawlable so the feature is discoverable;
 *                the query permutations behind it are not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/settings', '/search?'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
