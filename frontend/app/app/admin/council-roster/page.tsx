import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getCouncilRoster } from '@/lib/server/admin-council-roster';
import CouncilRoster from '@/components/app/admin/CouncilRoster';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Council Roster', robots: { index: false, follow: false } };

export default async function AdminCouncilRosterPage() {
  await requireAdminUser();
  const data = await getCouncilRoster();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Council Roster</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        The Council of Gurus who vouch for lineage, conduct empanelment interviews and set teaching standards.
        Deactivate a member to remove them from active duties, or reactivate them.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-black tabular-nums text-ink">{data.total}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Roster members</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-black tabular-nums text-brand-700">{data.active}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Active</p>
        </div>
      </div>

      <div className="mt-6">
        <CouncilRoster members={data.members} />
      </div>
    </div>
  );
}
