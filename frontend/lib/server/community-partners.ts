import 'server-only';
import { spacesCall } from '@/lib/server/spaces';

// Phase 7 — Community Partner Network (backend/community_partners.py). Non-financial by design.
export type CPLoc = { pin: string; locality_id: string; locality: string; district: string; state: string };
export type CPDoc = { id: string; kind: string; name: string; type: string; uploaded_at: string };
export type CPApplication = {
  id: string; ref: string; status: string; partner_status: string | null;
  applicant: { full_name?: string; phone?: string; city?: string; occupation?: string; languages?: string; background?: string; community_experience?: string };
  localities: CPLoc[]; role_acknowledged?: boolean; team: { name: string; role?: string; relation?: string }[]; focus_areas: string[];
  plan: { activation_plan?: string; timeline?: string; weekly_hours?: number }; declarations: { truthful?: boolean; guidelines?: boolean };
  documents: CPDoc[]; assigned_localities: CPLoc[]; decision_note?: string; info_request?: { message: string; at: string } | null;
  created_at?: string; updated_at?: string; submitted_at?: string; decided_at?: string; activated_at?: string; missing: string[];
  history: { action: string; at: string; note?: string; by?: string }[]; user_id?: string; account_name?: string; account_email?: string;
};
export type CPReferral = { id: string; kind: string; name: string; contact?: string; locality?: string; locality_id: string; note?: string; status: string; created_at: string; partner_ref?: string; history?: { action: string; at: string; note?: string }[] };

const ok = async <T,>(path: string, pick: (d: any) => T): Promise<T | null> => {
  const r = await spacesCall(`/partners${path}`);
  return r.status === 200 ? pick(r.data) : null;
};
export const getMyCPApplication = () => ok('/mine', (d) => d.application as CPApplication | null);
export const getCPDashboard = () => ok('/dashboard', (d) => d as {
  partner: CPApplication; localities: CPLoc[]; programmes: { title: string; slug: string; event_date: string; lifecycle: string }[];
  recent_referrals: CPReferral[];
  stats: { active_spaces: number; verified_teachers: number; programmes: number; confirmed_participants: number; referrals: number;
    referrals_by_status: Record<string, number>; spaces_by_model: Record<string, number> };
});
export const getCPSpaces = () => ok('/discover/spaces', (d) => d.items as any[]);
export const getCPTeachers = () => ok('/discover/teachers', (d) => d.items as { name: string; city: string; specializations?: string[]; experience_years?: number; languages?: string[] }[]);
export const getCPReferrals = () => ok('/referrals', (d) => d.items as CPReferral[]);
export const getAdminCPList = (status: string, partner: string, q: string) =>
  ok(`/admin?status=${encodeURIComponent(status)}&partner=${encodeURIComponent(partner)}&q=${encodeURIComponent(q)}`, (d) => d as { counts: Record<string, number>; items: CPApplication[] });
export const getAdminCP = (id: string) => ok(`/admin/${encodeURIComponent(id)}`, (d) => d as { application: CPApplication; referrals: CPReferral[]; audit: { action: string; actor: string; at: string; reason?: string }[]; doc_kinds: Record<string, string> });
export const getAdminCPReferrals = () => ok('/admin/referrals', (d) => d.items as CPReferral[]);

export const CP_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-stone-100 text-stone-700' }, submitted: { label: 'Under review', tone: 'bg-amber-50 text-amber-800' },
  info_requested: { label: 'More information requested', tone: 'bg-orange-50 text-orange-800' },
  approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-800' }, rejected: { label: 'Not approved', tone: 'bg-red-50 text-red-800' },
  active: { label: 'Active partner', tone: 'bg-emerald-50 text-emerald-800' }, suspended: { label: 'Suspended', tone: 'bg-red-50 text-red-800' },
  deactivated: { label: 'Deactivated', tone: 'bg-stone-100 text-stone-700' },
};
export const FOCUS_LABEL: Record<string, string> = { mind: 'MIND', body: 'BODY', special_needs: 'SPECIAL NEEDS' };
export const TIMELINE_LABEL: Record<string, string> = { '1_month': 'Within 1 month', '3_months': 'Within 3 months', '6_months': 'Within 6 months', '12_months': 'Within 12 months' };
export const REF_KIND: Record<string, string> = { teacher: 'Yoga teacher', space: 'Potential Space', space_owner: 'Space owner' };
