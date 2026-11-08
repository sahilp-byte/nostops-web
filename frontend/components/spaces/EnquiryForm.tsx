'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import { FACILITIES, FOCUS_AREAS, GROUP_TYPES, PARTICIPANT_PROFILES, WEEK_DAYS } from '@/lib/spaces';
import type { SpaceEnquiry } from '@/lib/server/spaces';

// Phase 4 — enquiry details (Programme details · Your requirements · Additional information). Saves the draft and
// opens Review & Send. Nothing here is a booking; no prices or fees are collected.
const input = 'mt-1 w-full min-h-[48px] rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none';
const label = 'block text-sm font-bold text-ink';
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
}

export default function EnquiryForm({ spaceId, spaceName, initial }: { spaceId: string; spaceName: string; initial: SpaceEnquiry | null }) {
  const router = useRouter();
  const [enq, setEnq] = useState<SpaceEnquiry | null>(initial);
  const [f, setF] = useState({
    programme_title: initial?.programme_title || '', duration: initial?.duration || '', participants: initial?.participants ? String(initial.participants) : '',
    group_type: initial?.group_type || '', participant_profile: initial?.participant_profile || '', start_date: initial?.start_date || '',
    end_date: initial?.end_date || '', days: initial?.days || [], time_from: initial?.time_from || '', time_to: initial?.time_to || '',
    facilities: initial?.facilities || [], focus_areas: initial?.focus_areas || [], access_needs: initial?.access_needs || '', additional_info: initial?.additional_info || '',
  });
  const [busy, setBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'days' | 'facilities' | 'focus_areas', v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);

  function check(): string | null {
    if (!f.programme_title.trim()) return 'Add the programme title.';
    if (!f.duration.trim()) return 'Add the programme duration (e.g. 3 months).';
    if (!(Number(f.participants) >= 1)) return 'Add the expected number of participants.';
    if (!f.group_type) return 'Choose the group type.';
    if (!f.participant_profile) return 'Choose the participant profile.';
    if (!f.start_date) return 'Add the preferred start date.';
    if (!f.days.length || !f.time_from || !f.time_to) return 'Choose the preferred days and timings.';
    return null;
  }

  async function save(): Promise<SpaceEnquiry | null> {
    const body = { ...f, participants: f.participants ? Number(f.participants) : undefined, end_date: f.end_date || '' };
    const r = enq ? await sendBff(`/bff/spaces/enquiries/${enq.id}`, 'PATCH', body) : await postBff('/bff/spaces/enquiries', { ...body, space_id: spaceId });
    if (!r.ok) { setError(r.data?.error || 'Could not save your enquiry.'); return null; }
    setEnq(r.data.enquiry);
    return r.data.enquiry;
  }

  async function review() {
    setError(null);
    const msg = check();
    if (msg) return setError(msg);
    setBusy(true);
    const saved = await save();
    setBusy(false);
    if (saved) router.push(`/app/spaces/enquiries/${saved.id}`);
  }

  async function attach(file?: File) {
    if (!file) return;
    setError(null);
    if (!DOC_TYPES.includes(file.type)) return setError('Upload a PDF, JPG, PNG or WebP file.');
    if (file.size > 4 * 1024 * 1024) return setError('Each document must be 4 MB or smaller.');
    setDocBusy(true);
    const cur = enq || (check() ? null : await save());
    if (!cur) { setDocBusy(false); return setError(error || 'Fill in the programme details first, then attach documents.'); }
    const r = await postBff(`/bff/spaces/enquiries/${cur.id}/documents`, { name: file.name, type: file.type, base64: await readFile(file) });
    setDocBusy(false);
    if (!r.ok) return setError(r.data?.error || 'Could not attach the document.');
    setEnq(r.data.enquiry);
  }

  async function detach(docId: string) {
    if (!enq) return;
    const r = await sendBff(`/bff/spaces/enquiries/${enq.id}/documents?doc=${encodeURIComponent(docId)}`, 'DELETE');
    if (r.ok) setEnq(r.data.enquiry);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5" data-testid="enquiry-form">
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-black text-ink">1. Programme details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={`${label} md:col-span-2`}>Programme title
            <input className={input} value={f.programme_title} maxLength={140} onChange={(e) => set('programme_title', e.target.value)} placeholder="e.g. Morning wellness programme" data-testid="enq-title" />
          </label>
          <label className={label}>Duration
            <input className={input} value={f.duration} maxLength={80} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 3 months" data-testid="enq-duration" />
          </label>
          <label className={label}>Expected participants
            <input className={input} inputMode="numeric" value={f.participants} onChange={(e) => set('participants', e.target.value.replace(/\D/g, '').slice(0, 4))} data-testid="enq-participants" />
          </label>
          <label className={label}>Group type
            <select className={input} value={f.group_type} onChange={(e) => set('group_type', e.target.value)} data-testid="enq-group-type">
              <option value="">Choose one</option>{Object.entries(GROUP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={label}>Participant profile
            <select className={input} value={f.participant_profile} onChange={(e) => set('participant_profile', e.target.value)} data-testid="enq-profile">
              <option value="">Choose one</option>{Object.entries(PARTICIPANT_PROFILES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={label}>Preferred start date
            <input type="date" min={today} className={input} value={f.start_date} onChange={(e) => set('start_date', e.target.value)} data-testid="enq-start" />
          </label>
          <label className={label}>Preferred end date <span className="font-normal text-muted">(optional)</span>
            <input type="date" min={f.start_date || today} className={input} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} data-testid="enq-end" />
          </label>
        </div>
        <p className={`${label} mt-4`}>Preferred days</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEK_DAYS.map(([k, v]) => (
            <button key={k} type="button" aria-pressed={f.days.includes(k)} onClick={() => toggle('days', k)} className={`min-h-[44px] min-w-[56px] rounded-full border px-3 text-sm font-bold ${f.days.includes(k) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`} data-testid={`enq-day-${k}`}>{v}</button>
          ))}
        </div>
        <div className="mt-4 grid max-w-md grid-cols-2 gap-4">
          <label className={label}>From<input type="time" className={input} value={f.time_from} onChange={(e) => set('time_from', e.target.value)} data-testid="enq-time-from" /></label>
          <label className={label}>To<input type="time" className={input} value={f.time_to} onChange={(e) => set('time_to', e.target.value)} data-testid="enq-time-to" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-black text-ink">2. Your requirements</h2>
        <p className={`${label} mt-3`}>Focus areas <span className="font-normal text-muted">(optional)</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(FOCUS_AREAS).map(([k, v]) => (
            <button key={k} type="button" aria-pressed={f.focus_areas.includes(k)} onClick={() => toggle('focus_areas', k)} className={`min-h-[44px] rounded-full border px-4 text-sm font-black ${f.focus_areas.includes(k) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`} data-testid={`enq-focus-${k}`}>{v}</button>
          ))}
        </div>
        <p className={`${label} mt-3`}>Facilities you need</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(FACILITIES).map(([k, v]) => (
            <button key={k} type="button" aria-pressed={f.facilities.includes(k)} onClick={() => toggle('facilities', k)} className={`min-h-[44px] rounded-full border px-4 text-sm font-bold ${f.facilities.includes(k) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`} data-testid={`enq-facility-${k}`}>{v}</button>
          ))}
        </div>
        <label className={`${label} mt-4`}>Special needs &amp; access <span className="font-normal text-muted">(optional)</span>
          <textarea className={`${input} min-h-[90px]`} value={f.access_needs} maxLength={1000} onChange={(e) => set('access_needs', e.target.value)} placeholder="e.g. back care / mobility support, wheelchair access" data-testid="enq-access" />
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-black text-ink">3. Additional information</h2>
        <label className={`${label} mt-3`}>Anything else the venue owner should know? <span className="font-normal text-muted">(optional)</span>
          <textarea className={`${input} min-h-[90px]`} value={f.additional_info} maxLength={2000} onChange={(e) => set('additional_info', e.target.value)} data-testid="enq-additional" />
        </label>
        <p className={`${label} mt-4`}>Supporting documents <span className="font-normal text-muted">(optional, up to 3 · PDF/JPG/PNG/WebP · 4 MB each · private)</span></p>
        <ul className="mt-2 space-y-2">
          {(enq?.documents || []).map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm" data-testid="enq-doc-item">
              <span className="font-bold text-ink">📄 {d.name}</span>
              <button type="button" onClick={() => detach(d.id)} className="min-h-[40px] px-2 text-sm font-bold text-red-700">Remove</button>
            </li>
          ))}
        </ul>
        {(enq?.documents?.length || 0) < 3 && (
          <label className="mt-2 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-brand px-4 text-sm font-black text-brand-700">
            {docBusy ? 'Uploading…' : '+ Attach a document'}
            <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={docBusy}
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; attach(file); }} data-testid="enq-doc-input" />
          </label>
        )}
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert" data-testid="enq-error">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/spaces/${spaceId}`} className="inline-flex min-h-[48px] items-center rounded-xl border border-line bg-white px-5 text-sm font-bold text-ink" data-testid="enq-cancel">← Back to {spaceName}</Link>
        <button type="button" onClick={review} disabled={busy} className="min-h-[48px] rounded-xl bg-accent px-6 text-sm font-black text-white disabled:opacity-60" data-testid="enq-review">
          {busy ? 'Saving…' : 'Save & review enquiry →'}
        </button>
      </div>
    </div>
  );
}
