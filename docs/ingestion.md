# Catalogue ingestion

How real products get into HugFab, and what has to be true before they can.

## The shape of it

```
Admitad (or any network)
  └─ provider adapter            src/modules/affiliate/providers/admitad.ts
       └─ feed reader            src/modules/affiliate/feed.ts
            └─ NormalisedProduct src/modules/affiliate/types.ts
                 └─ validation   Zod, at the boundary
                      └─ identity matching  find_product_matches() + identity.ts
                           ├─ Product       public.products
                           ├─ Offer         public.prices          (one per retailer)
                           ├─ Price history public.price_history   (appended by trigger)
                           └─ Review queue  public.product_match_candidates
```

Nothing downstream of `NormalisedProduct` knows which network a product came
from. That is the point: the UI, the search function and the comparison table
have no provider-shaped concepts in them at all, so adding Cuelinks, Impact or
vCommission is a new adapter file and a configuration row.

## Product identity

The load-bearing question is "are these two rows the same product?", because a
comparison site that answers it wrongly either shows the same jacket twice or
prices one retailer's item with another's number.

Resolution runs in four tiers, in order:

| Tier | Signal | Confidence | Action |
|------|--------|-----------:|--------|
| 1 | Strong identifier: validated GTIN/EAN/UPC/ISBN, ASIN | 0.99 | merge |
| 2 | Brand + weak identifier: MPN, SKU, style code | 0.94 | merge |
| 3 | Brand, gender, category and price all agree | ≤ 0.79 | review queue |
| 4 | Titles resemble each other | ≤ 0.49 | review queue |

The auto-merge threshold is 0.90. Tiers 3 and 4 are capped **below it by
construction** in `find_product_matches`, so "never auto-merge without
sufficient confidence" is a property of the arithmetic rather than a rule
someone has to remember. `identity.ts` also requires `method === 'identifier'`,
which is a second lock on the same door.

Barcode families all normalise to a check-digit-validated GTIN-14, so one
retailer's UPC-A and another's EAN-13 for the same item compare equal. A
barcode whose check digit disagrees is discarded rather than used as a merge
key — feeds put internal identifiers in columns labelled "EAN" constantly, and
a number that is not a barcode must never join two unrelated products.

Uncertain matches land in `product_match_candidates` for a human. Nothing there
is ever merged automatically.

## Running an import

```bash
npm run ingest -- --provider=admitad              # full run
npm run ingest -- --provider=admitad --limit=100  # first run against a new feed
npm run ingest -- --provider=admitad --dry-run    # parse and match, write nothing
```

Start with `--dry-run --limit=100`. It reports what it could and could not read
without touching the catalogue, which is how you confirm a new advertiser's
field names before importing fifty thousand rows under the wrong ones.

A CLI rather than an HTTP route: an import takes minutes and streams tens of
thousands of rows, which is the wrong shape for a request behind Passenger.
Schedule it with cron:

```
0 3 * * *  cd ~/domains/hugfab.com/public_html && npm run ingest -- --provider=admitad
```

The process exits non-zero on a `partial` or `failed` run, so cron notices
without anyone reading the logs.

## Every run is accounted for

`ingestion_runs` records one row per import: counts received, created, updated,
rejected and skipped, plus offers touched, price changes and matches queued.
`ingestion_errors` holds the per-row reasons behind the rejections, capped at
200 rows per run — a count of 12,000 rejections is a number, but "brand
missing" 11,998 times and "price not parseable" twice is a bug report.

A run rejecting more than 5% of its input finishes as `partial`, not
`succeeded`. A feed that quietly stops updating is worse than one that fails
loudly: the site keeps serving last month's prices, looks perfectly healthy,
and sends shoppers to a retailer who will charge them something else.

For "is this data fresh?", read `affiliate_providers.last_successful_sync_at`.
`last_synced_at` records the last run of any outcome.

## Configuration, not code

Nothing network-specific is hard-coded. Credentials come from the environment
by convention — a provider's slug upper-cased is its prefix, so `admitad` reads
`ADMITAD_CLIENT_ID`, `ADMITAD_CLIENT_SECRET` and `ADMITAD_WEBSITE_ID`, and
`vcommission` would read `VCOMMISSION_*`.

Everything else lives in `affiliate_providers.config`, which holds non-secret
settings only so a database dump cannot leak a credential:

```jsonc
{
  "feeds": [
    {
      "retailerSlug": "myntra",          // never inferred from the feed
      "url": "https://<issued by Admitad once approved>",
      "format": "xml",                   // or "csv"
      "currency": "INR",
      "campaignId": "<advertiser id>",
      "defaultGender": "unisex",
      "fieldMap": {                       // only the keys that differ
        "gtin": ["article_barcode"]
      }
    }
  ],
  "deeplinkTemplate": "https://.../?ulp={url}&subid={subid}",
  "subId": "hugfab-web"
}
```

`fieldMap` names candidate source keys per field and ships with the names the
common feed formats use (Google Merchant `g:`, YML, plain CSV). An advertiser
that calls its barcode something unexpected is one key here, not a deployment.

Adding a second advertiser is another entry in `feeds`. Adding a second network
is an adapter file plus two lines in `src/modules/affiliate/registry.ts`.

### What is verified about Admitad, and what is not

Verified from Admitad's own SDKs and public documentation (September 2026): the
API is `https://api.admitad.com`, OAuth 2.0 with `client_credentials` at
`/token/`, Bearer token thereafter. The publisher API covers campaigns,
banners, coupons, deeplinks and statistics.

It does **not** cover a product catalogue — the official publisher SDK exposes
no products or feeds resource. Product data is distributed as downloadable
per-advertiser feed files whose URLs are issued to an approved publisher
through the dashboard. They are not derivable and they differ per advertiser,
which is why they are configuration.

`developers.admitad.com` could not be read directly from the build environment
(egress-blocked), so the one thing to confirm against a real feed before a full
import is the field mapping. `--dry-run` is how you confirm it.

## Production data rules

Ingested rows are always `is_mock = false`. The development seed is the only
thing that sets it true.

Since migration 0003 the separation is enforced by the **database**, not by
application code: `app_settings.allow_mock_products` gates the RLS policies on
`products` and its child tables, and no hosted project ever sets it. Filtering
mock rows in the repository was the right policy in the wrong place — the anon
key ships in the browser bundle by design, so anyone could query PostgREST
directly and read around it. `supabase/seed.sql` sets the flag locally, and
`supabase db reset` never runs against a hosted project.

`prices.affiliate_url` is likewise revoked from `anon` and `authenticated`. It
carries our tracking identifiers, and it was readable by anyone who opened the
site. The click-out path resolves it server-side with the service-role client
and returns a redirect, so the browser never sees it.

## Deal Score and "lowest price"

`product_price_stats` exists and deliberately publishes `observation_count` and
`observation_days` alongside the extremes. A "lowest price in 90 days" claim
backed by two days of history is a lie with a number in it, so a consumer is
given what it needs to decline to render one.

No Deal Score is computed anywhere. It is a Phase 2 feature and it needs real
history behind it first.
