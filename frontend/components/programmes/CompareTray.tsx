'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearCompare, toggleCompare, useProgrammeCompare } from '@/lib/programme-compare';
import { MAX_COMPARE, compareHref } from '@/lib/programme-compare-url';
import { GURU_BUBBLE_EVENT } from '@/lib/ui-events';

// Floating tray listing the picked programmes. Phones/tablets: sits above the
// bottom-right Ask AI Guru launcher; desktop: bottom-left, clear of it. While
// the Guru greeting bubble (18rem wide, bottom-right) is open on tablets, the
// tray stops 20rem short of the right edge so the bubble never covers it.
export default function CompareTray() {
  const { picks } = useProgrammeCompare();
  const [bubble, setBubble] = useState(false);
  useEffect(() => {
    setBubble(!!document.querySelector('[data-testid="guru-bubble"]'));
    const on = (e: Event) => setBubble(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(GURU_BUBBLE_EVENT, on);
    return () => window.removeEventListener(GURU_BUBBLE_EVENT, on);
  }, []);
  if (picks.length === 0) return null;
  const ready = picks.length >= 2;
  return (
    <div
      role="region"
      aria-label="Programme comparison"
      className={`fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-line bg-white p-3 shadow-lg sm:inset-x-5 ${bubble ? 'sm:right-[20rem]' : ''} lg:bottom-6 lg:right-auto lg:w-[560px]`}
      data-testid="compare-tray"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-bold text-ink">
          {picks.length} of {MAX_COMPARE}{ready ? '' : ' · pick one more'}
        </span>
        {picks.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => toggleCompare(p)}
            className="inline-flex min-h-[44px] max-w-[11rem] items-center gap-1 rounded-full bg-cream px-3 text-xs font-semibold text-ink-soft ring-1 ring-line hover:ring-brand"
            aria-label={`Remove ${p.name} from comparison`}
            data-testid={`compare-tray-remove-${p.slug}`}
          >
            <span className="truncate">{p.name}</span>
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clearCompare}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 text-sm font-bold text-ink-soft transition hover:border-brand"
          data-testid="compare-tray-clear"
        >
          Clear
        </button>
        {ready ? (
          <Link
            href={compareHref(picks.map((p) => p.slug))}
            className="inline-flex min-h-[44px] min-w-[10rem] flex-1 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600"
            data-testid="compare-tray-go"
          >
            Compare {picks.length} programmes →
          </Link>
        ) : (
          <span
            className="inline-flex min-h-[44px] min-w-[10rem] flex-1 cursor-not-allowed items-center justify-center rounded-xl bg-cream px-5 text-sm font-bold text-ink-soft ring-1 ring-line"
            aria-disabled
            data-testid="compare-tray-go-disabled"
          >
            Compare →
          </span>
        )}
      </div>
    </div>
  );
}
