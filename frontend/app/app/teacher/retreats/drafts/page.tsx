import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { isHostUser } from '@/lib/server/retreat-host';
import DraftsList from '@/components/app/teacher/DraftsList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Retreat drafts', robots: { index: false, follow: false } };

export default async function RetreatDraftsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!(await isHostUser(user))) redirect('/app');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app/teacher/retreats" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to retreats</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Your retreat drafts</h1>
          <p className="mt-1 max-w-md text-ink-soft">Pick up any retreat you started, or clear out the ones you no longer need. Drafts are saved on this device.</p>
        </div>
        <Link href="/app/teacher/retreats/new?fresh=1" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600" data-testid="drafts-new-cta">+ New retreat</Link>
      </div>
      <DraftsList />
    </div>
  );
}
