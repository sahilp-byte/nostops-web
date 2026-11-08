import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';

// Server-only client for the LOCAL City Coordinator application store
// (/api/coordinator/*). Used to persist a warm on-platform confirmation after
// an eligible teacher tells us they've submitted the external Jotform.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 12000;

async function actorHeaders(): Promise<Record<string, string> | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const userId = String(user.user_id || user.email || '');
  const x = Buffer.from(
    JSON.stringify({ user_id: userId, name: user.name || user.email || '', role: normalizeRole(user.role) }),
    'utf8',
  ).toString('base64');
  return { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': x };
}

export async function getCoordinatorApplied(): Promise<{ applied: boolean; appliedAt?: number }> {
  const headers = await actorHeaders();
  if (!headers) return { applied: false };
  try {
    const r = await fetch(`${BASE}/api/coordinator/applied`, { headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return { applied: false };
    const d = await r.json().catch(() => null);
    return { applied: !!d?.applied, appliedAt: typeof d?.applied_at === 'number' ? d.applied_at : undefined };
  } catch {
    return { applied: false };
  }
}

export async function recordCoordinatorApplied(): Promise<{ ok: boolean; appliedAt?: number }> {
  const headers = await actorHeaders();
  if (!headers) return { ok: false };
  try {
    const r = await fetch(`${BASE}/api/coordinator/applied`, {
      method: 'POST', headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json().catch(() => null);
    return { ok: true, appliedAt: typeof d?.applied_at === 'number' ? d.applied_at : undefined };
  } catch {
    return { ok: false };
  }
}
