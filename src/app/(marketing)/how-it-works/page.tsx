import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Where HugFab gets its prices, how it decides that two listings are the same product, what "best price" means, and how HugFab is paid.',
  alternates: { canonical: '/how-it-works' },
};

/**
 * How it works — the mechanics, in the order a sceptical shopper asks them.
 *
 * Where do the prices come from, how do you know it is the same product, what
 * does "best price" mean, and what is in it for you. The fourth question is
 * the one most comparison sites answer last or not at all, which is precisely
 * why it is worth answering plainly.
 *
 * The identity-matching section describes the real behaviour of
 * `find_product_matches` and `identity.ts` — the thresholds quoted are the
 * ones in the code. If those change, this page changes with them; a page that
 * describes a mechanism the software no longer has is worse than no page.
 */
export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-h1 text-balance">How HugFab works</h1>

      <p className="text-body-lg text-muted mt-5">
        Four questions worth asking of any price-comparison site, answered for
        this one.
      </p>

      <Step n={1} title="Where the prices come from">
        <p>
          Retailers publish product feeds — machine-readable lists of what they
          stock, at what price, in what sizes, and whether it is available. We
          read those feeds on a schedule and store what they say.
        </p>
        <p>
          We do not set prices, negotiate them, or adjust them. If a retailer
          raises a price, the figure here changes when their feed does. If our
          copy is stale, the retailer&rsquo;s own page is always the authority
          — which is why the buy button sends you there rather than trying to
          sell you anything here.
        </p>
      </Step>

      <Step n={2} title="How we know it is the same product">
        <p>
          This is the hard part, and the part that decides whether a comparison
          is worth anything. Two shops describe one jacket in two different
          ways, with two different titles and two different internal codes.
          Getting it wrong means either showing the same jacket twice, or
          pricing one shop&rsquo;s item with another shop&rsquo;s number.
        </p>
        <p>So we work from strongest evidence to weakest:</p>
        <ul className="text-small flex list-none flex-col gap-3 p-0">
          <Tier label="Barcodes">
            A GTIN, EAN, UPC or ISBN identifies a specific manufactured item.
            All of them normalise to one form and the check digit is verified,
            so one shop&rsquo;s UPC and another&rsquo;s EAN for the same item
            compare equal. A barcode whose check digit does not add up is
            discarded rather than trusted — feeds put internal codes in columns
            labelled &ldquo;EAN&rdquo; constantly.
          </Tier>
          <Tier label="Brand plus a manufacturer code">
            Weaker, but reliable enough to merge when the brand agrees too.
          </Tier>
          <Tier label="Everything else">
            Matching attributes, or titles that merely resemble each other, are
            never enough on their own. Those pairs go to a review queue for a
            person to decide.
          </Tier>
        </ul>
        <p>
          The threshold for merging automatically is deliberately out of reach
          for that last group — not as a policy someone has to remember, but as
          arithmetic: those scores are capped below the merge threshold by
          construction. Two products left temporarily separate is a small
          annoyance. Two unrelated products merged is a wrong price shown to a
          shopper, which is not.
        </p>
      </Step>

      <Step n={3} title="What “best price” means">
        <p>
          The cheapest offer you can actually buy. Out-of-stock offers sink
          below every available one regardless of price, because a price you
          cannot pay is not a competitive price.
        </p>
        <p>
          Where a retailer supplies both a current and a previous price, the
          discount shown is calculated from those two figures — never supplied
          to us as a claim. Where they supply no previous price, no discount is
          shown, rather than a discount of zero dressed up as a saving.
        </p>
      </Step>

      <Step n={4} title="How HugFab is paid">
        <p>
          When you go to a retailer through a link here and buy something, that
          retailer may pay HugFab a commission. That is the entire business
          model.
        </p>
        <p>
          It does not change your price, and it does not change the ordering:
          offers are sorted by what they cost and whether they are in stock,
          not by what they pay us. Every page with an outbound retailer link
          carries this disclosure, and so does the footer of every page on the
          site.
        </p>
      </Step>

      <div className="border-border bg-surface-2 mt-14 rounded-xl border p-6">
        <h2 className="text-h3">Why the catalogue is empty right now</h2>
        <p className="text-body text-muted mt-3">
          Everything above is built. What is missing is step one: the retailer
          feeds are still being arranged, so there is nothing yet to compare.
          Search works — it will simply find nothing until products are
          connected. We would rather show you that honestly than fill the page
          with items that do not exist.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/search"
            className="text-button bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center rounded-full px-6 font-semibold transition-colors"
          >
            Try a search
          </Link>
          <Link
            href="/about"
            className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
          >
            About HugFab
          </Link>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border mt-12 border-t pt-8">
      {/*
        Numbered because these genuinely are a sequence — a price has to be
        read from a feed before two listings can be compared, and compared
        before one can be called cheapest. Decoration would be the numbers
        without that being true.
      */}
      <p className="text-caption text-primary font-semibold tracking-widest">
        STEP {n}
      </p>
      <h2 className="text-h2 mt-1">{title}</h2>
      <div className="text-body text-muted mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Tier({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="border-border-strong border-l-2 pl-4">
      <b className="text-text block font-semibold">{label}</b>
      <span>{children}</span>
    </li>
  );
}
