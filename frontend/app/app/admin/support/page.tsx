import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSupportAnalytics, getSupportRequests } from '@/lib/server/guru-support';
import SupportQueue from '@/components/app/admin/SupportQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Admin · Support Requests',
  robots: { index: false, follow: false },
};

export default async function AdminSupportPage() {
  await requireAdminUser();
  const [items, analytics] = await Promise.all([getSupportRequests('open'), getSupportAnalytics()]);

  const cards = [
    { label: 'Open requests', value: analytics.open_requests, accent: analytics.open_requests > 0 },
    { label: 'Total requests', value: analytics.total_requests },
    { label: 'AI chats', value: analytics.total_chats },
    {
      label: 'Escalation rate',
      value: analytics.escalation_rate != null ? `${(analytics.escalation_rate * 100).toFixed(1)}%` : '—',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Support</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Support Requests</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Requests escalated from Ask AI Guru. Each one carries the user’s AI conversation and page context, so there’s no
        need to ask them to repeat the issue.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${c.accent ? 'text-accent-600' : 'text-ink'}`}>{c.value}</p>
            <p className="text-xs font-semibold text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      {Object.keys(analytics.by_category).length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AnalyticsBreakdown title="By category" data={analytics.by_category} />
          <AnalyticsBreakdown title="By priority" data={analytics.by_priority} />
        </div>
      )}

      <div className="mt-6">
        <SupportQueue initial={items} />
      </div>
    </div>
  );
}

function AnalyticsBreakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-2 space-y-1">
        {rows.map(([k, n]) => (
          <li key={k} className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{k}</span>
            <span className="font-bold tabular-nums text-ink">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
