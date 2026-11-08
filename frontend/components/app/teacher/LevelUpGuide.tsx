import Link from 'next/link';
import { levelMeta, type TeacherLevel } from '@/lib/teacher-levels';
import { MIN_AVG_RATING } from '@/lib/empanelment-policy';

type T = (key: string) => string;

// "How to reach the next level" guide for L1/L2 teachers. Honest by design: it
// shows the unlocks gained at the NEXT level (from the canonical
// lib/teacher-levels map) plus the REAL merit signals the Council reviews
// (verification, teaching activity, ratings, reviews) with the teacher's own
// current standing — it never claims a fixed auto-promotion formula.
export default function LevelUpGuide({
  level,
  verified,
  sessions,
  rating,
  reviews,
  t = (k) => k,
}: {
  level: TeacherLevel;
  verified: boolean;
  sessions: number;
  rating: number;
  reviews: number;
  t?: T;
}) {
  if (level >= 3) return null; // already at the top level
  const next = (level + 1) as TeacherLevel;
  const nm = levelMeta(next);

  const signals = [
    { label: t('Get verified'), value: verified ? t('Complete') : t('In progress'), done: verified },
    { label: t('Teaching activity'), value: `${sessions} ${t('paid sessions')}`, done: sessions > 0 },
    // Level 2 = empanelment, so its rating mark follows Empanelment Policy V2.
    { label: t('Student ratings'), value: rating ? `${rating.toFixed(1)}★` : t('No ratings yet'), done: rating >= (next === 2 ? MIN_AVG_RATING : 4.5) },
    { label: t('Verified reviews'), value: `${reviews}`, done: reviews > 0 },
  ];

  return (
    <section
      id="level-up"
      className="rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: nm.color + '40', backgroundColor: nm.color + '08' }}
      data-testid="level-up-guide"
    >
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
        style={{ backgroundColor: nm.color }}
      >
        {t('Next')} · {nm.levelLabel}
      </span>
      <h2 className="mt-2 text-base font-extrabold tracking-tight text-ink">{t('Grow toward')} {nm.badgeLabel}</h2>
      <p className="mt-0.5 text-sm text-muted">{nm.name} · {nm.sub}</p>

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">{t("What you'll unlock")}</p>
      <ul className="mt-2 flex flex-wrap gap-2 p-0">
        {nm.unlocks.map((u) => (
          <li key={u} className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: nm.color + '40', color: nm.color }}>
            🔓 {u}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">{t('What the Council looks for')}</p>
      <ul className="mt-2 grid grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {signals.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span aria-hidden="true" style={{ color: s.done ? '#0D9488' : '#94A3B8' }}>{s.done ? '✓' : '•'}</span>
              {s.label}
            </span>
            <span className="text-xs font-bold text-ink">{s.value}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs text-muted">
        {t('Progression is merit-reviewed by the NOSTOPS Council — based on teaching hours, student outcomes and community contribution. Keep teaching and delighting students to advance.')}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {verified ? (
          <Link href="/app/teacher/refer" className="inline-flex rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">
            {t('Refer & Earn')} →
          </Link>
        ) : (
          <Link href="/app/teacher/empanelment" className="inline-flex rounded-xl px-4 py-2 text-sm font-bold text-white transition" style={{ backgroundColor: nm.color }}>
            {t('Get empanelled')} →
          </Link>
        )}
        <Link href="/app/teacher/levels" data-testid="see-progression-path" className="inline-flex rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">
          {t('See the full progression path')} →
        </Link>
      </div>
    </section>
  );
}
