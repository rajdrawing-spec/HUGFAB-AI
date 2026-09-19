/**
 * Asks an affiliate network what this account can actually see.
 *
 *   npm run affiliate:status -- --provider=admitad
 *   npm run affiliate:status -- --provider=admitad --raw
 *
 * Read-only. It lists ad spaces and programmes and prints what the network
 * says about each. It never joins a programme, never writes to the database
 * and never starts an import — applying to an advertiser accepts their terms,
 * which is a person's decision, not a script's.
 *
 * Why this exists as its own command: "nothing imports" has four common causes
 * — wrong credentials, missing scopes, an inactive ad space, no approved
 * advertiser — and they are indistinguishable from the outside. Each produces
 * a different, named outcome here.
 */

import { z } from 'zod';

import { createAdminSupabase } from '../src/lib/supabase/admin';
import {
  createConfiguredProvider,
  knownProviderSlugs,
  readProviderCredentials,
} from '../src/modules/affiliate/registry';

const providerRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable().catch(null),
});

interface Options {
  provider: string;
  raw: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let provider = '';
  let raw = false;

  for (const arg of argv) {
    if (arg.startsWith('--provider=')) provider = arg.slice('--provider='.length);
    else if (arg === '--raw') raw = true;
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
  return { provider, raw };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const prefix = options.provider.toUpperCase().replace(/-/g, '_');

  // Checked before anything else, because it is the most common answer and the
  // one that needs no network round trip to establish.
  if (readProviderCredentials(options.provider) === null) {
    console.error(
      [
        `No credentials for "${options.provider}".`,
        '',
        `Set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET in the server`,
        'environment — never in the repository. For Admitad these are issued in',
        'the publisher dashboard under Settings -> API, and that page is only',
        'available once the publisher account itself is active.',
        '',
        `Optionally set ${prefix}_WEBSITE_ID to scope the programme list to one`,
        'ad space.',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('affiliate_providers')
    .select('slug, name, is_active, config')
    .eq('slug', options.provider)
    .maybeSingle();

  if (error) throw new Error(`Could not read the provider row: ${error.message}`);
  if (!data) {
    throw new Error(
      `No affiliate_providers row with slug "${options.provider}". ` +
        'Add one before configuring feeds.',
    );
  }

  const row = providerRowSchema.parse(data);
  const provider = createConfiguredProvider(row.slug, row.config ?? {});

  console.log(`${provider.name} (${provider.slug})`);
  console.log(`  provider row is_active: ${row.is_active}`);

  if (provider.describeAccount === undefined) {
    console.log('');
    console.log(
      `  The ${provider.name} adapter cannot introspect an account, so there is` +
        '\n  nothing to report here. This is a limitation of the adapter, not a' +
        '\n  statement that the account is empty.',
    );
    return;
  }

  const report = await provider.describeAccount();

  const section = (title: string, entries: typeof report.adSpaces): void => {
    console.log('');
    console.log(`  ${title} (${entries.length})`);
    if (entries.length === 0) {
      console.log('    none returned');
      return;
    }
    for (const entry of entries) {
      console.log(`    [${entry.id}] ${entry.label} — status: ${entry.status ?? 'n/a'}`);
      if (options.raw) console.log(`      ${JSON.stringify(entry.raw)}`);
    }
  };

  section('Ad spaces', report.adSpaces);
  section('Programmes', report.programmes);

  if (report.problems.length > 0) {
    console.log('');
    console.log('  Problems');
    for (const problem of report.problems) console.log(`    - ${problem}`);
  }

  console.log('');
  console.log(
    '  Nothing here joins a programme or imports anything. Once an advertiser\n' +
      '  has approved this account, add its feed URL to affiliate_providers.config\n' +
      '  and run:  npm run ingest -- --provider=' +
      provider.slug +
      ' --dry-run',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
