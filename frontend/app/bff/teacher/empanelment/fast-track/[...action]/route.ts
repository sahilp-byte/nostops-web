import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';

// Proxy for the teacher Fast-Track Empanelment flow. Whitelisted actions only.
// "initiate" creates a request; the request-scoped actions carry a request_id
// segment validated against a strict id pattern.
const ID = /^[A-Za-z0-9_-]{6,64}$/;

function resolve(action: string[]): string | null {
  const key = (action || []).join('/');
  if (key === 'initiate') return '/empanelment/fast-track/initiate';
  if (key === 'phone/start') return '/teacher-empanelment/phone/start';
  if (key === 'phone/verify') return '/teacher-empanelment/phone/verify';
  if (action?.length === 2 && ID.test(action[0])) {
    // Cashfree is the sole gateway — Fast-Track payment creates a Cashfree order.
    if (action[1] === 'cashfree-order') return `/empanelment/fast-track/${action[0]}/cashfree-order`;
    if (action[1] === 'cancel') return `/empanelment/fast-track/${action[0]}/cancel`;
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string[] }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { action } = await params;
  const target = resolve(action);
  if (!target) return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  let forward: unknown = body ?? {};
  const headers: Record<string, string> = {};
  // Payments Prompt 2B — "initiate" (creates the paid Fast-Track request upstream) and
  // "cashfree-order" (creates its order) both lead to a payment. The billing country is checked
  // server-side, then the preview guard runs, BEFORE anything is sent upstream: a missing or
  // invalid country → 400, outside India → 422, preview → 503. No request, order or provider call.
  const initiate = target === '/empanelment/fast-track/initiate';
  if (initiate || action[1] === 'cashfree-order') {
    const routingRefusal = await routeCashfreeCheckout(req, body, 'fast_track');
    if (routingRefusal) return routingRefusal;
    const disabled = paymentsDisabled(req);
    if (disabled) return disabled;
    headers[BILLING_HEADER] = DOMESTIC_COUNTRY;
    if (initiate) {
      // The application details go on; the routing fields were decided here and are not forwarded.
      const rest: Record<string, unknown> = { ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}) };
      delete rest.billing_country;
      delete rest.currency;
      delete rest.provider;
      forward = rest;
    } else {
      forward = {}; // the order is built upstream from the request; nothing from the browser is passed on
    }
  }

  const up = await backendFetch(target, { method: 'POST', headers, body: JSON.stringify(forward) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json(
      { error: errorMessage(data, 'Could not process your request.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json(data);
}
