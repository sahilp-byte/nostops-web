import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Interviewer assign/revoke (PHASE 9). CSRF-guarded + admin-only.
//   POST /api/admin/empanelment/interviewers/{handle}/{assign|revoke}  { note? }
const ACTIONS = new Set(['assign', 'revoke']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ handle: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { handle, action } = await params;
  if (!handle || !ACTIONS.has(action)) return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const body = { note: typeof raw?.note === 'string' ? raw.note.slice(0, 400) : '' };

  let up: Response;
  try {
    up = await backendFetch(`/admin/empanelment/interviewers/${encodeURIComponent(handle)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Interviewer service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not complete the action.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/interviewers');
  return NextResponse.json({ ok: true });
}
