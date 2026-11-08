import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import { getHostedRetreat, isHostUser } from '@/lib/server/retreat-host';
import { SITE_URL } from '@/lib/site';
import CohortRoster, { type RosterMember } from '@/components/app/teacher/CohortRoster';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cohort roster', robots: { index: false, follow: false } };

export default async function CohortRosterPage({ params }: { params: Promise<{ id: string; cohort: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!(await isHostUser(user))) redirect('/app');

  const { id, cohort: cohortRaw } = await params;
  const cohort = decodeURIComponent(cohortRaw).slice(0, 120);
  const bundle = await getHostedRetreat(id, (user.user_id as string) || null);
  if (!bundle) notFound();

  const { retreat: r, reservations } = bundle;
  const members: RosterMember[] = reservations
    .filter((res) => res.cohort === cohort)
    .map((res) => ({
      id: res.id,
      name: res.name,
      status: res.status,
      phone: res.phone,
      email: res.email,
      groupSize: res.groupSize,
      joinedAt: res.paidAt || res.reservedAt,
    }));

  const via = displayName(user) || '';
  const q = new URLSearchParams({ cohort });
  if (via) q.set('via', via);
  const shareLink = `${SITE_URL}/retreats/${id}?${q.toString()}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/app/teacher/retreats/${id}`} className="text-sm font-bold text-brand-700 hover:underline">‹ Back to retreat</Link>
      <header>
        <span className="rounded-full bg-royal-50 px-2.5 py-0.5 text-xs font-bold text-royal" data-testid="cohort-roster-name">{cohort}</span>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Cohort roster</h1>
        <p className="mt-1 text-ink-soft">{r.title}</p>
      </header>

      <CohortRoster
        retreatId={id}
        retreatTitle={r.title}
        cohort={cohort}
        via={via}
        shareLink={shareLink}
        members={members}
      />
    </div>
  );
}
