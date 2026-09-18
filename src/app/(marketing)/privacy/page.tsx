import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalItem, LegalList, LegalPage, LegalSection } from '../legal-ui';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What HugFab collects, what it does not collect, how affiliate links work, and how to reach us about your data.',
  alternates: { canonical: '/privacy' },
};

const UPDATED = '18 September 2026';

/**
 * Privacy Policy.
 *
 * Every factual claim here was checked against the code and the production
 * environment before it was written, because a privacy policy that describes
 * tracking the site does not do is as much a lie as one that hides tracking it
 * does. In particular: no analytics or error-reporting key is configured on the
 * production server, so neither PostHog nor Sentry is loaded or sent anything,
 * and `CLICK_IP_SALT` is unset, so no IP hash is written on a click-out.
 *
 * If any of those change, this page changes in the same commit. That is not a
 * nicety — section 4 makes a promise about it.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro="This explains what HugFab collects, what it deliberately does not, and what
        happens to your information when you click through to a retailer. It describes the
        site as it actually runs today, not as it might run later."
    >
      <LegalSection n={1} title="Who we are">
        <p>
          HugFab is operated by <b className="text-text">tapashub Pvt Ltd</b>, a private
          limited company incorporated in India, with its registered office at Manikonda,
          Hyderabad, Telangana, India.
        </p>
        <p>
          This policy applies to <b className="text-text">hugfab.com</b> and nothing else.
          Once you leave for a retailer&rsquo;s site, that retailer&rsquo;s policy governs
          what happens there.
        </p>
        <p>
          For anything in this document, write to{' '}
          <a
            className="text-primary font-medium hover:underline"
            href="mailto:contact@hugfab.com"
          >
            contact@hugfab.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection n={2} title="What we collect">
        <LegalList>
          <LegalItem term="Nothing, if you only browse">
            Searching, viewing a product and comparing prices require no account and
            create no record tied to you.
          </LegalItem>
          <LegalItem term="Account details, only if you create an account">
            Your email address, and a password that is handled by our authentication
            provider — we never receive or store it in readable form. If you sign in with
            Google instead, we receive the name, email address and profile picture Google
            releases to us. We store a display name, a profile picture address, and your
            language and currency preference.
          </LegalItem>
          <LegalItem term="What you save">
            Items you add to a wishlist, any note you attach, and any price you ask to be
            alerted below.
          </LegalItem>
          <LegalItem term="A record of clicks out to retailers">
            When you follow a link to a retailer we record which product and retailer, the
            time, the page you came from, and — if you are signed in — your account. This
            is how a commission is attributed to us and how we detect fraudulent clicking.
            See section 5 for what we do <i>not</i> record here.
          </LegalItem>
          <LegalItem term="Ordinary server logs">
            Our hosting provider keeps standard web server logs, which include IP
            addresses, for security and diagnostics.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection n={3} title="Why we hold it">
        <p>
          To give you an account and keep you signed in; to show you the things you saved;
          to attribute commissions and detect click fraud; to keep the service running and
          secure; and to answer you when you contact us. We do not build advertising
          profiles and we have no advertising business.
        </p>
        <p>
          We do not sell your personal data. We do not share it with advertisers or data
          brokers.
        </p>
      </LegalSection>

      <LegalSection n={4} title="What we do not collect">
        <p>
          This section is specific on purpose, because &ldquo;we may use analytics
          partners&rdquo; is how most policies avoid answering it.
        </p>
        <LegalList>
          <LegalItem term="No advertising or tracking pixels">
            There is no Google Analytics, no Google Tag Manager, no Meta or Facebook
            pixel, and no advertising, retargeting or session-recording script anywhere on
            this site.
          </LegalItem>
          <LegalItem term="No product analytics currently running">
            The site can be configured to use PostHog for product analytics. It is not
            configured on hugfab.com: with no key set, the browser never downloads it and
            nothing is sent. The same is true of Sentry, which the site can use for error
            reports and which is likewise switched off.
          </LegalItem>
          <LegalItem term="No IP address stored against your clicks">
            The click record described in section 2 has a field for a hashed IP address.
            The secret needed to produce that hash is deliberately not configured, and
            without it nothing at all is written to that field — not the address, not a
            hash of it.
          </LegalItem>
        </LegalList>
        <p>
          If we ever switch any of these on, we will update this page and this date{' '}
          <b className="text-text">before</b> it goes live, not after.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Cookies">
        <p>
          We use strictly necessary cookies only. They are set by our authentication
          provider to keep you signed in and to protect the sign-in process. If you never
          create an account, they are never set.
        </p>
        <p>
          There is no consent banner because there is nothing to consent to: no analytics,
          advertising or third-party tracking cookie is set by this site. If that changes,
          a consent mechanism will arrive in the same change.
        </p>
        <p>
          Retailers and affiliate networks set their own cookies once you are on their
          side of a click — see the next section.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Affiliate links">
        <p>
          Some links from HugFab to a retailer are affiliate links. If you buy something
          after following one, the retailer may pay us a commission. It costs you nothing
          and it does not change the price you pay, and it does not affect the order
          offers are shown in — offers are sorted by price and availability, never by what
          they pay us.
        </p>
        <p>
          Following such a link may route you through an affiliate network&rsquo;s
          redirect. That network and the retailer may set cookies or identifiers of their
          own in order to credit the sale. We do not control those and cannot see them;
          their privacy policies apply from the moment you leave this site.
        </p>
        <p>On our side, all that is recorded is the click described in section 2.</p>
      </LegalSection>

      <LegalSection n={7} title="Who processes data for us">
        <LegalList>
          <LegalItem term="Supabase">
            Database and authentication — account records, wishlists and click records.
          </LegalItem>
          <LegalItem term="Hostinger">
            Website hosting, and the server logs mentioned in section 2.
          </LegalItem>
          <LegalItem term="Zoho">Email, if you write to us.</LegalItem>
          <LegalItem term="Google">
            Only if you choose to sign in with Google, and only for that sign-in.
          </LegalItem>
        </LegalList>
        <p>
          Each is used for the purpose named and nothing else. Some of them operate
          servers outside India, which means your information may be processed outside
          India.
        </p>
      </LegalSection>

      <LegalSection n={8} title="How long we keep it">
        <p>
          Account details and wishlists are kept for as long as your account exists. Click
          records are kept as a financial and anti-fraud record. Ask us to delete your
          account and we will delete your account details and wishlists.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Your rights">
        <p>
          Under India&rsquo;s Digital Personal Data Protection Act, 2023 you may ask us
          for a summary of the personal data we hold about you and what we do with it, ask
          us to correct or complete it, ask us to erase it, withdraw a consent you gave
          us, and nominate someone to exercise these rights if you die or become
          incapacitated.
        </p>
        <p>
          There is no self-service delete button in your account settings yet. Until there
          is, email{' '}
          <a
            className="text-primary font-medium hover:underline"
            href="mailto:contact@hugfab.com"
          >
            contact@hugfab.com
          </a>{' '}
          from the address on the account and we will act on it. We would rather say that
          plainly than point you at a button that does not exist.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Children">
        <p>
          HugFab is not directed at children and we do not knowingly collect personal data
          from anyone under 18. If you believe a child has given us personal data, write
          to us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Security">
        <p>
          Access to stored data is governed by row-level security rules in the database,
          so one account cannot read another&rsquo;s wishlist. The site is served over
          HTTPS only. No system is perfectly secure, and we do not claim otherwise.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Changes">
        <p>
          When this policy changes, the date at the top changes with it. Changes that
          affect what we collect will be made before the collection starts, not
          afterwards.
        </p>
      </LegalSection>

      <div className="border-border mt-12 flex flex-wrap items-center gap-4 border-t pt-8">
        <Link
          href="/terms"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Terms of Use
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
