import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// People Manager moderation proxy (PHASE 4). CSRF-guarded + admin-only.
//   POST /api/admin/people/{teachers|council}/{id}/suspend  { days, reason }
//   POST /api/admin/people/{teachers|council}/{id}/reinstate
const KINDS = new Set(['teachers', 'council']);
const ACTIONS = new Set(['suspend', 'reinstate']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { kind, id, action } = await params;
  if (!KINDS.has(kind) || !ACTIONS.has(action) || !id) {
    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  let body: Record<string, unknown> = {};
  if (action === 'suspend') {
    const days = Number(raw?.days);
    if (!Number.isFinite(days) || days < 1) return NextResponse.json({ ok: false, error: 'A valid suspension length (days) is required.' }, { status: 400 });
    body = { days: Math.round(days), reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 400) : '' };
  }

  let up: Response;
  try {
    up = await backendFetch(`/admin/people/${kind}/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'People service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not complete the action.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/people');
  return NextResponse.json({ ok: true });
}
