import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { enforceTeacherFeature } from '@/lib/server/teacher-access';
import { TEACHER_SHARE_SENTENCE, TEACHER_SHARE_OTHER_WORK } from '@/lib/org/pricing';
import { getWidgetStudioState, type JourneyStage, type Recommendation } from '@/lib/server/widgets';
import WidgetCard from '@/components/app/teacher/widgets/WidgetCard';
import EmbedGallery from '@/components/app/teacher/widgets/EmbedGallery';
import ReferralWidget from '@/components/app/teacher/widgets/ReferralWidget';
import ReferralLeaderboard from '@/components/app/teacher/widgets/ReferralLeaderboard';

// Authenticated Widget Studio — noindex, never in the sitemap (§26).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Widgets', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const TONE: Record<Recommendation['tone'], string> = {
  brand: 'border-brand/30 bg-brand-50/60',
  accent: 'border-accent/40 bg-accent/5',
  neutral: 'border-line bg-white',
};

function JourneyStrip({ stages }: { stages: JourneyStage[] }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">My growth journey</p>
      <ol className="mt-4 flex flex-wrap gap-2 p-0">
        {stages.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${s.done ? 'bg-brand text-white' : 'bg-cream text-muted'}`}
              title={s.hint}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${s.done ? 'bg-white/25' : 'bg-white'}`}>{s.done ? '✓' : i + 1}</span>
              {s.label}
            </div>
            {i < stages.length - 1 && <span aria-hidden className="text-line">›</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Metric({ label, value, sub, testid }: { label: string; value: string; sub?: string; testid?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4" data-testid={testid}>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export default async function WidgetStudioPage() {
  await enforceTeacherFeature('widgets');

  const state = await getWidgetStudioState();
  if (!state) redirect('/app/teacher/onboarding');

  const { profile: p, widgets, stages, recommendations, funnel, referral, invite, demand, leaderboard, completeness, embeds, embedsForbidden } = state;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>

      {/* Header + completeness */}
      <header className="flex flex-col gap-4 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-50 to-cream p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">My Widgets</h1>
          <p className="mt-1 max-w-xl text-ink-soft">
            Your NOSTOPS growth system — turn your identity into trust, discovery, students, organisation demand and income. Everything points to your one profile.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div
            className="grid h-20 w-20 place-items-center rounded-full"
            style={{ background: `conic-gradient(#0F766E ${completeness.pct * 3.6}deg, #E2E8F0 0deg)` }}
            data-testid="completeness-ring"
          >
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white">
              <span className="text-lg font-black text-ink">{completeness.pct}%</span>
            </div>
          </div>
          <div className="text-xs text-ink-soft">
            <p className="font-extrabold text-ink">Setup complete</p>
            <p>{completeness.done} / {completeness.total} steps</p>
          </div>
        </div>
      </header>

      {/* Growth journey */}
      <JourneyStrip stages={stages} />

      {/* Recommended for you */}
      {recommendations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Recommended for you</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((r) => (
              <div key={r.title} className={`flex flex-col rounded-2xl border p-4 ${TONE[r.tone]}`} data-testid="recommendation">
                <p className="text-sm font-extrabold text-ink">{r.title}</p>
                <p className="mt-1 flex-1 text-sm text-ink-soft">{r.body}</p>
                <Link href={r.href} className="mt-3 inline-flex w-max items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-600">
                  {r.cta} →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Not-live banner */}
      {!p.publicLive && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Your public profile isn&apos;t live yet, so sharing is paused. Complete your profile &amp; InstaKYC to activate every widget below.
        </div>
      )}

      {/* Widget grid */}
      <section id="widgets">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Widgets · each one has a job</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {widgets.map((w) => (
            <WidgetCard key={w.id} widget={w} profile={p} />
          ))}
        </div>
      </section>

      {/* Grow the network — Refer & Earn */}
      <section id="referral">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-muted">Grow the NOSTOPS network</h2>
        <p className="mb-3 text-sm text-ink-soft">Invite other teachers — earn rewards when they join and get empanelled.</p>
        <ReferralWidget invite={invite} />
        {invite && (
          <div className="mt-4">
            <ReferralLeaderboard data={leaderboard} />
          </div>
        )}
      </section>

      {/* Website embed gallery */}
      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-muted">Website embeds</h2>
        <p className="mb-3 text-sm text-ink-soft">Drop these on your website, LinkedIn or anywhere HTML is allowed — they auto-sync with your NOSTOPS profile.</p>
        <EmbedGallery embeds={embeds} forbidden={embedsForbidden} />
      </section>

      {/* Analytics — genuine funnel */}
      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-muted">Your growth funnel</h2>
        <p className="mb-3 text-sm text-ink-soft">Real data from your NOSTOPS activity. No vanity numbers.</p>

        {/* Individual demand */}
        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <p className="text-sm font-extrabold text-ink">👤 Individual demand</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Metric label="Enquiries" value={String(funnel.individual.enquiries)} testid="funnel-enquiries" />
            <Metric label="Confirmed" value={String(funnel.individual.confirmed)} />
            <Metric label="Sessions" value={String(funnel.individual.completed)} sub="completed" />
            <Metric label="Students" value={String(funnel.individual.students)} />
            <Metric label="Earnings" value={inr(funnel.individual.earnedInr)} sub="from 1:1" />
          </div>
        </div>

        {/* Organisation demand */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <p className="text-sm font-extrabold text-ink">🏢 Organisation demand</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Programme sessions" value={String(funnel.organisation.sessions)} testid="funnel-org-sessions" />
            <Metric label="Confirmed" value={String(funnel.organisation.confirmed)} />
            <Metric label="Earnings" value={inr(funnel.organisation.earnedInr)} />
          </div>
          {demand && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Corporate signals" value={String(demand.corporateSignals)} sub={demand.city ? `in ${demand.city}` : 'in your city'} />
              <Metric label="HR enquiries today" value={String(demand.hrInquiriesToday)} sub="platform, your city" />
              <Metric label="Unmatched batches" value={String(demand.unmatchedBatches)} sub="opportunities" />
              <Metric label="Peer avg / month" value={inr(demand.peerAvgMonthlyInr)} sub="empanelled peers" />
            </div>
          )}
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700">
            {TEACHER_SHARE_SENTENCE} {TEACHER_SHARE_OTHER_WORK}{' '}
            <Link href="/for-organisations" className="underline">See organisation programmes →</Link>
          </p>
        </div>

        {/* Reputation + network */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Rating" value={funnel.reputation.rating ? `${funnel.reputation.rating.toFixed(1)}★` : '—'} sub={`${funnel.reputation.reviews} reviews`} />
          <Metric label="Referral earnings" value={inr(referral?.totalEarned ?? 0)} sub={referral?.code ? `code ${referral.code}` : 'network growth'} />
          <Metric label="Referral available" value={inr(referral?.available ?? 0)} sub="withdrawable" />
        </div>
      </section>

      {/* Honest gap panel — documents missing backend capability (§12/§27) */}
      <section className="rounded-2xl border border-dashed border-line bg-cream/40 p-4 sm:p-5">
        <p className="text-sm font-extrabold text-ink">Not yet tracked</p>
        <p className="mt-1 text-sm text-ink-soft">
          We only show numbers we can measure. These need platform tracking that doesn&apos;t exist yet, so we don&apos;t fake them:
        </p>
        <ul className="mt-2 grid gap-1.5 p-0 text-sm text-muted sm:grid-cols-2">
          <li>• Profile views &amp; widget impressions</li>
          <li>• Widget clicks &amp; click-through rate</li>
          <li>• &ldquo;Where are people finding you?&rdquo; source attribution (WhatsApp / Instagram / QR …)</li>
          <li>• Individual vs organisation traffic split</li>
        </ul>
      </section>
    </div>
  );
}
