// §5 — Admin-configurable platform settings (teacher offer response window).
// Admin-only + CSRF via requireAdmin; forwards the signed-in admin actor to the
// isolated institutional engine.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { errorMessage } from '@/lib/server/bff';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => ({}));
  const hours = Number(body?.teacher_response_window_hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
    return NextResponse.json({ error: 'Enter a whole number of hours between 1 and 720.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch('/admin/settings', {
      method: 'PATCH', actor: institutionalActor(guard.user),
      body: { teacher_response_window_hours: hours },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not update.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
