import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isPaymentTestHost, isPreviewSuffix, PAYMENTS_DISABLED_MESSAGE } from '@/lib/payment-mode';

/** The public host the browser used (Route Handlers see an internal host in req.url). */
export function publicHost(req: NextRequest): string {
  return req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
}

/** B4.7 — every BFF route that starts a checkout calls this FIRST. In preview (or
 *  with no host) it returns a 503 test-mode response and nothing is sent upstream. */
export function paymentsDisabled(req: NextRequest): NextResponse | null {
  const blocked =
    isPaymentTestHost(publicHost(req)) ||
    isPreviewSuffix(req.headers.get('host')) ||
    isPreviewSuffix(req.headers.get('x-forwarded-host'));
  if (!blocked) return null;
  return NextResponse.json({ error: PAYMENTS_DISABLED_MESSAGE, payments_disabled: true }, { status: 503 });
}
