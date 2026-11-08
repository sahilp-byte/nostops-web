import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { markOneOnOnePaidByOrder } from '@/lib/server/audit';
import { reportPaymentUpstream } from '@/lib/server/monitor';

const PAID = new Set(['PAID', 'SUCCESS']);

// Read Cashfree order status (GET — no CSRF needed). Authenticated: the bearer
// is attached from the httpOnly session cookie. Used by the /cashfree-return
// page to confirm payment after the hosted checkout redirects back.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { orderId } = await params;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(orderId)) {
    return NextResponse.json({ error: 'invalid order id' }, { status: 400 });
  }

  const up = await backendFetch(`/payments/cashfree/orders/${encodeURIComponent(orderId)}`);
  const data = await up.json().catch(() => null);
  if (!up.ok) {
    reportPaymentUpstream('/bff/payments/cashfree/orders/:id', up.status);
    return NextResponse.json({ error: toErrorText(data?.detail, 'Order not found.') }, { status: up.status || 502 });
  }
  const status = (data?.order_status || data?.status || 'UNKNOWN').toString().toUpperCase();
  const amount = typeof data?.amount === 'number' ? data.amount : null;

  // Payment Status Sync: once the gateway confirms the payment, flip the local
  // 1:1 audit ledger to PAID so the admin ledger reflects real revenue, not just
  // attempts. Authoritative (we just re-read the gateway status) + scoped to this
  // seeker's order server-side. Best-effort — never blocks the status response.
  if (PAID.has(status)) {
    await markOneOnOnePaidByOrder(user, orderId, amount ?? undefined);
  }

  return NextResponse.json({
    order_id: orderId,
    status,
    amount,
    order_type: data?.order_type ?? null,
  });
}
