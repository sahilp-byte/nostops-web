// Payments Prompt 2A — the website copy of the provider-routing answers, so a checkout can
// refuse an unclear or international purchase before anything is sent. The decision itself is
// made server-side by backend/payment_routing.py. These messages are the same text (checked by
// backend/tests/test_p2a_payment_routing.py).
//   India billing country   → Cashfree, Indian rupees (INR) only.
//   Any other country       → PayPal, US dollars (USD) only. Not built yet, so it is refused.
import { isCountryCode } from '@/lib/countries';

export const DOMESTIC_COUNTRY = 'IN';

export const ROUTING_MESSAGES = {
  billing_country_required: 'Select your billing country to continue. No payment has been taken.',
  billing_country_invalid: 'Select a valid billing country. No payment has been taken.',
  provider_unavailable: 'International checkout temporarily unavailable. PayPal checkout is being prepared. No payment has been taken.',
  international_not_offered: 'International payment for this item is not available yet. Only an India billing address can pay for it for now. No payment has been taken.',
  hold_not_offered: 'Booking from outside India isn’t available yet. Nothing has been reserved and no payment has been taken.',
} as const;

export type BillingRegion = 'IN' | 'INTL';

/** The price region of a billing country, or null when none (or an invalid one) is chosen. */
export function billingRegion(code: string | null | undefined): BillingRegion | null {
  const c = String(code || '').trim().toUpperCase();
  if (!isCountryCode(c)) return null;
  return c === DOMESTIC_COUNTRY ? 'IN' : 'INTL';
}
