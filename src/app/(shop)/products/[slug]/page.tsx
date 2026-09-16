import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { absoluteUrl, canonicalPath } from '@/lib/site-url';
import { Badge } from '@/components/ui';
import { PriceDisplay, PriceComparison } from '@/components/product';
import { getProductBySlug } from '@/modules/products/service';
import { productSlugSchema } from '@/modules/products/schema';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function load(paramsPromise: PageProps['params']) {
  const parsed = productSlugSchema.safeParse(await paramsPromise);
  // A malformed slug cannot match anything, so it is a 404 rather than an
  // error: there is no version of this URL that would have worked.
  if (!parsed.success) return null;
  return getProductBySlug(parsed.data.slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await load(params).catch(() => null);
  if (!product) return { title: 'Product not found' };

  const title = product.brand ? `${product.brand.name} ${product.title}` : product.title;
  const path = canonicalPath(`/products/${product.slug}`);

  return {
    title,
    description: product.description ?? undefined,
    // Mock rows must never be indexed as real products.
    robots: product.isMock ? { index: false, follow: false } : undefined,
    // The apex URL for this product, whatever host the request arrived on.
    // Without it, the same product reachable on two hostnames reads to a
    // crawler as two competing pages.
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: absoluteUrl(path),
      title,
      description: product.description ?? undefined,
      images: product.imageUrls.slice(0, 1).map((url) => ({ url })),
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const product = await load(params);
  if (!product) notFound();

  const image = product.imageUrls[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        brand={product.brand?.name ?? null}
        category={product.category?.name ?? null}
        title={product.title}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="bg-surface-2 relative aspect-[3/4] overflow-hidden rounded-xl">
          {image ? (
            <Image
              src={image}
              alt={product.title}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="text-muted/40 flex h-full items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="size-16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}
          {product.isMock && (
            <span className="absolute top-3 left-3">
              <Badge tone="warning" variant="solid">
                MOCK DATA
              </Badge>
            </span>
          )}
        </div>

        <div>
          {product.brand && (
            <p className="text-caption text-muted font-semibold tracking-wide uppercase">
              {product.brand.name}
            </p>
          )}
          <h1 className="text-h1 mt-2">{product.title}</h1>

          {product.bestOffer ? (
            <>
              <PriceDisplay offer={product.bestOffer} size="lg" className="mt-5" />
              <p className="text-small text-muted mt-1">
                Best price at {product.bestOffer.retailer.name}
                {product.offers.length > 1 && (
                  <> · {product.offers.length} retailers compared</>
                )}
              </p>
            </>
          ) : (
            <p className="text-body text-muted mt-5">
              Not currently listed by any retailer.
            </p>
          )}

          {product.description && (
            <p className="text-body text-muted mt-5 max-w-prose">{product.description}</p>
          )}

          <dl className="text-small mt-6 grid grid-cols-2 gap-x-6 gap-y-3">
            {product.color && <Detail label="Colour" value={product.color} />}
            {product.material && <Detail label="Material" value={product.material} />}
            <Detail label="Department" value={genderLabel(product.gender)} />
            {product.variants.length > 0 && (
              <Detail label="Sizes" value={sizeSummary(product.variants)} />
            )}
          </dl>
        </div>
      </div>

      <section aria-labelledby="compare" className="mt-14">
        <h2 id="compare" className="text-h2">
          Compare prices
        </h2>
        <p className="text-body text-muted mt-2 max-w-xl">
          Every retailer listing this product, cheapest available first.
        </p>
        <div className="mt-6">
          <PriceComparison offers={product.offers} isMock={product.isMock} />
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-muted tracking-wide uppercase">{label}</dt>
      <dd className="text-text mt-0.5">{value}</dd>
    </div>
  );
}

function genderLabel(gender: string): string {
  const map: Record<string, string> = {
    women: 'Women',
    men: 'Men',
    kids: 'Kids',
    unisex: 'Unisex',
  };
  return map[gender] ?? 'Unisex';
}

/** "S, M, L (3 of 5 in stock)" — sizes plus how many can actually be bought. */
function sizeSummary(variants: { size: string | null; availability: string }[]): string {
  const sizes = variants.map((v) => v.size).filter((s): s is string => Boolean(s));
  if (sizes.length === 0) return '—';
  const inStock = variants.filter((v) => v.availability === 'in_stock').length;
  return `${[...new Set(sizes)].join(', ')} (${inStock} of ${variants.length} in stock)`;
}

function Breadcrumbs({
  brand,
  category,
  title,
}: {
  brand: string | null;
  category: string | null;
  title: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-caption text-muted flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-text transition-colors">
            Home
          </Link>
        </li>
        {brand && (
          <>
            <Separator />
            <li>{brand}</li>
          </>
        )}
        {category && (
          <>
            <Separator />
            <li>{category}</li>
          </>
        )}
        <Separator />
        <li className="text-text max-w-[16rem] truncate" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}

function Separator() {
  return <li aria-hidden="true">/</li>;
}
