import { backendFetch } from '@/lib/server/session';

// Admin Leadership dashboard (PHASE 13). Reads GET /api/leadership-dashboard —
// the workplace wellness leadership view (WEI / BRS / consistency scores).
// Read-only.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type LeadershipDashboard = {
  company: string;
  totalEmployees: number;
  totalBookings: number;
  percentile: number;
  wei: { score: number; previous: number; delta: number; zone: string; color: string; verdict: string };
  brs: { raw: number; signal: string; color: string; label: string; previousLabel: string };
  cr: { percentage: number; previous: number; delta: number; consistentUsers: number; totalParticipants: number };
  autoInsight: string;
};

export async function getLeadershipDashboard(): Promise<LeadershipDashboard> {
  const res = await backendFetch('/leadership-dashboard');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const wei = d.wei || {};
  const brs = d.brs || {};
  const cr = d.cr || {};
  return {
    company: str(d.company) || 'Organization',
    totalEmployees: num(d.total_employees),
    totalBookings: num(d.total_bookings),
    percentile: num(d.percentile),
    wei: { score: num(wei.score), previous: num(wei.previous), delta: num(wei.delta), zone: str(wei.zone), color: str(wei.color) || 'gray', verdict: str(wei.verdict) },
    brs: { raw: num(brs.raw), signal: str(brs.signal), color: str(brs.color) || 'gray', label: str(brs.label), previousLabel: str(brs.previous_label) },
    cr: { percentage: num(cr.percentage), previous: num(cr.previous), delta: num(cr.delta), consistentUsers: num(cr.consistent_users), totalParticipants: num(cr.total_participants) },
    autoInsight: str(d.auto_insight),
  };
}
