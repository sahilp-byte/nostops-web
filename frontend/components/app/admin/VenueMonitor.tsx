'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDate } from '@/lib/format';
import type { VenueMonitorRow } from '@/lib/server/admin-venue-monitor';

// Venue enrichment monitor actions (PHASE 15). Re-sync one venue or run the sync
// worker. Writes through the admin-guarded BFF.

function fmt(iso: string | null): string {
  return fmtDate(iso) || '—';
}

function Row({ r }: { r: VenueMonitorRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function resync() {
    setMsg(null);
    setBusy(true);
    const res = await postBff(`/bff/admin/venue-monitor/${encodeURIComponent(r.retreatId)}/resync`, {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setMsg(res.data?.error || 'Re-sync failed.'); return; }
    setMsg('Re-sync queued.');
    router.refresh();
  }

  return (
    <div data-testid={`venue-${r.retreatId}`} className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{r.displayName}</p>
          <p className="mt-0.5 text-xs text-muted">Last sync {fmt(r.lastSyncAt)} · Next {fmt(r.nextSyncAt)} · AI {r.aiGeneratedAt ? fmt(r.aiGeneratedAt) : 'pending'}</p>
          {msg && <p className="mt-1 text-[11px] font-semibold text-brand-700">{msg}</p>}
        </div>
        <button type="button" onClick={resync} disabled={busy} data-testid={`venue-resync-${r.retreatId}`} className="shrink-0 rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 disabled:opacity-50">{busy ? '…' : 'Re-sync'}</button>
      </div>
    </div>
  );
}

export default function VenueMonitor({ rows }: { rows: VenueMonitorRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function runWorker() {
    setMsg(null);
    setBusy(true);
    const res = await postBff('/bff/admin/venue-monitor/worker', {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setMsg(res.data?.error || 'Could not start the worker.'); return; }
    setMsg('Sync worker started.');
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={runWorker} disabled={busy} data-testid="venue-run-worker" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? 'Starting…' : '▶ Run sync worker'}</button>
        {msg && <span className="text-xs font-semibold text-brand-700">{msg}</span>}
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No connected venues.</p>
        ) : (
          rows.map((r) => <Row key={r.retreatId} r={r} />)
        )}
      </div>
    </div>
  );
}
