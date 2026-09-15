import { describe, expect, it } from 'vitest';

import {
  gtinCheckDigit,
  isbn10ToGtin13,
  isValidGtin,
  normaliseIdentifier,
  normaliseIdentifiers,
  isStrongIdentifier,
} from './identifiers';

/**
 * These vectors are deliberately the same ones asserted in SQL, in
 * `supabase/tests/01_rls_assertions.sql`. The rule exists in two languages, so
 * the two implementations are held to one set of examples: if they ever
 * disagree about what a product is, one of these suites fails.
 */

describe('GS1 check digits', () => {
  it('validates a real UPC-A', () => {
    // 036000291452 — the barcode on a can of Coca-Cola.
    expect(isValidGtin('036000291452')).toBe(true);
  });

  it('rejects the same body with a wrong check digit', () => {
    expect(isValidGtin('036000291453')).toBe(false);
  });

  it('rejects the all-zero placeholder feeds use to mean "no barcode"', () => {
    expect(isValidGtin('0000000000000')).toBe(false);
  });

  it('rejects a value of the wrong length', () => {
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('0360002914')).toBe(false);
  });

  it('rejects anything non-numeric', () => {
    expect(isValidGtin('03600029145X')).toBe(false);
    expect(gtinCheckDigit('12a4')).toBeNull();
  });
});

describe('normalisation', () => {
  it('reduces every barcode family for one item to a single key', () => {
    const asUpc = normaliseIdentifier('upc', '0-36000-29145-2');
    const asEan = normaliseIdentifier('ean', '0036000291452');
    const asGtin = normaliseIdentifier('gtin', ' 00036000291452 ');

    expect(asUpc).toBe('00036000291452');
    expect(asEan).toBe(asUpc);
    expect(asGtin).toBe(asUpc);
  });

  it('returns null for a barcode that cannot be trusted', () => {
    expect(normaliseIdentifier('ean', 'NOT-A-BARCODE')).toBeNull();
    expect(normaliseIdentifier('ean', '036000291453')).toBeNull();
    expect(normaliseIdentifier('gtin', '')).toBeNull();
    expect(normaliseIdentifier('upc', null)).toBeNull();
  });

  it('strips punctuation and case from style codes', () => {
    expect(normaliseIdentifier('style_code', 'CW2288-111')).toBe('CW2288111');
    expect(normaliseIdentifier('style_code', 'cw2288 111')).toBe('CW2288111');
  });

  it('refuses an identifier too short to identify anything', () => {
    expect(normaliseIdentifier('mpn', 'A1')).toBeNull();
    expect(normaliseIdentifier('sku', '-')).toBeNull();
  });

  it('converts ISBN-10 to a GTIN-13 with a recomputed check digit', () => {
    // 0-306-40615-2 is a standard ISBN-10 example; its ISBN-13 is
    // 978-0-306-40615-7. The mod-11 digit is discarded, not reused.
    expect(isbn10ToGtin13('0-306-40615-2')).toBe('9780306406157');
    expect(normaliseIdentifier('isbn', '0-306-40615-2')).toBe('09780306406157');
  });
});

describe('strength', () => {
  it('treats barcodes and ASINs as identities on their own', () => {
    expect(isStrongIdentifier('gtin')).toBe(true);
    expect(isStrongIdentifier('asin')).toBe(true);
  });

  it('treats part and stock numbers as brand-scoped only', () => {
    // Two brands can both ship a part numbered "100".
    expect(isStrongIdentifier('mpn')).toBe(false);
    expect(isStrongIdentifier('sku')).toBe(false);
    expect(isStrongIdentifier('style_code')).toBe(false);
  });
});

describe('batches', () => {
  it('drops what cannot be trusted and keeps the rest', () => {
    const result = normaliseIdentifiers([
      { type: 'ean', value: '0036000291452' },
      { type: 'ean', value: 'rubbish' },
      { type: 'style_code', value: 'CW2288-111' },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.value)).toEqual(['00036000291452', 'CW2288111']);
  });

  it('de-duplicates a barcode supplied in two columns', () => {
    const result = normaliseIdentifiers([
      { type: 'ean', value: '0036000291452' },
      { type: 'ean', value: '00036000291452' },
    ]);

    expect(result).toHaveLength(1);
  });

  it('keeps the raw value for diagnosing a bad supplier', () => {
    const [first] = normaliseIdentifiers([{ type: 'upc', value: '0-36000-29145-2' }]);
    expect(first?.raw).toBe('0-36000-29145-2');
    expect(first?.value).toBe('00036000291452');
  });
});
