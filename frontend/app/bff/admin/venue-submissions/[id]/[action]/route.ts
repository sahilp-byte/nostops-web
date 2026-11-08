import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { actLocalSubmission } from '@/lib/server/venue-submissions-local';
import { growthOrigin } from '@/lib/server/venue-growth';

// Admin venue-submission moderation (PROMPT 21/22). CSRF-guarded + admin-only.
// Proxies to the intended backend contract POST /admin/venue-submissions/{id}/{action}.
// When that endpoint isn't live yet, returns an honest 501 the UI surfaces —
// no fake success.
const ALLOWED = new Set(['approve', 'approve-publish', 'reject', 'request-info', 'mark-duplicate', 'archive', 'publish', 'unpublish', 'hide']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { id, action } = await params;
  if (!id) return NextResponse.json({ error: 'Unknown submission.' }, { status: 404 });
  if (!ALLOWED.has(action)) return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.slice(0, 2000) : undefined;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 2000) : undefined;
  // Public origin for the owner's emailed links (edit + toolkit). req.url carries an internal host here.
  const site_base = growthOrigin(req.headers);

  let up: Response;
  try {
    up = await backendFetch(`/admin/venue-submissions/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ ...(note ? { note } : {}), ...(reason ? { reason } : {}), site_base }),
    });
  } catch {
    return NextResponse.json({ error: 'Moderation service is unavailable right now.' }, { status: 502 });
  }

  if (up.status === 404) {
    // Remote moderation contract isn't live — fall back to the LOCAL store,
    // which holds the mirrored owner-created venues. If the id isn't there
    // either, surface the honest "not live yet" message.
    const local = await actLocalSubmission(id, action, { note, reason, site_base });
    if (local.ok) return NextResponse.json({ ok: true });
    if (local.status && local.status !== 404) {
      return NextResponse.json({ error: local.error || 'Could not complete this action.' }, { status: local.status });
    }
    return NextResponse.json(
      { error: 'The venue moderation API is not live yet. This action will work automatically once the backend ships it.' },
      { status: 501 },
    );
  }

  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail || data?.error, 'Could not complete this action.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, ...data });
}
