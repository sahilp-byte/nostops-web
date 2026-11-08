// Admin Error Monitor proxy — list events (GET). Admin-gated; never an open relay.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { localAdminFetch } from '@/lib/server/local-admin';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const src = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  const status = src.get('status') || 'open';
  if (['open', 'resolved', 'all'].includes(status)) qs.set('status', status);
  const kind = src.get('kind') || '';
  if (['page', 'server', 'payment', 'email'].includes(kind)) qs.set('kind', kind);
  try {
    const up = await localAdminFetch(`/api/monitoring/events?${qs}`, guard.user);
    return NextResponse.json(await up.json().catch(() => ({})), { status: up.status });
  } catch {
    return NextResponse.json({ error: 'Monitor unavailable.' }, { status: 504 });
  }
}
