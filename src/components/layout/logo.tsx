import { cn } from '@/lib/cn';

/**
 * The wordmark from the guide: "Hug" in text, "Fab" in brand pink. Rendered as
 * text rather than an image so it stays crisp, themeable and selectable.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('font-bold tracking-tight', className)}>
      Hug<span className="text-primary">Fab</span>
    </span>
  );
}
