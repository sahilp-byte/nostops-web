import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { publicHost } from '@/lib/server/payment-guard';
import { srCall, srError } from '@/lib/server/space-registrations';

// Phase 6 — register for a Space programme. Only the event, a contact phone (payment gateway) and the terms
// tick are forwarded; identity comes from the session and the amount from the server.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const body = {
    event_id: String(raw.event_id || '').slice(0, 64),
    phone: raw.phone ? String(raw.phone).slice(0, 20) : undefined,
    accept_terms: raw.accept_terms === true,
    origin_host: publicHost(req).slice(0, 200),
  };
  const r = await srCall('/register', { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: srError(r.data?.detail, 'Could not register. Please try again.') }, { status: r.status });
  return NextResponse.json(r.data);
}
