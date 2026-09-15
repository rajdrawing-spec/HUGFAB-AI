import 'server-only';

import { createAdmitadProvider } from './providers/admitad';
import type {
  AffiliateProvider,
  AffiliateProviderFactory,
  ProviderCredentials,
  ProviderRuntimeConfig,
} from './types';

/**
 * Which adapters exist, and how one is built.
 *
 * Adding Cuelinks, Impact or vCommission is two lines here plus the adapter
 * file. Nothing else in the application — not the pipeline, not the worker, not
 * a single component — needs to know a new network exists.
 */
const FACTORIES: Readonly<Record<string, AffiliateProviderFactory>> = {
  admitad: createAdmitadProvider,
};

export function knownProviderSlugs(): string[] {
  return Object.keys(FACTORIES).sort();
}

/**
 * Credentials by convention: a provider's slug, upper-cased, is its environment
 * prefix. `admitad` reads `ADMITAD_CLIENT_ID`, `ADMITAD_CLIENT_SECRET` and
 * `ADMITAD_WEBSITE_ID`; `vcommission` would read `VCOMMISSION_*`.
 *
 * A convention rather than a list because the alternative is editing the
 * environment schema for every network, and the schema would then name
 * credentials for networks nobody has signed up to. Read here and nowhere else
 * — no adapter touches `process.env` itself.
 */
export function readProviderCredentials(slug: string): ProviderCredentials | null {
  const prefix = slug.toUpperCase().replace(/-/g, '_');
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    websiteId: process.env[`${prefix}_WEBSITE_ID`],
  };
}

export function createProvider(
  slug: string,
  config: ProviderRuntimeConfig,
): AffiliateProvider {
  const factory = FACTORIES[slug];
  if (factory === undefined) {
    throw new Error(
      `No adapter for provider "${slug}". Known providers: ${knownProviderSlugs().join(', ')}.`,
    );
  }
  return factory(config);
}

/**
 * Builds a provider from its stored settings and the environment.
 *
 * `settings` comes from `affiliate_providers.config`, which holds non-secret
 * configuration only — feed URLs, advertiser ids, field mappings. Credentials
 * never go in the database; they come from the environment, so a database dump
 * cannot leak them.
 */
export function createConfiguredProvider(
  slug: string,
  settings: Record<string, unknown>,
): AffiliateProvider {
  const credentials = readProviderCredentials(slug);
  if (credentials === null) {
    const prefix = slug.toUpperCase().replace(/-/g, '_');
    throw new Error(
      `Credentials for "${slug}" are not configured. ` +
        `Set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET in the environment.`,
    );
  }

  return createProvider(slug, { settings, credentials });
}
