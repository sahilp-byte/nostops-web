'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import PinLocalityPicker, { type PickedLocation } from '@/components/spaces/PinLocalityPicker';
import type { CPApplication } from '@/lib/server/community-partners';
import { SpIcon, SpStepChip, SpStepper } from '@/components/spaces/ui';

const STEPS = ['Locality', 'About You', 'Role', 'Team', 'Focus & Plan', 'Documents', 'Review'];
const DOCS: [string, string][] = [['identity_proof', 'Identity Proof (Aadhaar / PAN / Voter ID)'], ['address_proof', 'Address Proof (e.g. Aadhaar, utility bill, rent agreement)'], ['profile_photo', 'Profile Photo (clear, recent)']];
const FOCUS: [string, string][] = [['mind', 'MIND'], ['body', 'BODY'], ['special_needs', 'SPECIAL NEEDS']];
const TIMELINES: [string, string][] = [['1_month', 'Within 1 month'], ['3_months', 'Within 3 months'], ['6_months', 'Within 6 months'], ['12_months', 'Within 12 months']];
const inp = 'mt-1 block min-h-[48px] w-full rounded-xl border border-line bg-white px-3 text-sm font-normal';

// Phase 7 — Community Partner application (save & resume). Every step saves to the server; nothing financial is asked.
export default function CPWizard({ initial }: { initial: CPApplication }) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  const [step, setStep] = useState(() => { const i = STEPS.findIndex((_, n) => stepMissing(initial, n)); return i < 0 ? STEPS.length - 1 : i; });
  const [locs, setLocs] = useState<(PickedLocation | null)[]>(initial.localities.length ? initial.localities.map((l) => ({ ...l, country: 'IN' as const })) : [null]);
  const [ap, setAp] = useState(initial.applicant || {});
  const [team, setTeam] = useState(initial.team || []);
  const [focus, setFocus] = useState<string[]>(initial.focus_areas || []);
  const [plan, setPlan] = useState({ activation_plan: '', timeline: '', weekly_hours: 0, ...initial.plan });
  const [dec, setDec] = useState({ truthful: false, guidelines: false, ...initial.declarations });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(body: Record<string, unknown>, next = true) {
    setBusy(true); setErr(null);
    const r = await sendBff('/bff/spaces/partners/mine', 'PATCH', body);
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error || 'Could not save.'); return false; }
    setA(r.data.application);
    if (next) setStep((s) => Math.min(s + 1, STEPS.length - 1));
    return true;
  }
  async function upload(kind: string, f: File) {
    if (f.size > 4 * 1024 * 1024) return setErr('Each document must be 4 MB or smaller.');
    setBusy(true); setErr(null);
    const b64 = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(f); });
    const r = await postBff('/bff/spaces/partners/mine/documents', { kind, name: f.name, type: f.type, base64: b64 });
    setBusy(false);
    if (!r.ok) return setErr(r.data?.error || 'Upload failed.');
    setA(r.data.application);
  }
  async function submit() {
    setBusy(true); setErr(null);
    const r = await postBff('/bff/spaces/partners/mine/submit', {});
    setBusy(false);
    if (!r.ok) return setErr(r.data?.error || 'Could not submit.');
    router.push('/app/spaces/partner?submitted=1');
    router.refresh();
  }

  const card = 'sp-card p-6 lg:p-8';
  const label = 'block text-[16px] font-semibold text-ink';
  return (
    <div className="space-y-5" data-testid="cp-wizard">
      <SpStepper steps={STEPS} current={step} label="Application progress" testIdPrefix="cp-step" onSelect={setStep} isDone={(i) => (i === 3 ? i < step : !stepMissing(a, i))} />
      <SpStepChip n={step + 1} of={STEPS.length} />
      {a.status === 'info_requested' && a.info_request && (
        <p className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-ink" data-testid="cp-info-request"><b>NOSTOPS asked for more information:</b> {a.info_request.message}</p>
      )}

      {step === 0 && (
        <section className={card}>
          <h2 className="text-[28px] leading-tight">Find and select your <span className="text-accent">locality</span></h2>
          <p className="mt-1 text-sm text-ink-soft">Enter your Indian PIN code and choose up to two localities you want to activate.</p>
          <div className="mt-4 space-y-4">
            {locs.map((l, i) => (
              <div key={i} className="rounded-2xl border border-line p-4" data-testid={`cp-loc-${i}`}>
                <p className="mb-2 text-xs font-bold uppercase text-muted">Locality {i + 1}</p>
                <PinLocalityPicker value={l} onChange={(v) => setLocs((x) => x.map((y, j) => (j === i ? v : y)))} />
              </div>
            ))}
            {locs.length < 2 && <button type="button" onClick={() => setLocs((x) => [...x, null])} className="min-h-[44px] rounded-xl border border-brand-300 px-4 text-sm font-bold text-brand-700" data-testid="cp-loc-add">+ Add a second locality</button>}
          </div>
          <Nav busy={busy} onNext={() => save({ localities: locs.filter(Boolean).map((l) => ({ pin: l!.pin, locality_id: l!.locality_id })) })} disabled={!locs.some(Boolean)} />
        </section>
      )}

      {step === 1 && (
        <section className={card}>
          <h2 className="text-[28px] leading-tight">About you</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {([['full_name', 'Full name *'], ['phone', 'Mobile number *'], ['city', 'City / town *'], ['occupation', 'Current occupation'], ['languages', 'Languages you speak']] as const).map(([k, l]) => (
              <label key={k} className={label}>{l}<input value={(ap as any)[k] || ''} onChange={(e) => setAp({ ...ap, [k]: e.target.value })} className={inp} data-testid={`cp-ap-${k}`} /></label>
            ))}
          </div>
          <label className={`${label} mt-4`}>Your background *<textarea value={ap.background || ''} onChange={(e) => setAp({ ...ap, background: e.target.value })} rows={3} className={`${inp} py-2`} data-testid="cp-ap-background" /></label>
          <label className={`${label} mt-4`}>Community work you have done<textarea value={ap.community_experience || ''} onChange={(e) => setAp({ ...ap, community_experience: e.target.value })} rows={3} className={`${inp} py-2`} data-testid="cp-ap-community_experience" /></label>
          <Nav busy={busy} onBack={() => setStep(0)} onNext={() => save({ applicant: ap })} />
        </section>
      )}

      {step === 2 && (
        <section className={card} data-testid="cp-role">
          <h2 className="text-[28px] leading-tight">The Community Partner role</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-2xl bg-emerald-50/60 p-4"><p className="font-black text-ink">You will</p><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
              <li>Help neighbourhood communities discover NOSTOPS Spaces and programmes.</li><li>Refer yoga teachers, potential Spaces and Space owners in your localities.</li>
              <li>Share public NOSTOPS listings and support affordable, inclusive yoga access.</li><li>Track the referrals you make.</li></ul></div>
            <div className="rounded-2xl bg-amber-50/60 p-4"><p className="font-black text-ink">You will not</p><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
              <li>Edit teacher profiles or verification, or own, claim or approve Spaces.</li><li>Decide teacher enquiries or publish programmes.</li>
              <li>See private teacher, owner or participant data.</li><li>Receive money through NOSTOPS — there is no revenue share, fee or reward of any kind.</li></ul></div>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" checked={!!a.role_acknowledged} onChange={(e) => save({ role_acknowledged: e.target.checked }, false)} className="mt-1 h-5 w-5" data-testid="cp-role-ack" />
            <span>I understand the role and its responsibilities and boundaries.</span>
          </label>
          <Nav busy={busy} onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={!a.role_acknowledged} />
        </section>
      )}

      {step === 3 && (
        <section className={card}>
          <h2 className="text-[28px] leading-tight">Proposed team members <span className="text-base text-muted">(optional)</span></h2>
          <div className="mt-4 space-y-3">
            {team.map((m, i) => (
              <div key={i} className="grid gap-3 rounded-2xl border border-line p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                {(['name', 'role', 'relation'] as const).map((k) => <input key={k} placeholder={k === 'name' ? 'Name' : k === 'role' ? 'Role in the team' : 'How you know them'} value={(m as any)[k] || ''} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} className={inp} data-testid={`cp-team-${i}-${k}`} />)}
                <button type="button" onClick={() => setTeam(team.filter((_, j) => j !== i))} className="min-h-[44px] rounded-xl border border-line px-3 text-sm">Remove</button>
              </div>
            ))}
            {team.length < 5 && <button type="button" onClick={() => setTeam([...team, { name: '', role: '', relation: '' }])} className="min-h-[44px] rounded-xl border border-brand-300 px-4 text-sm font-bold text-brand-700" data-testid="cp-team-add">+ Add team member</button>}
          </div>
          <Nav busy={busy} onBack={() => setStep(2)} onNext={() => save({ team: team.filter((m) => m.name.trim()) })} />
        </section>
      )}

      {step === 4 && (
        <section className={card}>
          <h2 className="text-[28px] leading-tight">Focus areas & activation plan</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {FOCUS.map(([k, l]) => <button key={k} type="button" aria-pressed={focus.includes(k)} onClick={() => setFocus(focus.includes(k) ? focus.filter((x) => x !== k) : [...focus, k])}
              className={`min-h-[44px] rounded-full px-5 text-sm font-black ${focus.includes(k) ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`} data-testid={`cp-focus-${k}`}>{l}</button>)}
          </div>
          <label className={`${label} mt-4`}>Locality activation plan *<textarea value={plan.activation_plan} onChange={(e) => setPlan({ ...plan, activation_plan: e.target.value })} rows={4} placeholder="Which communities, places and teachers you will reach first, and how." className={`${inp} py-2`} data-testid="cp-plan" /></label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={label}>Indicative timeline *<select value={plan.timeline} onChange={(e) => setPlan({ ...plan, timeline: e.target.value })} className={inp} data-testid="cp-timeline"><option value="">Choose…</option>{TIMELINES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className={label}>Hours per week you can give<input inputMode="numeric" value={plan.weekly_hours || ''} onChange={(e) => setPlan({ ...plan, weekly_hours: Number(e.target.value.replace(/\D/g, '')) || 0 })} className={inp} data-testid="cp-hours" /></label>
          </div>
          <Nav busy={busy} onBack={() => setStep(3)} onNext={() => save({ focus_areas: focus, plan })} disabled={!focus.length} />
        </section>
      )}

      {step === 5 && (
        <section className={card}>
          <h2 className="text-[28px] leading-tight">Upload documents & declarations</h2>
          <p className="mt-1 text-sm text-ink-soft">PDF, JPG, PNG or WebP, up to 4 MB each. Documents are stored privately and seen only by the NOSTOPS review team.</p>
          <div className="mt-4 space-y-3">
            {DOCS.map(([k, l]) => {
              const d = a.documents.find((x) => x.kind === k);
              return (
                <div key={k} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4" data-testid={`cp-doc-${k}`}>
                  <span className="flex items-center gap-3 text-[16px] font-semibold text-ink"><span className="text-[#F28A1E]"><SpIcon name="doc" className="h-7 w-7" /></span>{l} *{d && <span className="ml-2 font-normal text-emerald-700">✓ {d.name}</span>}</span>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-[#F2B574] bg-[#FFF9F1] px-4 text-[15px] font-semibold text-[#0F4C4A]">
                    <SpIcon name="arrowRight" className="h-4 w-4 -rotate-90" strokeWidth={2.4} />{d ? 'Replace file' : 'Choose File or Drag & Drop'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(k, e.target.files[0])} data-testid={`cp-doc-input-${k}`} />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 text-sm text-ink">
            <label className="flex items-start gap-3"><input type="checkbox" checked={dec.truthful} onChange={(e) => setDec({ ...dec, truthful: e.target.checked })} className="mt-1 h-5 w-5" data-testid="cp-dec-truthful" /><span>I confirm the information in this application is true and correct to the best of my knowledge. *</span></label>
            <label className="flex items-start gap-3"><input type="checkbox" checked={dec.guidelines} onChange={(e) => setDec({ ...dec, guidelines: e.target.checked })} className="mt-1 h-5 w-5" data-testid="cp-dec-guidelines" /><span>I agree to the NOSTOPS Community Partner Network Guidelines, Code of Conduct and Use of Platform Policy. *</span></label>
          </div>
          <Nav busy={busy} onBack={() => setStep(4)} onNext={() => save({ declarations: dec })} />
        </section>
      )}

      {step === 6 && (
        <section className={card} data-testid="cp-review">
          <h2 className="text-[28px] leading-tight">Review & submit</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            {([['Localities', a.localities.map((l) => `${l.locality}, ${l.district} (${l.pin})`).join(' · ') || '—'], ['Name', a.applicant.full_name || '—'],
              ['City', a.applicant.city || '—'], ['Team', a.team.map((m) => m.name).join(', ') || 'None'], ['Focus', a.focus_areas.map((f) => f.replace('_', ' ').toUpperCase()).join(', ') || '—'],
              ['Timeline', TIMELINES.find(([k]) => k === a.plan.timeline)?.[1] || '—'], ['Documents', `${a.documents.length} of 3 uploaded`]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-ink-soft">{k}</dt><dd className="text-right font-bold text-ink">{v}</dd></div>))}
          </dl>
          {a.missing.length > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="cp-missing">Still missing: {a.missing.map((m) => m.replace('document:', '').replace(/_/g, ' ')).join(', ')}.</p>}
          <div className="mt-5 flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => setStep(5)} className="sp-btn-secondary" data-testid="cp-review-back">← Back</button>
            <button type="button" disabled={busy || a.missing.length > 0} onClick={submit} className="sp-btn-primary bg-accent" data-testid="cp-submit">Submit application →</button>
          </div>
        </section>
      )}
      {err && <p className="text-sm font-semibold text-red-700" role="alert" data-testid="cp-error">{err}</p>}
      <p className="text-xs text-muted">Your progress is saved at each step — you can come back and continue later.</p>
    </div>
  );
}

function stepMissing(a: CPApplication, i: number): boolean {
  const m = a.missing || [];
  return [m.includes('locality'), m.includes('applicant'), m.includes('role'), false, m.includes('focus_areas') || m.includes('plan'),
    m.some((x) => x.startsWith('document:')) || m.includes('declarations'), m.length > 0][i];
}

function Nav({ busy, onBack, onNext, disabled }: { busy: boolean; onBack?: () => void; onNext: () => void; disabled?: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap justify-between gap-3">
      {onBack && <button type="button" onClick={onBack} className="sp-btn-secondary" data-testid="cp-back">← Back</button>}
      <button type="button" disabled={busy || disabled} onClick={onNext} className="sp-btn-primary ml-auto bg-accent" data-testid="cp-next">{busy ? 'Saving…' : 'Save & Continue →'}</button>
    </div>
  );
}
