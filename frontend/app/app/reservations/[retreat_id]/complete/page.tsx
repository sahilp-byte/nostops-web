import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { apiGet } from '@/lib/api';
import { canonical } from '@/lib/site';
import { toPublicRetreat, getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import { retreatPath } from '@/lib/retreat-url';
import PostRetreatExperience, { type MiniRetreat } from '@/components/retreats/PostRetreatExperience';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Thank you for practising', robots: { index: false, follow: false } };

async function getRetreat(id: string): Promise<PublicRetreat | null> {
  try {
    const d = await apiGet<any>(`/retreats/${id}`, { revalidate: 0 });
    if (!d || !d.retreat_id) return null;
    return toPublicRetreat(d);
  } catch {
    return null;
  }
}

const mini = (r: PublicRetreat): MiniRetreat => ({ id: r.id, title: r.title, city: r.city, state: r.state, startDate: r.startDate, coverImage: r.coverImage });

export default async function RetreatCompletePage({ params }: { params: Promise<{ retreat_id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const { retreat_id } = await params;

  const r = await getRetreat(retreat_id);
  if (!r) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const completed = r.status === 'completed' || (!!r.endDate && r.endDate < today);

  // Teacher's next retreat + a few future retreats to keep the flywheel turning.
  const { retreats: all } = await getPublicRetreats();
  const upcoming = all.filter((x) => x.id !== r.id && (!x.endDate || x.endDate >= today) && ['published', 'filling'].includes(x.status));
  const teacherNext = r.guruHandle ? upcoming.filter((x) => x.guruHandle && x.guruHandle === r.guruHandle).slice(0, 2) : [];
  const teacherNextIds = new Set(teacherNext.map((x) => x.id));
  const future = upcoming
    .filter((x) => !teacherNextIds.has(x.id))
    .sort((a, b) => (a.theme === r.theme ? -1 : 0) - (b.theme === r.theme ? -1 : 0) || (a.startDate || '').localeCompare(b.startDate || ''))
    .slice(0, 3);

  const shareUrl = canonical(retreatPath(r));

  return (
    <div className="py-2">
      <PostRetreatExperience
        data={{
          id: r.id,
          title: r.title,
          guruName: r.guruName,
          guruHandle: r.guruHandle,
          city: r.city,
          state: r.state,
          venueName: r.venueName,
          coverImage: r.coverImage,
          images: [r.coverImage, ...r.images].filter((x): x is string => !!x),
          endDate: r.endDate,
          shareUrl,
        }}
        completed={completed}
        teacherNext={teacherNext.map(mini)}
        future={future.map(mini)}
        reviewerName={(user as any)?.name || ''}
      />
    </div>
  );
}
