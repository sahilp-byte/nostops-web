import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { refreshTeacherStatus, spCall, spError } from '@/lib/server/space-programmes';
import { srCall, srError } from '@/lib/server/space-registrations';

// Phase 5B — submit (teacher), publish (teacher), owner-decision (Space owner), admin-decision (admin + reason).
const ACTIONS = new Set(['submit', 'publish', 'owner-decision', 'admin-decision', 'pricing', 'registration']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const raw = await req.json().catch(() => ({}));
  if (action === 'pricing' || action === 'registration') {
    // Phase 6 — participant fee (creator only) and registration open/close (creator or admin).
    const b = action === 'pricing'
      ? { mode: raw.mode === 'PAID' ? 'PAID' : 'FREE', ...(raw.mode === 'PAID' ? { fee_inr: Number(raw.fee_inr) } : {}) }
      : { open: raw.open === true, reason: raw.reason ? String(raw.reason).slice(0, 1000) : undefined };
    const r = await srCall(`/programmes/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: b });
    if (r.status !== 200) return NextResponse.json({ error: srError(r.data?.detail, 'Could not save that change.') }, { status: r.status });
    return NextResponse.json(r.data);
  }
  let body: Record<string, string> | undefined;
  if (action === 'owner-decision') body = { decision: String(raw.decision || ''), note: String(raw.note || '').slice(0, 1000) };
  if (action === 'admin-decision') body = { decision: String(raw.decision || ''), reason: String(raw.reason || '').slice(0, 1000) };
  if (action === 'publish') {
    const st = await refreshTeacherStatus();
    if (!st.ok) return NextResponse.json({ error: st.error }, { status: st.status });
  }
  const r = await spCall(`/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: body ?? {} });
  if (r.status !== 200) return NextResponse.json({ error: spError(r.data?.detail, 'Could not complete that action.') }, { status: r.status });
  return NextResponse.json(r.data);
}
