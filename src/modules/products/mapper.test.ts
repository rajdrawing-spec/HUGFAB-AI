import { describe, expect, it } from 'vitest';
import { toProductDetail, toProductSummary, clickPath } from './mapper';
import type { ProductDetailRow, SearchRow } from './schema';

const baseSearchRow: SearchRow = {
  id: 'p1',
  slug: 'club-hoodie',
  title: 'Club Oversized Hoodie',
  description: null,
  gender: 'unisex',
  color: 'Black',
  material: null,
  image_urls: null,
  is_mock: false,
  created_at: '2026-09-01T00:00:00Z',
  brand_id: 'b1',
  brand_slug: 'nike',
  brand_name: 'Nike',
  category_id: null,
  category_slug: null,
  category_name: null,
  best_price_minor: 189900,
  best_original_minor: 299900,
  best_currency: 'INR',
  best_availability: 'in_stock',
  best_retailer_id: 'r1',
  best_retailer_slug: 'myntra',
  best_retailer_name: 'Myntra',
  offer_count: 3,
  total_count: 42,
};

function detailRow(prices: ProductDetailRow['prices']): ProductDetailRow {
  return {
    id: 'p1',
    slug: 'club-hoodie',
    title: 'Club Oversized Hoodie',
    description: null,
    gender: 'unisex',
    color: null,
    material: null,
    image_urls: null,
    is_mock: false,
    created_at: '2026-09-01T00:00:00Z',
    brand: null,
    category: null,
    product_variants: [],
    prices,
  };
}

function offer(
  id: string,
  retailerSlug: string,
  priceMinor: number,
  availability: ProductDetailRow['prices'][number]['availability'] = 'in_stock',
  originalMinor: number | null = null,
): ProductDetailRow['prices'][number] {
  return {
    id,
    price_minor: priceMinor,
    original_minor: originalMinor,
    currency: 'INR',
    availability,
    retailer: { id: `r-${retailerSlug}`, slug: retailerSlug, name: retailerSlug },
  };
}

describe('product summary', () => {
  it('builds the price cluster from the best offer', () => {
    const summary = toProductSummary(baseSearchRow);
    expect(summary.bestOffer?.price.amountMinor).toBe(189900);
    expect(summary.bestOffer?.originalPrice?.amountMinor).toBe(299900);
    expect(summary.bestOffer?.discountPercent).toBe(37);
    expect(summary.bestOffer?.retailer.name).toBe('Myntra');
  });

  it('reports no discount when the retailer gave no original price', () => {
    const summary = toProductSummary({ ...baseSearchRow, best_original_minor: null });
    expect(summary.bestOffer?.originalPrice).toBeNull();
    expect(summary.bestOffer?.discountPercent).toBeNull();
  });

  it('handles a product with no offer at all', () => {
    const summary = toProductSummary({
      ...baseSearchRow,
      best_price_minor: null,
      best_currency: null,
      best_retailer_id: null,
      best_retailer_slug: null,
      best_retailer_name: null,
      best_availability: null,
    });
    expect(summary.bestOffer).toBeNull();
    expect(summary.title).toBe('Club Oversized Hoodie');
  });

  it('never exposes a retailer link — only our attribution route', () => {
    const summary = toProductSummary(baseSearchRow);
    expect(summary.bestOffer?.clickPath).toBe(clickPath('p1', 'r1'));
    expect(JSON.stringify(summary)).not.toContain('http');
  });

  it('carries the mock flag through, so a seed row can never pass as real', () => {
    expect(toProductSummary({ ...baseSearchRow, is_mock: true }).isMock).toBe(true);
  });
});

describe('product detail offer ordering', () => {
  it('puts the cheapest offer first, so "Best Price" and the top row agree', () => {
    const detail = toProductDetail(
      detailRow([
        offer('a', 'amazon', 194900),
        offer('b', 'ajio', 179900),
        offer('c', 'myntra', 189900),
      ]),
    );
    expect(detail.offers.map((o) => o.retailer.slug)).toEqual([
      'ajio',
      'myntra',
      'amazon',
    ]);
    expect(detail.bestOffer?.retailer.slug).toBe('ajio');
  });

  it('sinks an out-of-stock offer below every available one, however cheap', () => {
    const detail = toProductDetail(
      detailRow([
        offer('a', 'cheap-but-gone', 99900, 'out_of_stock'),
        offer('b', 'available', 189900, 'in_stock'),
      ]),
    );
    // A price you cannot buy at is not a competitive price.
    expect(detail.bestOffer?.retailer.slug).toBe('available');
    expect(detail.offers[1]?.retailer.slug).toBe('cheap-but-gone');
  });

  it('groups rather than compares across currencies, instead of throwing', () => {
    const row = detailRow([offer('a', 'uk', 4900), offer('b', 'india', 189900)]);
    row.prices[0]!.currency = 'GBP';
    const detail = toProductDetail(row);
    expect(detail.offers).toHaveLength(2);
    expect(detail.bestOffer).not.toBeNull();
  });

  it('drops an offer with no retailer rather than rendering a nameless row', () => {
    const row = detailRow([offer('a', 'myntra', 189900), offer('b', 'x', 100)]);
    row.prices[1]!.retailer = null;
    expect(toProductDetail(row).offers).toHaveLength(1);
  });

  it('computes each offer discount independently', () => {
    const detail = toProductDetail(
      detailRow([
        offer('a', 'ajio', 179900, 'in_stock', 279900),
        offer('b', 'myntra', 189900, 'in_stock', null),
      ]),
    );
    expect(detail.offers[0]?.discountPercent).toBe(36);
    expect(detail.offers[1]?.discountPercent).toBeNull();
  });

  it('has no offers and no best offer when nothing is listed', () => {
    const detail = toProductDetail(detailRow([]));
    expect(detail.offers).toEqual([]);
    expect(detail.bestOffer).toBeNull();
  });
});
