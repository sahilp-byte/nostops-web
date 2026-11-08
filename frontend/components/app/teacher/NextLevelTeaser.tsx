import Link from 'next/link';
import { levelMeta, type TeacherLevel } from '@/lib/teacher-levels';

type T = (key: string) => string;

// Compact, motivating "one locked perk" preview of the NEXT level for L1/L2
// teachers. Tapping scrolls to the fuller Level-Up guide (#level-up). The single
// marquee perk comes from the canonical lib/teacher-levels headline. Hidden at L3.
export default function NextLevelTeaser({ level, t = (k) => k }: { level: TeacherLevel; t?: T }) {
  if (level >= 3) return null;
  const next = (level + 1) as TeacherLevel;
  const nm = levelMeta(next);
  return (
    <Link
      href="#level-up"
      data-testid="next-level-teaser"
      className="flex items-center gap-4 rounded-2xl border p-4 transition hover:shadow-sm sm:p-5"
      style={{ borderColor: nm.color + '40', background: `linear-gradient(90deg, ${nm.color}12, transparent)` }}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl text-white" style={{ backgroundColor: nm.color }} aria-hidden="true">🔒</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black uppercase tracking-wide" style={{ color: nm.color }}>{t('Unlock at')} {nm.levelLabel}</span>
        <span className="block text-sm font-extrabold text-ink">{nm.headline.perk}</span>
        <span className="block text-xs text-muted">{t(nm.headline.blurb)}</span>
      </span>
      <span className="shrink-0 text-sm font-bold" style={{ color: nm.color }} aria-hidden="true">→</span>
    </Link>
  );
}
