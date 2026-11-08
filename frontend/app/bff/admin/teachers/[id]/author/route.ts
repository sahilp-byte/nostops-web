import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { setAuthorFlag } from '@/lib/server/voices';
import { revalidatePath } from 'next/cache';

// Admin toggle: enable/disable a teacher as a NOSTOPS Author. CSRF-guarded +
// strictly admin-only. Persists in the isolated local Voices store.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Unknown teacher.' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing enabled flag.' }, { status: 400 });
  }
  const ok = await setAuthorFlag(id, body.enabled);
  if (!ok) return NextResponse.json({ error: 'Could not save right now. Please try again.' }, { status: 502 });
  revalidatePath(`/app/admin/teachers/${id}`);
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
