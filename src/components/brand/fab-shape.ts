/**
 * Fab's geometry, traced from the supplied mark.
 *
 * One module, because the bear appears in two places that must not drift: the
 * logo in the header and the mascot on the empty screens. A shopper who sees a
 * slightly different bear in the header than the one on the page notices, even
 * if they could not say what changed.
 *
 * Read in the 512×512 space of the original artwork rather than renormalised
 * to something tidier, so these numbers can be checked against the source file
 * directly.
 *
 * The four things that make it this bear: ears level with a flat crown (not
 * circles floating above it), plain white eyes with no pupils, an inverted
 * triangle for a nose, and — the part worth protecting — **arms crossed in a
 * hug**. The last one is the product's name drawn in the mark, so it is the
 * detail to preserve if any of this is ever simplified.
 */

export const FAB_VIEWBOX = '0 0 512 512';

/**
 * Body and head as one silhouette, ending in two feet separated by notches.
 * The ears are separate shapes rather than part of this path: identical fill,
 * so there is no visible seam, and they can twitch independently.
 */
export const FAB_BODY_PATH =
  'M112 176 C112 102 152 48 202 48 L310 48 C360 48 400 102 400 176 ' +
  'L400 434 C400 452 386 466 368 466 L312 466 Q302 466 302 456 ' +
  'L302 442 Q302 432 292 432 L286 432 Q276 432 276 442 ' +
  'L276 462 Q276 472 266 472 L246 472 Q236 472 236 462 ' +
  'L236 442 Q236 432 226 432 L220 432 Q210 432 210 442 ' +
  'L210 456 Q210 466 200 466 L144 466 C126 466 112 452 112 434 Z';

export const FAB_EAR_LEFT = { cx: 128, cy: 98, rx: 46, ry: 50 } as const;
export const FAB_EAR_RIGHT = { cx: 384, cy: 98, rx: 46, ry: 50 } as const;

export const FAB_EYE_LEFT = { cx: 196, cy: 140, rx: 30, ry: 37 } as const;
export const FAB_EYE_RIGHT = { cx: 316, cy: 140, rx: 30, ry: 37 } as const;

/** Inverted triangle, corners eased so it does not read as a warning sign. */
export const FAB_NOSE_PATH =
  'M228 166 h56 a7 7 0 0 1 5.6 11 l-28 34 a7 7 0 0 1-11 0 l-28-34 a7 7 0 0 1 5.6-11 Z';

/**
 * Each arm is two strokes — upper arm, then forearm — meeting at the paw over
 * the belly. Two strokes rather than one so the elbow bends where an elbow
 * bends, and so an arm can be raised from the shoulder without the forearm
 * straightening out.
 */
export const FAB_ARM_LEFT = [
  'M136 242 C160 308 206 342 256 348',
  'M256 348 C226 366 200 380 184 402',
] as const;

export const FAB_ARM_RIGHT = [
  'M376 242 C352 308 306 342 256 348',
  'M256 348 C286 366 312 380 328 402',
] as const;

/** Shoulders, so a raised or waving arm pivots where it is attached. */
export const FAB_SHOULDER_LEFT = '136px 242px';
export const FAB_SHOULDER_RIGHT = '376px 242px';

export const FAB_ARM_STROKE = 13;
