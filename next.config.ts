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
    /**
     * Surfaced by /api/health, so the live commit is knowable without SSH, and
     * compared against the deployed SHA by the deploy job's health check.
     *
     * The explicit variable wins over GITHUB_SHA on purpose: when rolling back
     * through workflow_dispatch, GITHUB_SHA is the workflow's own ref rather
     * than the commit being deployed. Reading it first would make the health
     * check reject a good rollback and roll it straight back again.
     */
    NEXT_PUBLIC_BUILD_SHA:
      process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.GITHUB_SHA ?? 'dev',
  },
};

export default nextConfig;
