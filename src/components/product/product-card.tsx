import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui';
import type { ProductSummary } from '@/modules/products/types';
import { PriceDisplay } from './price-display';

/**
 * A product in a grid. Image, wishlist affordance, brand, title, price cluster,
 * retailer — the order the concept fixes (docs/ui-ux-guide.md §4).
 *
 * The whole card is one link. The wishlist control is deliberately NOT nested
 * inside it — a button inside an anchor is invalid HTML and behaves
 * unpredictably for keyboard and screen-reader users — so it is a sibling
 * positioned over the image, and the link is given the lower stacking order.
 */

export interface ProductCardProps {
  product: ProductSummary;
  /** Phase 1 has no wishlist write path yet; omit until it does. */
  onWishlist?: never;
}

export function ProductCard({ product }: ProductCardProps) {
  const image = product.imageUrls[0];

  return (
    <article className="group relative flex flex-col">
      <div className="bg-surface-2 relative aspect-[3/4] overflow-hidden rounded-lg">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ImagePlaceholder />
        )}

        {product.isMock && (
          <span className="absolute top-2 left-2">
            <Badge tone="warning" variant="solid">
              MOCK DATA
            </Badge>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {product.brand && (
          <span className="text-caption text-muted font-semibold tracking-wide uppercase">
            {product.brand.name}
          </span>
        )}

        {/*
          `after:absolute after:inset-0` makes the title link cover the card, so
          the whole card is clickable while the accessible name stays the title
          rather than "image, link, link".
        */}
        <h3 className="text-small text-text line-clamp-2 font-medium">
          <Link
            href={`/products/${product.slug}`}
            className="after:absolute after:inset-0"
          >
            {product.title}
          </Link>
        </h3>

        {product.bestOffer ? (
          <>
            <PriceDisplay offer={product.bestOffer} size="sm" className="mt-1" />
            <div className="text-caption text-muted flex items-center gap-1.5">
              <span>{product.bestOffer.retailer.name}</span>
              {product.offerCount > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{product.offerCount} stores</span>
                </>
              )}
            </div>
          </>
        ) : (
          // A product with no offer is not a bargain and not an error — it is
          // simply not buyable right now, and says so.
          <p className="text-small text-muted mt-1">Not currently listed</p>
        )}
      </div>
    </article>
  );
}

function ImagePlaceholder() {
  return (
    <div className="text-muted/40 flex h-full items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        className="size-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </div>
  );
}

/** Matches ProductCard's geometry so the grid does not reflow when data lands. */
export function ProductCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col" aria-hidden="true">
      <div className="bg-surface-2 aspect-[3/4] rounded-lg" />
      <div className="mt-3 flex flex-col gap-2">
        <div className="bg-surface-2 h-3 w-1/3 rounded-sm" />
        <div className="bg-surface-2 h-4 w-4/5 rounded-sm" />
        <div className="bg-surface-2 h-5 w-1/2 rounded-sm" />
      </div>
    </div>
  );
}
