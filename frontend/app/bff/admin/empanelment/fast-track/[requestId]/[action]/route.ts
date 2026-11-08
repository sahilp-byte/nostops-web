import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { checkFastTrackDecision, reportFastTrackResult } from '@/lib/server/empanelment-policy';

// Admin fast-track pipeline actions (PHASE 3). CSRF-guarded + admin-only.
// Whitelisted proxy to POST /api/empanelment/fast-track/{request_id}/{action}.
const ALLOWED = new Set(['schedule', 'decide', 'claim']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { requestId, action } = await params;
  if (!requestId || !ALLOWED.has(action)) return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  let body: Record<string, unknown> = {};
  let policyCaseId: string | null = null;
  if (action === 'schedule') {
    const scheduledAt = typeof raw?.scheduled_at === 'string' ? raw.scheduled_at : '';
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) return NextResponse.json({ ok: false, error: 'A valid interview date & time is required.' }, { status: 400 });
    body = {
      scheduled_at: scheduledAt,
      meeting_link: typeof raw?.meeting_link === 'string' ? raw.meeting_link.slice(0, 500) : '',
      notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 1000) : '',
    };
  } else if (action === 'decide') {
    // Policy V2 gate (admins are authorised decision makers): interview held + note + confirmation.
    // An approval is recorded only; it is activated separately in Empanelment Decisions.
    const check = await checkFastTrackDecision(guard.user, requestId, raw);
    if ('error' in check) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
    if (!check.forward) {
      revalidatePath('/app/admin/empanelment/decisions');
      return NextResponse.json({ ok: true, pendingActivation: true });
    }
    policyCaseId = check.caseId;
    body = check.forward;
  }

  let up: Response;
  try {
    up = await backendFetch(`/empanelment/fast-track/${encodeURIComponent(requestId)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    if (policyCaseId) await reportFastTrackResult(guard.user, policyCaseId, false, 'main backend unreachable');
    return NextResponse.json({ ok: false, error: 'Service unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (policyCaseId) await reportFastTrackResult(guard.user, policyCaseId, up.ok, up.ok ? '' : String(data?.detail || up.status));
  if (!up.ok) return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.reason, 'Action could not be completed.') }, { status: up.status || 502 });

  revalidatePath('/app/admin/empanelment/fast-track');
  revalidatePath('/app/admin/empanelment');
  return NextResponse.json({ ok: true });
}
