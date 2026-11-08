'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

// Last-resort boundary (errors in the root layout itself). Must render its own
// <html>/<body>; kept dependency-free and styled inline so it works even when
// the app shell failed. Reports to the Error Monitor.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'boundary:global');
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Something went wrong</h1>
          <p style={{ color: '#4b5563' }}>NOSTOPS couldn&apos;t load just now. Our team has been notified.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, minHeight: 44, padding: '10px 18px', borderRadius: 12, border: 0, background: '#0f766e', color: '#fff', fontWeight: 700 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
