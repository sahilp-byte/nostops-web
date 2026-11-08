import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';

// Public (unauthenticated) participant actions on a shared group-booking invite.
// CSRF double-submit still applies (proxy.ts issues nostops_csrf on /booking-invite
// page loads; sendBff echoes it). Only two actions are permitted, and the token
// is pattern-validated before it is forwarded to the backend.
const TOKEN = /^[A-Za-z0-9_-]{8,80}$/;
const ACTIONS = new Set(['register', 'cashfree-order']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { token, action } = await params;
  if (!TOKEN.test(token) || !ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid invite link.' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  let forward: unknown = body ?? {};
  const headers: Record<string, string> = {};
  if (action === 'cashfree-order') {
    // Payments Prompt 2B — billing country → provider, checked server-side before anything else.
    const routingRefusal = await routeCashfreeCheckout(req, body, 'group_invite');
    if (routingRefusal) return routingRefusal;
    const disabled = paymentsDisabled(req);
    if (disabled) return disabled;
    forward = { email: typeof body?.email === 'string' ? body.email.slice(0, 254) : undefined };
    headers[BILLING_HEADER] = DOMESTIC_COUNTRY;
  } else {
    // Payments Prompt 2C — enrolling reserves a place in the batch that is paid for later on
    // NOSTOPS, so the billing country is checked first (India only). Refused → nothing is created.
    const routingRefusal = await routeCashfreeCheckout(req, body, 'group_invite', { hold: true });
    if (routingRefusal) return routingRefusal;
    forward = {
      name: typeof body?.name === 'string' ? body.name.slice(0, 120) : undefined,
      email: typeof body?.email === 'string' ? body.email.slice(0, 254) : undefined,
    };
    headers[BILLING_HEADER] = DOMESTIC_COUNTRY;
  }
  const up = await backendFetch(`/bookings/invite/${encodeURIComponent(token)}/${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(forward),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json(
      { error: toErrorText(data?.detail || data?.message, 'Something went wrong. Please try again.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json(data);
}
