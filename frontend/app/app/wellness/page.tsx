import type { Metadata } from 'next';
import { getWellnessJourney } from '@/lib/server/wellness';
import WellnessJourney from '@/components/app/learner/WellnessJourney';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'My Wellness Journey',
  robots: { index: false, follow: false },
};

export default async function WellnessPage() {
  const data = await getWellnessJourney();
  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">My Wellness Journey</h1>
        <p className="mt-2 text-ink-soft">Your streak, karma, community standing and progress across NOSTOPS.</p>
      </header>
      <div className="mt-6">
        <WellnessJourney data={data} />
      </div>
    </div>
  );
}
