import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Broadcast send (PHASE 10). CSRF-guarded + admin-only. The role check runs
// BEFORE body validation, so a non-admin can never send — closing the backend
// gap where /admin/broadcast returned 422 (not 403) for non-admins.
//   POST /api/admin/broadcast  { title, body, target_role?, link? }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const raw = await req.json().catch(() => ({}));
  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  const body = typeof raw?.body === 'string' ? raw.body.trim() : '';
  if (title.length < 3 || body.length < 3) {
    return NextResponse.json({ ok: false, error: 'A title and message are required.' }, { status: 400 });
  }

  const payload: Record<string, unknown> = { title: title.slice(0, 120), body: body.slice(0, 1000) };
  if (typeof raw?.target_role === 'string' && raw.target_role.trim()) payload.target_role = raw.target_role.trim();
  if (typeof raw?.link === 'string' && raw.link.trim()) payload.link = raw.link.trim().slice(0, 500);

  let up: Response;
  try {
    up = await backendFetch('/admin/broadcast', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Broadcast service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not send the broadcast.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/broadcast');
  return NextResponse.json({ ok: true, deliveredTo: Number(data?.delivered_to) || 0 });
}
