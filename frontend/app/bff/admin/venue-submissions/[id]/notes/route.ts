import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { noteLocalSubmission } from '@/lib/server/venue-submissions-local';

// Internal admin notes on a venue submission (PROMPT 29). CSRF-guarded + admin
// only. Remote-first (intended contract); on 404/unreachable it falls back to
// the LOCAL submissions store so notes persist today — flips to remote when it ships.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (!id || !text) return NextResponse.json({ error: 'A note is required.' }, { status: 400 });

  let up: Response | null = null;
  try {
    up = await backendFetch(`/admin/venue-submissions/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  } catch {
    up = null;
  }
  if (up && up.status !== 404) {
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail || data?.error, 'Could not save note.') }, { status: up.status || 502 });
    return NextResponse.json({ ok: true, ...data });
  }

  // Remote not live (404) or unreachable → local fallback store.
  const local = await noteLocalSubmission(id, text);
  if (!local.ok) return NextResponse.json({ error: local.error || 'Could not save note.' }, { status: local.status || 502 });
  return NextResponse.json({ ok: true, note: local.note });
}
