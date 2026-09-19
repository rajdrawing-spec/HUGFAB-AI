import 'server-only';

import { cache } from 'react';

import { ApiError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { createPublicSupabase } from '@/lib/supabase/public';
import { createServerSupabase } from '@/lib/supabase/server';
import type { CategorySummary } from './types';
import {
  categoryRowSchema,
  indexableProductSchema,
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
 * Whether the labelled demo catalogue is switched on for this deployment.
 *
 * The answer is a row in `app_settings`, read through `mock_products_allowed()`
 * — the same function the RLS policies consult. That is the point: application
 * and database cannot disagree about what is visible, because they are reading
 * the same switch.
 *
 * It is not a request parameter and never will be. A caller asking for mock
 * rows is overruled by RLS regardless (supabase/tests/01_rls_assertions.sql
 * asserts exactly that), so the worst a wrong answer here can do is hide rows
 * that were allowed — never reveal rows that were not.
 *
 * `cache()` scopes the lookup to one request, so a page that searches and then
 * renders a rail does not ask twice.
 *
 * Fails closed. If the flag cannot be read, the demo catalogue is off.
 */
export const demoCatalogueEnabled = cache(async (): Promise<boolean> => {
  const supabase = createPublicSupabase();
  if (supabase === null) return false;

  try {
    const { data, error } = await (
      supabase as unknown as {
        rpc(fn: 'mock_products_allowed'): PromiseLike<{
          data: unknown;
          error: { message: string } | null;
        }>;
      }
    ).rpc('mock_products_allowed');

    if (error) {
      logger.warn('demo catalogue flag could not be read', { cause: error.message });
      return false;
    }
    return data === true;
  } catch (error) {
    logger.warn('demo catalogue flag could not be read', {
      cause: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
});

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
    include_mock: await demoCatalogueEnabled(),
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
               retailer:retailers (id, slug, name, logo_url))`,
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

  // RLS has already excluded the row if the demo catalogue is off; this is the
  // belt to that brace, and it keeps the rule legible from the application side.
  if ((data as { is_mock?: boolean }).is_mock && !(await demoCatalogueEnabled())) {
    return null;
  }

  return productDetailRowSchema.parse(data);
}

/**
 * Slugs for the sitemap: active, real, indexable products.
 *
 * Reads through the anonymous client rather than the request-scoped one, so it
 * works during static generation where `cookies()` does not exist.
 *
 * `is_mock` is excluded unconditionally here, and that is not redundant with
 * RLS: the demo catalogue is deliberately visible in production while
 * affiliate approval is pending, so the policy would happily return those rows.
 * A sitemap is a promise to a search engine that these URLs are worth indexing,
 * and a demo product is not. The product page agrees — it sets `robots:
 * noindex` for the same rows.
 *
 * Never throws. A sitemap missing its products is a degraded sitemap; a
 * sitemap that fails the build is a failed deploy.
 */
export interface IndexableProduct {
  slug: string;
  updatedAt: string;
}

export async function listIndexableProducts(limit = 10_000): Promise<IndexableProduct[]> {
  const supabase = createPublicSupabase();
  if (supabase === null) return [];

  try {
    const { data, error } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)
      .eq('is_mock', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn('sitemap could not list products', { cause: error.message });
      return [];
    }

    return (data ?? []).flatMap((row) => {
      const parsed = indexableProductSchema.safeParse(row);
      return parsed.success
        ? [{ slug: parsed.data.slug, updatedAt: parsed.data.updated_at }]
        : [];
    });
  } catch (error) {
    logger.warn('sitemap product lookup threw', {
      cause: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Top-level categories for the homepage rail, in their configured order.
 *
 * Only roots: the rail is a way in, and "Topwear" belongs there while
 * "Oversized Hoodies" belongs behind it. Nine is the guide's count
 * (docs/ui-ux-guide.md §4) and a comfortable single row on desktop.
 *
 * Reads through the anonymous client, so it works during static generation and
 * so RLS still decides what comes back. Never throws: a homepage without its
 * category rail is a smaller loss than a homepage that 500s.
 */
export async function listTopCategories(limit = 9): Promise<CategorySummary[]> {
  const supabase = createPublicSupabase();
  if (supabase === null) return [];

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, slug, name')
      .is('parent_id', null)
      .order('position', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      logger.warn('category rail could not be loaded', {
        code: error.code,
        cause: error.message,
      });
      return [];
    }

    return (data ?? []).flatMap((row) => {
      const parsed = categoryRowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    logger.warn('category lookup threw', {
      cause: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Every category, grouped under its top-level parent, for the categories page.
 *
 * One query and an in-memory grouping rather than a recursive CTE: the tree is
 * two levels deep and a few dozen rows, so a second round trip would cost more
 * than the grouping does.
 *
 * Never throws, for the same reason `listTopCategories` does not — a browse
 * page that renders without its list is a worse page, but a browse page that
 * 500s is a broken one.
 */
export interface CategoryGroup {
  parent: CategorySummary;
  children: CategorySummary[];
}

export async function listCategoryTree(): Promise<CategoryGroup[]> {
  const supabase = createPublicSupabase();
  if (supabase === null) return [];

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, slug, name, parent_id')
      .order('position', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.warn('category tree could not be loaded', { cause: error.message });
      return [];
    }

    type Row = { id: string; slug: string; name: string; parent_id: string | null };
    const rows = (data ?? []) as Row[];

    const parents = rows.filter((r) => r.parent_id === null);
    return parents.map((parent) => ({
      parent: { id: parent.id, slug: parent.slug, name: parent.name, imageUrl: null },
      children: rows
        .filter((r) => r.parent_id === parent.id)
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name, imageUrl: null })),
    }));
  } catch (error) {
    logger.warn('category tree lookup threw', {
      cause: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
