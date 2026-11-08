// Admin Error Monitor — mark an event group resolved / reopen it. Admin + CSRF.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { localAdminFetch } from '@/lib/server/local-admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status === 'resolved' ? 'resolved' : 'open';
  try {
    const up = await localAdminFetch(`/api/monitoring/events/${encodeURIComponent(id)}`, guard.user, { method: 'PATCH', body: JSON.stringify({ status }) });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not update.') }, { status: up.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Monitor unavailable.' }, { status: 504 });
  }
}
