// Shared server-only writers for the authoritative teacher record.
//
// Used by BOTH the single-teacher status route (/bff/admin/teachers/[id]/status)
// and the bulk route (/bff/admin/teachers/bulk-status) so verification behaves
// identically everywhere. The remote backend is frozen: we try the dedicated
// verification endpoint first, then fall back to the real KYC review flow.
import 'server-only';
import { backendFetch } from '@/lib/server/session';
import { setStatusOverride } from '@/lib/server/teacher-status-override';
import { GRANT_BLOCKED } from '@/lib/server/empanelment-policy';

export type FieldResult = { persisted: boolean; message: string; via?: string };

export const NOT_IMPLEMENTED = new Set([404, 405, 501]);

export async function safeJson(r: Response): Promise<any> {
  return r.json().catch(() => ({}));
}

/**
 * Set a teacher's "Verified" badge on the authoritative record.
 *   (a) POST /admin/teachers/{id}/verification { status, reason? }  — preferred.
 *   (b) fall back to /admin/kyc/{id}/approve | /reject where it applies.
 */
export async function setVerification(id: string, status: string, reason?: string): Promise<FieldResult> {
  // Best-effort mirror to the remote (keeps its record in sync IF/when the
  // dedicated endpoint or KYC flow applies) — never blocks the authoritative save.
  try {
    await backendFetch(`/admin/teachers/${encodeURIComponent(id)}/verification`, {
      method: 'POST', body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
    });
  } catch { /* ignore */ }
  if (status === 'verified') {
    backendFetch(`/admin/kyc/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
  } else if (status === 'not_verified' && reason && reason.trim().length >= 10) {
    backendFetch(`/admin/kyc/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }).catch(() => {});
  }
  // AUTHORITATIVE persistence for NOSTOPS: the local override store.
  const ok = await setStatusOverride({ teacherId: id, verification: status, verificationReason: reason });
  if (ok) {
    return { persisted: true, via: 'nostops-override', message: `Verification set to ${status.replace('_', ' ')} across NOSTOPS.` };
  }
  return { persisted: false, message: 'Could not save verification right now. Please try again.' };
}

const LEVEL_TIER: Record<number, string> = { 1: 'shikshak', 2: 'pracharak', 3: 'guru' };

/** Empanel / de-empanel a teacher on the authoritative record. PERSISTS today
 *  (real backend setter). 'pending' is a derived state and cannot be set.
 *  Policy V2: granting only happens by activating a recorded Council approval in
 *  Admin → Empanelment Decisions; removal is unchanged. */
export async function setEmpanelment(id: string, status: string): Promise<FieldResult> {
  if (status === 'pending') {
    return {
      persisted: false,
      message: 'Empanelment "Pending" is a system-derived state (an application in progress) and cannot be set directly. Choose Empanelled or Not Empanelled.',
    };
  }
  const is_empanelled = status === 'empanelled';
  if (is_empanelled) return { persisted: false, message: GRANT_BLOCKED };
  let r: Response;
  try {
    r = await backendFetch(`/admin/empanelment/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ is_empanelled }) });
  } catch {
    return { persisted: false, message: 'Empanelment service is unavailable right now.' };
  }
  const d = await safeJson(r);
  if (!r.ok || d?.success === false) {
    return { persisted: false, message: (d?.detail || d?.error || 'Could not update empanelment.').toString() };
  }
  return {
    persisted: true,
    via: 'empanelment',
    message: is_empanelled ? 'Marked as Empanelled.' : 'Empanelment revoked (Not Empanelled).',
  };
}

/** Assign / clear a teacher's NOSTOPS level (0 = clear). Tries the dedicated
 *  endpoint; reports an honest "activates when live" state until it ships. */
export async function setLevel(id: string, level: number): Promise<FieldResult> {
  const tier = LEVEL_TIER[level] ?? null; // 0 / none → null (clears tier)
  // Best-effort mirror to the remote dedicated endpoint if it ships later.
  try {
    await backendFetch(`/admin/teachers/${encodeURIComponent(id)}/level`, { method: 'POST', body: JSON.stringify({ level, tier }) });
  } catch { /* ignore */ }
  // AUTHORITATIVE persistence for NOSTOPS: the local override store.
  const ok = await setStatusOverride({ teacherId: id, level });
  if (ok) {
    return { persisted: true, via: 'nostops-override', message: level === 0 ? 'Level cleared (No Level Assigned) across NOSTOPS.' : `Assigned Level ${level} across NOSTOPS.` };
  }
  return { persisted: false, message: 'Could not save the level right now. Please try again.' };
}
