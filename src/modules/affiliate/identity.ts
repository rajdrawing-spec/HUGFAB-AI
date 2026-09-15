import type { NormalisedIdentifier } from './identifiers';

/**
 * What to do with an incoming feed item: is it something we already have, or
 * something new?
 *
 * The rule the whole file exists to enforce: **a product is only merged into an
 * existing one on an exact identifier match.** Everything softer — a similar
 * title, the same brand, a plausible price — is a suggestion for a human, never
 * an action.
 *
 * That asymmetry is not caution for its own sake. A missed match shows the same
 * jacket twice, which is untidy and self-correcting once an identifier arrives.
 * A wrong match shows a shopper Myntra's price on AJIO's jacket: we have
 * published a false price, they click through, and the trust is gone. The two
 * failures are not comparable, so the thresholds are not symmetric either.
 */

/** Mirrors `public.match_method`. */
export type MatchMethod = 'identifier' | 'attribute' | 'fuzzy' | 'manual';

export interface MatchCandidate {
  productId: string;
  method: MatchMethod;
  /** 0–1, assigned by tier in `public.find_product_matches`. */
  confidence: number;
  signals: Record<string, unknown>;
}

/**
 * At or above this, an identifier match is acted on without asking.
 *
 * `find_product_matches` caps its attribute tier at 0.79 and its fuzzy tier at
 * 0.49, both below this line by construction rather than by convention — see
 * the assertion "attribute and fuzzy matches cannot reach auto-merge
 * confidence" in `supabase/tests/01_rls_assertions.sql`. The `method` check
 * below is a second lock on the same door: if someone later raises a tier
 * ceiling, the merge still will not happen silently.
 */
export const AUTO_MERGE_THRESHOLD = 0.9;

/**
 * Below this, a candidate is not worth a reviewer's attention. Queueing every
 * weak resemblance produces a queue nobody reads, which is the same as having
 * no queue at all.
 */
export const REVIEW_THRESHOLD = 0.45;

/** How many candidates one incoming item may put in front of a human. */
export const MAX_REVIEW_CANDIDATES = 3;

export type IdentityResolution =
  | {
      /** An identifier agreed. Attach the offer to the product we already have. */
      action: 'merge';
      productId: string;
      candidate: MatchCandidate;
    }
  | {
      /** Nothing agreed strongly enough. Create a product; maybe ask someone. */
      action: 'create';
      /** Queued for review once the new product has an id. May be empty. */
      review: MatchCandidate[];
    };

/**
 * Decides from the candidates `find_product_matches` returned.
 *
 * Pure, so the decision can be tested exhaustively without a database — which
 * matters, because this is the function that decides whether two things are the
 * same thing, and that is the load-bearing judgement in the entire catalogue.
 */
export function resolveIdentity(
  candidates: readonly MatchCandidate[],
): IdentityResolution {
  const ranked = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const best = ranked[0];

  if (
    best !== undefined &&
    best.method === 'identifier' &&
    best.confidence >= AUTO_MERGE_THRESHOLD
  ) {
    return { action: 'merge', productId: best.productId, candidate: best };
  }

  const review = ranked
    .filter((candidate) => candidate.confidence >= REVIEW_THRESHOLD)
    .slice(0, MAX_REVIEW_CANDIDATES);

  return { action: 'create', review };
}

/**
 * The pair ordering `product_match_candidates` requires.
 *
 * The queue holds unordered pairs — "these two might be one product" reads the
 * same either way round — but a table needs one row per pair, not two. Sorting
 * the ids means A-vs-B and B-vs-A collide on the unique constraint instead of
 * becoming two entries a reviewer has to decide twice.
 */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** The shape `public.find_product_matches` expects for its identifier argument. */
export function toMatchIdentifiers(
  identifiers: readonly NormalisedIdentifier[],
): Array<{ type: string; value: string }> {
  return identifiers.map((identifier) => ({
    type: identifier.type,
    // The raw value: the function normalises again on its own side, and
    // round-tripping our canonical form through it must be a no-op.
    value: identifier.raw,
  }));
}
