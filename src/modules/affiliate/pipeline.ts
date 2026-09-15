import { productSlug } from '@/lib/slug';
import { normaliseIdentifiers, type NormalisedIdentifier } from './identifiers';
import { resolveIdentity, toMatchIdentifiers } from './identity';
import type { IngestionStore } from './store';
import type { NormalisedProduct } from './types';

/**
 * One validated product from a feed, persisted.
 *
 * This file is the whole reason the architecture is provider-agnostic: nothing
 * here knows which network the product came from. It receives a
 * `NormalisedProduct`, a store, and a function that wraps a URL in tracking
 * parameters. Admitad, Cuelinks, Impact and vCommission all arrive here looking
 * identical, which is what makes adding the second network a new file rather
 * than a new branch through this logic.
 */

export interface PipelineContext {
  store: IngestionStore;
  /** Our `affiliate_providers.id` for the feed being ingested. */
  providerId: string;
  /** Null when ingesting outside a tracked run, e.g. a one-off backfill. */
  runId: string | null;
  /**
   * Wraps a retailer URL in the network's tracking parameters. Supplied by the
   * provider adapter; the pipeline neither knows nor cares what it does.
   */
  buildTrackedUrl: (productUrl: string, subId?: string) => string;
}

export type ProductOutcome =
  /** No product existed for this item under any identity. */
  | 'created'
  /** An identifier matched an existing product; the offer attached to it. */
  | 'merged'
  /** We had already seen this exact item from this provider. */
  | 'updated';

export interface PipelineResult {
  productId: string;
  outcome: ProductOutcome;
  offersCreated: number;
  offersUpdated: number;
  priceChanges: number;
  matchesQueued: number;
  /** Identifiers the feed supplied that failed validation and were dropped. */
  identifiersRejected: number;
}

export async function ingestProduct(
  product: NormalisedProduct,
  context: PipelineContext,
): Promise<PipelineResult> {
  const { store, providerId } = context;

  // Junk identifiers are dropped here rather than at the database, so a feed
  // with 40,000 fake barcodes costs 40,000 local rejections and not 40,000
  // failed round trips.
  const identifiers = normaliseIdentifiers(product.identifiers);
  const identifiersRejected = product.identifiers.length - identifiers.length;

  const brandId =
    product.brandName === null ? null : await store.ensureBrand(product.brandName);
  const categoryId = await store.ensureCategory(product.categoryPath);

  const { productId, outcome, matchesQueued } = await resolveProduct({
    product,
    identifiers,
    brandId,
    categoryId,
    context,
  });

  await store.linkSource({
    productId,
    providerId,
    externalId: product.externalId,
    retailerId: null,
    sourceUrl: product.offers[0]?.productUrl ?? null,
  });

  if (identifiers.length > 0) {
    await store.saveIdentifiers(productId, identifiers, providerId);
  }

  const offers = await persistOffers(product, productId, context);

  return {
    productId,
    outcome,
    matchesQueued,
    identifiersRejected,
    ...offers,
  };
}

interface ResolveArgs {
  product: NormalisedProduct;
  identifiers: NormalisedIdentifier[];
  brandId: string | null;
  categoryId: string | null;
  context: PipelineContext;
}

async function resolveProduct({
  product,
  identifiers,
  brandId,
  categoryId,
  context,
}: ResolveArgs): Promise<{
  productId: string;
  outcome: ProductOutcome;
  matchesQueued: number;
}> {
  const { store, providerId, runId } = context;

  // Cheapest question first: have we ingested this exact item from this exact
  // provider before? If so its identity is already settled and no matching is
  // needed. This is what makes a nightly re-run of an unchanged feed cheap.
  const known = await store.findProductBySourceItem(providerId, product.externalId);
  if (known !== null) {
    await store.updateProduct(known, {
      title: product.title,
      description: product.description,
      brandId,
      categoryId,
      gender: product.gender,
      color: product.color,
      material: product.material,
      imageUrls: product.imageUrls,
    });
    return { productId: known, outcome: 'updated', matchesQueued: 0 };
  }

  const candidates = await store.findMatches({
    identifiers: toMatchIdentifiers(identifiers),
    brandId,
    title: product.title,
    gender: product.gender,
    categoryId,
    priceMinor: product.offers[0]?.priceMinor ?? null,
    currency: product.offers[0]?.currency ?? 'INR',
  });

  const decision = resolveIdentity(candidates);

  if (decision.action === 'merge') {
    // Deliberately does NOT overwrite the existing product's descriptive
    // fields. The first feed to describe a product is not automatically the
    // worst one, and letting each nightly run rewrite the title with whatever
    // the latest network calls it makes the catalogue flicker.
    return { productId: decision.productId, outcome: 'merged', matchesQueued: 0 };
  }

  const productId = await store.createProduct({
    title: product.title,
    // Discriminated by the provider's own id, so re-ingesting the same item
    // yields the same slug and a bookmarked URL keeps working.
    slug: productSlug(product.title, product.externalId),
    description: product.description,
    brandId,
    categoryId,
    gender: product.gender,
    color: product.color,
    material: product.material,
    imageUrls: product.imageUrls,
    sourceProviderId: providerId,
    externalId: product.externalId,
  });

  const matchesQueued =
    decision.review.length === 0
      ? 0
      : await store.queueMatches(productId, decision.review, runId);

  return { productId, outcome: 'created', matchesQueued };
}

async function persistOffers(
  product: NormalisedProduct,
  productId: string,
  context: PipelineContext,
): Promise<{ offersCreated: number; offersUpdated: number; priceChanges: number }> {
  const { store, providerId, buildTrackedUrl } = context;
  const observedAt = new Date().toISOString();

  let offersCreated = 0;
  let offersUpdated = 0;
  let priceChanges = 0;

  for (const offer of product.offers) {
    const retailerId = await store.ensureRetailer(offer.retailerSlug);

    const result = await store.upsertOffer({
      productId,
      retailerId,
      variantId: null,
      priceMinor: offer.priceMinor,
      originalMinor: offer.originalMinor,
      currency: offer.currency,
      availability: offer.availability,
      // A provider that already returned a tracked URL keeps it; otherwise the
      // adapter wraps the retailer URL. Never fabricated: a product with no
      // URL at all is stored with none, and the click-out path declines to
      // send the user anywhere rather than guessing.
      affiliateUrl: offer.affiliateUrl ?? safelyTrack(buildTrackedUrl, offer.productUrl),
      productUrl: offer.productUrl,
      providerId,
      externalOfferId: offer.externalId,
      observedAt,
    });

    if (result.created) offersCreated += 1;
    else offersUpdated += 1;
    if (result.priceChanged) priceChanges += 1;
  }

  return { offersCreated, offersUpdated, priceChanges };
}

/**
 * A provider's URL builder is third-party-shaped code running over untrusted
 * feed data. If it throws on one odd URL, that offer loses its commission — it
 * must not take down the run that was importing fifty thousand others.
 */
function safelyTrack(
  build: (productUrl: string, subId?: string) => string,
  productUrl: string,
): string | null {
  try {
    const tracked = build(productUrl);
    return tracked === '' ? null : tracked;
  } catch {
    return null;
  }
}
