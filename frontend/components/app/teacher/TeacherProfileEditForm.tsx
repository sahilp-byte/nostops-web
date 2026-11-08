'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import { useI18n } from '@/components/i18n/I18nProvider';
import type { TeacherSelf, Codex } from '@/lib/server/teacher';
import { hasRealCity } from '@/lib/public-teacher';

type DraftShape = {
  name?: string; bio?: string; city?: string; country?: string; phone?: string; years?: string;
  parampara?: string; paramparas?: string[]; rootGuruName?: string; rootGuruLocation?: string; lineageDeclaration?: string;
  dims?: string[]; styles?: string[]; specs?: string[]; langs?: string[];
  rate?: string; premiumEnabled?: boolean; social?: Record<string, string>;
};

const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Assamese'];

const YOGA_DIMENSIONS: Array<{ id: string; name: string }> = [
  { id: 'body', name: 'Yoga for the Body' },
  { id: 'mind', name: 'Yoga for the Mind' },
  { id: 'special_needs', name: 'Yoga for Special Needs' },
];

type Social = Record<string, string>;

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-ink">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  'mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function TeacherProfileEditForm({
  self,
  social: initialSocial,
  codex,
  onSaved,
  canOperate = false,
}: {
  self: TeacherSelf;
  social: Social;
  codex: Codex;
  onSaved?: () => void;
  // Whether the teacher may ACTIVATE paid 1:1 bookings (InstaKYC + empanelment).
  // Profile/social/rate saving is ALWAYS free and never depends on this.
  canOperate?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState(self.name || '');
  const [bio, setBio] = useState(self.bio || '');
  const [city, setCity] = useState(self.city || '');
  const [country, setCountry] = useState(self.country || '');
  const [phone, setPhone] = useState(self.phone || '');
  const [years, setYears] = useState(String(self.experienceYears ?? ''));
  const [paramparas, setParamparas] = useState<string[]>(
    self.paramparas && self.paramparas.length ? self.paramparas : self.parampara ? [self.parampara] : [],
  );
  const [rootGuruName, setRootGuruName] = useState(self.rootGuruName || '');
  const [rootGuruLocation, setRootGuruLocation] = useState(self.rootGuruLocation || '');
  const [lineageDeclaration, setLineageDeclaration] = useState(self.lineageDeclaration || '');
  const [dims, setDims] = useState<string[]>(self.yogaDimensions || []);
  const [styles, setStyles] = useState<string[]>(self.styles || []);
  const [specs, setSpecs] = useState<string[]>(self.specializations || []);
  const [langs, setLangs] = useState<string[]>(self.languages || []);
  const [rate, setRate] = useState(String(self.premium.rateInr ?? ''));
  const [premiumEnabled, setPremiumEnabled] = useState(self.premium.enabled);
  const [social, setSocial] = useState<Social>({
    instagram: initialSocial.instagram || '',
    youtube: initialSocial.youtube || '',
    linkedin: initialSocial.linkedin || '',
    website: initialSocial.website || '',
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [premiumNote, setPremiumNote] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [bioUndo, setBioUndo] = useState<string | null>(null);

  async function improveBio() {
    if (bio.trim().length < 20) {
      setMsg({ kind: 'err', text: 'Write a few words about yourself first, then let AI polish it.' });
      return;
    }
    setImproving(true);
    setMsg(null);
    try {
      const hints = [
        paramparas[0] && `Lineage: ${paramparas[0]}`,
        styles.length ? `Styles: ${styles.join(', ')}` : '',
        specs.length ? `Specialisations: ${specs.join(', ')}` : '',
        city && `City: ${city}`,
        years && `Years teaching: ${years}`,
      ].filter(Boolean).join('. ');
      const res = await sendBff('/bff/teacher/improve-bio', 'POST', { bio: bio.trim(), hints });
      if (res.ok && res.data?.bio) {
        setBioUndo(bio);
        setBio(res.data.bio);
        setMsg({ kind: 'ok', text: 'AI polished your bio ✨ Review it and Save when happy.' });
      } else {
        setMsg({ kind: 'err', text: res.data?.error || 'AI could not improve your bio right now.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'AI could not improve your bio right now.' });
    } finally {
      setImproving(false);
    }
  }

  // Live profile-strength meter — updates as the teacher edits. Purely a nudge;
  // never gates saving. Photo comes from the (static) saved avatar.
  const strength = useMemo(() => {
    const has = (v: string) => v.trim().length > 0;
    const checks: Array<{ ok: boolean; tip: string }> = [
      { ok: !!self.avatarUrl, tip: 'Add a profile photo' },
      { ok: bio.trim().length >= 30, tip: 'Write a bio (30+ characters)' },
      { ok: hasRealCity(city, country), tip: 'Add your city' },
      { ok: has(phone), tip: 'Add a contact number' },
      { ok: (parseInt(years, 10) || 0) > 0, tip: 'Add years of experience' },
      { ok: styles.length > 0, tip: 'Pick your yoga styles' },
      { ok: specs.length > 0, tip: 'Add specialisations' },
      { ok: langs.length > 0, tip: 'Add languages you teach in' },
      { ok: paramparas.length > 0, tip: 'Share your parampara (lineage)' },
      { ok: Object.values(social).some((v) => (v || '').trim().length > 0), tip: 'Add a website or social link' },
    ];
    const done = checks.filter((c) => c.ok).length;
    const percent = Math.round((done / checks.length) * 100);
    const tips = checks.filter((c) => !c.ok).map((c) => c.tip).slice(0, 3);
    return { percent, tips };
  }, [self.avatarUrl, bio, city, country, phone, years, styles, specs, langs, paramparas, social]);

  // ── Auto-save drafts ────────────────────────────────────────────────────────
  // Persist edits locally so nothing is lost if the page closes mid-edit. Keyed
  // per teacher; only stored while the form differs from what's saved; cleared on
  // a successful save. Never affects server authorization.
  const draftKey = `nostops.teacher.profile-draft.${self.handle || 'me'}`;
  const serverSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: self.name || '', bio: self.bio || '', city: self.city || '', country: self.country || '', phone: self.phone || '',
        years: String(self.experienceYears ?? ''), paramparas: self.paramparas && self.paramparas.length ? self.paramparas : self.parampara ? [self.parampara] : [],
        rootGuruName: self.rootGuruName || '', rootGuruLocation: self.rootGuruLocation || '',
        lineageDeclaration: self.lineageDeclaration || '',
        dims: self.yogaDimensions || [], styles: self.styles || [], specs: self.specializations || [], langs: self.languages || [],
        rate: String(self.premium.rateInr ?? ''), premiumEnabled: self.premium.enabled,
        social: {
          instagram: initialSocial.instagram || '', youtube: initialSocial.youtube || '',
          linkedin: initialSocial.linkedin || '', website: initialSocial.website || '',
        },
      }),
    [self, initialSocial],
  );
  const currentSnapshot = JSON.stringify({
    name, bio, city, country, phone, years, paramparas, rootGuruName, rootGuruLocation, lineageDeclaration,
    dims, styles, specs, langs, rate, premiumEnabled, social,
  });

  const [draftRestored, setDraftRestored] = useState(false);

  function applySnapshot(d: DraftShape) {
    if (d.name != null) setName(d.name);
    if (d.bio != null) setBio(d.bio);
    if (d.city != null) setCity(d.city);
    if (d.country != null) setCountry(d.country);
    if (d.phone != null) setPhone(d.phone);
    if (d.years != null) setYears(d.years);
    if (Array.isArray(d.paramparas)) setParamparas(d.paramparas);
    if (d.rootGuruName != null) setRootGuruName(d.rootGuruName);
    if (d.rootGuruLocation != null) setRootGuruLocation(d.rootGuruLocation);
    if (d.lineageDeclaration != null) setLineageDeclaration(d.lineageDeclaration);
    if (Array.isArray(d.dims)) setDims(d.dims);
    if (Array.isArray(d.styles)) setStyles(d.styles);
    if (Array.isArray(d.specs)) setSpecs(d.specs);
    if (Array.isArray(d.langs)) setLangs(d.langs);
    if (d.rate != null) setRate(d.rate);
    if (typeof d.premiumEnabled === 'boolean') setPremiumEnabled(d.premiumEnabled);
    if (d.social) setSocial(d.social);
  }

  function clearDraft() {
    try { if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey); } catch { /* non-fatal */ }
    setDraftRestored(false);
  }
  function discardDraft() {
    applySnapshot(JSON.parse(serverSnapshot));
    clearDraft();
  }

  // Restore any unsaved draft. No ref guard, so it survives React StrictMode's
  // dev double-mount (which resets state). Cleans up a draft that already matches
  // the saved profile so no stale banner appears.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      if (raw === serverSnapshot) { window.localStorage.removeItem(draftKey); return; }
      applySnapshot(JSON.parse(raw) as DraftShape);
      setDraftRestored(true);
    } catch { /* ignore corrupt draft */ }
  }, [draftKey, serverSnapshot]);
  // Auto-save on every change while the form differs from the saved profile.
  // Removal here only covers a draft THIS visit wrote and the teacher then typed
  // back to the saved values — a draft from an earlier visit is never touched
  // before the restore effect above has applied it.
  const wroteDraft = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentSnapshot !== serverSnapshot) {
        window.localStorage.setItem(draftKey, currentSnapshot);
        wroteDraft.current = true;
      } else if (wroteDraft.current) {
        window.localStorage.removeItem(draftKey);
        wroteDraft.current = false;
        setDraftRestored(false);
      }
    } catch { /* storage blocked/full — non-fatal */ }
  }, [currentSnapshot, serverSnapshot, draftKey]);

  // Warn before leaving (refresh / close / external nav) while changes are unsaved.
  const dirty = currentSnapshot !== serverSnapshot && !saving;
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void, cap = 99) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= cap ? arr : [...arr, v]);

  async function save() {
    setMsg(null);
    setPremiumNote(null);
    if (name.trim().length < 1) return setMsg({ kind: 'err', text: t('Please enter your name.') });
    if (bio.trim().length > 0 && bio.trim().length < 30) return setMsg({ kind: 'err', text: 'Bio should be at least 30 characters (or left blank).' });
    const yearsNum = years.trim() === '' ? undefined : parseInt(years, 10);
    if (yearsNum != null && (Number.isNaN(yearsNum) || yearsNum < 0 || yearsNum > 80))
      return setMsg({ kind: 'err', text: 'Experience years must be between 0 and 80.' });
    const rateNum = rate.trim() === '' ? undefined : parseInt(rate, 10);
    if (premiumEnabled && (!rateNum || rateNum <= 0)) return setMsg({ kind: 'err', text: 'Enter a positive 1:1 session rate to enable bookings.' });

    setSaving(true);
    try {
      const profile: Record<string, unknown> = {
        name: name.trim(),
        bio: bio.trim(),
        city: city.trim(),
        country: country.trim(),
        phone: phone.trim(),
        styles,
        specializations: specs,
        languages_spoken: langs,
        yoga_dimensions: dims,
        root_guru_name: rootGuruName.trim(),
        root_guru_location: rootGuruLocation.trim(),
        lineage_declaration: lineageDeclaration.trim(),
      };
      if (yearsNum != null) profile.experience_years = yearsNum;
      profile.paramparas = paramparas;
      profile.parampara = paramparas[0] || '';

      // ── Profile + social links are ALWAYS FREE ──────────────────────────────
      // Never gated by InstaKYC / ₹279 payment / empanelment / verification.
      const r1 = await sendBff('/bff/teacher/profile', 'PATCH', profile);
      if (!r1.ok) throw new Error(r1.data?.error || 'Could not save your profile.');
      const r2 = await sendBff('/bff/teacher/social', 'PUT', social);
      if (!r2.ok) throw new Error(r2.data?.error || 'Could not save your social links.');

      // Profile is saved — report success immediately, independent of 1:1 activation.
      setMsg({ kind: 'ok', text: t('Saved successfully.') });
      clearDraft();

      // ── 1:1 pricing is a SEPARATE earning feature ───────────────────────────
      // Storing the rate is free. ACTIVATING paid bookings needs the operate gate
      // (InstaKYC + empanelment). A gate failure here must NEVER block or undo the
      // profile save above — it only shows a scoped note under the 1:1 section.
      if (rateNum != null) {
        const wantEnabled = premiumEnabled && canOperate;
        const r3 = await sendBff('/bff/teacher/premium', 'PUT', {
          enabled: wantEnabled,
          rate_inr: rateNum,
          duration_minutes: self.premium.durationMin || 60,
        });
        if (!r3.ok) {
          setPremiumNote(r3.data?.error || 'Your profile is saved. We couldn’t update your 1:1 rate just now — please try again.');
        } else if (premiumEnabled && !canOperate) {
          setPremiumNote('Your 1:1 rate is saved. Paid 1:1 bookings switch on once you complete InstaKYC and empanelment.');
        }
      }

      router.refresh();
      onSaved?.();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3" data-testid="draft-restored">
          <p className="text-sm font-semibold text-amber-800">{t('We restored your unsaved changes from last time. Save to keep them.')}</p>
          <button type="button" onClick={discardDraft} className="shrink-0 text-sm font-bold text-amber-800 underline hover:no-underline">{t('Discard')}</button>
        </div>
      )}
      {/* Live profile-strength meter */}
      <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5 sm:p-6" data-testid="profile-strength">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{t('Profile strength')}</p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight text-ink">{strength.percent}% {t('complete')}</h2>
          </div>
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-base font-black text-brand-700 shadow-sm">{strength.percent}%</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${strength.percent}%` }} />
        </div>
        {strength.tips.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2 p-0">
            {strength.tips.map((tip) => (
              <li key={tip} className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-3 py-1.5 text-xs font-bold text-ink-soft">
                <span aria-hidden className="text-brand">+</span> {t(tip)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-semibold text-brand-700">🎉 {t('Your profile looks great — seekers will love it.')}</p>
        )}
      </section>

      {/* Basic info */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Basic information')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('Full name')}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div id="city" className="scroll-mt-24">
            <Field label={t('City')}>
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Pune" data-testid="profile-city-input" />
              {!hasRealCity(city, country) && (
                <p className="mt-1.5 text-xs font-semibold text-amber-700" data-testid="profile-city-hint">
                  {t('Add your town or city so learners searching nearby can find you. “India” alone doesn’t show up in city search.')}
                </p>
              )}
            </Field>
          </div>
          <Field label={t('Country')}><input className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="India" /></Field>
          <Field label={t('Phone')}><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
          <Field label={t('Years of experience')}><input className={inputCls} value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" /></Field>
        </div>
      </section>

      {/* Bio */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold tracking-tight text-ink">{t('About you')}</h2>
          <div className="flex items-center gap-2">
            {bioUndo != null && !improving && (
              <button type="button" onClick={() => { setBio(bioUndo); setBioUndo(null); }} className="text-xs font-bold text-ink-soft underline hover:no-underline">
                {t('Undo')}
              </button>
            )}
            <button
              type="button"
              onClick={improveBio}
              disabled={improving}
              data-testid="improve-bio-btn"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:border-brand hover:bg-brand-100 disabled:opacity-60"
            >
              {improving ? t('Polishing…') : `✨ ${t('Improve with AI')}`}
            </button>
          </div>
        </div>
        <Field label={t('Bio')} hint={t('30–2000 characters. Describe your training, style and who you help.')}>
          <textarea className={`${inputCls} min-h-[130px] resize-y`} value={bio} onChange={(e) => { setBio(e.target.value); setBioUndo(null); }} maxLength={2000} />
          <p className="mt-1 text-right text-xs text-muted">{bio.length}/2000</p>
        </Field>
      </section>

      {/* Lineage */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Parampara & lineage')}</h2>
        <p className="mt-1 text-xs text-muted">{t('Pick all lineages you belong to — the first (★) is your primary. These power your links on the public tradition pages.')}</p>
        {paramparas.length >= 8 && (
          <p className="mt-1 text-xs font-semibold text-amber-700">{t('You can select up to 8 lineages. Remove one to add another.')}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {codex.paramparas.map((p) => (
            <Chip
              key={p.id}
              label={`${p.name}${paramparas[0] === p.id ? ' ★' : ''}`}
              active={paramparas.includes(p.id)}
              onToggle={() => toggle(paramparas, p.id, setParamparas, 8)}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('Root guru name')} hint={t('The guru at the root of your lineage.')}>
            <input className={inputCls} value={rootGuruName} onChange={(e) => setRootGuruName(e.target.value)} placeholder="e.g. Acharya…" />
          </Field>
          <Field label={t('Root guru location')}>
            <input className={inputCls} value={rootGuruLocation} onChange={(e) => setRootGuruLocation(e.target.value)} placeholder="City, State" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label={t('Lineage declaration')} hint={t('A short note on how and from whom you received your training.')}>
            <textarea className={`${inputCls} min-h-[90px] resize-y`} value={lineageDeclaration} onChange={(e) => setLineageDeclaration(e.target.value)} maxLength={600} />
          </Field>
        </div>
        <div className="mt-4">
          <p className="text-sm font-bold text-ink">{t('Yoga dimensions')}</p>
          <p className="mb-2 text-xs text-muted">{t('The areas you teach across.')}</p>
          <div className="flex flex-wrap gap-2">
            {YOGA_DIMENSIONS.map((d) => (
              <Chip key={d.id} label={d.name} active={dims.includes(d.id)} onToggle={() => toggle(dims, d.id, setDims)} />
            ))}
          </div>
        </div>
      </section>

      {/* Styles */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Yoga styles')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {codex.styles.map((s) => (
            <Chip key={s} label={s} active={styles.includes(s)} onToggle={() => toggle(styles, s, setStyles)} />
          ))}
        </div>
      </section>

      {/* Specializations */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Specialisations')}</h2>
        <p className="mt-0.5 text-xs text-muted">{t('Pick up to 12.')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {codex.specializations.map((s) => (
            <Chip key={s.id} label={s.name} active={specs.includes(s.id)} onToggle={() => toggle(specs, s.id, setSpecs, 12)} />
          ))}
        </div>
      </section>

      {/* Languages */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Languages spoken')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} label={l} active={langs.includes(l)} onToggle={() => toggle(langs, l, setLangs)} />
          ))}
        </div>
      </section>

      {/* 1:1 pricing */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('1:1 session pricing')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('Rate per session (₹)')}><input className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" /></Field>
          <label className="flex items-center gap-3 self-end rounded-xl border border-line px-3.5 py-2.5">
            <input type="checkbox" checked={premiumEnabled} onChange={(e) => setPremiumEnabled(e.target.checked)} className="h-4 w-4 accent-[#0D9488]" />
            <span className="text-sm font-semibold text-ink">{t('Available for 1:1 bookings')}</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">{t('Your rate is validated against your tier limits when saved.')}</p>
        {premiumNote && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" data-testid="premium-note">{premiumNote}</p>
        )}
      </section>

      {/* Social */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Social links')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Instagram"><input className={inputCls} value={social.instagram} onChange={(e) => setSocial({ ...social, instagram: e.target.value })} placeholder="handle" /></Field>
          <Field label="YouTube"><input className={inputCls} value={social.youtube} onChange={(e) => setSocial({ ...social, youtube: e.target.value })} placeholder="channel URL" /></Field>
          <Field label="LinkedIn"><input className={inputCls} value={social.linkedin} onChange={(e) => setSocial({ ...social, linkedin: e.target.value })} placeholder="profile URL" /></Field>
          <Field label="Website"><input className={inputCls} value={social.website} onChange={(e) => setSocial({ ...social, website: e.target.value })} placeholder="yoursite.com" /></Field>
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 z-[65] flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-4 shadow-lg backdrop-blur">
        {msg ? (
          <p data-testid="save-status" className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-brand-700' : 'text-red-600'}`}>{msg.text}</p>
        ) : (
          <p data-testid="save-status" className="text-sm text-muted">{t('Review your changes, then save.')}</p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? t('Saving…') : t('Save changes')}
        </button>
      </div>
    </div>
  );
}
