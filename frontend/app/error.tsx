'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/report-client-error';

// Root error boundary for public pages (route groups without their own
// error.tsx). Never shows raw error details; reports to the Error Monitor.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'boundary:root');
  }, [error]);
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center" data-testid="root-error">
      <h1 className="text-2xl font-black tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-3 text-ink-soft">This page couldn&apos;t load just now. Our team has been notified.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="min-h-[44px] rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
          Go to the homepage
        </Link>
      </div>
    </div>
  );
}
