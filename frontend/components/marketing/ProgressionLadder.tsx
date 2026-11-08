import Link from 'next/link';
import { LEVELS_ORDERED, PROGRESSION_CRITERIA, NOSTOPS_PROMISE, EMPANELLED_TEACHER, type TeacherLevel } from '@/lib/teacher-levels';

// Shared, presentational progression ladder — the single rendering of the
// 3-level path used by BOTH the in-app page (/app/teacher/levels) and the public
// marketing page (/levels). Content comes from the one catalogue in
// lib/teacher-levels.ts (no duplication). `currentLevel` highlights the viewer's
// level when known; `empanelHref` lets each surface point the Empanelled card at
// the right destination (in-app empanelment vs public sign-up).
export default function ProgressionLadder({
  currentLevel = null,
  empanelHref,
}: {
  currentLevel?: TeacherLevel | null;
  empanelHref: string;
}) {
  return (
    <div>
      <div className="space-y-5">
        {LEVELS_ORDERED.map((m) => {
          const isCurrent = currentLevel === m.level;
          return (
            <section
              key={m.level}
              data-testid={`level-card-${m.level}`}
              className="overflow-hidden rounded-2xl border bg-white"
              style={{ borderColor: isCurrent ? m.color : undefined }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 p-5" style={{ background: `linear-gradient(90deg, ${m.color}12, transparent)` }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-black text-white" style={{ backgroundColor: m.color }}>{m.levelLabel.replace('Level ', 'L')}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black text-ink">{m.badgeLabel}</h2>
                      {isCurrent && <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white" style={{ backgroundColor: m.color }}>You are here</span>}
                    </div>
                    <p className="text-sm font-semibold text-ink-soft">{m.name} · {m.sub}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Who it&apos;s for</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{m.whoFor}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Next step</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{m.nextStep}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">What you unlock</p>
                  <ul className="mt-2 space-y-1.5">
                    {m.unlocksDetailed.map((u) => (
                      <li key={u} className="flex items-start gap-2 text-sm text-ink">
                        <span aria-hidden="true" style={{ color: m.color }}>✓</span>
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Empanelled Teacher */}
      <Link href={empanelHref} data-testid="empanelled-card" className="mt-5 flex items-center gap-4 rounded-2xl border border-brand/25 bg-brand-50/50 p-5 transition hover:shadow-sm">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-xl text-white" aria-hidden="true">🎖️</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black text-ink">{EMPANELLED_TEACHER.title}</span>
          <span className="block text-sm text-ink-soft">{EMPANELLED_TEACHER.blurb}</span>
        </span>
        <span className="shrink-0 text-brand-700" aria-hidden="true">→</span>
      </Link>

      {/* Criteria */}
      <div className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Progression is based on transparent criteria</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROGRESSION_CRITERIA.map((c) => (
            <li key={c} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2.5 text-sm font-semibold text-ink-soft">
              <span aria-hidden="true" className="text-brand-700">◆</span> {c}
            </li>
          ))}
        </ul>
      </div>

      {/* NOSTOPS promise */}
      <div className="mt-5 rounded-2xl border border-line bg-ink p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-white/60">The NOSTOPS promise</p>
        <p className="mx-auto mt-2 max-w-xl text-lg font-bold leading-relaxed text-white">{NOSTOPS_PROMISE}</p>
      </div>
    </div>
  );
}
