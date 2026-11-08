'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Phase 7 — refer a prospective teacher, Space or Space owner within an assigned locality (with their consent).
export default function CPReferralForm({ localities }: { localities: { locality_id: string; locality: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ kind: 'teacher', name: '', contact: '', locality_id: localities[0]?.locality_id || '', note: '', consent: false });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = 'mt-1 block min-h-[48px] w-full rounded-xl border border-line bg-white px-3 text-sm font-normal';
  async function go() {
    setBusy(true); setMsg(null);
    const r = await postBff('/bff/spaces/partners/referrals', f);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: r.data?.error || 'Could not save the referral.' });
    setMsg({ ok: true, t: 'Referral recorded. NOSTOPS will follow up.' });
    setF({ ...f, name: '', contact: '', note: '', consent: false });
    router.refresh();
  }
  return (
    <section id="refer" className="rounded-3xl border border-line bg-white p-5" data-testid="cp-refer">
      <h2 className="font-serif text-xl font-semibold text-brand-700">Make a referral</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold text-ink">Who are you referring?<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inp} data-testid="cp-ref-kind">
          <option value="teacher">Yoga teacher</option><option value="space">Potential Space</option><option value="space_owner">Space owner</option></select></label>
        <label className="text-sm font-bold text-ink">Locality<select value={f.locality_id} onChange={(e) => setF({ ...f, locality_id: e.target.value })} className={inp} data-testid="cp-ref-locality">
          {localities.map((l) => <option key={l.locality_id} value={l.locality_id}>{l.locality}</option>)}</select></label>
        <label className="text-sm font-bold text-ink">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} data-testid="cp-ref-name" /></label>
        <label className="text-sm font-bold text-ink">Contact they shared with you<input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} className={inp} data-testid="cp-ref-contact" /></label>
      </div>
      <label className="mt-3 block text-sm font-bold text-ink">Note<textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} className={`${inp} py-2`} data-testid="cp-ref-note" /></label>
      <label className="mt-3 flex items-start gap-3 text-sm text-ink"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-1 h-5 w-5" data-testid="cp-ref-consent" />They agreed to be contacted by NOSTOPS.</label>
      <button type="button" disabled={busy || f.name.trim().length < 2 || !f.consent} onClick={go} className="mt-4 min-h-[48px] rounded-xl bg-accent px-6 text-sm font-black text-white disabled:opacity-50" data-testid="cp-ref-submit">Record referral</button>
      {msg && <p className={`mt-2 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="cp-ref-msg">{msg.t}</p>}
    </section>
  );
}
