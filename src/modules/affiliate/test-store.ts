import { normaliseIdentifier, type NormalisedIdentifier } from './identifiers';
import type { MatchCandidate } from './identity';
import type {
  IngestionStage,
  IngestionStore,
  MatchQuery,
  OfferInput,
  OfferOutcome,
  ProductInput,
  RunCounts,
  RunStatus,
} from './store';

/**
 * An in-memory `IngestionStore`, for exercising the pipeline without a database.
 *
 * It is not a Postgres emulator and does not try to be. It implements exactly
 * one piece of matching logic — exact agreement on a normalised strong
 * identifier — because that is the only rule that causes an automatic merge,
 * and a test of "does the pipeline merge when it should" must not be able to
 * pass by accident.
 *
 * Everything softer is supplied by the test through `attributeCandidates`, so a
 * test states the matcher's answer and then asserts what the pipeline does with
 * it. The matcher's own tiering and its ceilings are proved in SQL, against
 * real Postgres, in `supabase/tests/01_rls_assertions.sql`.
 */

interface StoredProduct extends ProductInput {
  id: string;
}

export class InMemoryIngestionStore implements IngestionStore {
  readonly products = new Map<string, StoredProduct>();
  readonly identifiers = new Map<string, NormalisedIdentifier[]>();
  readonly sourceLinks = new Map<string, string>();
  readonly offers = new Map<string, OfferInput>();
  readonly queuedMatches: Array<{
    productId: string;
    candidates: MatchCandidate[];
  }> = [];
  readonly errors: Array<{ stage: IngestionStage; reason: string }> = [];
  finished: { status: RunStatus; counts: RunCounts } | null = null;

  /** Candidates the fake matcher returns in addition to identifier matches. */
  attributeCandidates: MatchCandidate[] = [];

  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  async findProviderIdBySlug(slug: string): Promise<string | null> {
    return `provider-${slug}`;
  }

  async beginRun(): Promise<string> {
    return 'run-1';
  }

  async finishRun(_runId: string, status: RunStatus, counts: RunCounts): Promise<void> {
    this.finished = { status, counts };
  }

  async recordError(
    _runId: string,
    stage: IngestionStage,
    reason: string,
  ): Promise<void> {
    this.errors.push({ stage, reason });
  }

  async ensureBrand(name: string): Promise<string> {
    return `brand-${name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  async ensureCategory(path: readonly string[]): Promise<string | null> {
    return path.length === 0 ? null : `category-${path.join('/')}`;
  }

  async ensureRetailer(slug: string): Promise<string> {
    return `retailer-${slug}`;
  }

  async findProductBySourceItem(
    providerId: string,
    externalId: string,
  ): Promise<string | null> {
    return this.sourceLinks.get(`${providerId}:${externalId}`) ?? null;
  }

  async findMatches(query: MatchQuery): Promise<MatchCandidate[]> {
    const wanted = new Set<string>();
    for (const identifier of query.identifiers) {
      const canonical = normaliseIdentifier(
        identifier.type as NormalisedIdentifier['type'],
        identifier.value,
      );
      if (canonical !== null) wanted.add(canonical);
    }

    const matches: MatchCandidate[] = [];
    for (const [productId, stored] of this.identifiers) {
      for (const identifier of stored) {
        if (identifier.strong && wanted.has(identifier.value)) {
          matches.push({
            productId,
            method: 'identifier',
            confidence: 0.99,
            signals: { tier: 'strong_identifier', value: identifier.value },
          });
          break;
        }
      }
    }

    return [...matches, ...this.attributeCandidates];
  }

  async createProduct(input: ProductInput): Promise<string> {
    const id = this.nextId('product');
    this.products.set(id, { ...input, id });
    return id;
  }

  async updateProduct(productId: string, input: Partial<ProductInput>): Promise<void> {
    const existing = this.products.get(productId);
    if (existing !== undefined) {
      this.products.set(productId, { ...existing, ...input });
    }
  }

  async linkSource(link: {
    productId: string;
    providerId: string;
    externalId: string;
  }): Promise<void> {
    this.sourceLinks.set(`${link.providerId}:${link.externalId}`, link.productId);
  }

  async saveIdentifiers(
    productId: string,
    identifiers: readonly NormalisedIdentifier[],
  ): Promise<number> {
    const existing = this.identifiers.get(productId) ?? [];
    const merged = [...existing];
    for (const identifier of identifiers) {
      if (
        !merged.some((m) => m.type === identifier.type && m.value === identifier.value)
      ) {
        merged.push(identifier);
      }
    }
    this.identifiers.set(productId, merged);
    return merged.length - existing.length;
  }

  async queueMatches(
    productId: string,
    candidates: readonly MatchCandidate[],
  ): Promise<number> {
    this.queuedMatches.push({ productId, candidates: [...candidates] });
    return candidates.length;
  }

  async upsertOffer(input: OfferInput): Promise<OfferOutcome> {
    // Mirrors `unique nulls not distinct (product_id, variant_id, retailer_id)`.
    const key = `${input.productId}:${input.variantId ?? 'null'}:${input.retailerId}`;
    const existing = this.offers.get(key);
    this.offers.set(key, input);

    if (existing === undefined) return { created: true, priceChanged: false };
    return {
      created: false,
      priceChanged: existing.priceMinor !== input.priceMinor,
    };
  }
}
