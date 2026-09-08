import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * The concept's small status elements. Three shapes cover all of them:
 *
 *   solid  "Best Price", "50% OFF" on a deal card — a filled pill
 *   soft   "In Stock", "Great Deal" — a tinted pill
 *   text   "37% OFF" beside a price — colour and weight only, no chrome
 *
 * A discount next to a price is `text` + `success`; the same figure on a
 * promotional card is `solid` + `primary`. Same data, different emphasis.
 */
export type BadgeTone =
  'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export type BadgeVariant = 'solid' | 'soft' | 'text';

const SOLID: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-text',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-accent text-accent-foreground',
  warning: 'bg-warning text-white',
  error: 'bg-error text-white',
};

const SOFT: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  primary: 'bg-primary-soft text-primary',
  secondary: 'bg-secondary-soft text-secondary',
  success: 'bg-accent-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
};

const TEXT: Record<BadgeTone, string> = {
  neutral: 'text-muted',
  primary: 'text-primary',
  secondary: 'text-secondary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
}

export function Badge({
  className,
  tone = 'neutral',
  variant = 'soft',
  ...props
}: BadgeProps) {
  const styles =
    variant === 'solid' ? SOLID[tone] : variant === 'text' ? TEXT[tone] : SOFT[tone];

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1 font-semibold',
        variant !== 'text' && 'rounded-sm px-2 py-1',
        styles,
        className,
      )}
      {...props}
    />
  );
}
