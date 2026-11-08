import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Admin TOTP status (auth). Admin-only GET (no CSRF for a read). Never cached.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;

  let up: Response;
  try {
    up = await backendFetch('/admin/totp/status');
  } catch {
    return NextResponse.json({ ok: false, error: '2FA service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok) return NextResponse.json({ ok: false, error: toErrorText(data?.detail, 'Could not read 2FA status.') }, { status: up.status || 502 });
  return NextResponse.json({ ok: true, status: data }, { headers: { 'Cache-Control': 'no-store' } });
}
