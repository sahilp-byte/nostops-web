import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getMonitorEvents } from '@/lib/server/monitoring-admin';
import ErrorMonitorList from '@/components/app/admin/ErrorMonitorList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Error Monitor', robots: { index: false, follow: false } };

export default async function AdminErrorMonitorPage() {
  await requireAdminUser();
  const initial = await getMonitorEvents('status=open');
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Error Monitor</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Page crashes, server errors, payment problems and undelivered emails, grouped so repeats count as one. Alerts are emailed to{' '}
        <strong>{initial.alert_to || 'the team inbox'}</strong> the first time a problem appears, then at most once per cooldown window.
      </p>
      <div className="mt-6">
        <ErrorMonitorList initial={initial} />
      </div>
    </div>
  );
}
