import { cn } from '@/lib/cn';
import {
  FAB_ARM_LEFT,
  FAB_ARM_RIGHT,
  FAB_ARM_STROKE,
  FAB_BODY_PATH,
  FAB_EAR_LEFT,
  FAB_EAR_RIGHT,
  FAB_EYE_LEFT,
  FAB_EYE_RIGHT,
  FAB_NOSE_PATH,
  FAB_VIEWBOX,
} from '@/components/brand/fab-shape';

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
 * The geometry lives in `@/components/brand/fab-shape`, shared with the
 * mascot. One source, because the header bear and the bear on an empty search
 * page have to be the same animal — a shopper notices when they are not, even
 * without being able to say what changed.
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
      viewBox={FAB_VIEWBOX}
      className={className}
      fill="none"
      role="img"
      aria-label="HugFab"
    >
      {/* Ears before the body, same fill: no seam, and the crown stays flat
          rather than turning into two circles behind a dome. */}
      <g fill="currentColor">
        <ellipse {...FAB_EAR_LEFT} />
        <ellipse {...FAB_EAR_RIGHT} />
        <path d={FAB_BODY_PATH} />
      </g>

      <g fill="var(--hf-logo-ink)">
        <ellipse {...FAB_EYE_LEFT} />
        <ellipse {...FAB_EYE_RIGHT} />
        <path d={FAB_NOSE_PATH} />
      </g>

      {/* The arms, crossed. This is the detail that makes it this bear and not
          any bear, and it is the product's name drawn in the mark — so if the
          logo is ever simplified for a favicon, this is the last thing to go. */}
      <g
        stroke="var(--hf-logo-ink)"
        strokeWidth={FAB_ARM_STROKE}
        strokeLinecap="round"
        fill="none"
      >
        {[...FAB_ARM_LEFT, ...FAB_ARM_RIGHT].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
