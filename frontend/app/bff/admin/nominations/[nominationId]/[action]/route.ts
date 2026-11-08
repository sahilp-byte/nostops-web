import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { nominationsFetch, relayNomination } from '@/lib/server/guru-nominations';

// Decisions on nominations made in the mobile app (main backend). CSRF-guarded + admin-only.
// Whitelisted proxy to POST /api/admin/council/nominations/{id}/{advance-to-guru|reject|request-info}.
// "archive" / "restore" never reach the main backend: they only hide the nomination from this
// website's queue (nothing is deleted — owner decision, soft delete only).
const ALLOWED = new Set(['advance-to-guru', 'reject', 'request-info', 'archive', 'restore']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ nominationId: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { nominationId, action } = await params;
  if (!nominationId || !ALLOWED.has(action)) return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  if (action === 'archive' || action === 'restore') {
    let local: Response;
    try {
      local = await nominationsFetch('/admin/app-archive', guard.user, {
        method: 'POST',
        body: JSON.stringify({ nomination_id: nominationId, action, reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 600) : '' }),
      });
    } catch {
      return NextResponse.json({ ok: false, error: 'Nominations are unavailable right now.' }, { status: 502 });
    }
    if (local.ok) revalidatePath('/app/admin/nominations');
    return relayNomination(local, 'Could not update the nomination.');
  }

  let body: Record<string, unknown> = {};
  if (action === 'request-info') {
    const question = typeof raw?.question === 'string' ? raw.question.trim() : '';
    if (question.length < 5) return NextResponse.json({ ok: false, error: 'Please type your question (at least 5 characters).' }, { status: 400 });
    body = { question: question.slice(0, 1200) };
  } else {
    // Never create a draft Council member from here: a Guru is published only after they agree
    // (owner decision), through the website nominations pipeline.
    body = { note: typeof raw?.note === 'string' ? raw.note.slice(0, 600) : '', create_draft_member: false };
  }

  let up: Response;
  try {
    up = await backendFetch(`/admin/council/nominations/${encodeURIComponent(nominationId)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Nominations service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not complete the action.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/nominations');
  return NextResponse.json({ ok: true });
}
