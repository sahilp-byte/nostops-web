import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isPreviewRequest } from '@/lib/server/preview-isolation';
import FestiveDashboard, { type ChecklistItem } from '@/components/app/teacher/festive/FestiveDashboard';
import { festiveView, type FestiveStatus } from '@/lib/festive-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Festive KYC states (preview)', robots: { index: false, follow: false } };

// PREVIEW-ONLY gallery (404 on the live site): renders the festive dashboard block for each state
// with SAMPLE data so every state can be reviewed. The real dashboard always uses the backend status.
const ITEMS = (doneKeys: string[]): ChecklistItem[] =>
  [
    ['photo', 'Add a profile photo', '/app/teacher/profile/media'], ['bio', 'Write your bio', '/app/teacher/profile/edit'],
    ['city', 'Add your city', '/app/teacher/profile/edit#city'], ['phone', 'Add your phone number', '/app/teacher/profile/edit'],
    ['experience', 'Add years of experience', '/app/teacher/profile/edit'], ['styles', 'Select your yoga styles', '/app/teacher/profile/edit'],
    ['specializations', 'Add specializations', '/app/teacher/profile/edit'], ['languages', 'Add languages you teach in', '/app/teacher/profile/edit'],
    ['parampara', 'Share your parampara (lineage)', '/app/teacher/profile/edit'],
  ].map(([key, label, href]) => ({ key, label, href, done: doneKeys.includes(key) }));

const ALL = ['photo', 'bio', 'city', 'phone', 'experience', 'styles', 'specializations', 'languages', 'parampara'];
const base: FestiveStatus = {
  campaign_state: 'active', eligible: true, reasons: [], reason_messages: [], profile_percent: 88.9, min_profile_percent: 80,
  missing_sections: ['parampara'], india_eligible: true, kyc_completed: false, kyc_stage: 'not_started', claim_status: 'not_claimed',
  claim: null, applicable_fee_inr: 0, standard_fee_inr: 279, fee_waived: false, payment_required: false, next_action: 'claim_offer',
};
const claim = { claim_id: 'KYCW-SAMPLE', claimed_at: '2026-11-05T10:00:00+05:30', kyc_reference_id: 'KYCW-SAMPLE' };

const STATES: { title: string; s: FestiveStatus; done: string[] }[] = [
  { title: 'Below 80% (5 of 9 sections — 55.6%)', s: { ...base, eligible: false, reasons: ['profile_incomplete'], profile_percent: 55.6, missing_sections: ['photo', 'experience', 'languages', 'parampara'], applicable_fee_inr: 279, payment_required: true }, done: ['bio', 'city', 'phone', 'styles', 'specializations'] },
  { title: 'Eligible, unclaimed (campaign active)', s: base, done: ALL.filter((k) => k !== 'parampara') },
  { title: 'Eligible on profile, campaign not started', s: { ...base, eligible: false, reasons: ['campaign_not_started'], campaign_state: 'upcoming' }, done: ALL },
  { title: 'Waiver applied', s: { ...base, eligible: false, reasons: ['already_claimed'], claim_status: 'claimed', claim, fee_waived: true }, done: ALL },
  { title: 'Waiver applied, KYC under review', s: { ...base, eligible: false, reasons: ['already_claimed'], claim_status: 'claimed', claim, fee_waived: true, kyc_stage: 'under_review' }, done: ALL },
  { title: 'Waiver applied, KYC needs correction', s: { ...base, eligible: false, reasons: ['already_claimed'], claim_status: 'claimed', claim, fee_waived: true, kyc_stage: 'rejected' }, done: ALL },
  { title: 'KYC completed', s: { ...base, eligible: false, reasons: ['already_claimed'], claim_status: 'claimed', claim, fee_waived: true, kyc_stage: 'approved', kyc_completed: true }, done: ALL },
  { title: 'Campaign ended, no claim', s: { ...base, eligible: false, reasons: ['campaign_ended'], campaign_state: 'ended', applicable_fee_inr: 279, payment_required: true }, done: ALL },
  { title: 'Non-Indian teacher (nothing shown)', s: { ...base, eligible: false, reasons: ['not_india'], india_eligible: false }, done: ALL },
];

export default async function FestiveStatesPage() {
  if (!(await isPreviewRequest())) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-10" data-testid="festive-gallery">
      <div className="rounded-xl border border-dashed border-[#F07A1A] bg-[#FFF6EC] px-4 py-3 text-sm font-bold text-[#B4530A]">
        Preview only — sample data for review. Buttons here use your real account and the real backend checks.
      </div>
      {STATES.map((x) => {
        const v = festiveView(x.s);
        return (
          <section key={x.title} data-testid={`gallery-${v.mode}`}>
            <h2 className="mb-1 text-lg font-black text-ink">{x.title}</h2>
            <p className="mb-3 text-xs text-muted">mode: {v.mode} · sidebar: {v.nav ? `“${v.nav.label}” — ${v.nav.sub}` : 'no festive item'}</p>
            {v.mode === 'hidden' ? (
              <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">No festive block — the normal KYC workflow is shown.</p>
            ) : (
              <FestiveDashboard status={x.s} view={v} items={ITEMS(x.done)} />
            )}
          </section>
        );
      })}
    </div>
  );
}
