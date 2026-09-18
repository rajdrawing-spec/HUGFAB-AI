import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalItem, LegalList, LegalPage, LegalSection } from '../legal-ui';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'The terms on which HugFab is offered: what the service is, what it is not, how prices are sourced, and how affiliate commissions work.',
  alternates: { canonical: '/terms' },
};

const UPDATED = '18 September 2026';

/**
 * Terms of Use.
 *
 * The important clause is section 2. HugFab is not a shop: it takes no payment,
 * holds no stock and is not a party to the sale. Anything that blurs that would
 * mislead a shopper about who owes them a refund, so it is stated first and
 * stated plainly rather than buried under a liability clause.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated={UPDATED}
      intro="These terms govern your use of hugfab.com. They are written to be read, so the
        things that actually matter — that we are not the seller, and that prices come from
        the retailer — are near the top rather than buried."
    >
      <LegalSection n={1} title="Who these terms are with">
        <p>
          hugfab.com is operated by <b className="text-text">tapashub Pvt Ltd</b>, a
          private limited company incorporated in India, with its registered office at
          Manikonda, Hyderabad, Telangana, India. In these terms &ldquo;we&rdquo;,
          &ldquo;us&rdquo; and &ldquo;HugFab&rdquo; mean that company, and
          &ldquo;you&rdquo; means the person using the site.
        </p>
        <p>
          By using the site you accept these terms. If you do not accept them, do not use
          it.
        </p>
      </LegalSection>

      <LegalSection n={2} title="What HugFab is — and is not">
        <p>
          HugFab is a price-comparison and product-discovery service. It shows a product
          once, lists the retailers selling it, and sends you to the retailer to buy.
        </p>
        <p>
          <b className="text-text">We are not a shop.</b> There is no cart and no checkout
          here. We hold no stock, take no payment, ship nothing, and are not a party to
          any contract of sale. When you buy, the contract is between you and the
          retailer, on their terms. Delivery, returns, refunds, warranty and customer
          service are theirs, and any complaint about a purchase must go to them.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Prices, availability and product information">
        <p>
          Prices, stock, images and descriptions come from retailers&rsquo; own product
          feeds. We copy what those feeds say; we do not set prices and we do not verify
          each listing by hand.
        </p>
        <LegalList>
          <LegalItem term="Nothing here is an offer to sell">
            A price shown on HugFab is information about a retailer&rsquo;s listing, not
            an offer we are capable of honouring.
          </LegalItem>
          <LegalItem term="Figures can be out of date">
            A feed is read on a schedule, so a price may have changed since. The
            retailer&rsquo;s own page is always the authority, and it is the price at
            checkout there that you will actually pay.
          </LegalItem>
          <LegalItem term="Matching can be imperfect">
            We work hard to establish that two listings are the same product, and we hold
            uncertain matches back for human review rather than merging them. It is still
            possible for a listing to be wrong. Tell us and we will fix it.
          </LegalItem>
        </LegalList>
        <p>
          The catalogue is also incomplete by design at this stage: retailer feeds are
          still being connected, and a product missing from HugFab does not mean nobody
          sells it.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Affiliate links and how we are paid">
        <p>
          Some outbound links are affiliate links, and a retailer may pay us a commission
          when you buy after following one. This is how HugFab is funded.
        </p>
        <p>
          It does not change your price, and it does not change what we show you: offers
          are ordered by price and availability, not by commission. This is disclosed on
          every page carrying such a link and in the footer of the site.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Your account">
        <p>
          You may browse without an account. To create one you must be at least 18 and
          capable of entering a contract under the Indian Contract Act, 1872.
        </p>
        <p>
          Keep your password to yourself; activity under your account is your
          responsibility. Give accurate details, and tell us if you think someone else has
          access. We may suspend or close an account that is used to break these terms.
        </p>
      </LegalSection>

      <LegalSection n={6} title="What you may not do">
        <LegalList>
          <LegalItem term="No bulk or automated extraction">
            Do not scrape, crawl, harvest or systematically copy the catalogue, prices or
            any other part of the site, by any automated means, without our written
            permission.
          </LegalItem>
          <LegalItem term="No interference">
            Do not work around rate limits or access controls, probe or disrupt the
            service, or attempt to gain access to any account, system or data that is not
            yours.
          </LegalItem>
          <LegalItem term="No misuse of the affiliate path">
            Do not generate clicks or traffic intended to create commission that does not
            reflect a genuine shopper.
          </LegalItem>
          <LegalItem term="No unlawful or infringing use">
            Do not use the site to break the law, infringe anyone&rsquo;s rights, or post
            anything unlawful where the site allows you to submit content.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection n={7} title="Intellectual property">
        <p>
          The site, its design, its text and its software are ours or our
          licensors&rsquo;, and are protected by law. These terms give you permission to
          use the site, and nothing more.
        </p>
        <p>
          Brand names, product names, product images and trade marks belong to their
          respective owners. They appear here to identify products and retailers, which is
          the whole point of a comparison service, and their appearance implies no
          endorsement of HugFab.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Other people's sites">
        <p>
          HugFab links to retailers and other third parties. We do not control them, do
          not endorse them by linking, and are not responsible for their content, their
          products, their prices or their handling of your data. Once you follow a link,
          their terms and their privacy policy apply.
        </p>
      </LegalSection>

      <LegalSection n={9} title="The service is provided as it is">
        <p>
          HugFab is offered on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
          basis. The site is under active development. We do not warrant that it will be
          uninterrupted or error-free, that the catalogue is complete or current, or that
          any price, discount or availability shown is accurate at the moment you read it.
        </p>
        <p>We may change, suspend or withdraw any part of the service, at any time.</p>
      </LegalSection>

      <LegalSection n={10} title="Limitation of liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential
          loss, for loss of profit or opportunity, or for any loss arising from a purchase
          you make from a retailer — including a price that had changed, an item that was
          out of stock, a delivery that failed, or a dispute about a refund. Those are
          matters between you and that retailer.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot lawfully be excluded,
          including liability for fraud.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Privacy">
        <p>
          What we collect, what we deliberately do not collect, and what happens when you
          click through to a retailer are all set out in the{' '}
          <Link className="text-primary font-medium hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          , which forms part of these terms.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Changes to these terms">
        <p>
          We may update these terms. The date at the top shows when they last changed, and
          continuing to use the site after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <div className="border-border mt-12 flex flex-wrap items-center gap-4 border-t pt-8">
        <Link
          href="/privacy"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Privacy Policy
        </Link>
        <Link
          href="/contact"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Contact
        </Link>
      </div>
    </LegalPage>
  );
}
