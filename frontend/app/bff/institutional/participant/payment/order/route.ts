// §12/§13 — PAID institutional registration: create the Cashfree order for an
// authenticated PARTICIPANT (magic-link session, NOT a NOSTOPS user session).
//
// Security model:
//  • The participant session token (httpOnly cookie) is read server-side and
//    used to PROVE the registration belongs to this participant — a participant
//    can never pay for / probe another participant's registration (anti-poaching
//    + no PII leak).
//  • The authoritative payable amount + customer details come from the engine
//    `payment/intent` (derived from the event's configured fee). The browser
//    NEVER supplies the amount.
//  • The remote Cashfree module (which holds the keys + owns the webhook) creates
//    the order. It needs no NOSTOPS bearer; identity is passed server-side.
//  • The hosted checkout returns the browser to our participant return page,
//    where payment is RE-VERIFIED with the gateway before the booking confirms.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getParticipantSessionToken } from '@/lib/server/participant';
import { institutionalFetch } from '@/lib/server/institutional';
import { PREVIEW_READ_ONLY_MESSAGE, previewWriteRefusal } from '@/lib/server/preview-isolation';
import { BACKEND_BASE } from '@/lib/api';
import { reportPaymentUpstream } from '@/lib/server/monitor';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { refuseFinancialCall } from '@/lib/server/financial-lock';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';

export const runtime = 'nodejs';

// Build the PUBLIC origin from forwarded headers. In this proxied environment a
// Route Handler's req.url resolves to the internal host (0.0.0.0:3000), which
// must NEVER leak into the Cashfree return URL. Mirror of participant/verify.
function publicBase(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  // Payments Prompt 2B — billing country → provider, checked server-side before anything else.
  const routingRefusal = await routeCashfreeCheckout(req, body, 'event_fee');
  if (routingRefusal) return routingRefusal;
  const disabled = paymentsDisabled(req);
  if (disabled) return disabled;

  const token = await getParticipantSessionToken();
  if (!token) return NextResponse.json({ error: 'Please confirm your email to continue.' }, { status: 401 });

  const registrationId = String(body?.registration_id || '').trim();
  if (!registrationId || registrationId.length > 64) {
    return NextResponse.json({ error: 'Missing registration reference.' }, { status: 400 });
  }
  const fallbackPhone = String(body?.phone || '').replace(/[^\d+]/g, '');

  try {
    // 1) OWNERSHIP — the registration MUST be the authenticated participant's own.
    const rr = await institutionalFetch('/participant/me/registrations', { participantSession: token });
    if (!rr.ok) return NextResponse.json({ error: 'Please confirm your email to continue.' }, { status: 401 });
    const rd = await rr.json().catch(() => ({}));
    const regs: any[] = Array.isArray(rd?.registrations) ? rd.registrations : [];
    const reg = regs.find((r) => String(r.registration_id) === registrationId);
    if (!reg) return NextResponse.json({ error: 'Registration not found for this account.' }, { status: 404 });
    if (reg.booking_status === 'CONFIRMED') return NextResponse.json({ ok: true, already_confirmed: true });
    if (reg.pricing_type !== 'PAID' || reg.booking_status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ error: 'This registration does not require payment.' }, { status: 400 });
    }

    // 2) AUTHORITATIVE amount + customer details (engine-derived, never client).
    const ir = await institutionalFetch('/participant/payment/intent', {
      method: 'POST',
      body: { registration_id: registrationId },
    });
    const intent = await ir.json().catch(() => ({}));
    if (!ir.ok) return NextResponse.json({ error: errorMessage(intent, 'Could not start the payment.') }, { status: ir.status });
    if (intent?.already_confirmed) return NextResponse.json({ ok: true, already_confirmed: true });

    const amount = Number(intent?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'This event fee is not configured yet. Please contact the organiser.' }, { status: 400 });
    }
    // Cashfree takes Indian rupees only; a fee in any other currency is never converted.
    if (String(intent?.currency || 'INR').toUpperCase() !== 'INR') {
      return NextResponse.json(
        { error: 'This event fee is not set in Indian rupees (₹), so it can’t be paid online yet. No payment has been taken.' },
        { status: 422 },
      );
    }
    const phone = String(intent?.customer_phone || fallbackPhone || '').replace(/[^\d+]/g, '');
    if (phone.length < 5) {
      return NextResponse.json({ error: 'A contact phone number is required for payment.' }, { status: 400 });
    }

    // 3) Create the remote Cashfree order. No NOSTOPS bearer is attached: the
    //    Cashfree module accepts a server-built customer identity. The return URL
    //    is templated with Cashfree's {order_id}, which it fills on redirect.
    const returnUrl = `${publicBase(req)}/participant/payment/return?order_id={order_id}`;
    const customerId = registrationId.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 100);
    const payload = {
      amount,
      currency: 'INR',
      order_type: 'institutional_event',
      reference_id: registrationId,
      customer_id: customerId,
      customer_name: intent?.customer_name || reg.participant_name || undefined,
      customer_email: intent?.customer_email || undefined,
      customer_phone: phone,
      return_url: returnUrl,
      note: intent?.event_title ? `NOSTOPS · ${String(intent.event_title).slice(0, 180)}` : undefined,
    };
    const cfPath = '/payments/cashfree/orders';
    const cfBody = JSON.stringify(payload);
    // Same money lock as every other main-backend call (a programme order is not a wallet top-up).
    const refused = refuseFinancialCall('POST', cfPath, cfBody);
    if (refused) return NextResponse.json({ error: (await refused.json()).detail }, { status: 423 });
    // Payments Prompt 2D — preview never writes to the real main backend.
    if (await previewWriteRefusal('POST', cfPath)) {
      return NextResponse.json({ error: PREVIEW_READ_ONLY_MESSAGE, preview_read_only: true }, { status: 423 });
    }
    const cf = await fetch(`${BACKEND_BASE}/api${cfPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', [BILLING_HEADER]: DOMESTIC_COUNTRY },
      body: cfBody,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const cfd = await cf.json().catch(() => null);
    if (!cf.ok || !cfd?.checkout_url || !cfd?.order_id) {
      reportPaymentUpstream('/bff/institutional/participant/payment/order', cf.ok ? 502 : cf.status);
      return NextResponse.json(
        { error: errorMessage(cfd, 'Could not start the payment. Please try again in a moment.') },
        { status: cf.status || 502 },
      );
    }

    // 4) Link the order to the PENDING_PAYMENT registration so the return page
    //    can match + confirm it (keyed by the unique Cashfree order_id).
    await institutionalFetch('/participant/payment/attach-order', {
      method: 'POST',
      body: { registration_id: registrationId, order_id: String(cfd.order_id), billing_country: DOMESTIC_COUNTRY },
    });

    return NextResponse.json({
      ok: true,
      checkout_url: cfd.checkout_url,
      order_id: cfd.order_id,
      amount: cfd.amount ?? amount,
      currency: cfd.currency ?? 'INR',
    });
  } catch {
    reportPaymentUpstream('/bff/institutional/participant/payment/order', null);
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
