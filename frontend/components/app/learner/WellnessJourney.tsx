import Link from 'next/link';
import type { WellnessData } from '@/lib/server/wellness';

// Presentational "My Wellness Journey" — reads the aggregated real backend data
// (no client logic, no fake numbers). Honest empty states throughout.
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const RULE_LABEL: Record<string, string> = {
  streak_day: 'Daily streak',
  session_attendance: 'Attend a session',
  share_conversion: 'A friend joins',
  vouch_attendance: 'Vouched attendance',
};

export default function WellnessJourney({ data }: { data: WellnessData }) {
  const { journey, karma, streak, leaderboard, champion } = data;
  const s = journey.stats;
  const streakDays = Math.max(streak.streak || 0, s.current_streak || 0);

  return (
    <div className="space-y-6" data-testid="wellness-journey">
      {/* Headline stats */}
      <section aria-label="Your wellness stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions attended" value={String(s.sessions_attended ?? 0)} />
        <Stat label="Current streak" value={`${streakDays} ${streakDays === 1 ? 'day' : 'days'}`} hint={streak.today_done ? 'Practised today ✓' : 'Practise today to keep it going'} />
        <Stat label="Avg rating given" value={s.avg_rating ? s.avg_rating.toFixed(1) : '—'} />
        <Stat label="Mood improvement" value={s.mood_improvement ? `+${s.mood_improvement}%` : '—'} />
      </section>

      {/* Daily tip */}
      {journey.daily_tip ? (
        <section className="rounded-2xl border border-brand/25 bg-brand-50/50 p-5" aria-label="Daily tip">
          <p className="text-[11px] font-black uppercase tracking-wider text-brand-700">Today&apos;s tip</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{journey.daily_tip}</p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Karma */}
        <section className="rounded-2xl border border-line bg-white p-5" aria-label="Karma points">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold tracking-tight text-ink">Karma points</h2>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-black text-amber-800">{karma?.balance ?? 0}</span>
          </div>
          {karma ? (
            <>
              <p className="mt-1 text-xs text-muted">
                {karma.lifetime_earned} earned · {karma.lifetime_redeemed} redeemed lifetime
              </p>
              <ul className="mt-3 flex flex-wrap gap-2 p-0">
                {Object.entries(karma.earn_rules || {}).map(([k, v]) => (
                  <li key={k} className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                    +{v} · {RULE_LABEL[k] ?? k.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Start attending sessions to earn karma points.</p>
          )}
        </section>

        {/* Community rank */}
        <section className="rounded-2xl border border-line bg-white p-5" aria-label="Community standing">
          <h2 className="text-base font-extrabold tracking-tight text-ink">Community standing</h2>
          {leaderboard && leaderboard.rank ? (
            <div className="mt-2 flex items-end gap-3">
              <p className="text-3xl font-black leading-none text-brand-700">#{leaderboard.rank}</p>
              <p className="pb-1 text-sm text-muted">
                of {leaderboard.pool_size} nearby · {leaderboard.referrals} referral{leaderboard.referrals === 1 ? '' : 's'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Invite friends and attend sessions to climb your local leaderboard.</p>
          )}
        </section>
      </div>

      {/* Wellness Champion */}
      {champion?.available ? (
        <section className="rounded-2xl border border-line bg-white p-5" aria-label="Wellness Champion">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold tracking-tight text-ink">Wellness Champion</h2>
            {champion.badge_label ? (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: (champion.badge_color || '#0D9488') + '22', color: champion.badge_color || '#0D9488' }}>
                {champion.badge_icon ? `${champion.badge_icon} ` : ''}{champion.badge_label}
              </span>
            ) : (
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold text-muted">No badge yet</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {champion.total_invites} colleague{champion.total_invites === 1 ? '' : 's'} invited to their workplace pilot.
          </p>
          {champion.next_milestone ? (
            <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-sm text-ink">
              Invite <strong>{champion.next_milestone.invites_needed}</strong> more to unlock <strong>{champion.next_milestone.badge_to_unlock}</strong>.
              {' '}
              <Link href="/for-organisations/companies" className="font-bold text-brand-700 underline">Bring NOSTOPS to your workplace →</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Upcoming sessions */}
      <section aria-label="Upcoming sessions">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Upcoming sessions</h2>
        {journey.upcoming_sessions.length > 0 ? (
          <ul className="mt-3 space-y-2 p-0">
            {journey.upcoming_sessions.slice(0, 5).map((u, i) => {
              const title = String(u.title ?? u.name ?? 'Session');
              const when = String(u.date ?? u.session_at ?? u.time ?? '');
              return (
                <li key={i} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-ink">{title}</span>
                  {when ? <span className="text-xs text-muted">{when}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-line bg-white p-6 text-center">
            <p className="text-sm text-muted">No upcoming sessions yet.</p>
            <Link href="/app/discover?book=1" className="mt-3 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
              Book a 1:1 session →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
