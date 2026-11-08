import type { Metadata } from 'next';
import Link from 'next/link';
import { getMyBookings, type Booking, toReviewable } from '@/lib/server/bookings';
import { inr } from '@/lib/format';
import SessionCountdown from '@/components/app/SessionCountdown';
import AddToCalendar from '@/components/AddToCalendar';
import ReviewRequests from '@/components/app/learner/ReviewRequests';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Bookings', robots: { index: false, follow: false } };

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-brand-50 text-brand-700' },
  paid_pending_teacher: { label: 'Awaiting teacher', cls: 'bg-amber-50 text-amber-700' },
  pending_payment: { label: 'Payment pending', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-cream text-ink-soft' },
  session_completed: { label: 'Completed', cls: 'bg-cream text-ink-soft' },
  student_completed: { label: 'Completed', cls: 'bg-cream text-ink-soft' },
  teacher_completed: { label: 'Completed', cls: 'bg-cream text-ink-soft' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700' },
  declined_by_teacher: { label: 'Declined', cls: 'bg-red-50 text-red-700' },
  refunded: { label: 'Refunded', cls: 'bg-red-50 text-red-700' },
  refunded_teacher_decline: { label: 'Refunded', cls: 'bg-red-50 text-red-700' },
};

function statusOf(s: string) {
  return STATUS_STYLE[s.toLowerCase()] || { label: s.replace(/_/g, ' '), cls: 'bg-cream text-ink-soft' };
}

function fmt(ts: number | null): string {
  if (ts == null) return 'Time to be confirmed';
  return new Date(ts).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function BookingCard({ b, past = false }: { b: Booking; past?: boolean }) {
  const st = statusOf(b.status);
  return (
    <li className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-extrabold tracking-tight text-ink">{b.teacherName}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        </div>
        <p className="mt-1 text-sm text-muted">1:1 personalised session · {fmt(b.slotTs)}</p>
        {b.notes && <p className="mt-1 line-clamp-1 text-sm text-ink-soft">“{b.notes}”</p>}
        {!past && b.slotTs != null && (
          <SessionCountdown
            slotTs={b.slotTs}
            joinHref={b.teacherWhatsapp ? `https://wa.me/${b.teacherWhatsapp.replace(/\D/g, '')}` : null}
            joinLabel="Join via WhatsApp →"
          />
        )}
        {!past && b.slotTs != null && (
          <div className="mt-2">
            <AddToCalendar
              title={`1:1 yoga session with ${b.teacherName}`}
              start={b.slotTs}
              end={b.slotTs + 60 * 60000}
              details="Your NOSTOPS 1:1 session"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 sm:flex-col sm:items-end">
        {b.amount != null && <span className="text-lg font-black text-ink">₹{inr(b.amount)}</span>}
        {b.profileHandle && past ? (
          <Link
            href={`/app/teachers/${b.profileHandle}?review=1`}
            className="text-sm font-bold text-brand-700 hover:underline"
            data-testid="booking-review-link"
          >
            Leave a review ›
          </Link>
        ) : b.profileHandle ? (
          <Link href={`/app/teachers/${b.profileHandle}`} className="text-sm font-bold text-brand-700 hover:underline" data-testid="booking-teacher-link">
            View teacher ›
          </Link>
        ) : b.teacherHandle || b.teacherId ? (
          <span className="text-xs font-semibold text-muted" data-testid="booking-teacher-unavailable">
            Teacher profile unavailable
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default async function BookingsPage() {
  const { upcoming, past } = await getMyBookings();
  const empty = upcoming.length === 0 && past.length === 0;
  const reviewable = toReviewable(past);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">My bookings</h1>
      <p className="mt-2 text-ink-soft">Your 1:1 yoga sessions, upcoming and past.</p>

      {reviewable.length > 0 && (
        <div className="mt-6">
          <ReviewRequests sessions={reviewable} />
        </div>
      )}

      {empty ? (
        <div className="mt-6 card p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">🧘</div>
          <p className="mt-4 font-semibold text-ink">No sessions booked yet</p>
          <p className="mt-1 text-sm text-muted">Find a teacher and book your first 1:1 session to begin your journey.</p>
          <Link
            href="/app/discover"
            className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Discover teachers
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          <section>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 card p-5 text-sm text-muted">No upcoming sessions. Book your next practice from Discover.</p>
            ) : (
              <ul className="mt-3 list-none space-y-3 p-0">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} b={b} />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-extrabold tracking-tight text-ink">Past</h2>
              <ul className="mt-3 list-none space-y-3 p-0">
                {past.map((b) => (
                  <BookingCard key={b.id} b={b} past />
                ))}
              </ul>
            </section>
          )}

          <p className="rounded-xl border border-line bg-cream/60 p-4 text-center text-xs text-muted">
            Need to change or cancel a session? Reach your teacher through NOSTOPS support and we&apos;ll help you
            reschedule.
          </p>
        </div>
      )}
    </div>
  );
}
