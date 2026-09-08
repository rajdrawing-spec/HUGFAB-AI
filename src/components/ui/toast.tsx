'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'border-border-strong bg-surface text-text',
  success: 'border-success bg-success-soft text-success',
  warning: 'border-warning bg-warning-soft text-warning',
  error: 'border-error bg-error-soft text-error',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DEFAULT_DURATION_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        Errors interrupt (assertive); everything else waits for a pause (polite).
        The region is always mounted so screen readers observe it from the start.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => (
          <output
            key={item.id}
            aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-4 py-3 shadow-md',
              TONE_STYLES[item.tone],
            )}
          >
            <span className="text-small flex-1">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="-mr-1 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <svg
                viewBox="0 0 20 20"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
              </svg>
            </button>
          </output>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}
