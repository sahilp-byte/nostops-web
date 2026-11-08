import type { RetreatInsight } from '@/lib/server/venue-insight';

// PROMPT 27 — AI Retreat Intelligence. Three CLEARLY separated sources so nothing
// is passed off as more authoritative than it is:
//   FACT             — verified data (built in code by the page, never by AI)
//   REVIEW SIGNAL    — patterns found in Google reviews
//   AI INTERPRETATION— AI synthesis (feels-like / who / demand / strengths…)
export default function AiRetreatInsight({
  facts,
  insight,
  title = 'AI Retreat Insight',
  subtitle = 'NOSTOPS AI helps you read this retreat — with facts, review patterns and interpretation kept clearly apart.',
  disclaimer = 'AI interpretation is a synthesis, not a promise — it never replaces your teacher, makes no medical claims and guarantees no outcomes. Verify details before booking.',
  testId = 'ai-insight',
}: {
  facts: string[];
  insight: RetreatInsight | null;
  title?: string;
  subtitle?: string;
  disclaimer?: string;
  testId?: string;
}) {
  const interp: { label: string; value?: string }[] = insight
    ? [
        { label: 'What it feels like', value: insight.feelsLike },
        { label: 'Who may enjoy it', value: insight.whoEnjoys },
        { label: 'What reviews consistently praise', value: insight.praise },
        { label: 'How demanding it looks', value: insight.demand },
        { label: 'Venue strengths', value: insight.venueStrengths },
        { label: 'Good to know', value: insight.know },
        { label: 'Practical considerations', value: insight.practical },
      ].filter((x) => x.value)
    : [];
  const hasSignals = !!insight && insight.reviewSignals.length > 0;
  if (facts.length === 0 && !hasSignals && interp.length === 0) return null;

  return (
    <section id="ai-insight" className="scroll-mt-20">
      <div className="rounded-3xl border border-royal/25 bg-royal-50/40 p-6 sm:p-8" data-testid={testId}>
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-royal/15 text-lg">✨</span>
          <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>

        {facts.length > 0 && (
          <div className="mt-5">
            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800">Fact · verified</span>
            <ul className="mt-2 grid list-none gap-1.5 p-0 sm:grid-cols-2">
              {facts.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-soft"><span aria-hidden className="text-emerald-600">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {hasSignals && (
          <div className="mt-5">
            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-amber-800">Review signal · from Google reviews</span>
            <ul className="mt-2 flex flex-wrap gap-2 p-0">
              {insight!.reviewSignals.map((s) => (
                <li key={s} className="list-none rounded-full bg-white px-3 py-1 text-sm font-medium text-ink-soft ring-1 ring-line">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {interp.length > 0 && (
          <div className="mt-5">
            <span className="inline-block rounded-full bg-royal/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-royal">AI interpretation</span>
            <dl className="mt-2 space-y-2.5">
              {interp.map((x) => (
                <div key={x.label}>
                  <dt className="text-xs font-black uppercase tracking-wide text-muted">{x.label}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-ink-soft">{x.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="mt-5 border-t border-royal/15 pt-3 text-[11px] leading-relaxed text-muted">
          {disclaimer}
        </p>
      </div>
    </section>
  );
}
