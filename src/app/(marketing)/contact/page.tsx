import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY } from '../company';
import { MailTo } from '../legal-ui';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'How to reach tapashub Pvt Ltd about HugFab — customer care, the Grievance Officer, a wrong price, a data request or a partnership.',
  alternates: { canonical: '/contact' },
};

/**
 * Contact.
 *
 * Doubles as the mandatory-disclosure page. The Consumer Protection
 * (E-Commerce) Rules, 2020 require an e-commerce entity to display its legal
 * name, the address of its head office, its website details, and the
 * customer-care and Grievance Officer contacts "in a clear and accessible
 * manner" — so those sit in one bordered block at the top rather than being
 * scattered through prose where a reviewer has to hunt for them.
 *
 * There is no contact form: a form posting into a mailbox nobody has wired up
 * is worse than a plain mailto, because it looks like it worked. When there is
 * a form backed by something, it replaces this.
 *
 * The purchase-support note exists because it is the single most common reason
 * someone writes to a comparison site, and the honest answer — we cannot help,
 * here is who can — saves them a day of waiting.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-h1 text-balance">Contact us</h1>

      <p className="text-body-lg text-muted mt-5">
        One address, read by a person. Tell us what you need and we will tell you honestly
        whether we can do it.
      </p>

      <section className="border-border bg-surface-2 mt-10 rounded-xl border p-6">
        <Detail label="Operated by">
          <b className="text-text">{COMPANY.legalName}</b>
          <br />A private limited company incorporated in India
        </Detail>

        <Detail label="Registered office" bordered>
          <address className="not-italic">
            {COMPANY.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </Detail>

        <Detail label="Website" bordered>
          {COMPANY.website}
        </Detail>

        <Detail label="Customer care" bordered>
          <MailTo />
        </Detail>

        <Detail label="Grievance Officer" bordered>
          <MailTo />
          <span className="text-small text-muted mt-1 block">
            Complaints acknowledged within {COMPANY.grievanceAcknowledgeHours} hours and
            resolved within {COMPANY.grievanceResolveDays} days, as required by the
            Consumer Protection (E-Commerce) Rules, 2020. Put &ldquo;Grievance&rdquo; in
            the subject line.
          </span>
        </Detail>
      </section>

      <Block title="A price or product looks wrong">
        <p>
          Send us the link to the HugFab page and what you saw. Prices come from
          retailers&rsquo; feeds, and a stale or mismatched listing is a bug on our side —
          it is worth reporting and we would rather hear about it than not.
        </p>
      </Block>

      <Block title="Something about your data">
        <p>
          Access, correction, erasure, withdrawing a consent or nominating someone: email
          us from the address on your account, which is how we identify you. What we hold
          and what you can ask for is set out in the{' '}
          <Link className="text-primary font-medium hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </Block>

      <Block title="An order you placed">
        <p>
          We cannot help with this one, and we would be wasting your time if we pretended
          otherwise. HugFab is not a shop — we take no payment and are not a party to your
          purchase. Delivery, returns, refunds and cancellations are handled by the
          retailer you bought from, and only they can act on them.
        </p>
      </Block>

      <Block title="Retailers, brands and affiliate networks">
        <p>
          If you run a store and want your catalogue compared here, or you are reviewing
          HugFab for an affiliate programme, use the same address and say so in the
          subject line.
        </p>
      </Block>

      <div className="border-border mt-12 flex flex-wrap items-center gap-4 border-t pt-8">
        <Link
          href="/privacy"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          Terms of Use
        </Link>
      </div>
    </div>
  );
}

function Detail({
  label,
  bordered,
  children,
}: {
  label: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={bordered ? 'border-border mt-5 border-t pt-5' : undefined}>
      <p className="text-caption text-muted tracking-wide uppercase">{label}</p>
      <div className="text-body mt-1">{children}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-h3">{title}</h2>
      <div className="text-body text-muted mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
