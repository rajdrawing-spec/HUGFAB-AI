import { describe, expect, it } from 'vitest';
import { productSearchParamsSchema } from './schema';

const parse = (input: Record<string, string>) =>
  productSearchParamsSchema.safeParse(input);

describe('search parameters', () => {
  it('applies the defaults a bare request needs', () => {
    const result = parse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('relevance');
      expect(result.data.page).toBe(1);
      expect(result.data.perPage).toBe(24);
    }
  });

  it('converts a price filter from major to minor units once', () => {
    const result = parse({ minPrice: '500', maxPrice: '2000.50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minPrice).toBe(50000);
      expect(result.data.maxPrice).toBe(200050);
    }
  });

  it('rejects a price range that is the wrong way round', () => {
    expect(parse({ minPrice: '2000', maxPrice: '500' }).success).toBe(false);
  });

  it('splits a comma-separated brand list', () => {
    const result = parse({ brand: 'nike, adidas' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.brand).toEqual(['nike', 'adidas']);
  });

  it('rejects a brand value that is not a slug', () => {
    expect(parse({ brand: 'Nike Inc.' }).success).toBe(false);
  });

  it('rejects an unknown sort rather than silently ignoring it', () => {
    expect(parse({ sort: 'cheapest' }).success).toBe(false);
    expect(parse({ sort: 'price_asc' }).success).toBe(true);
  });

  it('caps perPage so one request cannot ask for the whole catalogue', () => {
    expect(parse({ perPage: '500' }).success).toBe(false);
  });

  it('rejects a negative price', () => {
    expect(parse({ minPrice: '-10' }).success).toBe(false);
  });
});
