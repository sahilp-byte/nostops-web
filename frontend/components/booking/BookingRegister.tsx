'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';
import BillingCountryField, { HoldNotOfferedNotice, holdButtonLabel } from '@/components/payments/BillingCountryField';
import HoldAlternatives, { plainHostHref } from '@/components/payments/HoldAlternatives';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

const inputCls =
  'mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function BookingRegister({
  token,
  companyName,
  courseTitle,
  venue,
  sessionCount,
  instructorName,
}: {
  token: string;
  companyName: string;
  courseTitle: string;
  venue: string;
  sessionCount: number;
  instructorName: string | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ enrollmentId?: string } | null>(null);
  // Prompt 2C — enrolling reserves a place that is paid for later, so the billing country comes
  // first (India only for now; re-checked server-side).
  const [country, setCountry] = useState('');
  const region = billingRegion(country);

  async function enroll() {
    setErr(null);
    if (name.trim().length < 2) return setErr('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Please enter a valid email.');
    if (region !== 'IN') return setErr(region ? ROUTING_MESSAGES.hold_not_offered : ROUTING_MESSAGES.billing_country_required);
    setBusy(true);
    const r = await postBff(`/bff/booking-invite/${token}/register`, { name: name.trim(), email: email.trim(), billing_country: country });
    setBusy(false);
    if (r.ok) {
      setDone({ enrollmentId: r.data?.payment?.transaction_id || r.data?.enrollment_id });
    } else {
      setErr(r.data?.error || 'Could not reserve your spot. Please try again.');
    }
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-brand/25 bg-brand-50/50 p-6 text-center" data-testid="enroll-success">
        <span className="inline-grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-white">✓</span>
        <h2 className="mt-3 text-lg font-black text-ink">Enrollment interest confirmed</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Your spot in the yoga wellness program at {companyName} is reserved. Your payment link, with the group-discount
          price, will be sent once the batch closes.
        </p>
        <dl className="mx-auto mt-4 max-w-sm space-y-1.5 rounded-xl border border-line bg-white p-4 text-left text-sm">
          <div className="flex justify-between"><dt className="text-muted">Program</dt><dd className="font-semibold text-ink">{courseTitle}</dd></div>
          {done.enrollmentId && <div className="flex justify-between"><dt className="text-muted">Enrollment ID</dt><dd className="font-semibold text-ink">{done.enrollmentId}</dd></div>}
          {venue && <div className="flex justify-between"><dt className="text-muted">Venue</dt><dd className="font-semibold text-ink">{venue}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Sessions</dt><dd className="font-semibold text-ink">{sessionCount} planned</dd></div>
          {instructorName && <div className="flex justify-between"><dt className="text-muted">Instructor</dt><dd className="font-semibold text-ink">{instructorName}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Payment</dt><dd className="font-bold text-accent-600">Pending · link after batch closes</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">You&apos;ll get a WhatsApp / email reminder when the batch closes and the payment link is issued. Namaste 🙏</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="enroll-form">
      <h2 className="text-base font-extrabold text-ink">Reserve your spot</h2>
      <p className="mt-0.5 text-sm text-muted">Add your details — the more colleagues join, the deeper the group discount.</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-bold text-ink">Full name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="block text-sm font-bold text-ink">Work email</label>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" inputMode="email" autoCapitalize="none" />
        </div>
        <div>
          <BillingCountryField
            value={country}
            onChange={(v) => { setCountry(v); setErr(null); }}
            testId="enroll-billing-country"
            hint="Needed before we reserve your spot. Only an India billing address can pay for this programme for now."
          />
          {region === 'INTL' && (
            <HoldNotOfferedNotice testId="enroll-intl-not-offered">
              <HoldAlternatives
                askHref={plainHostHref(`a place in "${courseTitle}" at ${companyName}`)}
                askLabel="Message the organiser"
                testId="enroll-alternatives"
              />
            </HoldNotOfferedNotice>
          )}
        </div>
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
        <button
          type="button"
          onClick={enroll}
          disabled={busy || region !== 'IN'}
          className="w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
          data-testid="enroll-cta"
        >
          {busy ? 'Reserving your spot…' : holdButtonLabel(region) || "Yes, I'm interested — enroll me →"}
        </button>
      </div>
    </section>
  );
}
