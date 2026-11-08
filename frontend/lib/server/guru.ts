import { backendFetch } from '@/lib/server/session';

// Guru Council (Council of Gurus) persona. A faithful web reproduction of the
// mobile council-dashboard + empanelment-fast-track queue. Backed by
//   GET /dashboards/council-stats
//   GET /empanelment/fast-track/my-queue
//   GET /empanelment/fast-track/my-earnings
//   GET /empanelment/fast-track/queue        (public claim / active queue)
// All reads are whitelisted into stable shapes; the backend is never mutated
// here (state changes go through /bff/guru/* with CSRF).

const n = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0);
const s = (v: any): string => (typeof v === 'string' ? v : '');
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------- Council stats

export type DemandCity = { city: string; demand: number };
export type CouncilStats = {
  mission: {
    percentComplete: number;
    onboarded: number;
    target: number;
    livesTouched: number;
    daysRemaining: number;
    daysActive: number;
    interested: number;
  };
  teacherQuality: {
    totalTeachers: number;
    empanelled: number;
    gurus: number;
    pracharaks: number;
    shikshaks: number;
    avgRating: number;
    avgAttendancePct: number;
    sessionsConducted: number;
  };
  kpis: {
    citiesActive: number;
    statesActive: number;
    monthlyExpansionPct: number;
    topDemandCities: DemandCity[];
    dimensionSplit: { body: number; mind: number; specialNeeds: number };
    topDimension: { label: string; color: string; pct: number } | null;
  };
  teacherOfMonth: { name: string; note: string; period: string } | null;
  recentEvents: string[];
  refreshNote: string;
} | null;

export async function getCouncilStats(): Promise<CouncilStats> {
  try {
    const r = await backendFetch('/dashboards/council-stats');
    if (!r.ok) return null;
    const d = await r.json();
    const m = d.mission || {};
    const tq = d.teacher_quality || {};
    const k = d.strategic_kpis || {};
    const tom = d.teacher_of_month || null;
    const td = k.top_dimension || null;
    return {
      mission: {
        percentComplete: n(m.percent_complete),
        onboarded: n(m.organisations_onboarded ?? m.corporates_onboarded),
        target: n(m.target_organisations ?? m.target) || 100,
        livesTouched: n(m.lives_touched),
        daysRemaining: n(m.days_remaining),
        daysActive: n(m.days_active),
        interested: n(m.interested_organisations ?? m.interested_companies),
      },
      teacherQuality: {
        totalTeachers: n(tq.total_teachers),
        empanelled: n(tq.empanelled),
        gurus: n(tq.gurus),
        pracharaks: n(tq.pracharaks),
        shikshaks: n(tq.shikshaks),
        avgRating: n(tq.avg_rating),
        avgAttendancePct: n(tq.avg_attendance_pct),
        sessionsConducted: n(tq.sessions_conducted),
      },
      kpis: {
        citiesActive: n(k.cities_active),
        statesActive: n(k.states_active),
        monthlyExpansionPct: n(k.monthly_program_expansion_pct),
        topDemandCities: arr(k.top_demand_cities).map((c: any) => ({ city: s(c.city), demand: n(c.demand) })),
        dimensionSplit: {
          body: n(k.dimension_split?.body),
          mind: n(k.dimension_split?.mind),
          specialNeeds: n(k.dimension_split?.special_needs),
        },
        topDimension: td ? { label: s(td.label), color: s(td.color) || '#F59E0B', pct: n(td.pct) } : null,
      },
      teacherOfMonth: tom
        ? { name: s(tom.teacher_name), note: s(tom.editorial_note), period: s(tom.period) }
        : null,
      recentEvents: arr(d.recent_events).map((e: any) => s(e.text)).filter(Boolean),
      refreshNote: s(d.refresh_meta?.note),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- My queue

export type QueueAction = 'schedule' | 'conduct' | 'decide';
export type QueueItem = {
  requestId: string;
  teacherName: string;
  city: string;
  status: string;
  nextAction: QueueAction;
  urgencyHours: number | null;
  experienceYears: number;
  specializations: string[];
};
export type MyInterviewQueue = {
  counts: { toSchedule: number; toConduct: number; toDecide: number; decidedTotal: number; activeTotal: number };
  items: QueueItem[];
} | null;

export async function getMyInterviewQueue(): Promise<MyInterviewQueue> {
  try {
    const r = await backendFetch('/empanelment/fast-track/my-queue');
    if (!r.ok) return null;
    const d = await r.json();
    const c = d.counts || {};
    return {
      counts: {
        toSchedule: n(c.to_schedule),
        toConduct: n(c.to_conduct),
        toDecide: n(c.to_decide),
        decidedTotal: n(c.decided_total),
        activeTotal: n(c.active_total),
      },
      items: arr(d.next_action_items).map((it: any) => ({
        requestId: s(it.request_id),
        teacherName: s(it.teacher_name) || 'Teacher',
        city: s(it.teacher_city ?? it.city),
        status: s(it.status),
        nextAction: (['schedule', 'conduct', 'decide'].includes(it.next_action) ? it.next_action : 'schedule') as QueueAction,
        urgencyHours: typeof it.urgency_hours === 'number' ? it.urgency_hours : null,
        experienceYears: n(it.experience_years),
        specializations: arr(it.specializations).map(s).filter(Boolean),
      })),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- My earnings

export type ReviewEarnings = {
  lifetimeEarned: number;
  perReviewAmount: number;
  totalReviews: number;
  approvedCount: number;
  rejectedCount: number;
  earned30d: number;
  reviews30d: number;
  sharePct: number;
} | null;

export async function getMyReviewEarnings(): Promise<ReviewEarnings> {
  try {
    const r = await backendFetch('/empanelment/fast-track/my-earnings');
    if (!r.ok) return null;
    const d = await r.json();
    return {
      lifetimeEarned: n(d.lifetime_earned),
      perReviewAmount: n(d.per_review_amount),
      totalReviews: n(d.total_reviews),
      approvedCount: n(d.approved_count),
      rejectedCount: n(d.rejected_count),
      earned30d: n(d.earned_30d),
      reviews30d: n(d.reviews_30d),
      sharePct: n(d.reviewer_share_pct),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Full queue (interviews page)

export type InterviewRequest = {
  requestId: string;
  teacherName: string;
  city: string;
  status: string;
  claimedByGuruId: string | null;
  claimedByGuruName: string | null;
  specialties: string[];
  amount: number;
  paidAt: string | null;
  interview: { scheduledAt: string | null; meetingLink: string | null; notes: string | null } | null;
  decision: { outcome: string; notes: string; decidedAt: string | null } | null;
  matchScore: number;
};

export type FastTrackQueue = {
  guruFocus: string[];
  counts: {
    unclaimed: number;
    claimedPendingInterview: number;
    interviewScheduled: number;
    approvedLast30d: number;
    rejectedLast30d: number;
    highMatchUnclaimed: number;
  };
  active: InterviewRequest[];
  decidedRecent: InterviewRequest[];
} | null;

function toRequest(r: any): InterviewRequest {
  const iv = r.interview || null;
  const dec = r.decision || null;
  return {
    requestId: s(r.request_id),
    teacherName: s(r.teacher_name) || 'Teacher',
    city: s(r.teacher_city ?? r.city),
    status: s(r.status),
    claimedByGuruId: r.claimed_by_guru_id || null,
    claimedByGuruName: r.claimed_by_guru_name || null,
    specialties: arr(r.teacher_specialties ?? r.specializations).map(s).filter(Boolean),
    amount: n(r.payment?.amount ?? r.amount),
    paidAt: r.payment?.paid_at || null,
    interview: iv
      ? { scheduledAt: iv.scheduled_at || null, meetingLink: iv.meeting_link || null, notes: iv.notes || null }
      : null,
    decision: dec
      ? { outcome: s(dec.outcome), notes: s(dec.notes), decidedAt: dec.decided_at || null }
      : null,
    matchScore: n(r.match_score),
  };
}

export async function getFastTrackQueue(): Promise<FastTrackQueue> {
  try {
    const r = await backendFetch('/empanelment/fast-track/queue');
    if (!r.ok) return null;
    const d = await r.json();
    const c = d.counts || {};
    return {
      guruFocus: arr(d.guru_focus).map(s).filter(Boolean),
      counts: {
        unclaimed: n(c.unclaimed),
        claimedPendingInterview: n(c.claimed_pending_interview),
        interviewScheduled: n(c.interview_scheduled),
        approvedLast30d: n(c.approved_last_30d),
        rejectedLast30d: n(c.rejected_last_30d),
        highMatchUnclaimed: n(c.high_match_unclaimed),
      },
      active: arr(d.active).map(toRequest),
      decidedRecent: arr(d.decided_recent).map(toRequest),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Vouch lineage inbox

function humanizeLineage(id: string): string {
  if (!id) return '';
  return id
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type VouchItem = {
  vouchId: string;
  teacherName: string;
  teacherHandle: string;
  lineageId: string;
  lineageLabel: string;
  status: string;
  note: string;
  requestedAt: string | null;
};

export async function getVouchInbox(): Promise<VouchItem[]> {
  try {
    const r = await backendFetch('/lineage/vouches/pending-for-me');
    if (!r.ok) return [];
    const d = await r.json();
    return arr(d.items).map((v: any) => ({
      vouchId: s(v.vouch_id),
      teacherName: s(v.teacher_name) || 'Teacher',
      teacherHandle: s(v.teacher_handle),
      lineageId: s(v.lineage_id),
      lineageLabel: humanizeLineage(s(v.lineage_id)),
      status: s(v.status) || 'pending',
      note: s(v.note),
      requestedAt: v.requested_at || null,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- Editorial picks

export type EditorialSlot = 'teacher_of_month' | 'featured_teacher_week';
export type EditorialPick = {
  id: string;
  type: EditorialSlot;
  teacherName: string;
  teacherCity: string;
  citation: string;
  period: string;
  pickedBy: string;
  active: boolean;
  createdAt: string | null;
};

function toPick(p: any, fallbackType: EditorialSlot): EditorialPick | null {
  if (!p) return null;
  const t = p.teacher || {};
  const g = p.guru || {};
  const type = (p.pick_type || p.type || fallbackType) as EditorialSlot;
  return {
    id: s(p.feature_id || p.pick_id),
    type: type === 'featured_teacher_week' ? 'featured_teacher_week' : 'teacher_of_month',
    teacherName: s(t.name || p.teacher_name) || 'Teacher',
    teacherCity: s(t.city),
    citation: s(p.citation || p.editorial_note),
    period: s(p.period),
    pickedBy: s(g.name || p.picked_by) || 'Council Guru',
    active: p.active !== false,
    createdAt: p.created_at || null,
  };
}

export type EditorialData = {
  teacherOfMonth: EditorialPick | null;
  featuredWeek: EditorialPick | null;
  history: EditorialPick[];
};

export async function getEditorial(): Promise<EditorialData> {
  try {
    const [cr, hr] = await Promise.all([
      backendFetch('/editorial/current'),
      backendFetch('/council/editorial/history?limit=30'),
    ]);
    const cur = cr.ok ? await cr.json() : {};
    const hist = hr.ok ? await hr.json() : {};
    return {
      teacherOfMonth: toPick(cur.teacher_of_month, 'teacher_of_month'),
      featuredWeek: toPick(cur.featured_teacher_week, 'featured_teacher_week'),
      history: arr(hist.items).map((p: any) => toPick(p, 'teacher_of_month')).filter(Boolean) as EditorialPick[],
    };
  } catch {
    return { teacherOfMonth: null, featuredWeek: null, history: [] };
  }
}

// ---------------------------------------------------------------- Teacher search (editorial picker)

export type TeacherLite = { id: string; name: string; city: string; handle: string };

export async function searchTeachers(query: string): Promise<TeacherLite[]> {
  try {
    const q = query.trim();
    const r = await backendFetch(`/yoga-teachers?limit=15&skip=0${q ? `&query=${encodeURIComponent(q)}` : ''}`);
    if (!r.ok) return [];
    const d = await r.json();
    const items = arr(d.data ?? d.teachers ?? d.items ?? (Array.isArray(d) ? d : []));
    return items.slice(0, 15).map((t: any) => ({
      id: s(t.user_id || t.teacher_id),
      name: s(t.name) || 'Teacher',
      city: s(t.city),
      handle: s(t.handle),
    }));
  } catch {
    return [];
  }
}
