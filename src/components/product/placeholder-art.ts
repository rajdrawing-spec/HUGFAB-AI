/**
 * The pure arithmetic behind `ProductImagePlaceholder`.
 *
 * Split out from the component because it is the only part worth testing and
 * the test runner has no JSX transform — every suite in this repository is a
 * `.ts` file for that reason. Keeping the maths here also makes the property
 * that matters obvious: these are functions of their input and nothing else,
 * so the same product always draws the same tile.
 */

/**
 * FNV-1a, 32-bit. Small, dependency-free, and well spread for the short
 * hyphenated strings we feed it — neighbouring slugs like `demo-slim-jeans`
 * and `demo-straight-jeans` share a long prefix, and a weaker hash collapses
 * them onto one colour so a whole row of the grid turns into a single block.
 */
export function hueFromSlug(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 360;
}

/**
 * Up to two letters, one from each of the first two words.
 *
 * Punctuation is stripped rather than counted, so `Zip-Through Hoodie` reads
 * `ZT` and not `Z-`. Unicode-aware, because a title is not guaranteed to be
 * ASCII once real feeds arrive.
 */
export function initialsFor(title: string): string {
  return title
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
