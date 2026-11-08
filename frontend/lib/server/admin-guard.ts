// Web defense-in-depth Admin authorization (server-only).
//
// The web Admin Console is a SECOND front-end to the existing NOSTOPS admin
// backend — the backend remains the authoritative authority. Independently of
// that, the web MUST enforce its own admin gate so it can never weaken security:
//   • Every /app/admin/* page  → requireAdminUser() (redirects non-admins).
//   • Every /bff/admin/*  proxy → requireAdmin(req)  (401/403 JSON; + CSRF).
// The BFF must NEVER be an open relay: a non-admin cannot reach a backend admin
// endpoint by hand-crafting a BFF URL. Role is resolved server-side from the
// httpOnly session (never from client input).
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole, type User } from '@/lib/roles';

// NOTE: `res` and `user` are declared on BOTH variants (optional on the opposite
// branch) so consumers can read `guard.res` / `guard.user` directly. The project
// compiles with `strict: false` (strictNullChecks off), under which TS does not
// narrow a `{ok:true}|{ok:false}` union on `if (!guard.ok)`. Keeping both keys
// present avoids relying on that narrowing while staying runtime-correct.
export type AdminGuard = { ok: true; user: User; res?: NextResponse } | { ok: false; res: NextResponse; user?: User };

/**
 * BFF admin gate. Returns the admin `user` on success, or a ready-to-return
 * NextResponse (401/403) on failure. CSRF (origin) is enforced by default for
 * state-changing requests; pass { csrf: false } for pure GET proxies.
 */
export async function requireAdmin(req: NextRequest, opts: { csrf?: boolean } = {}): Promise<AdminGuard> {
  const csrf = opts.csrf ?? true;
  if (csrf && badOrigin(req)) {
    return { ok: false, res: NextResponse.json({ error: 'invalid origin' }, { status: 403 }) };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (normalizeRole(user.role) !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Administrators only.' }, { status: 403 }) };
  }
  return { ok: true, user };
}

/**
 * RSC/page + layout admin gate. Redirects unauthenticated → /login and
 * authenticated non-admins → /app. Returns the admin user on success.
 */
export async function requireAdminUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'admin') redirect('/app');
  return user;
}
