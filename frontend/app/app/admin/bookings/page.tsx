import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminBookings } from '@/lib/server/admin-bookings';
import AdminBookings from '@/components/app/admin/AdminBookings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Bookings', robots: { index: false, follow: false } };

export default async function AdminBookingsPage() {
  await requireAdminUser();
  const data = await getAdminBookings();

  const active = data.rows.filter((r) => r.enrollmentOpen).length;
  const totalPaid = data.rows.reduce((s, r) => s + r.paidCount, 0);
  const kpis = [
    { label: 'Total batches', value: data.total },
    { label: 'Enrollment open', value: active, tone: 'text-brand-700' },
    { label: 'Seats paid', value: totalPaid },
    { label: 'Force-closed', value: data.rows.filter((r) => r.forceClosed).length, tone: 'text-red-700' },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Money &amp; Growth</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Bookings</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Monitor every batch booking across the platform. Force-close a batch to stop further enrollment when required.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${k.tone ?? 'text-ink'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <AdminBookings rows={data.rows} statuses={data.statuses} />
      </div>
    </div>
  );
}
