import { describe, expect, it, beforeEach } from 'vitest';

import { ingestProduct, type PipelineContext } from './pipeline';
import { InMemoryIngestionStore } from './test-store';
import { normalisedProductSchema, type NormalisedProduct } from './types';

/**
 * The cases that decide whether HugFab is a comparison site or a list of
 * duplicates. Each one is a situation a real feed produces on day one.
 */

function product(overrides: Partial<NormalisedProduct> = {}): NormalisedProduct {
  return normalisedProductSchema.parse({
    externalId: 'ITEM-1',
    title: "Levi's 511 Slim Fit Jeans",
    description: null,
    brandName: 'Levis',
    categoryPath: ['Bottomwear', 'Jeans'],
    gender: 'men',
    color: 'Blue',
    material: 'Denim',
    imageUrls: ['https://cdn.example.test/a.jpg'],
    identifiers: [],
    offers: [
      {
        externalId: 'OFFER-1',
        retailerSlug: 'myntra',
        priceMinor: 249900,
        originalMinor: 399900,
        currency: 'INR',
        availability: 'in_stock',
        productUrl: 'https://www.myntra.com/p/1',
        affiliateUrl: null,
      },
    ],
    ...overrides,
  });
}

let store: InMemoryIngestionStore;

function context(providerId: string): PipelineContext {
  return {
    store,
    providerId,
    runId: 'run-1',
    buildTrackedUrl: (url) => `https://track.test/go?u=${encodeURIComponent(url)}`,
  };
}

beforeEach(() => {
  store = new InMemoryIngestionStore();
});

describe('cross-provider identity', () => {
  it('attaches a second network’s offer to the same product when the GTIN agrees', async () => {
    // Network A lists it with an EAN-13.
    const first = await ingestProduct(
      product({
        externalId: 'A-1',
        identifiers: [{ type: 'ean', value: '0036000291452' }],
      }),
      context('provider-a'),
    );

    // Network B lists the same jeans with the UPC-A for the same barcode, at a
    // different price, through a different retailer.
    const second = await ingestProduct(
      product({
        externalId: 'B-9',
        title: "Levi's 511 Slim Fit Jeans for Men",
        identifiers: [{ type: 'upc', value: '0-36000-29145-2' }],
        offers: [
          {
            externalId: 'OFFER-B',
            retailerSlug: 'ajio',
            priceMinor: 219900,
            originalMinor: 399900,
            currency: 'INR',
            availability: 'in_stock',
            productUrl: 'https://www.ajio.com/p/2',
            affiliateUrl: null,
          },
        ],
      }),
      context('provider-b'),
    );

    expect(first.outcome).toBe('created');
    expect(second.outcome).toBe('merged');
    expect(second.productId).toBe(first.productId);

    // One product, two retailer offers. This is the comparison table.
    expect(store.products.size).toBe(1);
    expect(store.offers.size).toBe(2);
    expect(store.queuedMatches).toHaveLength(0);
  });

  it('does not overwrite the existing description when merging', async () => {
    await ingestProduct(
      product({
        externalId: 'A-1',
        identifiers: [{ type: 'ean', value: '0036000291452' }],
      }),
      context('provider-a'),
    );

    await ingestProduct(
      product({
        externalId: 'B-1',
        title: 'JEANS MENS BLUE 511 SLIM *HOT DEAL*',
        identifiers: [{ type: 'ean', value: '0036000291452' }],
      }),
      context('provider-b'),
    );

    const [stored] = [...store.products.values()];
    expect(stored?.title).toBe("Levi's 511 Slim Fit Jeans");
  });
});

describe('when no identifier is available', () => {
  it('creates a separate product rather than guessing', async () => {
    const first = await ingestProduct(
      product({ externalId: 'A-1' }),
      context('provider-a'),
    );

    // The matcher offers a strong-looking attribute candidate. It is still
    // below the auto-merge threshold, so the pipeline must not act on it.
    store.attributeCandidates = [
      {
        productId: first.productId,
        method: 'attribute',
        confidence: 0.79,
        signals: { title_similarity: 0.94 },
      },
    ];

    const second = await ingestProduct(
      product({ externalId: 'B-1', title: "Levi's 511 Slim Fit Jean" }),
      context('provider-b'),
    );

    expect(second.outcome).toBe('created');
    expect(second.productId).not.toBe(first.productId);
    expect(store.products.size).toBe(2);
  });

  it('queues the uncertain match for a human', async () => {
    const first = await ingestProduct(
      product({ externalId: 'A-1' }),
      context('provider-a'),
    );
    store.attributeCandidates = [
      {
        productId: first.productId,
        method: 'attribute',
        confidence: 0.72,
        signals: { title_similarity: 0.88 },
      },
    ];

    const second = await ingestProduct(
      product({ externalId: 'B-1' }),
      context('provider-b'),
    );

    expect(second.matchesQueued).toBe(1);
    expect(store.queuedMatches[0]?.productId).toBe(second.productId);
    expect(store.queuedMatches[0]?.candidates[0]?.productId).toBe(first.productId);
  });

  it('ignores a resemblance too weak to be worth reviewing', async () => {
    const first = await ingestProduct(
      product({ externalId: 'A-1' }),
      context('provider-a'),
    );
    store.attributeCandidates = [
      { productId: first.productId, method: 'fuzzy', confidence: 0.3, signals: {} },
    ];

    const second = await ingestProduct(
      product({ externalId: 'B-1' }),
      context('provider-b'),
    );

    expect(second.matchesQueued).toBe(0);
    expect(store.queuedMatches).toHaveLength(0);
  });
});

describe('re-ingestion', () => {
  it('updates in place rather than duplicating', async () => {
    const first = await ingestProduct(
      product({ externalId: 'A-1' }),
      context('provider-a'),
    );

    const again = await ingestProduct(
      product({
        externalId: 'A-1',
        offers: [
          {
            externalId: 'OFFER-1',
            retailerSlug: 'myntra',
            priceMinor: 199900,
            originalMinor: 399900,
            currency: 'INR',
            availability: 'in_stock',
            productUrl: 'https://www.myntra.com/p/1',
            affiliateUrl: null,
          },
        ],
      }),
      context('provider-a'),
    );

    expect(again.outcome).toBe('updated');
    expect(again.productId).toBe(first.productId);
    expect(store.products.size).toBe(1);
    expect(store.offers.size).toBe(1);
    expect(again.priceChanges).toBe(1);
    expect(again.offersCreated).toBe(0);
  });

  it('reports no price change when the feed repeats itself', async () => {
    await ingestProduct(product({ externalId: 'A-1' }), context('provider-a'));
    const again = await ingestProduct(
      product({ externalId: 'A-1' }),
      context('provider-a'),
    );

    expect(again.priceChanges).toBe(0);
    expect(again.offersUpdated).toBe(1);
  });
});

describe('identifiers', () => {
  it('drops a barcode whose check digit does not agree, and keeps the product', async () => {
    const result = await ingestProduct(
      product({
        externalId: 'A-1',
        // Right length, wrong check digit — an internal id in an EAN column.
        identifiers: [{ type: 'ean', value: '0036000291453' }],
      }),
      context('provider-a'),
    );

    expect(result.outcome).toBe('created');
    expect(result.identifiersRejected).toBe(1);
    expect(store.identifiers.get(result.productId)).toBeUndefined();
  });

  it('never merges two products on an invalid barcode they happen to share', async () => {
    const first = await ingestProduct(
      product({
        externalId: 'A-1',
        identifiers: [{ type: 'ean', value: '0000000000000' }],
      }),
      context('provider-a'),
    );
    const second = await ingestProduct(
      product({
        externalId: 'B-1',
        title: 'Completely Different Shoe',
        identifiers: [{ type: 'ean', value: '0000000000000' }],
      }),
      context('provider-b'),
    );

    expect(second.productId).not.toBe(first.productId);
    expect(store.products.size).toBe(2);
  });
});

describe('tracking URLs', () => {
  it('wraps a bare retailer URL using the provider’s builder', async () => {
    const result = await ingestProduct(product(), context('provider-a'));
    const offer = [...store.offers.values()][0];

    expect(offer?.affiliateUrl).toContain('https://track.test/go?u=');
    expect(result.offersCreated).toBe(1);
  });

  it('keeps a tracked URL the feed already supplied', async () => {
    await ingestProduct(
      product({
        offers: [
          {
            externalId: 'OFFER-1',
            retailerSlug: 'myntra',
            priceMinor: 249900,
            originalMinor: null,
            currency: 'INR',
            availability: 'in_stock',
            productUrl: 'https://www.myntra.com/p/1',
            affiliateUrl: 'https://network.test/deeplink/abc',
          },
        ],
      }),
      context('provider-a'),
    );

    const offer = [...store.offers.values()][0];
    expect(offer?.affiliateUrl).toBe('https://network.test/deeplink/abc');
  });

  it('stores no affiliate URL rather than a broken one when the builder throws', async () => {
    const throwing: PipelineContext = {
      ...context('provider-a'),
      buildTrackedUrl: () => {
        throw new Error('missing website id');
      },
    };

    const result = await ingestProduct(product(), throwing);
    const offer = [...store.offers.values()][0];

    expect(result.offersCreated).toBe(1);
    expect(offer?.affiliateUrl).toBeNull();
    // The user still reaches the retailer; we simply earn nothing on the click.
    expect(offer?.productUrl).toBe('https://www.myntra.com/p/1');
  });
});
