import { backendFetch } from '@/lib/server/session';

// Admin Dashboard data layer (PHASE 1). Single source of truth = the existing
// backend metric engine at GET /api/dashboards/admin-stats. The web NEVER
// recomputes a platform metric — every number rendered comes straight from the
// backend payload. This module only projects the payload into typed, presentational
// shapes and maps the mobile action-queue routes to their web equivalents.

export type QueueCard = {
  id: string;
  label: string;
  count: number;
  emoji: string;
  color: string;
  href: string | null; // null when the target web page is not built yet
};

export type AdminDashboard = {
  platform: {
    totalUsers: number;
    totalTeachers: number;
    empanelledTeachers: number;
    hrPros: number;
    itPros: number;
    activeEmployees: number;
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    citiesActive: number;
  };
  financials: { pipelineValueInr: number; thisMonthRevenueInr: number; currency: string };
  growth: {
    signups7d: number;
    signups30d: number;
    growthPctMom: number;
    trend: string;
    dau: { label: string; value: number }[];
    signups6m: { label: string; value: number }[];
  };
  engagement: { activeToday: number; activeNow: number };
  operations: {
    pendingKyc: number;
    kycApprovalRatePct: number;
    avgKycProcessingHours: number;
    queue: QueueCard[];
  };
  systemHealth: { status: string; incidents24h: number };
  refresh: { mode: string; lastUpdatedAt: string | null; note: string | null };
};

// Mobile action_queue.id → web route (only built pages get a live link; others
// render as a non-clickable "Soon" card so there are never dead links).
const QUEUE_ROUTE: Record<string, string> = {
  kyc: '/app/admin/kyc',
  empanel: '/app/admin/empanelment',
  leadership: '/app/admin/leadership',
  people_manager: '/app/admin/people',
};

// Ionicon name (mobile payload) → web emoji.
const QUEUE_EMOJI: Record<string, string> = {
  'shield-checkmark': '🛡️',
  ribbon: '🎖️',
  analytics: '📊',
  'people-circle': '👥',
};

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const res = await backendFetch('/dashboards/admin-stats');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const p = d.platform || {};
  const f = d.financials || {};
  const g = d.growth || {};
  const e = d.engagement || {};
  const o = d.operations || {};
  const h = d.system_health || {};
  const rm = d.refresh_meta || {};

  const queue: QueueCard[] = (Array.isArray(o.action_queue) ? o.action_queue : []).map((q: any) => ({
    id: str(q.id) || 'item',
    label: str(q.label) || 'Queue',
    count: num(q.count),
    emoji: QUEUE_EMOJI[str(q.icon)] || '📋',
    color: str(q.color) || '#0D9488',
    href: QUEUE_ROUTE[str(q.id)] ?? null,
  }));

  return {
    platform: {
      totalUsers: num(p.total_users),
      totalTeachers: num(p.total_yoga_teachers),
      empanelledTeachers: num(p.total_empanelled_teachers),
      hrPros: num(p.total_hr_professionals),
      itPros: num(p.total_it_professionals),
      activeEmployees: num(p.active_employees),
      totalBookings: num(p.total_bookings),
      activeBookings: num(p.active_bookings),
      completedBookings: num(p.completed_bookings),
      citiesActive: num(p.cities_active),
    },
    financials: {
      pipelineValueInr: num(f.pipeline_value_inr),
      thisMonthRevenueInr: num(f.this_month_revenue_inr),
      currency: str(f.currency) || 'INR',
    },
    growth: {
      signups7d: num(g.signups_last_7_days),
      signups30d: num(g.signups_last_30_days),
      growthPctMom: num(g.growth_pct_mom),
      trend: str(g.growth_trend) || 'flat',
      dau: (Array.isArray(g.dau_7day_series) ? g.dau_7day_series : []).map((x: any) => ({
        label: str(x.label) || '',
        value: num(x.active_users),
      })),
      signups6m: (Array.isArray(g.signups_6month_series) ? g.signups_6month_series : []).map((x: any) => ({
        label: str(x.month) || '',
        value: num(x.signups),
      })),
    },
    engagement: { activeToday: num(e.active_users_today), activeNow: num(e.active_users_now) },
    operations: {
      pendingKyc: num(o.pending_kyc_count),
      kycApprovalRatePct: num(o.kyc_approval_rate_pct),
      avgKycProcessingHours: num(o.avg_kyc_processing_hours),
      queue,
    },
    systemHealth: { status: str(h.status) || 'Operational', incidents24h: num(h.incidents_24h) },
    refresh: {
      mode: str(rm.mode) || 'live',
      lastUpdatedAt: typeof rm.last_updated_at === 'string' ? rm.last_updated_at : null,
      note: typeof rm.note === 'string' ? rm.note : null,
    },
  };
}
