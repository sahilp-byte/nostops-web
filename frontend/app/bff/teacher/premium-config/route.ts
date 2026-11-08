import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireVerifiedTeacher } from '@/lib/server/teacher-guard';

// Configure the teacher's 1:1 premium-session offering. CSRF-guarded proxy to
// PUT /teachers/me/premium-session-config. Rate ₹1,500–5,000, duration 30–120.
export async function PUT(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireVerifiedTeacher();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const raw = await req.json().catch(() => ({}));
  const enabled = !!raw?.enabled;
  const rate = Math.floor(Number(raw?.rate_inr));
  const duration = Math.floor(Number(raw?.duration_minutes));

  // Basic sanity only — the backend is the source of truth for the teacher's
  // tier-based rate bounds and the profile/empanelment gate, and returns a
  // clear message we forward verbatim.
  if (enabled) {
    if (!Number.isFinite(rate) || rate < 100 || rate > 100000) {
      return NextResponse.json({ error: 'Enter a valid session rate.' }, { status: 400 });
    }
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      return NextResponse.json({ error: 'Duration must be between 15 and 240 minutes.' }, { status: 400 });
    }
  }

  const up = await backendFetch('/teachers/me/premium-session-config', {
    method: 'PUT',
    body: JSON.stringify({ enabled, rate_inr: rate || 1500, duration_minutes: duration || 60 }),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not save your offering.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, tier_rules: data?.tier_rules ?? null });
}
