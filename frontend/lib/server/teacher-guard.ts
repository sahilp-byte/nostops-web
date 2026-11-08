import { getTeacherAccessContext } from '@/lib/server/teacher-access';
import { instaKycPriceLabel } from '@/lib/pricing';

export type GuardResult = { ok: boolean; status: number; error: string };

// Server-side enforcement of the teacher OPERATE gate for state-changing BFF
// routes whose pages are verification-locked. Fixes the "locked in the UI but
// the API/route is still open" gap (ACCESS_CONTROL_GAPS.md D1): the same
// authoritative OPERATE rule (strict KYC composite + admin is_verified + empanelled —
// PRODUCT DECISION D2-bis = C) now holds at UI + route (+ backend). Only TEACHERS
// are subject to it — coordinator/admin pass through so their own backend
// authorization applies (mirrors the page guards).
//
// This delegates to the ONE authoritative engine (lib/teacher-access) so there is a
// single definition of "can this teacher operate". Kept as `requireVerifiedTeacher`
// for the routes that already import it; new routes may call `requireFeatureAccess`.
export async function requireVerifiedTeacher(): Promise<GuardResult> {
  const ctx = await getTeacherAccessContext();
  if (!ctx.authenticated) return { ok: false, status: 401, error: 'Sign in required.' };
  // Non-teachers (coordinator/admin) pass through to their own backend authorization.
  if (ctx.role !== 'teacher') return { ok: true, status: 200, error: '' };
  if (!ctx.onboarded) return { ok: false, status: 403, error: 'Complete teacher onboarding first.' };
  if (!ctx.status?.canOperate) {
    return { ok: false, status: 403, error: `Complete verification (InstaKYC + ${instaKycPriceLabel()} payment) and empanelment to use this.` };
  }
  return { ok: true, status: 200, error: '' };
}
