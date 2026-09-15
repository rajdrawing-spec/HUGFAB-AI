import { logger } from '@/lib/logger';
import { ingestProduct, type PipelineContext } from './pipeline';
import type { IngestionStore, RunCounts, RunStatus } from './store';
import { normalisedProductSchema } from './types';
import type { AffiliateProvider, IngestionSummary } from './types';

/**
 * Runs one provider's feed, start to finish.
 *
 * Everything this file does is in service of one idea: an import that goes
 * wrong should say so. A feed that silently stops updating prices is worse than
 * a feed that fails loudly — the site keeps serving last month's prices, looks
 * perfectly healthy, and sends shoppers to a retailer who will charge them
 * something else. So every row is accounted for, the counts must add up, and a
 * run that rejected an unusual share of its input finishes as `partial` rather
 * than `succeeded`.
 *
 * Provider-agnostic: it holds an `AffiliateProvider` and never asks which one.
 */

/**
 * Above this share of rejected rows, the run is `partial`. A feed drops the odd
 * malformed row every night; a feed that drops one row in twenty has changed
 * its format and nobody has noticed yet.
 */
const PARTIAL_REJECTION_RATE = 0.05;

/**
 * Detailed error rows kept per run. A feed that rejects everything would
 * otherwise write a diagnostic row per item, turning a bad import into a
 * storage problem. The count in `ingestion_runs` stays exact either way.
 */
const MAX_RECORDED_ERRORS = 200;

/** A page count no real feed reaches, so a provider paginating in a circle stops. */
const MAX_PAGES = 10_000;

export interface IngestionOptions {
  provider: AffiliateProvider;
  store: IngestionStore;
  /** Stop after this many items. For a first run against a new network. */
  limit?: number | undefined;
  /** Parse and match, but write nothing. */
  dryRun?: boolean | undefined;
  onProgress?: ((counts: RunCounts) => void) | undefined;
}

export async function runIngestion(options: IngestionOptions): Promise<IngestionSummary> {
  const { provider, store, limit, dryRun = false } = options;
  const startedAt = new Date().toISOString();

  const providerId = await store.findProviderIdBySlug(provider.slug);
  if (providerId === null) {
    // Not an exception the worker can recover from: without a provider row
    // there is nowhere to attribute the offers, the run or the commission.
    throw new Error(
      `Provider "${provider.slug}" is not registered in affiliate_providers. ` +
        `Insert the row (slug, name, is_active) before running ingestion.`,
    );
  }

  const counts: RunCounts = {
    recordsReceived: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsRejected: 0,
    recordsSkipped: 0,
    offersCreated: 0,
    offersUpdated: 0,
    priceChanges: 0,
    matchesQueued: 0,
  };

  const runId = dryRun
    ? null
    : await store.beginRun(providerId, { limit: limit ?? null, dryRun });

  let recordedErrors = 0;
  const reject = async (
    stage: 'fetch' | 'normalise' | 'validate' | 'match' | 'persist',
    reason: string,
    externalId: string | null,
    payload?: unknown,
  ): Promise<void> => {
    counts.recordsRejected += 1;
    if (runId === null || recordedErrors >= MAX_RECORDED_ERRORS) return;
    recordedErrors += 1;
    await store.recordError(runId, stage, reason, externalId, payload);
  };

  const context: PipelineContext = {
    store,
    providerId,
    runId,
    buildTrackedUrl: (url, subId) => provider.buildTrackedUrl(url, subId),
  };

  let cursor: string | undefined;
  let pages = 0;

  try {
    do {
      const page = await provider.fetchPage(cursor);
      pages += 1;

      for (const raw of page.items) {
        if (limit !== undefined && counts.recordsReceived >= limit) break;
        counts.recordsReceived += 1;

        const normalised = safeNormalise(provider, raw);
        if (normalised === null) {
          await reject('normalise', 'provider could not normalise the item', null, raw);
          continue;
        }

        // The provider is expected to have validated already. Re-validating is
        // cheap and turns "an adapter returned something not quite right" into
        // a counted rejection rather than a database error halfway through.
        const parsed = normalisedProductSchema.safeParse(normalised);
        if (!parsed.success) {
          await reject(
            'validate',
            parsed.error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; '),
            readExternalId(normalised),
            raw,
          );
          continue;
        }

        if (dryRun) {
          counts.recordsSkipped += 1;
          continue;
        }

        try {
          const result = await ingestProduct(parsed.data, context);
          if (result.outcome === 'created') counts.recordsCreated += 1;
          else counts.recordsUpdated += 1;

          counts.offersCreated += result.offersCreated;
          counts.offersUpdated += result.offersUpdated;
          counts.priceChanges += result.priceChanges;
          counts.matchesQueued += result.matchesQueued;
        } catch (error) {
          await reject('persist', describeError(error), parsed.data.externalId, raw);
        }
      }

      options.onProgress?.({ ...counts });

      cursor = page.nextCursor;
      if (limit !== undefined && counts.recordsReceived >= limit) break;
    } while (cursor !== undefined && pages < MAX_PAGES);
  } catch (error) {
    // A fetch that fails part way through has still done real work: the offers
    // already written are correct and stay. The run is marked failed so nobody
    // mistakes a partial catalogue for a complete one.
    const message = describeError(error);
    logger.error('ingestion run failed', error, { provider: provider.slug });

    if (runId !== null) {
      await store.finishRun(runId, 'failed', counts, { message });
    }
    return summarise(provider.slug, runId, 'failed', counts, startedAt, message);
  }

  const status = decideStatus(counts);
  if (runId !== null) {
    await store.finishRun(runId, status, counts);
  }

  return summarise(provider.slug, runId, status, counts, startedAt);
}

/**
 * `normalise` is adapter code running over a third party's data. It is
 * specified to return null rather than throw, but a feed will eventually find
 * the input that makes it throw anyway, and one bad row must not end a run of
 * fifty thousand.
 */
function safeNormalise(
  provider: AffiliateProvider,
  raw: unknown,
): ReturnType<AffiliateProvider['normalise']> {
  try {
    return provider.normalise(raw);
  } catch {
    return null;
  }
}

function decideStatus(counts: RunCounts): Exclude<RunStatus, 'cancelled'> {
  if (counts.recordsReceived === 0) return 'succeeded';
  const rate = counts.recordsRejected / counts.recordsReceived;
  return rate > PARTIAL_REJECTION_RATE ? 'partial' : 'succeeded';
}

function readExternalId(value: unknown): string | null {
  if (typeof value === 'object' && value !== null && 'externalId' in value) {
    const id = (value as { externalId: unknown }).externalId;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function summarise(
  provider: string,
  runId: string | null,
  status: 'succeeded' | 'partial' | 'failed',
  counts: RunCounts,
  startedAt: string,
  errorMessage?: string,
): IngestionSummary {
  return {
    runId,
    provider,
    status,
    ...counts,
    startedAt,
    finishedAt: new Date().toISOString(),
    errorMessage,
  };
}
