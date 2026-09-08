'use client';

/**
 * Last-resort boundary: catches failures in the root layout itself, so it has
 * to render its own <html> and cannot rely on any of the app's providers or
 * stylesheet being available.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#faf9fb',
          color: '#16131b',
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>
            HugFab is temporarily unavailable
          </h1>
          <p style={{ color: '#6b6474', lineHeight: 1.6 }}>
            We hit an unexpected error. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#6d4ad1',
              color: '#fff',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
