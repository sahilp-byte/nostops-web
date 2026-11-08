import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getPeople, type PersonRow } from '@/lib/server/admin-people';
import RecentJoins from '@/components/app/admin/RecentJoins';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Recent Joins', robots: { index: false, follow: false } };

function ts(s: string | null): number {
  if (!s) return 0;
  const n = Number(s);
  const d = Number.isFinite(n) && s.length >= 10 && !s.includes('-') ? new Date(n).getTime() : new Date(s).getTime();
  return Number.isNaN(d) ? 0 : d;
}

export default async function AdminRecentJoinsPage() {
  await requireAdminUser();
  const data = await getPeople();
  // Newest 50 across teachers + council gurus, most recent first.
  const recent: PersonRow[] = [...data.teachers, ...data.council]
    .sort((a, b) => ts(b.createdAt) - ts(a.createdAt))
    .slice(0, 50);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Recent Joins</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        The 50 most recent people to join NOSTOPS. Open any teacher to monitor their onboarding &amp; empanelment progress.
      </p>
      <div className="mt-6">
        <RecentJoins people={recent} />
      </div>
    </div>
  );
}
