import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { reportPaymentUpstream } from '@/lib/server/monitor';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';

// Create the hosted Cashfree checkout for a pending retreat reservation and
// return its URL — the browser redirects there to pay securely (Cashfree hosted
// checkout), completing the booking without leaving NOSTOPS. Cashfree is the
// sole gateway. CSRF double-submit enforced; bearer attached server-side.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  // Payments Prompt 2B — billing country → provider, checked server-side before anything else.
  const routingRefusal = await routeCashfreeCheckout(req, body, 'retreat_seat');
  if (routingRefusal) return routingRefusal;
  const disabled = paymentsDisabled(req);
  if (disabled) return disabled;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to pay.' }, { status: 401 });

  const { id, rid } = await params;
  const up = await backendFetch(
    `/retreats/${encodeURIComponent(id)}/reservations/${encodeURIComponent(rid)}/cashfree-order`,
    { method: 'POST', headers: { [BILLING_HEADER]: DOMESTIC_COUNTRY }, body: JSON.stringify({}) },
  );
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    reportPaymentUpstream('/bff/retreats/:id/reservations/:rid/pay', up.status);
    const detail = Array.isArray((d as any)?.detail) ? (d as any).detail[0]?.msg : (d as any)?.detail;
    return NextResponse.json({ error: toErrorText(detail || (d as any)?.message, 'Could not start the payment. Please try again.') }, { status: up.status || 502 });
  }
  const shortUrl = (d as any)?.checkout_url ?? (d as any)?.short_url ?? (d as any)?.payment_link ?? null;
  return NextResponse.json({
    ok: true,
    short_url: shortUrl,
    amount_inr: typeof (d as any)?.amount_inr === 'number' ? (d as any).amount_inr : null,
  });
}
