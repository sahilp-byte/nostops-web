import { backendFetch } from '@/lib/server/session';

// Organisation (corporate / educational / startup) persona data. Backed by the
// authed HR endpoints. Faithful web reproduction of the mobile OrganisationHome
// + Command Center + booking list.

const n = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

export type OrgOverview = {
  totalBookings: number;
  totalCapacity: number;
  totalRegistered: number;
  active7d: number;
  active30d: number;
  engagementRate: number;
  activePilots: number;
  sessionsPlanned: number;
} | null;

export async function getOrgOverview(): Promise<OrgOverview> {
  try {
    const r = await backendFetch('/hr-dashboard/overview');
    if (!r.ok) return null;
    const d = await r.json();
    return {
      totalBookings: n(d.total_bookings),
      totalCapacity: n(d.total_capacity),
      totalRegistered: n(d.total_registered),
      active7d: n(d.active_7d),
      active30d: n(d.active_30d),
      engagementRate: n(d.engagement_rate),
      activePilots: n(d.active_pilots),
      sessionsPlanned: n(d.total_sessions_planned),
    };
  } catch {
    return null;
  }
}

export type OrgBooking = {
  id: string;
  companyName: string;
  courseTitle: string;
  status: string;
  cohortType: string;
  capacity: number;
  registered: number;
  venue: string;
  venueCity: string | null;
  inviteToken: string | null;
  createdAt: string | null;
};

export async function getOrgBookings(): Promise<OrgBooking[]> {
  try {
    const r = await backendFetch('/bookings');
    if (!r.ok) return [];
    const d = await r.json();
    const items = Array.isArray(d) ? d : d.bookings || d.items || [];
    return items
      .map((b: any): OrgBooking => ({
        id: b.booking_id || b.id || '',
        companyName: b.company_name || 'Batch',
        courseTitle: b.course_title || 'Corporate Yoga Wellness Program',
        status: b.status || 'draft',
        cohortType: b.cohort_type || 'company',
        capacity: n(b.batch_capacity),
        registered: Array.isArray(b.registered_employees) ? b.registered_employees.length : n(b.registered_count),
        venue: b.venue || '',
        venueCity: b.venue_city || null,
        inviteToken: b.invite_link_token || null,
        createdAt: b.created_at || null,
      }))
      .sort((a: OrgBooking, b: OrgBooking) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export type OrgParticipant = {
  name: string;
  email: string;
  phone: string;
  department: string;
  status: string;
  amount: number;
  registeredAt: string | null;
};

export type OrgBookingDetail = {
  id: string;
  companyName: string;
  courseTitle: string;
  status: string;
  cohortType: string;
  venue: string;
  venueCity: string | null;
  capacity: number;
  registered: number;
  enrollmentOpen: boolean;
  inviteToken: string | null;
  assignedTeacherName: string | null;
  sessionCount: number;
  totalCollected: number;
  paidCount: number;
  pendingCount: number;
  participants: OrgParticipant[];
} | null;

export async function getOrgBookingDetail(id: string): Promise<OrgBookingDetail> {
  try {
    const r = await backendFetch(`/bookings/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const b = await r.json();
    const raw = Array.isArray(b.registered_employees) ? b.registered_employees : [];
    const participants: OrgParticipant[] = raw.map((p: any) => ({
      name: p.name || 'Participant',
      email: p.email || '',
      phone: p.phone || '',
      department: p.department || '',
      status: p.status || 'pending',
      amount: n(p.payment?.amount),
      registeredAt: p.registered_at || null,
    }));
    const paidCount = participants.filter((p) => p.status === 'paid').length;
    return {
      id: b.booking_id || id,
      companyName: b.company_name || 'Batch',
      courseTitle: b.course_title || 'Corporate Yoga Wellness Program',
      status: b.status || 'draft',
      cohortType: b.cohort_type || 'company',
      venue: b.venue || '',
      venueCity: b.venue_city || null,
      capacity: n(b.batch_capacity),
      registered: participants.length,
      enrollmentOpen: b.enrollment_open !== false,
      inviteToken: b.invite_link_token || null,
      assignedTeacherName: b.assigned_teacher?.name || null,
      sessionCount: Array.isArray(b.session_dates) ? b.session_dates.length : 0,
      totalCollected: n(b.total_employee_payments),
      paidCount,
      pendingCount: participants.length - paidCount,
      participants,
    };
  } catch {
    return null;
  }
}

