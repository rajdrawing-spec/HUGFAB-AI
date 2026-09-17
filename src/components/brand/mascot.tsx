'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  FAB_SHOULDER_LEFT,
  FAB_SHOULDER_RIGHT,
  FAB_VIEWBOX,
} from './fab-shape';

/**
 * Fab, the HugFab bear.
 *
 * He carries the moments the product cannot fill with content — an empty
 * catalogue, a search with no results, a page that failed. Those screens are
 * otherwise apologies. He is also, on the surfaces where there *is* something
 * to show, the one bit of the interface that is pleased to see you.
 *
 * Four rules, and the first two are the ones that matter:
 *
 *   * **He never covers for missing data.** He appears beside an honest
 *     message, never instead of one. "Nothing listed yet" still says so, in
 *     words, whatever the bear is doing.
 *   * **He is decorative, so he is never the only way to do anything.**
 *     `aria-hidden`, not focusable, no keyboard path — because there is
 *     nothing behind him a keyboard user would be missing. Poking him is a
 *     reaction, not a control. The moment a bear is load-bearing, it has to
 *     stop being a bear and start being a button.
 *   * **Motion is optional.** Every animation sits behind `motion-safe:`, and
 *     the JavaScript checks `prefers-reduced-motion` too — cursor tracking and
 *     blinking are motion just as much as a bounce is. A visitor who asked for
 *     reduced motion gets a still bear that still looks like himself.
 *   * **Amplitude follows mood.** He squashes hard when poked and barely moves
 *     on an error. A mascot bouncing cheerfully on a failed page is reading
 *     the room badly.
 *
 * What makes him funny rather than merely animated is squash and stretch: he
 * compresses before he moves and overshoots when he lands. Everything else —
 * the blink that is sometimes a double blink, the ear that twitches on its own
 * schedule, the eyes that follow your cursor — is there so that standing still
 * does not look like being switched off.
 */

export type MascotMood =
  /** Breathing, blinking, looking around. The resting state. */
  | 'idle'
  /** Nothing here yet — arms dropped open in a shrug. */
  | 'empty'
  /** No results — leaning, eyes scanning. */
  | 'searching'
  /** Something broke. Squinting, a small flinch. */
  | 'oops'
  /** Greeting, for marketing surfaces. */
  | 'wave'
  /** Arms squeezed tight. The mark's own pose, with feeling. */
  | 'hug'
  /** Found it — a hop with both arms up. */
  | 'cheer';

export type MascotSize = 'sm' | 'md' | 'lg' | 'xl';

export interface MascotProps {
  mood?: MascotMood;
  size?: MascotSize;
  /**
   * Follow the cursor, blink, twitch, and react to a poke. On by default,
   * and switched off automatically for reduced motion. Turn it off by hand
   * where a page already has a lot moving.
   */
  interactive?: boolean;
  className?: string;
}

const SIZES: Record<MascotSize, string> = {
  sm: 'size-16',
  md: 'size-28',
  lg: 'size-40',
  xl: 'size-56',
};

/**
 * How far the left arm swings from the hug, per mood; the right arm mirrors it.
 *
 * Written as a `transform` rather than Tailwind's `rotate-*` because Tailwind
 * v4 emits those as the standalone `rotate` property, which `transition-transform`
 * does not cover — the arms would snap into position instead of moving.
 */
const ARM_ANGLE: Record<MascotMood, number> = {
  idle: 0,
  wave: 0,
  searching: 0,
  oops: 0,
  /** Squeezing in. */
  hug: 14,
  /** Dropped open — the shrug that says there is nothing to show. */
  empty: -18,
  /** Both up. */
  cheer: -34,
};

/** How far a poked bear stays poked, in milliseconds. */
const REACTION_MS: Record<'hug' | 'cheer', number> = { hug: 620, cheer: 900 };

/** Pokes within this window count as the same burst of enthusiasm. */
const BURST_MS = 900;

function clamp(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}

/**
 * True when the visitor has asked their system for reduced motion.
 *
 * Starts false and corrects after mount rather than guessing during render,
 * because the server cannot know and a guess produces a hydration mismatch.
 * The cost of being briefly wrong is one frame of stillness, which is the safe
 * direction to be wrong in.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

export function Mascot({
  mood = 'idle',
  size = 'md',
  interactive = true,
  className,
}: MascotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const alive = interactive && !reducedMotion;

  const [blinking, setBlinking] = useState(false);
  const [twitching, setTwitching] = useState(false);
  const [reaction, setReaction] = useState<'hug' | 'cheer' | null>(null);

  // A poke overrides the mood it was given, then hands it back. The screen
  // still says whatever it said; only the bear changed his mind.
  const shown: MascotMood = reaction ?? mood;

  /**
   * Blinking, on an interval that is deliberately irregular and sometimes
   * doubles. A blink on a tidy beat reads as a cursor, not an eyelid.
   */
  useEffect(() => {
    if (!alive) return;

    let stopped = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const after = (ms: number, run: () => void) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!stopped) run();
      }, ms);
      timers.add(id);
    };

    const blink = (): void => {
      setBlinking(true);
      after(140, () => {
        setBlinking(false);
        // Roughly one blink in four is a double.
        if (Math.random() < 0.25) {
          after(170, () => {
            setBlinking(true);
            after(140, () => setBlinking(false));
          });
        }
      });
      after(2400 + Math.random() * 4600, blink);
    };

    after(900 + Math.random() * 2500, blink);

    return () => {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      setBlinking(false);
    };
  }, [alive]);

  /** An ear twitch, rarer than a blink and on its own clock. */
  useEffect(() => {
    if (!alive) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const twitch = (): void => {
      setTwitching(true);
      timer = setTimeout(() => {
        if (stopped) return;
        setTwitching(false);
        timer = setTimeout(twitch, 5000 + Math.random() * 9000);
      }, 420);
    };

    timer = setTimeout(twitch, 3000 + Math.random() * 7000);

    return () => {
      stopped = true;
      clearTimeout(timer);
      setTwitching(false);
    };
  }, [alive]);

  /**
   * Eyes toward the cursor, and a slight lean with them.
   *
   * The result is written to CSS custom properties rather than React state:
   * this fires on every pointer move, and re-rendering an SVG at that rate to
   * shift two ellipses by four pixels would be a waste of a main thread. The
   * frame guard means at most one write per painted frame.
   *
   * Touch devices never send `pointermove` without contact, so a phone simply
   * gets a bear looking straight ahead, which is the correct resting pose
   * rather than a fallback.
   */
  useEffect(() => {
    if (!alive) return;
    const element = rootRef.current;
    if (element === null) return;

    let frame = 0;

    const onMove = (event: PointerEvent): void => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = element.getBoundingClientRect();
        if (box.width === 0) return;

        // A generous span, so he tracks the whole page rather than pinning his
        // eyes to the corner the moment the cursor leaves him.
        const span = Math.max(box.width, 180) * 2.6;
        const x = clamp((event.clientX - (box.left + box.width / 2)) / span);
        const y = clamp((event.clientY - (box.top + box.height / 2)) / span);

        element.style.setProperty('--fab-x', x.toFixed(3));
        element.style.setProperty('--fab-y', y.toFixed(3));
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame !== 0) cancelAnimationFrame(frame);
      element.style.removeProperty('--fab-x');
      element.style.removeProperty('--fab-y');
    };
  }, [alive]);

  /**
   * Poking him.
   *
   * One poke is a hug. Three in quick succession and he gives up on dignity
   * and hops — an easter egg that costs nothing and that people do find,
   * because the first hug invites the second.
   */
  const burst = useRef({ count: 0, at: 0 });
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reactionTimer.current !== null) clearTimeout(reactionTimer.current);
    },
    [],
  );

  const poke = useCallback(() => {
    if (!alive) return;

    const now = Date.now();
    burst.current.count = now - burst.current.at < BURST_MS ? burst.current.count + 1 : 1;
    burst.current.at = now;

    const next = burst.current.count >= 3 ? 'cheer' : 'hug';
    setReaction(next);

    if (reactionTimer.current !== null) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), REACTION_MS[next]);
  }, [alive]);

  const bodyAnimation =
    shown === 'cheer'
      ? 'motion-safe:animate-[fab-hop_0.9s_cubic-bezier(.34,1.56,.64,1)]'
      : shown === 'hug'
        ? 'motion-safe:animate-[fab-squish_0.62s_cubic-bezier(.34,1.56,.64,1)]'
        : shown === 'oops'
          ? 'motion-safe:animate-[fab-shake_4s_ease-in-out_infinite]'
          : shown === 'searching'
            ? 'motion-safe:animate-[fab-tilt_3.2s_ease-in-out_infinite]'
            : shown === 'empty'
              ? 'motion-safe:animate-[fab-bob_3.4s_ease-in-out_infinite]'
              : 'motion-safe:animate-[fab-breathe_4.6s_ease-in-out_infinite]';

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      onPointerDown={poke}
      className={cn(
        'fab-root relative touch-manipulation select-none',
        alive && 'cursor-pointer',
        SIZES[size],
        className,
      )}
    >
      <svg viewBox={FAB_VIEWBOX} className="size-full overflow-visible" fill="none">
        {/*
          Lean. Separate from the pose animations below so a bear who is
          leaning toward your cursor can also be mid-hop: one transform per
          group, rather than two rules fighting over the same property.
        */}
        <g
          style={{
            transform:
              'rotate(calc(var(--fab-x, 0) * 3deg)) translateY(calc(var(--fab-y, 0) * 4px))',
            transformOrigin: '256px 430px',
            transition: 'transform 380ms cubic-bezier(.22,.61,.36,1)',
          }}
        >
          <g className={cn('origin-[256px_440px]', bodyAnimation)}>
            <g fill="var(--hf-logo)">
              <ellipse
                {...FAB_EAR_LEFT}
                className={cn(
                  'origin-[150px_130px]',
                  twitching && 'motion-safe:animate-[fab-ear_0.42s_ease-in-out]',
                )}
              />
              <ellipse
                {...FAB_EAR_RIGHT}
                className={cn(
                  'origin-[362px_130px]',
                  twitching && 'motion-safe:animate-[fab-ear-r_0.42s_ease-in-out]',
                )}
              />
              <path d={FAB_BODY_PATH} />
            </g>

            {/*
              Eyes. Two nested groups on purpose: the outer one carries the
              look direction, the inner one the blink. Putting both on one
              element means whichever transform is written second wins, and the
              bear either stops looking or stops blinking.
            */}
            <g
              style={{
                transform:
                  'translate(calc(var(--fab-x, 0) * 9px), calc(var(--fab-y, 0) * 7px))',
                transition: 'transform 260ms cubic-bezier(.22,.61,.36,1)',
              }}
              className={cn(
                shown === 'searching' &&
                  'motion-safe:animate-[fab-scan_3.2s_ease-in-out_infinite]',
              )}
            >
              <g
                style={{
                  transformOrigin: '256px 140px',
                  transform: blinking
                    ? 'scaleY(0.08)'
                    : shown === 'oops'
                      ? 'scaleY(0.34)'
                      : shown === 'cheer'
                        ? 'scale(1.1)'
                        : undefined,
                  transition: blinking
                    ? 'transform 70ms linear'
                    : 'transform 160ms ease-out',
                }}
                fill="var(--hf-logo-ink)"
              >
                <ellipse {...FAB_EYE_LEFT} />
                <ellipse {...FAB_EYE_RIGHT} />
              </g>
            </g>

            <path d={FAB_NOSE_PATH} fill="var(--hf-logo-ink)" />

            {/*
              The arms, and the whole point of the character: the mark already
              has them crossed in a hug, so every pose here is a departure from
              a hug and a return to it.
            */}
            <g
              stroke="var(--hf-logo-ink)"
              strokeWidth={FAB_ARM_STROKE}
              strokeLinecap="round"
              fill="none"
            >
              <g
                style={{
                  transformOrigin: FAB_SHOULDER_LEFT,
                  transform: `rotate(${ARM_ANGLE[shown]}deg)`,
                  transition: 'transform 300ms ease-out',
                }}
              >
                {FAB_ARM_LEFT.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>

              <g
                style={{
                  transformOrigin: FAB_SHOULDER_RIGHT,
                  // Mirrored, so both arms open and close together rather than
                  // swinging the same way and making him look windswept.
                  transform: `rotate(${-ARM_ANGLE[shown]}deg)`,
                  transition: 'transform 300ms ease-out',
                }}
                className={cn(
                  // A running animation outranks an inline style, so the wave
                  // takes over this arm without the rotation above fighting it.
                  shown === 'wave' &&
                    'motion-safe:animate-[fab-wave_1.6s_ease-in-out_infinite]',
                )}
              >
                {FAB_ARM_RIGHT.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            </g>
          </g>
        </g>

        {/* A magnifier he is holding up, only while actually searching. */}
        {shown === 'searching' && (
          <g className="origin-[430px_150px] motion-safe:animate-[fab-sweep_3.2s_ease-in-out_infinite]">
            <circle
              cx="432"
              cy="146"
              r="44"
              stroke="var(--hf-border-strong)"
              strokeWidth="13"
              fill="var(--hf-surface)"
              fillOpacity="0.5"
            />
            <path
              d="m466 180 26 26"
              stroke="var(--hf-border-strong)"
              strokeWidth="15"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
