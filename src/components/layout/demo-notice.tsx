import Link from 'next/link';

/**
 * The standing explanation of what a visitor is looking at.
 *
 * While affiliate approval is pending the catalogue is a labelled sample, and
 * that fact has to be stated once, prominently, on every page — not only on
 * the product card badges, which a visitor may meet after they have already
 * formed an impression of the site.
 *
 * It renders only when the demo catalogue is actually switched on, and the
 * switch is the same `app_settings` row RLS consults. So the day a real feed
 * replaces the samples, this disappears on its own: there is no second thing
 * to remember to turn off, and no window where the site shows real prices
 * under a banner calling them illustrative.
 *
 * The flag arrives as a prop rather than being read here. Components in this
 * directory are presentational and may not reach into the data layer
 * (docs/architecture.md §2.2); the layout does the lookup.
 *
 * Deliberately not dismissible. A notice a shopper can close is a notice that
 * is absent for most of their visit, and this one qualifies the price of every
 * item they are about to look at.
 */
export function DemoNotice({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div className="border-warning/30 bg-warning-soft border-b">
      <p className="text-small text-warning mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        <span className="font-semibold">Demo catalogue.</span>{' '}
        <span className="text-warning/90">
          Retailer and affiliate connections are still being set up, so the products and
          prices below are illustrative samples at invented stores — not live offers, and
          not for sale. Real prices and availability will change once feeds are connected.{' '}
          <Link href="/about" className="underline underline-offset-2">
            Why
          </Link>
          .
        </span>
      </p>
    </div>
  );
}
