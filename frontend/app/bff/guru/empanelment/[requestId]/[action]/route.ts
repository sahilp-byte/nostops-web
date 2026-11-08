import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { checkFastTrackDecision, reportFastTrackResult } from '@/lib/server/empanelment-policy';

// Council empanelment-interview actions. Whitelisted, CSRF-guarded proxy to
// POST /empanelment/fast-track/{requestId}/{action}. Only claim | schedule |
// decide are allowed, and only whitelisted body fields are forwarded — the
// browser can never drive an arbitrary backend mutation through this route.
const ALLOWED = new Set(['claim', 'schedule', 'decide']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const { requestId, action } = await params;
  if (!ALLOWED.has(action) || !requestId) {
    return NextResponse.json({ error: 'unknown action' }, { status: 404 });
  }

  const raw = await req.json().catch(() => ({}));
  let body: Record<string, unknown> = {};
  let policyCaseId: string | null = null;
  if (action === 'schedule') {
    const scheduledAt = typeof raw?.scheduled_at === 'string' ? raw.scheduled_at : '';
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: 'A valid interview date & time is required.' }, { status: 400 });
    }
    body = {
      scheduled_at: scheduledAt,
      meeting_link: typeof raw?.meeting_link === 'string' ? raw.meeting_link.slice(0, 500) : '',
      notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 1000) : '',
    };
  } else if (action === 'decide') {
    // Policy V2 gate: approval needs the priority interview to have happened, a
    // written note and an explicit confirmation. Payment alone never approves.
    // An approval is NOT sent to the main backend: an admin activates it later.
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    const check = await checkFastTrackDecision(user, requestId, raw);
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
    if (!check.forward) return NextResponse.json({ ok: true, pendingActivation: true });
    policyCaseId = check.caseId;
    body = check.forward;
  }

  const up = await backendFetch(`/empanelment/fast-track/${encodeURIComponent(requestId)}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await up.json().catch(() => ({}));
  if (policyCaseId) {
    const user = await getSessionUser();
    if (user) await reportFastTrackResult(user, policyCaseId, up.ok, up.ok ? '' : String(data?.detail || up.status));
  }
  if (!up.ok) {
    return NextResponse.json(
      { error: toErrorText(data?.detail || data?.reason, 'Action could not be completed.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json({ ok: true, request: data.request ?? data ?? null });
}
