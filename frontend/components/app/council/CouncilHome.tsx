import Link from 'next/link';
import type { User } from '@/lib/roles';
import { displayName } from '@/lib/roles';
import {
  getCouncilStats,
  getMyInterviewQueue,
  getMyReviewEarnings,
  getFastTrackQueue,
  type QueueItem,
} from '@/lib/server/guru';
import ClaimPanel from '@/components/app/council/ClaimPanel';

const inr = (v: number) => `₹${Math.round(v || 0).toLocaleString('en-IN')}`;
const fmtNum = (v: number) => {
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
};

const ACTION_META: Record<string, { color: string; label: string }> = {
  schedule: { color: '#F59E0B', label: 'Schedule' },
  conduct: { color: '#14B8A6', label: 'Conduct' },
  decide: { color: '#EF4444', label: 'Decide' },
};

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>{children}</section>;
}

function urgencyLabel(item: QueueItem): string {
  if (item.urgencyHours == null) return '';
  if (item.nextAction === 'conduct') {
    return item.urgencyHours < 24 ? `in ${Math.round(item.urgencyHours)}h` : `in ${Math.round(item.urgencyHours / 24)}d`;
  }
  if (item.nextAction === 'decide' && item.urgencyHours > 0) return `${Math.round(item.urgencyHours / 24)}d overdue`;
  return '';
}

const QUICK_ACTIONS = [
  { href: '/app/council/interviews', icon: '🗂️', title: 'Interview Queue', desc: 'Claim, schedule and decide empanelment interviews', color: '#0F766E' },
  { href: '/app/council/vouch', icon: '🕉️', title: 'Vouch Lineage', desc: 'Attest teachers who claim your parampara — 2 vouches earn the gold ribbon', color: '#0D9488' },
  { href: '/app/council/trust-review', icon: '⚖️', title: 'Trust Review', desc: 'Review empanelled teachers whose identity check has not passed, and record a decision with a note', color: '#B45309' },
  { href: '/app/council/empanelment-decisions', icon: '🏅', title: 'Empanelment Decisions', desc: 'Record the Council interaction and the final decision for teachers who met every free-path item', color: '#0F766E' },
  { href: '/app/council/contribution', icon: '📊', title: 'My Contribution', desc: 'Lifetime reviews, earnings, badges and trend', color: '#0EA5E9' },
  { href: '/app/council/editorial', icon: '📰', title: 'Editorial Picks', desc: 'Hand-pick Teacher of the Month & Featured Teacher', color: '#F59E0B' },
];

export default async function CouncilHome({ user }: { user: User }) {
  const [stats, queue, earnings, ft] = await Promise.all([
    getCouncilStats(),
    getMyInterviewQueue(),
    getMyReviewEarnings(),
    getFastTrackQueue(),
  ]);

  const claimable = (ft?.active ?? []).filter((r) => !r.claimedByGuruId && r.status === 'paid_review_pending');
  const name = displayName(user);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <section className="rounded-2xl bg-brand-700 p-6 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide">
          📿 YOGA GURU · COUNCIL
        </span>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Namaste, {name} 🙏</h1>
        <p className="mt-1 text-sm font-semibold text-white/85">Guide · Preserve · Elevate — the Bharat Yoga tradition.</p>
      </section>

      {/* Available interviews to claim (first-come, first-served) */}
      <ClaimPanel items={claimable.map((r) => ({ requestId: r.requestId, teacherName: r.teacherName, city: r.city, specialties: r.specialties }))} />

      {/* Mission hero */}
      {stats && (
        <section className="rounded-2xl border border-line bg-white p-5" style={{ borderColor: '#F59E0B40' }}>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ backgroundColor: '#F59E0B18' }}>🚩</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold text-ink">100-Organisation Mission</h2>
              <p className="text-xs text-muted">12-month national wellness pilot</p>
            </div>
            <span className="text-2xl font-black" style={{ color: '#F59E0B' }}>{Math.round(stats.mission.percentComplete)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full" style={{ width: `${Math.min(stats.mission.percentComplete, 100)}%`, backgroundColor: '#F59E0B' }} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div><p className="text-lg font-black text-ink">{stats.mission.onboarded}</p><p className="text-[11px] text-muted">Onboarded</p></div>
            <div><p className="text-lg font-black text-ink">{stats.mission.target}</p><p className="text-[11px] text-muted">Target</p></div>
            <div><p className="text-lg font-black" style={{ color: '#0D9488' }}>{fmtNum(stats.mission.livesTouched)}</p><p className="text-[11px] text-muted">Lives touched</p></div>
            <div><p className="text-lg font-black" style={{ color: '#14B8A6' }}>{stats.mission.daysRemaining}d</p><p className="text-[11px] text-muted">Days left</p></div>
          </div>
        </section>
      )}

      {/* My interview queue */}
      {queue && (
        <Section>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0F766E' }}>My interview queue</p>
              <p className="mt-0.5 text-sm font-extrabold text-ink">{queue.counts.activeTotal} pending · {queue.counts.decidedTotal} decided</p>
            </div>
            <Link href="/app/council/interviews" className="shrink-0 text-xs font-bold text-brand-700 hover:underline">Open →</Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border p-2.5" style={{ backgroundColor: '#F59E0B12', borderColor: '#F59E0B40' }}>
              <p className="text-xl font-black" style={{ color: '#F59E0B' }}>{queue.counts.toSchedule}</p>
              <p className="text-[11px] font-semibold text-ink-soft">To schedule</p>
            </div>
            <div className="rounded-xl border p-2.5" style={{ backgroundColor: '#14B8A612', borderColor: '#14B8A640' }}>
              <p className="text-xl font-black" style={{ color: '#14B8A6' }}>{queue.counts.toConduct}</p>
              <p className="text-[11px] font-semibold text-ink-soft">To conduct</p>
            </div>
            <div className="rounded-xl border p-2.5" style={{ backgroundColor: '#EF444412', borderColor: '#EF444440' }}>
              <p className="text-xl font-black" style={{ color: '#EF4444' }}>{queue.counts.toDecide}</p>
              <p className="text-[11px] font-semibold text-ink-soft">To decide</p>
            </div>
          </div>
          <div className="mt-3 divide-y divide-line">
            {queue.items.length === 0 ? (
              <p className="py-3 text-sm font-semibold" style={{ color: '#0D9488' }}>✓ All clear · no actions pending in your queue.</p>
            ) : (
              queue.items.slice(0, 3).map((it) => {
                const m = ACTION_META[it.nextAction] || ACTION_META.schedule;
                const u = urgencyLabel(it);
                return (
                  <Link key={it.requestId} href="/app/council/interviews" className="flex items-center gap-3 py-3 transition hover:opacity-80">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-ink">{it.teacherName}</p>
                      <p className="truncate text-xs text-muted">{it.city || '—'}{it.experienceYears ? ` · ${it.experienceYears}y exp` : ''}{it.specializations.length ? ` · ${it.specializations.slice(0, 2).join(', ')}` : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ color: m.color, backgroundColor: `${m.color}15`, borderColor: `${m.color}40` }}>{m.label}</span>
                      {u && <p className="mt-0.5 text-[11px] font-semibold" style={{ color: it.nextAction === 'decide' ? '#EF4444' : '#94A3B8' }}>{u}</p>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Section>
      )}

      {/* My earnings */}
      {earnings && (
        <section className="rounded-2xl border border-brand/20 bg-brand-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0D9488' }}>My earnings · Council reviews</p>
          <p className="mt-1 text-3xl font-black" style={{ color: '#0D9488' }}>{inr(earnings.lifetimeEarned)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {earnings.totalReviews} review{earnings.totalReviews === 1 ? '' : 's'} · {inr(earnings.perReviewAmount)} per review ({Math.round(earnings.sharePct * 100)}%)
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-brand/15 pt-3 text-center">
            <div><p className="text-base font-black" style={{ color: '#0D9488' }}>{inr(earnings.earned30d)}</p><p className="text-[11px] text-muted">Last 30 days</p></div>
            <div><p className="text-base font-black" style={{ color: '#14B8A6' }}>{earnings.reviews30d}</p><p className="text-[11px] text-muted">Reviews · 30d</p></div>
            <div><p className="text-base font-black" style={{ color: '#0F766E' }}>{earnings.totalReviews > 0 ? Math.round((earnings.approvedCount / earnings.totalReviews) * 100) : 0}%</p><p className="text-[11px] text-muted">Approval rate</p></div>
          </div>
          <p className="mt-3 text-center text-[11px] italic text-muted">Earned upon decision · paid quarterly · flat ₹1,500 per completed 30-min interview — only for designated Empanelment Interviewers.</p>
        </section>
      )}

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-brand/40 hover:bg-brand-50/40">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg" style={{ backgroundColor: `${a.color}15` }}>{a.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-ink">{a.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-ink-soft">{a.desc}</p>
            </div>
            <span className="shrink-0 text-muted">›</span>
          </Link>
        ))}
      </div>

      {/* Teacher quality & lineage */}
      {stats && (
        <Section>
          <h2 className="text-base font-extrabold text-ink">🎗️ Teacher quality & lineage</h2>
          <p className="mt-0.5 text-xs italic text-muted">The strength of NOSTOPS lies in our certified teacher base.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border p-3" style={{ backgroundColor: '#F59E0B0E', borderColor: '#F59E0B30' }}>
              <p className="text-lg font-black" style={{ color: '#F59E0B' }}>{stats.teacherQuality.avgRating}</p><p className="text-[11px] text-muted">Avg rating</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: '#0D94880E', borderColor: '#0D948830' }}>
              <p className="text-lg font-black" style={{ color: '#0D9488' }}>{stats.teacherQuality.avgAttendancePct}%</p><p className="text-[11px] text-muted">Avg attendance</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: '#14B8A60E', borderColor: '#14B8A630' }}>
              <p className="text-lg font-black" style={{ color: '#14B8A6' }}>{fmtNum(stats.teacherQuality.sessionsConducted)}</p><p className="text-[11px] text-muted">Sessions</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-muted">Teacher hierarchy</p>
            <div className="flex h-2.5 overflow-hidden rounded-full">
              <div style={{ flex: stats.teacherQuality.gurus || 1, backgroundColor: '#F59E0B' }} />
              <div style={{ flex: stats.teacherQuality.pracharaks || 1, backgroundColor: '#0F766E' }} />
              <div style={{ flex: stats.teacherQuality.shikshaks || 1, backgroundColor: '#14B8A6' }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-soft">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />Gurus · {stats.teacherQuality.gurus}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#0F766E' }} />Pracharaks · {stats.teacherQuality.pracharaks}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#14B8A6' }} />Shikshaks · {stats.teacherQuality.shikshaks}</span>
            </div>
            <p className="mt-3 rounded-xl bg-brand-50/60 px-3 py-2 text-xs text-ink-soft">
              🛡️ <span className="font-extrabold" style={{ color: '#0D9488' }}>{stats.teacherQuality.empanelled}</span> empanelled · {Math.round((stats.teacherQuality.empanelled / Math.max(stats.teacherQuality.totalTeachers, 1)) * 100)}% of {fmtNum(stats.teacherQuality.totalTeachers)} total
            </p>
          </div>
        </Section>
      )}

      {/* Geographic footprint */}
      {stats && (
        <Section>
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-base font-extrabold text-ink">🌏 Geographic footprint</h2>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: '#0D9488', backgroundColor: '#0D948815' }}>↑ {stats.kpis.monthlyExpansionPct}%</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div><p className="text-lg font-black text-ink">{stats.kpis.citiesActive}</p><p className="text-[11px] text-muted">Cities active</p></div>
            <div><p className="text-lg font-black text-ink">{stats.kpis.statesActive}</p><p className="text-[11px] text-muted">States active</p></div>
          </div>
          {stats.kpis.topDemandCities.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold text-muted">Top-demand cities</p>
              <div className="space-y-2">
                {stats.kpis.topDemandCities.slice(0, 5).map((c) => {
                  const max = Math.max(...stats.kpis.topDemandCities.map((x) => x.demand), 1);
                  return (
                    <div key={c.city} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate text-xs font-semibold text-ink-soft">{c.city}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
                        <div className="h-full rounded-full" style={{ width: `${(c.demand / max) * 100}%`, backgroundColor: '#0F766E' }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-bold text-ink">{c.demand}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {stats.kpis.topDimension && (
            <p className="mt-4 rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
              Most-requested focus: <span className="font-extrabold" style={{ color: stats.kpis.topDimension.color }}>{stats.kpis.topDimension.label}</span> · {stats.kpis.topDimension.pct}% · Body {stats.kpis.dimensionSplit.body} / Mind {stats.kpis.dimensionSplit.mind} / Special needs {stats.kpis.dimensionSplit.specialNeeds}
            </p>
          )}
        </Section>
      )}

      {/* Teacher of the month */}
      {stats?.teacherOfMonth && stats.teacherOfMonth.name && (
        <section className="rounded-2xl border p-5" style={{ borderColor: '#F59E0B40', backgroundColor: '#F59E0B0A' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>⭐ Teacher of the Month · {stats.teacherOfMonth.period}</p>
          <p className="mt-1 text-lg font-black text-ink">{stats.teacherOfMonth.name}</p>
          {stats.teacherOfMonth.note && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{stats.teacherOfMonth.note}</p>}
        </section>
      )}

      {/* Recent events */}
      {stats && stats.recentEvents.length > 0 && (
        <Section>
          <h2 className="text-base font-extrabold text-ink">Recent movement</h2>
          <ul className="mt-3 space-y-2.5 p-0">
            {stats.recentEvents.slice(0, 6).map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
          {stats.refreshNote && <p className="mt-3 text-[11px] italic text-muted">{stats.refreshNote}</p>}
        </Section>
      )}

      <p className="pb-2 text-center text-xs italic text-muted">Council review payouts come from NOSTOPS&apos; share only — a teacher&apos;s 70–85% share on eligible 3-, 6- and 12-month institutional programmes is never touched.</p>
    </div>
  );
}
