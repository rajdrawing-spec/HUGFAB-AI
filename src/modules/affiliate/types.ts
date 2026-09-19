import { z } from 'zod';

import { IDENTIFIER_TYPES } from './identifiers';

/**
 * The affiliate boundary.
 *
 * Networks change — Cuelinks today, Admitad tomorrow, Amazon when the account
 * is approved. Every one of them speaks a different dialect, and none of that
 * dialect is allowed past this file: a provider's job is to turn its own shape
 * into `NormalisedProduct`, which is validated before it goes anywhere
 * (PRD §23, §24).
 *
 * If a screen or a database column ever has to know which network a product
 * came from in order to render it, this boundary has failed.
 */

export const normalisedOfferSchema = z.object({
  /** The retailer's own identifier, used to make ingestion an idempotent upsert. */
  externalId: z.string().trim().min(1).max(200),
  retailerSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** Integer minor units. A provider handing us "₹1,899" converts before here. */
  priceMinor: z.number().int().nonnegative(),
  originalMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  availability: z.enum([
    'in_stock',
    'out_of_stock',
    'preorder',
    'discontinued',
    'unknown',
  ]),
  productUrl: z.string().url(),
  /** Null until the network's tracking wrapper is applied. */
  affiliateUrl: z.string().url().nullable(),
});

/**
 * One real-world identifier as a feed reported it.
 *
 * Unvalidated on purpose: a provider says what it was told, and
 * `normaliseIdentifiers` decides what survives. A provider adapter that
 * silently dropped a malformed barcode would hide a broken feed; dropping it
 * one layer later means it is counted.
 */
export const rawIdentifierSchema = z.object({
  type: z.enum(IDENTIFIER_TYPES),
  value: z.string().trim().min(1).max(200),
});

export const normalisedProductSchema = z
  .object({
    externalId: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(5000).nullable(),
    brandName: z.string().trim().max(200).nullable(),
    categoryPath: z.array(z.string().trim().min(1)).max(6),
    gender: z.enum(['women', 'men', 'unisex', 'kids']),
    color: z.string().trim().max(100).nullable(),
    material: z.string().trim().max(200).nullable(),
    /**
     * Remote URLs only. Retailer images are hotlinked or CDN-proxied per feed
     * terms, never copied into our storage (PRD §32, §74).
     */
    imageUrls: z.array(z.string().url()).max(20),

    /**
     * Everything the feed claims identifies this product: GTIN/EAN/UPC/ISBN,
     * ASIN, MPN, SKU, style code. Usually empty, frequently wrong, and the
     * only thing that will ever merge two products automatically — so it is
     * carried as a list of claims rather than a single trusted field.
     */
    identifiers: z.array(rawIdentifierSchema).max(20).default([]),

    /**
     * The brand's own model or article code, when the feed labels it clearly
     * enough to be worth keeping outside `identifiers`. Display only.
     */
    modelName: z.string().trim().max(200).nullable().default(null),

    offers: z.array(normalisedOfferSchema).min(1),
  })
  .refine(
    (product) =>
      product.offers.every(
        (o) => o.originalMinor === null || o.originalMinor >= o.priceMinor,
      ),
    {
      message: 'an original price below the current price is bad data, not a discount',
      path: ['offers'],
    },
  );

export type NormalisedOffer = z.infer<typeof normalisedOfferSchema>;
export type NormalisedProduct = z.infer<typeof normalisedProductSchema>;

export interface FeedPage {
  items: unknown[];
  /** Absent when the feed is exhausted. */
  nextCursor?: string;
}

/**
 * What every network adapter implements. The ingestion worker knows only this
 * interface, so adding a network is a new file rather than a new branch in the
 * pipeline.
 */
/**
 * Everything a provider adapter needs in order to run, supplied from the
 * environment and the `affiliate_providers.config` row.
 *
 * Adapters read their settings from here rather than from `process.env`
 * directly. That is what keeps advertiser ids, feed URLs, credentials and
 * retailer assumptions out of the code: adding a second Admitad advertiser is
 * a configuration row, not a deployment.
 */
export interface ProviderCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  /** The publisher's own site/space id with the network, when it uses one. */
  readonly websiteId?: string | undefined;
}

export interface ProviderRuntimeConfig {
  /** Non-secret settings, mirrored from `affiliate_providers.config`. */
  readonly settings: Record<string, unknown>;
  readonly credentials: ProviderCredentials;
}

export interface AffiliateProvider {
  readonly slug: string;
  readonly name: string;

  /** Raw items, in whatever shape the network returns. */
  fetchPage(cursor?: string): Promise<FeedPage>;

  /**
   * One raw item to a validated `NormalisedProduct`, or `null` when the item
   * cannot be trusted. Returning null rather than throwing is deliberate: one
   * malformed row in a feed of 50,000 should be dropped and counted, not abort
   * the run.
   */
  normalise(raw: unknown): NormalisedProduct | null;

  /** Wrap a retailer URL in this network's tracking parameters. */
  buildTrackedUrl(productUrl: string, subId?: string): string;

  /**
   * Ask the network what this account can actually see: which ad spaces exist,
   * which programmes are joinable, which are already joined.
   *
   * Optional because it is not a capability every network has, and a network
   * without it must not be forced to fake one. `affiliate:status` reports that
   * the adapter cannot introspect rather than printing an empty result that
   * looks like "you are approved for nothing".
   *
   * Read-only by contract. Nothing here joins a programme or changes account
   * state — that is a decision for a person in the dashboard, not a script.
   */
  describeAccount?(): Promise<ProviderAccountReport>;
}

/**
 * What an account looks like from the outside, normalised across networks.
 *
 * Deliberately shallow. Every network models programmes and placements
 * differently, and flattening those differences into a rich shared type would
 * mean guessing at fields this code has never seen a real response for. Each
 * entry therefore carries the few things every network has — an id, a label, a
 * state — plus `raw`, which is whatever the network actually sent.
 *
 * That last field is the point: the first time this runs against a live
 * account, `raw` is the evidence for what the real shape is, and the typed
 * fields can be tightened afterwards against something observed rather than
 * assumed.
 */
export interface ProviderAccountEntry {
  id: string;
  label: string;
  /** The network's own status string, verbatim. Not interpreted. */
  status: string | null;
  raw: Record<string, unknown>;
}

export interface ProviderAccountReport {
  /** Placements — Admitad calls these ad spaces or websites. */
  adSpaces: ProviderAccountEntry[];
  /** Programmes this account may join or has joined. */
  programmes: ProviderAccountEntry[];
  /**
   * Anything the adapter could not retrieve, with the reason. A partial report
   * is more useful than an exception: "ad spaces read, programmes refused with
   * 403" locates the problem, where a thrown error only says something failed.
   */
  problems: string[];
}

/**
 * A provider adapter is constructed from its configuration, never imported
 * pre-built. One module can therefore serve two advertisers on the same
 * network, and a test can construct one against a fixture feed.
 */
export type AffiliateProviderFactory = (
  config: ProviderRuntimeConfig,
) => AffiliateProvider;

/**
 * Outcome of one ingestion run. Mirrors the count columns on
 * `public.ingestion_runs`, which carry the same names for the same reason: a
 * summary that disagrees with the row it describes is worse than no summary.
 */
export interface IngestionSummary {
  runId: string | null;
  provider: string;
  status: 'succeeded' | 'partial' | 'failed';
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsRejected: number;
  recordsSkipped: number;
  offersCreated: number;
  offersUpdated: number;
  priceChanges: number;
  matchesQueued: number;
  startedAt: string;
  finishedAt: string;
  errorMessage?: string | undefined;
}
