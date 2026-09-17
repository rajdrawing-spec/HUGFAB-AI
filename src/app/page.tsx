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

/**
 * The hero, from the concept.
 *
 * Three things the guide fixes and this follows:
 *
 *   * **The headline is the concept's own**, "Your Style. Every Store. One
 *     Place." — not a paraphrase. It is the line the design was drawn around
 *     and the one already live.
 *   * **Search is the front door** (§1). The pill sits directly under the
 *     headline with nothing competing for the same attention, and category
 *     browsing goes underneath it rather than above.
 *   * **The script accent has a narrow remit** (§7): one editorial aside,
 *     decorative, never load-bearing. It is `aria-hidden` and the headline
 *     beneath carries the meaning, so a screen reader is not read a
 *     handwritten flourish.
 *
 * The supporting line says what the product does and claims no figures. There
 * are no retailer counts or product totals here, because there is no catalogue
 * yet and a number on a homepage is a promise (PRD §69).
 */
function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/*
        Two soft radial washes rather than a flat band — the concept's homepage
        reads as colour bleeding down behind the content, not a coloured box
        sitting on top of it. Decorative, so it is hidden from assistive tech.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(60rem 30rem at 15% -10%, var(--color-primary-soft), transparent 60%),' +
            'radial-gradient(50rem 28rem at 95% 0%, var(--color-secondary-soft), transparent 55%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-20 sm:pb-14">
        <p
          aria-hidden="true"
          className="text-primary text-3xl leading-none sm:text-4xl"
          style={{ fontFamily: 'var(--font-script)' }}
        >
          Fashion made simple with AI
        </p>

        <h1 className="text-display mt-3 max-w-[16ch] text-balance">
          Your Style. Every Store. <span className="text-primary">One Place.</span>
        </h1>

        <p className="text-body-lg text-muted mt-4 max-w-prose">
          Compare prices across every store, discover styles and shop smarter. One
          product, every retailer, the price they actually charge.
        </p>

        {/*
          The front door. Wider than the copy above it so it reads as the
          primary action rather than a field at the end of a paragraph.
        */}
        <div className="mt-8 max-w-2xl">
          <Suspense fallback={<div className="bg-surface-2 h-13 rounded-full" />}>
            <SearchBar size="lg" />
          </Suspense>
        </div>

        {/*
          What the product promises, not what the catalogue contains. Every
          line here is true before a single product is ingested — which is the
          test any homepage claim has to pass.
        */}
        <ul className="text-small text-muted mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          {[
            'Every price comes from the retailer',
            'Never marked up',
            'Best price stated, not implied',
          ].map((claim) => (
            <li key={claim} className="inline-flex items-center gap-2">
              <svg
                viewBox="0 0 16 16"
                className="text-accent size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m3 8.5 3.5 3.5L13 5" />
              </svg>
              {claim}
            </li>
          ))}
        </ul>
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
