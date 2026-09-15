/**
 * Product identifiers: normalisation and validation.
 *
 * This is the TypeScript half of a rule that also exists in SQL
 * (`public.normalise_identifier` in `supabase/migrations/0003_product_identity.sql`).
 * Two implementations of one rule is a cost, paid deliberately:
 *
 *   * The database version is the authority. It runs on insert, so a bad
 *     identifier cannot be stored however it arrives.
 *   * This version runs during normalisation, before a row is ever sent. A
 *     feed with 40,000 junk barcodes should cost us 40,000 rejections counted
 *     locally, not 40,000 failed round trips.
 *
 * `identifiers.test.ts` runs the same vectors as the SQL assertions in
 * `supabase/tests/01_rls_assertions.sql`, so a drift between the two is a test
 * failure rather than a silent disagreement about what a product is.
 *
 * No part of this file is network- or provider-specific.
 */

/** Mirrors `public.identifier_type`. */
export const IDENTIFIER_TYPES = [
  'gtin',
  'ean',
  'upc',
  'isbn',
  'asin',
  'mpn',
  'sku',
  'style_code',
] as const;

export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

/** Barcode families. All normalise to a common GTIN-14. */
const BARCODE_TYPES = new Set<IdentifierType>(['gtin', 'ean', 'upc', 'isbn']);

/**
 * Identifiers that identify a product on their own.
 *
 * A GTIN does: it is issued once, globally. An MPN does not — two brands can
 * both ship a part numbered "100" — so weak identifiers are only ever compared
 * within a single brand.
 */
const STRONG_TYPES = new Set<IdentifierType>(['gtin', 'ean', 'upc', 'isbn', 'asin']);

export function isStrongIdentifier(type: IdentifierType): boolean {
  return STRONG_TYPES.has(type);
}

export interface RawIdentifier {
  type: IdentifierType;
  value: string;
}

export interface NormalisedIdentifier {
  type: IdentifierType;
  /** Exactly as the feed gave it, kept for diagnosing a bad supplier. */
  raw: string;
  /** The canonical form used for matching. */
  value: string;
  strong: boolean;
}

/**
 * GS1 mod-10 check digit for a barcode body that excludes the check digit.
 * Weights alternate 3, 1 leftwards from the rightmost body digit.
 */
export function gtinCheckDigit(body: string): string | null {
  if (!/^\d+$/.test(body)) return null;

  let total = 0;
  for (let j = 1; j <= body.length; j += 1) {
    const digit = Number(body[body.length - j]);
    total += digit * (j % 2 === 1 ? 3 : 1);
  }
  return String((10 - (total % 10)) % 10);
}

/**
 * True only for a GTIN-8/12/13/14 whose check digit agrees.
 *
 * Feeds routinely put an internal identifier in a column labelled "EAN". The
 * check digit is what separates a barcode from a number, and a number that is
 * not a barcode must never become a merge key — that is how two unrelated
 * products end up sharing a price.
 */
export function isValidGtin(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  // Feeds emit all-zero values to mean "no barcode". They pass the check digit.
  if (/^0+$/.test(digits)) return false;

  return digits.slice(-1) === gtinCheckDigit(digits.slice(0, -1));
}

/**
 * ISBN-10 to GTIN-13: the 978 prefix plus the nine significant digits, with a
 * freshly computed GS1 check digit. The ISBN-10 mod-11 digit (which may be "X")
 * is discarded rather than reused — the two schemes do not agree.
 */
export function isbn10ToGtin13(isbn10: string): string | null {
  const body = isbn10.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (body.length !== 10) return null;

  const significant = body.slice(0, 9);
  if (!/^\d{9}$/.test(significant)) return null;

  const withPrefix = `978${significant}`;
  const check = gtinCheckDigit(withPrefix);
  return check === null ? null : withPrefix + check;
}

/**
 * The canonical form of one identifier, or `null` when it cannot be trusted.
 *
 * `null` is a decision, not a failure: the caller drops the identifier and
 * keeps the product. A hoodie with an unreadable barcode is still a hoodie.
 *
 * Every barcode family reduces to a zero-padded GTIN-14, which is what lets one
 * retailer's UPC-A and another's EAN-13 for the same item compare equal. That
 * equivalence is the reason cross-retailer comparison can work at all.
 */
export function normaliseIdentifier(
  type: IdentifierType,
  rawValue: string | null | undefined,
): string | null {
  if (rawValue === null || rawValue === undefined) return null;
  if (rawValue.trim() === '') return null;

  if (BARCODE_TYPES.has(type)) {
    let cleaned = rawValue.replace(/[^0-9Xx]/g, '');

    if (type === 'isbn' && cleaned.length === 10) {
      const converted = isbn10ToGtin13(cleaned);
      if (converted === null) return null;
      cleaned = converted;
    } else {
      cleaned = cleaned.replace(/[^0-9]/g, '');
    }

    if (!isValidGtin(cleaned)) return null;
    return cleaned.padStart(14, '0');
  }

  // ASIN, MPN, SKU and style codes: case and punctuation carry no meaning, so
  // "CW2288-111" and "cw2288111" are one style code.
  const cleaned = rawValue.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // A two-character "part number" matches half a catalogue. Not an identity.
  if (cleaned.length < 3) return null;

  return cleaned;
}

/**
 * Normalises a batch, dropping what cannot be trusted and de-duplicating what
 * survives. A feed that supplies the same barcode in both an `ean` and a `gtin`
 * column should produce one identifier, not two.
 */
export function normaliseIdentifiers(
  raw: readonly RawIdentifier[],
): NormalisedIdentifier[] {
  const seen = new Set<string>();
  const out: NormalisedIdentifier[] = [];

  for (const candidate of raw) {
    const value = normaliseIdentifier(candidate.type, candidate.value);
    if (value === null) continue;

    const key = `${candidate.type}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      type: candidate.type,
      raw: candidate.value,
      value,
      strong: isStrongIdentifier(candidate.type),
    });
  }

  return out;
}

/** True when the batch contains at least one identifier we would merge on. */
export function hasStrongIdentifier(
  identifiers: readonly NormalisedIdentifier[],
): boolean {
  return identifiers.some((identifier) => identifier.strong);
}
