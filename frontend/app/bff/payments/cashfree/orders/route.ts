import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { recordOneOnOne } from '@/lib/server/audit';
import { reportPaymentUpstream } from '@/lib/server/monitor';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { financialLockedJson } from '@/lib/server/financial-lock';
import { checkBookingAmount, resolveCheckoutAmount } from '@/lib/offers';
import { BILLING_HEADER, routeCashfreeCheckout, type CheckoutFlow } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';
import { instaKycIsComplimentary } from '@/lib/server/festive-kyc';

const ORDER_FLOWS: Record<string, CheckoutFlow> = { one_on_one: 'one_on_one', instakyc: 'instakyc', wallet_topup: 'wallet_topup' };

// Create a Cashfree order via the backend's Cashfree module (which holds the
// keys and owns webhook/settlement). Customer identity is derived server-side
// from the session — never trusted from the client. CSRF double-submit enforced.
// Returns the hosted checkout_url the browser redirects to.
// B4.8 — the amount is decided HERE (lib/offers.ts), never taken from the browser:
// a fixed-price offer with a different amount is rejected as tampered, retired /
// unknown offers are refused — even in preview, before the test-mode block.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const orderType = typeof body?.orderType === 'string' ? body.orderType.slice(0, 64) : '';
  let referenceId = body?.referenceId ? String(body.referenceId).slice(0, 128) : undefined;
  const check = resolveCheckoutAmount(orderType, body?.amount, referenceId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  // FINANCIAL SAFETY AUDIT: a wallet top-up credits a wallet — paused while the lock is on.
  if (orderType === 'wallet_topup') {
    const locked = financialLockedJson();
    if (locked) return locked;
  }
  // Payments Prompt 2B — billing country → provider, checked server-side before anything else.
  const routingRefusal = await routeCashfreeCheckout(req, body, ORDER_FLOWS[orderType]);
  if (routingRefusal) return routingRefusal;

  const disabled = paymentsDisabled(req);
  if (disabled) return disabled;

  const user: any = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to pay.' }, { status: 401 });

  // Festive Complimentary InstaKYC: an eligible teacher (or one who already claimed) pays ₹0 —
  // NO Cashfree order is created and no gateway is called. Fails closed if the engine can't answer.
  if (orderType === 'instakyc') {
    const free = await instaKycIsComplimentary(user);
    if (free === true) {
      return NextResponse.json(
        { error: 'Your InstaKYC is complimentary in the festive offer — no payment is needed. Claim it on your KYC page.', complimentary: true },
        { status: 409 },
      );
    }
    if (free === 'unknown') {
      return NextResponse.json({ error: 'Could not confirm your InstaKYC fee right now. Please try again shortly.' }, { status: 503 });
    }
  }

  // For the teacher's own self-service flows, resolve the reference (teacher_id)
  // and a fallback phone SERVER-SIDE so the internal teacher_id never has to
  // travel through the browser (mirrors the 1:1 booking BFF pattern).
  let selfPhone = '';
  if (!referenceId && (orderType === 'instakyc' || orderType === 'wallet_topup')) {
    try {
      const r = await backendFetch('/teachers/me/native-profile');
      if (r.ok) {
        const d = await r.json();
        const t = d?.teacher || {};
        referenceId = t.teacher_id ? String(t.teacher_id).slice(0, 128) : undefined;
        selfPhone = String(t.phone || t.mobile || '');
      }
    } catch {
      /* non-fatal — fall back to the session phone below */
    }
  }

  const phone = String(body?.customerPhone || user.phone || user.mobile || selfPhone || '').replace(/[^\d+]/g, '');
  if (phone.length < 5) {
    return NextResponse.json({ error: 'A contact phone number is required for payment.' }, { status: 400 });
  }

  // PART 12 / 14 + B4.8 — never trust the client-supplied amount for a 1:1 booking.
  // Re-derive the authoritative fee from the reserved booking, server-side; if it
  // can't be read, no order is created (never a fallback to the browser amount).
  let chargeAmount = check.amount as number;
  if (check.fromBooking) {
    let authoritative: unknown = null;
    try {
      const br = await backendFetch('/one-on-one/my-bookings');
      if (!br.ok) return NextResponse.json({ error: 'Could not confirm the booking amount. Please try again.' }, { status: 502 });
      const bd = await br.json().catch(() => ({}));
      const items = Array.isArray(bd?.bookings) ? bd.bookings : Array.isArray(bd) ? bd : [];
      const bk = items.find((b: any) => String(b.booking_id) === referenceId);
      if (!bk) {
        return NextResponse.json({ error: 'Booking not found for this account.' }, { status: 404 });
      }
      authoritative = bk.amount_inr;
    } catch {
      return NextResponse.json({ error: 'Could not confirm the booking amount. Please try again.' }, { status: 502 });
    }
    const b = checkBookingAmount(authoritative, body?.amount);
    if (!b.ok) return NextResponse.json({ error: b.error }, { status: b.status });
    chargeAmount = b.amount as number;
  }

  const payload = {
    amount: chargeAmount,
    currency: 'INR',
    order_type: orderType,
    reference_id: referenceId,
    customer_id: String(user.user_id || user.email).slice(0, 100),
    customer_name: user.name || user.full_name || undefined,
    customer_email: user.email || undefined,
    customer_phone: phone,
    note: body?.note ? String(body.note).slice(0, 500) : undefined,
  };

  const up = await backendFetch('/payments/cashfree/orders', {
    method: 'POST',
    headers: { [BILLING_HEADER]: DOMESTIC_COUNTRY },
    body: JSON.stringify(payload),
  });
  const data = await up.json().catch(() => null);
  if (!up.ok) {
    reportPaymentUpstream('/bff/payments/cashfree/orders', up.status);
    // The backend may return `detail` as a string or a structured object
    // (e.g. gateway rejections). Never surface a raw object to the client.
    const detail = data?.detail;
    const msg =
      typeof detail === 'string' && detail.trim()
        ? detail
        : typeof data?.message === 'string' && data.message.trim()
          ? data.message
          : 'Could not start the payment. Please try again in a moment.';
    return NextResponse.json({ error: msg }, { status: up.status || 502 });
  }
  // Update the local audit ledger: the seeker has now created a Cashfree order
  // for this 1:1 booking. Best-effort (never blocks the payment redirect).
  if (orderType === 'one_on_one' && referenceId) {
    const orderAmount = typeof data?.amount === 'number' ? data.amount : chargeAmount;
    await recordOneOnOne(user, {
      booking_id: String(referenceId),
      event: 'order_created',
      status: 'PAYMENT_INITIATED',
      gateway: 'cashfree',
      order_id: data?.order_id ? String(data.order_id) : undefined,
      amount_inr: typeof orderAmount === 'number' ? orderAmount : undefined,
      currency: data?.currency || 'INR',
    });
  }

  // Surface only what the client needs; no secrets.
  return NextResponse.json({
    order_id: data?.order_id ?? null,
    payment_session_id: data?.payment_session_id ?? null,
    checkout_url: data?.checkout_url ?? null,
    amount: data?.amount ?? chargeAmount,
    currency: data?.currency ?? 'INR',
    status: data?.status ?? null,
    mode: data?.mode ?? null,
  });
}
