import 'server-only';

import { isProduction } from '@/lib/env.server';
import { ApiError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  productDetailRowSchema,
  searchRowSchema,
  type ProductSearchParams,
  type SearchRow,
} from './schema';

/**
 * The only code that talks to Postgres about products.
 *
 * Every query runs through the request-scoped client, so RLS applies: this
 * layer never holds the service-role key and cannot read past a policy. That is
 * deliberate — the database, not this file, is the authority on who sees what.
 */

/**
 * Development seed rows are excluded in production, full stop. The flag is not
 * a request parameter: a client must never be able to ask for invented prices
 * (PRD §60, §69).
 */
function includeMockRows(): boolean {
  return !isProduction;
}

export interface SearchResult {
  rows: SearchRow[];
  total: number;
}

interface SearchProductsArgs {
  search_query: string | null;
  brand_slugs: string[] | null;
  category_slug: string | null;
  gender_filter: string | null;
  retailer_slugs: string[] | null;
  min_price_minor: number | null;
  max_price_minor: number | null;
  in_stock_only: boolean;
  include_mock: boolean;
  sort_by: string;
  page_limit: number;
  page_offset: number;
}

/**
 * postgrest-js types `rpc` by inferring its `Args` from the call site against a
 * `never` default, and our hand-written `Database` types do not satisfy that
 * inference — the call ends up typed as taking no arguments at all.
 *
 * Rather than contort the type declarations around it, the call is narrowed
 * once, here, with the argument type written out. The return value is
 * deliberately `unknown`: it is parsed by `searchRowSchema` below, which is a
 * stronger guarantee than an inferred type would have been, and one that
 * survives the switch to generated types.
 */
interface RpcCapableClient {
  rpc(
    fn: 'search_products',
    args: SearchProductsArgs,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export async function searchProducts(params: ProductSearchParams): Promise<SearchResult> {
  const supabase = (await createServerSupabase()) as unknown as RpcCapableClient;

  const { data, error } = await supabase.rpc('search_products', {
    search_query: params.q ?? null,
    brand_slugs: params.brand ?? null,
    category_slug: params.category ?? null,
    gender_filter: params.gender ?? null,
    retailer_slugs: params.retailer ?? null,
    min_price_minor: params.minPrice ?? null,
    max_price_minor: params.maxPrice ?? null,
    in_stock_only: params.inStock ?? false,
    include_mock: includeMockRows(),
    sort_by: params.sort,
    page_limit: params.perPage,
    page_offset: (params.page - 1) * params.perPage,
  });

  if (error) {
    logger.error('product search failed', error, { params });
    throw new ApiError('INTERNAL', 'Search is unavailable right now.');
  }

  const rows = searchRowSchema.array().parse(data ?? []);

  return {
    rows,
    // The function reports the size of the whole result set on every row; an
    // empty page legitimately means zero.
    total: rows[0]?.total_count ?? 0,
  };
}

export async function findProductBySlug(slug: string) {
  const supabase = await createServerSupabase();

  const query = supabase
    .from('products')
    .select(
      `id, slug, title, description, gender, color, material, image_urls, is_mock, created_at,
       brand:brands (id, slug, name),
       category:categories (id, slug, name),
       product_variants (id, sku, size, color, image_url, availability),
       prices (id, price_minor, original_minor, currency, availability,
               retailer:retailers (id, slug, name))`,
    )
    .eq('slug', slug);

  // RLS already hides inactive products, but saying so here means a
  // misconfigured policy cannot quietly widen this query.
  const { data, error } = await query.eq('is_active', true).maybeSingle();

  if (error) {
    logger.error('product lookup failed', error, { slug });
    throw new ApiError('INTERNAL', 'That product could not be loaded.');
  }
  if (!data) return null;

  if (!includeMockRows() && (data as { is_mock?: boolean }).is_mock) {
    return null;
  }

  return productDetailRowSchema.parse(data);
}
