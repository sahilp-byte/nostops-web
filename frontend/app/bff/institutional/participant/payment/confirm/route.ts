// §12/§13 — PAID institutional registration: CONFIRM after the Cashfree hosted
// checkout returns. Never trusts the return URL — re-verifies the real order
// status with the gateway, then flips the registration to CONFIRMED (idempotent,
// keyed by the unique order_id). CSRF double-submit guarded.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { confirmParticipantPayment } from '@/lib/server/participant';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.order_id || '').trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(orderId)) {
    return NextResponse.json({ error: 'invalid order id' }, { status: 400 });
  }
  const result = await confirmParticipantPayment(orderId);
  return NextResponse.json(result);
}
