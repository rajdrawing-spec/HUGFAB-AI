import Link from 'next/link';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { DEFAULT_MARKET } from '@/lib/locale';
import { discountPercent, formatMoney, fromMajorUnits } from '@/lib/money';

/**
 * Phase 0 home shell.
 *
 * It exists to prove the pipeline end to end — tokens, primitives, currency
 * formatting, the deploy — not to be the real home page. The guide's hero,
 * category rail, trending grid and comparison table are Phase 1 work, written
 * after docs/ui-ux-guide.md and docs/user-flows.md (PRD §56).
 */

const VALUE_PROPS = [
  {
    title: 'AI-powered search',
    detail: 'Find anything with text or image.',
    phase: 2,
  },
  {
    title: 'Compare prices',
    detail: 'One product, every retailer, the real best price.',
    phase: 1,
  },
  {
    title: 'Personalised styles',
    detail: 'Recommendations shaped by your Style DNA.',
    phase: 2,
  },
  {
    title: 'Active community',
    detail: 'Share looks, get advice, follow creators.',
    phase: 3,
  },
] as const;

export default function HomePage() {
  // A worked example, not a product. It demonstrates that prices flow through
  // lib/money.ts and that no component hard-codes a currency symbol (PRD §73).
  const currency = DEFAULT_MARKET.currency;
  const listPrice = fromMajorUnits(9999, currency);
  const bestPrice = fromMajorUnits(7499, currency);
  const saving = discountPercent(listPrice, bestPrice);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-16 sm:py-24">
        <p className="text-caption text-primary font-semibold tracking-[0.16em] uppercase">
          Phase 0 · Foundation
        </p>

        <h1 className="text-display mt-4 max-w-3xl text-balance">
          Your Style. Every <span className="text-primary">Store.</span> One Place.
        </h1>

        <p className="text-body text-muted mt-5 max-w-xl">
          Compare prices, discover styles, get the best deals and shop smarter with AI.
          HugFab is being built one phase at a time — the foundation is live.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="text-button bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-12 items-center rounded-full px-7 font-semibold transition-colors"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="text-button border-border-strong hover:bg-surface-2 inline-flex h-12 items-center rounded-full border px-7 font-semibold transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      <section aria-labelledby="price-demo" className="border-border border-t py-14">
        <h2 id="price-demo" className="text-h2">
          Prices, formatted properly
        </h2>
        <p className="text-body text-muted mt-2 max-w-xl">
          Every figure below is produced by <code>lib/money.ts</code> from integer minor
          units, in {DEFAULT_MARKET.label}. Change the market and the symbol, grouping and
          placement all follow — no component knows what a rupee is.
        </p>

        <Card className="mt-6 max-w-sm">
          <CardBody className="flex flex-col gap-3 pt-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-h2 text-text">{formatMoney(bestPrice)}</span>
              <span className="text-body text-muted line-through">
                {formatMoney(listPrice)}
              </span>
              {saving !== null && (
                <Badge tone="success" variant="text">
                  {saving}% OFF
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">In stock</Badge>
              <Badge tone="primary" variant="solid">
                Best price
              </Badge>
              <Badge>MOCK DATA</Badge>
            </div>
            <p className="text-caption text-muted">
              Illustrative figures. No live price, coupon or availability is shown
              anywhere until a real affiliate feed is connected (PRD §60, §69).
            </p>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="value" className="border-border border-t py-14">
        <h2 id="value" className="text-h2">
          What HugFab will do
        </h2>
        <p className="text-body text-muted mt-2 max-w-xl">
          Capabilities ship in order, not simultaneously. Each builds on this foundation
          rather than around it.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {VALUE_PROPS.map((item) => (
            <Card key={item.title}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="text-h3">{item.title}</CardTitle>
                <Badge tone="neutral">Phase {item.phase}</Badge>
              </CardHeader>
              <CardBody>
                <p className="text-small text-muted">{item.detail}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
