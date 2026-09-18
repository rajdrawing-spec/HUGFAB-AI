import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'How to reach tapashub Pvt Ltd about HugFab — a wrong price, a data request, a partnership, or anything else.',
  alternates: { canonical: '/contact' },
};

/**
 * Contact.
 *
 * One address, and an honest account of what it can and cannot do. There is no
 * contact form: a form that posts into a mailbox nobody has wired up is worse
 * than a plain mailto, because it looks like it worked. When there is a form
 * backed by something, it replaces this.
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
        <p className="text-caption text-muted tracking-wide uppercase">Email</p>
        <p className="text-h3 mt-1">
          <a className="text-primary hover:underline" href="mailto:contact@hugfab.com">
            contact@hugfab.com
          </a>
        </p>

        <div className="border-border mt-6 border-t pt-6">
          <p className="text-caption text-muted tracking-wide uppercase">
            Registered office
          </p>
          <address className="text-body mt-2 not-italic">
            tapashub Pvt Ltd
            <br />
            Manikonda, Hyderabad
            <br />
            Telangana, India
          </address>
        </div>
      </section>

      <Block title="A price or product looks wrong">
        <p>
          Send us the link to the HugFab page and what you saw. Prices come from
          retailers&rsquo; feeds and a stale or mismatched listing is a bug on our side —
          it is worth reporting and we would rather hear about it than not.
        </p>
      </Block>

      <Block title="Something about your data">
        <p>
          Access, correction, erasure or withdrawing a consent: email us from the address
          on your account. What we hold and what you can ask for is set out in the{' '}
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
          href="/how-it-works"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          How it works
        </Link>
        <Link
          href="/about"
          className="text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
        >
          About HugFab
        </Link>
      </div>
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
