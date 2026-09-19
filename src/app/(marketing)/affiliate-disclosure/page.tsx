import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, LEGAL_UPDATED } from '../company';
import { LegalItem, LegalList, LegalPage, LegalSection, MailTo } from '../legal-ui';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description:
    'How HugFab is paid, what an affiliate link is, what it does and does not change, and the current status of our retailer relationships.',
  alternates: { canonical: '/affiliate-disclosure' },
};

/**
 * Affiliate Disclosure.
 *
 * The disclosure already appears in the footer, on every comparison table and
 * inside both the Privacy Policy and the Terms. This page exists because an
 * affiliate network's review looks for a dedicated, linkable statement, and
 * because "how do you make money" deserves a whole answer rather than a line
 * of small print at the bottom of something else.
 *
 * Section 4 is the one most sites would leave out. We are not yet approved by
 * any affiliate network, no affiliate link on this site is live, and saying so
 * is both the honest position and the one that does not have to be quietly
 * retracted later.
 */
export default function AffiliateDisclosurePage() {
  return (
    <LegalPage
      title="Affiliate Disclosure"
      updated={LEGAL_UPDATED}
      intro="HugFab is free to use and makes no money from you. This explains who does pay
        us, what that changes, and — just as importantly — what it does not."
    >
      <LegalSection n={1} title="The short version">
        <p>
          When you follow a link from HugFab to a retailer and buy something, that
          retailer may pay us a commission. You pay the same price you would have paid
          going to them directly. That is the whole business model, and it is the only way
          this site earns anything.
        </p>
      </LegalSection>

      <LegalSection n={2} title="What an affiliate link actually is">
        <p>
          It is an ordinary link with a tag on it that tells the retailer we sent you.
          When you follow one you may pass through an affiliate network&rsquo;s redirect
          on the way, which is how the sale gets credited.
        </p>
        <p>
          That network and the retailer may set cookies or identifiers of their own in the
          process. We do not control them and cannot read them. What we record on our side
          is described in the{' '}
          <Link className="text-primary font-medium hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          , section 2.
        </p>
      </LegalSection>

      <LegalSection n={3} title="What it does not change">
        <LegalList>
          <LegalItem term="Not your price">
            A commission is paid by the retailer out of their margin. It is never added to
            what you pay, and we never mark a price up.
          </LegalItem>
          <LegalItem term="Not the ranking">
            Offers are sorted by price and availability. A retailer paying more does not
            move up, and one paying nothing does not move down or get left out. An
            out-of-stock offer sinks below every available one however cheap it is.
          </LegalItem>
          <LegalItem term="Not what gets listed">
            No retailer can pay to appear, to be featured, or to have a competitor
            removed.
          </LegalItem>
          <LegalItem term="Not the words">
            We do not write paid reviews or sponsored product descriptions, and no
            retailer sees this site before you do.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection n={4} title="Where we actually stand today">
        <p>
          <b className="text-text">No affiliate link on this site is live.</b> Our
          application to an affiliate network is still under review, no advertiser has
          approved us, and no commission has ever been earned or paid.
        </p>
        <p>
          The products you can browse right now are a clearly labelled demo catalogue at
          invented stores, put there so the search, filtering and price comparison can be
          used and judged before real feeds arrive. They carry no outbound links at all —
          the &ldquo;Demo only&rdquo; control on a comparison table is not a disabled
          affiliate link, it is the absence of one.
        </p>
        <p>
          When that changes, this page changes with it, and the disclosure above starts
          applying to real links rather than describing how they will work.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Where you will see this disclosed">
        <p>
          On every page carrying an outbound retailer link, directly beneath the
          comparison table; in the footer of every page on the site; in the{' '}
          <Link className="text-primary font-medium hover:underline" href="/privacy">
            Privacy Policy
          </Link>{' '}
          and the{' '}
          <Link className="text-primary font-medium hover:underline" href="/terms">
            Terms of Use
          </Link>
          ; and here.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Questions">
        <p>
          {COMPANY.legalName} operates HugFab. If anything above is unclear, or you think
          an ordering looks wrong, write to <MailTo /> and say so — a comparison people
          cannot check is not worth much.
        </p>
      </LegalSection>

      <div className="border-border mt-12 flex flex-wrap items-center gap-4 border-t pt-8">
        <Link
          href="/how-it-works"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          How it works
        </Link>
        <Link
          href="/privacy"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Privacy Policy
        </Link>
      </div>
    </LegalPage>
  );
}
