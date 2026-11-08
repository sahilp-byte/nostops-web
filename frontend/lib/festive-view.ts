// Festive Complimentary InstaKYC — maps the backend status (backend/festive_kyc.py /status) to what
// the teacher dashboard shows. Pure + display-only: it never authorises a claim (the claim button
// calls the backend, which re-checks everything). Shared by the dashboard, sidebar, KYC page and the
// preview-only state gallery.

export type FestiveStatus = {
  campaign_state: 'upcoming' | 'active' | 'ended' | 'disabled';
  eligible: boolean;
  reasons: string[];
  reason_messages: string[];
  profile_percent: number;
  min_profile_percent: number;
  missing_sections: string[];
  teacher_level_label?: string | null;
  india_eligible: boolean;
  kyc_completed: boolean;
  kyc_stage: 'not_started' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  claim_status: 'claimed' | 'not_claimed';
  claim: { claim_id: string; claimed_at: string | null; kyc_reference_id: string } | null;
  applicable_fee_inr: number | null;
  standard_fee_inr: number | null;
  fee_waived: boolean;
  payment_required: boolean;
  next_action: string;
};

export type FestiveMode =
  | 'hidden' // not a potentially eligible Indian teacher → normal KYC only
  | 'complete_profile' // below 80 %
  | 'upcoming' // ≥ 80 %, claiming opens 1 Nov
  | 'claim' // eligible + unclaimed
  | 'applied' // waiver applied, KYC not started
  | 'in_review' // waiver applied, KYC submitted / under review
  | 'rejected' // waiver applied, KYC needs correction
  | 'completed' // KYC approved
  | 'ended'; // campaign over, no claim, KYC incomplete → standard pricing

export type FestiveView = {
  mode: FestiveMode;
  showBanner: boolean;
  nav: { label: string; href: string; sub: string } | null;
};

const STAGE_LABEL: Record<FestiveStatus['kyc_stage'], string> = {
  not_started: 'Not started',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Needs correction',
};
export const kycStageLabel = (s: FestiveStatus['kyc_stage']) => STAGE_LABEL[s] || s;

export function festiveView(s: FestiveStatus | null): FestiveView {
  if (!s) return { mode: 'hidden', showBanner: false, nav: null };
  const kycNav = (sub: string) => ({ label: 'Complete Your KYC', href: '/app/teacher/kyc', sub });
  if (s.claim_status === 'claimed') {
    if (s.kyc_stage === 'approved') return { mode: 'completed', showBanner: false, nav: { label: 'KYC Completed', href: '/app', sub: 'Festive fee waiver used' } };
    if (s.kyc_stage === 'rejected') return { mode: 'rejected', showBanner: false, nav: kycNav('Please correct your KYC') };
    if (s.kyc_stage === 'submitted' || s.kyc_stage === 'under_review') return { mode: 'in_review', showBanner: false, nav: kycNav(`KYC ${kycStageLabel(s.kyc_stage).toLowerCase()}`) };
    return { mode: 'applied', showBanner: false, nav: kycNav('Fee waived — verify now') };
  }
  if (s.kyc_completed) {
    return s.kyc_stage === 'approved'
      ? { mode: 'completed', showBanner: false, nav: { label: 'KYC Completed', href: '/app', sub: 'Identity verified' } }
      : { mode: 'hidden', showBanner: false, nav: null };
  }
  if (!s.india_eligible || s.reasons.includes('not_teacher') || s.reasons.includes('facts_unavailable')) {
    return { mode: 'hidden', showBanner: false, nav: null };
  }
  if (s.campaign_state === 'ended' || s.campaign_state === 'disabled') return { mode: 'ended', showBanner: false, nav: null };
  if (s.reasons.includes('profile_incomplete')) {
    return { mode: 'complete_profile', showBanner: true, nav: { label: 'Complete Your Profile', href: '/app/teacher/profile/edit', sub: `Complete ${s.min_profile_percent}% to unlock Free KYC` } };
  }
  if (s.campaign_state === 'upcoming') {
    return { mode: 'upcoming', showBanner: true, nav: { label: 'Claim Your Free KYC', href: '/app#festive-kyc', sub: 'Claiming opens 1 Nov' } };
  }
  if (s.eligible) return { mode: 'claim', showBanner: true, nav: { label: 'Claim Your Free KYC', href: '/app#festive-kyc', sub: '₹0 InstaKYC till 31 Dec' } };
  return { mode: 'hidden', showBanner: false, nav: null };
}
