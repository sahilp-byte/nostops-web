'use client';

import { useEffect, useState } from 'react';

// One-time celebration shown after a teacher becomes verified (all features
// unlocked). Dismissal is remembered per user in localStorage.
export default function UnlockCelebration({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const storageKey = `nostops_unlock_seen_${userId || 'me'}`;

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setShow(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    setShow(false);
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-50 to-cream p-6 text-center"
      data-testid="unlock-celebration"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        data-testid="unlock-dismiss"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-soft transition hover:bg-white/70"
      >
        ✕
      </button>
      <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-3xl">🎉</span>
      <h2 className="mt-3 text-xl font-black tracking-tight text-ink sm:text-2xl">You&apos;re verified — everything&apos;s unlocked!</h2>
      <p className="mx-auto mt-1.5 max-w-lg text-sm text-ink-soft">
        Congratulations 🙏 Your Offerings, Bookings, Wallet, Refer &amp; Earn and City Coordinator tools are now open.
        Set up your first offering to start receiving learners.
      </p>
      <a
        href="/app/teacher/offerings"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
      >
        Set up my offering →
      </a>
    </section>
  );
}
