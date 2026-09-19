import Link from 'next/link';
import type { Metadata } from 'next';
import { Mascot } from '@/components/brand';
import { listCategoryTree } from '@/modules/products/repository';

export const metadata: Metadata = {
  title: 'Categories',
  description:
    'Browse HugFab by category — topwear, bottomwear, footwear, dresses and accessories.',
  alternates: { canonical: '/categories' },
};

/**
 * Browse by category.
 *
 * The second way into the catalogue, for a shopper who does not arrive with a
 * search term in mind. Every link is a real search with the category filter
 * already applied, so browsing and searching converge on one results page
 * instead of two implementations of the same thing drifting apart.
 *
 * Driven entirely by the categories that exist. An empty database renders the
 * empty state rather than a page of headings with nothing under them.
 */
export default async function CategoriesPage() {
  const groups = await listCategoryTree();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-h1 text-balance">Shop by category</h1>
      <p className="text-body-lg text-muted mt-4 max-w-prose">
        Every category leads to the same search everyone else uses, with the filter
        already applied.
      </p>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Mascot mood="empty" size="lg" className="mb-4" />
          <h2 className="text-h3">No categories yet</h2>
          <p className="text-body text-muted mt-3 max-w-prose">
            Categories appear as the catalogue is connected.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ parent, children }) => (
            <section
              key={parent.id}
              className="border-border bg-surface flex flex-col rounded-xl border p-6"
            >
              <h2 className="text-h3">
                <Link
                  href={`/search?category=${encodeURIComponent(parent.slug)}`}
                  className="hover:text-primary transition-colors"
                >
                  {parent.name}
                </Link>
              </h2>

              {children.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/search?category=${encodeURIComponent(child.slug)}`}
                        className="text-small border-border hover:border-border-strong hover:bg-surface-2 inline-flex items-center rounded-full border px-3 py-1.5 transition-colors"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted mt-4">
                  Nothing narrower than this yet.
                </p>
              )}

              <Link
                href={`/search?category=${encodeURIComponent(parent.slug)}`}
                className="text-small text-primary mt-5 font-medium"
              >
                See everything in {parent.name} →
              </Link>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
