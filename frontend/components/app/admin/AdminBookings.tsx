'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { titleCase } from '@/lib/format';
import type { AdminBookingRow } from '@/lib/server/admin-bookings';

// Admin bookings monitor (PHASE 6). Force-close a batch (stops further
// enrollment) — writes through the admin-guarded BFF.

const STATUS_CLS: Record<string, string> = {
  inviting: 'bg-blue-50 text-blue-700',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
  closed: 'bg-slate-100 text-slate-600',
};

function Row({ b, onClosed }: { b: AdminBookingRow; onClosed: (id: string) => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function forceClose() {
    setError(null);
    setBusy(true);
    const res = await postBff(`/bff/admin/bookings/${encodeURIComponent(b.bookingId)}/force-close`, {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not force-close.'); return; }
    setConfirming(false);
    onClosed(b.bookingId);
    router.refresh();
  }

  const canClose = !b.forceClosed && b.status !== 'completed' && b.status !== 'cancelled';

  return (
    <div data-testid={`booking-${b.bookingId}`} className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">{b.companyName}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
            {b.forceClosed && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Force-closed</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {[b.hrName, b.venueCity || b.venue, b.cohortType ? titleCase(b.cohortType) : null].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {b.enrolledCount}/{b.batchCapacity} enrolled · {b.paidCount} paid · {b.enrollmentOpen ? 'enrollment open' : 'enrollment closed'}
          </p>
        </div>
        <div className="shrink-0">
          {canClose && (confirming ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={forceClose} disabled={busy} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">{busy ? '…' : 'Confirm'}</button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-cream">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} data-testid={`booking-close-${b.bookingId}`} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50">Force-close</button>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export default function AdminBookings({ rows: initial, statuses }: { rows: AdminBookingRow[]; statuses: string[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const onClosed = (id: string) => setRows((prev) => prev.map((r) => (r.bookingId === id ? { ...r, forceClosed: true, enrollmentOpen: false } : r)));

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (needle && !`${r.companyName} ${r.hrName ?? ''} ${r.venueCity ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, HR or city" data-testid="booking-search" className="min-w-[180px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="booking-status-filter" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand">
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-white">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No bookings match.</p>
        ) : (
          visible.map((b) => <Row key={b.bookingId} b={b} onClosed={onClosed} />)
        )}
      </div>
    </div>
  );
}
