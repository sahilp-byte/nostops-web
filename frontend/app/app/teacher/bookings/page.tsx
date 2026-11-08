import Link from 'next/link';
import type { Metadata } from 'next';
import { enforceTeacherFeature } from '@/lib/server/teacher-access';
import { getOneOnOneBookings, type OneOnOneBooking } from '@/lib/server/one-on-one';
import { titleCase } from '@/lib/format';
import BookingActions from '@/components/app/teacher/BookingActions';
import SessionCountdown from '@/components/app/SessionCountdown';
import PracticeNote from '@/components/app/teacher/PracticeNote';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bookings', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const NINETY_DAYS = 90 * 86400000;

function statusBadge(b: OneOnOneBooking): { label: string; cls: string } {
  const s = b.status.toLowerCase();
  if (b.awaitingTeacher) return { label: 'Needs your confirmation', cls: 'bg-amber-50 text-amber-700' };
  if (s === 'pending_payment') return { label: 'Awaiting payment', cls: 'bg-cream text-muted' };
  if (s === 'session_completed' || s === 'completed' || b.teacherCompletedAt) return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' };
  if (s.includes('declin')) return { label: 'Declined', cls: 'bg-red-50 text-red-600' };
  if (s.includes('refund')) return { label: 'Refunded', cls: 'bg-red-50 text-red-600' };
  if (s === 'cancelled' || s === 'canceled' || s === 'expired') return { label: titleCase(s), cls: 'bg-cream text-muted' };
  if (b.teacherConfirmedAt || s === 'confirmed' || s === 'scheduled' || s === 'paid') return { label: 'Confirmed', cls: 'bg-brand-50 text-brand-700' };
  return { label: titleCase(s), cls: 'bg-cream text-muted' };
}

function slotParts(ts: number | null): { d: string; m: string; time: string } {
  if (!ts) return { d: '—', m: '', time: 'Slot TBD' };
  const dt = new Date(ts);
  return {
    d: dt.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }),
    m: dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }),
    time: dt.toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  };
}

function BookingCard({ b, past = false }: { b: OneOnOneBooking; past?: boolean }) {
  const s = slotParts(b.slotTs);
  const st = statusBadge(b);
  return (
    <article className="rounded-2xl border border-line bg-white p-4" data-testid="booking-card">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-center">
          <span className="text-lg font-black leading-none text-brand-700">{s.d}</span>
          <span className="text-[10px] font-bold uppercase text-muted">{s.m}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-extrabold text-ink">{b.studentName}</p>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-xs text-muted">{s.time} · 1:1 session</p>
          {b.notes && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">“{b.notes}”</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted">Fee <span className="font-bold text-ink">{inr(b.amountInr)}</span></span>
            <span className="text-muted">You earn <span className="font-bold text-brand-700">{inr(b.earnInr)}</span></span>
            {b.declinedReason && <span className="text-red-600">Declined: {b.declinedReason}</span>}
            {b.studentPhone && (
              <a href={`https://wa.me/${b.studentPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 hover:underline">
                WhatsApp →
              </a>
            )}
          </div>
          <BookingActions
            bookingId={b.id}
            paymentId={b.paymentId}
            awaitingTeacher={b.awaitingTeacher}
            canComplete={b.canComplete}
            canReassign={b.canReassign}
          />
          {!past && b.slotTs != null && (
            <SessionCountdown
              slotTs={b.slotTs}
              joinHref={b.studentPhone ? `https://wa.me/${b.studentPhone.replace(/\D/g, '')}` : null}
              joinLabel="Join via WhatsApp →"
            />
          )}
          {past && b.slotTs != null && Date.now() - b.slotTs <= NINETY_DAYS && (
            <PracticeNote bookingId={b.id} studentName={b.studentName} />
          )}
        </div>
      </div>
    </article>
  );
}

export default async function TeacherBookingsPage() {
  await enforceTeacherFeature('bookings');

  const { total, earnedInr, bookings } = await getOneOnOneBookings();
  const now = Date.now();
  const needsAction = bookings.filter((b) => b.awaitingTeacher);
  const upcoming = bookings.filter((b) => !b.awaitingTeacher && b.slotTs && b.slotTs >= now && !b.isTerminal).sort((a, b) => (a.slotTs ?? 0) - (b.slotTs ?? 0));
  const past = bookings.filter((b) => !b.awaitingTeacher && !(b.slotTs && b.slotTs >= now && !b.isTerminal)).sort((a, b) => (b.slotTs ?? 0) - (a.slotTs ?? 0));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Your bookings</h1>
        <p className="mt-1 text-ink-soft">{total} one-to-one {total === 1 ? 'session' : 'sessions'} · {inr(earnedInr)} earned</p>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🗓️</span>
          <p className="mt-2 text-base font-extrabold text-ink">No bookings yet</p>
          <p className="mt-1 text-sm text-ink-soft">When a learner books a 1:1 session, it’ll appear here — with actions to confirm, complete or reassign.</p>
          <Link href="/app/teacher/offerings" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Set up your 1:1 sessions →</Link>
        </div>
      ) : (
        <>
          {needsAction.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-amber-700">Needs your action ({needsAction.length})</h2>
              <div className="space-y-3">{needsAction.map((b) => <BookingCard key={b.id} b={b} />)}</div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Upcoming</h2>
              <div className="space-y-3">{upcoming.map((b) => <BookingCard key={b.id} b={b} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Past &amp; other</h2>
              <div className="space-y-3">{past.map((b) => <BookingCard key={b.id} b={b} past />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
