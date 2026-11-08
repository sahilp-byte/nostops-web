'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';
import LegalAgreement from '@/components/legal/LegalAgreement';
import BillingCountryField, { DomesticOnlyNotice, routingButtonLabel } from '@/components/payments/BillingCountryField';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

// §12/§13 — "Complete payment" step for a PAID institutional registration.
// Creates the Cashfree order via the participant-scoped BFF (which derives the
// authoritative amount server-side) then redirects to the hosted checkout.
export default function ParticipantPayStep({
  registrationId,
  eventTitle,
  amount,
  currency = 'INR',
  phone,
  defaultCountry = '',
}: {
  registrationId: string;
  eventTitle?: string | null;
  amount?: number | null;
  currency?: string | null;
  phone?: string | null;
  defaultCountry?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [country, setCountry] = useState(defaultCountry);
  const region = billingRegion(country);

  async function pay() {
    setErr('');
    if (region !== 'IN') {
      setErr(region ? ROUTING_MESSAGES.international_not_offered : ROUTING_MESSAGES.billing_country_required);
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await postBff('/bff/institutional/participant/payment/order', {
        registration_id: registrationId,
        phone: phone || undefined,
        billing_country: country,
      });
      if (ok && (data as any)?.already_confirmed) {
        // Full reload on purpose: the participant pages re-read the confirmed booking server-side.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/participant?paid=1';
        return;
      }
      if (!ok || !(data as any)?.checkout_url) {
        setErr((data as any)?.error || 'Could not start the payment. Please try again.');
        setBusy(false);
        return;
      }
      window.location.href = (data as any).checkout_url as string;
    } catch {
      setErr('Network error. Please try again.');
      setBusy(false);
    }
  }

  const amt =
    typeof amount === 'number' && amount > 0
      ? `${currency === 'INR' || !currency ? '₹' : `${currency} `}${Math.round(amount).toLocaleString('en-IN')}`
      : null;

  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="participant-pay-step">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-3xl">💳</div>
      <h3 className="mt-3 text-xl font-black text-ink">One last step — complete payment</h3>
      <p className="mt-1 text-sm text-ink-soft">
        {eventTitle ? (
          <>Your seat for <span className="font-semibold text-ink">{eventTitle}</span> is held. </>
        ) : (
          'Your seat is held. '
        )}
        Pay securely to confirm your registration.
      </p>
      {amt && (
        <div className="mx-auto mt-4 flex max-w-xs items-center justify-between rounded-xl bg-cream px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">Amount payable</span>
          <span className="text-lg font-black text-ink" data-testid="pay-amount">{amt}</span>
        </div>
      )}
      {err && <p className="mt-3 text-sm font-semibold text-red-600" data-testid="pay-error">{err}</p>}
      <div className="mx-auto mt-4 max-w-xs">
        <BillingCountryField value={country} onChange={(v) => { setCountry(v); setErr(''); }} testId="participant-billing-country" />
        {region === 'INTL' && <DomesticOnlyNotice testId="participant-intl-not-offered" />}
      </div>
      <button
        type="button"
        onClick={pay}
        disabled={busy || region !== 'IN'}
        data-testid="participant-pay"
        className="mt-4 w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
      >
        {busy ? 'Starting secure checkout…' : routingButtonLabel(region) || (amt ? `Pay ${amt} with Cashfree →` : 'Pay with Cashfree →')}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        Secured by Cashfree. You can also pay later from{' '}
        <Link href="/participant" className="font-semibold text-brand-700 hover:underline">My programmes</Link>.
        {' · '}
        <Link href="/trust" className="font-semibold text-brand-700 hover:underline">How verification &amp; payments work</Link>
      </p>
      <LegalAgreement className="mt-1 text-center" />
    </div>
  );
}
