import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * The guide's small status elements: Tag, Selected, discount badge, rating,
 * and stock state. One component, because they differ only in tone.
 */
export type BadgeTone =
  'neutral' | 'primary' | 'secondary' | 'accent' | 'warning' | 'error';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary-soft text-secondary',
  accent: 'bg-accent-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1 rounded-sm px-2 py-1 font-semibold',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
