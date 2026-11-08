import Link from 'next/link';
import type { Metadata } from 'next';
import { getTeacherAccessContext } from '@/lib/server/teacher-access';
import { levelMeta } from '@/lib/teacher-levels';
import { getCoordinatorApplied } from '@/lib/server/coordinator-local';
import CoordinatorApplyForm from '@/components/app/coordinator/CoordinatorApplyForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Apply as City Coordinator', robots: { index: false, follow: false } };

// City Coordinator application — the eligibility gate. The role is EXCLUSIVELY
// for empanelled NOSTOPS teachers at Yoga Level 2 (Yoga Pracharak) or Level 3
// (Yoga Guru). Eligibility is derived SERVER-SIDE from the authenticated
// teacher's record (deriveTeacherStatus) — never from anything client-supplied —
// so a Level 1 teacher can never reach or submit the application through the
// website. (The parent /app layout already redirects anonymous users to /login.)
export default async function CoordinatorApplyPage() {
  const ctx = await getTeacherAccessContext();
  const status = ctx.status;
  // The Council of Gurus persona is the senior-most tier — Level 3 (Yoga Guru) by
  // definition — but carries no teacher "self" record, so deriveTeacherStatus()
  // yields no level for them. Treat the council role as an eligible Level 3,
  // matching the backend which already grants Council Gurus full host-eligibility.
  const isCouncil = ctx.role === 'council';
  const statusEmpanelled = status?.empanelment === 'empanelled';
  const statusLevel = typeof status?.level === 'number' ? status.level : null;
  const eligible = isCouncil || (statusEmpanelled && (statusLevel === 2 || statusLevel === 3));
  const empanelled = isCouncil || statusEmpanelled;
  const level = statusLevel ?? (isCouncil ? 3 : null);
  const levelLabel = level && level >= 1 && level <= 3 ? levelMeta(level as 1 | 2 | 3).fullLabel : null;
  const applied = eligible ? await getCoordinatorApplied() : { applied: false as const };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/city-coordinator" className="text-sm font-bold text-brand-700 hover:underline">‹ About the City Coordinator role</Link>

      <div className="mt-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">City Coordinator Programme</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Apply as City Coordinator</h1>
        <p className="mt-2 text-ink-soft">
          For Empanelled Yoga Teachers — <span className="font-bold text-ink">Level 2 (Yoga Pracharak)</span> and{' '}
          <span className="font-bold text-ink">Level 3 (Yoga Guru)</span> only.
        </p>
      </div>

      {eligible ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-brand-50/60 px-4 py-3" data-testid="cc-eligible">
            <span aria-hidden>✓</span>
            <p className="text-sm font-semibold text-brand-700">
              You&apos;re eligible{levelLabel ? <> — <span className="font-black">{levelLabel}</span>, empanelled</> : ' as an empanelled teacher'}.
            </p>
          </div>
          <p className="mt-4 text-sm text-muted">Open to empanelled teachers. Selection is at NOSTOPS&apos;s discretion.</p>
          <div className="mt-4">
            <CoordinatorApplyForm initialApplied={applied.applied} appliedAt={applied.appliedAt} />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 sm:p-8" data-testid="cc-not-eligible">
          <p className="text-3xl" aria-hidden>🧘</p>
          <h2 className="mt-3 text-xl font-black tracking-tight text-ink">This role is for Level 2 and Level 3 teachers</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            The City Coordinator role is open to existing NOSTOPS empanelled teachers at{' '}
            <span className="font-bold text-ink">Yoga Level 2 (Yoga Pracharak)</span> or{' '}
            <span className="font-bold text-ink">Level 3 (Yoga Guru)</span>, KYC-verified and in good standing.
          </p>
          <div className="mt-4 rounded-xl border border-line bg-cream/60 px-4 py-3 text-sm text-ink-soft">
            Your current status:{' '}
            <span className="font-bold text-ink">{empanelled ? 'Empanelled' : 'Not yet empanelled'}</span>
            {levelLabel ? <> · <span className="font-bold text-ink">{levelLabel}</span></> : ''}.
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/app/teacher/empanelment" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
              View your empanelment path <span aria-hidden>→</span>
            </Link>
            <Link href="/app" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">
              Back to dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
