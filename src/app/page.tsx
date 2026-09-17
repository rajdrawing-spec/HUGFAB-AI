import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchBar, CategoryRail } from '@/components/search';
import { ProductGrid, ProductGridSkeleton } from '@/components/product';
import { logger } from '@/lib/logger';
import { listTopCategories } from '@/modules/products/repository';
import { searchProducts } from '@/modules/products/service';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * Homepage — UI/UX guide screens 01 and 02, Phase 1.
 *
 * Content order is the concept's, and it is the same on both surfaces: hero and
 * search, then the category rail, then the grid. Desktop widens the hero and
 * lays the grid out four-up; mobile stacks and scrolls the rail. There is no
 * separate mobile page.
 *
 * **Every section is driven by the catalogue and disappears without it.** The
 * rail renders the categories that exist, the grid renders the products that
 * exist, and with an empty database the page is a hero and a search bar rather
 * than a wall of placeholders implying a shop that is not there yet. That is
 * the same rule the rest of the product follows: nothing presented as live that
 * is not (PRD §60, §69).
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Suspense fallback={null}>
          <Categories />
        </Suspense>

        <Suspense fallback={<TrendingSkeleton />}>
          <Trending />
        </Suspense>
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="from-primary-soft to-surface bg-gradient-to-b">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 sm:pb-14">
        <h1 className="text-display max-w-[14ch] text-balance">
          See it. Style it. <span className="text-primary">Shop it.</span>
        </h1>

        <p className="text-body-lg text-muted mt-4 max-w-prose">
          One product, every retailer, the real best price. Search across stores, compare
          what they actually charge, and buy from whoever is cheapest.
        </p>

        <div className="mt-8 max-w-2xl">
          {/*
            SearchBar reads the query string to seed itself, so it needs a
            boundary for the homepage shell to prerender. The fallback matches
            the bar's height exactly, so the hero does not reflow when it
            hydrates.
          */}
          <Suspense fallback={<div className="bg-surface-2 h-13 rounded-full" />}>
            <SearchBar size="lg" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function Categories() {
  const categories = await listTopCategories();
  // CategoryRail returns null when the list is empty, so no wrapper, no heading
  // and no empty gap appear on a catalogue that has no categories yet.
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="categories" className="pt-10">
      <h2 id="categories" className="text-h2 mb-6 text-center">
        Shop by category
      </h2>
      <CategoryRail categories={categories} />
    </section>
  );
}

function TrendingSkeleton() {
  return (
    <section className="pt-12">
      <div className="bg-surface-2 mb-6 h-6 w-48 animate-pulse rounded-sm" />
      <ProductGridSkeleton />
    </section>
  );
}

/**
 * Newest first rather than "trending": a ranking that claims popularity needs
 * behaviour behind it, and there is none yet. Recency is a claim the data
 * actually supports (PRD §69).
 */
async function Trending() {
  let page;
  try {
    page = await searchProducts({
      sort: 'newest',
      page: 1,
      perPage: 8,
    });
  } catch (error) {
    // An unreachable database costs the homepage its grid, not the homepage.
    // The visitor sees the same honest message either way — "nothing listed
    // yet" is true whether the feeds have not arrived or the query failed —
    // while the cause goes to the logs, where it can actually be diagnosed.
    logger.warn('homepage grid could not be loaded', {
      cause: error instanceof Error ? error.message : String(error),
    });
    return <EmptyCatalogue />;
  }

  if (page.items.length === 0) return <EmptyCatalogue />;

  return (
    <section aria-labelledby="new-in" className="pt-12 pb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="new-in" className="text-h2">
          New in
        </h2>
        <Link href="/search?sort=newest" className="text-small text-primary font-medium">
          See all
        </Link>
      </div>

      <ProductGrid products={page.items} />
    </section>
  );
}

/**
 * Shown when there is nothing to list, for any reason.
 *
 * It says so plainly instead of dressing the page with placeholder products: a
 * shopper who sees invented items and then finds none has been misled, and one
 * who sees an honest message has simply arrived early.
 *
 * The wording deliberately asserts no cause. This renders both when the
 * catalogue is genuinely empty and when the query failed, and the page cannot
 * tell a visitor which — so it claims neither.
 */
function EmptyCatalogue() {
  return (
    <section className="py-16 text-center">
      <h2 className="text-h2">Nothing listed yet</h2>
      <p className="text-body text-muted mx-auto mt-3 max-w-prose">
        We are connecting retailer feeds now. When products are listed, this is where they
        will appear — we would rather show you nothing than prices we cannot stand behind.
      </p>
      <Link
        href="/search"
        className="text-button border-border-strong hover:bg-surface-2 mt-6 inline-flex h-11 items-center rounded-full border px-6 font-semibold transition-colors"
      >
        Try a search anyway
      </Link>
    </section>
  );
}
