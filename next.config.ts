import type { NextConfig } from 'next';

/**
 * Nothing here may depend on Vercel-only behaviour (PRD §36).
 * `standalone` produces a self-contained server bundle that PM2 runs on the
 * Hostinger VPS; the custom image loader keeps us off Vercel's image pipeline.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Swapped for a Cloudflare resizing loader once the domain is on Cloudflare
    // (docs/architecture.md §2.4). Until then this is a pass-through.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    // Retailer images are hotlinked or CDN-proxied per feed terms, never copied
    // (PRD §32, §74). Hosts are added here as each affiliate feed is approved.
    remotePatterns: [],
  },

  eslint: {
    // CI runs `npm run lint` as its own blocking step; running it again inside
    // `next build` would only duplicate the work.
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Never true. A type error must fail the build (PRD §62).
    ignoreBuildErrors: false,
  },

  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.GITHUB_SHA ?? 'dev',
  },
};

export default nextConfig;
