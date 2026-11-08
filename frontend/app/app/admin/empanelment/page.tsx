import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getEmpanelmentOverview } from '@/lib/server/admin-empanelment';
import { titleCase } from '@/lib/format';
import EmpanelmentRoster from '@/components/app/admin/EmpanelmentRoster';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Empanelment', robots: { index: false, follow: false } };

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const d = Math.round((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
}

export default async function AdminEmpanelmentPage() {
  await requireAdminUser();
  const data = await getEmpanelmentOverview();
  const ft = data.fastTrack;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Empanelment</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Empanel teachers directly, oversee the Council fast-track review pipeline, and track empanelment across teacher
        levels.
      </p>

      {/* Fast-track queue summary */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-ink">Fast-Track Review Pipeline</h2>
          <Link href="/app/admin/empanelment/fast-track" data-testid="fast-track-link" className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600">
            Manage queue →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Unclaimed', value: ft.unclaimed, tone: ft.unclaimed > 0 ? 'text-accent-600' : 'text-ink' },
            { label: 'Pending interview', value: ft.claimedPending, tone: 'text-ink' },
            { label: 'Scheduled', value: ft.scheduled, tone: 'text-ink' },
            { label: 'Approved · 30d', value: ft.approved30d, tone: 'text-brand-700' },
            { label: 'Rejected · 30d', value: ft.rejected30d, tone: 'text-red-700' },
          ].map((s) => (
            <div key={s.label}>
              <p className={`text-2xl font-black tabular-nums ${s.tone}`}>{s.value}</p>
              <p className="text-xs font-semibold text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* By-badge + recent actions */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Empanelment by level</h2>
          <p className="mt-1 text-sm text-ink-soft">{data.totalEmpanelled} teachers empanelled overall.</p>
          <div className="mt-3 space-y-2">
            {data.byBadge.map((b) => (
              <div key={b.badge} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">{b.badge}</span>
                <span className="text-ink-soft">{b.empanelled} / {b.total} empanelled</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Recent decisions</h2>
          {data.recentActions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No recent empanelment actions.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentActions.slice(0, 6).map((a) => (
                <li key={a.auditId} className="text-sm">
                  <span className="font-semibold text-ink">{a.teacherName}</span>{' '}
                  <span className="text-ink-soft">{titleCase(a.action)}</span>
                  <span className="text-muted"> · {a.actorName} · {timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Roster */}
      <h2 className="mt-8 text-lg font-black text-ink">Teacher roster</h2>
      <p className="mt-1 text-sm text-ink-soft">Empanel or revoke any teacher directly. This writes to the authoritative record immediately.</p>
      <div className="mt-4">
        <EmpanelmentRoster rows={data.roster} />
      </div>
    </div>
  );
}
