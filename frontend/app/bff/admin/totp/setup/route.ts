import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Begin/continue TOTP enrollment (auth). CSRF-guarded + admin-only. Returns the
// provisioning URI + secret + one-time backup codes straight from the backend.
// This provisioning data is returned only to the enrolling admin's own browser
// and is never logged or persisted by the web.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  let up: Response;
  try {
    up = await backendFetch('/admin/totp/setup', { method: 'POST', body: JSON.stringify({}) });
  } catch {
    return NextResponse.json({ ok: false, error: '2FA service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.ok === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not start 2FA setup.') }, { status: up.status || 502 });
  }
  return NextResponse.json(
    {
      ok: true,
      provisioningUri: typeof data.provisioning_uri === 'string' ? data.provisioning_uri : '',
      secret: typeof data.secret === 'string' ? data.secret : '',
      backupCodes: Array.isArray(data.backup_codes) ? data.backup_codes.filter((c: unknown) => typeof c === 'string') : [],
      warning: typeof data.warning === 'string' ? data.warning : '',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
