import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Disable admin TOTP 2FA (auth). CSRF-guarded + admin-only. Requires a current
// authenticator code.  POST /api/admin/totp/disable { code }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const raw = await req.json().catch(() => ({}));
  const code = typeof raw?.code === 'string' ? raw.code.trim().toUpperCase().replace(/\s+/g, '') : '';
  if (!/^\d{6}$/.test(code) && !/^[A-Z0-9]{4,6}-?[A-Z0-9]{4,6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: 'Enter the 6-digit code from your authenticator.' }, { status: 400 });
  }

  let up: Response;
  try {
    up = await backendFetch('/admin/totp/disable', { method: 'POST', body: JSON.stringify({ code }) });
  } catch {
    return NextResponse.json({ ok: false, error: '2FA service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.ok === false || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'That code was not accepted.') }, { status: up.status || 400 });
  }
  revalidatePath('/app/admin/security');
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
