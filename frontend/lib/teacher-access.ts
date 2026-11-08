// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 14 — CENTRAL teacher feature-eligibility engine (ONE source of truth).
//
//   Teacher
//     → Verification status  ─┐
//     → Empanelment status   ─┤ (authoritative, from lib/teacher-status.deriveTeacherStatus)
//     → Teacher Level        ─┘
//     → Feature eligibility  ── FEATURE_RULES + canAccessFeature()  ← THIS FILE
//     → Actual access        ── page guard (guardTeacherFeature) + BFF guard (requireFeatureAccess)
//
// This module is PURE (no server imports) so both the client and the server import
// the same rules. It never reads the request/session itself — the caller supplies an
// AccessContext built SERVER-SIDE from the authenticated teacher's authoritative record
// (see lib/server/teacher-access.ts). No feature check is hard-coded in a page anymore;
// they all route through canAccessFeature().
// ─────────────────────────────────────────────────────────────────────────────
import type { TeacherStatus } from '@/lib/teacher-status';
import { instaKycPriceLabel } from './pricing.ts';

export type TeacherFeature =
  // Open to any onboarded teacher
  | 'dashboard'
  | 'profile'
  | 'kyc'
  | 'empanelment'
  | 'mentor'
  // Earning / operating — require the OPERATE gate (canOperate)
  | 'offerings'
  | 'bookings'
  | 'wallet'
  | 'refer'
  | 'sessions'
  | 'widgets'
  | 'coordinator'
  // Hosting — require backend host-eligibility (L2+)
  | 'retreat_hosting'
  | 'venue_studio';

export type FeatureRule = {
  label: string;
  requiresOnboarded: boolean;
  requiresOperate: boolean; // strict KYC composite AND admin is_verified AND empanelled (D2-bis = C)
  requiresHostEligible: boolean; // backend /retreats/host-eligibility
  teacherOnly?: boolean; // gate applies ONLY to role==='teacher' (coordinator/admin pass to backend authz)
  deniedRedirect: (label: string) => string;
};

const LOCKED = (label: string) => `/app/teacher/locked?feature=${encodeURIComponent(label)}`;

// The ONE registry of teacher features and their eligibility requirements.
export const FEATURE_RULES: Record<TeacherFeature, FeatureRule> = {
  dashboard: { label: 'Dashboard', requiresOnboarded: false, requiresOperate: false, requiresHostEligible: false, deniedRedirect: () => '/app' },
  profile: { label: 'Profile', requiresOnboarded: true, requiresOperate: false, requiresHostEligible: false, deniedRedirect: () => '/app' },
  kyc: { label: 'InstaKYC', requiresOnboarded: true, requiresOperate: false, requiresHostEligible: false, deniedRedirect: () => '/app' },
  empanelment: { label: 'Empanelment', requiresOnboarded: true, requiresOperate: false, requiresHostEligible: false, deniedRedirect: () => '/app' },
  mentor: { label: 'My Mentor', requiresOnboarded: true, requiresOperate: false, requiresHostEligible: false, deniedRedirect: () => '/app' },

  offerings: { label: 'Offerings', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, deniedRedirect: LOCKED },
  bookings: { label: 'Bookings', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, deniedRedirect: LOCKED },
  wallet: { label: 'Wallet', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, deniedRedirect: LOCKED },
  refer: { label: 'Refer & Earn', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, deniedRedirect: LOCKED },
  sessions: { label: 'Sessions', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, deniedRedirect: LOCKED },
  widgets: { label: 'My Widgets', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, deniedRedirect: LOCKED },
  coordinator: { label: 'City Coordinator', requiresOnboarded: true, requiresOperate: true, requiresHostEligible: false, teacherOnly: true, deniedRedirect: LOCKED },

  retreat_hosting: { label: 'Retreat hosting', requiresOnboarded: false, requiresOperate: false, requiresHostEligible: true, deniedRedirect: () => '/app/teacher/retreats' },
  venue_studio: { label: 'Venue Studio', requiresOnboarded: false, requiresOperate: false, requiresHostEligible: true, deniedRedirect: () => '/app/venue' },
};

export const HOST_FEATURES: readonly TeacherFeature[] = ['retreat_hosting', 'venue_studio'];

// The authoritative eligibility snapshot — built SERVER-SIDE only (never from client input).
export type AccessContext = {
  authenticated: boolean;
  role: string; // normalized role of the authenticated user
  onboarded: boolean;
  status: TeacherStatus | null; // null when the user is not an onboarded teacher
  hostEligible: boolean; // backend host-eligibility (only fetched for host features)
};

export type AccessDecision = { allowed: boolean; reason?: string; redirect?: string };

/**
 * THE single authorization decision for any teacher feature. Pure function of the
 * server-built context + the feature registry. Returns where to redirect (pages) and
 * a human reason (BFF error) when denied.
 */
export function canAccessFeature(ctx: AccessContext, feature: TeacherFeature): AccessDecision {
  const rule = FEATURE_RULES[feature];

  if (!ctx.authenticated) return { allowed: false, reason: 'Sign in required.', redirect: '/login' };

  const isTeacher = ctx.role === 'teacher';

  // ── Level 3 (Yoga Guru) — FULL ACCESS ────────────────────────────────────────
  // Owner rule: an L3 teacher's dashboard has every feature unlocked. The LEVEL is
  // authoritative (backend `tier`/badge → deriveTeacherStatus), so this only maps
  // that backend level to full menu/page/API access on the web — it invents no new
  // privilege and each backend API still applies its own authorization.
  // Owner decision (Phase B1 pre-publish): the ID check still applies to Level 3 —
  // OPERATE features (wallet, offerings, bookings, coordinator, …) need canOperate,
  // exactly as the BFF guard (teacher-guard.ts) enforces, so UI and API agree.
  if (isTeacher && ctx.status?.level === 3) {
    if (rule.requiresOperate && !ctx.status.canOperate) {
      return {
        allowed: false,
        reason: `Complete verification (InstaKYC + ${instaKycPriceLabel()} payment) and empanelment to use this.`,
        redirect: rule.deniedRedirect(rule.label),
      };
    }
    return { allowed: true };
  }

  // teacherOnly features (e.g. City Coordinator): a non-teacher role passes here so its
  // OWN backend authorization applies — mirrors the existing page guards.
  if (rule.teacherOnly && !isTeacher) return { allowed: true };

  // Non-host teacher features are teacher-only; a non-teacher lands on the dashboard.
  if (!rule.requiresHostEligible && !isTeacher) return { allowed: false, reason: 'Teachers only.', redirect: '/app' };

  if (rule.requiresOnboarded && !ctx.onboarded) {
    return { allowed: false, reason: 'Complete teacher onboarding first.', redirect: '/app/teacher/onboarding' };
  }
  if (rule.requiresHostEligible && !ctx.hostEligible) {
    return { allowed: false, reason: 'Host-eligible teachers (Level 2+) only.', redirect: rule.deniedRedirect(rule.label) };
  }
  if (rule.requiresOperate && !ctx.status?.canOperate) {
    return {
      allowed: false,
      reason: `Complete verification (InstaKYC + ${instaKycPriceLabel()} payment) and empanelment to use this.`,
      redirect: rule.deniedRedirect(rule.label),
    };
  }
  return { allowed: true };
}

// The three eligibility "buckets" a feature falls into — used by summaries so a
// reviewer can see WHY a feature is open or locked, not just whether.
export type FeatureCategory = 'always' | 'operate' | 'host';

export function featureCategory(feature: TeacherFeature): FeatureCategory {
  const rule = FEATURE_RULES[feature];
  return rule.requiresHostEligible ? 'host' : rule.requiresOperate ? 'operate' : 'always';
}

export type FeatureAccessSummary = {
  feature: TeacherFeature;
  label: string;
  category: FeatureCategory;
  allowed: boolean;
  reason?: string;
};

/**
 * A whole-account snapshot: run EVERY feature through the same canAccessFeature
 * decision for a server-built context. This is the ONE way to render an
 * "accessible vs locked" list so those lists can never drift from the real gate
 * (menu, page guard and API guard all read the identical engine).
 */
export function summarizeFeatureAccess(ctx: AccessContext): FeatureAccessSummary[] {
  // City Coordinator is temporarily deactivated (Phase 1) — hidden from the teacher access summary.
  return (Object.keys(FEATURE_RULES) as TeacherFeature[]).filter((f) => f !== 'coordinator').map((feature) => {
    const decision = canAccessFeature(ctx, feature);
    return { feature, label: FEATURE_RULES[feature].label, category: featureCategory(feature), allowed: decision.allowed, reason: decision.reason };
  });
}
