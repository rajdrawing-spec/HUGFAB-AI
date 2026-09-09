import type { NextConfig } from 'next';

/**
 * Nothing here may depend on Vercel-only behaviour (PRD §36).
 *
 * `output: 'standalone'` is deliberately NOT set. It was, and it was wrong for
 * how this application is actually hosted:
 *
 *   1. Next refuses to run the normal production server when it is set —
 *      "next start does not work with output: standalone" — so `npm start` and
 *      any root startup file stop working. A host configured with an
 *      Application Root and a Startup File has nothing valid to point at.
 *   2. The bundle it emits is incomplete. `.next/static` and `public/` are left
 *      out and must be copied in by a separate step. Miss it and the site
 *      returns HTML while every stylesheet and script 404s — a failure that
 *      looks like a CSS bug rather than a deployment one.
 *   3. It bakes absolute build-machine paths into the runtime config blob
 *      (`loaderFile`, `outputFileTracingRoot`, `turbopack.root`), so the
 *      artefact carries the layout of whatever machine built it.
 *
 * Standalone earns its keep in a container, where the image is the unit of
 * deployment. Here the host installs dependencies at the application root and
 * runs one entry file, so the ordinary server is both simpler and correct.
 * See index.js and docs/deployment.md.
 */
const nextConfig: NextConfig = {
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
