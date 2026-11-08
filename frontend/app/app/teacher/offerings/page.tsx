import Link from 'next/link';
import type { Metadata } from 'next';
import { getPremiumConfig } from '@/lib/server/teacher';
import { enforceTeacherFeature } from '@/lib/server/teacher-access';
import OfferingsForm from '@/components/app/teacher/OfferingsForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Session Offerings', robots: { index: false, follow: false } };

export default async function TeacherOfferingsPage() {
  await enforceTeacherFeature('offerings');

  const cfg = await getPremiumConfig();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      <div className="mt-4 mb-5">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Session offerings</h1>
        <p className="mt-1 text-ink-soft">Set up the private sessions learners can book directly from your public profile.</p>
      </div>
      {cfg ? (
        <OfferingsForm
          enabled={cfg.enabled}
          rateInr={cfg.rateInr}
          durationMin={cfg.durationMin}
          tierMin={cfg.tierMin}
          tierMax={cfg.tierMax}
          tierLabel={cfg.tierLabel}
          feePct={cfg.feePct}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-semibold text-ink">Offerings unavailable</p>
          <p className="mt-1 text-sm text-muted">Complete your teacher onboarding to configure paid sessions.</p>
        </div>
      )}
    </div>
  );
}
