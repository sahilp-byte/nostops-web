// SPECIAL NEEDS — record / revoke a teacher's VERIFIED adaptive-practice
// competence (required before a Special Needs programme can be offered to them).
// Admin-only + CSRF via requireAdmin; forwards the admin actor to the engine.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { errorMessage } from '@/lib/server/bff';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.verified !== 'boolean') {
    return NextResponse.json({ error: 'verified must be true or false.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch(`/admin/teacher-directory/${encodeURIComponent(id)}/adaptive-practice`, {
      method: 'PATCH', actor: institutionalActor(guard.user),
      body: { verified: body.verified, note: typeof body.note === 'string' ? body.note.slice(0, 500) : undefined },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not update.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
