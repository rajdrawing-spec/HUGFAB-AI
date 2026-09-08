import { z } from 'zod';

/**
 * Every input that reaches this module is parsed here first. Route handlers
 * hand over parsed values; nothing downstream re-checks a string (PRD §69).
 */

export const GENDERS = ['women', 'men', 'unisex', 'kids'] as const;
export const SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'newest'] as const;

export const MAX_PER_PAGE = 60;
export const DEFAULT_PER_PAGE = 24;

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase slug');

/** `?brand=nike,adidas` — a repeated key collapses to the last value, so CSV it is. */
const slugList = z
  .string()
  .trim()
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .pipe(z.array(slug).min(1).max(20));

/**
 * Prices cross the wire in **major** units, because that is what a user typed
 * into a filter. They become minor units here, once, so nothing downstream has
 * to remember which it is holding.
 */
const majorUnitPrice = z.coerce
  .number()
  .finite()
  .min(0)
  .max(10_000_000)
  .transform((value) => Math.round(value * 100));

export const productSearchParamsSchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    brand: slugList.optional(),
    category: slug.optional(),
    gender: z.enum(GENDERS).optional(),
    retailer: slugList.optional(),
    minPrice: majorUnitPrice.optional(),
    maxPrice: majorUnitPrice.optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    sort: z.enum(SORT_OPTIONS).default('relevance'),
    page: z.coerce.number().int().min(1).max(500).default(1),
    perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: 'minPrice must not exceed maxPrice', path: ['minPrice'] },
  );

export type ProductSearchParams = z.infer<typeof productSearchParamsSchema>;

export const productSlugSchema = z.object({ slug });

/**
 * Rows as they come back from Postgres.
 *
 * The database is a boundary like any other: a column can be renamed, a
 * migration can be half-applied, PostgREST can return a shape the type
 * annotation promised but did not deliver. Parsing here means a mismatch is a
 * clear error at the edge rather than `undefined` reaching a price calculation.
 */

const availability = z.enum([
  'in_stock',
  'out_of_stock',
  'preorder',
  'discontinued',
  'unknown',
]);

const summaryRow = z.object({ id: z.string(), slug: z.string(), name: z.string() });

export const searchRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  gender: z.enum(GENDERS),
  color: z.string().nullable(),
  material: z.string().nullable(),
  image_urls: z.array(z.string()).nullable(),
  is_mock: z.boolean(),
  created_at: z.string(),
  brand_id: z.string().nullable(),
  brand_slug: z.string().nullable(),
  brand_name: z.string().nullable(),
  category_id: z.string().nullable(),
  category_slug: z.string().nullable(),
  category_name: z.string().nullable(),
  best_price_minor: z.number().nullable(),
  best_original_minor: z.number().nullable(),
  best_currency: z.string().nullable(),
  best_availability: availability.nullable(),
  best_retailer_id: z.string().nullable(),
  best_retailer_slug: z.string().nullable(),
  best_retailer_name: z.string().nullable(),
  offer_count: z.coerce.number(),
  total_count: z.coerce.number(),
});

export type SearchRow = z.infer<typeof searchRowSchema>;

export const productDetailRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  gender: z.enum(GENDERS),
  color: z.string().nullable(),
  material: z.string().nullable(),
  image_urls: z.array(z.string()).nullable(),
  is_mock: z.boolean(),
  created_at: z.string(),
  brand: summaryRow.nullable(),
  category: summaryRow.nullable(),
  product_variants: z.array(
    z.object({
      id: z.string(),
      sku: z.string().nullable(),
      size: z.string().nullable(),
      color: z.string().nullable(),
      image_url: z.string().nullable(),
      availability,
    }),
  ),
  prices: z.array(
    z.object({
      id: z.string(),
      price_minor: z.number(),
      original_minor: z.number().nullable(),
      currency: z.string(),
      availability,
      retailer: summaryRow.nullable(),
    }),
  ),
});

export type ProductDetailRow = z.infer<typeof productDetailRowSchema>;
