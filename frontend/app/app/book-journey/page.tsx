import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { getDiscover } from '@/lib/server/discover';
import { displayName } from '@/lib/roles';
import type { DimensionId } from '@/lib/yoga-dimensions';
import BookJourney from '@/components/app/learner/BookJourney';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Book a 1:1 session', robots: { index: false, follow: false } };

// Guided Yoga-Seeker → 1:1 booking journey. Reuses the existing directory,
// profile, booking and payment; live matrix counts come from the directory facets.
export default async function BookJourneyPage() {
  const [user, { facets }] = await Promise.all([getSessionUser(), getDiscover({})]);
  const first = displayName(user).split(' ')[0] || 'there';
  const counts: Record<DimensionId, number> = { mind: 0, body: 0, special_needs: 0 };
  for (const d of facets.dimensions) counts[d.id as DimensionId] = d.count;

  return (
    <div className="mx-auto max-w-3xl">
      <BookJourney
        firstName={first}
        counts={counts}
        totalTeachers={facets.totals.total_teachers ?? 0}
        empanelled={facets.totals.empanelled ?? 0}
      />
    </div>
  );
}
