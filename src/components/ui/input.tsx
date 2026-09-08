'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Helper text shown under the field when there is no error. */
  hint?: string;
  /** Marks the field invalid and replaces the hint. */
  error?: string;
  /** Renders the label for screen readers only. */
  hideLabel?: boolean;
  /** Decorative leading icon, as on the guide's search and email fields. */
  icon?: ReactNode;
  /** Fully rounded, as the guide's search field is. */
  pill?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    label,
    hint,
    error,
    hideLabel = false,
    icon,
    pill = false,
    id,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error ?? hint);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn('text-small text-text font-medium', hideLabel && 'sr-only')}
      >
        {label}
        {required && (
          <span className="text-error" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          >
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cn(
            'bg-surface text-body text-text h-11 w-full border',
            'placeholder:text-muted transition-colors duration-150',
            'disabled:cursor-not-allowed disabled:opacity-60',
            pill ? 'rounded-full' : 'rounded-md',
            icon ? 'pr-4 pl-11' : 'px-4',
            error ? 'border-error' : 'border-border-strong hover:border-muted',
            className,
          )}
          {...props}
        />
      </div>

      {hasMessage && (
        <p
          id={messageId}
          className={cn('text-caption', error ? 'text-error' : 'text-muted')}
          role={error ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
