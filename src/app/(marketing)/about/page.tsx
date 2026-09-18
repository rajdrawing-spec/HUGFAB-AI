import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description:
    'HugFab compares fashion prices across retailers so one product shows every shop selling it, at the price that shop actually charges.',
  alternates: { canonical: '/about' },
};

/**
 * About — what HugFab is, and where it honestly stands today.
 *
 * Every claim here has to survive the same test the homepage claims do: it is
 * true before a single product is ingested (PRD §69). So there are no retailer
 * counts, no product totals, no traffic figures and no founding narrative —
 * numbers on a company page are promises, and an empty catalogue cannot keep
 * them.
 *
 * The "Where we are today" section exists because the alternative is worse.
 * A visitor who finds an empty catalogue and no explanation assumes the site
 * is broken; one who is told plainly that retailer feeds are still being
 * connected has simply arrived early. The same reasoning as the empty state
 * on the homepage, at a slower reading pace.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-h1 text-balance">Every store, one page</h1>

      <p className="text-body-lg text-muted mt-5">
        HugFab is a fashion price-comparison service for shoppers in India. One
        product, every retailer selling it, and the price each of them is
        actually charging — so the choice is yours to make rather than the
        first shop&rsquo;s to win.
      </p>

      <Section title="What it does">
        <p>
          Search for something you want. HugFab shows the product once, with
          every retailer that stocks it listed underneath, cheapest available
          first. Pick a shop and you go to that shop to buy, at their price, on
          their site.
        </p>
        <p>
          We are not a store. Nothing is sold here, no cart, no checkout. What
          we do is the part that is tedious to do by hand: finding that the
          jacket on one site and the jacket on another are the same jacket, and
          putting their prices next to each other.
        </p>
      </Section>

      <Section title="What we hold ourselves to">
        <ul className="flex list-none flex-col gap-4 p-0">
          <Rule title="The price is the retailer's price">
            Every figure comes from the retailer&rsquo;s own feed. We never mark
            a price up, and we never take a cut from what you pay.
          </Rule>
          <Rule title="The best price is stated, not implied">
            The cheapest offer is labelled. An offer nobody can actually buy
            because it is out of stock never counts as the best price, however
            low it is.
          </Rule>
          <Rule title="Nothing appears that is not real">
            We would rather show an empty page than invented products, invented
            discounts, or a rating with no data behind it. That rule is the
            reason parts of this site are currently empty.
          </Rule>
          <Rule title="We say how we are paid">
            Some retailer links earn HugFab a commission. It costs you nothing
            and changes no price, and it is disclosed on every page carrying
            such a link — including the bottom of this one.
          </Rule>
        </ul>
      </Section>

      <Section title="Where we are today">
        <p>
          HugFab is new and openly under construction. The search, the product
          pages and the price comparison are built and working. The catalogue
          behind them is not yet filled: we are in the process of arranging
          product feeds with retailers, and until those are connected there are
          no products to show.
        </p>
        <p>
          We could fill the gap with placeholder items. We have chosen not to.
          A shopper who is shown a price we cannot stand behind has been misled,
          and no amount of looking busy is worth that.
        </p>
      </Section>

      <Section title="What comes next">
        <p>
          Once retailer feeds are connected, the first thing to arrive is the
          catalogue itself — real products, real prices, updated on a schedule.
        </p>
        <p>
          Beyond that we are building price history and alerts, and styling
          tools that help you find things you would not have searched for.
          Those are in development and are deliberately not shown on the site
          until they work.
        </p>
      </Section>

      <div className="border-border mt-14 flex flex-wrap items-center gap-4 border-t pt-8">
        <Link
          href="/how-it-works"
          className="text-button bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center rounded-full px-6 font-semibold transition-colors"
        >
          How it works
        </Link>
        <Link
          href="/search"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Try a search
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-h2">{title}</h2>
      <div className="text-body text-muted mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-primary border-l-2 pl-4">
      <b className="text-text block font-semibold">{title}</b>
      <span>{children}</span>
    </li>
  );
}
