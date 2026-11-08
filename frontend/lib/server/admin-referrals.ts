import { backendFetch } from '@/lib/server/session';

// Admin Referrals analytics (PHASE 11). Read-only. Reads the authoritative
// GET /api/referrals/analytics (platform-wide referral funnel + monthly trend).
// The per-referral status transition endpoint has no documented request contract
// and admins currently have no referral records to act on, so this surface is
// intentionally view-only until the backend contract is confirmed.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type ReferralAnalytics = {
  summary: {
    totalReferrals: number;
    conversionRate: number;
    totalBatchValue: number;
    totalCommission: number;
    totalStudents: number;
    activePilots: number;
    uniqueReferrers: number;
    uniqueCompanies: number;
  };
  funnel: { stage: string; count: number; color: string }[];
  monthly: { label: string; referrals: number; converted: number }[];
};

export async function getReferralAnalytics(): Promise<ReferralAnalytics> {
  const res = await backendFetch('/referrals/analytics');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const s = d.summary || {};
  return {
    summary: {
      totalReferrals: num(s.total_referrals),
      conversionRate: num(s.conversion_rate),
      totalBatchValue: num(s.total_batch_value),
      totalCommission: num(s.total_commission),
      totalStudents: num(s.total_students),
      activePilots: num(s.active_pilots),
      uniqueReferrers: num(s.unique_referrers),
      uniqueCompanies: num(s.unique_companies),
    },
    funnel: (Array.isArray(d.funnel) ? d.funnel : []).map((f: any) => ({ stage: str(f.stage), count: num(f.count), color: str(f.color) || '#0D9488' })),
    monthly: (Array.isArray(d.monthly_trend) ? d.monthly_trend : []).map((m: any) => ({ label: str(m.label), referrals: num(m.referrals), converted: num(m.converted) })),
  };
}
