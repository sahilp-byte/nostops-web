// Admin Error Monitor — send a test alert email right now. Admin + CSRF.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { localAdminFetch } from '@/lib/server/local-admin';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  try {
    const up = await localAdminFetch('/api/monitoring/test-alert', guard.user, { method: 'POST', body: '{}' });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not send the test alert.') }, { status: up.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Monitor unavailable.' }, { status: 504 });
  }
}
