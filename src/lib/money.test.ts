import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  CurrencyMismatchError,
  discountPercent,
  formatMoney,
  formatMoneyRange,
  fromMajorUnits,
  minMoney,
  minorUnitExponent,
  money,
  toMajorUnits,
} from './money';

describe('minor units', () => {
  it('treats an unlisted currency as having two decimal places', () => {
    expect(minorUnitExponent('INR')).toBe(2);
    expect(minorUnitExponent('XYZ')).toBe(2);
  });

  it('honours currencies that are not two-decimal', () => {
    expect(minorUnitExponent('JPY')).toBe(0);
    expect(minorUnitExponent('KWD')).toBe(3);
  });

  it('round-trips major units through the minor-unit representation', () => {
    expect(fromMajorUnits(2499.5, 'INR').amountMinor).toBe(249950);
    expect(toMajorUnits(money(249950, 'INR'))).toBe(2499.5);
    expect(fromMajorUnits(1200, 'JPY').amountMinor).toBe(1200);
  });

  it('avoids the float error that decimal arithmetic would introduce', () => {
    const total = addMoney(fromMajorUnits(0.1, 'USD'), fromMajorUnits(0.2, 'USD'));
    expect(total.amountMinor).toBe(30);
    expect(toMajorUnits(total)).toBe(0.3);
  });

  it('normalises the currency code', () => {
    expect(money(100, 'inr').currency).toBe('INR');
  });
});

/**
 * Intl separates a currency *code* from the number with a non-breaking space
 * (U+00A0). Normalising it keeps the expectations readable rather than carrying
 * an invisible character.
 */
const spaces = (value: string) => value.replace(/\u00A0/g, ' ');

describe('formatting', () => {
  it('drops decimals for whole amounts and keeps them otherwise', () => {
    expect(formatMoney(fromMajorUnits(2499, 'INR'), { locale: 'en-IN' })).toBe('₹2,499');
    expect(formatMoney(fromMajorUnits(2499.5, 'INR'), { locale: 'en-IN' })).toBe(
      '₹2,499.50',
    );
  });

  it('can be forced to show the exact figure', () => {
    expect(
      formatMoney(fromMajorUnits(2499, 'INR'), {
        locale: 'en-IN',
        alwaysShowFraction: true,
      }),
    ).toBe('₹2,499.00');
  });

  it('uses Indian digit grouping in en-IN and Western grouping in en-US', () => {
    const lakh = fromMajorUnits(123456, 'INR');
    expect(formatMoney(lakh, { locale: 'en-IN' })).toBe('₹1,23,456');
    expect(formatMoney(fromMajorUnits(123456, 'USD'), { locale: 'en-US' })).toBe(
      '$123,456',
    );
  });

  it('never hard-codes a symbol — the currency decides it', () => {
    const amount = 1999;
    expect(formatMoney(fromMajorUnits(amount, 'USD'), { locale: 'en-US' })).toContain(
      '$',
    );
    expect(formatMoney(fromMajorUnits(amount, 'GBP'), { locale: 'en-GB' })).toContain(
      '£',
    );
    expect(formatMoney(fromMajorUnits(amount, 'INR'), { locale: 'en-IN' })).toContain(
      '₹',
    );
  });

  it('renders an unrecognised but well-formed code as the code itself', () => {
    // Intl accepts any three-letter code and simply prints it in place of a
    // symbol, which is the behaviour we want for a currency we do not yet know.
    expect(spaces(formatMoney(money(150000, 'ZZZ'), { locale: 'en-IN' }))).toBe(
      'ZZZ 1,500',
    );
  });

  it('falls back rather than throwing when Intl rejects the currency', () => {
    // A malformed code makes Intl throw a RangeError. A price must never take
    // a page down, so the formatter degrades to something unambiguous.
    expect(spaces(formatMoney(money(150000, 'RUPEES'), { locale: 'en-IN' }))).toBe(
      'RUPEES 1500.00',
    );
  });

  it('collapses a range whose ends are equal', () => {
    const price = fromMajorUnits(999, 'INR');
    expect(formatMoneyRange(price, price, { locale: 'en-IN' })).toBe('₹999');
    expect(
      formatMoneyRange(price, fromMajorUnits(1499, 'INR'), { locale: 'en-IN' }),
    ).toBe('₹999 – ₹1,499');
  });
});

describe('comparison', () => {
  it('reports a whole-percent discount', () => {
    expect(
      discountPercent(fromMajorUnits(2000, 'INR'), fromMajorUnits(1500, 'INR')),
    ).toBe(25);
  });

  it('refuses to invent a discount that does not exist', () => {
    expect(
      discountPercent(fromMajorUnits(1000, 'INR'), fromMajorUnits(1000, 'INR')),
    ).toBeNull();
    expect(
      discountPercent(fromMajorUnits(1000, 'INR'), fromMajorUnits(1200, 'INR')),
    ).toBeNull();
    expect(discountPercent(money(0, 'INR'), fromMajorUnits(500, 'INR'))).toBeNull();
  });

  it('finds the cheapest retailer price', () => {
    const prices = [
      fromMajorUnits(2499, 'INR'),
      fromMajorUnits(1899, 'INR'),
      fromMajorUnits(2100, 'INR'),
    ];
    expect(minMoney(prices)?.amountMinor).toBe(189900);
    expect(minMoney([])).toBeNull();
  });

  it('refuses to combine or compare across currencies', () => {
    const inr = fromMajorUnits(100, 'INR');
    const usd = fromMajorUnits(100, 'USD');
    expect(() => addMoney(inr, usd)).toThrow(CurrencyMismatchError);
    expect(() => compareMoney(inr, usd)).toThrow(CurrencyMismatchError);
  });
});
