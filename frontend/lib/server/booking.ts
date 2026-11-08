import { backendFetch } from '@/lib/server/session';

// Public participant-facing group-booking invite (shared via WhatsApp). Backed by
// the unauthenticated GET /bookings/invite/{token} (+ /gamification). Faithful
// web reproduction of the mobile app/booking-invite/[token] destination.

export type InviteTeacher = {
  name: string;
  role: string;
  city: string;
  experienceYears: number;
  rating: number;
  specializations: string[];
};

export type InviteTier = { label: string; min: number; discountPct: number; color: string };

export type BookingInvite = {
  token: string;
  bookingId: string;
  companyName: string;
  courseTitle: string;
  hrName: string | null;
  venue: string;
  venueAddress: string | null;
  venueCity: string | null;
  sessionDates: Array<{ date: string; time: string }>;
  pilotStart: string | null;
  pilotEnd: string | null;
  dimensions: string[];
  batchCapacity: number;
  registeredCount: number;
  employeeFee: number;
  enrollmentOpen: boolean;
  isFull: boolean;
  finalPerHead: number | null;
  finalDiscountPct: number | null;
  assignedTeacher: InviteTeacher | null;
  pair: { guru: InviteTeacher | null; shikshak: InviteTeacher | null; cityMatch: boolean } | null;
  gam: {
    enrolled: number;
    capacity: number;
    tiers: InviteTier[];
    currentDiscountPct: number;
    nextTarget: number;
    nextNeeded: number;
    nextDiscountPct: number;
    nextSaveTotal: number;
    toMaxPct: number;
  } | null;
} | null;

const n = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

function projTeacher(t: any): InviteTeacher | null {
  if (!t || !t.name) return null;
  return {
    name: t.name,
    role: t.role || 'teacher',
    city: t.city || '',
    experienceYears: n(t.experience_years),
    rating: n(t.rating),
    specializations: Array.isArray(t.specializations) ? t.specializations.filter((s: any) => typeof s === 'string') : [],
  };
}

export async function getBookingInvite(token: string): Promise<BookingInvite> {
  try {
    const [br, gr] = await Promise.all([
      backendFetch(`/bookings/invite/${encodeURIComponent(token)}`),
      backendFetch(`/bookings/invite/${encodeURIComponent(token)}/gamification`),
    ]);
    if (!br.ok) return null;
    const b = await br.json();
    const g = gr.ok ? await gr.json() : null;
    const capacity = n(b.batch_capacity);
    const registered = n(b.registered_count);
    const pair = b.assigned_pair
      ? { guru: projTeacher(b.assigned_pair.guru), shikshak: projTeacher(b.assigned_pair.shikshak), cityMatch: !!b.assigned_pair.city_match }
      : null;
    return {
      token,
      bookingId: b.booking_id || '',
      companyName: b.company_name || 'your organisation',
      courseTitle: b.course_title || 'Corporate Yoga Wellness Program',
      hrName: b.hr_name || null,
      venue: b.venue || '',
      venueAddress: b.venue_address || null,
      venueCity: b.venue_city || null,
      sessionDates: Array.isArray(b.session_dates) ? b.session_dates : [],
      pilotStart: b.pilot_start_date || null,
      pilotEnd: b.pilot_end_date || null,
      dimensions: Array.isArray(b.yoga_dimensions) ? b.yoga_dimensions : [],
      batchCapacity: capacity,
      registeredCount: registered,
      employeeFee: n(b.employee_fee),
      enrollmentOpen: b.enrollment_open !== false,
      isFull: capacity > 0 && registered >= capacity,
      finalPerHead: typeof b.final_per_head_inr === 'number' ? b.final_per_head_inr : null,
      finalDiscountPct: typeof b.final_discount_pct === 'number' ? b.final_discount_pct : null,
      assignedTeacher: projTeacher(b.assigned_teacher),
      pair: pair && (pair.guru || pair.shikshak) ? pair : null,
      gam: g
        ? {
            enrolled: n(g.enrolled),
            capacity: n(g.capacity) || capacity,
            tiers: (Array.isArray(g.tiers) ? g.tiers : []).map((t: any): InviteTier => ({
              label: t.label || '',
              min: n(t.min),
              discountPct: n(t.discount_pct),
              color: t.color || '#0D9488',
            })),
            currentDiscountPct: n(g.current_tier?.discount_pct),
            nextTarget: n(g.next_threshold?.target),
            nextNeeded: n(g.next_threshold?.needed),
            nextDiscountPct: n(g.next_threshold?.discount_pct_at),
            nextSaveTotal: n(g.next_threshold?.save_total_inr),
            toMaxPct: n(g.progress?.to_max_40_pct),
          }
        : null,
    };
  } catch {
    return null;
  }
}
