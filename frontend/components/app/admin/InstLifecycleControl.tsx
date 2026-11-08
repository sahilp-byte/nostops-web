'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// §13 — Admin lifecycle override for a published/completed public event:
// Archive (de-index + remove from sitemap) or Evergreen (keep indexable).
export default function InstLifecycleControl({ eventId, current }: { eventId: string; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function set(lifecycle: 'ARCHIVED' | 'EVERGREEN') {
    setErr('');
    setBusy(lifecycle);
    const res = await sendBff(`/bff/institutional/admin/events/${encodeURIComponent(eventId)}/lifecycle`, 'PATCH', { lifecycle });
    setBusy('');
    if (!res.ok) { setErr(res.data?.error || 'Could not update.'); return; }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" data-testid={`lifecycle-${eventId}`}>
      {current !== 'EVERGREEN' && (
        <button type="button" disabled={!!busy} onClick={() => set('EVERGREEN')} data-testid={`evergreen-${eventId}`}
          className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50">
          {busy === 'EVERGREEN' ? '…' : 'Evergreen'}
        </button>
      )}
      {current !== 'ARCHIVED' && (
        <button type="button" disabled={!!busy} onClick={() => set('ARCHIVED')} data-testid={`archive-${eventId}`}
          className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
          {busy === 'ARCHIVED' ? '…' : 'Archive'}
        </button>
      )}
      {err && <span className="text-[10px] font-semibold text-red-600">{err}</span>}
    </div>
  );
}
