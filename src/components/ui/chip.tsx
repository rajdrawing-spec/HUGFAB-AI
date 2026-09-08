'use client';

import { type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  /** Adds the guide's ✕ affordance; fires instead of onClick when pressed. */
  onRemove?: () => void;
}

/**
 * Filter chip. Selection is announced through `aria-pressed`, so a screen
 * reader hears the state rather than inferring it from the fill colour.
 */
export function Chip({
  label,
  selected = false,
  onRemove,
  className,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        'text-small inline-flex items-center gap-1 rounded-full border font-medium transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border-strong bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        className="rounded-full py-1.5 pr-1 pl-3.5"
        {...props}
      >
        {label}
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="mr-1.5 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}
