import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { normalizeRole, type User } from '@/lib/roles';

// Server-only access to the LOCAL backend's admin-only routes (org enquiries,
// error monitor). The admin identity header is built from the httpOnly session,
// never from client input; the backend re-checks role=admin on every route.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export function actorHeader(user: User): string {
  const actor = {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || 'Admin',
    role: normalizeRole(user.role),
  };
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

export async function localAdminFetch(path: string, user: User, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Pulse-Secret': SECRET, ...testTagHeaders(),
      'X-Pulse-User': actorHeader(user),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
}
