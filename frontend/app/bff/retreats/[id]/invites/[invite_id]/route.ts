import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// PROMPT 18 — remove an invitee from the host's list. Host-only; CSRF enforced.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; invite_id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { id, invite_id } = await params;
  const up = await backendFetch(`/retreats/${encodeURIComponent(id)}/invites/${encodeURIComponent(invite_id)}`, { method: 'DELETE' });
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray((d as any)?.detail) ? (d as any).detail[0]?.msg : (d as any)?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not remove invitee.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
