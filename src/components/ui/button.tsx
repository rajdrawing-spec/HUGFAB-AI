import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Variants follow the guide's button row: Primary (filled pink), Secondary
 * (light fill), Outline, and Text.
 *
 * `dark` is the concept's other workhorse — "Search with Photo", "Shop Now",
 * "Shop This Look", "Use Photo". It carries a CTA over photography, where pink
 * on a busy image loses its contrast. `accent` and `danger` cover confirm and
 * destructive actions the guide does not illustrate.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'text' | 'dark' | 'accent' | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface-2 text-text hover:bg-border/70',
  outline: 'border border-border-strong bg-surface text-text hover:bg-surface-2',
  text: 'text-primary hover:bg-primary-soft',
  dark: 'bg-dark text-white hover:opacity-90 shadow-sm',
  accent: 'bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm',
  danger: 'bg-error text-white hover:opacity-90 shadow-sm',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-small gap-1.5',
  md: 'h-11 px-5 text-button gap-2',
  lg: 'h-13 px-7 text-button gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and prefixes the label with a spinner. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Fully rounded, as the guide's hero CTAs are. */
  pill?: boolean;
  /** Leading icon. Hidden from assistive tech — the label carries the meaning. */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    pill = false,
    icon,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-colors duration-150 ease-[var(--ease-out-soft)]',
        'disabled:pointer-events-none disabled:opacity-50',
        pill ? 'rounded-full' : 'rounded-md',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner />
      ) : (
        icon && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {icon}
          </span>
        )
      )}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
      />
    </svg>
  );
}
