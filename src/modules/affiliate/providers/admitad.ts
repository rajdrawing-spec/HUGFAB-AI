import { z } from 'zod';

import { logger } from '@/lib/logger';
import {
  feedConfigSchema,
  mapRecordToProduct,
  parseFeed,
  type FeedConfig,
  type FeedRecord,
} from '../feed';
import type {
  AffiliateProvider,
  FeedPage,
  NormalisedProduct,
  ProviderRuntimeConfig,
} from '../types';

/**
 * The Admitad adapter.
 *
 * What is verified, and what is configuration
 * -------------------------------------------
 * Verified against Admitad's own SDKs and public documentation (September
 * 2026): the API is at `https://api.admitad.com`, authenticates with OAuth 2.0
 * — `client_credentials` is supported alongside the authorization-code flow —
 * at `/token/`, and passes the result as a Bearer token. The publisher API
 * covers campaigns, banners, coupons, deeplinks and statistics.
 *
 * What it does **not** cover is a product catalogue. Admitad's own Publisher
 * SDK exposes no products or feeds resource at all: product data is
 * distributed as downloadable per-advertiser feed files, and the URL of each
 * is issued to an approved publisher through the dashboard. It is not
 * derivable, and it differs per advertiser.
 *
 * So feed URLs, advertiser/campaign ids, retailer attribution and field names
 * are all configuration, read from `affiliate_providers.config` and the
 * environment. None of them appear in this file as literals. That is not only
 * the instruction — it is the only way the adapter can be written before the
 * publisher account exists, and it means approving a second advertiser is a
 * configuration row rather than a deployment.
 *
 * The one thing that must be confirmed against a real feed before this runs in
 * anger is the field mapping. `parseFeed` handles the formats these files come
 * in and `fieldMap` names the columns; if an advertiser's feed calls its
 * barcode something unexpected, the fix is one key in `config`, not a change
 * here. Until then a `--dry-run` reports exactly what it could and could not
 * read.
 */

const ADMITAD_API_BASE = 'https://api.admitad.com';

/**
 * Non-secret settings, mirrored from `affiliate_providers.config`.
 *
 * `apiBaseUrl` is overridable rather than hard-coded so a sandbox or a
 * successor host does not need a code change, and so tests can point it at a
 * local server.
 */
export const admitadSettingsSchema = z.object({
  apiBaseUrl: z.string().url().default(ADMITAD_API_BASE),
  tokenPath: z.string().default('/token/'),
  /**
   * OAuth scopes requested with the token. Admitad issues scopes per
   * application, so the right value is whatever the publisher account was
   * granted — hence configuration.
   */
  scope: z.string().default('advcampaigns deeplink_generator'),
  /**
   * The catalogue files to import. Empty until a publisher application is
   * approved and advertiser feeds are issued, which is the honest state to
   * ship in: the adapter loads, reports that it has no feeds, and imports
   * nothing.
   */
  feeds: z.array(feedConfigSchema).default([]),
  /**
   * Sub-id passed through to the network for attribution, so clicks can be
   * traced back to a surface without the network knowing our users.
   */
  subId: z.string().trim().max(60).optional(),
  /** Deeplink template. `{url}`, `{campaign}` and `{subid}` are substituted. */
  deeplinkTemplate: z.string().optional(),
  /** Seconds. Feed files are large; the default is deliberately generous. */
  requestTimeoutSeconds: z.number().int().positive().max(900).default(300),
});

export type AdmitadSettings = z.infer<typeof admitadSettingsSchema>;

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

/**
 * OAuth 2.0 client credentials against `/token/`.
 *
 * Admitad's documented client-credentials flow sends the id and secret as HTTP
 * Basic, base64 of `client_id:client_secret`, with the scope in the body.
 */
export class AdmitadClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly settings: AdmitadSettings,
    private readonly credentials: { clientId: string; clientSecret: string },
  ) {}

  async accessToken(): Promise<string> {
    // 60 seconds of slack, so a token does not expire between being checked
    // and being used on a request that takes a while.
    if (this.token !== null && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }

    const basic = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`,
      'utf8',
    ).toString('base64');

    const response = await fetch(
      new URL(this.settings.tokenPath, this.settings.apiBaseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.credentials.clientId,
          scope: this.settings.scope,
        }),
      },
    );

    if (!response.ok) {
      // Deliberately does not include the body: an OAuth error response can
      // echo the credentials that were sent.
      throw new Error(
        `Admitad rejected the credentials (HTTP ${response.status}). ` +
          `Check ADMITAD_CLIENT_ID, ADMITAD_CLIENT_SECRET and the requested scope.`,
      );
    }

    const payload = (await response.json()) as TokenResponse;
    if (typeof payload.access_token !== 'string' || payload.access_token === '') {
      throw new Error('Admitad returned no access token.');
    }

    this.token = {
      value: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }

  /** Downloads one catalogue file. Feed hosts are not always the API host. */
  async fetchFeed(feed: FeedConfig): Promise<string> {
    const response = await fetch(feed.url, {
      headers: { Accept: 'application/xml, text/csv, */*' },
      signal: AbortSignal.timeout(this.settings.requestTimeoutSeconds * 1000),
    });

    if (!response.ok) {
      throw new Error(
        `Feed for "${feed.retailerSlug}" returned HTTP ${response.status}.`,
      );
    }
    return response.text();
  }
}

/**
 * One page per configured feed file.
 *
 * Feed files are not paginated by the network — they are whole documents — so
 * the cursor walks the list of configured feeds. A publisher with four
 * approved advertisers therefore does four fetches, and the worker's resume
 * and limit handling works unchanged.
 */
export function createAdmitadProvider(config: ProviderRuntimeConfig): AffiliateProvider {
  const settings = admitadSettingsSchema.parse(config.settings);
  const client = new AdmitadClient(settings, config.credentials);

  // Which feed a record came from decides its retailer and its field mapping,
  // and `normalise` is handed the record alone. Tagging each record as it is
  // parsed keeps `normalise(raw)` a pure function of its argument.
  const FEED_TAG = '__hugfabFeedIndex';

  return {
    slug: 'admitad',
    name: 'Admitad',

    async fetchPage(cursor?: string): Promise<FeedPage> {
      const index = cursor === undefined ? 0 : Number.parseInt(cursor, 10);
      const feed = settings.feeds[index];

      if (feed === undefined) {
        if (index === 0) {
          logger.warn('Admitad is configured with no product feeds; nothing to import', {
            hint: 'add feeds[] to affiliate_providers.config once advertisers are approved',
          });
        }
        return { items: [] };
      }

      const body = await client.fetchFeed(feed);
      const records = parseFeed(body, feed).map((record) => ({
        ...record,
        [FEED_TAG]: index,
      }));

      logger.info('Admitad feed read', {
        retailer: feed.retailerSlug,
        records: records.length,
      });

      const hasMore = index + 1 < settings.feeds.length;
      return { items: records, ...(hasMore ? { nextCursor: String(index + 1) } : {}) };
    },

    normalise(raw: unknown): NormalisedProduct | null {
      if (typeof raw !== 'object' || raw === null) return null;
      const record = raw as FeedRecord;

      const index = record[FEED_TAG];
      const feed = typeof index === 'number' ? settings.feeds[index] : undefined;
      if (feed === undefined) return null;

      return mapRecordToProduct(record, feed);
    },

    buildTrackedUrl(productUrl: string, subId?: string): string {
      const effectiveSubId = subId ?? settings.subId;
      const campaignId = settings.feeds[0]?.campaignId;

      if (settings.deeplinkTemplate !== undefined) {
        return settings.deeplinkTemplate
          .replace('{url}', encodeURIComponent(productUrl))
          .replace('{campaign}', campaignId ?? '')
          .replace('{subid}', effectiveSubId ?? '');
      }

      // No template configured. Returning the plain retailer URL is the right
      // failure: the shopper reaches the product and we earn nothing, rather
      // than following a guessed tracking URL that earns nothing anyway and
      // might not resolve. The pipeline stores null and the click-out path
      // falls back to product_url.
      return productUrl;
    },
  };
}
