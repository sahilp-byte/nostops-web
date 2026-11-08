'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import PinLocalityPicker, { type PickedLocation } from '@/components/spaces/PinLocalityPicker';
import VenuePhotoUploader from '@/components/app/venue/VenuePhotoUploader';
import { SPACE_TYPES, SPACE_MODELS, FACILITIES, DOC_KINDS, OFFICIAL_MODELS_NOTE } from '@/lib/spaces';
import type { Space } from '@/lib/server/spaces';
import { SpIcon, SpStepChip, SpStepper, type SpIconName } from '@/components/spaces/ui';

// S3 — List a Space (Phase 3): Location → Details → Model → Facilities & photos → Documents → Review & submit.
// Every Continue saves the draft (first save creates it). Documents upload immediately and stay private.
const STEPS = ['Location', 'Details', 'Model', 'Facilities & photos', 'Documents', 'Review & submit'];
const input = 'mt-1.5 w-full min-h-[48px] rounded-xl border border-line bg-white px-4 py-3 text-[16px] text-ink focus:border-brand focus:outline-none';
const label = 'block text-[16px] font-semibold text-ink';
const MODEL_ICON: Record<string, SpIconName> = { commercial: 'building', subsidised: 'tag', community: 'users' };
const MODEL_CARD: Record<string, string> = { commercial: 'bg-[#FFF7EE]', subsidised: 'bg-[#FFF9EC]', community: 'bg-[#F4FAEE]' };
const MODEL_IMG: Record<string, string> = { commercial: '/brand/spaces/example-studio.jpg', subsidised: '/brand/spaces/example-school.jpg', community: '/brand/spaces/example-temple.jpg' };
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// Reopen a draft at the first step that still has something missing.
function firstOpenStep(s: Space | null): number {
  const m = s?.missing || [];
  if (!s) return 0;
  if (m.some((x) => /PIN|Street/.test(x))) return 0;
  if (m.some((x) => /name|Type|Capacity|Description|phone/.test(x))) return 1;
  if (m.some((x) => /model/.test(x))) return 2;
  if (m.some((x) => /photo/.test(x))) return 3;
  if (m.length) return 4;
  return 5;
}

type Form = {
  location: PickedLocation | null; address_line: string; landmark: string;
  name: string; space_type: string; capacity: string; area_sqft: string; description: string; availability: string;
  contact_name: string; contact_phone: string; contact_email: string;
  model: string; facilities: string[]; photos: string[];
};

function toForm(s: Space | null): Form {
  return {
    location: s?.location ? { ...s.location, country: 'IN' } : null, address_line: s?.address_line || '', landmark: s?.landmark || '',
    name: s?.name || '', space_type: s?.space_type || '', capacity: s?.capacity ? String(s.capacity) : '', area_sqft: s?.area_sqft ? String(s.area_sqft) : '',
    description: s?.description || '', availability: s?.availability || '', contact_name: s?.contact_name || '', contact_phone: s?.contact_phone || '',
    contact_email: s?.contact_email || '', model: s?.model || '', facilities: s?.facilities || [], photos: s?.photos || [],
  };
}

function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export default function SpaceWizard({ initial, ownerName }: { initial: Space | null; ownerName?: string }) {
  const [space, setSpace] = useState<Space | null>(initial);
  const [form, setForm] = useState<Form>(() => ({ ...toForm(initial), contact_name: initial?.contact_name || ownerName || '' }));
  const router = useRouter();
  const [step, setStep] = useState(() => firstOpenStep(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function stepPayload(i: number): Record<string, unknown> {
    if (i === 0) return { pin: form.location?.pin, locality_id: form.location?.locality_id, country: 'IN', address_line: form.address_line, landmark: form.landmark };
    if (i === 1) return {
      name: form.name, space_type: form.space_type || undefined, capacity: form.capacity ? Number(form.capacity) : undefined,
      area_sqft: form.area_sqft ? Number(form.area_sqft) : undefined, description: form.description, availability: form.availability,
      contact_name: form.contact_name, contact_phone: form.contact_phone, contact_email: form.contact_email,
    };
    if (i === 2) return { model: form.model || undefined };
    if (i === 3) return { facilities: form.facilities, photos: form.photos };
    return {};
  }

  function check(i: number): string | null {
    if (i === 0) {
      if (!form.location) return 'Enter the PIN code and choose the locality.';
      if (!form.address_line.trim()) return 'Add the street address.';
    }
    if (i === 1) {
      if (!form.name.trim()) return 'Add the name of the Space.';
      if (!form.space_type) return 'Choose the type of space.';
      if (!(Number(form.capacity) >= 1)) return 'Add how many people can practise here at once.';
      if (form.description.trim().length < 40) return 'Describe the Space in at least 40 characters.';
      if (!/^(\+91)?[6-9]\d{9}$/.test(form.contact_phone.replace(/[^\d+]/g, ''))) return 'Add a valid 10-digit Indian mobile number.';
    }
    if (i === 2 && !form.model) return 'Choose a model for this Space.';
    if (i === 3 && !form.photos.length) return 'Add at least one photo.';
    return null;
  }

  async function save(i: number): Promise<boolean> {
    const payload = Object.fromEntries(Object.entries(stepPayload(i)).filter(([, v]) => v !== undefined));
    if (!Object.keys(payload).length) return true;
    const r = space
      ? await sendBff(`/bff/spaces/mine/${space.id}`, 'PATCH', payload)
      : await postBff('/bff/spaces/mine', payload);
    if (!r.ok) { setError(r.data?.error || 'Could not save. Please try again.'); return false; }
    const next = { ...r.data.space, missing: r.data.missing } as Space;
    if (!space) window.history.replaceState(null, '', `/app/spaces/${next.id}`);
    setSpace(next);
    return true;
  }

  // Leaving a step (Continue, Back or a step pill) saves it whenever it is valid. Going back never blocks
  // (edits stay in the form); going forward needs a valid, saved step.
  async function goTo(target: number) {
    setError(null);
    if (target === step) return;
    const msg = step <= 3 ? check(step) : null;
    if (msg && target > step) return setError(msg);
    if (step <= 3 && !msg) {
      setBusy(true);
      const ok = await save(step);
      setBusy(false);
      if (!ok) return;
    }
    setStep(Math.max(0, Math.min(5, target)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const next = () => goTo(step + 1);

  async function uploadDoc(kind: string, file: File | undefined) {
    if (!file || !space) return;
    setError(null);
    if (!DOC_TYPES.includes(file.type)) return setError('Upload a PDF, JPG, PNG or WebP file.');
    if (file.size > 4 * 1024 * 1024) return setError('Each document must be 4 MB or smaller.');
    setDocBusy(kind);
    const base64 = await readFile(file).catch(() => '');
    const r = await postBff(`/bff/spaces/mine/${space.id}/documents`, { kind, name: file.name, type: file.type, base64 });
    setDocBusy(null);
    if (!r.ok) return setError(r.data?.error || 'Could not upload the document.');
    setSpace({ ...r.data.space, missing: r.data.missing });
  }

  async function submit() {
    if (!space) return;
    setError(null);
    setBusy(true);
    const r = await postBff(`/bff/spaces/mine/${space.id}/submit`, {});
    setBusy(false);
    if (!r.ok) {
      setError(r.data?.error || 'Could not submit.');
      if (r.data?.missing) setSpace((s) => (s ? { ...s, missing: r.data.missing } : s));
      return;
    }
    setSpace({ ...r.data.space, missing: [] });
    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return (
      <div className="sp-card flex items-start gap-5 p-6 lg:p-8" data-testid="space-submitted">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#22A447] text-white ring-8 ring-[#DFF1D3]"><SpIcon name="check" className="h-9 w-9" strokeWidth={3} /></span>
        <div>
        <h2 className="text-[28px]">{space?.name} has been sent for review</h2>
        <p className="mt-2 text-[16px] text-ink-soft">A NOSTOPS admin will check the details and documents (and may arrange a site visit). We&apos;ll email you when there&apos;s a decision. Your Space appears publicly only after approval.</p>
        <Link href="/app/spaces" className="sp-btn-primary mt-5 bg-brand" data-testid="back-to-my-spaces">Back to My Spaces<SpIcon name="arrowRight" className="h-5 w-5" strokeWidth={2.2} /></Link>
        </div>
      </div>
    );
  }

  const haveDocs = new Map((space?.documents || []).map((d) => [d.kind, d]));

  return (
    <div className="space-y-5" data-testid="space-wizard">
      <SpStepper steps={STEPS} current={step} label="Steps" testIdPrefix="space-step" onSelect={goTo} isDisabled={(i) => (!space && i > 0) || busy} />

      <div className="sp-card p-5 sm:p-7">
        <div className="mb-3"><SpStepChip n={step + 1} of={STEPS.length} /></div>
        {step === 0 && (
          <div className="space-y-4" data-testid="step-location">
            <h2 className="text-[28px] leading-tight">Where is the Space?</h2>
            <PinLocalityPicker value={form.location} onChange={(v) => set('location', v)} />
            <label className={label}>Street address
              <input className={input} value={form.address_line} maxLength={300} onChange={(e) => set('address_line', e.target.value)} placeholder="Building, street, area" data-testid="space-address" />
            </label>
            <label className={label}>Landmark <span className="font-normal text-muted">(optional)</span>
              <input className={input} value={form.landmark} maxLength={160} onChange={(e) => set('landmark', e.target.value)} placeholder="e.g. Opposite City Park gate 2" data-testid="space-landmark" />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4" data-testid="step-details">
            <h2 className="text-[28px] leading-tight">About the Space</h2>
            <label className={label}>Space name
              <input className={input} value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Green Park RWA Community Hall" data-testid="space-name" />
            </label>
            <label className={label}>Type of space
              <select className={input} value={form.space_type} onChange={(e) => set('space_type', e.target.value)} data-testid="space-type">
                <option value="">Choose one</option>
                {Object.entries(SPACE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Capacity (people)
                <input className={input} inputMode="numeric" value={form.capacity} onChange={(e) => set('capacity', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 25" data-testid="space-capacity" />
              </label>
              <label className={label}>Area (sq ft) <span className="font-normal text-muted">(optional)</span>
                <input className={input} inputMode="numeric" value={form.area_sqft} onChange={(e) => set('area_sqft', e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="e.g. 800" data-testid="space-area" />
              </label>
            </div>
            <label className={label}>Description
              <textarea className={`${input} min-h-[120px]`} value={form.description} maxLength={3000} onChange={(e) => set('description', e.target.value)} placeholder="What is the space like? Floor, light, ventilation, who uses it today…" data-testid="space-description" />
              <span className="mt-1 block text-xs font-normal text-muted">{form.description.trim().length}/40 characters minimum</span>
            </label>
            <label className={label}>When is it available? <span className="font-normal text-muted">(optional)</span>
              <input className={input} value={form.availability} maxLength={500} onChange={(e) => set('availability', e.target.value)} placeholder="e.g. Weekdays 6–9 am, weekends all day" data-testid="space-availability" />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={label}>Contact name
                <input className={input} value={form.contact_name} maxLength={120} onChange={(e) => set('contact_name', e.target.value)} data-testid="space-contact-name" />
              </label>
              <label className={label}>Contact mobile
                <input className={input} inputMode="tel" value={form.contact_phone} maxLength={14} onChange={(e) => set('contact_phone', e.target.value)} placeholder="10-digit mobile" data-testid="space-contact-phone" />
              </label>
              <label className={label}>Contact email <span className="font-normal text-muted">(optional)</span>
                <input className={input} type="email" value={form.contact_email} maxLength={160} onChange={(e) => set('contact_email', e.target.value)} data-testid="space-contact-email" />
              </label>
            </div>
            <p className="text-xs text-muted">Contact details are only seen by NOSTOPS. They are never shown on the public page.</p>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]" data-testid="step-model">
            <div className="space-y-3">
              <h2 className="text-[32px] leading-tight">Choose Your Participation Model</h2>
              <p className="text-[17px] text-[#0F4C4A]">Select how you would like to make your space available to the yoga community.</p>
              {Object.entries(SPACE_MODELS).map(([k, m]) => (
                <label key={k} className={`flex min-h-[56px] cursor-pointer items-center gap-5 rounded-2xl border-2 p-5 transition ${form.model === k ? 'border-[#F28A1E] bg-[#FFF3E5] shadow-md' : `border-transparent ${MODEL_CARD[k] || 'bg-white'} hover:border-[#F6CFA0]`}`} data-testid={`space-model-${k}`}>
                  <input type="radio" name="model" checked={form.model === k} onChange={() => set('model', k)} />
                  <span className={k === 'community' ? 'text-[#22A447]' : 'text-[#F28A1E]'}><SpIcon name={MODEL_ICON[k] || 'building'} className="h-14 w-14" strokeWidth={1.5} /></span>
                  <span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-[22px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{m.label} Space</span>
                      <span className={`rounded-full px-3 py-1 text-[14px] font-semibold ${m.tone}`}>{m.badge}</span>
                    </span>
                    <span className="mt-1 block text-[16px] text-[#1C2A47]">{m.blurb}</span>
                  </span>
                </label>
              ))}
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" data-testid="official-models-note">
                <strong>Important:</strong> {OFFICIAL_MODELS_NOTE}
              </p>
            </div>
            <aside className="space-y-4">
              <div className="sp-panel-peach p-4" data-testid="model-how-to-choose">
                <p className="flex items-center gap-2 text-[20px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}><span className="text-[#F28A1E]"><SpIcon name="info" className="h-7 w-7" /></span>How to Choose?</p>
                <ul className="mt-2 space-y-2 text-[14px] text-[#1C2A47]">
                  {Object.values(SPACE_MODELS).map((m) => <li key={m.label} className="flex gap-2"><span className="mt-0.5 shrink-0 text-[#22A447]"><SpIcon name="check" className="h-4 w-4" strokeWidth={2.6} /></span>{m.choose}</li>)}
                </ul>
              </div>
              <div className="sp-panel-peach p-4" data-testid="model-examples">
                <p className="flex items-center gap-2 text-[20px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}><span className="text-[#F28A1E]"><SpIcon name="star" className="h-7 w-7" /></span>Examples</p>
                <ul className="mt-2 space-y-3 text-[14px]">
                  {Object.entries(SPACE_MODELS).map(([k, m]) => (
                    <li key={m.label} className="flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={MODEL_IMG[k]} alt="" aria-hidden className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                      <span><span className="block font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{m.label} Space</span><span className="text-[#1C2A47]">{m.example}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5" data-testid="step-facilities">
            <div>
              <h2 className="text-[28px] leading-tight">Facilities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(FACILITIES).map(([k, v]) => {
                  const on = form.facilities.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => set('facilities', on ? form.facilities.filter((x) => x !== k) : [...form.facilities, k])}
                      className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[15px] font-medium ${on ? 'border-[#F28A1E] bg-[#FFF3E5] text-ink' : 'border-line bg-white text-ink'}`} aria-pressed={on} data-testid={`facility-${k}`}>
                      <span className={`grid h-5 w-5 place-items-center rounded ${on ? 'bg-[#F28A1E] text-white' : 'border-2 border-[#C9C2B6]'}`}>{on && <SpIcon name="check" className="h-4 w-4" strokeWidth={3} />}</span>{v}
                    </button>
                  );
                })}
              </div>
            </div>
            <VenuePhotoUploader initial={form.photos} onChange={(p) => set('photos', p)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3" data-testid="step-documents">
            <h2 className="text-[28px] leading-tight">Verification documents</h2>
            <p className="text-sm text-ink-soft">🔒 These stay private. Only NOSTOPS admins can open them, to verify the Space. PDF, JPG, PNG or WebP, up to 4 MB each.</p>
            {Object.entries(DOC_KINDS).map(([k, d]) => {
              const have = haveDocs.get(k);
              return (
                <div key={k} className="flex flex-col gap-2 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`doc-${k}`}>
                  <div>
                    <p className="text-sm font-black text-ink">{have ? '✅ ' : ''}{d.label}</p>
                    <p className="text-xs text-ink-soft">{have ? `Uploaded: ${have.name}` : d.hint}</p>
                  </div>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-brand px-4 text-sm font-black text-brand-700">
                    {docBusy === k ? 'Uploading…' : have ? 'Replace' : 'Upload'}
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={!!docBusy}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadDoc(k, f); }} data-testid={`doc-input-${k}`} />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {step === 5 && space && (
          <div className="space-y-4" data-testid="step-review">
            <h2 className="text-[28px] leading-tight">Review &amp; submit</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ['Name', space.name], ['Type', SPACE_TYPES[space.space_type || ''] || '—'], ['Model', SPACE_MODELS[space.model || '']?.label || '—'],
                ['Capacity', space.capacity ? `${space.capacity} people` : '—'],
                ['Locality', space.location ? `${space.location.locality}, ${space.location.district}, ${space.location.state} ${space.location.pin}` : '—'],
                ['Address', space.address_line || '—'], ['Photos', String(space.photos?.length || 0)], ['Documents', `${space.documents?.length || 0} of 4`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-muted">{k}</dt><dd className="font-bold text-ink">{v}</dd></div>
              ))}
            </dl>
            {space.missing?.length ? (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" data-testid="review-missing">
                <p className="font-black">Still needed before you can submit:</p>
                <ul className="mt-1 list-disc pl-5">{space.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            ) : (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" data-testid="review-ready">Everything is ready. NOSTOPS will review your Space before it goes live.</p>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert" data-testid="space-error">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0 || busy}
            className="sp-btn-secondary disabled:opacity-40" data-testid="space-back"><SpIcon name="arrowLeft" className="h-5 w-5" strokeWidth={2.2} />Back</button>
          {step < 4 && (
            <button type="button" onClick={next} disabled={busy} className="sp-btn-primary bg-brand" data-testid="space-continue">
              {busy ? 'Saving…' : `Save & Continue to ${STEPS[step + 1]}`}<SpIcon name="arrowRight" className="h-5 w-5" strokeWidth={2.2} />
            </button>
          )}
          {step === 4 && (
            <button type="button" onClick={() => goTo(5)} className="sp-btn-primary bg-brand" data-testid="space-continue">Continue to Review & Submit<SpIcon name="arrowRight" className="h-5 w-5" strokeWidth={2.2} /></button>
          )}
          {step === 5 && (
            <button type="button" onClick={submit} disabled={busy || !!space?.missing?.length} className="sp-btn-primary bg-accent" data-testid="space-submit">
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
