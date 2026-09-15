'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * The concept's front door: a pill search field with a camera affordance
 * (docs/ui-ux-guide.md §4). Present on every surface.
 *
 * It is a real <form> so Enter submits and the browser's own search semantics
 * apply. Navigation goes through the URL rather than local state, which keeps
 * a result set shareable, bookmarkable and back-button-correct.
 */

export interface SearchBarProps {
  /** Pre-fills the field, e.g. on the results page. */
  defaultValue?: string;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({
  defaultValue = '',
  size = 'md',
  autoFocus = false,
  className,
}: SearchBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;

    // Preserve the filters already applied; a new term should narrow the same
    // view rather than silently resetting it.
    const next = new URLSearchParams(params.toString());
    next.set('q', q);
    next.delete('page');
    router.push(`/search?${next.toString()}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn('relative w-full', className)}>
      <label htmlFor="site-search" className="sr-only">
        Search for styles, brands or colours
      </label>

      <span
        aria-hidden="true"
        className="text-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </span>

      <input
        id="site-search"
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search for styles, brands, colors…"
        className={cn(
          'border-border-strong bg-surface text-body text-text w-full rounded-full border',
          'placeholder:text-muted pr-14 pl-11 transition-colors',
          size === 'lg' ? 'h-14' : 'h-12',
        )}
      />

      {/*
        Visual search arrives in Phase 2. It is rendered disabled rather than
        omitted so the control's position is established now and does not move
        when it starts working.
      */}
      <span
        aria-disabled="true"
        title="Search by photo arrives in Phase 2"
        className="text-muted/50 absolute top-1/2 right-4 -translate-y-1/2 cursor-not-allowed"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>
        <span className="sr-only">Search by photo (Phase 2)</span>
      </span>
    </form>
  );
}
