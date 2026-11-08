'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Phase 6 — programme creator sets the PARTICIPANT fee (only that) and opens/closes registration; admins can open/close with a reason.
export default function SpaceRegistrationSettings({ id, viewer, mode, fee, closed, hasRegistrations }: {
  id: string; viewer: string; mode: string; fee: number; closed: boolean; hasRegistrations: boolean;
}) {
  const router = useRouter();
  const [m, setM] = useState(mode === 'PAID' ? 'PAID' : 'FREE');
  const [amount, setAmount] = useState(fee ? String(fee) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function act(action: string, body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await postBff(`/bff/spaces/programmes/${id}/${action}`, body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not save.' });
    setMsg({ ok: true, text: 'Saved.' });
    router.refresh();
  }
  const btn = 'min-h-[48px] rounded-xl px-5 text-sm font-black disabled:opacity-50';
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="sp-reg-settings">
      <h2 className="text-lg font-black text-ink">Participant registration</h2>
      {viewer === 'teacher' && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">Set the fee each participant pays. Only a participant fee can be set — no venue rent, revenue share or commission.</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pricing">
            {(['FREE', 'PAID'] as const).map((x) => (
              <button key={x} type="button" role="radio" aria-checked={m === x} disabled={hasRegistrations} onClick={() => setM(x)}
                className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${m === x ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`} data-testid={`sp-pricing-${x}`}>
                {x === 'FREE' ? 'Free' : 'Paid (per participant)'}
              </button>
            ))}
          </div>
          {m === 'PAID' && (
            <label className="block text-sm font-bold text-ink">Fee per participant (₹, whole rupees)
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" disabled={hasRegistrations}
                className="mt-1 block min-h-[48px] w-48 rounded-xl border border-line px-3 font-normal" data-testid="sp-pricing-fee" />
            </label>
          )}
          {hasRegistrations ? <p className="text-xs text-muted">The fee can&apos;t change once people have registered.</p> : (
            <button type="button" disabled={busy} onClick={() => act('pricing', { mode: m, fee_inr: m === 'PAID' ? Number(amount) : undefined })}
              className={`${btn} bg-accent text-white`} data-testid="sp-pricing-save">Save participant fee</button>
          )}
        </div>
      )}
      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <p className="text-sm font-bold text-ink" data-testid="sp-reg-state">Registration is {closed ? 'closed' : 'open when the programme is published and eligible'}.</p>
        {viewer === 'admin' && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, at least 10 characters)"
          className="block min-h-[48px] w-full rounded-xl border border-line px-3 text-sm" data-testid="sp-reg-reason" />}
        <button type="button" disabled={busy} onClick={() => act('registration', { open: closed, reason: reason || undefined })}
          className={`${btn} border border-brand-300 text-brand-700`} data-testid="sp-reg-toggle">{closed ? 'Reopen registration' : 'Close registration'}</button>
      </div>
      {msg && <p className={`mt-3 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="sp-reg-msg">{msg.text}</p>}
    </section>
  );
}
