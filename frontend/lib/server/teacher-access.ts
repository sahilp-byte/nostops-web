import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { deriveTeacherStatus, type TeacherStatus } from '@/lib/teacher-status';
import { getHostEligibility } from '@/lib/server/retreat-host';
import { canAccessFeature, HOST_FEATURES, type AccessContext, type TeacherFeature } from '@/lib/teacher-access';

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 15 — the AUTHORITATIVE eligibility context is assembled SERVER-SIDE from
// the authenticated teacher's database record ONLY. The three status attributes
// (verification / empanelment / level) and the derived OPERATE gate come from
// `deriveTeacherStatus(self)` where `self` is read via a bearer token (attached
// server-side from the httpOnly session cookie) against /teachers/me/native-profile.
// NOTHING here is trusted from the client — not request body, query params, localStorage,
// client cookies, nor any user-supplied level/verification value.
// ─────────────────────────────────────────────────────────────────────────────

export async function getTeacherAccessContext(opts?: { needHostEligibility?: boolean }): Promise<AccessContext> {
  const user = await getSessionUser();
  const role = normalizeRole(user?.role);
  if (!user) return { authenticated: false, role, onboarded: false, status: null, hostEligible: false };

  const { onboarded, self } = await getTeacherSelfProfile();
  const status: TeacherStatus | null = self ? deriveTeacherStatus(self) : null;
  const hostEligible = opts?.needHostEligibility ? !!(await getHostEligibility()).eligible : false;
  return { authenticated: true, role, onboarded, status, hostEligible };
}

/** Page guard — returns a redirect path when the feature is denied, else null. */
export async function guardTeacherFeature(feature: TeacherFeature): Promise<string | null> {
  const ctx = await getTeacherAccessContext({ needHostEligibility: HOST_FEATURES.includes(feature) });
  const decision = canAccessFeature(ctx, feature);
  return decision.allowed ? null : decision.redirect ?? '/app';
}

/** Page guard convenience: redirect() immediately when denied. */
export async function enforceTeacherFeature(feature: TeacherFeature): Promise<void> {
  const to = await guardTeacherFeature(feature);
  if (to) redirect(to);
}

/** BFF guard — returns {ok,status,error} for a state-changing route behind a feature. */
export async function requireFeatureAccess(feature: TeacherFeature): Promise<{ ok: boolean; status: number; error: string }> {
  const ctx = await getTeacherAccessContext({ needHostEligibility: HOST_FEATURES.includes(feature) });
  const decision = canAccessFeature(ctx, feature);
  if (decision.allowed) return { ok: true, status: 200, error: '' };
  return { ok: false, status: ctx.authenticated ? 403 : 401, error: decision.reason ?? 'Not allowed.' };
}
