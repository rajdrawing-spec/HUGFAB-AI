import 'server-only';

import type { Paginated, ProductDetail, ProductSummary } from './types';
import { toProductDetail, toProductSummary } from './mapper';
import * as repository from './repository';
import type { ProductSearchParams } from './schema';

/**
 * The catalogue's public surface. Route handlers and server components call
 * these; nothing outside this module touches `repository.ts`.
 */

export async function searchProducts(
  params: ProductSearchParams,
): Promise<Paginated<ProductSummary>> {
  const { rows, total } = await repository.searchProducts(params);

  return {
    items: rows.map(toProductSummary),
    page: params.page,
    perPage: params.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const row = await repository.findProductBySlug(slug);
  return row === null ? null : toProductDetail(row);
}
