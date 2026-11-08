import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMyNominations } from '@/lib/server/guru-nominations';
import MyNominationsList from '@/components/app/nominations/MyNominationsList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Guru Nominations', robots: { index: false, follow: false } };

export default async function MyNominationsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/nominations');
  const items = await getMyNominations(user);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Council of Yoga Gurus</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">My Guru Nominations</h1>
          <p className="mt-2 max-w-xl text-ink-soft">
            Follow the Gurus you&apos;ve nominated. The NOSTOPS team reviews each one, the Council decides, and a Guru is
            published only after they agree.
          </p>
        </div>
        <Link href="/council/nominate" data-testid="my-nom-new" className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          Nominate a Guru
        </Link>
      </div>
      <div className="mt-6">
        {items === null ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft" data-testid="my-nom-unavailable">
            Your nominations can&apos;t be loaded right now. Please try again shortly.
          </p>
        ) : (
          <MyNominationsList items={items} />
        )}
      </div>
    </div>
  );
}
