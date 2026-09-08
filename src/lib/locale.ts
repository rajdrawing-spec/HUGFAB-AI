import { clientEnv } from './env.client';
import { setDefaultFormattingLocale, type CurrencyCode } from './money';

/**
 * Locale abstraction. India first, other markets later without touching
 * component code (PRD §73). A market is a locale + currency + region triple;
 * adding one is an entry in SUPPORTED_MARKETS.
 */

export interface Market {
  /** BCP-47 tag used for all Intl formatting. */
  readonly locale: string;
  readonly currency: CurrencyCode;
  /** ISO-3166-1 alpha-2. Decides which retailers and feeds are in scope. */
  readonly region: string;
  readonly label: string;
}

export const SUPPORTED_MARKETS: Readonly<Record<string, Market>> = {
  'en-IN': { locale: 'en-IN', currency: 'INR', region: 'IN', label: 'India' },
  'en-US': { locale: 'en-US', currency: 'USD', region: 'US', label: 'United States' },
  'en-GB': { locale: 'en-GB', currency: 'GBP', region: 'GB', label: 'United Kingdom' },
  'en-AE': {
    locale: 'en-AE',
    currency: 'AED',
    region: 'AE',
    label: 'United Arab Emirates',
  },
};

export const DEFAULT_MARKET: Market =
  SUPPORTED_MARKETS[clientEnv.NEXT_PUBLIC_DEFAULT_LOCALE] ??
  ({
    locale: clientEnv.NEXT_PUBLIC_DEFAULT_LOCALE,
    currency: clientEnv.NEXT_PUBLIC_DEFAULT_CURRENCY,
    region: clientEnv.NEXT_PUBLIC_DEFAULT_LOCALE.split('-')[1] ?? 'IN',
    label: clientEnv.NEXT_PUBLIC_DEFAULT_LOCALE,
  } satisfies Market);

/** Give `formatMoney` its default locale without money.ts reading the env. */
setDefaultFormattingLocale(() => DEFAULT_MARKET.locale);

/**
 * Best market for a request. Accepts an explicit preference (a user setting or
 * a `?locale=` param) and falls back through the Accept-Language header to the
 * configured default. Never throws — an unrecognised tag is simply ignored.
 */
export function resolveMarket(
  preferred?: string | null,
  acceptLanguage?: string | null,
): Market {
  const direct = preferred ? SUPPORTED_MARKETS[preferred] : undefined;
  if (direct) return direct;

  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const exact = SUPPORTED_MARKETS[tag];
    if (exact) return exact;
    const byRegion = Object.values(SUPPORTED_MARKETS).find(
      (m) => m.region.toLowerCase() === tag.split('-')[1]?.toLowerCase(),
    );
    if (byRegion) return byRegion;
  }

  return DEFAULT_MARKET;
}

/** Header tags in descending q-order. */
function parseAcceptLanguage(header?: string | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      return { tag: tag.trim(), q: q ? Number.parseFloat(q) : 1 };
    })
    .filter((entry) => entry.tag.length > 0 && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag);
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions & { locale?: string } = {},
): string {
  const { locale = DEFAULT_MARKET.locale, ...rest } = options;
  return new Intl.NumberFormat(locale, rest).format(value);
}

/** `percent` takes whole numbers: 40 → "40%". */
export function formatPercent(percent: number, locale = DEFAULT_MARKET.locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(percent / 100);
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions & { locale?: string } = {},
): string {
  const { locale = DEFAULT_MARKET.locale, ...rest } = options;
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...rest,
  }).format(date);
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "2 days ago" for price-history and community timestamps. */
export function formatRelativeTime(
  value: Date | string | number,
  now: Date = new Date(),
  locale = DEFAULT_MARKET.locale,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const deltaMs = date.getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= ms) {
      return formatter.format(Math.round(deltaMs / ms), unit);
    }
  }
  return formatter.format(Math.round(deltaMs / 1000), 'second');
}
