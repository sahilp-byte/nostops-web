'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/session-cookie';

type Alt = { handle: string; name: string; city: string; tier: string; styles: string[] };

function csrf(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + CSRF_COOKIE + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export default function BookingActions({
  bookingId,
  paymentId,
  awaitingTeacher,
  canComplete,
  canReassign,
}: {
  bookingId: string;
  paymentId: string | null;
  awaitingTeacher: boolean;
  canComplete: boolean;
  canReassign: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'decline' | 'reassign'>('idle');
  const [reason, setReason] = useState('');
  const [alts, setAlts] = useState<Alt[] | null>(null);
  const [altsLoading, setAltsLoading] = useState(false);

  async function act(action: string, body: Record<string, unknown>, tag: string) {
    setErr(null);
    setBusy(tag);
    const r = await sendBff(`/bff/teacher/booking/${bookingId}/${action}`, 'POST', body);
    setBusy(null);
    if (r.ok) { setMode('idle'); router.refresh(); return; }
    setErr(r.data?.error || 'Could not complete that action.');
  }

  async function openReassign() {
    setErr(null);
    setMode('reassign');
    if (alts) return;
    setAltsLoading(true);
    try {
      const res = await fetch(`/bff/teacher/booking/${bookingId}/alternatives`, {
        headers: { [CSRF_HEADER]: csrf() },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      setAlts(res.ok && Array.isArray(data.alternatives) ? data.alternatives : []);
      if (!res.ok) setErr(data?.error || 'Could not load alternatives.');
    } catch {
      setAlts([]);
      setErr('Network error loading alternatives.');
    } finally {
      setAltsLoading(false);
    }
  }

  if (!awaitingTeacher && !canComplete && !canReassign) return null;

  const btn = 'rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50';

  return (
    <div className="mt-3 border-t border-line pt-3">
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {awaitingTeacher && (
            <>
              <button type="button" onClick={() => act('teacher-action', { action: 'accept', confirmed_txn_id: paymentId || '' }, 'accept')} disabled={!!busy} className={`${btn} bg-brand text-white hover:bg-brand-600`} data-testid="booking-accept">
                {busy === 'accept' ? 'Accepting…' : '✓ Accept booking'}
              </button>
              <button type="button" onClick={() => { setMode('decline'); setErr(null); }} disabled={!!busy} className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`} data-testid="booking-decline">
                Decline
              </button>
            </>
          )}
          {canComplete && (
            <button type="button" onClick={() => act('complete', {}, 'complete')} disabled={!!busy} className={`${btn} bg-brand text-white hover:bg-brand-600`} data-testid="booking-complete">
              {busy === 'complete' ? 'Marking…' : 'Mark session complete'}
            </button>
          )}
          {canReassign && (
            <button type="button" onClick={openReassign} disabled={!!busy} className={`${btn} border border-line text-ink-soft hover:bg-cream`} data-testid="booking-reassign">
              Reassign teacher
            </button>
          )}
        </div>
      )}

      {mode === 'decline' && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-ink" htmlFor={`dr-${bookingId}`}>Reason for declining</label>
          <input id={`dr-${bookingId}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Slot no longer available" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" data-testid="decline-reason" />
          <div className="flex gap-2">
            <button type="button" onClick={() => act('teacher-action', { action: 'decline', confirmed_txn_id: paymentId || '', decline_reason: reason }, 'decline')} disabled={!!busy || reason.trim().length < 3} className={`${btn} bg-red-600 text-white hover:bg-red-700`} data-testid="decline-confirm">
              {busy === 'decline' ? 'Declining…' : 'Confirm decline'}
            </button>
            <button type="button" onClick={() => { setMode('idle'); setReason(''); }} className={`${btn} border border-line text-ink-soft`}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'reassign' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">Offer this booking to another teacher</p>
            <button type="button" onClick={() => setMode('idle')} className="text-xs font-bold text-muted hover:text-ink">Close</button>
          </div>
          {altsLoading && <p className="text-xs text-muted">Finding available teachers…</p>}
          {!altsLoading && alts && alts.length === 0 && <p className="text-xs text-muted">No alternative teachers available right now.</p>}
          <div className="space-y-2">
            {(alts || []).map((a) => (
              <div key={a.handle} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{a.name}</p>
                  <p className="truncate text-xs text-muted">{[a.city, a.styles.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" onClick={() => act('reassign', { new_teacher_handle: a.handle }, `re-${a.handle}`)} disabled={!!busy} className={`${btn} bg-brand text-white hover:bg-brand-600`} data-testid={`reassign-${a.handle}`}>
                  {busy === `re-${a.handle}` ? '…' : 'Reassign'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600">{err}</p>}
    </div>
  );
}
