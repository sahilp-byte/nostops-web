'use client';

import { useEffect, useState } from 'react';
import { setCompare, type ComparePick } from '@/lib/programme-compare';

// Opening a comparison (incl. a shared link) makes it this device's pick list,
// so "Add a programme" continues from it on /programmes.
export function CompareSync({ picks }: { picks: ComparePick[] }) {
  const key = picks.map((p) => p.slug).join(',');
  useEffect(() => {
    setCompare(picks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function CopyCompareLink() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    const url = window.location.href;
    try {
      if (navigator.share && window.matchMedia('(max-width: 639px)').matches) {
        await navigator.share({ title: 'NOSTOPS programme comparison', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-base font-bold text-ink-soft transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      data-testid="compare-copy-link"
    >
      <span aria-live="polite">{state === 'copied' ? '✓ Link copied' : state === 'failed' ? 'Copy failed — use the address bar' : 'Share this comparison'}</span>
    </button>
  );
}
