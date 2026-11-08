'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CohortKey } from '@/lib/org/cohort-copy';
import { readAttribution } from '@/lib/attribution';
import {
  DURATIONS,
  ENQ_COHORTS,
  ENQUIRY_REPLY_SLA,
  INTERESTS,
  PARTICIPANTS,
  START_PERIODS,
  type InterestKey,
} from '@/lib/org/enquiry';

// Public "Request a proposal" form for organisations. Posts to /bff/org-enquiry
// with the stateless signed CSRF token (/bff/guru/token — works on cacheable
// public pages without a cookie), a hidden honeypot, a render timestamp and the
// self-hosted image CAPTCHA. Every rule is re-checked server-side.
type Errors = Partial<Record<string, string>>;

const input =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
const label = 'mb-1 block text-xs font-bold text-ink';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function FieldError({ msg, id }: { msg?: string; id: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1 text-xs font-semibold text-red-600" data-testid={`${id}`}>
      {msg}
    </p>
  );
}

export default function OrgEnquiryForm({ defaultCohort, sourcePage }: { defaultCohort?: CohortKey; sourcePage: string }) {
  const csrf = useRef<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  const [org, setOrg] = useState('');
  const [contact, setContact] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cohort, setCohort] = useState<string>(defaultCohort || '');
  const [city, setCity] = useState('');
  const [participants, setParticipants] = useState('');
  const [interests, setInterests] = useState<InterestKey[]>([]);
  const [duration, setDuration] = useState('');
  const [start, setStart] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(''); // honeypot
  // Set only when the visitor arrived via an explicit "Request a customised
  // programme" link (?customise=1). Never inferred from the chosen interests.
  const [customise, setCustomise] = useState(false);

  const [capImg, setCapImg] = useState('');
  const [capToken, setCapToken] = useState('');
  const [capAns, setCapAns] = useState('');
  const [capLoading, setCapLoading] = useState(true);

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; deduped: boolean } | null>(null);

  async function loadCsrf() {
    try {
      const r = await fetch('/bff/guru/token', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      csrf.current = (await r.json())?.token || null;
    } catch {
      csrf.current = null;
    }
  }

  async function loadCaptcha() {
    setCapLoading(true);
    setCapAns('');
    try {
      const res = await fetch('/bff/venue/captcha', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      setCapImg(d?.image || '');
      setCapToken(d?.token || '');
    } catch {
      setCapImg('');
      setCapToken('');
    } finally {
      setCapLoading(false);
    }
  }

  useEffect(() => {
    loadCsrf();
    loadCaptcha();
    // Prefill from the wizard's customisation link (cohort + pathway).
    const q = new URLSearchParams(window.location.search);
    const interest = q.get('interest');
    if (interest && INTERESTS.some((i) => i.key === interest)) setInterests([interest as InterestKey]);
    const qc = q.get('cohort');
    if (qc && ENQ_COHORTS.some((c) => c.key === qc)) setCohort(qc);
    if (q.get('customise') === '1') setCustomise(true);
  }, []);

  const toggleInterest = (k: InterestKey) => setInterests((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));

  function validate(): Errors {
    const e: Errors = {};
    if (org.trim().length < 2) e.organisation_name = "Enter your organisation's name.";
    if (!contact.trim()) e.contact_name = 'Enter your name.';
    if (!email.trim() && !phone.trim()) e.email = 'Give a work email or a phone number so we can reach you.';
    else if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (phone.trim() && !/^[\d\s()+\-.]{7,20}$/.test(phone.trim())) e.phone = 'Enter a valid phone number.';
    if (!cohort) e.cohort = 'Choose your organisation type.';
    if (city.trim().length < 2) e.city = 'Enter the city.';
    if (!participants) e.participants = 'Choose the approximate number of participants.';
    if (interests.length === 0) e.interests = 'Choose at least one programme area.';
    if (!duration) e.duration = 'Choose a preferred duration.';
    if (!start) e.start_period = 'Choose when you would like to start.';
    if (!consent) e.consent = 'Please agree to be contacted about your enquiry.';
    if (capAns.trim().length < 4 || !capToken) e.captcha = 'Type the characters shown in the verification image.';
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError('Please check the highlighted fields.');
      return;
    }
    setBusy(true);
    if (!csrf.current) await loadCsrf();
    const attr = readAttribution();
    const payload = {
      organisation_name: org.trim(),
      contact_name: contact.trim(),
      designation: designation.trim(),
      email: email.trim(),
      phone: phone.trim(),
      cohort,
      city: city.trim(),
      participants,
      interests,
      duration,
      start_period: start,
      message: message.trim(),
      consent,
      customisation_requested: customise,
      source_page: sourcePage,
      landing_page: attr?.landing_page || '',
      referrer: attr?.referrer || '',
      utm: attr?.utm || {},
      company,
      form_started_at: startedAt.current,
      captcha_token: capToken,
      captcha_answer: capAns.trim(),
    };
    try {
      const res = await fetch('/bff/org-enquiry', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-guru-csrf': csrf.current || '' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.fields && typeof data.fields === 'object') setErrors(data.fields);
        setFormError(data?.error || 'Could not send your enquiry. Please try again.');
        loadCaptcha(); // single-use challenge — always issue a fresh one
        return;
      }
      setDone({ ref: String(data?.ref || ''), deduped: !!data?.deduped });
    } catch {
      setFormError('Could not reach us just now. Please try again in a moment.');
      loadCaptcha();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8" data-testid="enq-success" role="status">
        <p className="text-lg font-black text-emerald-800">Thank you, your enquiry has been received.</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
          Your reference is <strong data-testid="enq-ref">{done.ref}</strong>. The NOSTOPS team will reply {ENQUIRY_REPLY_SLA}.
          {email.trim() && <> We&apos;ve sent a confirmation to <strong>{email.trim()}</strong>.</>}
        </p>
        {done.deduped && (
          <p className="mt-2 text-xs font-semibold text-emerald-900/70" data-testid="enq-deduped">
            We already had this enquiry from you, so we kept your original reference.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/programmes" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
            Explore Programmes
          </Link>
          <Link href="/for-organisations" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand/40 bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">
            Back to For Organisations
          </Link>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  const invalid = (k: string) => (errors[k] ? ' border-red-400' : '');

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7" data-testid="org-enquiry-form">
      {customise && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-brand/30 bg-brand-50/60 px-4 py-3 text-sm" data-testid="enq-customise-banner">
          <p className="text-ink-soft"><strong className="text-ink">Customised programme requested.</strong> Tell us what you need in the message. If an approved programme fits, you can still create it yourself.</p>
          <button type="button" onClick={() => setCustomise(false)} data-testid="enq-customise-remove"
            className="shrink-0 text-xs font-bold text-brand-700 hover:underline">Remove</button>
        </div>
      )}
      {/* Honeypot — hidden from people and assistive tech; only bots fill it. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="enq-company">Company website (leave this field empty)</label>
        <input id="enq-company" name="company" type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="enq-org" className={label}>Organisation name *</label>
          <input id="enq-org" className={input + invalid('organisation_name')} value={org} onChange={(e) => setOrg(e.target.value)} maxLength={160} autoComplete="organization" data-testid="enq-org" aria-invalid={!!err('organisation_name')} />
          <FieldError id="enq-err-organisation_name" msg={err('organisation_name')} />
        </div>
        <div>
          <label htmlFor="enq-contact" className={label}>Your name *</label>
          <input id="enq-contact" className={input + invalid('contact_name')} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} autoComplete="name" data-testid="enq-contact" aria-invalid={!!err('contact_name')} />
          <FieldError id="enq-err-contact_name" msg={err('contact_name')} />
        </div>
        <div>
          <label htmlFor="enq-designation" className={label}>Role / designation</label>
          <input id="enq-designation" className={input} value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} autoComplete="organization-title" placeholder="e.g. HR Manager, Principal, Founder" data-testid="enq-designation" />
        </div>
        <div>
          <label htmlFor="enq-email" className={label}>Work email</label>
          <input id="enq-email" type="email" className={input + invalid('email')} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" data-testid="enq-email" aria-invalid={!!err('email')} />
          <FieldError id="enq-err-email" msg={err('email')} />
        </div>
        <div>
          <label htmlFor="enq-phone" className={label}>Phone</label>
          <input id="enq-phone" type="tel" className={input + invalid('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="+91" data-testid="enq-phone" aria-invalid={!!err('phone')} />
          <FieldError id="enq-err-phone" msg={err('phone')} />
        </div>
        <p className="-mt-2 text-xs text-muted sm:col-span-2">Give us a work email, a phone number, or both.</p>
      </div>

      <fieldset>
        <legend className={label}>Organisation type *</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ENQ_COHORTS.map((c) => (
            <label key={c.key} className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${cohort === c.key ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft hover:border-brand/50'}`}>
              <input type="radio" name="enq-cohort" value={c.key} checked={cohort === c.key} onChange={() => setCohort(c.key)} className="accent-brand" data-testid={`enq-cohort-${c.key}`} />
              <span aria-hidden>{c.icon}</span>
              {c.label}
            </label>
          ))}
        </div>
        <FieldError id="enq-err-cohort" msg={err('cohort')} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="enq-city" className={label}>City *</label>
          <input id="enq-city" className={input + invalid('city')} value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} autoComplete="address-level2" data-testid="enq-city" aria-invalid={!!err('city')} />
          <FieldError id="enq-err-city" msg={err('city')} />
        </div>
        <div>
          <label htmlFor="enq-participants" className={label}>Approx. participants *</label>
          <select id="enq-participants" className={input + invalid('participants')} value={participants} onChange={(e) => setParticipants(e.target.value)} data-testid="enq-participants" aria-invalid={!!err('participants')}>
            <option value="">Select…</option>
            {PARTICIPANTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <FieldError id="enq-err-participants" msg={err('participants')} />
        </div>
      </div>

      <fieldset>
        <legend className={label}>Programme interests *</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {INTERESTS.map((i) => (
            <label key={i.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${interests.includes(i.key) ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand/50'}`}>
              <input type="checkbox" checked={interests.includes(i.key)} onChange={() => toggleInterest(i.key)} className="mt-0.5 accent-brand" data-testid={`enq-interest-${i.key}`} />
              <span>
                <span className="block font-bold text-ink"><span aria-hidden>{i.icon}</span> {i.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{i.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="enq-err-interests" msg={err('interests')} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="enq-duration" className={label}>Preferred duration *</label>
          <select id="enq-duration" className={input + invalid('duration')} value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="enq-duration" aria-invalid={!!err('duration')}>
            <option value="">Select…</option>
            {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <FieldError id="enq-err-duration" msg={err('duration')} />
        </div>
        <div>
          <label htmlFor="enq-start" className={label}>When would you like to start? *</label>
          <select id="enq-start" className={input + invalid('start_period')} value={start} onChange={(e) => setStart(e.target.value)} data-testid="enq-start" aria-invalid={!!err('start_period')}>
            <option value="">Select…</option>
            {START_PERIODS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <FieldError id="enq-err-start_period" msg={err('start_period')} />
        </div>
      </div>

      <div>
        <label htmlFor="enq-message" className={label}>Anything else we should know?</label>
        <textarea id="enq-message" rows={3} className={`${input} resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="Goals, preferred days or timings, venue details…" data-testid="enq-message" />
      </div>

      {/* CAPTCHA */}
      <div className="border-t border-line pt-5" data-testid="captcha-block">
        <label className={label} htmlFor="enq-captcha">Verification *</label>
        <p className="text-sm text-ink-soft">Type the characters shown below. This helps keep spam out.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex h-[64px] w-[176px] items-center justify-center overflow-hidden rounded-xl border border-line bg-cream" aria-hidden>
            {capLoading ? (
              <span className="text-xs font-bold text-muted">Loading…</span>
            ) : capImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capImg} alt="" className="h-full w-full object-contain" data-testid="captcha-image" />
            ) : (
              <span className="text-xs font-bold text-red-500">Unavailable</span>
            )}
          </div>
          <button type="button" onClick={loadCaptcha} disabled={capLoading} className="min-h-[44px] rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50" data-testid="captcha-refresh" aria-label="Get a new verification image">
            ↻ New code
          </button>
          <input
            id="enq-captcha"
            className={`${input} w-[160px] uppercase tracking-[0.3em]${invalid('captcha')}`}
            value={capAns}
            onChange={(e) => setCapAns(e.target.value.replace(/\s/g, '').slice(0, 8))}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="CODE"
            aria-label="Verification code"
            data-testid="captcha-input"
          />
        </div>
        <FieldError id="enq-err-captcha" msg={err('captcha')} />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="enq-consent" />
          <span>
            I agree that NOSTOPS may contact me about this enquiry and store these details as described in the{' '}
            <Link href="/privacy" className="font-bold text-brand-700 hover:underline">Privacy Policy</Link>. *
          </span>
        </label>
        <FieldError id="enq-err-consent" msg={err('consent')} />
      </div>

      {formError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert" data-testid="enq-error">
          {formError}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <button type="submit" disabled={busy} className="min-h-[48px] w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60" data-testid="enq-submit">
          {busy ? 'Sending…' : 'Request a proposal'}
        </button>
        <p className="text-center text-xs text-muted">No payment and no obligation. We reply {ENQUIRY_REPLY_SLA}.</p>
      </div>
    </form>
  );
}
