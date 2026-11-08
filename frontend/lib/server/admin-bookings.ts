import { backendFetch } from '@/lib/server/session';

// Admin Bookings data layer (PHASE 6). Reads GET /api/admin/bookings/all — the
// authoritative platform-wide batch booking list. Force-close writes through
// the admin-guarded BFF → POST /api/bookings/{booking_id}/force-close.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type AdminBookingRow = {
  bookingId: string;
  companyName: string;
  hrName: string | null;
  venue: string | null;
  venueCity: string | null;
  batchCapacity: number;
  enrolledCount: number;
  paidCount: number;
  status: string;
  enrollmentOpen: boolean;
  forceClosed: boolean;
  cohortType: string | null;
  createdAt: string | null;
};

function project(b: any): AdminBookingRow {
  return {
    bookingId: str(b.booking_id) || '',
    companyName: str(b.company_name) || 'Batch',
    hrName: str(b.hr_name),
    venue: str(b.venue),
    venueCity: str(b.venue_city),
    batchCapacity: num(b.batch_capacity),
    enrolledCount: num(b.enrolled_count),
    paidCount: num(b.paid_count),
    status: str(b.status) || 'unknown',
    enrollmentOpen: !!b.enrollment_open,
    forceClosed: !!b.force_closed,
    cohortType: str(b.cohort_type),
    createdAt: str(b.created_at),
  };
}

export type AdminBookingsData = {
  rows: AdminBookingRow[];
  total: number;
  statuses: string[];
};

export async function getAdminBookings(): Promise<AdminBookingsData> {
  const res = await backendFetch('/admin/bookings/all');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const rows = (Array.isArray(d.bookings) ? d.bookings : []).map(project).filter((r: AdminBookingRow) => r.bookingId);
  const statuses = Array.from(new Set(rows.map((r: AdminBookingRow) => r.status))).sort() as string[];
  return { rows, total: num(d.total) || rows.length, statuses };
}
