'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';
import LegalAgreement from '@/components/legal/LegalAgreement';
import BillingCountryField, { DomesticOnlyNotice, routingButtonLabel } from '@/components/payments/BillingCountryField';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

// Shown when enrollment is closed (but not full): already-enrolled participants
// unlock their secure payment link by entering the email they enrolled with.
export default function PayNow({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [country, setCountry] = useState('');
  const region = billingRegion(country);

  async function pay() {
    setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Please enter the email you enrolled with.');
    if (region !== 'IN') return setErr(region ? ROUTING_MESSAGES.international_not_offered : ROUTING_MESSAGES.billing_country_required);
    setBusy(true);
    const r = await postBff(`/bff/booking-invite/${token}/cashfree-order`, { email: email.trim(), billing_country: country });
    setBusy(false);
    const url = r.data?.checkout_url || r.data?.short_url;
    if (r.ok && url) window.location.href = url;
    else setErr(r.data?.error || 'Could not fetch your payment link.');
  }

  return (
    <section className="rounded-2xl border border-brand/25 bg-white p-5" data-testid="pay-now">
      <h2 className="text-base font-extrabold text-ink">Already enrolled? Pay now</h2>
      <p className="mt-0.5 text-sm text-muted">Enter the email you enrolled with — we&apos;ll unlock your secure payment link.</p>
      <input
        className="mt-3 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enrolled work email"
        inputMode="email"
        autoCapitalize="none"
      />
      <div className="mt-3">
        <BillingCountryField value={country} onChange={(v) => { setCountry(v); setErr(null); }} testId="invite-billing-country" />
        {region === 'INTL' && <DomesticOnlyNotice testId="invite-intl-not-offered" />}
      </div>
      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
      <button
        type="button"
        onClick={pay}
        disabled={busy || region !== 'IN'}
        className="mt-3 w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
        data-testid="invite-pay"
      >
        {busy ? 'Preparing your link…' : routingButtonLabel(region) || 'Pay now securely →'}
      </button>
      <LegalAgreement className="mt-2" />
    </section>
  );
}
