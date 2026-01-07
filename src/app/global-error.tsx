'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              Something went wrong!
            </h1>
            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
              A critical error occurred. Please try refreshing the page.
            </p>
            {error.digest && (
              <p style={{ 
                fontSize: '0.75rem', 
                color: '#71717a',
                fontFamily: 'monospace',
                marginBottom: '1.5rem'
              }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                backgroundColor: '#22c55e',
                color: '#0a0a0a',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

