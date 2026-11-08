import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAuditLog } from '@/lib/server/admin-audit';
import { titleCase, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Audit Trail', robots: { index: false, follow: false } };

const LIMIT = 50;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; skip?: string }> }) {
  await requireAdminUser();
  const sp = await searchParams;
  const action = typeof sp.action === 'string' ? sp.action : '';
  const skip = Math.max(0, Number(sp.skip) || 0);
  const data = await getAuditLog({ action: action || undefined, skip, limit: LIMIT });

  const qs = (next: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (action) p.set('action', action);
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== '') p.set(k, String(v)); else p.delete(k);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const hasPrev = skip > 0;
  const hasNext = data.total ? skip + data.events.length < data.total : data.events.length === LIMIT;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Audit Trail</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        A record of every administrative action — approvals, suspensions, payouts and more — with who did it, when, and
        on what.
      </p>

      {/* Action filter (server GET form) */}
      <form className="mt-6 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="action">Action</label>
        <select id="action" name="action" defaultValue={action} data-testid="audit-action-filter" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand">
          <option value="">All actions</option>
          {data.actions.map((a) => <option key={a} value={a}>{titleCase(a.replace(/[._]/g, ' '))}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600">Apply</button>
        {action && <Link href="/app/admin/audit-log" className="text-xs font-bold text-ink-soft hover:text-brand-700">Clear</Link>}
        {data.total > 0 && <span className="ml-auto text-xs text-muted">{data.total.toLocaleString()} events</span>}
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white" data-testid="audit-list">
        {data.events.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No audit events{action ? ' for this action' : ''} yet.</p>
        ) : (
          data.events.map((e, i) => (
            <div key={`${e.at}-${i}`} className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{titleCase(e.action.replace(/[._]/g, ' '))}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {[e.actorEmail, e.actorRole].filter(Boolean).join(' · ')}
                  {e.targetType ? ` → ${e.targetType}${e.targetId ? ` ${e.targetId}` : ''}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted">{fmtDateTime(e.at)}</span>
            </div>
          ))
        )}
      </div>

      {(hasPrev || hasNext) && (
        <div className="mt-4 flex items-center justify-between">
          {hasPrev ? (
            <Link href={qs({ skip: Math.max(0, skip - LIMIT) || undefined })} className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700">← Newer</Link>
          ) : <span />}
          {hasNext ? (
            <Link href={qs({ skip: skip + LIMIT })} className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700">Older →</Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
