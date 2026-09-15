import { describe, expect, it, beforeEach } from 'vitest';

import { InMemoryIngestionStore } from './test-store';
import { runIngestion } from './worker';
import type { AffiliateProvider, FeedPage, NormalisedProduct } from './types';
import { normalisedProductSchema } from './types';

/**
 * The worker's job is accounting. A run that half-worked must look different
 * from one that worked, because a feed which quietly stops updating leaves the
 * site serving stale prices while appearing perfectly healthy.
 */

function feedItem(id: string, priceMinor = 249900): Record<string, unknown> {
  return { id, name: 'Test Hoodie', price: priceMinor, url: 'https://shop.test/p' };
}

function buildProvider(
  pages: Array<Record<string, unknown>[]>,
  overrides: Partial<AffiliateProvider> = {},
): AffiliateProvider {
  return {
    slug: 'test-network',
    name: 'Test Network',
    async fetchPage(cursor?: string): Promise<FeedPage> {
      const index = cursor === undefined ? 0 : Number(cursor);
      const items = pages[index] ?? [];
      const hasMore = index + 1 < pages.length;
      return { items, ...(hasMore ? { nextCursor: String(index + 1) } : {}) };
    },
    normalise(raw: unknown): NormalisedProduct | null {
      const item = raw as Record<string, unknown>;
      if (typeof item['id'] !== 'string') return null;
      const parsed = normalisedProductSchema.safeParse({
        externalId: item['id'],
        title: item['name'],
        description: null,
        brandName: 'Test Brand',
        categoryPath: ['Topwear'],
        gender: 'unisex',
        color: null,
        material: null,
        imageUrls: [],
        identifiers: [],
        offers: [
          {
            externalId: `${item['id']}-o`,
            retailerSlug: 'test-shop',
            priceMinor: item['price'],
            originalMinor: null,
            currency: 'INR',
            availability: 'in_stock',
            productUrl: item['url'],
            affiliateUrl: null,
          },
        ],
      });
      return parsed.success ? parsed.data : null;
    },
    buildTrackedUrl: (url) => `https://track.test/?u=${encodeURIComponent(url)}`,
    ...overrides,
  };
}

let store: InMemoryIngestionStore;

beforeEach(() => {
  store = new InMemoryIngestionStore();
});

describe('counting', () => {
  it('accounts for every row the feed supplied', async () => {
    const summary = await runIngestion({
      provider: buildProvider([[feedItem('1'), feedItem('2')], [feedItem('3')]]),
      store,
    });

    expect(summary.status).toBe('succeeded');
    expect(summary.recordsReceived).toBe(3);
    expect(summary.recordsCreated).toBe(3);
    expect(summary.recordsRejected).toBe(0);
    expect(summary.offersCreated).toBe(3);
    expect(
      summary.recordsCreated +
        summary.recordsUpdated +
        summary.recordsRejected +
        summary.recordsSkipped,
    ).toBe(summary.recordsReceived);
  });

  it('follows the cursor across pages', async () => {
    const summary = await runIngestion({
      provider: buildProvider([[feedItem('1')], [feedItem('2')], [feedItem('3')]]),
      store,
    });
    expect(summary.recordsReceived).toBe(3);
  });

  it('stops at an explicit limit', async () => {
    const summary = await runIngestion({
      provider: buildProvider([[feedItem('1'), feedItem('2'), feedItem('3')]]),
      store,
      limit: 2,
    });
    expect(summary.recordsReceived).toBe(2);
    expect(store.products.size).toBe(2);
  });
});

describe('bad rows', () => {
  it('counts a row it cannot normalise and carries on', async () => {
    const summary = await runIngestion({
      provider: buildProvider([[feedItem('1'), { broken: true }, feedItem('3')]]),
      store,
    });

    expect(summary.recordsReceived).toBe(3);
    expect(summary.recordsCreated).toBe(2);
    expect(summary.recordsRejected).toBe(1);
    expect(store.errors[0]?.stage).toBe('normalise');
  });

  it('survives an adapter that throws on one item', async () => {
    let seen = 0;
    const provider = buildProvider([[feedItem('1'), feedItem('2')]]);
    const throwing = buildProvider([[feedItem('1'), feedItem('2')]], {
      normalise(raw: unknown) {
        seen += 1;
        if (seen === 1) throw new Error('unexpected shape');
        return provider.normalise(raw);
      },
    });

    const summary = await runIngestion({ provider: throwing, store });

    expect(summary.recordsRejected).toBe(1);
    expect(summary.recordsCreated).toBe(1);
    expect(summary.status).toBe('partial');
  });

  it('finishes as partial when an unusual share of the feed is rejected', async () => {
    const items = Array.from({ length: 20 }, (_, i) => feedItem(String(i)));
    items[0] = { broken: true };
    items[1] = { broken: true };

    const summary = await runIngestion({ provider: buildProvider([items]), store });

    expect(summary.recordsRejected).toBe(2);
    expect(summary.status).toBe('partial');
    expect(store.finished?.status).toBe('partial');
  });

  it('finishes as succeeded when rejections are within the ordinary range', async () => {
    const items = Array.from({ length: 100 }, (_, i) => feedItem(String(i)));
    items[0] = { broken: true };

    const summary = await runIngestion({ provider: buildProvider([items]), store });

    expect(summary.recordsRejected).toBe(1);
    expect(summary.status).toBe('succeeded');
  });
});

describe('failures', () => {
  it('marks the run failed and keeps the work already done', async () => {
    const provider = buildProvider([[feedItem('1')]], {
      async fetchPage(cursor?: string): Promise<FeedPage> {
        if (cursor === undefined) return { items: [feedItem('1')], nextCursor: '1' };
        throw new Error('network refused the connection');
      },
    });

    const summary = await runIngestion({ provider, store });

    expect(summary.status).toBe('failed');
    expect(summary.errorMessage).toContain('network refused');
    // The first page's product is real and stays.
    expect(store.products.size).toBe(1);
    expect(store.finished?.status).toBe('failed');
  });

  it('refuses to run for a provider that is not registered', async () => {
    const unregistered = new InMemoryIngestionStore();
    unregistered.findProviderIdBySlug = async () => null;

    await expect(
      runIngestion({ provider: buildProvider([[feedItem('1')]]), store: unregistered }),
    ).rejects.toThrow(/not registered in affiliate_providers/);
  });
});

describe('dry run', () => {
  it('parses everything and writes nothing', async () => {
    const summary = await runIngestion({
      provider: buildProvider([[feedItem('1'), feedItem('2')]]),
      store,
      dryRun: true,
    });

    expect(summary.runId).toBeNull();
    expect(summary.recordsReceived).toBe(2);
    expect(summary.recordsSkipped).toBe(2);
    expect(store.products.size).toBe(0);
    expect(store.offers.size).toBe(0);
  });
});
