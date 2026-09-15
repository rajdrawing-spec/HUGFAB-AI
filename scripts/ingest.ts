/**
 * Runs one provider's feed import.
 *
 *   npm run ingest -- --provider=admitad
 *   npm run ingest -- --provider=admitad --limit=100 --dry-run
 *
 * A script rather than a route handler on purpose. A catalogue import takes
 * minutes and streams tens of thousands of rows; an HTTP request is the wrong
 * shape for that and would time out behind Passenger long before the feed
 * finished. Cron calls this.
 *
 * Writes with the service-role key, so it is never reachable from the browser.
 */

import { z } from 'zod';

import { createAdminSupabase } from '../src/lib/supabase/admin';
import {
  createConfiguredProvider,
  knownProviderSlugs,
} from '../src/modules/affiliate/registry';
import { SupabaseIngestionStore } from '../src/modules/affiliate/store.supabase';
import { runIngestion } from '../src/modules/affiliate/worker';

/**
 * The provider row, parsed rather than inferred.
 *
 * postgrest-js derives its result types from the hand-written `Database`
 * declaration and collapses to `never` where the two disagree, which says
 * nothing about whether the query is right. Parsing means a drift is a clear
 * error here — the same trade the repository layer makes.
 */
const providerRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable().catch(null),
});

interface Options {
  provider: string;
  limit: number | undefined;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let provider = '';
  let limit: number | undefined;
  let dryRun = false;

  for (const arg of argv) {
    if (arg.startsWith('--provider=')) provider = arg.slice('--provider='.length);
    else if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`--limit must be a positive integer, got "${arg}"`);
      }
      limit = parsed;
    } else if (arg === '--dry-run') dryRun = true;
    else throw new Error(`Unrecognised argument "${arg}"`);
  }

  if (provider === '') {
    throw new Error(
      `--provider is required. Known providers: ${knownProviderSlugs().join(', ')}.`,
    );
  }
  if (!knownProviderSlugs().includes(provider)) {
    throw new Error(
      `No adapter for "${provider}". Known providers: ${knownProviderSlugs().join(', ')}.`,
    );
  }

  return { provider, limit, dryRun };
}

async function main(): Promise<void> {
  // Arguments first: a typo in a provider name should not need a database
  // connection to be reported.
  const options = parseArgs(process.argv.slice(2));
  const db = createAdminSupabase();

  // Settings live in the database so a feed can be added or re-pointed without
  // a deployment. Credentials never do — they come from the environment.
  const { data, error } = await db
    .from('affiliate_providers')
    .select('id, slug, name, is_active, config')
    .eq('slug', options.provider)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the provider row: ${error.message}`);
  }
  if (data === null) {
    throw new Error(
      `Provider "${options.provider}" has no row in affiliate_providers. ` +
        `Insert one with its slug, name and config before importing.`,
    );
  }

  const row = providerRowSchema.parse(data);

  if (!row.is_active && !options.dryRun) {
    throw new Error(
      `Provider "${options.provider}" is marked inactive. ` +
        `Set is_active = true to import from it, or pass --dry-run.`,
    );
  }

  const provider = createConfiguredProvider(row.slug, row.config ?? {});

  const summary = await runIngestion({
    provider,
    store: new SupabaseIngestionStore(db),
    limit: options.limit,
    dryRun: options.dryRun,
    onProgress: (counts) => {
      process.stdout.write(
        `  ...${counts.recordsReceived} read, ${counts.recordsCreated} new, ` +
          `${counts.recordsUpdated} updated, ${counts.recordsRejected} rejected\n`,
      );
    },
  });

  process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);

  // A partial run is a real outcome, not a success. Exiting non-zero lets cron
  // and CI notice without anybody reading the logs.
  if (summary.status !== 'succeeded') {
    process.stderr.write(`\nRun finished as "${summary.status}".\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `\n[hugfab] ingestion failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
