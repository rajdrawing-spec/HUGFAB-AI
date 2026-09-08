'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SheetSide = 'left' | 'right' | 'bottom';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: SheetSide;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const SIDE_STYLES: Record<SheetSide, string> = {
  left: 'mr-auto ml-0 h-dvh max-h-none w-[min(22rem,90vw)] rounded-r-lg',
  right: 'ml-auto mr-0 h-dvh max-h-none w-[min(22rem,90vw)] rounded-l-lg',
  bottom:
    'mt-auto mb-0 mx-auto w-full max-w-none max-h-[85dvh] rounded-t-xl sm:w-[min(36rem,100vw)]',
};

/**
 * Edge-anchored panel — filter drawers on mobile, the account menu on desktop.
 * Same <dialog> foundation as Modal; only the geometry differs.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'right',
  children,
  footer,
  className,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'border-border bg-surface text-text max-w-none border p-0 shadow-lg',
        'backdrop:bg-overlay',
        SIDE_STYLES[side],
        className,
      )}
    >
      <div className="flex h-full flex-col">
        <header className="border-border flex items-center justify-between border-b p-4">
          <h2 id="sheet-title" className="text-h3">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:bg-surface-2 hover:text-text rounded-md p-1 transition-colors"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && <footer className="border-border border-t p-4">{footer}</footer>}
      </div>
    </dialog>
  );
}
