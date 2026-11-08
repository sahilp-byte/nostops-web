import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getAdminReports, actorFrom } from '@/lib/server/pulse';
import ReportsQueue from '@/components/app/admin/pulse/ReportsQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Pulse Reports', robots: { index: false, follow: false } };

export default async function AdminPulseReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser();
  const user = await getSessionUser();
  const { status = 'OPEN' } = await searchParams;
  const { reports } = await getAdminReports(actorFrom(user!), status);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/app/admin/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Reported content</h1>
        <p className="mt-1 text-ink-soft">Review flagged discussions and replies. Every action is recorded in the audit trail.</p>
      </div>
      <ReportsQueue reports={reports} status={status} />
    </div>
  );
}
