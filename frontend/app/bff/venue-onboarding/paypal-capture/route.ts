import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { tier2PreviewEnabled } from '@/lib/server/flags';
import { capturePayPalOrder, VENUE_FLOW, venueCheckoutClosedReason } from '@/lib/server/venue-onboarding';
import { financialLockedJson } from '@/lib/server/financial-lock';
import { publicHost } from '@/lib/server/payment-guard';
import { VENUE_CHECKOUT_UNAVAILABLE_MESSAGE } from '@/lib/payment-mode';

// Prompt 4F — the buyer is back from PayPal's approval page: take the payment they approved.
// CSRF protected and behind the same dual lock as a new checkout (this is when money moves).
// The backend re-checks the lock and the environment, captures once (idempotent) and re-reads
// PayPal's own record before anything is granted. Only a safe status is returned.
export async function POST(req: NextRequest) {
  if (!tier2PreviewEnabled()) return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const locked = financialLockedJson(VENUE_FLOW);
  if (locked) return locked;
  if (venueCheckoutClosedReason()) {
    return NextResponse.json(
      { error: VENUE_CHECKOUT_UNAVAILABLE_MESSAGE, checkout_unavailable: true, reason: 'checkout_gate_closed' },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.order_id || '');
  if (!/^vob_[A-Za-z0-9]{6,40}$/.test(orderId)) {
    return NextResponse.json({ error: 'invalid order id' }, { status: 400 });
  }
  const { ok, status, data } = await capturePayPalOrder(orderId, publicHost(req));
  if (!ok) {
    const detail = data?.detail ?? data?.error;
    const msg = typeof detail === 'string' && detail.trim() ? detail : 'Could not confirm the PayPal payment. Please refresh this page.';
    return NextResponse.json({ error: msg }, { status: status || 502 });
  }
  return NextResponse.json({
    status: data?.status ?? 'UNKNOWN',
    paid: !!data?.paid,
    venue_name: data?.venue_name || '',
    last_payment_status: typeof data?.last_payment_status === 'string' ? data.last_payment_status : null,
    sandbox: data?.mode === 'sandbox',
  });
}
