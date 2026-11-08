import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { guardTeacherFeature } from '@/lib/server/teacher-access';
import { getCoordinatorDashboard } from '@/lib/server/coordinator';
import CoordinatorRoster from '@/components/app/coordinator/CoordinatorRoster';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Teacher Roster', robots: { index: false, follow: false } };

export default async function CoordinatorRosterPage() {
  const denied = await guardTeacherFeature('coordinator');
  if (denied) redirect(denied);

  const d = await getCoordinatorDashboard();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/coordinator" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Coordinator Hub</Link>

      {!d ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🔒</span>
          <h1 className="mt-2 text-lg font-black text-ink">Coordinator access required</h1>
          <p className="mt-1 text-sm text-ink-soft">The teacher roster is for empanelled teachers appointed as a City Coordinator.</p>
          <Link href="/app/coordinator/agreement" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">See how the programme works →</Link>
        </div>
      ) : (
        <>
          <div className="mt-2 mb-5">
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Teacher roster</h1>
            <p className="mt-1 text-ink-soft">
              {d.teachers.length} teacher{d.teachers.length === 1 ? '' : 's'} in your care{d.city ? ` · ${d.city}` : ''}. Track onboarding and empanelment at a glance.
            </p>
          </div>
          <CoordinatorRoster teachers={d.teachers} city={d.city} />
        </>
      )}
    </div>
  );
}
