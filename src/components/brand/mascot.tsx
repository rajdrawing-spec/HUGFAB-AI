import { cn } from '@/lib/cn';

/**
 * Fab, the HugFab bear.
 *
 * The mascot exists to carry the moments the product cannot fill with
 * content — an empty catalogue, a search with no results, a 404, a slow
 * load. Those screens are otherwise apologies. A bear peering into an empty
 * shopping bag is the same information delivered with some charm, and charm is
 * the only thing on offer when there is genuinely nothing to show.
 *
 * Three rules it follows:
 *
 *   * **It never covers for missing data.** It appears beside an honest
 *     message, never instead of one. "Nothing listed yet" still says so.
 *   * **Motion is optional.** Every animation sits behind
 *     `motion-safe:`, so a visitor who asked their system for reduced motion
 *     gets a still bear rather than a bouncing one. That is a real setting used
 *     by people who get motion sickness, not a nicety.
 *   * **It is decorative.** `aria-hidden`, always. The text beside it is what a
 *     screen reader should hear; a bear read aloud is noise.
 */

export type MascotMood =
  /** Nothing here yet — peering into an empty bag. */
  | 'empty'
  /** No results — head tilted, searching. */
  | 'searching'
  /** Something broke. */
  | 'oops'
  /** Idle greeting, for marketing surfaces. */
  | 'wave';

export type MascotSize = 'sm' | 'md' | 'lg';

export interface MascotProps {
  mood?: MascotMood;
  size?: MascotSize;
  className?: string;
}

const SIZES: Record<MascotSize, string> = {
  sm: 'size-20',
  md: 'size-32',
  lg: 'size-44',
};

export function Mascot({ mood = 'empty', size = 'md', className }: MascotProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative select-none', SIZES[size], className)}
    >
      <svg viewBox="0 0 120 120" className="size-full" fill="none">
        <defs>
          {/* Clips the muzzle marks to the head so nothing spills when the
              bear tilts. */}
          <clipPath id="fab-head">
            <path d="M20 30c0-8 6.5-14.5 14.5-14.5S49 22 49 30h22c0-8 6.5-14.5 14.5-14.5S100 22 100 30v26c0 22-18 40-40 40S20 78 20 56V30Z" />
          </clipPath>
        </defs>

        {/* Whole bear, so the tilt rotates head and body together. */}
        <g
          className={cn(
            'origin-[60px_70px]',
            mood === 'searching' &&
              'motion-safe:animate-[fab-tilt_3.2s_ease-in-out_infinite]',
            mood === 'wave' && 'motion-safe:animate-[fab-bob_2.6s_ease-in-out_infinite]',
            mood === 'oops' && 'motion-safe:animate-[fab-shake_4s_ease-in-out_infinite]',
          )}
        >
          <path
            d="M20 30c0-8 6.5-14.5 14.5-14.5S49 22 49 30h22c0-8 6.5-14.5 14.5-14.5S100 22 100 30v26c0 22-18 40-40 40S20 78 20 56V30Z"
            fill="var(--hf-logo)"
          />

          {/* Eyes. They blink on a long, irregular-feeling loop; a bear that
              blinks on a tidy 1s beat reads as a machine. */}
          <g
            className={cn(
              mood !== 'oops' &&
                'origin-center motion-safe:animate-[fab-blink_5.4s_ease-in-out_infinite]',
            )}
          >
            <ellipse cx="45" cy="52" rx="5.5" ry="7" fill="var(--hf-surface)" />
            <ellipse cx="75" cy="52" rx="5.5" ry="7" fill="var(--hf-surface)" />
          </g>

          {/* Crossed whiskers, the mark's signature detail. */}
          <g
            clipPath="url(#fab-head)"
            stroke="var(--hf-surface)"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M42 72c6 2.4 10.2 4.6 13.5 7.3 3.3-2.7 7.5-4.9 13.5-7.3" />
            <path d="M42 81.5c6-2.4 10.2-4.6 13.5-7.3 3.3 2.7 7.5 4.9 13.5 7.3" />
          </g>
        </g>

        {/* Mood props, outside the tilt group so they stay upright. */}
        {mood === 'empty' && (
          <g
            className="motion-safe:animate-[fab-bob_3s_ease-in-out_infinite]"
            style={{ transformOrigin: '96px 92px' }}
          >
            {/* An empty bag, tipped to show there is nothing in it. */}
            <path
              d="M84 84h24v22a4 4 0 0 1-4 4H88a4 4 0 0 1-4-4V84Z"
              fill="var(--hf-surface-2)"
              stroke="var(--hf-border-strong)"
              strokeWidth="2.5"
            />
            <path
              d="M91 84v-5a5 5 0 0 1 10 0v5"
              stroke="var(--hf-border-strong)"
              strokeWidth="2.5"
              fill="none"
            />
          </g>
        )}

        {mood === 'searching' && (
          <g className="origin-[96px_86px] motion-safe:animate-[fab-sweep_3.2s_ease-in-out_infinite]">
            <circle
              cx="94"
              cy="84"
              r="11"
              stroke="var(--hf-border-strong)"
              strokeWidth="3"
              fill="var(--hf-surface)"
              fillOpacity="0.55"
            />
            <path
              d="m103 93 7 7"
              stroke="var(--hf-border-strong)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </g>
        )}

        {mood === 'oops' && (
          <g>
            <circle
              cx="96"
              cy="84"
              r="12"
              fill="var(--hf-warning-soft, var(--hf-surface-2))"
            />
            <path
              d="M96 78v7"
              stroke="var(--hf-text)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="96" cy="90.5" r="1.9" fill="var(--hf-text)" />
          </g>
        )}
      </svg>
    </div>
  );
}
