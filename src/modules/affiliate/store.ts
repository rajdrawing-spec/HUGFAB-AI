import type { NormalisedIdentifier } from './identifiers';
import type { MatchCandidate } from './identity';

/**
 * Everything the ingestion pipeline needs from the database, as an interface.
 *
 * The pipeline depends on this rather than on a Supabase client for one
 * practical reason: identity resolution is the judgement that decides whether
 * two rows are the same product, and it has to be tested against the awkward
 * cases — the same GTIN from two networks, no GTIN at all, two genuinely
 * different products with near-identical titles. Those tests are worth having
 * long before a real feed exists, and an in-memory implementation of this
 * interface makes them ordinary unit tests.
 *
 * The Supabase implementation is in `store.supabase.ts` and is the only file in
 * the ingestion path that knows what PostgREST is.
 */

export type Availability =
  'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued' | 'unknown';

export type Gender = 'women' | 'men' | 'unisex' | 'kids';

export type RunStatus = 'succeeded' | 'partial' | 'failed' | 'cancelled';

export type IngestionStage = 'fetch' | 'normalise' | 'validate' | 'match' | 'persist';

export interface ProductInput {
  title: string;
  slug: string;
  description: string | null;
  brandId: string | null;
  categoryId: string | null;
  gender: Gender;
  color: string | null;
  material: string | null;
  imageUrls: string[];
  sourceProviderId: string;
  externalId: string;
}

export interface OfferInput {
  productId: string;
  retailerId: string;
  variantId: string | null;
  priceMinor: number;
  originalMinor: number | null;
  currency: string;
  availability: Availability;
  affiliateUrl: string | null;
  productUrl: string | null;
  providerId: string;
  externalOfferId: string | null;
  observedAt: string;
}

/**
 * What happened to an offer. `unchanged` is distinct from `updated` because a
 * run that touches 50,000 offers and changes two of them is the normal case,
 * and the difference is what makes a feed outage visible.
 */
export interface OfferOutcome {
  created: boolean;
  priceChanged: boolean;
}

export interface MatchQuery {
  identifiers: Array<{ type: string; value: string }>;
  brandId: string | null;
  title: string;
  gender: Gender;
  categoryId: string | null;
  priceMinor: number | null;
  currency: string;
  excludeProductId?: string | undefined;
}

export interface RunCounts {
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsRejected: number;
  recordsSkipped: number;
  offersCreated: number;
  offersUpdated: number;
  priceChanges: number;
  matchesQueued: number;
}

export interface IngestionStore {
  /** The provider's id, or null when it has not been registered yet. */
  findProviderIdBySlug(slug: string): Promise<string | null>;

  beginRun(providerId: string, options: Record<string, unknown>): Promise<string>;
  finishRun(
    runId: string,
    status: RunStatus,
    counts: RunCounts,
    error?: { message: string; details?: unknown } | undefined,
  ): Promise<void>;
  recordError(
    runId: string,
    stage: IngestionStage,
    reason: string,
    externalId: string | null,
    payload?: unknown,
  ): Promise<void>;

  /**
   * Reference data, created on first sight. A feed naming a brand we have
   * never heard of is the normal way a catalogue grows, not an error.
   */
  ensureBrand(name: string): Promise<string>;
  ensureCategory(path: readonly string[]): Promise<string | null>;
  ensureRetailer(slug: string): Promise<string>;

  /** The idempotency lookup: has this provider's item been seen before? */
  findProductBySourceItem(providerId: string, externalId: string): Promise<string | null>;

  findMatches(query: MatchQuery): Promise<MatchCandidate[]>;

  createProduct(input: ProductInput): Promise<string>;
  updateProduct(productId: string, input: Partial<ProductInput>): Promise<void>;

  linkSource(link: {
    productId: string;
    providerId: string;
    externalId: string;
    retailerId: string | null;
    sourceUrl: string | null;
  }): Promise<void>;

  saveIdentifiers(
    productId: string,
    identifiers: readonly NormalisedIdentifier[],
    providerId: string,
  ): Promise<number>;

  /** Returns how many rows were actually queued, ignoring pairs already there. */
  queueMatches(
    productId: string,
    candidates: readonly MatchCandidate[],
    runId: string | null,
  ): Promise<number>;

  upsertOffer(input: OfferInput): Promise<OfferOutcome>;
}
