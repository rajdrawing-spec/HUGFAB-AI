import type { Money } from '@/lib/money';
import type { Availability, Gender } from '@/lib/supabase/database.types';

/**
 * The catalogue's domain types.
 *
 * These are what leaves the module. No affiliate-network shape, no database row
 * shape, no snake_case — a provider swap or a schema change stops here
 * (docs/architecture.md §2.2, PRD §23, §24).
 */

export interface BrandSummary {
  id: string;
  slug: string;
  name: string;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
}

export interface RetailerSummary {
  id: string;
  slug: string;
  name: string;
}

export interface HugFabProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  brand: BrandSummary | null;
  category: CategorySummary | null;
  gender: Gender;
  color: string | null;
  material: string | null;
  imageUrls: string[];
  /**
   * A development seed row. Production responses never contain one — the
   * repository filters them out — but the flag travels so a development UI can
   * label it, and so nothing can quietly present invented data as real
   * (PRD §60, §69).
   */
  isMock: boolean;
  createdAt: string;
}

export interface ProductOffer {
  retailer: RetailerSummary;
  price: Money;
  /** The retailer's list price, when the feed gives one. Never inferred. */
  originalPrice: Money | null;
  /** Whole percent, or null when there is no genuine reduction. */
  discountPercent: number | null;
  availability: Availability;
  /**
   * Our own click-out route, never the retailer's tracked URL.
   *
   * The affiliate link is deliberately not exposed to the client: the redirect
   * is where attribution is recorded and where a dead link is caught
   * (docs/user-flows.md F1).
   */
  clickPath: string;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  availability: Availability;
}

/** A card in a grid: enough to render, not enough to fill a product page. */
export interface ProductSummary extends HugFabProduct {
  bestOffer: ProductOffer | null;
  offerCount: number;
}

/** The product page: every offer, cheapest first. */
export interface ProductDetail extends HugFabProduct {
  offers: ProductOffer[];
  bestOffer: ProductOffer | null;
  variants: ProductVariant[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
