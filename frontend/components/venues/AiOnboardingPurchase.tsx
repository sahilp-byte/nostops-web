'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';
import LegalAgreement from '@/components/legal/LegalAgreement';
import BillingCountryField from '@/components/payments/BillingCountryField';
import { isPaymentTestHost, isPayPalApproveUrl, isPreviewSuffix, VENUE_CHECKOUT_UNAVAILABLE_MESSAGE } from '@/lib/payment-mode';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => { checkout: (o: Record<string, unknown>) => Promise<unknown> };
  }
}

let cfPromise: Promise<void> | null = null;
function loadCashfree(mode: 'sandbox' | 'production') {
  if (typeof window !== 'undefined' && window.Cashfree) return Promise.resolve(window.Cashfree({ mode }));
  if (!cfPromise) {
    cfPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('sdk load failed'));
      document.head.appendChild(s);
    });
  }
  return cfPromise.then(() => {
    if (!window.Cashfree) throw new Error('Cashfree SDK unavailable');
    return window.Cashfree({ mode });
  });
}

const PRICE = {
  IN: { label: '₹2,359', sub: '₹1,999 + 18% GST · one-time' },
  INTL: { label: 'US$30', sub: 'one-time · paid with PayPal in US dollars (USD)' },
} as const;

/** Session key the result page uses to send the owner back to their venue. */
export const AI_ONBOARDING_TOKEN_KEY = 'nostops_ai_onboarding_token';

export type PurchaseVenue = { venueName: string; city: string; emailHint: string; hasPhone: boolean; active: boolean };

const btn = 'inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-3 text-sm font-bold transition';

/** One-time AI-onboarding purchase, tied to the venue listing behind `token`.
 *  `checkoutAvailable` (India, Cashfree) and `intlAvailable` (outside India, PayPal) come from the
 *  server (Prompt 4D: money lock + venue gate + host check); informational only, default closed.
 *  The server refuses a closed checkout anyway. */
export function AiOnboardingPurchase({
  token,
  venue,
  linkError,
  checkoutAvailable = false,
  intlAvailable = false,
}: {
  token?: string;
  venue?: PurchaseVenue | null;
  linkError?: string;
  checkoutAvailable?: boolean;
  intlAvailable?: boolean;
}) {
  // Payments Prompt 2A — the billing country (chosen explicitly, no default) sets the price and
  // the provider: India → Cashfree (INR); outside India → PayPal (USD).
  const [country, setCountry] = useState('');
  const region = billingRegion(country);
  const available = region === 'INTL' ? intlAvailable : region === 'IN' ? checkoutAvailable : checkoutAvailable || intlAvailable;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [paidAlready, setPaidAlready] = useState(false);
  const editHref = token ? `/venues/submit/edit?token=${encodeURIComponent(token)}` : '/venues/submit/edit';

  // No (valid) venue link: the upgrade is always bought for a specific listing.
  if (!token || !venue) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm md:p-6" data-testid="ai-onboarding-needs-venue">
        {linkError && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800" role="alert" data-testid="ai-onboarding-link-error">{linkError}</p>
        )}
        <p className="text-lg font-black text-ink">AI onboarding is bought for one venue listing</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          So each payment is linked to the right venue (and never charged twice), start from your venue&apos;s secure edit
          link. List your venue for free first, or ask for a fresh edit link if it&apos;s already listed. Then tap
          <strong> “Unlock AI onboarding”</strong> on that page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/venues/submit" className={`${btn} bg-indigo-600 text-white shadow-lg hover:bg-indigo-700`} data-testid="ai-onboarding-list-free">List your venue (free)</Link>
          <Link href="/venues/submit/edit" className={`${btn} border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50`} data-testid="ai-onboarding-get-link">Get my venue&apos;s edit link</Link>
        </div>
      </div>
    );
  }

  if (venue.active || paidAlready) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm md:p-6" data-testid="ai-onboarding-active">
        <p className="text-sm font-bold text-emerald-700">✓ Already unlocked</p>
        <p className="mt-1 text-lg font-black text-ink">{venue.venueName}{venue.city ? ` · ${venue.city}` : ''}</p>
        <p className="mt-2 text-sm text-ink-soft">This venue already has AI-assisted onboarding — there is nothing more to pay. Head back to your venue page to generate suggestions.</p>
        <Link href={editHref} className={`${btn} mt-4 bg-indigo-600 text-white shadow-lg hover:bg-indigo-700`} data-testid="ai-onboarding-back-to-venue">Back to my venue →</Link>
      </div>
    );
  }

  async function pay() {
    setErr('');
    // Prompt 4D — the server reported new checkouts closed: never ask it to start one.
    if (!available) return;
    if (!region) {
      setErr(ROUTING_MESSAGES.billing_country_required);
      return;
    }
    if (region === 'IN' && !venue!.hasPhone && phone.replace(/\D/g, '').length < 7) {
      setErr('Please enter a valid phone number.');
      return;
    }
    setBusy(true);
    const { ok, status, data } = await postBff<{
      provider?: string; payment_session_id?: string; approve_url?: string; mode?: string; error?: string; already_paid?: boolean;
    }>(
      '/bff/venue-onboarding/checkout',
      { token, name: name.trim(), phone: phone.trim(), billing_country: country },
    );
    // Defense-in-depth: the provider environment must match the host — sandbox only on a
    // preview host, live only off preview. Anything else is refused before checkout.
    const sandbox = data?.mode === 'sandbox';
    const envOk = sandbox === isPreviewSuffix(window.location.host) && (sandbox || !isPaymentTestHost(window.location.host));
    if (ok && region === 'INTL' && data?.provider === 'paypal' && data.approve_url) {
      // Prompt 4F — PayPal's own approval page; the payment is taken when the buyer comes back.
      if (!envOk || !isPayPalApproveUrl(data.approve_url, sandbox ? 'sandbox' : 'production')) {
        setErr('Payments are not available right now. You have not been charged.');
        setBusy(false);
        return;
      }
      try { sessionStorage.setItem(AI_ONBOARDING_TOKEN_KEY, token!); } catch { /* private mode */ }
      window.location.assign(data.approve_url);
      return;
    }
    if (ok && region === 'IN' && data?.payment_session_id) {
      if (!envOk) {
        setErr('Payments are not available right now. You have not been charged.');
        setBusy(false);
        return;
      }
      try {
        try { sessionStorage.setItem(AI_ONBOARDING_TOKEN_KEY, token!); } catch { /* private mode */ }
        const cashfree = await loadCashfree(sandbox ? 'sandbox' : 'production');
        await cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' });
        return;
      } catch {
        setErr('Could not open the secure checkout. Please try again.');
        setBusy(false);
        return;
      }
    }
    if (status === 409 || data?.already_paid) setPaidAlready(true);
    setErr(data?.error || 'Could not start the payment. Please try again.');
    setBusy(false);
  }

  const price = region ? PRICE[region] : null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm md:p-6" data-testid="ai-onboarding-purchase">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3" data-testid="ai-onboarding-venue">
        <p className="text-[11px] font-black uppercase tracking-wide text-indigo-700">Upgrading this listing</p>
        <p className="mt-0.5 text-base font-black text-ink">{venue.venueName}{venue.city ? ` · ${venue.city}` : ''}</p>
        {venue.emailHint && <p className="text-xs text-muted">Receipt goes to {venue.emailHint}</p>}
      </div>

      {/* Billing country — sets the price and who takes the payment */}
      <div className="mt-4">
        <BillingCountryField
          value={country}
          onChange={(v) => { setCountry(v); setErr(''); }}
          testId="ai-onboarding-billing-country"
          hint="The country of the billing address you pay from. It sets your price."
        />
      </div>

      {/* Price */}
      <div className="mt-4 flex items-end justify-between gap-3" data-testid="ai-onboarding-price">
        <div>
          <div className={`${price ? 'text-3xl' : 'text-xl'} font-black tracking-tight text-ink`}>
            {price ? price.label : `${PRICE.IN.label} · ${PRICE.INTL.label}`}
          </div>
          <div className="text-xs font-semibold text-muted">
            {price ? price.sub : intlAvailable ? 'India · outside India (PayPal)' : 'India · outside India (international checkout temporarily unavailable)'}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">One-time · this venue</span>
      </div>

      {region === 'INTL' && !intlAvailable && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="status" data-testid="ai-onboarding-intl-unavailable">
          <p className="text-sm font-bold text-amber-900">International checkout temporarily unavailable</p>
          <p className="mt-1 text-sm text-amber-800">PayPal checkout is being prepared. No payment has been taken. Your free listing is not affected.</p>
        </div>
      )}

      {/* Fields */}
      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">Your name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Venue owner / manager"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-indigo-400"
            data-testid="ai-onboarding-name"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">Phone {venue.hasPhone || region === 'INTL' ? '(optional' + (venue.hasPhone ? ' — we have one on file)' : ')') : '*'}</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Contact number"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-indigo-400"
            data-testid="ai-onboarding-phone"
          />
        </label>
      </div>

      {!available && region !== 'INTL' && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" role="status" data-testid="ai-onboarding-checkout-unavailable">
          <p className="text-sm font-bold text-slate-900">{VENUE_CHECKOUT_UNAVAILABLE_MESSAGE}</p>
        </div>
      )}

      {err ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" role="alert" data-testid="ai-onboarding-error">{err}</p>
      ) : null}

      <button
        type="button"
        onClick={pay}
        disabled={busy || !region || !available}
        className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700 disabled:shadow-none"
        data-testid="ai-onboarding-pay"
      >
        {busy
          ? 'Starting secure checkout…'
          : !available
            ? region === 'INTL' ? 'International checkout unavailable' : 'Checkout unavailable'
            : region === 'IN'
              ? `Pay ${PRICE.IN.label} & unlock for this venue →`
              : region === 'INTL'
                ? `Pay ${PRICE.INTL.label} with PayPal & unlock →`
                : 'Select your billing country to continue'}
      </button>
      {region === 'IN' && available && (
        <p className="mt-3 text-center text-xs text-muted" data-testid="ai-onboarding-cashfree-note">
          Secure checkout by Cashfree in Indian rupees (INR). You&apos;ll be redirected to complete payment.
        </p>
      )}
      {region === 'INTL' && available && (
        <p className="mt-3 text-center text-xs text-muted" data-testid="ai-onboarding-paypal-note">
          Secure checkout by PayPal in US dollars (USD). You&apos;ll be redirected to PayPal to approve the payment.
        </p>
      )}
      {(region !== 'INTL' || intlAvailable) && <LegalAgreement className="mt-1 text-center" />}
    </div>
  );
}
