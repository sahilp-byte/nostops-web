'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { FACILITIES, GROUP_TYPES, PARTICIPANT_PROFILES, SPACE_MODELS, SPACE_TYPES, WEEK_DAYS, fmtTime } from '@/lib/spaces';
import type { SpaceEnquiry } from '@/lib/server/spaces';

// Phase 4 · Screen 1 — Space Enquiry: Review & Send (teacher side). Shows the teacher's real draft and sends it once.
const fmtDate = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const daysText = (days?: string[]) => WEEK_DAYS.filter(([k]) => days?.includes(k)).map(([, v]) => v).join(', ');
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function EnquirySpaceCard({ e }: { e: SpaceEnquiry }) {
  const s = e.space;
  const [i, setI] = useState(0);
  const photos = s?.photos || [];
  const model = SPACE_MODELS[s?.model || ''];
  return (
    <aside className="h-fit rounded-3xl border border-line bg-white p-4 shadow-sm" data-testid="enq-space-card">
      <div className="relative overflow-hidden rounded-2xl bg-cream">
        {photos.length ? (
          <img src={photos[i]} alt={s?.name || ''} className="aspect-[4/3] w-full object-cover" />
        ) : <div className="grid aspect-[4/3] place-items-center text-5xl">🏡</div>}
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-emerald-700">✓ Verified Space</span>
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => setI((i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 font-black">‹</button>
            <button type="button" aria-label="Next photo" onClick={() => setI((i + 1) % photos.length)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 font-black">›</button>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-bold text-white">{i + 1} / {photos.length}</span>
          </>
        )}
      </div>
      <h2 className="mt-4 text-2xl font-black text-ink" data-testid="enq-space-name">{s?.name || e.space_name}</h2>
      <p className="mt-1 text-sm text-ink-soft">📍 {[s?.location?.locality, s?.location?.district, s?.location?.state].filter(Boolean).join(', ')}</p>
      {model && <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-black ${model.tone}`} data-testid="enq-space-model">{model.label}</span>}
      <dl className="mt-4 space-y-2 text-sm">
        {s?.capacity ? <div className="flex gap-2"><dt className="font-black text-ink">👥 Capacity:</dt><dd className="text-ink-soft">{s.capacity} participants</dd></div> : null}
        {s?.space_type ? <div className="flex gap-2"><dt className="font-black text-ink">🏠 Space:</dt><dd className="text-ink-soft">{SPACE_TYPES[s.space_type]}</dd></div> : null}
        <div className="flex gap-2"><dt className="font-black text-ink">🅿️ Parking:</dt><dd className="text-ink-soft">{s?.facilities?.includes('parking') ? 'Available' : 'Not listed'}</dd></div>
        {s?.availability ? <div className="flex gap-2"><dt className="font-black text-ink">📅 Availability:</dt><dd className="text-ink-soft">{s.availability}</dd></div> : null}
      </dl>
      <Link href={`/spaces/${e.space_id}`} target="_blank" className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl border-2 border-brand text-sm font-black text-brand-700" data-testid="enq-view-listing">↗ View Full Listing</Link>
    </aside>
  );
}

function Row({ icon, k, v, testid }: { icon: string; k: string; v?: React.ReactNode; testid?: string }) {
  return (
    <div className="flex gap-3 border-b border-line/70 py-2.5 last:border-0">
      <span className="text-xl" aria-hidden>{icon}</span>
      <div><p className="text-sm font-black text-ink">{k}</p><p className="text-sm text-ink-soft" data-testid={testid}>{v || '—'}</p></div>
    </div>
  );
}

export default function EnquiryReview({ e }: { e: SpaceEnquiry }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const missing = e.missing || [];

  async function send() {
    if (inFlight.current) return; // guards double clicks; the backend is idempotent as well
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const r = await postBff(`/bff/spaces/enquiries/${e.id}/send`, {});
    inFlight.current = false;
    setBusy(false);
    if (!r.ok) return setError(r.data?.error || 'Could not send your enquiry. Please try again.');
    router.refresh();
  }

  const when = [fmtDate(e.start_date), fmtDate(e.end_date)].filter(Boolean).join(' – ');
  const timing = e.days?.length ? `${daysText(e.days)}: ${fmtTime(e.time_from)} – ${fmtTime(e.time_to)}` : '';
  const steps = ['Programme Details', 'Your Requirements', 'Additional Information'];

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr_330px]" data-testid="enquiry-review">
      <EnquirySpaceCard e={e} />

      <div className="space-y-4">
        <ol className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3" data-testid="enq-stepper">
          {steps.map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm font-black text-brand-700"><span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-white">✓</span>{s}<span className="text-muted">→</span></li>
          ))}
          <li className="flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-ink"><span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white">4</span>Review &amp; Send</li>
        </ol>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-xl font-black text-ink">📝 Review Your Enquiry</h2>
          <p className="text-sm text-ink-soft">Please check all details below. You can go back and edit if needed.</p>
          <div className="mt-4 grid gap-3 rounded-2xl bg-orange-50 p-4 sm:grid-cols-[2fr_1fr_1fr]">
            <div><p className="text-xs font-black text-ink">🧘 Programme Title</p><p className="font-bold text-ink" data-testid="enq-r-title">{e.programme_title}</p></div>
            <div><p className="text-xs font-black text-ink">🗓️ Duration</p><p className="font-bold text-ink" data-testid="enq-r-duration">{e.duration}</p></div>
            <div><p className="text-xs font-black text-ink">👥 Expected Participants</p><p className="font-bold text-ink" data-testid="enq-r-participants">{e.participants}</p></div>
          </div>
          <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
            <div>
              <Row icon="👤" k="I am enquiring as" v={`${e.teacher_name || ''} · NOSTOPS Teacher`} />
              <Row icon="👪" k="Group Type" v={GROUP_TYPES[e.group_type || '']} testid="enq-r-group" />
              <Row icon="⭐" k="Participant Profile" v={PARTICIPANT_PROFILES[e.participant_profile || '']} testid="enq-r-profile" />
            </div>
            <div>
              <Row icon="🗂️" k="Participation Model" v={SPACE_MODELS[e.space?.model || '']?.label ? `${SPACE_MODELS[e.space?.model || ''].label} Space` : ''} />
              <Row icon="📅" k="Preferred Dates" v={when} testid="enq-r-dates" />
              <Row icon="⏰" k="Preferred Timings" v={timing} testid="enq-r-timings" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
          <div data-testid="enq-r-facilities">
            <h3 className="font-black text-ink">🏠 Facility Requirements</h3>
            {e.facilities?.length ? (
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm text-ink">{e.facilities.map((f) => <li key={f}>✅ {FACILITIES[f] || f}</li>)}</ul>
            ) : <p className="mt-2 text-sm text-ink-soft">None specified</p>}
          </div>
          <div data-testid="enq-r-access">
            <h3 className="font-black text-ink">💛 Special Needs &amp; Access</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{e.access_needs || 'None specified'}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h3 className="font-black text-ink">📎 Additional Information</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-soft" data-testid="enq-r-additional">{e.additional_info || 'None'}</p>
          <h3 className="mt-4 font-black text-ink">📄 Supporting Documents ({e.documents?.length || 0})</h3>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="enq-r-docs">
            {(e.documents || []).map((d) => (
              <a key={d.id} href={`/bff/spaces/enquiries/doc/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-3 text-sm font-bold text-ink hover:border-brand">📕 {d.name} ({kb(d.size)})</a>
            ))}
            {!e.documents?.length && <p className="text-sm text-ink-soft">No documents attached</p>}
          </div>
        </section>

        {missing.length > 0 && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="enq-missing">Still needed: {missing.join(', ')}. Use Edit Enquiry to add them.</p>}
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert" data-testid="enq-send-error">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/spaces/${e.space_id}`} className="inline-flex min-h-[52px] items-center rounded-xl border-2 border-brand bg-white px-6 text-base font-black text-brand-700" data-testid="enq-back">← Back</Link>
          <Link href={`/app/spaces/enquiries/${e.id}/edit`} className="inline-flex min-h-[52px] items-center rounded-xl border-2 border-brand bg-white px-6 text-base font-black text-brand-700" data-testid="enq-edit">✏️ Edit Enquiry</Link>
          <button type="button" onClick={send} disabled={busy || missing.length > 0} className="min-h-[52px] flex-1 rounded-xl bg-accent px-6 text-base font-black text-white shadow disabled:opacity-50" data-testid="enq-send">
            {busy ? 'Sending…' : '➤ Send Enquiry to Venue Owner'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-line bg-white p-5" data-testid="enq-terms">
          <h3 className="text-lg font-black text-ink">🤝 Venue Terms &amp; Understanding</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li>✅ This is an enquiry, not a confirmed booking.</li>
            <li>✅ Final availability and terms are confirmed by the venue owner.</li>
            <li>✅ The programme will proceed only after mutual agreement on all details.</li>
            <li>✅ Any financial arrangement is a private agreement between you and the venue owner, outside NOSTOPS. NOSTOPS does not collect or process any payment for it.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5" data-testid="enq-after">
          <h3 className="text-lg font-black text-ink">ⓘ What Happens After You Send?</h3>
          <ol className="mt-3 space-y-2 text-sm text-ink">
            <li>① The venue owner will receive your enquiry and review the details.</li>
            <li>② They may contact you for a discussion, clarification or to propose terms.</li>
            <li>③ You will be informed of the next steps via email and your NOSTOPS dashboard.</li>
          </ol>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5" data-testid="enq-privacy">
          <h3 className="text-lg font-black text-ink">🛡️ Privacy &amp; Data Use</h3>
          <p className="mt-2 text-sm text-ink-soft">Your information and documents are shared only with the venue owner for the purpose of this enquiry.</p>
        </section>
      </div>
    </div>
  );
}
