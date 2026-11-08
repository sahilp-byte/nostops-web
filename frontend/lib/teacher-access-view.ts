// PURE display-state engine for the "Your NOSTOPS Access" card (extracted from
// TeacherAccessCard.tsx). It translates the AUTHORITATIVE status + the central
// canAccessFeature summary into per-row visual states, WITHOUT any presentation
// (colours/icons live in the component). Kept pure + type-only imports so both the
// server component and the runnable test matrix share the exact same logic.
import type { TeacherStatus } from '@/lib/teacher-status';
import type { FeatureAccessSummary, TeacherFeature } from '@/lib/teacher-access';
import { instaKycPriceLabel } from './pricing.ts';

export type FeatureState = 'unlocked' | 'locked' | 'pending' | 'completed' | 'action';

// The single human label for each state (used by the card AND the test matrix so
// the words on screen can never drift from what we assert).
export const FEATURE_STATE_LABEL: Record<FeatureState, string> = {
  unlocked: 'Unlocked',
  completed: 'Completed',
  pending: 'Pending',
  action: 'Action required',
  locked: 'Locked',
};

export type AccessViewContext = {
  status: TeacherStatus;
  profilePercent: number;
  kycVerified: boolean;
  kycPaid: boolean;
  /** B4.8 — outside India InstaKYC does not apply (identity check not yet available). */
  international?: boolean;
  /** B4.8 — a reviewer suspended / revoked empanelment. */
  withdrawn?: boolean;
};

export type ResolvedFeature = { state: FeatureState; reason?: string; nextAction?: string };

// Resolve ONE feature row to its display state. Progress/step features (Foundation)
// reflect completion; gated features (operate/host) read the real engine decision
// carried on the summary item `s.allowed`.
export function resolveFeatureState(
  feature: TeacherFeature,
  s: FeatureAccessSummary,
  ctx: AccessViewContext,
): ResolvedFeature {
  const { status, profilePercent, kycVerified, kycPaid, international, withdrawn } = ctx;

  if (feature === 'dashboard' || feature === 'mentor') return { state: 'unlocked' };
  if (feature === 'profile') {
    return profilePercent >= 100
      ? { state: 'completed' }
      : { state: 'action', reason: `Profile ${profilePercent}% complete`, nextAction: 'Finish your profile' };
  }
  if (feature === 'kyc') {
    if (kycVerified && kycPaid) return { state: 'completed' };
    if (international) return { state: 'locked', reason: 'Identity check not yet available in your country' };
    if (status.verification === 'pending') return { state: 'pending', reason: 'InstaKYC under review' };
    return { state: 'action', reason: 'InstaKYC not completed', nextAction: `Complete InstaKYC (${instaKycPriceLabel()})` };
  }
  if (feature === 'empanelment') {
    if (withdrawn) return { state: 'locked', reason: 'Suspended or revoked after Council review — see your Trust checklist' };
    if (status.empanelment === 'empanelled') return { state: 'completed' };
    if (status.empanelment === 'pending') return { state: 'pending', reason: 'Empanelment under review' };
    // FOUNDATIONAL RULE: Verification must be complete BEFORE applying for Empanelment.
    if (status.verification === 'verified') {
      return { state: 'action', reason: 'Verification complete', nextAction: 'Apply for empanelment' };
    }
    if (status.verification === 'pending') {
      return { state: 'locked', reason: 'Available after verification — in review' };
    }
    return { state: 'locked', reason: 'Complete verification first' };
  }

  // Gated features (operate / host) read the real engine decision.
  if (s.allowed) return { state: 'unlocked' };

  if (s.category === 'host') {
    return { state: 'locked', reason: 'Available at Level 2+', nextAction: 'Level is assigned by NOSTOPS' };
  }

  // operate, locked → pending when a prerequisite is in review, else list exactly what's missing.
  if (status.verification === 'pending' || status.empanelment === 'pending') {
    return { state: 'pending', reason: 'Verification / empanelment under review' };
  }
  const missing: string[] = [];
  if (!(kycVerified && kycPaid)) missing.push(international ? 'an identity check (not yet available in your country)' : 'InstaKYC');
  if (status.empanelment !== 'empanelled') missing.push('Empanelment');
  if (missing.length === 0 && status.verification !== 'verified') missing.push('NOSTOPS verification');
  return { state: 'locked', reason: missing.length ? `Requires ${missing.join(' + ')}` : s.reason || 'Locked' };
}

// The two journey chips whose state cannot be read straight off a feature row.
export function verificationChipState(status: TeacherStatus): FeatureState {
  return status.verification === 'verified' ? 'completed' : status.verification === 'pending' ? 'pending' : 'action';
}

export function empanelmentChipState(status: TeacherStatus, withdrawn = false): FeatureState {
  if (withdrawn) return 'locked';
  if (status.empanelment === 'empanelled') return 'completed';
  if (status.empanelment === 'pending') return 'pending';
  // verified → may now apply; otherwise blocked until verification completes.
  return status.verification === 'verified' ? 'action' : 'locked';
}
