import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireVerifiedTeacher } from '@/lib/server/teacher-guard';

// Accept the City Coordinator agreement → self-assign (idempotent for existing
// coordinators). Forwards to POST /coordinators/assign-me. CSRF-guarded.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireVerifiedTeacher();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const up = await backendFetch('/coordinators/assign-me', { method: 'POST', body: JSON.stringify({}) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail || data?.reason, 'Could not activate your coordinator role.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, coordinator: data.coordinator ?? null, reason: data.reason ?? null });
}
