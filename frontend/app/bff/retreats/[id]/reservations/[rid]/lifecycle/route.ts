import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// PROMPT 19 — host actions on a reservation's lifecycle. One route branches to
// the backend's dedicated endpoints. Host-only; CSRF double-submit enforced.
// - cohort-decision: approve | waitlist | decline (curated cohorts only)
// - mark-paid: record an off-platform payment
// - cancel / cancel-with-refund: release the seat (refund reverses benefits)
const DECISIONS = new Set(['approve', 'waitlist', 'decline']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { id, rid } = await params;
  const b = await req.json().catch(() => ({}));
  const action = String(b?.action || '');

  let path: string;
  let body: Record<string, unknown> = {};
  if (action === 'cohort-decision') {
    const decision = String(b?.decision || '');
    if (!DECISIONS.has(decision)) return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
    path = 'cohort-decision';
    body = { decision, ...(b?.reason ? { reason: String(b.reason).slice(0, 400) } : {}) };
  } else if (action === 'mark-paid') {
    path = 'mark-paid';
  } else if (action === 'cancel') {
    path = 'cancel';
  } else if (action === 'cancel-with-refund') {
    path = 'cancel-with-refund';
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const up = await backendFetch(`/retreats/${encodeURIComponent(id)}/reservations/${encodeURIComponent(rid)}/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray((d as any)?.detail) ? (d as any).detail[0]?.msg : (d as any)?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not complete that action.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
