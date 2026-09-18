import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, LEGAL_UPDATED } from '../company';
import { LegalItem, LegalList, LegalPage, LegalSection, MailTo } from '../legal-ui';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What HugFab collects, what it does not collect, how affiliate links work, your rights under the DPDP Act, and how to reach our Grievance Officer.',
  alternates: { canonical: '/privacy' },
};

/**
 * Privacy Policy.
 *
 * Structured to the notice obligations in the Digital Personal Data
 * Protection Act, 2023 — what is collected, why, the rights available, the
 * means of exercising them, and who to complain to — rather than to the shape
 * of a generic template. Section 10 exists because the DPDP Act and the
 * Consumer Protection (E-Commerce) Rules, 2020 both require a named grievance
 * contact to be published, not merely offered on request.
 *
 * Every factual claim was checked against the code and the live production
 * environment before it was written, because a privacy policy that describes
 * tracking the site does not do is as much a lie as one that hides tracking it
 * does. Specifically: no analytics or error-reporting key is configured in
 * production, so neither PostHog nor Sentry is loaded or sent anything, and
 * `CLICK_IP_SALT` is unset, so no IP hash is written on a click-out.
 *
 * If any of those change, this page changes in the same commit. Section 4
 * makes that an explicit promise.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro="This explains what HugFab collects, what it deliberately does not, and what
        happens to your information when you click through to a retailer. It describes the
        site as it actually runs today, not as it might run later."
    >
      <LegalSection n={1} title="Who we are">
        <p>
          HugFab, at <b className="text-text">{COMPANY.website}</b>, is operated by{' '}
          <b className="text-text">{COMPANY.legalName}</b>, a private limited company
          incorporated in India. Its registered office is at{' '}
          {COMPANY.addressLines.join(', ')}.
        </p>
        <p>
          In the language of the Digital Personal Data Protection Act, 2023, we are the{' '}
          <i>data fiduciary</i> for the personal data described here, and you are the{' '}
          <i>data principal</i>.
        </p>
        <p>
          This policy applies to this website and nothing else. Once you leave for a
          retailer&rsquo;s site, that retailer&rsquo;s policy governs what happens there.
        </p>
        <p>
          Customer care and privacy questions both go to <MailTo />.
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
            See section 4 for what we do <i>not</i> record here.
          </LegalItem>
          <LegalItem term="Ordinary server logs">
            Our hosting provider keeps standard web server logs, which include IP
            addresses, for security and diagnostics.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection n={3} title="Why we hold it, and on what basis">
        <p>
          To give you an account and keep you signed in; to show you the things you saved;
          to attribute commissions and detect click fraud; to keep the service running and
          secure; and to answer you when you contact us.
        </p>
        <p>
          Account details and wishlists are processed on the consent you give when you
          sign up and save things. Click records and server logs are processed for the
          legitimate operation of the service — attribution of the commission that funds
          it, fraud prevention, and security.
        </p>
        <p>
          We do not build advertising profiles and we have no advertising business. We do
          not sell your personal data, and we do not share it with advertisers or data
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
            configured here: with no key set, the browser never downloads it and nothing
            is sent. The same is true of Sentry, which the site can use for error reports
            and which is likewise switched off.
          </LegalItem>
          <LegalItem term="No IP address stored against your clicks">
            The click record described in section 2 has a field for a hashed IP address.
            The secret needed to produce that hash is deliberately not configured, and
            without it nothing at all is written to that field — not the address, not a
            hash of it.
          </LegalItem>
        </LegalList>
        <p>
          If we ever switch any of these on, we will update this page and the date at the
          top <b className="text-text">before</b> it goes live, not after.
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
      </LegalSection>

      <LegalSection n={6} title="Affiliate links">
        <p>
          Some links from HugFab to a retailer are affiliate links. If you buy something
          after following one, the retailer may pay us a commission. It costs you nothing,
          it does not change the price you pay, and it does not affect the order offers
          are shown in — offers are sorted by price and availability, never by what they
          pay us.
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
          servers outside India, which means your personal data may be processed outside
          India.
        </p>
      </LegalSection>

      <LegalSection n={8} title="How long we keep it">
        <p>
          Account details and wishlists are kept for as long as your account exists, and
          are deleted when you ask us to close it. Click records are kept as a commercial
          and anti-fraud record; where one is linked to an account, that link is severed
          when the account is deleted, leaving a record that identifies nobody.
        </p>
        <p>
          We do not keep personal data for longer than the purpose it was collected for
          requires, except where a law obliges us to retain it.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Your rights, and how to use them">
        <p>Under the Digital Personal Data Protection Act, 2023 you may:</p>
        <LegalList>
          <LegalItem term="Ask what we hold">
            A summary of the personal data we process about you, what we do with it, and
            who we have shared it with.
          </LegalItem>
          <LegalItem term="Correct or complete it">
            Have inaccurate or incomplete data corrected, completed or updated.
          </LegalItem>
          <LegalItem term="Have it erased">
            Ask us to delete personal data we no longer need for the purpose it was
            collected for.
          </LegalItem>
          <LegalItem term="Withdraw consent">
            Withdraw a consent you gave, as easily as you gave it. Doing so does not undo
            processing already carried out.
          </LegalItem>
          <LegalItem term="Nominate someone">
            Name a person to exercise these rights on your behalf if you die or become
            incapable of exercising them.
          </LegalItem>
          <LegalItem term="Complain">
            Raise a grievance with us, and escalate to the Data Protection Board of India
            if we do not resolve it.
          </LegalItem>
        </LegalList>
        <p>
          <b className="text-text">How to make a request.</b> Email <MailTo /> from the
          address on your account — that address is what we use to identify you, and a
          request from another one cannot be honoured without it. Say which of the above
          you want. We will respond within the timeframe in section 10.
        </p>
        <p>
          There is no self-service delete button in your account settings yet. Until there
          is, the mailbox above is the route, and we would rather say so plainly than
          point you at a button that does not exist.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Grievance Officer">
        <p>
          If you are unhappy with how we have handled your personal data or your request,
          write to our Grievance Officer at <MailTo />, with &ldquo;Grievance&rdquo; in
          the subject line.
        </p>
        <p>
          We will acknowledge your complaint within{' '}
          <b className="text-text">{COMPANY.grievanceAcknowledgeHours} hours</b> and
          resolve it within{' '}
          <b className="text-text">{COMPANY.grievanceResolveDays} days</b> of receipt, as
          required by the Consumer Protection (E-Commerce) Rules, 2020.
        </p>
        <p>
          If we do not resolve it to your satisfaction, you may complain to the Data
          Protection Board of India.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Children">
        <p>
          HugFab is not directed at children, and we do not knowingly collect personal
          data from anyone under 18. We do not carry out any tracking, behavioural
          monitoring or targeted advertising — of children or of anyone else. If you
          believe a child has given us personal data, write to us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Security">
        <p>
          Access to stored data is governed by row-level security rules in the database,
          so one account cannot read another&rsquo;s wishlist. The site is served over
          HTTPS only. No system is perfectly secure, and we do not claim otherwise.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Changes">
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
