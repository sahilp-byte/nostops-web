'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

// Route-level error boundary for every /app/admin/* page (§14). Catches failures
// (e.g. the backend being unreachable) and offers a retry — the admin data itself
// is never fabricated on error. Reported to the Error Monitor.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'boundary:admin');
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center" data-testid="admin-error">
      <p className="text-4xl">⚠️</p>
      <h1 className="mt-3 text-2xl font-black text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-soft">
        We couldn&apos;t load this admin view. This is usually a temporary connection issue with the backend.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          Try again
        </button>
        <a href="/app/admin" className="rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
