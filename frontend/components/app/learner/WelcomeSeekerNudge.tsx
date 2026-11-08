'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// First-time welcome nudge for brand-new Yoga Seekers. Shown once, right after
// sign-up (redirect adds ?welcome=1). Dismissing scrubs the param so it does
// not reappear on refresh or return visits.
export default function WelcomeSeekerNudge() {
  const params = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (params.get('welcome') === '1') setShow(true);
  }, [params]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    router.replace('/app'); // strip ?welcome=1 so it only shows once
  }

  return (
    <section
      data-testid="welcome-seeker-nudge"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-royal to-brand p-6 text-white shadow-sm sm:p-7"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
      </button>

      <span className="relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white/90">
        🌿 Welcome to NOSTOPS
      </span>
      <h2 className="relative mt-3 text-2xl font-black leading-tight tracking-tight">
        Your journey begins with one session.
      </h2>
      <p className="relative mt-2 max-w-xl text-sm leading-relaxed text-white/85">
        Find a lineage-verified teacher and book your first 1:1 session — small, steady practice makes the biggest lasting change.
      </p>
      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/app/discover"
          onClick={dismiss}
          data-testid="welcome-book-cta"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-black text-ink shadow transition hover:bg-cream"
        >
          Book your first 1:1 session
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" /></svg>
        </Link>
        <button type="button" onClick={dismiss} className="text-sm font-bold text-white/80 underline-offset-4 transition hover:text-white hover:underline">
          Maybe later
        </button>
      </div>
    </section>
  );
}
