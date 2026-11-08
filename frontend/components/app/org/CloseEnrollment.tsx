'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Group-discount tiers mirror the public booking-invite stepper (18→10% ·
// 29→20% · 40→30%). Shown as guidance only — the backend computes the final
// locked rate on close.
const TIERS = [
  { min: 40, pct: 30 },
  { min: 29, pct: 20 },
  { min: 18, pct: 10 },
];

function tierInfo(headcount: number) {
  const current = TIERS.find((t) => headcount >= t.min)?.pct ?? 0;
  const next = [...TIERS].reverse().find((t) => t.min > headcount);
  return { current, next };
}

export default function CloseEnrollment({ bookingId, enrollmentOpen, registered, status }: { bookingId: string; enrollmentOpen: boolean; registered: number; status: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const terminal = status === 'cancelled' || status === 'completed';

  // Closed state — price locked, employees pay via their invite link.
  if (!enrollmentOpen) {
    return (
      <section className="rounded-2xl border p-5" style={{ borderColor: '#0D948840', backgroundColor: '#0D948808' }}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: '#0D9488' }}>🔒</span>
          <div>
            <p className="text-sm font-extrabold text-ink">Enrollment closed · group price locked</p>
            <p className="text-xs text-ink-soft">Headcount is locked at {registered}. Enrolled colleagues can now pay their final group rate via the batch invite link.</p>
          </div>
        </div>
      </section>
    );
  }

  if (terminal) return null;

  const { current, next } = tierInfo(registered);

  async function close() {
    setBusy(true);
    setErr(null);
    const r = await postBff(`/bff/org/bookings/${bookingId}/close`);
    setBusy(false);
    if (r.ok) { setConfirming(false); router.refresh(); }
    else setErr(r.data?.error || 'Could not close enrollment.');
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="close-enrollment">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-lg">💳</span>
        <div className="flex-1">
          <h2 className="text-sm font-extrabold text-ink">Lock the group price &amp; collect payments</h2>
          <p className="text-xs text-muted">Close enrollment to lock the headcount and final per-seat rate. Colleagues then pay the locked group price via a secure payment link.</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl bg-cream/70 px-3 py-2.5">
        <div className="flex-1">
          <p className="text-xs font-bold text-muted">Current headcount</p>
          <p className="text-lg font-black text-ink">{registered} enrolled</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-muted">Group discount</p>
          <p className="text-lg font-black" style={{ color: current > 0 ? '#0D9488' : '#94A3B8' }}>{current > 0 ? `${current}% off` : 'None yet'}</p>
        </div>
      </div>

      {next && (
        <p className="mt-2 rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: '#F59E0B12', color: '#B45309' }}>
          💡 {next.min - registered} more sign-up{next.min - registered === 1 ? '' : 's'} unlocks a {next.pct}% group rate. Keep the invite open to save your team more.
        </p>
      )}

      {err && <p className="mt-3 text-xs font-semibold text-red-600">{err}</p>}

      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="mt-3 w-full rounded-xl bg-brand px-3 py-3 text-sm font-bold text-white" data-testid="close-cta">
          🔒 Close enrollment &amp; lock group price
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-line bg-cream/50 p-3">
          <p className="text-sm font-bold text-ink">Close enrollment now?</p>
          <p className="mt-0.5 text-xs text-ink-soft">This locks the headcount at <b>{registered}</b> and the final group rate. No new colleagues can join after this.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft">Keep open</button>
            <button type="button" onClick={close} disabled={busy} className="flex-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50" data-testid="close-confirm">{busy ? 'Closing…' : 'Yes, lock it'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
