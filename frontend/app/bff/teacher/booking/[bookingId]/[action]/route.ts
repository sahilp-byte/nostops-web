import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireVerifiedTeacher } from '@/lib/server/teacher-guard';

// Teacher actions on a 1:1 booking (#31). CSRF-guarded, whitelisted proxy.
// Actions: teacher-action (accept | decline) · complete · reassign.
// The backend owns escrow release, refunds and every state transition.
type Built = { path: string; body: Record<string, unknown> } | { error: string };

function build(action: string, raw: any): Built {
  switch (action) {
    case 'teacher-action': {
      const decision = raw?.action === 'decline' ? 'decline' : raw?.action === 'accept' ? 'accept' : '';
      if (!decision) return { error: 'Choose accept or decline.' };
      const txn = String(raw?.confirmed_txn_id ?? '').trim();
      const body: Record<string, unknown> = { action: decision, confirmed_txn_id: txn };
      if (decision === 'decline') {
        const reason = String(raw?.decline_reason ?? '').trim();
        if (reason.length < 3) return { error: 'Please add a short reason for declining.' };
        body.decline_reason = reason.slice(0, 400);
      }
      return { path: '', body };
    }
    case 'complete':
      return { path: '/complete', body: { side: 'teacher' } };
    case 'reassign': {
      const handle = String(raw?.new_teacher_handle ?? '').trim();
      if (!handle) return { error: 'Choose a teacher to reassign to.' };
      return { path: '/reassign', body: { new_teacher_handle: handle } };
    }
    default:
      return { error: 'unknown action' };
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireVerifiedTeacher();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { bookingId, action } = await params;
  if (!bookingId) return NextResponse.json({ error: 'missing booking id' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const built = build(action, raw);
  if ('error' in built) {
    return NextResponse.json({ error: built.error }, { status: built.error === 'unknown action' ? 404 : 400 });
  }

  const suffix = action === 'teacher-action' ? '/teacher-action' : built.path;
  const up = await backendFetch(`/one-on-one/booking/${bookingId}${suffix}`, {
    method: 'POST',
    body: JSON.stringify(built.body),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Request could not be completed.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
