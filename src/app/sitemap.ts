import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site-url';
import { listIndexableProducts } from '@/modules/products/repository';

/**
 * The sitemap, built from the canonical origin and the live catalogue.
 *
 * Only pages worth indexing are here. Sign-in, sign-up, settings and search
 * result permutations are deliberately absent: the first three are not content
 * and the last is effectively infinite and near-duplicate, which spends crawl
 * budget without earning anything.
 *
 * Dynamic rather than baked at build time. The catalogue changes on every feed
 * import, and a sitemap frozen at deploy would describe whatever was in the
 * database the day the release was cut.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      // The search page itself, not its results.
      url: absoluteUrl('/search'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.5,
    },
  ];

  const products = await listIndexableProducts();

  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      // Prices move on every import; the page a shopper sees changes with them.
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
