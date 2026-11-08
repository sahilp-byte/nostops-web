'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Admin "Sync venues now" — pulls owner-created venues into the review queue.
export default function VenueBackfillButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await sendBff<{ count?: number; error?: string }>('/bff/admin/venue-submissions/backfill', 'POST', {});
    if (!res.ok) {
      setMsg(res.data?.error || 'Sync failed.');
    } else {
      const n = res.data?.count ?? 0;
      setMsg(`Synced ${n} venue${n === 1 ? '' : 's'} into the queue.`);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        data-testid="backfill-venues"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? 'Syncing…' : '⟳ Sync venues now'}
      </button>
      {msg && <p className="text-xs font-semibold text-ink-soft" aria-live="polite" data-testid="backfill-msg">{msg}</p>}
    </div>
  );
}
