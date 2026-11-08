import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { onboardingStatus } from '@/lib/server/venue-onboarding';
import { publicHost } from '@/lib/server/payment-guard';

// Read the paid-onboarding payment status (GET — no CSRF). Authoritative: the
// backend re-reads the Cashfree link before answering and grants entitlement on
// PAID. Only a safe boolean/status is surfaced to the browser.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id') || '';
  if (!/^vob_[A-Za-z0-9]{6,40}$/.test(orderId)) {
    return NextResponse.json({ error: 'invalid order id' }, { status: 400 });
  }
  const { ok, status, data } = await onboardingStatus(orderId, publicHost(req));
  if (!ok) {
    const err = status >= 500 ? 'The payment status is unavailable right now. Please refresh in a moment.' : 'not found';
    return NextResponse.json({ error: err }, { status: status || 502 });
  }
  return NextResponse.json({
    status: data?.status ?? 'UNKNOWN',
    paid: !!data?.paid,
    venue_name: data?.venue_name || '',
    last_payment_status: typeof data?.last_payment_status === 'string' ? data.last_payment_status : null,
    sandbox: data?.mode === 'sandbox',
  });
}
