'use client';

import { useMemo, type ReactNode } from 'react';
import { countryOptions } from '@/lib/countries';

// Payments Prompt 2A/2B — the buyer's billing country, chosen explicitly at every checkout
// (no default, never guessed from IP, phone or browser language). India pays through
// Cashfree in ₹; the server re-checks the choice before any order is created.
export default function BillingCountryField({
  value,
  onChange,
  testId = 'billing-country',
  hint = 'The country of the billing address you pay from.',
}: {
  value: string;
  onChange: (code: string) => void;
  testId?: string;
  hint?: string;
}) {
  const countries = useMemo(() => countryOptions(), []);
  return (
    <label className="block text-left">
      <span className="text-xs font-bold text-ink-soft">Billing country *</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
        data-testid={testId}
      >
        <option value="">Select your billing country</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code} suppressHydrationWarning>{c.name}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
    </label>
  );
}

/** Shown when a billing country outside India is chosen for something sold in ₹ only. */
export function DomesticOnlyNotice({ testId = 'intl-not-offered' }: { testId?: string }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left" role="status" data-testid={testId}>
      <p className="text-sm font-bold text-amber-900">International payment isn&apos;t available for this yet</p>
      <p className="mt-1 text-sm text-amber-800">
        It can be paid only with an India billing address, in Indian rupees (₹), for now. No payment has been taken.
      </p>
    </div>
  );
}

/** Prompt 2C — shown when a billing country outside India is chosen BEFORE anything is reserved
 *  (a 1:1 slot, a retreat seat or group, a place in a paid event or group batch). */
export function HoldNotOfferedNotice({ testId = 'hold-intl-not-offered', children }: { testId?: string; children?: ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left" role="status" data-testid={testId}>
      <p className="text-sm font-bold text-amber-900">Booking from outside India isn&apos;t available yet</p>
      <p className="mt-1 text-sm text-amber-800">
        This can be booked and paid only with an India billing address, in Indian rupees (₹), for now. Nothing has been
        reserved and no payment has been taken.
      </p>
      {children}
    </div>
  );
}

/** Reserve/register-button text while the billing country isn't India. */
export function holdButtonLabel(region: 'IN' | 'INTL' | null): string | null {
  if (region === 'INTL') return 'Booking from outside India not available yet';
  if (region === null) return 'Select your billing country to continue';
  return null;
}

/** Pay-button text while the billing country isn't India. */
export function routingButtonLabel(region: 'IN' | 'INTL' | null): string | null {
  if (region === 'INTL') return 'International payment not available';
  if (region === null) return 'Select your billing country to continue';
  return null;
}
