import { Badge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { ProductOffer } from '@/modules/products/types';
import { RetailerBadge } from './retailer-badge';

/**
 * Price across retailers — the payoff of the whole product
 * (docs/ui-ux-guide.md §1).
 *
 * The rows render `offers` in the order the service already produced: in-stock
 * first, then cheapest. "Best Price" is therefore the first row by
 * construction, not by a second calculation here that could disagree with the
 * sort. An out-of-stock offer sinks below every available one however cheap it
 * is — a price you cannot buy at is not a competitive price.
 */

export interface PriceComparisonProps {
  offers: readonly ProductOffer[];
  /** Marks the data as development seed rows so nothing reads as a live price. */
  isMock?: boolean;
}

export function PriceComparison({ offers, isMock = false }: PriceComparisonProps) {
  if (offers.length === 0) {
    return (
      <div className="border-border bg-surface-2 rounded-lg border p-6 text-center">
        <p className="text-body text-muted">
          No retailer is listing this product right now.
        </p>
      </div>
    );
  }

  const bestId = offers[0]?.retailer.id;

  return (
    <div className="border-border bg-surface overflow-hidden rounded-lg border">
      {isMock && (
        <p className="bg-warning-soft text-warning text-caption border-border border-b px-4 py-2 font-semibold">
          MOCK DATA — these prices are invented for development and are not live.
        </p>
      )}

      {/* Scrolls inside itself; the page never scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse">
          <caption className="sr-only">
            Price at each retailer, cheapest available first
          </caption>
          <thead>
            <tr className="border-border text-caption text-muted border-b text-left">
              <th scope="col" className="px-4 py-3 font-semibold">
                Retailer
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Price
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Availability
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Go to retailer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => {
              const isBest = offer.retailer.id === bestId;
              const available = offer.availability === 'in_stock';

              return (
                <tr
                  key={offer.retailer.id}
                  className={cn(
                    'border-border border-b last:border-b-0',
                    isBest && 'bg-primary-soft/40',
                  )}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <RetailerBadge retailer={offer.retailer} size="md" />
                      {isBest && available && (
                        <Badge tone="primary" variant="solid">
                          Best Price
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-body text-text font-semibold">
                        {formatMoney(offer.price)}
                      </span>
                      {offer.originalPrice && (
                        <span className="text-caption text-muted line-through">
                          {formatMoney(offer.originalPrice)}
                        </span>
                      )}
                      {offer.discountPercent !== null && (
                        <Badge tone="success" variant="text">
                          {offer.discountPercent}% OFF
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <AvailabilityLabel availability={offer.availability} />
                  </td>

                  <td className="px-4 py-4 text-right">
                    <a
                      href={offer.clickPath}
                      // Attribution is recorded by our own route, so this is a
                      // normal navigation — not a prefetched Next link, which
                      // would fire the click-out without a user clicking it.
                      rel="nofollow sponsored noopener"
                      className={cn(
                        'text-button inline-flex h-10 items-center rounded-full px-5 font-semibold transition-colors',
                        available
                          ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                          : 'border-border-strong text-muted pointer-events-none border opacity-60',
                      )}
                      aria-disabled={!available}
                    >
                      {available ? 'Buy' : 'Unavailable'}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Required wherever an affiliate link appears, not only in the footer (PRD §74). */}
      <p className="text-caption text-muted border-border border-t px-4 py-3">
        HugFab earns a commission on some purchases made through these links.
      </p>
    </div>
  );
}

function AvailabilityLabel({
  availability,
}: {
  availability: ProductOffer['availability'];
}) {
  const map = {
    in_stock: { tone: 'success', label: 'In stock' },
    out_of_stock: { tone: 'neutral', label: 'Out of stock' },
    preorder: { tone: 'secondary', label: 'Pre-order' },
    discontinued: { tone: 'neutral', label: 'Discontinued' },
    unknown: { tone: 'neutral', label: 'Unknown' },
  } as const;

  const { tone, label } = map[availability];
  return <Badge tone={tone}>{label}</Badge>;
}
