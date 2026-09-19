import { describe, expect, it } from 'vitest';
import { hueFromSlug, initialsFor } from './placeholder-art';

/**
 * The placeholder stands in for a photograph, so the one property that
 * actually matters is that it does not move. A product whose tile is teal
 * today and pink after the next deploy looks like a different product, and a
 * shopper scanning a grid they have seen before loses the only visual anchor
 * they had.
 */
describe('hueFromSlug', () => {
  it('gives the same slug the same hue every time', () => {
    expect(hueFromSlug('demo-oversized-fleece-hoodie')).toBe(
      hueFromSlug('demo-oversized-fleece-hoodie'),
    );
  });

  it('stays inside a valid hue range for anything it is given', () => {
    for (const slug of ['', 'a', 'demo-low-sneakers', '—ünïcødé—', 'x'.repeat(400)]) {
      const hue = hueFromSlug(slug);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });

  it('separates products that sit next to each other in the grid', () => {
    // Neighbouring slugs share long prefixes, which is exactly where a weak
    // hash collapses them onto one colour and the grid turns into a block.
    const hues = [
      'demo-straight-jeans',
      'demo-slim-jeans',
      'demo-high-rise-jeans',
      'demo-pleated-trousers',
    ].map(hueFromSlug);
    expect(new Set(hues).size).toBe(hues.length);
  });
});

describe('initialsFor', () => {
  it('takes one letter from each of the first two words', () => {
    expect(initialsFor('Oversized Fleece Hoodie')).toBe('OF');
    expect(initialsFor('Tote')).toBe('T');
  });

  it('ignores punctuation rather than turning it into an initial', () => {
    expect(initialsFor('Zip-Through Hoodie')).toBe('ZT');
    expect(initialsFor('  Bias  Cut  Slip Dress ')).toBe('BC');
  });

  it('returns an empty string rather than throwing on an empty title', () => {
    expect(initialsFor('')).toBe('');
    expect(initialsFor('   ')).toBe('');
  });
});
