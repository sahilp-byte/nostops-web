import Link from 'next/link';
import { getSeekerHome } from '@/lib/server/learner';
import { getPublicStats } from '@/lib/server/public-stats';
import { getReviewableSessions } from '@/lib/server/bookings';
import { getSeekerPendingOneOnOne } from '@/lib/server/audit';
import type { User } from '@/lib/roles';
import { displayName } from '@/lib/roles';
import ReviewRequests from '@/components/app/learner/ReviewRequests';
import PendingPaymentReminder from '@/components/app/learner/PendingPaymentReminder';
import WelcomeSeekerNudge from '@/components/app/learner/WelcomeSeekerNudge';

function greeting(): string {
  // IST (UTC+5:30) time-of-day greeting.
  const istHour = (new Date().getUTCHours() * 60 + new Date().getUTCMinutes() + 330) / 60 % 24;
  if (istHour < 12) return 'Good morning';
  if (istHour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ label, value, target }: { label: string; value?: number; target?: number }) {
  if (value == null) return null;
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-black text-ink">
        {value.toLocaleString('en-IN')}
        {target != null && <span className="text-base font-bold text-muted"> / {target.toLocaleString('en-IN')}</span>}
      </dd>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Find a teacher', href: '/app/discover', desc: 'Browse empanelled, lineage-verified teachers' },
  { label: 'Retreats', href: '/retreats', desc: 'Immersive yoga retreats across India' },
  { label: 'Paramparas', href: '/paramparas', desc: 'Explore recognised yoga lineages' },
];

export default async function LearnerHome({ user }: { user: User }) {
  const [{ programme, teachers }, reviewable, pendingPay, ps] = await Promise.all([
    getSeekerHome(),
    getReviewableSessions(),
    getSeekerPendingOneOnOne(),
    getPublicStats(),
  ]);
  const name = displayName(user);
  const streak = programme?.current_streak_days ?? 0;
  const sessions = programme?.sessions_completed ?? 0;
  const next = programme?.next_session || null;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <WelcomeSeekerNudge />
      {pendingPay.length > 0 && <PendingPaymentReminder rows={pendingPay} />}
      {reviewable.length > 0 && <ReviewRequests sessions={reviewable} />}

      {/* Hero */}
      <section className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50 to-cream p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
          Yoga Seeker · Journey
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {greeting()}, {name}
        </h1>
        <p className="mt-2 text-ink-soft">Small steady practice. Big lasting change.</p>

        <Link
          href="/app/book-journey"
          data-testid="home-book-1on1"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-brand-600"
        >
          🧘 Book a 1:1 session →
        </Link>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl bg-white/80 p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Streak</dt>
            <dd className="mt-1 text-3xl font-black text-ink">{streak}<span className="text-lg text-muted">d</span></dd>
          </div>
          <div className="rounded-xl bg-white/80 p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Sessions</dt>
            <dd className="mt-1 text-3xl font-black text-ink">{sessions}</dd>
          </div>
        </dl>

        {next ? (
          <div className="mt-6 rounded-xl border border-brand/20 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Next session</p>
            <p className="mt-1 font-extrabold text-ink">{next.title || 'Yoga session'}</p>
            <p className="text-sm text-muted">
              {[next.date, next.time].filter(Boolean).join(' · ')}
              {next.teacher_name ? ` · with ${next.teacher_name}` : ''}
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-brand/30 bg-white/60 p-4">
            <p className="font-bold text-ink">No sessions booked yet</p>
            <p className="mt-1 text-sm text-muted">Find a teacher and book your first 1:1 session to begin your journey.</p>
            <Link href="/app/discover" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">
              Explore teachers
            </Link>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-xl font-extrabold tracking-tight text-ink">Quick actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="card group flex h-full flex-col p-5 transition hover:border-brand hover:shadow-sm">
              <span className="text-base font-extrabold tracking-tight text-ink group-hover:text-brand-700">{a.label}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-muted">{a.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* SmartMatch teachers */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Teachers for you</h2>
          <Link href="/app/discover" className="text-sm font-bold text-brand-700 hover:underline">See all ›</Link>
        </div>
        {teachers.length === 0 ? (
          <div className="mt-4 card p-6 text-center">
            <p className="font-semibold text-ink">We&apos;re finding teachers near you</p>
            <p className="mt-1 text-sm text-muted">Browse the full directory of empanelled teachers.</p>
            <Link href="/app/discover" className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">Open directory ›</Link>
          </div>
        ) : (
          <ul className="mt-4 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((t) => (
              <li key={t.teacher_id}>
                <Link href={`/app/teachers/${t.handle}`} className="card group flex h-full items-center gap-3 p-4 transition hover:border-brand hover:shadow-sm">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-black text-brand-700">
                    {(t.name || 'T').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold tracking-tight text-ink group-hover:text-brand-700">{t.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {t.city || 'India'}
                      {t.rating ? ` · ★ ${t.rating.toFixed(1)}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* National movement — same single approved source as the public site (NST-008). */}
      {(ps.organisations > 0 || ps.empanelledTeachers > 0 || ps.councilMembers > 0 || ps.cities > 0) && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">National movement · live</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ps.organisations > 0 && <Stat label="Organisations" value={ps.organisations} target={ps.organisationTarget} />}
            {ps.empanelledTeachers > 0 && <Stat label="Empanelled teachers" value={ps.empanelledTeachers} />}
            {ps.councilMembers > 0 && <Stat label="Council gurus" value={ps.councilMembers} />}
            {ps.cities > 0 && <Stat label="Cities" value={ps.cities} />}
          </dl>
          <Link href="/about" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">Read the full story ›</Link>
        </section>
      )}
    </div>
  );
}
