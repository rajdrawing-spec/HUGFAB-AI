import { z } from 'zod';

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
}

/** Outcome of one ingestion run, for the admin surface and the logs. */
export interface IngestionSummary {
  provider: string;
  fetched: number;
  normalised: number;
  rejected: number;
  upserted: number;
  startedAt: string;
  finishedAt: string;
}
