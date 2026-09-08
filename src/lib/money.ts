/**
 * Currency abstraction. Every price in HugFab passes through here.
 *
 * No component may hard-code a currency symbol — not `₹`, not `$` (PRD §73).
 * India ships first, but the platform is built so that adding US/UK/UAE is a
 * configuration change rather than a find-and-replace.
 *
 * Amounts are held as integer **minor units** (paise, cents, fils). Money is
 * never a float: 0.1 + 0.2 is not 0.3, and a price comparison site that is a
 * paisa out on a total has lost the argument.
 */

export type CurrencyCode = string;

export interface Money {
  /** Integer count of the currency's smallest unit. 49900 INR = ₹499.00 */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

/** ISO-4217 exponents that are not 2. Everything unlisted is assumed to be 2. */
const MINOR_UNIT_EXPONENTS: Readonly<Record<string, number>> = {
  BHD: 3,
  CLP: 0,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  OMR: 3,
  TND: 3,
  VND: 0,
};

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(
      `Cannot combine ${a} with ${b}. Convert to a single currency first — ` +
        `HugFab never adds across currencies implicitly.`,
    );
    this.name = 'CurrencyMismatchError';
  }
}

export function minorUnitExponent(currency: CurrencyCode): number {
  return MINOR_UNIT_EXPONENTS[currency.toUpperCase()] ?? 2;
}

function minorUnitFactor(currency: CurrencyCode): number {
  return 10 ** minorUnitExponent(currency);
}

/** Build a Money from an integer minor-unit amount (the storage representation). */
export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(amountMinor)) {
    throw new TypeError(`Money amount must be finite, received ${amountMinor}`);
  }
  return { amountMinor: Math.round(amountMinor), currency: currency.toUpperCase() };
}

/** Build a Money from a human-facing major-unit amount, e.g. 499.5 → 49950 paise. */
export function fromMajorUnits(amount: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`Money amount must be finite, received ${amount}`);
  }
  return money(Math.round(amount * minorUnitFactor(currency)), currency);
}

/** The major-unit value, for handing to Intl or an external API. */
export function toMajorUnits(value: Money): number {
  return value.amountMinor / minorUnitFactor(value.currency);
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Negative when `a` is cheaper. Sorts ascending by price. */
export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor - b.amountMinor;
}

export function minMoney(values: readonly Money[]): Money | null {
  if (values.length === 0) return null;
  return values.reduce((best, next) => (compareMoney(next, best) < 0 ? next : best));
}

/**
 * Whole-percent discount, rounded to the nearest integer, or `null` when the
 * comparison is meaningless (no original price, or the "discount" is not one).
 * Never invent a percentage the retailer has not actually offered.
 */
export function discountPercent(original: Money, current: Money): number | null {
  assertSameCurrency(original, current);
  if (original.amountMinor <= 0) return null;
  if (current.amountMinor >= original.amountMinor) return null;
  const fraction = 1 - current.amountMinor / original.amountMinor;
  return Math.round(fraction * 100);
}

export interface FormatMoneyOptions {
  /** BCP-47 tag. Defaults to the app locale via `lib/locale.ts`. */
  locale?: string;
  /** `compact` renders ₹1.2L / $1.2K for chart axes and dense cards. */
  notation?: 'standard' | 'compact';
  /**
   * Whole amounts drop their decimals by default — retail convention in India
   * and elsewhere: ₹499, not ₹499.00. Set true when the exact figure matters
   * (invoices, price-history tooltips).
   */
  alwaysShowFraction?: boolean;
  /** `narrowSymbol` gives ₹/$ rather than INR/US$. */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
}

/**
 * The only place a currency symbol is ever produced. `Intl` owns symbol choice,
 * digit grouping (Indian lakh/crore grouping included) and placement.
 */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const {
    locale = defaultFormattingLocale(),
    notation = 'standard',
    alwaysShowFraction = false,
    currencyDisplay = 'narrowSymbol',
  } = options;

  const exponent = minorUnitExponent(value.currency);
  const isWhole = value.amountMinor % minorUnitFactor(value.currency) === 0;
  const fractionDigits = alwaysShowFraction || !isWhole ? exponent : 0;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: value.currency,
      currencyDisplay,
      notation,
      minimumFractionDigits: notation === 'compact' ? undefined : fractionDigits,
      maximumFractionDigits: notation === 'compact' ? 1 : fractionDigits,
    }).format(toMajorUnits(value));
  } catch {
    // An unknown ISO code or a runtime without full ICU: degrade to something
    // unambiguous rather than throwing inside a render.
    return `${value.currency} ${toMajorUnits(value).toFixed(exponent)}`;
  }
}

/** "₹1,299 – ₹2,499" across retailers, collapsing to one price when equal. */
export function formatMoneyRange(
  low: Money,
  high: Money,
  options: FormatMoneyOptions = {},
): string {
  assertSameCurrency(low, high);
  if (low.amountMinor === high.amountMinor) return formatMoney(low, options);
  return `${formatMoney(low, options)} – ${formatMoney(high, options)}`;
}

/**
 * Indirection so `formatMoney` has a sane default without importing the locale
 * module (which reads the environment) and making this file untestable.
 * `lib/locale.ts` installs the real resolver on import.
 */
let formattingLocaleResolver: () => string = () => 'en-IN';

export function setDefaultFormattingLocale(resolver: () => string): void {
  formattingLocaleResolver = resolver;
}

function defaultFormattingLocale(): string {
  return formattingLocaleResolver();
}
