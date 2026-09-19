import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Caveat, Poppins } from 'next/font/google';
import {
  AnalyticsProvider,
  BottomNavigation,
  DemoNotice,
  Footer,
  Header,
} from '@/components/layout';
import { ToastProvider } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { demoCatalogueEnabled } from '@/modules/products/repository';
import { SITE_URL } from '@/lib/site-url';
import '@/styles/globals.css';

/**
 * Poppins is the guide's typeface. next/font self-hosts it at build time, so
 * there is no request to fonts.googleapis.com at runtime — which keeps the CSP
 * tight and removes a third-party dependency from first paint.
 */
/**
 * The concept's handwritten accent for editorial asides — "Fashion made simple
 * with AI" (docs/ui-ux-guide.md §7). Its remit is deliberately narrow:
 * marketing surfaces only, never in product UI, never in a control, never for
 * anything a user must read to finish a task.
 *
 * The guide holds it back until there is "a `--font-script` token and a
 * licensed face". Both now exist: Caveat is SIL Open Font License, and
 * next/font self-hosts it at build time like Poppins, so there is still no
 * runtime request to a font CDN and the CSP stays tight.
 */
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-caveat',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const DESCRIPTION =
  'AI-powered fashion discovery. Your style, every store, one place — compare ' +
  'prices across retailers, discover looks, and shop smarter.';

/**
 * `metadataBase` is the single origin every relative URL in the tree resolves
 * against — canonical links, Open Graph URLs, image URLs. It comes from
 * `SITE_URL`, which is the one place the canonical origin is defined, so a page
 * cannot advertise a different hostname from the one in the sitemap.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HugFab — See it. Style it. Shop it.',
    template: '%s · HugFab',
  },
  description: DESCRIPTION,
  applicationName: 'HugFab',
  robots: { index: true, follow: true },
  // No canonical here. A layout-level default is inherited by every page that
  // does not set its own, which makes /login and /settings each declare
  // themselves the canonical version of the homepage. `metadataBase` above
  // already pins the host for the whole tree; the path is each page's business.
  openGraph: {
    type: 'website',
    siteName: 'HugFab',
    locale: 'en_IN',
    url: SITE_URL,
    title: 'HugFab — See it. Style it. Shop it.',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HugFab — See it. Style it. Shop it.',
    description: DESCRIPTION,
  },
  /**
   * Site-ownership proof for Mitgo, Admitad's parent, which is how a publisher
   * account verifies it controls the domain it has registered. Admitad reads
   * this tag from the live homepage when "Verify" is pressed, so it has to be
   * deployed before that — not after.
   *
   * Committed rather than held in an environment variable on purpose. The
   * value is public by design: it is served to every visitor in the page head,
   * and it proves nothing on its own — anyone reading it already had the HTML.
   * It is not a credential, and the credentials it sits near (the OAuth client
   * secret, the postback key) must never follow it into the repository.
   *
   * Delete it once Admitad reports the domain verified; a verification tag
   * outlives its purpose and then just sits in every page forever.
   */
  verification: {
    other: {
      // Reissued on each submission of the ad space for approval — this is the
      // fourth. Always replaced, never added alongside the previous one: two
      // meta tags sharing a name leave the reader to pick, and a verifier that
      // takes the first would check a stale value and fail.
      'mitgo-verification': '8e67b215-9995-4ede-b34b-be0b0b28fc5a',
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const demoCatalogue = await demoCatalogueEnabled();

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>
          <a
            href="#main"
            className="skip-link bg-primary text-primary-foreground rounded-md px-3 py-2"
          >
            Skip to content
          </a>

          <Header userEmail={user?.email ?? null} />

          {/*
            Under the header rather than above it, so it does not push the
            brand and search off the top of a phone screen, and resolved in
            the layout so it is part of the first paint rather than appearing a
            moment after the page settles.
          */}
          <DemoNotice enabled={demoCatalogue} />

          {/* pb-16 clears the mobile bottom bar; md:pb-0 once it is hidden. */}
          <main id="main" className="flex-1 pb-16 md:pb-0">
            {children}
          </main>

          <Footer />
          <BottomNavigation />

          {/* useSearchParams() needs a boundary or the whole tree opts out of prerendering. */}
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
