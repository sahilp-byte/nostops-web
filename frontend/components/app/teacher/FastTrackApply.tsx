'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import LegalAgreement from '@/components/legal/LegalAgreement';
import BillingCountryField, { DomesticOnlyNotice, routingButtonLabel } from '@/components/payments/BillingCountryField';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';
import type { FastTrackRequest } from '@/lib/server/teacher';

const inputCls =
  'mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-cream';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted — awaiting payment',
  pending_payment: 'Awaiting payment',
  paid: 'Paid — in Council review queue',
  in_review: 'In Council review',
  scheduled: 'Interview scheduled',
  approved: 'Approved 🎉',
  rejected: 'Not approved',
  cancelled: 'Cancelled',
};

function StatusCard({ req }: { req: FastTrackRequest }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="ft-status">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-ink">Your fast-track request</h3>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent-600">
          {STATUS_LABEL[req.status] || req.status}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm text-ink-soft">
        <div className="flex justify-between"><dt>Amount</dt><dd className="font-semibold text-ink">₹{req.amount.toLocaleString('en-IN')}</dd></div>
        {req.paymentStatus && <div className="flex justify-between"><dt>Payment</dt><dd className="font-semibold capitalize text-ink">{req.paymentStatus}</dd></div>}
        {req.decisionOutcome && <div className="flex justify-between"><dt>Decision</dt><dd className="font-semibold capitalize text-ink">{req.decisionOutcome}</dd></div>}
      </dl>
      {req.decisionNotes && <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-sm text-ink-soft">“{req.decisionNotes}”</p>}
    </section>
  );
}

export default function FastTrackApply({
  amount,
  isEmpanelled,
  active,
  latest,
}: {
  amount: number;
  isEmpanelled: boolean;
  active: FastTrackRequest | null;
  latest: FastTrackRequest | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Phone OTP
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Application
  const [exp, setExp] = useState('');
  const [specs, setSpecs] = useState('');
  const [motivation, setMotivation] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Prompt 2B — billing country for the Fast-Track fee (India, ₹ only; re-checked server-side).
  const [country, setCountry] = useState('');
  const region = billingRegion(country);
  const countryField = (
    <div>
      <BillingCountryField value={country} onChange={(v) => { setCountry(v); setErr(null); }} testId="ft-billing-country" />
      {region === 'INTL' && <DomesticOnlyNotice testId="ft-intl-not-offered" />}
    </div>
  );
  const routingError = () => (region ? ROUTING_MESSAGES.international_not_offered : ROUTING_MESSAGES.billing_country_required);

  if (isEmpanelled) {
    return (
      <section className="rounded-2xl border border-brand/20 bg-brand-50/50 p-5" data-testid="ft-empanelled">
        <p className="text-base font-extrabold text-ink">🏅 You’re already empanelled</p>
        <p className="mt-1 text-sm text-ink-soft">No fast-track needed — you already have priority placement on Mission batches.</p>
        {latest && <div className="mt-3"><StatusCard req={latest} /></div>}
      </section>
    );
  }

  if (active) {
    return (
      <div className="space-y-4">
        <StatusCard req={active} />
        {(active.status === 'submitted' || active.status === 'pending_payment') && countryField}
        {(active.status === 'submitted' || active.status === 'pending_payment') && (
          <button type="button" onClick={() => payFor(active.requestId)} disabled={busy || region !== 'IN'} data-testid="ft-pay" className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700">
            {busy ? 'Please wait…' : routingButtonLabel(region) || `Pay ₹${amount.toLocaleString('en-IN')} to enter the queue →`}
          </button>
        )}
        {(active.status === 'submitted' || active.status === 'pending_payment') && <LegalAgreement />}
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
      </div>
    );
  }

  async function sendOtp() {
    setErr(null);
    const p = phone.trim();
    if (!/^\+?[0-9]{10,14}$/.test(p.replace(/\s/g, ''))) return setErr('Enter a valid phone number.');
    setBusy(true);
    const r = await postBff('/bff/teacher/empanelment/fast-track/phone/start', { phone: p, purpose: 'empanelment' });
    setBusy(false);
    if (r.ok) { setOtpSent(true); setErr(null); } else setErr(r.data?.error || 'Could not send OTP.');
  }

  async function verifyOtp() {
    setErr(null);
    if (code.length < 4) return setErr('Enter the OTP sent to your phone.');
    setBusy(true);
    const r = await postBff('/bff/teacher/empanelment/fast-track/phone/verify', { phone: phone.trim(), code, purpose: 'empanelment' });
    setBusy(false);
    if (r.ok) { setPhoneVerified(true); setErr(null); } else setErr(r.data?.error || 'OTP verification failed.');
  }

  async function payFor(requestId: string) {
    if (region !== 'IN') return setErr(routingError());
    setBusy(true);
    const r = await postBff(`/bff/teacher/empanelment/fast-track/${requestId}/cashfree-order`, { billing_country: country });
    setBusy(false);
    const url = r.data?.checkout_url || r.data?.short_url;
    if (r.ok && url) {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) window.location.href = url;
    } else setErr(r.data?.error || 'Could not start payment.');
  }

  async function submit() {
    setErr(null);
    const e = parseInt(exp, 10);
    if (Number.isNaN(e) || e < 0) return setErr('Enter your years of teaching experience.');
    if (!phoneVerified) return setErr('Please verify your phone number via OTP first.');
    if (motivation.trim().length < 20) return setErr(`Motivation is too short — at least 20 characters (you have ${motivation.trim().length}).`);
    if (region !== 'IN') return setErr(routingError());
    setBusy(true);
    const r = await postBff('/bff/teacher/empanelment/fast-track/initiate', {
      experience_years: e,
      specializations: specs.split(',').map((s) => s.trim()).filter(Boolean),
      motivation: motivation.trim(),
      phone: phone.trim(),
      billing_country: country,
    });
    setBusy(false);
    if (r.ok && r.data?.request?.request_id) {
      await payFor(r.data.request.request_id);
      router.refresh();
    } else setErr(r.data?.error || 'Could not submit your request.');
  }

  if (!open) {
    return (
      <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
        <h3 className="text-base font-extrabold text-ink">Ready to fast-track?</h3>
        <p className="mt-1 text-sm text-ink-soft">Submit your details, pay ₹{amount.toLocaleString('en-IN')}, and we’ll get you in front of a Council Guru within 7 days.</p>
        <button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600">Start application →</button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="ft-form">
      <h3 className="text-base font-extrabold text-ink">Fast-track application</h3>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-bold text-ink">Years of teaching experience</label>
          <input className={inputCls} value={exp} onChange={(e) => setExp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="5" />
        </div>
        <div>
          <label className="block text-sm font-bold text-ink">Specialisations</label>
          <input className={inputCls} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="Hatha, Pranayama, Corporate wellness" />
          <p className="mt-1 text-xs text-muted">Comma-separated.</p>
        </div>
        <div>
          <label className="block text-sm font-bold text-ink">Phone number</label>
          <div className="mt-1 flex gap-2">
            <input className={`${inputCls} mt-0 flex-1`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+9198…" disabled={phoneVerified} />
            {!phoneVerified && (
              <button type="button" onClick={otpSent ? verifyOtp : sendOtp} disabled={busy} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {otpSent ? 'Verify' : 'Send OTP'}
              </button>
            )}
            {phoneVerified && <span className="grid place-items-center rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700">Verified ✓</span>}
          </div>
          {otpSent && !phoneVerified && (
            <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Enter OTP" />
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-ink">Why do you want fast-track empanelment?</label>
          <textarea className={`${inputCls} min-h-[100px] resize-y`} value={motivation} onChange={(e) => setMotivation(e.target.value)} maxLength={800} />
          <p className="mt-1 text-right text-xs text-muted">{motivation.trim().length}/800 (min 20)</p>
        </div>
        {countryField}
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
        <button type="button" onClick={submit} disabled={busy || region !== 'IN'} data-testid="ft-submit" className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700">
          {busy ? 'Please wait…' : routingButtonLabel(region) || `Submit & pay ₹${amount.toLocaleString('en-IN')} →`}
        </button>
        <LegalAgreement action="submitting and paying" />
      </div>
    </section>
  );
}
