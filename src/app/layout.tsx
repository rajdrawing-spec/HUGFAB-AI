import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import { AnalyticsProvider, BottomNavigation, Footer, Header } from '@/components/layout';
import { ToastProvider } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { SITE_URL } from '@/lib/site-url';
import '@/styles/globals.css';

/**
 * Poppins is the guide's typeface. next/font self-hosts it at build time, so
 * there is no request to fonts.googleapis.com at runtime — which keeps the CSP
 * tight and removes a third-party dependency from first paint.
 */
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

  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>
          <a
            href="#main"
            className="skip-link bg-primary text-primary-foreground rounded-md px-3 py-2"
          >
            Skip to content
          </a>

          <Header userEmail={user?.email ?? null} />

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
