import Link from 'next/link';
import type { Metadata } from 'next';
import { enforceTeacherFeature } from '@/lib/server/teacher-access';
import { getTeacherSchedule, type ScheduledSession } from '@/lib/server/teacher-sessions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sessions', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function slotParts(ts: number | null): { d: string; m: string; time: string } {
  if (!ts) return { d: '—', m: '', time: 'Time TBD' };
  const dt = new Date(ts);
  return {
    d: dt.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }),
    m: dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }),
    time: dt.toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  };
}

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-brand-50 text-brand-700' },
  scheduled: { label: 'Scheduled', cls: 'bg-brand-50 text-brand-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  session_completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  attended: { label: 'Attended', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  no_show: { label: 'No-show', cls: 'bg-red-50 text-red-600' },
};

function SessionCard({ s }: { s: ScheduledSession }) {
  const p = slotParts(s.whenTs);
  const st = STATUS[s.status.toLowerCase()] || { label: s.status, cls: 'bg-cream text-muted' };
  const meta = [
    p.time,
    s.mode ? (s.mode === 'online' ? '💻 Online' : s.mode === 'in-person' ? '📍 In-person' : s.mode) : null,
    s.location,
    s.participants ? `${s.participants} participants` : null,
  ].filter(Boolean).join(' · ');
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4" data-testid="session-card">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-center">
        <span className="text-lg font-black leading-none text-brand-700">{p.d}</span>
        <span className="text-[10px] font-bold uppercase text-muted">{p.m}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-extrabold text-ink">{s.title}</p>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        </div>
        <p className="truncate text-xs text-muted">{meta}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="rounded-full bg-cream px-2 py-0.5 font-bold text-ink-soft">{s.kind === 'one_on_one' ? '1:1 session' : 'Class'}</span>
          {s.amountInr ? <span className="text-muted">You earn <span className="font-bold text-brand-700">{inr(s.amountInr)}</span></span> : null}
        </div>
        {s.notes && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">“{s.notes}”</p>}
      </div>
    </article>
  );
}

export default async function TeacherSessionsPage() {
  await enforceTeacherFeature('sessions');

  const { upcoming, past, next, total, earnedInr } = await getTeacherSchedule();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Your sessions</h1>
          <p className="mt-1 text-ink-soft">Your teaching schedule · {total} {total === 1 ? 'session' : 'sessions'}{earnedInr ? ` · ${inr(earnedInr)} booked` : ''}</p>
        </div>
        <Link href="/app/teacher/bookings" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Booking requests →</Link>
      </div>

      {next && (
        <section className="rounded-2xl border border-brand/25 bg-brand-50/50 p-4" data-testid="next-session">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Next up</p>
          <p className="mt-1 text-base font-extrabold text-ink">{next.title}{next.studentName ? ` · ${next.studentName}` : ''}</p>
          <p className="text-sm text-ink-soft">{[next.date, next.time, next.location].filter(Boolean).join(' · ') || 'Details coming soon'}</p>
        </section>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🧘‍♀️</span>
          <p className="mt-2 text-base font-extrabold text-ink">No sessions scheduled yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            Confirmed 1:1 sessions and the group/corporate classes you&apos;re assigned to will appear here as your teaching calendar.
            Incoming requests you still need to accept live under Booking requests.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/app/teacher/offerings" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Set up 1:1 sessions →</Link>
            <Link href="/app/teacher/bookings" className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">View booking requests</Link>
          </div>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Upcoming ({upcoming.length})</h2>
              <div className="space-y-3">{upcoming.map((s) => <SessionCard key={s.id} s={s} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Past</h2>
              <div className="space-y-3">{past.map((s) => <SessionCard key={s.id} s={s} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
