import { compareMoney, discountPercent, money, type Money } from '@/lib/money';
import type { ProductDetailRow, SearchRow } from './schema';
import type {
  ProductDetail,
  ProductOffer,
  ProductSummary,
  RetailerSummary,
} from './types';

/**
 * Database rows in, domain objects out. Kept apart from the repository so the
 * mapping — where the price arithmetic lives — is testable without a database.
 */

/** The client is given our attribution route, never the retailer's link. */
export function clickPath(productId: string, retailerId: string): string {
  const params = new URLSearchParams({ product: productId, retailer: retailerId });
  return `/api/affiliate/click?${params.toString()}`;
}

function toOffer(input: {
  productId: string;
  retailer: RetailerSummary;
  priceMinor: number;
  originalMinor: number | null;
  currency: string;
  availability: ProductOffer['availability'];
}): ProductOffer {
  const price: Money = money(input.priceMinor, input.currency);
  const originalPrice =
    input.originalMinor === null ? null : money(input.originalMinor, input.currency);

  return {
    retailer: input.retailer,
    price,
    originalPrice,
    // Computed from the two figures the retailer actually gave us. The schema
    // already refuses an "original" below the current price, so this is never
    // a flattering fiction (PRD §69).
    discountPercent: originalPrice ? discountPercent(originalPrice, price) : null,
    availability: input.availability,
    clickPath: clickPath(input.productId, input.retailer.id),
  };
}

export function toProductSummary(row: SearchRow): ProductSummary {
  const hasOffer =
    row.best_price_minor !== null &&
    row.best_currency !== null &&
    row.best_retailer_id !== null &&
    row.best_retailer_slug !== null &&
    row.best_retailer_name !== null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    brand:
      row.brand_id && row.brand_slug && row.brand_name
        ? { id: row.brand_id, slug: row.brand_slug, name: row.brand_name }
        : null,
    category:
      row.category_id && row.category_slug && row.category_name
        ? { id: row.category_id, slug: row.category_slug, name: row.category_name }
        : null,
    gender: row.gender,
    color: row.color,
    material: row.material,
    imageUrls: row.image_urls ?? [],
    isMock: row.is_mock,
    createdAt: row.created_at,
    offerCount: row.offer_count,
    bestOffer: hasOffer
      ? toOffer({
          productId: row.id,
          retailer: {
            id: row.best_retailer_id as string,
            slug: row.best_retailer_slug as string,
            name: row.best_retailer_name as string,
          },
          priceMinor: row.best_price_minor as number,
          originalMinor: row.best_original_minor,
          currency: row.best_currency as string,
          availability: row.best_availability ?? 'unknown',
        })
      : null,
  };
}

export function toProductDetail(row: ProductDetailRow): ProductDetail {
  const offers = row.prices
    .filter((price) => price.retailer !== null)
    .map((price) =>
      toOffer({
        productId: row.id,
        retailer: price.retailer as RetailerSummary,
        priceMinor: price.price_minor,
        originalMinor: price.original_minor,
        currency: price.currency,
        availability: price.availability,
      }),
    );

  /**
   * Cheapest first, but an out-of-stock offer is not a competitive price — it
   * sinks below every available one regardless of what it costs. The comparison
   * table renders this order directly, so "Best Price" and the top row agree by
   * construction rather than by a second calculation.
   *
   * Offers in different currencies are not comparable, so they are grouped
   * rather than sorted against each other; `compareMoney` would throw.
   */
  offers.sort((a, b) => {
    const aAvailable = a.availability === 'in_stock';
    const bAvailable = b.availability === 'in_stock';
    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;

    if (a.price.currency !== b.price.currency) {
      return a.price.currency.localeCompare(b.price.currency);
    }
    return compareMoney(a.price, b.price);
  });

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    color: row.color,
    material: row.material,
    imageUrls: row.image_urls ?? [],
    isMock: row.is_mock,
    createdAt: row.created_at,
    variants: row.product_variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      imageUrl: variant.image_url,
      availability: variant.availability,
    })),
    offers,
    bestOffer: offers[0] ?? null,
  };
}
