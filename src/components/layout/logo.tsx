import { cn } from '@/lib/cn';

/**
 * The HugFab mark: the bear, and the HUGFAB wordmark beside it.
 *
 * Inline SVG rather than a file, for the same reasons the wordmark was text
 * before it: no request, no layout shift, crisp at any size, and it inherits
 * `currentColor` so a header on a dark ground needs no second asset.
 *
 * **The bear keeps the brand red at full strength.** The UI token `primary` is
 * #dc2626 — deliberately a shade deeper, because white text sits on it and
 * pure red fails WCAG AA. A mark carries no text, so it is not held to that
 * rule and dulling it would flatten the brand for no accessibility gain. That
 * is why `--hf-logo` exists as its own token rather than reusing `primary`:
 * the difference is intentional and should survive someone "fixing" it later.
 *
 * If the original vector differs from this reconstruction, replace the paths
 * here — everything else about the component can stay.
 */

export interface LogoProps {
  className?: string;
  /** Mark only, for tight spaces like the mobile bar. */
  markOnly?: boolean;
  /** Overrides the mark's colour, e.g. mono on a photographic ground. */
  tone?: 'brand' | 'current';
}

export function Logo({ className, markOnly = false, tone = 'brand' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BearMark
        className={cn('size-7 shrink-0', tone === 'brand' && 'text-[var(--hf-logo)]')}
      />
      {!markOnly && <span className="text-h3 font-bold tracking-tight">HugFab</span>}
      {markOnly && <span className="sr-only">HugFab</span>}
    </span>
  );
}

/**
 * The bear, drawn as one silhouette with knocked-out eyes and muzzle so it
 * reads at 20px in a mobile bar as well as it does large.
 */
export function BearMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      role="img"
      aria-label="HugFab"
    >
      {/* Ears and head, one path — a separate ear shape shows a seam when the
          mark is scaled down or rendered on a non-white ground. */}
      <path
        d="M10 14c0-4.4 3.6-8 8-8s8 3.6 8 8v2h12v-2c0-4.4 3.6-8 8-8s8 3.6 8 8v14c0 15.5-10.7 28-24 28S10 43.5 10 28V14Z"
        fill="currentColor"
      />
      {/* Eyes, knocked out. */}
      <ellipse cx="24" cy="28" rx="4.4" ry="5.6" fill="var(--hf-surface)" />
      <ellipse cx="40" cy="28" rx="4.4" ry="5.6" fill="var(--hf-surface)" />
      {/* The muzzle's crossed whiskers, the detail that makes it this bear
          rather than any bear. */}
      <path
        d="M22 42c4.5 1.8 7.6 3.4 10 5.4 2.4-2 5.5-3.6 10-5.4"
        stroke="var(--hf-surface)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M22 49c4.5-1.8 7.6-3.4 10-5.4 2.4 2 5.5 3.6 10 5.4"
        stroke="var(--hf-surface)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
