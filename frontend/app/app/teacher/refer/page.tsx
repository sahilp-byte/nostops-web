import Link from 'next/link';
import type { Metadata } from 'next';
import { getReferralDashboard } from '@/lib/server/teacher';
import { enforceTeacherFeature } from '@/lib/server/teacher-access';
import ReferShare from '@/components/app/teacher/ReferShare';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Refer & Earn', robots: { index: false, follow: false } };

export default async function TeacherReferPage() {
  await enforceTeacherFeature('refer');

  const ref = await getReferralDashboard();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      <div className="mt-4 mb-5">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Refer &amp; earn</h1>
        <p className="mt-1 text-ink-soft">Invite fellow teachers to NOSTOPS and earn rewards when they get empanelled.</p>
      </div>
      {ref ? (
        <ReferShare
          code={ref.code}
          empanelled={ref.empanelled}
          totalEarned={ref.totalEarned}
          pending={ref.pending}
          available={ref.available}
          totalWithdrawn={ref.totalWithdrawn}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-semibold text-ink">Referral program unavailable</p>
          <p className="mt-1 text-sm text-muted">Complete your teacher onboarding to get your invite code.</p>
        </div>
      )}
    </div>
  );
}
