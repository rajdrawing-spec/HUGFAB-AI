import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Free delivery · Easy returns · 100% authentic, under the buy box
 * (docs/ui-ux-guide.md §4).
 *
 * **These are the retailer's claims, not ours.** The guide is explicit that
 * they "must be sourced from the feed, not asserted by HugFab", and that is the
 * entire design of this component: it renders what it is given and renders
 * *nothing* when it is given nothing. There is no default set of claims, and
 * adding one would be the exact failure the rule exists to prevent — HugFab
 * promising free returns on someone else's behalf.
 *
 * No affiliate feed carries these fields yet, so today this renders nothing on
 * every product. That is the correct output, not a gap: the component exists so
 * that when a feed does supply them there is somewhere honest to put them, and
 * so nobody reaches for a hard-coded "100% authentic" in the meantime.
 */

export type TrustClaimKind = 'delivery' | 'returns' | 'authenticity' | 'warranty';

export interface TrustClaim {
  kind: TrustClaimKind;
  /** The retailer's wording, not ours. "Free delivery over ₹999", not "Free delivery". */
  label: string;
}

export interface TrustRowProps {
  claims: readonly TrustClaim[];
  /** The retailer making them. Shown so the claims are never read as HugFab's. */
  retailerName: string;
  className?: string;
}

const ICONS: Record<TrustClaimKind, ReactNode> = {
  delivery: (
    <path d="M3 7h10v6H3zM13 9h3l3 3v1h-6zM6.5 16.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 16.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
  ),
  returns: <path d="M4 10a7 7 0 1 1 2 5M4 5v5h5" />,
  authenticity: <path d="M12 3 5 6v5c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6zM9 12l2 2 4-4" />,
  warranty: (
    <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
  ),
};

export function TrustRow({ claims, retailerName, className }: TrustRowProps) {
  if (claims.length === 0) return null;

  return (
    <div className={cn('border-border border-t pt-4', className)}>
      <ul className="text-small text-muted flex flex-wrap items-center gap-x-5 gap-y-2">
        {claims.map((claim) => (
          <li
            key={`${claim.kind}:${claim.label}`}
            className="inline-flex items-center gap-2"
          >
            <svg
              viewBox="0 0 24 24"
              className="text-accent size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[claim.kind]}
            </svg>
            {claim.label}
          </li>
        ))}
      </ul>

      {/* Attribution, not a disclaimer. The shopper is told whose promise this
          is, because it is the retailer who has to honour it. */}
      <p className="text-caption text-muted mt-2">
        Stated by {retailerName}. HugFab does not verify these claims.
      </p>
    </div>
  );
}
