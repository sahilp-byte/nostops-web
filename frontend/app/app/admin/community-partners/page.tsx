import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { CP_STATUS, getAdminCPList } from '@/lib/server/community-partners';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Community Partners', robots: { index: false, follow: false } };
const TABS = ['submitted', 'info_requested', 'approved', 'rejected', 'draft', 'all'];

export default async function AdminCPList({ searchParams }: { searchParams: Promise<{ status?: string; partner?: string; q?: string }> }) {
  await requireAdminUser();
  const sp = await searchParams;
  const status = TABS.includes(sp.status || '') ? sp.status! : 'submitted';
  const d = await getAdminCPList(status, sp.partner || '', sp.q || '');
  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-cp-list">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · NOSTOPS Spaces</p>
      <h1 className="mt-1 text-[36px] leading-tight">Community Partner applications</h1>
      <div className="mt-4 flex flex-wrap gap-2">{TABS.map((t) => <Link key={t} href={`/app/admin/community-partners?status=${t}`} className={`inline-flex min-h-[40px] items-center rounded-full px-4 py-2 text-xs font-bold leading-none ${t === status ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`}>{t === 'all' ? 'All' : CP_STATUS[t].label} {t !== 'all' && d ? `(${d.counts[t] || 0})` : ''}</Link>)}
        <Link href="/app/admin/community-partners/referrals" className="min-h-[40px] rounded-full border border-brand-300 px-4 py-2 text-xs font-bold text-brand-700">All referrals</Link></div>
      <form className="mt-3 flex gap-2"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={sp.q} placeholder="Search name, reference, locality or PIN" className="min-h-[44px] w-80 rounded-xl border border-line px-3 text-sm" data-testid="admin-cp-search" />
        <select name="partner" defaultValue={sp.partner || ''} className="min-h-[44px] rounded-xl border border-line px-2 text-sm"><option value="">Any partner state</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select>
        <button className="min-h-[44px] rounded-xl bg-brand px-4 text-sm font-bold text-white">Filter</button></form>
      {!d?.items.length ? <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft">Nothing here.</p> : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-left text-sm" data-testid="admin-cp-table">
          <thead className="bg-cream text-xs uppercase text-muted"><tr><th className="p-3">Reference</th><th className="p-3">Applicant</th><th className="p-3">Localities</th><th className="p-3">Status</th><th className="p-3">Partner</th><th className="p-3">Updated</th></tr></thead>
          <tbody>{d.items.map((a) => <tr key={a.id} className="border-t border-line">
            <td className="p-3"><Link href={`/app/admin/community-partners/${a.id}`} className="font-mono font-bold text-brand-700">{a.ref}</Link></td>
            <td className="p-3">{a.applicant.full_name || a.account_name}<br /><span className="text-xs text-muted">{a.account_email}</span></td>
            <td className="p-3">{a.localities.map((l) => `${l.locality} (${l.pin})`).join(', ')}</td>
            <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${CP_STATUS[a.status]?.tone}`}>{CP_STATUS[a.status]?.label}</span></td>
            <td className="p-3">{a.partner_status ? CP_STATUS[a.partner_status].label : '—'}</td><td className="p-3 text-xs text-ink-soft">{fmtDateTime(a.updated_at)}</td></tr>)}</tbody>
        </table></div>)}
    </div>
  );
}
