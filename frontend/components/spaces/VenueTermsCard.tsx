'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import { FACILITIES, SPACE_MODELS, enquiryParties } from '@/lib/spaces';
import type { SpaceEnquiry } from '@/lib/server/spaces';

// "Your Venue Terms (for this space)" — NON-FINANCIAL only: availability, facilities, access, conditions.
export default function VenueTermsCard({ e, editable, viewer, title = 'Your Venue Terms' }: { e: SpaceEnquiry; editable: boolean; viewer: string; title?: string }) {
  const router = useRouter();
  const vt = e.venue_terms;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    availability: vt?.availability ?? e.space?.availability ?? '', access: vt?.access ?? '', conditions: vt?.conditions ?? '',
    facilities: vt?.facilities ?? e.space?.facilities ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const model = SPACE_MODELS[e.space?.model || ''];

  async function save() {
    setBusy(true); setErr(null);
    const r = await sendBff(`/bff/spaces/enquiries/${e.id}/venue-terms`, 'PUT', f);
    setBusy(false);
    if (!r.ok) return setErr(r.data?.error || 'Could not save the venue terms.');
    setEdit(false);
    router.refresh();
  }

  const facs = (vt?.facilities ?? e.space?.facilities ?? []).map((k) => FACILITIES[k] || k).join(', ');
  const ta = 'mt-1 w-full min-h-[64px] rounded-xl border border-line p-3 text-sm';
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="venue-terms">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-black text-ink">🗂️ {title} <span className="text-sm font-semibold text-ink-soft">(for this enquiry)</span></h2>
        {editable && !edit && <button type="button" onClick={() => setEdit(true)} className="min-h-[44px] px-2 text-sm font-black text-brand-700" data-testid="venue-terms-edit">✏️ Edit</button>}
      </div>
      {!edit ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-sm font-black text-ink">Participation Model</p>{model && <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-black ${model.tone}`}>{model.label} Space</span>}</div>
          <div><p className="text-sm font-black text-ink">Availability</p><p className="text-sm text-ink-soft" data-testid="vt-availability">{vt?.availability || e.space?.availability || 'Not specified'}</p></div>
          <div><p className="text-sm font-black text-ink">Facilities</p><p className="text-sm text-ink-soft" data-testid="vt-facilities">{facs || 'Not specified'}</p></div>
          <div><p className="text-sm font-black text-ink">Access &amp; Conditions</p><p className="whitespace-pre-line text-sm text-ink-soft" data-testid="vt-access">{[vt?.access, vt?.conditions].filter(Boolean).join('\n') || 'Not specified'}</p></div>
        </div>
      ) : (
        <div className="mt-3 space-y-3" data-testid="venue-terms-form">
          <label className="block text-xs font-bold text-ink">Availability<textarea className={ta} maxLength={500} value={f.availability} onChange={(x) => setF({ ...f, availability: x.target.value })} data-testid="vt-in-availability" /></label>
          <div>
            <p className="text-xs font-bold text-ink">Facilities offered</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(FACILITIES).map(([k, v]) => {
                const on = f.facilities.includes(k);
                return <button key={k} type="button" aria-pressed={on} onClick={() => setF({ ...f, facilities: on ? f.facilities.filter((x) => x !== k) : [...f.facilities, k] })} className={`min-h-[40px] rounded-full border px-3 text-xs font-bold ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`}>{v}</button>;
              })}
            </div>
          </div>
          <label className="block text-xs font-bold text-ink">Access arrangements<textarea className={ta} maxLength={1000} value={f.access} onChange={(x) => setF({ ...f, access: x.target.value })} placeholder="e.g. Gate opens 6:30 am; ramp at side entrance" data-testid="vt-in-access" /></label>
          <label className="block text-xs font-bold text-ink">Conditions<textarea className={ta} maxLength={1500} value={f.conditions} onChange={(x) => setF({ ...f, conditions: x.target.value })} placeholder="e.g. No footwear in the hall; leave the space as found" data-testid="vt-in-conditions" /></label>
          {err && <p className="text-sm font-semibold text-red-700" data-testid="vt-error">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="min-h-[44px] rounded-xl bg-brand px-4 text-sm font-black text-white disabled:opacity-60" data-testid="vt-save">{busy ? 'Saving…' : 'Save terms'}</button>
            <button type="button" onClick={() => setEdit(false)} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-bold text-ink">Cancel</button>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Any financial arrangement is a private agreement {enquiryParties(viewer)}, outside NOSTOPS.</p>
    </section>
  );
}
