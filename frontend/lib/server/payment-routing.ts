// Payments Prompt 2B — server-side provider routing for every website Cashfree checkout.
// Each BFF that leads to a Cashfree order calls routeCashfreeCheckout() before anything else
// that could create one. It sends the buyer's explicit billing country (plus any currency or
// provider the request claims) to the one policy, backend/payment_routing.py, and refuses
// unless the answer is exactly "India → Cashfree, INR". The browser can't change the outcome:
// the country is checked here, and the order's currency and provider are fixed server-side.
// If the policy can't be reached, the checkout is refused (fail closed).
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { publicHost } from '@/lib/server/payment-guard';

// No default: if PULSE_API_URL is missing the policy call fails and the checkout is refused.
const BASE = (process.env.PULSE_API_URL || '').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

/** Sent with every order request to the main backend, so it can enforce the same rule. */
export const BILLING_HEADER = 'X-Billing-Country';
export const ROUTING_UNAVAILABLE = 'Payments are temporarily unavailable. No payment has been taken.';

export type CheckoutFlow =
  | 'one_on_one' | 'event_fee' | 'retreat_seat' | 'retreat_group' | 'fast_track' | 'instakyc' | 'group_invite' | 'wallet_topup';
/** Prompt 2C — added to a refusal when the request would have created a hold (slot, seat, group, place). */
export const HOLD_SUFFIX = ' Nothing has been reserved.';

// A value the request claims, as text. A non-text value (number, list, object, true/false) is
// passed on in its JSON form, e.g. ["IN"] or 840, which is never a valid country, currency or
// provider, so the policy refuses it as invalid.
const claimed = (v: unknown, max: number): string | null =>
  v === undefined || v === null || v === '' ? null : (typeof v === 'string' ? v : JSON.stringify(v)).slice(0, max);

function refuse(status: number, error: string, reason: string | undefined, hold: boolean): NextResponse {
  return NextResponse.json(
    {
      error: hold ? `${error}${HOLD_SUFFIX}` : error,
      routing_refused: true,
      ...(hold ? { hold_refused: true } : {}),
      ...(reason ? { reason } : {}),
      ...(reason === 'provider_unavailable' ? { provider_unavailable: true } : {}),
    },
    { status },
  );
}

/** null = allowed: India → Cashfree, INR (the order then carries X-Billing-Country: IN).
 *  Otherwise the refusal to return to the browser.
 *  Prompt 2C — `hold: true` is used before a request that would create a hold for the purchase
 *  (1:1 booking, retreat seat or group hold, group-batch place): it needs the same answer. */
export async function routeCashfreeCheckout(
  req: NextRequest,
  body: unknown,
  flow: CheckoutFlow,
  opts: { hold?: boolean } = {},
): Promise<NextResponse | null> {
  const hold = !!opts.hold;
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  let d: any = null;
  try {
    const r = await fetch(`${BASE}/api/payment-routing/decide`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Pulse-Secret': SECRET, ...testTagHeaders(),
        'X-Nostops-Origin-Host': publicHost(req),
      },
      body: JSON.stringify({
        flow,
        billing_country: claimed(b.billing_country, 8),
        currency: claimed(b.currency, 8),
        provider: claimed(b.provider, 16),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    d = r.ok ? await r.json().catch(() => null) : null;
  } catch {
    d = null;
  }
  if (!d || typeof d.allowed !== 'boolean') return refuse(503, ROUTING_UNAVAILABLE, undefined, hold);
  if (!d.allowed) return refuse(Number(d.status) || 422, typeof d.message === 'string' && d.message ? d.message : ROUTING_UNAVAILABLE, d.reason, hold);
  // Never fall back: only "India → Cashfree, INR" may continue to a Cashfree order (or a hold for one).
  if (d.provider !== 'cashfree' || d.currency !== 'INR' || d.billing_country !== 'IN') return refuse(503, ROUTING_UNAVAILABLE, undefined, hold);
  return null;
}
