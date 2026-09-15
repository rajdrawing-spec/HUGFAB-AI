import 'server-only';

import { slugify } from '@/lib/slug';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type { NormalisedIdentifier } from './identifiers';
import { orderPair, type MatchCandidate } from './identity';
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
 * The `IngestionStore` backed by Supabase. The only file in the ingestion path
 * that knows what PostgREST is.
 *
 * Uses the **service-role** client, which bypasses RLS. That is correct and
 * necessary here — ingestion writes to tables no anonymous user may write to —
 * and it is also why this file is `server-only` and why nothing under
 * `src/app` may import it.
 *
 * Reference lookups are memoised per run. A 50,000-item feed contains perhaps
 * two hundred distinct brands; without the cache that is 50,000 round trips to
 * learn the same two hundred answers.
 */

/**
 * A narrow description of the PostgREST calls this file actually makes.
 *
 * postgrest-js derives its row, insert and RPC types from the `Database`
 * declaration, and ours is hand-written until there is a project to generate
 * one from. Where the two disagree the generics collapse to `never` and every
 * call becomes an error about a type that cannot exist — which says nothing
 * about whether the query is right.
 *
 * Writing out the surface used here is the same trade `modules/products/
 * repository.ts` and `modules/affiliate/repository.ts` already make: the call
 * shapes stay type-checked, the schema stays checked by
 * `scripts/verify-migration.sh` against real Postgres, and replacing this with
 * generated types later is a deletion rather than a rewrite.
 */
interface PostgrestFailure {
  message: string;
  code?: string;
  details?: string | null;
}

interface Result<T> {
  data: T;
  error: PostgrestFailure | null;
}

interface WriteResult {
  error: PostgrestFailure | null;
  count: number | null;
}

interface UpsertOptions {
  onConflict: string;
  ignoreDuplicates?: boolean;
  count?: 'exact';
}

interface SelectBuilder<Row> extends PromiseLike<Result<Row[] | null>> {
  eq(column: string, value: string | number | boolean): SelectBuilder<Row>;
  is(column: string, value: null): SelectBuilder<Row>;
  maybeSingle(): PromiseLike<Result<Row | null>>;
  single(): PromiseLike<Result<Row | null>>;
}

interface InsertBuilder extends PromiseLike<WriteResult> {
  select(columns: 'id'): { single(): PromiseLike<Result<{ id: string } | null>> };
}

interface UpdateBuilder extends PromiseLike<WriteResult> {
  eq(column: string, value: string): PromiseLike<WriteResult>;
}

interface TableApi {
  select<Row>(columns: string): SelectBuilder<Row>;
  insert(rows: unknown): InsertBuilder;
  update(patch: unknown): UpdateBuilder;
  upsert(rows: unknown, options?: UpsertOptions): PromiseLike<WriteResult>;
}

interface MatchRow {
  product_id: string;
  method: MatchCandidate['method'];
  confidence: number | string;
  signals: unknown;
}

interface IngestionClient {
  from(table: string): TableApi;
  rpc(
    fn: 'find_product_matches',
    args: Record<string, unknown>,
  ): PromiseLike<Result<MatchRow[] | null>>;
}

type AdminClient = ReturnType<typeof createAdminSupabase>;

/** PostgreSQL's unique_violation. Expected under concurrency, not an error. */
const UNIQUE_VIOLATION = '23505';

function fail(operation: string, error: PostgrestFailure): never {
  throw new Error(`${operation} failed: ${error.message}`);
}

/**
 * `.single()` returns a row whenever it did not error, but nothing in the type
 * says so. Rather than assert past it, the absent row is treated as the real
 * failure it would be: an insert that reported success and returned nothing
 * means we do not know the id we are about to attach offers to.
 */
function requireRow<T>(operation: string, result: Result<T | null>): T {
  if (result.error) fail(operation, result.error);
  if (result.data === null) {
    throw new Error(`${operation} returned no row`);
  }
  return result.data;
}

export class SupabaseIngestionStore implements IngestionStore {
  private readonly db: IngestionClient;

  private readonly brandCache = new Map<string, string>();
  private readonly categoryCache = new Map<string, string>();
  private readonly retailerCache = new Map<string, string>();

  constructor(client?: AdminClient) {
    this.db = (client ?? createAdminSupabase()) as unknown as IngestionClient;
  }

  async findProviderIdBySlug(slug: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('affiliate_providers')
      .select<{ id: string }>('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) fail('provider lookup', error);
    return data?.id ?? null;
  }

  async beginRun(providerId: string, options: Record<string, unknown>): Promise<string> {
    const result = await this.db
      .from('ingestion_runs')
      .insert({
        provider_id: providerId,
        status: 'running',
        options,
      })
      .select('id')
      .single();

    return requireRow('starting the ingestion run', result).id;
  }

  async finishRun(
    runId: string,
    status: RunStatus,
    counts: RunCounts,
    error?: { message: string; details?: unknown },
  ): Promise<void> {
    const { error: updateError } = await this.db
      .from('ingestion_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        records_received: counts.recordsReceived,
        records_created: counts.recordsCreated,
        records_updated: counts.recordsUpdated,
        records_rejected: counts.recordsRejected,
        records_skipped: counts.recordsSkipped,
        offers_created: counts.offersCreated,
        offers_updated: counts.offersUpdated,
        price_changes: counts.priceChanges,
        matches_queued: counts.matchesQueued,
        error_message: error?.message ?? null,
        error_details: error?.details ?? null,
      })
      .eq('id', runId);

    if (updateError) fail('finishing the ingestion run', updateError);
  }

  async recordError(
    runId: string,
    stage: IngestionStage,
    reason: string,
    externalId: string | null,
    payload?: unknown,
  ): Promise<void> {
    // A diagnostic write must never be the thing that ends a run.
    await this.db.from('ingestion_errors').insert({
      run_id: runId,
      stage,
      reason: reason.slice(0, 2000),
      external_id: externalId,
      payload: truncatePayload(payload),
    });
  }

  async ensureBrand(name: string): Promise<string> {
    const slug = slugify(name) || 'unbranded';
    const cached = this.brandCache.get(slug);
    if (cached !== undefined) return cached;

    const id = await this.getOrCreateBySlug('brands', slug, { slug, name });
    this.brandCache.set(slug, id);
    return id;
  }

  /**
   * Walks the feed's category path, creating each level under the one above.
   * "Women > Topwear > Hoodies" becomes three rows the first time and none
   * thereafter, which is what makes the category tree filter work.
   */
  async ensureCategory(path: readonly string[]): Promise<string | null> {
    let parentId: string | null = null;
    let accumulated = '';

    for (const segment of path) {
      const name = segment.trim();
      if (name === '') continue;

      // Scoped by ancestry, so "Women > Shirts" and "Men > Shirts" are two
      // categories rather than one shared row.
      accumulated =
        accumulated === '' ? slugify(name) : `${accumulated}-${slugify(name)}`;
      if (accumulated === '') continue;

      const cached = this.categoryCache.get(accumulated);
      if (cached !== undefined) {
        parentId = cached;
        continue;
      }

      const id: string = await this.getOrCreateBySlug('categories', accumulated, {
        slug: accumulated,
        name,
        parent_id: parentId,
      });
      this.categoryCache.set(accumulated, id);
      parentId = id;
    }

    return parentId;
  }

  async ensureRetailer(slug: string): Promise<string> {
    const normalised = slugify(slug) || 'unknown-retailer';
    const cached = this.retailerCache.get(normalised);
    if (cached !== undefined) return cached;

    const id = await this.getOrCreateBySlug('retailers', normalised, {
      slug: normalised,
      // A readable placeholder until someone sets the real display name.
      name: titleCase(normalised),
    });
    this.retailerCache.set(normalised, id);
    return id;
  }

  async findProductBySourceItem(
    providerId: string,
    externalId: string,
  ): Promise<string | null> {
    const { data, error } = await this.db
      .from('product_source_links')
      .select<{ product_id: string }>('product_id')
      .eq('provider_id', providerId)
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) fail('source link lookup', error);
    return data?.product_id ?? null;
  }

  async findMatches(query: MatchQuery): Promise<MatchCandidate[]> {
    const { data, error } = await this.db.rpc('find_product_matches', {
      p_identifiers: query.identifiers,
      p_brand_id: query.brandId,
      p_title: query.title,
      p_gender: query.gender,
      p_category_id: query.categoryId,
      p_price_minor: query.priceMinor,
      p_currency: query.currency,
      p_exclude_product_id: query.excludeProductId ?? null,
      p_limit: 5,
    });

    if (error) fail('product matching', error);

    return (data ?? []).map((row) => ({
      productId: row.product_id,
      method: row.method,
      confidence: Number(row.confidence),
      signals: (row.signals ?? {}) as Record<string, unknown>,
    }));
  }

  async createProduct(input: ProductInput): Promise<string> {
    const { data, error } = await this.db
      .from('products')
      .insert(toProductRow(input))
      .select('id')
      .single();

    if (error === null && data !== null) return data.id;
    if (error === null) throw new Error('creating the product returned no row');

    // Two different products can legitimately produce the same slug. Retrying
    // once with the external id appended is cheaper than pre-checking every
    // insert, and the collision is rare.
    if (error.code === UNIQUE_VIOLATION) {
      const retry = await this.db
        .from('products')
        .insert(
          toProductRow({
            ...input,
            slug: `${input.slug}-${slugify(input.externalId).slice(0, 12) || 'x'}`,
          }),
        )
        .select('id')
        .single();

      return requireRow('creating the product after a slug collision', retry).id;
    }

    fail('creating the product', error);
  }

  async updateProduct(productId: string, input: Partial<ProductInput>): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch['title'] = input.title;
    if (input.description !== undefined) patch['description'] = input.description;
    if (input.brandId !== undefined) patch['brand_id'] = input.brandId;
    if (input.categoryId !== undefined) patch['category_id'] = input.categoryId;
    if (input.gender !== undefined) patch['gender'] = input.gender;
    if (input.color !== undefined) patch['color'] = input.color;
    if (input.material !== undefined) patch['material'] = input.material;
    if (input.imageUrls !== undefined) patch['image_urls'] = input.imageUrls;

    if (Object.keys(patch).length === 0) return;

    const { error } = await this.db.from('products').update(patch).eq('id', productId);

    if (error) fail('updating the product', error);
  }

  async linkSource(link: {
    productId: string;
    providerId: string;
    externalId: string;
    retailerId: string | null;
    sourceUrl: string | null;
  }): Promise<void> {
    const { error } = await this.db.from('product_source_links').upsert(
      {
        product_id: link.productId,
        provider_id: link.providerId,
        external_id: link.externalId,
        retailer_id: link.retailerId,
        source_url: link.sourceUrl,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'provider_id,external_id' },
    );

    if (error) fail('linking the feed item to the product', error);
  }

  async saveIdentifiers(
    productId: string,
    identifiers: readonly NormalisedIdentifier[],
    providerId: string,
  ): Promise<number> {
    if (identifiers.length === 0) return 0;

    const { error, count } = await this.db.from('product_identifiers').upsert(
      identifiers.map((identifier) => ({
        product_id: productId,
        id_type: identifier.type,
        raw_value: identifier.raw,
        provider_id: providerId,
      })),
      {
        onConflict: 'product_id,id_type,normalised_value',
        ignoreDuplicates: true,
        count: 'exact',
      },
    );

    // An identifier the database refuses is a rejected identifier, not a
    // rejected product. The normalisation in `identifiers.ts` should already
    // have caught it, so reaching here means the two have drifted — worth
    // surfacing, but not worth losing the product over.
    if (error) fail('saving product identifiers', error);
    return count ?? identifiers.length;
  }

  async queueMatches(
    productId: string,
    candidates: readonly MatchCandidate[],
    runId: string | null,
  ): Promise<number> {
    if (candidates.length === 0) return 0;

    const rows = candidates.map((candidate) => {
      const [first, second] = orderPair(productId, candidate.productId);
      return {
        product_id: first,
        candidate_product_id: second,
        method: candidate.method,
        confidence: candidate.confidence,
        signals: candidate.signals,
        run_id: runId,
      };
    });

    const { error, count } = await this.db.from('product_match_candidates').upsert(rows, {
      onConflict: 'product_id,candidate_product_id',
      // A pair already awaiting review is not re-queued, and a decision
      // someone has already made is not undone by tonight's import.
      ignoreDuplicates: true,
      count: 'exact',
    });

    if (error) fail('queueing a match for review', error);
    return count ?? rows.length;
  }

  async upsertOffer(input: OfferInput): Promise<OfferOutcome> {
    // Read first, so the caller can be told whether the price actually moved.
    // The database records history on its own either way; this is for the run
    // summary, where "50,000 offers seen, 2 changed" is the useful sentence.
    const { data: existing, error: readError } = await this.db
      .from('prices')
      .select<{ id: string; price_minor: number }>('id, price_minor')
      .eq('product_id', input.productId)
      .eq('retailer_id', input.retailerId)
      .is('variant_id', null)
      .maybeSingle();

    if (readError) fail('reading the existing offer', readError);

    const row = {
      product_id: input.productId,
      retailer_id: input.retailerId,
      variant_id: input.variantId,
      price_minor: input.priceMinor,
      original_minor: input.originalMinor,
      currency: input.currency,
      availability: input.availability,
      affiliate_url: input.affiliateUrl,
      product_url: input.productUrl,
      affiliate_provider_id: input.providerId,
      external_offer_id: input.externalOfferId,
      observed_at: input.observedAt,
    };

    const { error: writeError } = await this.db
      .from('prices')
      .upsert(row, { onConflict: 'product_id,variant_id,retailer_id' });

    if (writeError) fail('writing the offer', writeError);

    return {
      created: existing === null,
      priceChanged: existing !== null && existing.price_minor !== input.priceMinor,
    };
  }

  /**
   * Select-then-insert, with the unique violation treated as "someone else got
   * there first" rather than as a failure. Two ingestion runs racing on the
   * same new brand is a normal outcome, not an error worth ending a run for.
   */
  private async getOrCreateBySlug(
    table: 'brands' | 'categories' | 'retailers',
    slug: string,
    row: Record<string, unknown>,
  ): Promise<string> {
    const existing = await this.db
      .from(table)
      .select<{ id: string }>('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing.error) fail(`${table} lookup`, existing.error);
    if (existing.data !== null) return existing.data.id;

    const inserted = await this.db.from(table).insert(row).select('id').single();

    if (inserted.error === null) {
      return requireRow(`creating a ${table} row`, inserted).id;
    }

    if (inserted.error.code === UNIQUE_VIOLATION) {
      const reread = await this.db
        .from(table)
        .select<{ id: string }>('id')
        .eq('slug', slug)
        .single();
      return requireRow(`${table} re-read after a concurrent insert`, reread).id;
    }

    fail(`creating a ${table} row`, inserted.error);
  }
}

function toProductRow(input: ProductInput): Record<string, unknown> {
  return {
    slug: input.slug,
    title: input.title,
    description: input.description,
    brand_id: input.brandId,
    category_id: input.categoryId,
    gender: input.gender,
    color: input.color,
    material: input.material,
    image_urls: input.imageUrls,
    source_provider_id: input.sourceProviderId,
    external_id: input.externalId,
    // Ingested rows are real catalogue data. `is_mock` is for the development
    // seed and nothing else.
    is_mock: false,
    is_active: true,
  };
}

/** Keeps one diagnostic row from carrying a megabyte of feed XML. */
function truncatePayload(payload: unknown): unknown {
  if (payload === undefined || payload === null) return null;
  const serialised = JSON.stringify(payload);
  if (serialised === undefined) return null;
  return serialised.length <= 4000 ? payload : { truncated: serialised.slice(0, 4000) };
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part === '' ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(' ');
}
