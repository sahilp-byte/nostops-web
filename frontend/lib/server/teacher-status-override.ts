import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';

// NOSTOPS-local override for teacher Verification & Level. The frozen remote
// backend exposes no setter for is_verified / tier, so the admin's decision is
// persisted in the local FastAPI + Mongo (via /api/audit/*-override) and merged
// onto the RAW remote teacher record here — BEFORE projection — so every NOSTOPS
// surface (admin, public profile, directory) reflects it. READ needs only the
// server-only shared secret (works for anonymous public pages); WRITE is admin.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 6000;

export type StatusOverride = {
  teacher_id: string;
  verification_status?: 'verified' | 'pending' | 'not_verified';
  is_verified?: boolean;
  verification_reason?: string;
  level?: number;
  tier?: string | null;
  badge_primary?: string | null;
  updated_by_name?: string;
  updated_at?: number;
};

function headers(extra?: Record<string, string>) {
  return { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), ...(extra || {}) };
}

export async function setStatusOverride(patch: {
  teacherId: string; verification?: string; verificationReason?: string; level?: number;
}): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  const actor = Buffer.from(
    JSON.stringify({ user_id: String(user.user_id || user.email || ''), name: (user.name || user.email || '') as string, role: normalizeRole(user.role) }),
    'utf8',
  ).toString('base64');
  const body: Record<string, unknown> = { teacher_id: patch.teacherId };
  if (patch.verification) body.verification = patch.verification;
  if (patch.verificationReason) body.verification_reason = patch.verificationReason;
  if (patch.level !== undefined) body.level = patch.level;
  try {
    const r = await fetch(`${BASE}/api/audit/admin/teacher-status-override`, {
      method: 'POST',
      headers: headers({ 'X-Pulse-User': actor, 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function getStatusOverride(id: string): Promise<StatusOverride | null> {
  if (!id) return null;
  try {
    const r = await fetch(`${BASE}/api/audit/teacher-status-override/${encodeURIComponent(id)}`, {
      headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d?.override || null;
  } catch {
    return null;
  }
}

export async function getStatusOverrides(ids: string[]): Promise<Record<string, StatusOverride>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return {};
  try {
    const r = await fetch(`${BASE}/api/audit/teacher-status-override-bulk`, {
      method: 'POST', headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids: uniq }), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return {};
    const d = await r.json().catch(() => null);
    return d?.overrides && typeof d.overrides === 'object' ? d.overrides : {};
  } catch {
    return {};
  }
}

/** Merge an override onto a RAW remote teacher record (shallow copy). */
export function applyOverrideToRaw<T extends Record<string, any>>(raw: T, ov?: StatusOverride | null): T {
  if (!raw || !ov) return raw;
  const out: any = { ...raw };
  if (ov.verification_status) {
    out.verification_status = ov.verification_status;
    out.is_verified = ov.verification_status === 'verified';
  }
  if (ov.level !== undefined && ov.level !== null) {
    out.tier = ov.tier ?? null;
    out.badge_primary = ov.badge_primary ?? null;
    out.badges = ov.badge_primary ? [ov.badge_primary] : [];
    out.level = ov.level;
  }
  return out;
}

/** Fetch + merge overrides for a list of raw teacher records (fail-open). */
export async function mergeOverrides<T extends Record<string, any>>(list: T[], idField = 'teacher_id'): Promise<T[]> {
  if (!Array.isArray(list) || list.length === 0) return list;
  const map = await getStatusOverrides(list.map((t) => String(t?.[idField] || '')));
  if (Object.keys(map).length === 0) return list;
  return list.map((t) => applyOverrideToRaw(t, map[String(t?.[idField] || '')]));
}
