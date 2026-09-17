import Image from 'next/image';
import { cn } from '@/lib/cn';
import type { RetailerSummary } from '@/modules/products/types';

/**
 * A retailer, shown as the guide requires it: logo and name, **never a bare
 * domain** (docs/ui-ux-guide.md §4).
 *
 * That rule is about attribution rather than decoration. "myntra.com" is a URL;
 * "Myntra" with their mark is the shop a shopper recognises and is the form the
 * feed terms expect (PRD §32, §74). The logo is shown as supplied and is never
 * restyled to look like HugFab UI.
 *
 * **The monogram is not a placeholder to be replaced by a fake logo.** Most
 * feeds supply a retailer name long before they supply artwork, and the search
 * RPC does not return a logo at all. So a retailer with no logo renders its
 * initials on a neutral disc, which is honest, stable, and never mistaken for
 * the retailer's real mark.
 */

export type RetailerBadgeSize = 'sm' | 'md';

export interface RetailerBadgeProps {
  retailer: RetailerSummary;
  size?: RetailerBadgeSize;
  /** Hides the name, leaving only the mark. The name stays in the label. */
  iconOnly?: boolean;
  className?: string;
}

const SIZES: Record<RetailerBadgeSize, { box: string; text: string; px: number }> = {
  sm: { box: 'size-5', text: 'text-small', px: 20 },
  md: { box: 'size-7', text: 'text-body', px: 28 },
};

/**
 * Up to two initials. "H&M" gives "HM", "Amazon" gives "A" — a single strong
 * letter reads better than a letter and a vowel.
 */
function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
    .split(/[\s&]+/)
    .filter(Boolean);

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();
  return (words[0]!.slice(0, 1) + words[1]!.slice(0, 1)).toUpperCase();
}

export function RetailerBadge({
  retailer,
  size = 'sm',
  iconOnly = false,
  className,
}: RetailerBadgeProps) {
  const dimensions = SIZES[size];
  const logoUrl = retailer.logoUrl ?? null;

  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-2', className)}
      // With the name hidden the mark alone has to carry it for assistive tech.
      {...(iconOnly ? { title: retailer.name } : {})}
    >
      <span
        className={cn(
          'bg-surface-2 relative shrink-0 overflow-hidden rounded-full',
          dimensions.box,
        )}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={dimensions.px}
            height={dimensions.px}
            className="size-full object-contain"
            // Decorative: the retailer's name is already in the text beside it,
            // or in the title attribute when it is not.
            aria-hidden="true"
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-muted absolute inset-0 grid place-items-center text-[0.625rem] font-semibold"
          >
            {monogram(retailer.name)}
          </span>
        )}
      </span>

      {iconOnly ? (
        <span className="sr-only">{retailer.name}</span>
      ) : (
        <span className={cn('text-text min-w-0 truncate font-medium', dimensions.text)}>
          {retailer.name}
        </span>
      )}
    </span>
  );
}
