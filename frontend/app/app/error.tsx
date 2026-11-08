'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/report-client-error';

// App-level error boundary. Never renders raw error details/stack to the user.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'boundary:app');
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-black tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-3 text-ink-soft">We couldn&apos;t load this part of your workspace. Please try again.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          Try again
        </button>
        <Link href="/app" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
