import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { canonical } from '@/lib/site';
import { financialFlowUnlocked } from '@/lib/server/financial-lock';
import { venueCheckoutEnabled } from '@/lib/server/flags';
import { VENUE_CHECKOUT_UNAVAILABLE_MESSAGE } from '@/lib/payment-mode';

/** The money-lock name of this checkout (backend/financial_lock.py UNLOCKABLE_FLOWS). */
export const VENUE_FLOW = 'venue_ai_onboarding';

// Server-only client for the LOCAL, ISOLATED "Venue AI-Assisted Onboarding"
// Cashfree flow (/api/ai-onboarding/*). Auth mirrors the other local modules:
// a shared secret header. The browser never holds the secret and never talks to
// the FastAPI module directly — only the BFF routes below do.
// The purchase is tied to ONE venue listing, proven by the owner's signed edit
// link token (never by a typed email).
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 20000;

function headers(): Record<string, string> {
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() };
}

export type CreateLinkInput = { token: string; phone?: string; name?: string; region: 'IN' | 'INTL'; billing_country: string };

/** Prompt 4D — dual lock for NEW venue checkouts: the money lock for THIS checkout (Prompt 4F:
 *  FINANCIAL_UNLOCKED_FLOWS names it; every other money action stays locked) AND the dedicated
 *  VENUE_CHECKOUT_ENABLED gate must both allow it. Returns why a new checkout is closed, or null
 *  only when both are open. Status reads for EXISTING orders are not gated. */
export type VenueCheckoutClosed = 'financial_lock' | 'checkout_gate_closed';
export function venueCheckoutClosedReason(): VenueCheckoutClosed | null {
  if (!financialFlowUnlocked(VENUE_FLOW)) return 'financial_lock';
  if (!venueCheckoutEnabled()) return 'checkout_gate_closed';
  return null;
}

export async function createOnboardingLink(input: CreateLinkInput, originHost: string) {
  // Second layer (the checkout route refuses first): never ask the backend for an order while closed.
  const closed = venueCheckoutClosedReason();
  if (closed) {
    return { ok: false, status: closed === 'financial_lock' ? 423 : 503, data: { error: VENUE_CHECKOUT_UNAVAILABLE_MESSAGE, reason: closed } };
  }
  const return_url = canonical('/venues/ai-onboarding/result');
  const notify_url = canonical('/api/ai-onboarding/webhook');
  const r = await fetch(`${BASE}/api/ai-onboarding/create-order`, {
    method: 'POST',
    // B4.7 — the backend refuses to create an order for a preview/unknown host.
    headers: { ...headers(), 'X-Nostops-Origin-Host': originHost },
    body: JSON.stringify({ ...input, return_url, notify_url }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

export async function onboardingStatus(orderId: string, originHost: string) {
  const r = await fetch(`${BASE}/api/ai-onboarding/status?order_id=${encodeURIComponent(orderId)}`, {
    headers: { ...headers(), 'X-Nostops-Origin-Host': originHost },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

/** Prompt 4F — take the PayPal payment the buyer just approved (the backend re-checks the lock,
 *  the environment and PayPal's own record). Never called while the checkout is closed. */
export async function capturePayPalOrder(orderId: string, originHost: string) {
  const closed = venueCheckoutClosedReason();
  if (closed) {
    return { ok: false, status: closed === 'financial_lock' ? 423 : 503, data: { error: VENUE_CHECKOUT_UNAVAILABLE_MESSAGE, reason: closed } };
  }
  const r = await fetch(`${BASE}/api/ai-onboarding/paypal/capture`, {
    method: 'POST',
    headers: { ...headers(), 'X-Nostops-Origin-Host': originHost },
    body: JSON.stringify({ order_id: orderId }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

export type ProviderMode = { enabled: boolean; mode: 'sandbox' | 'production' | 'disabled'; sandbox: boolean };

export type CheckoutMode = ProviderMode & {
  /** Why a new checkout can't start: a website control (Prompt 4D), or the backend said no. */
  reason: VenueCheckoutClosed | 'not_available' | null;
  /** Prompt 4F — PayPal (international, USD). The top level is Cashfree (India, INR). */
  paypal: ProviderMode;
};

function providerMode(d: { enabled?: unknown; mode?: unknown; sandbox?: unknown } | null | undefined): ProviderMode {
  const mode = d?.mode === 'sandbox' || d?.mode === 'production' ? d.mode : 'disabled';
  const enabled = d?.enabled === true && mode !== 'disabled';
  return { enabled, mode: enabled ? mode : 'disabled', sandbox: enabled && d?.sandbox === true && mode === 'sandbox' };
}

/** Server-side: may checkout start for this public host (Cashfree for India, PayPal abroad), and
 *  is it a SANDBOX? Fails closed (disabled) on any error. Drives the BFF guard, the sandbox banner
 *  and the Pay button. While either Prompt 4D control is closed the backend is not even asked. */
export async function checkoutMode(originHost: string): Promise<CheckoutMode> {
  const offProvider: ProviderMode = { enabled: false, mode: 'disabled', sandbox: false };
  const off: CheckoutMode = { ...offProvider, reason: 'not_available', paypal: offProvider };
  const closed = venueCheckoutClosedReason();
  if (closed) return { ...off, reason: closed };
  if (!SECRET) return off;
  try {
    const r = await fetch(`${BASE}/api/ai-onboarding/checkout-mode`, {
      headers: { ...headers(), 'X-Nostops-Origin-Host': originHost },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) return off;
    const cashfree = providerMode(d);
    return { ...cashfree, reason: cashfree.enabled ? null : 'not_available', paypal: providerMode(d.paypal) };
  } catch {
    return off;
  }
}

export type OnboardingVenue = { venueName: string; city: string; emailHint: string; hasPhone: boolean; active: boolean };

/** Which venue listing a signed edit link points at, and whether it is already upgraded. */
export async function venueForToken(token: string): Promise<{ venue: OnboardingVenue | null; error?: string }> {
  if (!SECRET || token.length < 8) return { venue: null, error: 'Your secure venue link is invalid or has expired.' };
  try {
    const r = await fetch(`${BASE}/api/ai-onboarding/for-venue?token=${encodeURIComponent(token)}`, {
      headers: headers(),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) return { venue: null, error: (typeof d?.detail === 'string' && d.detail) || 'Your secure venue link is invalid or has expired.' };
    return {
      venue: {
        venueName: String(d.venue_name || ''),
        city: String(d.city || ''),
        emailHint: String(d.email_hint || ''),
        hasPhone: !!d.has_phone,
        active: !!d.active,
      },
    };
  } catch {
    return { venue: null, error: 'The service is unavailable right now. Please try again shortly.' };
  }
}
