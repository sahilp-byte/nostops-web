import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getTeacherRoster } from '@/lib/server/admin-teachers';
import { getCuration } from '@/lib/server/site-curation';
import { CATEGORIES, classifyRoster, maskEmail, type CategoryKey } from '@/lib/server/teacher-reconciliation';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Teacher Record Reconciliation', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ show?: string; category?: string }> };

// READ-ONLY. Nothing on this page changes, publishes, deletes or messages a teacher record.
export default async function TeacherReconciliationPage({ searchParams }: Props) {
  await requireAdminUser();
  const sp = await searchParams;
  const reveal = sp.show === 'names';
  const [roster, curation] = await Promise.all([getTeacherRoster(), getCuration()]);
  const rows = classifyRoster(roster.items, curation.removedTeachers);
  const count = (k: CategoryKey) => rows.filter((r) => r.category === k).length;
  const classified = rows.length;
  const filter = CATEGORIES.some((c) => c.key === sp.category) ? (sp.category as CategoryKey) : null;
  const shown = filter ? rows.filter((r) => r.category === filter) : rows;
  const flagged = rows.filter((r) => r.flags.length > 0).length;
  const qs = (o: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const show = 'show' in o ? o.show : reveal ? 'names' : null;
    const cat = 'category' in o ? o.category : filter;
    if (show) p.set('show', show);
    if (cat) p.set('category', cat);
    const s = p.toString();
    return `/app/admin/teacher-reconciliation${s ? `?${s}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-5xl" data-testid="recon-page">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Read-only</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Teacher Record Reconciliation</h1>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Every registered teacher record, classified only from the fields the roster returns. Duplicates and inconsistencies are
        flagged, not changed. This page never edits, publishes, deletes or messages anyone.
      </p>

      {!roster.ok && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">The roster couldn&apos;t be loaded. Counts below are empty, not estimated.</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="recon-totals">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{roster.total}</p><p className="text-xs font-semibold text-muted">Roster total (backend)</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{classified}</p><p className="text-xs font-semibold text-muted">Records classified</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className={`text-2xl font-black tabular-nums ${classified === roster.total ? 'text-brand-700' : 'text-accent-600'}`}>{classified === roster.total ? 'Yes' : 'No'}</p><p className="text-xs font-semibold text-muted">Counts add up to the total</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className={`text-2xl font-black tabular-nums ${flagged ? 'text-accent-600' : 'text-ink'}`}>{flagged}</p><p className="text-xs font-semibold text-muted">Records with flags</p></div>
      </div>
      {roster.total > 200 && <p className="mt-2 text-xs font-semibold text-accent-600">The roster has more than 200 records; only the first 200 are returned and classified.</p>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-white" data-testid="recon-categories">
        <table className="w-full text-sm">
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c.key} className="border-t border-line first:border-t-0">
                <td className="p-3 align-top">
                  <Link href={qs({ category: filter === c.key ? null : c.key })} className={`font-bold hover:underline ${filter === c.key ? 'text-brand-700' : 'text-ink'}`}>{c.label}</Link>
                  <p className="mt-0.5 text-xs text-muted">{c.rule}</p>
                </td>
                <td className="w-28 p-3 text-right align-top text-xl font-black tabular-nums text-ink" data-testid={`recon-count-${c.key}`}>
                  {c.determinable ? count(c.key) : <span className="text-xs font-bold text-muted">not determinable</span>}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-line bg-cream/60">
              <td className="p-3 font-black text-ink">Total</td>
              <td className="p-3 text-right text-xl font-black tabular-nums text-ink">{classified}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">{filter ? CATEGORIES.find((c) => c.key === filter)?.label : 'All records'} · {shown.length}</p>
        <Link href={qs({ show: reveal ? null : 'names' })} data-testid="recon-toggle-names" className="min-h-[40px] rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-soft hover:border-brand">
          {reveal ? 'Hide names (anonymise)' : 'Show names'}
        </Link>
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white" data-testid="recon-rows">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-3 font-bold">Record</th>
              <th className="p-3 font-bold">Email</th>
              <th className="p-3 font-bold">City</th>
              <th className="p-3 font-bold">Registered</th>
              <th className="p-3 font-bold">Category</th>
              <th className="p-3 font-bold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.ref} className="border-t border-line">
                <td className="p-3 font-semibold text-ink">{reveal ? `${r.teacher.name || '—'}${r.teacher.handle ? ` (/${r.teacher.handle})` : ''}` : r.ref}</td>
                <td className="p-3 text-ink-soft">{reveal ? r.teacher.email || '—' : maskEmail(r.teacher.email)}</td>
                <td className="p-3 text-ink-soft">{r.teacher.city || '—'}</td>
                <td className="p-3 text-ink-soft">{r.teacher.created_at ? fmtDate(r.teacher.created_at) : '—'}</td>
                <td className="p-3 text-xs font-bold text-ink-soft">{CATEGORIES.find((c) => c.key === r.category)?.label.split(' · ')[0]}</td>
                <td className="p-3 text-xs text-accent-600">{r.flags.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
