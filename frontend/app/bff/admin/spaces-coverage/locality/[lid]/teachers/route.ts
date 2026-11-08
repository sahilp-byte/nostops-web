import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { spacesCall, spacesError } from '@/lib/server/spaces';
import { getMainDirectoryTeacherIds } from '@/lib/server/admin-teachers';

// Phase 8B.1.7 — admin-only, read-only teachers of one locality (confirmed service localities only).
// Each admin profile link is checked against the main-backend teacher lists the admin teacher page uses;
// an unknown teacher keeps the name but gets no link and the note "Not found in main directory".
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ lid: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const { lid } = await params;
  const r = await spacesCall(`/coverage/locality/${encodeURIComponent(lid)}/teachers`);
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Teachers are unavailable right now.') }, { status: r.status || 502 });
  const main = await getMainDirectoryTeacherIds();
  const teachers = (r.data.teachers || []).map((t: any) => {
    if (!main.available) return { ...t, admin_link_status: 'unavailable', admin_link_note: 'Main teacher directory is unavailable right now.' };
    if (main.ids.has(t.teacher_id)) return { ...t, admin_link_status: 'found', admin_link_note: null };
    return { ...t, admin_path: null, admin_link_status: 'not_found', admin_link_note: 'Not found in main directory' };
  });
  return NextResponse.json({ ...r.data, teachers });
}
