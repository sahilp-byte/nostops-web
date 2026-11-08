'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Actions on a partnership. Outgoing (owner-sent, pending) -> Cancel.
// Incoming (received, pending) -> Accept / Decline / Counter (owner share %).
export default function PartnershipActions({ pid, side, status }: { pid: string; side: 'outgoing' | 'incoming'; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const [share, setShare] = useState('70');

  const pending = status === 'pending' || status === 'countered';

  async function run(kind: 'cancel' | 'accept' | 'decline' | 'counter') {
    setErr(null); setBusy(kind);
    const r = kind === 'cancel'
      ? await sendBff(`/bff/venue/partnerships/${pid}`, 'DELETE')
      : await sendBff(`/bff/venue/partnerships/${pid}`, 'POST', kind === 'counter' ? { action: 'counter', owner_share_pct: parseInt(share, 10) } : { action: kind });
    if (!r.ok) { setBusy(null); setErr(r.data?.error || 'Action failed.'); return; }
    setBusy(null); setCountering(false);
    router.refresh();
  }

  if (!pending) return null;

  return (
    <div className="mt-3 border-t border-line pt-3">
      {side === 'outgoing' ? (
        <button type="button" onClick={() => run('cancel')} disabled={!!busy} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50" data-testid="pship-cancel">{busy === 'cancel' ? 'Cancelling…' : 'Cancel invite'}</button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => run('accept')} disabled={!!busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="pship-accept">{busy === 'accept' ? '…' : 'Accept'}</button>
            <button type="button" onClick={() => setCountering((v) => !v)} disabled={!!busy} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50" data-testid="pship-counter-toggle">Counter</button>
            <button type="button" onClick={() => run('decline')} disabled={!!busy} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50" data-testid="pship-decline">{busy === 'decline' ? '…' : 'Decline'}</button>
          </div>
          {countering && (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-cream/60 p-2.5">
              <label className="text-xs font-bold text-muted" htmlFor={`ctr-${pid}`}>Counter owner share</label>
              <input id={`ctr-${pid}`} type="number" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} className="w-16 rounded-md border border-line px-2 py-1 text-sm" />
              <span className="text-xs font-bold text-muted">%</span>
              <button type="button" onClick={() => run('counter')} disabled={!!busy} className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" data-testid="pship-counter-send">{busy === 'counter' ? '…' : 'Send counter'}</button>
            </div>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-xs font-bold text-red-600" role="alert">{err}</p>}
    </div>
  );
}
