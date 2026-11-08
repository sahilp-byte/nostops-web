'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import PinLocalityPicker, { type PickedLocation } from '@/components/spaces/PinLocalityPicker';

// Phase 7 — admin assessment: decisions, locality assignment, partner state, document viewing, referral status.
export function CPAdminActions({ id, status, partner, assigned }: { id: string; status: string; partner: string | null; assigned: PickedLocation[] }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [locs, setLocs] = useState<(PickedLocation | null)[]>(assigned.length ? assigned : [null]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function act(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST') {
    if (reason.trim().length < 10) return setMsg({ ok: false, t: 'Please give a reason of at least 10 characters.' });
    setBusy(true); setMsg(null);
    const r = method === 'PUT' ? await sendBff(`/bff/spaces/partners/admin/${id}/${path}`, 'PUT', body) : await postBff(`/bff/spaces/partners/admin/${id}/${path}`, body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: r.data?.error || 'Could not save.' });
    setMsg({ ok: true, t: 'Saved.' }); setReason('');
    router.refresh();
  }
  const btn = 'min-h-[44px] rounded-xl px-4 text-sm font-black disabled:opacity-50';
  return (
    <section className="space-y-3 rounded-3xl border border-line bg-white p-5" data-testid="cp-admin-actions">
      <h2 className="font-serif text-xl font-semibold text-brand-700">Assessment</h2>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason / message (required, at least 10 characters)" className="block w-full rounded-xl border border-line p-3 text-sm" data-testid="cp-admin-reason" />
      {status === 'submitted' && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => act('decision/approve', { reason })} className={`${btn} bg-emerald-600 text-white`} data-testid="cp-admin-approve">Approve</button>
        <button type="button" disabled={busy} onClick={() => act('decision/request_info', { reason })} className={`${btn} border border-amber-400 text-amber-800`} data-testid="cp-admin-info">Request information</button>
        <button type="button" disabled={busy} onClick={() => act('decision/reject', { reason })} className={`${btn} border border-red-300 text-red-700`} data-testid="cp-admin-reject">Reject</button></div>}
      {status === 'approved' && <>
        <div className="space-y-2" data-testid="cp-admin-localities"><p className="text-sm font-bold text-ink">Assigned localities (max 2)</p>
          {locs.map((l, i) => <PinLocalityPicker key={i} value={l} onChange={(v) => setLocs((x) => x.map((y, j) => (j === i ? v : y)))} />)}
          {locs.length < 2 && <button type="button" onClick={() => setLocs([...locs, null])} className="mr-2 min-h-[44px] text-sm font-bold text-brand-700">+ Add locality</button>}
          <button type="button" disabled={busy} onClick={() => act('localities', { localities: locs.filter(Boolean).map((l) => ({ pin: l!.pin, locality_id: l!.locality_id })), reason }, 'PUT')} className={`${btn} border border-brand-300 text-brand-700`} data-testid="cp-admin-assign">Save localities</button></div>
        <div className="flex flex-wrap gap-2">
          {partner !== 'active' && <button type="button" disabled={busy} onClick={() => act('partner/activate', { reason })} className={`${btn} bg-accent text-white`} data-testid="cp-admin-activate">Activate partner</button>}
          {partner === 'active' && <button type="button" disabled={busy} onClick={() => act('partner/suspend', { reason })} className={`${btn} border border-amber-400 text-amber-800`} data-testid="cp-admin-suspend">Suspend</button>}
          {partner !== 'deactivated' && partner && <button type="button" disabled={busy} onClick={() => act('partner/deactivate', { reason })} className={`${btn} border border-red-300 text-red-700`} data-testid="cp-admin-deactivate">Deactivate</button>}
        </div></>}
      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="cp-admin-msg">{msg.t}</p>}
    </section>
  );
}

export function CPDocButton({ id, label }: { id: string; label: string }) {
  const [err, setErr] = useState(false);
  async function open() {
    const r = await fetch(`/bff/spaces/partners/admin/doc/${id}`, { credentials: 'same-origin' });
    if (!r.ok) return setErr(true);
    const d = await r.json();
    const bin = Uint8Array.from(atob(d.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin], { type: d.type }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000); // release the in-memory copy once the new tab has loaded it
  }
  return <button type="button" onClick={open} className="min-h-[44px] rounded-xl border border-line px-3 text-sm font-bold text-brand-700" data-testid={`cp-doc-open-${id}`}>{err ? 'Could not open' : `Open ${label}`}</button>;
}

export function CPRefStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [value, setValue] = useState(status);
  const [err, setErr] = useState('');
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select value={value} disabled={state === 'saving'} aria-label="Referral status" className="min-h-[44px] rounded-lg border border-line px-2 text-xs" data-testid={`cp-ref-status-${id}`}
        onChange={async (e) => {
          const next = e.target.value;
          setValue(next); setState('saving'); setErr('');
          const r = await postBff(`/bff/spaces/partners/admin/referrals/${id}/status`, { status: next });
          if (r.ok) { setState('idle'); router.refresh(); return; }
          // Not saved: put the dropdown back to the last saved status and say why.
          setValue(status); setState('error');
          setErr(r.data?.error || 'Could not update the status. Please try again.');
        }}>
        {['submitted', 'contacted', 'onboarding', 'onboarded', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {state === 'saving' && <span className="text-xs text-muted">Saving…</span>}
      {state === 'error' && <span className="whitespace-nowrap text-xs font-semibold text-red-700" role="alert" data-testid={`cp-ref-error-${id}`}>{err}</span>}
    </span>
  );
}
