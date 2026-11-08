import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getEditorial } from '@/lib/server/guru';
import EditorialPicks from '@/components/app/council/EditorialPicks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Editorial Picks', robots: { index: false, follow: false } };

export default async function CouncilEditorialPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'council') redirect('/app');

  const { teacherOfMonth, featuredWeek, history } = await getEditorial();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Council home</Link>
      <div className="mt-4">
        <h1 className="text-2xl font-black tracking-tight text-ink">Editorial Picks</h1>
        <p className="mt-1 text-sm text-ink-soft">Hand-pick the teachers who deserve to be seen this month or week. A new pick supersedes the previous one.</p>
      </div>
      <div className="mt-5">
        <EditorialPicks teacherOfMonth={teacherOfMonth} featuredWeek={featuredWeek} history={history} />
      </div>
    </div>
  );
}
