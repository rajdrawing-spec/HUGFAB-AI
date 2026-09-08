/**
 * Custom `next/image` loader — keeps image handling off Vercel's pipeline
 * (PRD §36) and ready for Cloudflare resizing once DNS is in place.
 *
 * Retailer images are hotlinked or CDN-proxied per feed terms, never copied
 * (PRD §32, §74), so remote URLs pass through untouched unless Cloudflare is
 * fronting the domain.
 */

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

const CLOUDFLARE_RESIZE_PREFIX = '/cdn-cgi/image';

function isCloudflareEnabled(): boolean {
  // Flipped on once the domain is proxied through Cloudflare; until then the
  // loader is a pass-through so local and VPS-only deploys still render.
  return process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES === 'true';
}

export default function hugfabImageLoader({ src, width, quality }: LoaderArgs): string {
  if (!isCloudflareEnabled()) {
    return src;
  }

  const params = [
    `width=${width}`,
    `quality=${quality ?? 75}`,
    'format=auto',
    'fit=scale-down',
  ];

  // Cloudflare's resizing endpoint takes the origin URL as its final segment.
  return `${CLOUDFLARE_RESIZE_PREFIX}/${params.join(',')}/${src}`;
}
