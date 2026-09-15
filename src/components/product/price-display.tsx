import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';
import type { ProductOffer } from '@/modules/products/types';

/**
 * The price cluster — current price, struck original, discount — in the order
 * the design concept fixes (docs/ui-ux-guide.md §4).
 *
 * It renders exactly what the retailer gave us. `discountPercent` is computed in
 * modules/products/mapper.ts from two real figures and is null whenever there is
 * no genuine reduction, so there is no branch here that could invent one. A
 * missing original price means no strike-through and no percentage, not a
 * flattering guess (PRD §69).
 */

export interface PriceDisplayProps {
  offer: ProductOffer;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CURRENT_SIZE = {
  sm: 'text-body font-semibold',
  md: 'text-h3',
  lg: 'text-h2',
} as const;

const ORIGINAL_SIZE = {
  sm: 'text-caption',
  md: 'text-small',
  lg: 'text-body',
} as const;

export function PriceDisplay({ offer, size = 'md', className }: PriceDisplayProps) {
  const { price, originalPrice, discountPercent } = offer;

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn(CURRENT_SIZE[size], 'text-text')}>{formatMoney(price)}</span>

      {originalPrice && (
        <span className={cn(ORIGINAL_SIZE[size], 'text-muted line-through')}>
          {formatMoney(originalPrice)}
        </span>
      )}

      {discountPercent !== null && (
        <Badge tone="success" variant="text">
          {discountPercent}% OFF
        </Badge>
      )}
    </div>
  );
}

/** "₹1,899 at Myntra" — retailer attribution next to a price. */
export function RetailerLabel({ offer }: { offer: ProductOffer }) {
  return <span className="text-small text-muted">{offer.retailer.name}</span>;
}
