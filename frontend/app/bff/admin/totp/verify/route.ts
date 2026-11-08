import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// TOTP verify/disable share one handler shape. CSRF-guarded + admin-only.
// Only a strict 6-digit code (or an 11-char backup code) is forwarded.
function bodyRoute(backendPath: string) {
  return async function POST(req: NextRequest) {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.res;

    const raw = await req.json().catch(() => ({}));
    const code = typeof raw?.code === 'string' ? raw.code.trim().toUpperCase().replace(/\s+/g, '') : '';
    // 6-digit TOTP or a backup code like ABCDE-FGHIJ.
    if (!/^\d{6}$/.test(code) && !/^[A-Z0-9]{4,6}-?[A-Z0-9]{4,6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: 'Enter the 6-digit code from your authenticator.' }, { status: 400 });
    }

    let up: Response;
    try {
      up = await backendFetch(backendPath, { method: 'POST', body: JSON.stringify({ code }) });
    } catch {
      return NextResponse.json({ ok: false, error: '2FA service is unavailable right now.' }, { status: 502 });
    }
    const data = await up.json().catch(() => ({}));
    if (!up.ok || data?.ok === false || data?.success === false) {
      return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'That code was not accepted.') }, { status: up.status || 400 });
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export const POST = bodyRoute('/admin/totp/verify');
