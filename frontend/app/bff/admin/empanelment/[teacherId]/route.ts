import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { GRANT_BLOCKED } from '@/lib/server/empanelment-policy';

// Admin empanel/revoke proxy (PHASE 3). CSRF-guarded + admin-only.
//   POST /api/admin/empanelment/{teacher_id}  { is_empanelled: boolean }
// Policy V2: this switch can only REMOVE empanelment. Granting happens only by
// activating a recorded Council approval in Admin → Empanelment Decisions.
export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { teacherId } = await params;
  if (!teacherId) return NextResponse.json({ ok: false, error: 'Unknown teacher.' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const is_empanelled = !!body?.is_empanelled;
  if (is_empanelled) return NextResponse.json({ ok: false, error: GRANT_BLOCKED }, { status: 409 });

  let up: Response;
  try {
    up = await backendFetch(`/admin/empanelment/${encodeURIComponent(teacherId)}`, {
      method: 'POST',
      body: JSON.stringify({ is_empanelled }),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Empanelment service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not update empanelment.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/empanelment');
  revalidatePath('/app/admin');
  return NextResponse.json({ ok: true, isEmpanelled: is_empanelled });
}
