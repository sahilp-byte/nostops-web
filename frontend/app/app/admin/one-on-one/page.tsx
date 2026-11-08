import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminOneOnOne } from '@/lib/server/audit';
import AdminOneOnOne from '@/components/app/admin/AdminOneOnOne';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · 1:1 Sessions', robots: { index: false, follow: false } };

export default async function AdminOneOnOnePage() {
  await requireAdminUser();
  const data = await getAdminOneOnOne();

  const kpis = [
    { label: 'Total sessions', value: data.stats.total },
    { label: 'Paid', value: data.stats.paid, tone: 'text-emerald-700' },
    { label: 'Payment initiated', value: data.stats.initiated, tone: 'text-blue-700' },
    { label: 'Pending payment', value: data.stats.pending, tone: 'text-amber-700' },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Money &amp; Growth</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">1:1 Sessions</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Every seeker&rarr;teacher 1:1 booking and payment recorded across the platform — with the fee, gateway,
        session focus and status. This is a local audit ledger written at reservation and checkout.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${k.tone ?? 'text-ink'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-brand/20 bg-brand-50/40 px-4 py-3">
        <p className="text-sm font-semibold text-ink">
          Gross booking value tracked: <span className="font-black text-brand-700">₹{inr(data.stats.gross_inr)}</span>
        </p>
      </div>

      <div className="mt-6">
        <AdminOneOnOne rows={data.rows} statuses={data.statuses} />
      </div>
    </div>
  );
}
