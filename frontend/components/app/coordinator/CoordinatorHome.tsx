import Link from 'next/link';
import { getCoordinatorDashboard, type CoordMilestone } from '@/lib/server/coordinator';
import { citySlug } from '@/lib/server/cities';
import CopyLinkButton from '@/components/CopyLinkButton';

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

const M_ICON: Record<string, string> = {
  first_5_teachers: '👥',
  first_10_empaneled: '🎗️',
  first_corp: '🏢',
  city_25: '🚩',
  first_renewal: '🔄',
  retention_5: '🛡️',
};

function Milestone({ m }: { m: CoordMilestone }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-base">{M_ICON[m.key] || '🏆'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-extrabold text-ink">{m.label}</p>
          <span className={`shrink-0 text-sm font-bold ${m.done ? 'text-brand-700' : 'text-ink'}`}>{inr(m.bonus)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full" style={{ width: `${Math.min(m.pct, 100)}%`, backgroundColor: m.done ? '#0D9488' : '#0EA5E9' }} />
        </div>
        <p className="mt-1 text-xs font-semibold text-muted">{m.done ? '✓ Unlocked' : `${m.current} / ${m.target}`}</p>
      </div>
    </div>
  );
}

/** Coordinator Hub — the coordinator's own dashboard. Renders an access-required
 *  empty state for users who aren't coordinators. */
export default async function CoordinatorHome() {
  const d = await getCoordinatorDashboard();

  if (!d) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🔒</span>
          <h1 className="mt-2 text-lg font-black text-ink">Coordinator access required</h1>
          <p className="mt-1 text-sm text-ink-soft">The Coordinator Hub is for empanelled teachers appointed as a City Coordinator. Reach out to the Council if you&apos;d like to serve your city.</p>
          <Link href="/app/coordinator/agreement" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">See how the programme works →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <section className="rounded-2xl bg-brand-700 p-6 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide">⭐ CITY COORDINATOR</span>
        <h1 className="mt-2 text-2xl font-black tracking-tight">{d.name}</h1>
        <p className="mt-1 text-sm font-semibold text-white/85">📍 {d.city || 'City not set'} · {d.teacherCount} teacher{d.teacherCount === 1 ? '' : 's'} assigned</p>
      </section>

      {/* City hub — local geo presence */}
      {d.city && (
        <section className="rounded-2xl border border-line bg-white p-5" data-testid="coordinator-city-hub">
          <h2 className="text-base font-extrabold text-ink">📍 Your {d.city} hub</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Share your city&apos;s public teacher page to grow local demand.</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-cream/50 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-testid="city-hub-path">/yoga-teachers/{citySlug(d.city)}</span>
            <CopyLinkButton path={`/yoga-teachers/${citySlug(d.city)}`} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Teachers</p>
              <p className="mt-0.5 text-lg font-black text-ink">{d.teacherCount}</p>
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Empanelled</p>
              <p className="mt-0.5 text-lg font-black text-ink">{d.teachers.filter((t) => t.isEmpanelled).length}</p>
            </div>
          </div>
          <Link href={`/yoga-teachers/${citySlug(d.city)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">
            Open public city page →
          </Link>
        </section>
      )}

      {/* Institutional events in your city — operational record (§14) */}
      <Link href="/app/coordinator/institutional" className="block rounded-2xl border border-line bg-white p-5 transition hover:border-brand/40" data-testid="coordinator-institutional-link">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-ink">🏢 Institutional events{d.city ? ` in ${d.city}` : ''}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">See the company, institution and startup-group programmes running in your city. You support exceptions — you don&apos;t approve events.</p>
          </div>
          <span className="shrink-0 text-sm font-bold text-brand-700">View →</span>
        </div>
      </Link>

      {/* MTD earnings */}
      <section className="rounded-2xl border border-brand/20 bg-brand-50/50 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Month-to-date coordinator earnings</p>
        <p className="mt-1 text-3xl font-black text-ink">{inr(d.mtdEarning)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-brand/15 pt-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Gross this month</p><p className="mt-0.5 text-base font-black text-ink">{inr(d.mtdGross)}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Bookings</p><p className="mt-0.5 text-base font-black text-ink">{d.mtdBookings}</p></div>
        </div>
        {d.revenueShareNote && <p className="mt-3 text-xs italic text-muted">{d.revenueShareNote}</p>}
      </section>

      {/* Milestones */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">🏆 Milestone earnings</h2>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-brand/20 bg-brand-50/50 p-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Earned so far</p><p className="text-xl font-black text-brand-700">{inr(d.earnedBonus)}</p></div>
          <div className="text-right"><p className="text-xs font-bold uppercase tracking-wider text-muted">Total potential</p><p className="text-xl font-black" style={{ color: '#0EA5E9' }}>{inr(d.totalPotential)}</p></div>
        </div>
        <div className="mt-2 divide-y divide-line">
          {d.milestones.map((m) => <Milestone key={m.key} m={m} />)}
        </div>
      </section>

      {/* Teachers */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">Your teachers ({d.teachers.length})</h2>
          <Link href="/app/coordinator/roster" className="shrink-0 text-sm font-bold text-brand-700 hover:underline">View full roster →</Link>
        </div>
        {d.teachers.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No teachers linked yet. New empanelled teachers within 25 km of your pin auto-attach on their next login.</p>
        ) : (
          <div className="mt-3 divide-y divide-line">
            {d.teachers.map((t) => (
              <div key={t.teacherId} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">{(t.name || '?').charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink">{t.name}</p>
                  <p className="truncate text-xs text-muted">{t.city || 'City TBD'}{t.isEmpanelled ? ' · Empanelled' : ''}</p>
                </div>
                {t.handle && <a href={`/teachers/${t.handle}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-bold text-brand-700 hover:underline">View →</a>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <Link href="/app/coordinator/agreement" className="flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
        📖 Role &amp; Responsibilities
      </Link>
      <p className="text-center text-xs italic text-muted">Milestone bonuses are paid within 7 days of unlock, from NOSTOPS&apos; share only. The teacher&apos;s 70–85% share on eligible 3-, 6- and 12-month institutional programmes is never touched.</p>
    </div>
  );
}
