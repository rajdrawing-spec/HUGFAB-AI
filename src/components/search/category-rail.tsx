import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import type { CategorySummary } from '@/modules/products/types';

/**
 * The category rail: circular thumbnails with labels beneath, horizontally
 * scrollable on mobile (docs/ui-ux-guide.md §4).
 *
 * **Driven by the catalogue, not by a hard-coded list.** The guide names nine
 * categories — Topwear, Bottomwear, Dresses, Footwear, Accessories, Sports,
 * Beauty, Home, Brands — and it would be easy to write those nine in and have a
 * rail that always looks right. It would also link a shopper to nine empty
 * result pages, which is a promise about a catalogue we do not have.
 *
 * So the rail renders the categories that exist. Ingestion creates them from
 * each feed's own taxonomy, which means the rail grows to match the catalogue
 * instead of describing an intended one. With no categories it renders nothing.
 */

export interface CategoryRailProps {
  categories: readonly CategorySummary[];
  /** Highlights the category currently being browsed. */
  activeSlug?: string | undefined;
  className?: string;
}

/**
 * A stable colour per category, derived from the slug.
 *
 * `categories` has no image column, and a thumbnail is not worth a migration
 * before there is artwork to put in it. A deterministic tint keeps the rail
 * legible and, more usefully, keeps each category the *same* colour between
 * visits — so the rail becomes recognisable by shape rather than only by
 * reading every label.
 */
const TINTS = [
  'bg-primary-soft text-primary',
  'bg-secondary-soft text-secondary',
  'bg-accent-soft text-accent',
  'bg-surface-2 text-text',
] as const;

function tintFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length]!;
}

function initial(name: string): string {
  const letter = name.trim().match(/\p{L}|\p{N}/u);
  return letter ? letter[0]!.toUpperCase() : '·';
}

export function CategoryRail({ categories, activeSlug, className }: CategoryRailProps) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Shop by category" className={cn('relative', className)}>
      {/*
        Scrolls horizontally on mobile and wraps to a centred row once there is
        room. `-mx-4 px-4` lets the first and last thumbnails reach the screen
        edge while still clearing the gutter when scrolled to either end.
      */}
      <ul
        className={cn(
          '-mx-4 flex gap-5 overflow-x-auto px-4 pb-2',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0',
        )}
      >
        {categories.map((category) => {
          const isActive = category.slug === activeSlug;

          return (
            <li key={category.id} className="shrink-0">
              <Link
                href={`/search?category=${encodeURIComponent(category.slug)}`}
                aria-current={isActive ? 'page' : undefined}
                className="group focus-visible:outline-primary flex w-20 flex-col items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <span
                  className={cn(
                    'relative grid size-16 place-items-center overflow-hidden rounded-full',
                    'transition-transform duration-150 group-hover:scale-105',
                    isActive && 'ring-primary ring-2 ring-offset-2',
                    category.imageUrl ? 'bg-surface-2' : tintFor(category.slug),
                  )}
                >
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="size-full object-cover"
                      aria-hidden="true"
                    />
                  ) : (
                    <span aria-hidden="true" className="text-h3 font-semibold">
                      {initial(category.name)}
                    </span>
                  )}
                </span>

                <span
                  className={cn(
                    'text-small w-full text-center leading-tight text-balance',
                    isActive ? 'text-primary font-semibold' : 'text-text',
                  )}
                >
                  {category.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
