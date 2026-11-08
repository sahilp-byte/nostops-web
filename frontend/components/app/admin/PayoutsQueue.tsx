'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { inr, fmtDate } from '@/lib/format';
import type { PayoutRow } from '@/lib/server/admin-payouts';
// Payout approval queue (PHASE 5). Approve / reject write through the
// admin-guarded BFF → POST /api/admin/payouts/{approve|reject}.

function Row({ p, onDone }: { p: PayoutRow; onDone: (id: string) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'approve' | 'reject'>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setError(null);
    setBusy('approve');
    const res = await postBff('/bff/admin/payouts/approve', { ledger_id: p.ledgerId, note: note.trim() });
    setBusy(null);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not approve.'); return; }
    onDone(p.ledgerId); router.refresh();
  }
  async function reject() {
    setError(null);
    if (note.trim().length < 3) { setError('A rejection reason is required.'); return; }
    setBusy('reject');
    const res = await postBff('/bff/admin/payouts/reject', { ledger_id: p.ledgerId, reason: note.trim() });
    setBusy(null);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not reject.'); return; }
    onDone(p.ledgerId); router.refresh();
  }

  return (
    <div data-testid={`payout-${p.ledgerId}`} className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{p.teacherName}</p>
          <p className="mt-0.5 text-xs text-muted">
            {[p.method, p.destination, p.status, p.createdAt ? fmtDate(p.createdAt) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-lg font-black tabular-nums text-ink">₹{inr(p.amount)}</span>
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}

      {mode === 'reject' && (
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rejection reason (required)" data-testid={`payout-reason-${p.ledgerId}`} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-brand" />
      )}
      {mode === 'approve' && (
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Approval note (optional)" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-brand" />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mode === null && (
          <>
            <button type="button" onClick={() => { setMode('approve'); setNote(''); }} disabled={busy !== null} data-testid={`payout-approve-${p.ledgerId}`} className="rounded-xl bg-brand px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">✓ Approve</button>
            <button type="button" onClick={() => { setMode('reject'); setNote(''); }} disabled={busy !== null} className="rounded-xl border border-red-200 px-4 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50">Reject</button>
          </>
        )}
        {mode === 'approve' && (
          <>
            <span className="text-xs font-semibold text-ink-soft">Release ₹{inr(p.amount)} to {p.teacherName}?</span>
            <button type="button" onClick={approve} disabled={busy !== null} data-testid={`payout-confirm-approve-${p.ledgerId}`} className="rounded-xl bg-brand px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy === 'approve' ? '…' : 'Confirm approve'}</button>
            <button type="button" onClick={() => { setMode(null); setError(null); }} className="rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">Cancel</button>
          </>
        )}
        {mode === 'reject' && (
          <>
            <button type="button" onClick={reject} disabled={busy !== null} data-testid={`payout-confirm-reject-${p.ledgerId}`} className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">{busy === 'reject' ? '…' : 'Confirm reject'}</button>
            <button type="button" onClick={() => { setMode(null); setError(null); }} className="rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PayoutsQueue() {
  const [rows, setRows] = useState<PayoutRow[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = (id: string) => setRows((prev) => (prev || []).filter((r) => r.ledgerId !== id));

  // Explicit, logged admin action: loading the queue runs the main backend's
  // cooling→eligible sweep, so it never happens on a page view.
  async function load() {
    setError(null);
    setBusy(true);
    const res = await postBff('/bff/admin/payouts/queue', { confirm_sweep: true });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not load the payout queue.'); return; }
    setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
  }

  if (rows === null) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5" data-testid="payouts-load">
        <p className="text-sm text-ink-soft">Loading the queue moves eligible payouts out of their cooling period on the main backend. It is recorded with your name.</p>
        <label className="mt-3 flex min-h-[44px] items-center gap-3 text-xs text-ink-soft">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="h-5 w-5" />
          I understand and want to load the payout queue.
        </label>
        {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}
        <button type="button" onClick={load} disabled={!confirm || busy} className="mt-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? '…' : 'Load payout queue'}</button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div data-testid="payouts-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-4xl">💸</p>
        <p className="mt-3 text-lg font-black text-ink">No payouts awaiting approval</p>
        <p className="mt-1 text-sm text-ink-soft">Payout requests appear here after their cooling period elapses.</p>
      </div>
    );
  }
  return <div className="rounded-2xl border border-line bg-white" data-testid="payouts-queue">{rows.map((p) => <Row key={p.ledgerId} p={p} onDone={remove} />)}</div>;
}
