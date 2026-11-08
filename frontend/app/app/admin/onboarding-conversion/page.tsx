import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getOnboardingAnalytics } from '@/lib/server/admin-onboarding-analytics';
import { fmtDate, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Onboarding Conversion', robots: { index: false, follow: false } };

const SCREENS = ['Basics', 'Lineage', 'Specs', 'Bio', 'Review'];
const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—');

export default async function OnboardingConversionPage() {
  await requireAdminUser();
  const a = await getOnboardingAnalytics();

  if (!a) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-black tracking-tight text-ink">Onboarding Conversion</h1>
        <p className="mt-4 rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft" data-testid="obc-unavailable">
          The report couldn&apos;t be loaded right now. Nothing is estimated in its place. Please try again shortly.
        </p>
      </div>
    );
  }

  const since = a.instrumentationDate ? fmtDate(a.instrumentationDate) : 'the instrumentation date';
  const kpis = [
    { label: 'Registrations', value: a.registrations },
    { label: 'Onboarding started', value: a.started },
    { label: 'Resumed a draft', value: a.resumed },
    { label: 'Profiles created', value: a.profileCreated, tone: 'text-brand-700' },
    { label: 'Profile creation failed', value: a.profileFailed, tone: a.profileFailed > 0 ? 'text-accent-600' : 'text-ink' },
    { label: 'Distinct teachers', value: a.distinctSubjects },
  ];
  const funnel = [
    { label: 'Onboarding started', value: a.started },
    ...SCREENS.map((s, i) => ({ label: `Screen ${i + 1} · ${s} completed`, value: a.screenCompletions[String(i + 1)] })),
    { label: 'Profile created', value: a.profileCreated },
  ];

  return (
    <div className="mx-auto max-w-4xl" data-testid="obc-page">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Growth</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Onboarding Conversion</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        How teachers move through the five onboarding screens. Counts are distinct teachers ({a.countedBy || 'teacher → account → visitor'}).
      </p>
      <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="obc-not-recorded">
        Recording started on <strong>{since}</strong>. Anything before that is <strong>not recorded</strong>; no historical numbers are estimated.
        Test runs from the preview site are included in these counts.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="obc-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${k.tone || 'text-ink'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5" data-testid="obc-funnel">
        <h2 className="text-lg font-black text-ink">Screen-by-screen conversion</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 font-bold">Step</th>
              <th className="py-2 text-right font-bold">Teachers</th>
              <th className="py-2 text-right font-bold">Of started</th>
              <th className="py-2 text-right font-bold">From previous</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((f, i) => (
              <tr key={f.label} className="border-t border-line">
                <td className="py-2.5 text-ink">{f.label}</td>
                <td className="py-2.5 text-right font-bold tabular-nums text-ink">{f.value}</td>
                <td className="py-2.5 text-right tabular-nums text-ink-soft">{i === 0 ? '—' : pct(f.value, a.started)}</td>
                <td className="py-2.5 text-right tabular-nums text-ink-soft">{i === 0 ? '—' : pct(f.value, funnel[i - 1].value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5" data-testid="obc-abandonment">
        <h2 className="text-lg font-black text-ink">Abandonment by last screen</h2>
        <p className="mt-1 text-xs text-muted">Teachers who stopped with this as the last screen they reached, without creating a profile.</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {SCREENS.map((s, i) => (
            <div key={s} className="rounded-xl bg-cream p-3 text-center">
              <p className="text-xl font-black tabular-nums text-ink">{a.abandonmentByLastScreen[String(i + 1)]}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-muted">{i + 1} · {s}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 text-xs text-muted">Generated {a.generatedAt ? fmtDateTime(a.generatedAt) : 'just now'} by the NOSTOPS backend.</p>
    </div>
  );
}
