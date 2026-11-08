// PURE next-step engine (extracted from TeacherNextStep.tsx so the component and
// the test matrix assert the SAME logic — no duplication, no drift).
//
// "Your Next Step" is ONE dynamic, entitlement-driven directive derived from the
// teacher's authoritative status. No hard-coded messaging: every branch maps to a
// real prerequisite in the access system (verification → empanelment → operate).
// When all applicable onboarding is done it returns a positive "all set" state
// with no CTA.
import type { TeacherStatus } from '@/lib/teacher-status';
import { instaKycPriceLabel } from './pricing.ts';

export type NextStepTone = 'action' | 'info' | 'done';
export type NextStep = {
  tone: NextStepTone;
  title: string;
  message: string;
  cta?: { label: string; href: string };
};

export function computeNextStep(status: TeacherStatus, kycComplete: boolean): NextStep {
  // Authoritative-status-first so the directive NEVER contradicts the access card
  // (e.g. it must not say "Complete Verification" while the card shows
  // "Verification: Completed"). Order: Verification → Empanelment → Activate → done.

  // 1) Verification (authoritative status, not raw KYC).
  if (status.verification !== 'verified') {
    if (status.verification === 'pending') {
      return { tone: 'info', title: 'Verification in review', message: "We're checking your InstaKYC details — you'll be notified once it's approved." };
    }
    return { tone: 'action', title: 'Complete Verification', message: 'Finish InstaKYC to unlock your verified-teacher features.', cta: { label: `Complete InstaKYC · ${instaKycPriceLabel()}`, href: '/app/teacher/kyc' } };
  }
  // 2) Empanelment (only meaningful once verified).
  if (status.empanelment !== 'empanelled') {
    if (status.empanelment === 'pending') {
      return { tone: 'info', title: 'Empanelment under review', message: 'The NOSTOPS Council is reviewing your empanelment. Hang tight.' };
    }
    return { tone: 'action', title: 'Complete Empanelment', message: 'Apply for empanelment to unlock empanelled-teacher opportunities.', cta: { label: 'Apply for empanelment', href: '/app/teacher/empanelment' } };
  }
  // 3) Verified + empanelled, but earning tools are still off (strict operate gate).
  if (!status.canOperate) {
    if (!kycComplete) {
      // The operate gate additionally needs the recorded InstaKYC identity + fee
      // payment. Frame it as activation — NOT "verification", which is already done.
      return { tone: 'action', title: 'Activate your earning tools', message: `Complete your InstaKYC (identity + ${instaKycPriceLabel()} payment) to switch on bookings, offerings and your wallet.`, cta: { label: `Complete InstaKYC · ${instaKycPriceLabel()}`, href: '/app/teacher/kyc' } };
    }
    return { tone: 'info', title: 'Final approval pending', message: "You're verified and empanelled — awaiting final NOSTOPS approval to switch on your earning tools." };
  }
  // 4) Fully enabled.
  return { tone: 'done', title: "You're all set", message: 'Your current NOSTOPS access is fully enabled.' };
}
