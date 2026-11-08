import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireVerifiedTeacher } from '@/lib/server/teacher-guard';

// Update the teacher's 1:1 (premium) session config. Forwards to
// PUT /teachers/me/premium-session-config. The backend validates the rate
// against the teacher's tier and returns the applicable pricing rules.
export async function PUT(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const rate = Number(body?.rate_inr);
  if (!Number.isInteger(rate) || rate <= 0) {
    return NextResponse.json({ error: 'Enter a positive session rate (₹).' }, { status: 400 });
  }
  const enabled = !!body?.enabled;
  // SECURITY (Prompt 17/18): ENABLING paid 1:1 sessions is an earning action and must
  // satisfy the OPERATE gate server-side — the same authoritative rule as the Offerings
  // page/route — regardless of entry point (this route is also reachable from the open
  // Edit-profile screen). Saving while disabled (or just adjusting the rate) stays open.
  if (enabled) {
    const gate = await requireVerifiedTeacher();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const payload = {
    enabled,
    rate_inr: rate,
    duration_minutes: Number.isInteger(body?.duration_minutes) ? body.duration_minutes : 60,
  };
  const up = await backendFetch('/teachers/me/premium-session-config', { method: 'PUT', body: JSON.stringify(payload) });
  if (!up.ok) {
    const d = await up.json().catch(() => null);
    return NextResponse.json({ error: toErrorText(d?.detail || d?.message, 'Could not save your 1:1 rate.') }, { status: up.status || 502 });
  }
  const d = await up.json().catch(() => ({}));
  return NextResponse.json({ ok: true, premium_session: d?.premium_session ?? payload });
}
