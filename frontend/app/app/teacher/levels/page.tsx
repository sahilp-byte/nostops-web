import type { Metadata } from 'next';
import Link from 'next/link';
import { getTeacherAccessContext } from '@/lib/server/teacher-access';
import { PROGRESSION_INTRO, type TeacherLevel } from '@/lib/teacher-levels';
import ProgressionLadder from '@/components/marketing/ProgressionLadder';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Progression Path · NOSTOPS', robots: { index: false, follow: false } };

export default async function TeacherLevelsPage() {
  // Highlight the viewer's current level when they are a teacher (level is
  // authoritative, backend-derived). Non-teachers still see the full ladder.
  const ctx = await getTeacherAccessContext().catch(() => null);
  const currentLevel: TeacherLevel | null =
    ctx?.role === 'teacher' && ctx.status && ctx.status.level !== 'none' ? (ctx.status.level as TeacherLevel) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{PROGRESSION_INTRO.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">{PROGRESSION_INTRO.headline}</h1>
        </div>
        <Link href="/app" className="shrink-0 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Dashboard</Link>
      </div>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-soft">{PROGRESSION_INTRO.blurb}</p>

      <div className="mt-8">
        <ProgressionLadder currentLevel={currentLevel} empanelHref="/app/teacher/empanelment" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/app/teacher/empanelment" data-testid="cta-empanel" className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Get Empanelled on NOSTOPS</Link>
        <Link href="/council" data-testid="cta-certifies" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">Who Certifies These Levels?</Link>
      </div>
    </div>
  );
}
