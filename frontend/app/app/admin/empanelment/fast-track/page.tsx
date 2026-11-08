import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getFastTrackQueue } from '@/lib/server/admin-empanelment';
import { getFastTrackPolicyMap } from '@/lib/server/empanelment-policy';
import FastTrackQueue from '@/components/app/admin/FastTrackQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Fast-Track Queue', robots: { index: false, follow: false } };

export default async function AdminFastTrackPage() {
  const user = await requireAdminUser();
  const [data, policy] = await Promise.all([getFastTrackQueue(), getFastTrackPolicyMap(user)]);
  const c = data.counts;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/admin/empanelment" className="text-xs font-bold text-brand-700">← Empanelment</Link>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Fast-Track Review Pipeline</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Oversee the paid fast-track empanelment reviews. Schedule interviews and record decisions. Approvals are activated in Empanelment Decisions.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Unclaimed', value: c.unclaimed, tone: c.unclaimed > 0 ? 'text-accent-600' : 'text-ink' },
          { label: 'Pending interview', value: c.claimedPending, tone: 'text-ink' },
          { label: 'Scheduled', value: c.scheduled, tone: 'text-ink' },
          { label: 'Approved · 30d', value: c.approved30d, tone: 'text-brand-700' },
          { label: 'Rejected · 30d', value: c.rejected30d, tone: 'text-red-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${s.tone}`}>{s.value}</p>
            <p className="text-xs font-semibold text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <FastTrackQueue active={data.active} policy={policy} />
      </div>
    </div>
  );
}
