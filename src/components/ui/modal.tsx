'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Hides the visible title but keeps it as the accessible name. */
  hideTitle?: boolean;
  className?: string;
}

/**
 * Built on the native <dialog> element, so focus trapping, the top layer,
 * inertness of the page behind, and Escape-to-close are the browser's job
 * rather than ours.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideTitle = false,
  className,
}: ModalProps) {
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
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      // Fires for Escape as well as close(), keeping React state in step.
      onClose={onClose}
      onClick={(event) => {
        // The backdrop is part of the dialog's own box, so a click landing on
        // the element itself (not its content) is a click outside.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'border-border bg-surface w-[min(32rem,calc(100vw-2rem))] rounded-lg border p-0',
        'text-text backdrop:bg-overlay shadow-lg',
        'open:animate-in',
        className,
      )}
    >
      <div className="flex flex-col gap-1 p-5 pb-3">
        <h2 id="modal-title" className={cn('text-h3', hideTitle && 'sr-only')}>
          {title}
        </h2>
        {description && (
          <p id="modal-description" className="text-small text-muted">
            {description}
          </p>
        )}
      </div>

      {children && <div className="px-5 pb-5">{children}</div>}

      {footer && (
        <div className="border-border flex items-center justify-end gap-2 border-t p-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
