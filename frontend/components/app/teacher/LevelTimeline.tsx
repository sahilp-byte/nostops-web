import type { JourneyMilestone } from '@/lib/server/teacher';

type T = (key: string) => string;

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

// Dashboard "Your NOSTOPS journey" timeline. Renders the milestones a teacher has
// earned (logical order, not date-sorted, so it always reads forward even if a
// backfilled timestamp is odd) and the current level as the capstone. All dates
// are real backend timestamps (see getTeacherJourney).
export default function LevelTimeline({
  milestones,
  levelLabel,
  color,
  t = (k) => k,
}: {
  milestones: JourneyMilestone[];
  levelLabel: string;
  color: string;
  t?: T;
}) {
  if (!milestones.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="level-timeline">
      <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Your NOSTOPS journey')}</h2>
      <p className="mt-1 text-sm text-muted">{t('Milestones you have earned so far.')}</p>

      <ol className="mt-4 p-0">
        {milestones.map((m, i) => {
          const d = m.done ? fmt(m.date) : null;
          const last = i === milestones.length - 1;
          return (
            <li key={m.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-line" aria-hidden="true" />}
              <span
                className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-black text-white"
                style={{ backgroundColor: m.done ? '#0D9488' : '#CBD5E1' }}
              >
                {m.done ? '✓' : i + 1}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-sm font-bold text-ink">{t(m.label)}</span>
                <span className="block text-xs text-muted">{m.done ? d || t('Completed') : t('Not yet')}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: color + '12' }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="text-sm font-extrabold" style={{ color }}>{t('Current level')}: {levelLabel}</span>
      </div>
    </section>
  );
}
