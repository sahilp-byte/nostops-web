import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badOrigin } from '@/lib/server/bff';
import { getTeacherSelfProfile } from '@/lib/server/teacher';

// After the owner edits their profile inline on the public page, purge the ISR
// cache for /teachers/{handle} so their changes appear on the next render.
// Ownership is enforced server-side (session handle MUST match the requested
// handle) so nobody can force-revalidate another teacher's page. CSRF-guarded.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === 'string' ? body.handle.trim() : '';
  if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 });

  const { onboarded, self } = await getTeacherSelfProfile();
  if (!onboarded || !self || self.handle !== handle) {
    return NextResponse.json({ error: 'not your profile' }, { status: 403 });
  }

  revalidatePath(`/teachers/${handle}`);
  return NextResponse.json({ ok: true });
}
