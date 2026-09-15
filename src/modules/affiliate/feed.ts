import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import { minorUnitExponent } from '@/lib/money';
import type { IdentifierType } from './identifiers';
import { normalisedProductSchema, type NormalisedProduct } from './types';

/**
 * Reading a product feed file.
 *
 * Deliberately not Admitad-specific. Affiliate networks do not invent their own
 * catalogue formats — they redistribute the advertiser's, which is almost
 * always a Google Merchant-style XML document, a YML/Yandex-style one, or a CSV
 * export. Admitad, Cuelinks, Impact and vCommission all land here, so this is a
 * shared module and each adapter supplies only the configuration.
 *
 * That configuration matters more than usual. The exact element and column
 * names an advertiser emits are not knowable until a real approved feed is in
 * hand, and they differ between advertisers on the same network. So the
 * mapping is data, not code: `FieldMap` lists candidate source keys per field,
 * ships with the names the common formats use, and is overridden per feed from
 * `affiliate_providers.config`. Pinning a new advertiser is a configuration
 * row, not a deployment.
 */

/**
 * Candidate source keys per field, tried in order, first non-empty wins.
 *
 * The defaults cover Google Merchant (`g:`-prefixed), YML (`picture`,
 * `oldprice`, `vendor`) and the plain names a CSV export tends to use.
 */
export const fieldMapSchema = z.object({
  externalId: z.array(z.string()).default(['id', 'g:id', 'offer_id', 'offerId', 'sku']),
  title: z.array(z.string()).default(['name', 'title', 'g:title', 'model']),
  description: z.array(z.string()).default(['description', 'g:description']),
  brand: z.array(z.string()).default(['vendor', 'brand', 'g:brand', 'manufacturer']),
  category: z
    .array(z.string())
    .default([
      'categoryPath',
      'product_type',
      'g:product_type',
      'category',
      'categoryId',
    ]),
  gender: z.array(z.string()).default(['gender', 'g:gender', 'param_gender']),
  color: z.array(z.string()).default(['color', 'g:color', 'colour']),
  material: z.array(z.string()).default(['material', 'g:material', 'fabric']),
  image: z.array(z.string()).default(['picture', 'image_link', 'g:image_link', 'image']),
  additionalImages: z
    .array(z.string())
    .default(['additional_image_link', 'g:additional_image_link']),
  price: z.array(z.string()).default(['price', 'g:price', 'sale_price', 'g:sale_price']),
  originalPrice: z
    .array(z.string())
    .default(['oldprice', 'old_price', 'list_price', 'g:price']),
  currency: z.array(z.string()).default(['currencyId', 'currency', 'g:currency']),
  availability: z
    .array(z.string())
    .default(['available', 'availability', 'g:availability', 'stock']),
  url: z.array(z.string()).default(['url', 'link', 'g:link', 'product_url']),
  affiliateUrl: z
    .array(z.string())
    .default(['deeplink', 'affiliate_url', 'tracking_link', 'aff_url']),
  modelName: z.array(z.string()).default(['model', 'g:model']),
  gtin: z.array(z.string()).default(['gtin', 'g:gtin', 'barcode']),
  ean: z.array(z.string()).default(['ean', 'g:ean']),
  upc: z.array(z.string()).default(['upc', 'g:upc']),
  isbn: z.array(z.string()).default(['isbn', 'g:isbn']),
  mpn: z.array(z.string()).default(['mpn', 'g:mpn', 'vendorCode']),
  sku: z.array(z.string()).default(['sku', 'g:sku', 'article']),
  styleCode: z.array(z.string()).default(['style_code', 'styleCode', 'style']),
});

export type FieldMap = z.infer<typeof fieldMapSchema>;

export const feedConfigSchema = z.object({
  /**
   * Which retailer these offers belong to, as our slug. Never inferred from the
   * feed: getting it wrong attributes one shop's prices to another, and a
   * comparison table is worthless the moment that happens.
   */
  retailerSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a slug, e.g. "myntra"'),
  url: z.string().url(),
  format: z.enum(['xml', 'csv']).default('xml'),
  /**
   * The XML element that wraps one product. Left unset, the parser takes the
   * most repeated element in the document, which is right for every feed
   * format the defaults above cover.
   */
  itemElement: z.string().optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('INR'),
  /** Default when the feed has no gender field, as many Indian feeds do not. */
  defaultGender: z.enum(['women', 'men', 'unisex', 'kids']).default('unisex'),
  // The full default map, so a feed config that names no overrides still gets
  // the candidate keys the common formats use.
  fieldMap: fieldMapSchema.default(() => fieldMapSchema.parse({})),
  /** The network's identifier for the advertiser, used to build deeplinks. */
  campaignId: z.string().trim().optional(),
});

export type FeedConfig = z.infer<typeof feedConfigSchema>;

export type FeedRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Everything stays a string. A parser that helpfully turns "07" into 7 or
  // "1.10" into 1.1 corrupts SKUs and prices before we ever see them.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/**
 * Products from an XML document.
 *
 * Attributes are folded in beside elements (`@id` alongside `id`) because
 * feed formats disagree about which to use for the same information — YML puts
 * the offer id in an attribute, Google Merchant in an element.
 */
export function parseXmlFeed(xml: string, itemElement?: string): FeedRecord[] {
  const document = parser.parse(xml) as unknown;
  const collected: Array<{ name: string; node: Record<string, unknown> }> = [];
  collectNodes(document, collected, 0);

  const wanted = itemElement ?? mostRepeatedElement(collected);
  if (wanted === null) return [];

  return collected
    .filter((entry) => entry.name === wanted)
    .map((entry) => flattenNode(entry.node));
}

function collectNodes(
  value: unknown,
  out: Array<{ name: string; node: Record<string, unknown> }>,
  depth: number,
): void {
  // A feed nested more deeply than this is not a feed.
  if (depth > 12 || typeof value !== 'object' || value === null) return;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('@')) continue;
    const children = Array.isArray(child) ? child : [child];
    for (const node of children) {
      if (typeof node === 'object' && node !== null) {
        out.push({ name: key, node: node as Record<string, unknown> });
        collectNodes(node, out, depth + 1);
      }
    }
  }
}

/**
 * The element that appears most often is the product element. It is a
 * heuristic, but a reliable one: a catalogue is overwhelmingly made of
 * products, and `itemElement` overrides it whenever a feed proves otherwise.
 */
function mostRepeatedElement(nodes: ReadonlyArray<{ name: string }>): string | null {
  const counts = new Map<string, number>();
  for (const { name } of nodes) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return bestCount > 1 ? best : best;
}

function flattenNode(node: Record<string, unknown>): FeedRecord {
  const out: FeedRecord = {};
  for (const [key, value] of Object.entries(node)) {
    const name = key.startsWith('@') ? key.slice(1) : key;
    if (out[name] === undefined) out[name] = value;
    // A repeated element (several <picture> tags) arrives as an array and is
    // kept whole; `readAll` unpacks it.
  }
  return out;
}

/**
 * Products from a delimited file.
 *
 * Handles quoted fields containing the delimiter and doubled quotes, which is
 * the one part of CSV that a naive `split(',')` gets wrong and that product
 * titles hit constantly — "Jeans, Slim Fit" is an ordinary title.
 */
export function parseCsvFeed(csv: string, delimiter = ','): FeedRecord[] {
  const rows = parseDelimited(csv, delimiter);
  const header = rows[0];
  if (header === undefined) return [];

  return rows.slice(1).flatMap((row) => {
    if (row.length === 1 && row[0]?.trim() === '') return [];
    const record: FeedRecord = {};
    header.forEach((column, index) => {
      record[column.trim()] = row[index] ?? '';
    });
    return [record];
  });
}

function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** First non-empty value among the candidate keys, as a trimmed string. */
function read(record: FeedRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    const text = coerce(value);
    if (text !== null) return text;
  }
  return null;
}

/** Every value under the candidate keys, flattening repeated elements. */
function readAll(record: FeedRecord, keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const value = record[key];
    for (const item of Array.isArray(value) ? value : [value]) {
      const text = coerce(item);
      if (text !== null) out.push(text);
    }
  }
  return out;
}

function coerce(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // `<price currency="INR">1899</price>` parses to an object with #text.
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return coerce((value as Record<string, unknown>)['#text']);
  }
  return null;
}

/**
 * A price string to integer minor units.
 *
 * Feeds write money as "1899", "1,899.00", "₹1899.00", "1899 INR" and
 * "1.899,00". Every one of those has to become an integer number of paise, and
 * a float must never be the intermediate step: 18.99 * 100 is 1898.9999... in
 * IEEE-754, and a price that renders as ₹18.98 is a bug a user can see.
 */
export function parsePriceToMinor(raw: string | null, currency: string): number | null {
  if (raw === null) return null;

  let text = raw.replace(/[^\d.,-]/g, '').trim();
  if (text === '') return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European convention: "1.899,00" — dots group, comma is the decimal point.
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }

  if (!/^-?\d*(\.\d*)?$/.test(text)) return null;

  const negative = text.startsWith('-');
  const [wholePart = '', fractionPart = ''] = text.replace('-', '').split('.');
  const exponent = minorUnitExponent(currency);

  const whole = wholePart === '' ? '0' : wholePart;
  const fraction = fractionPart.padEnd(exponent, '0').slice(0, exponent);

  const minor = Number(`${whole}${fraction}`);
  if (!Number.isFinite(minor) || !Number.isSafeInteger(minor)) return null;

  return negative ? -minor : minor;
}

const IN_STOCK = new Set([
  'true',
  'yes',
  '1',
  'in stock',
  'in_stock',
  'instock',
  'available',
]);
const OUT_OF_STOCK = new Set([
  'false',
  'no',
  '0',
  'out of stock',
  'out_of_stock',
  'outofstock',
  'unavailable',
  'sold out',
]);

export function parseAvailability(
  raw: string | null,
): NormalisedProduct['offers'][number]['availability'] {
  if (raw === null) return 'unknown';
  const value = raw.toLowerCase().trim();
  if (IN_STOCK.has(value)) return 'in_stock';
  if (OUT_OF_STOCK.has(value)) return 'out_of_stock';
  if (value.includes('preorder') || value.includes('pre-order')) return 'preorder';
  if (value.includes('discontinued')) return 'discontinued';
  return 'unknown';
}

type Gender = FeedConfig['defaultGender'];

function readGender(value: string): Gender | null {
  const text = value.toLowerCase().trim();
  if (text === '') return null;
  if (
    text.includes('kid') ||
    text.includes('boy') ||
    text.includes('girl') ||
    text.includes('child') ||
    text.includes('infant')
  ) {
    return 'kids';
  }
  if (text.includes('unisex')) return 'unisex';
  if (
    text.startsWith('w') ||
    text.includes('female') ||
    text.includes('ladies') ||
    text === 'f'
  ) {
    return 'women';
  }
  if (text.startsWith('m') && !text.startsWith('mix') && !text.startsWith('misc')) {
    return 'men';
  }
  return null;
}

/**
 * Gender, from a dedicated field where one exists and from the category path
 * where one does not.
 *
 * The fallback is not a nicety. Indian fashion feeds routinely carry no gender
 * column at all and encode it in the top of the taxonomy — "Women > Topwear >
 * Hoodies". Without reading it, every such product lands as `unisex` and the
 * gender filter, which is the first filter a shopper reaches for, silently
 * returns almost nothing.
 *
 * Only the first two segments are considered. Deeper ones are garment types,
 * and "Women > Topwear > Boyfriend Shirt" is not menswear.
 */
function parseGender(
  raw: string | null,
  categoryPath: readonly string[],
  fallback: Gender,
): Gender {
  if (raw !== null) {
    const explicit = readGender(raw);
    if (explicit !== null) return explicit;
  }

  for (const segment of categoryPath.slice(0, 2)) {
    const inferred = readGender(segment);
    if (inferred !== null) return inferred;
  }

  return fallback;
}

/**
 * Categories are written as "Women > Topwear > Hoodies", "Women/Topwear" or
 * "Women|Topwear" depending on who exported the file.
 */
function parseCategoryPath(raw: string | null): string[] {
  if (raw === null) return [];
  return raw
    .split(/\s*(?:>|\/|\||,)\s*/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .slice(0, 6);
}

const IDENTIFIER_FIELDS: ReadonlyArray<[IdentifierType, keyof FieldMap]> = [
  ['gtin', 'gtin'],
  ['ean', 'ean'],
  ['upc', 'upc'],
  ['isbn', 'isbn'],
  ['mpn', 'mpn'],
  ['sku', 'sku'],
  ['style_code', 'styleCode'],
];

/**
 * One feed record to a `NormalisedProduct`, or `null` when it cannot be
 * trusted.
 *
 * Returning null rather than throwing is the contract every provider adapter
 * follows: one unusable row in a feed of fifty thousand is counted and dropped,
 * never allowed to end the run.
 */
export function mapRecordToProduct(
  record: FeedRecord,
  config: FeedConfig,
): NormalisedProduct | null {
  const map = config.fieldMap;

  const externalId = read(record, map.externalId);
  const title = read(record, map.title);
  const url = read(record, map.url);
  const currency = read(record, map.currency) ?? config.currency;
  const priceMinor = parsePriceToMinor(read(record, map.price), currency);

  // Without these four there is nothing to sell, nowhere to send the buyer, or
  // no way to recognise the row again tomorrow.
  if (externalId === null || title === null || url === null || priceMinor === null) {
    return null;
  }
  if (priceMinor < 0) return null;

  const originalMinor = parsePriceToMinor(read(record, map.originalPrice), currency);

  const images = [...readAll(record, map.image), ...readAll(record, map.additionalImages)]
    .filter((candidate) => /^https?:\/\//i.test(candidate))
    .slice(0, 20);

  const categoryPath = parseCategoryPath(read(record, map.category));

  const identifiers = IDENTIFIER_FIELDS.flatMap(([type, field]) => {
    const value = read(record, map[field]);
    return value === null ? [] : [{ type, value: value.slice(0, 200) }];
  });

  const candidate = {
    externalId: externalId.slice(0, 200),
    title: title.slice(0, 300),
    description: read(record, map.description)?.slice(0, 5000) ?? null,
    brandName: read(record, map.brand)?.slice(0, 200) ?? null,
    categoryPath,
    gender: parseGender(read(record, map.gender), categoryPath, config.defaultGender),
    color: read(record, map.color)?.slice(0, 100) ?? null,
    material: read(record, map.material)?.slice(0, 200) ?? null,
    modelName: read(record, map.modelName)?.slice(0, 200) ?? null,
    imageUrls: images,
    identifiers,
    offers: [
      {
        externalId: externalId.slice(0, 200),
        retailerSlug: config.retailerSlug,
        priceMinor,
        // A list price below the current price is bad data, not a discount.
        // Dropping it keeps the product; keeping it would fail validation and
        // lose the product entirely.
        originalMinor:
          originalMinor !== null && originalMinor >= priceMinor ? originalMinor : null,
        currency,
        availability: parseAvailability(read(record, map.availability)),
        productUrl: url,
        affiliateUrl: read(record, map.affiliateUrl),
      },
    ],
  };

  const parsed = normalisedProductSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseFeed(body: string, config: FeedConfig): FeedRecord[] {
  return config.format === 'csv'
    ? parseCsvFeed(body)
    : parseXmlFeed(body, config.itemElement);
}
