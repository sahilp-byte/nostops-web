'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';
import LegalAgreement from '@/components/legal/LegalAgreement';
import { usePaymentsTestMode } from '@/components/payments/PreviewPaymentBanner';
import BillingCountryField, { DomesticOnlyNotice, routingButtonLabel } from '@/components/payments/BillingCountryField';
import { PAYMENTS_DISABLED_MESSAGE } from '@/lib/payment-mode';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

// Reusable "Pay with Cashfree" button. Creates an order via the BFF (which
// derives the customer from the session and forwards to the backend Cashfree
// module) then redirects the browser to the hosted checkout. On completion the
// backend redirects to /cashfree-return?order_id=... to confirm status.
// Prompt 2B: the buyer picks their billing country first; only India (₹, Cashfree) can pay,
// and the BFF re-checks it server-side.
export default function CashfreePayButton({
  amount,
  orderType,
  referenceId,
  note,
  customerPhone,
  label,
  className,
  onError,
  defaultCountry = '',
}: {
  defaultCountry?: string;
  amount: number;
  orderType: string;
  referenceId?: string;
  note?: string;
  customerPhone?: string;
  label?: string;
  className?: string;
  onError?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [country, setCountry] = useState(defaultCountry);
  const region = billingRegion(country);
  const testMode = usePaymentsTestMode();
  const payLabel = label || `Pay ₹${Math.round(amount).toLocaleString('en-IN')} with Cashfree →`;
  const countryField = (
    <div className="mb-3">
      <BillingCountryField value={country} onChange={(v) => { setCountry(v); setErr(null); }} testId="cashfree-billing-country" />
      {region === 'INTL' && <DomesticOnlyNotice testId="cashfree-intl-not-offered" />}
    </div>
  );

  if (testMode) {
    return (
      <div>
        {countryField}
        <button
          type="button"
          disabled
          data-testid="cashfree-pay"
          className={className || 'w-full cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700'}
        >
          {routingButtonLabel(region) || payLabel}
        </button>
        <p className="mt-2 text-sm font-semibold text-amber-700" data-testid="cashfree-test-mode">{PAYMENTS_DISABLED_MESSAGE}</p>
      </div>
    );
  }

  async function pay() {
    setErr(null);
    if (region !== 'IN') {
      setErr(region ? ROUTING_MESSAGES.international_not_offered : ROUTING_MESSAGES.billing_country_required);
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await postBff('/bff/payments/cashfree/orders', {
        amount, orderType, referenceId, note, customerPhone, billing_country: country,
      });
      if (!ok || !(data as any)?.checkout_url) {
        const m = (data as any)?.error || 'Could not start the payment. Please try again.';
        setErr(m);
        onError?.(m);
        setBusy(false);
        return;
      }
      window.location.href = (data as any).checkout_url;
    } catch {
      const m = 'Network error. Please try again.';
      setErr(m);
      onError?.(m);
      setBusy(false);
    }
  }

  return (
    <div>
      {countryField}
      <button
        type="button"
        onClick={pay}
        disabled={busy || region !== 'IN'}
        data-testid="cashfree-pay"
        className={className || 'w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700'}
      >
        {busy ? 'Starting secure checkout…' : routingButtonLabel(region) || payLabel}
      </button>
      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
      <LegalAgreement className="mt-2" />
    </div>
  );
}
