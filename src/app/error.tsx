'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

/**
 * Route-level error boundary. Next passes a `digest` for server errors; the
 * message itself is withheld in production, so the digest is what ties a user
 * report to a log line.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start px-4 py-24 sm:px-6">
      <h1 className="text-h1">Something went wrong</h1>
      <p className="text-body text-muted mt-3">
        The error has been logged. Please try again — if it keeps happening, this
        reference helps us find it.
      </p>
      {error.digest && (
        <p className="text-caption text-muted mt-3 font-mono">ref {error.digest}</p>
      )}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
