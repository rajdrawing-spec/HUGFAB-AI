'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Previous/next links rather than buttons, so pages are real URLs a user can
 * open in a new tab, share, or reach with the back button.
 */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const params = useSearchParams();

  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams(params.toString());
    next.set('page', String(target));
    return `/search?${next.toString()}`;
  };

  const linkClass =
    'text-button border-border-strong hover:bg-surface-2 inline-flex h-11 items-center rounded-full border px-5 font-semibold transition-colors';

  return (
    <nav
      aria-label="Search results pages"
      className="mt-12 flex items-center justify-between"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          Previous
        </Link>
      ) : (
        <span
          className={cn(linkClass, 'pointer-events-none opacity-40')}
          aria-hidden="true"
        >
          Previous
        </span>
      )}

      <span className="text-small text-muted">
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          Next
        </Link>
      ) : (
        <span
          className={cn(linkClass, 'pointer-events-none opacity-40')}
          aria-hidden="true"
        >
          Next
        </span>
      )}
    </nav>
  );
}
