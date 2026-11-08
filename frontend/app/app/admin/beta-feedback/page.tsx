import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getBetaFeedback } from '@/lib/server/admin-beta';
import BetaFeedbackList from '@/components/app/admin/BetaFeedbackList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Beta Feedback', robots: { index: false, follow: false } };

export default async function AdminBetaFeedbackPage() {
  await requireAdminUser();
  const data = await getBetaFeedback();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Beta Feedback</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Feedback submitted by beta users across the app. Triage each item and mark it resolved once addressed.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{data.total}</p><p className="text-xs font-semibold text-muted">Total feedback</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className={`text-2xl font-black tabular-nums ${data.open > 0 ? 'text-accent-600' : 'text-ink'}`}>{data.open}</p><p className="text-xs font-semibold text-muted">Open</p></div>
      </div>

      <div className="mt-6">
        <BetaFeedbackList items={data.items} categories={data.categories} />
      </div>
    </div>
  );
}
