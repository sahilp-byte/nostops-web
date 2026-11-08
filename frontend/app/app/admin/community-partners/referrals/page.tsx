import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminCPReferrals, REF_KIND } from '@/lib/server/community-partners';
import { fmtDateTime } from '@/lib/format';
import { CPRefStatus } from '@/components/spaces/CPAdmin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Community Partner referrals', robots: { index: false, follow: false } };

export default async function AdminCPReferrals() {
  await requireAdminUser();
  const items = (await getAdminCPReferrals()) || [];
  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-cp-referrals">
      <Link href="/app/admin/community-partners" className="text-sm font-bold text-brand-700">← Applications</Link>
      <h1 className="mt-2 text-[36px] leading-tight">Community Partner referrals</h1>
      {!items.length ? <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-6 text-sm">No referrals yet.</p> : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-left text-sm">
          <thead className="bg-cream text-xs uppercase text-muted"><tr><th className="p-3">Partner</th><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Locality</th><th className="p-3">Contact</th><th className="p-3">Created</th><th className="p-3">Status</th></tr></thead>
          <tbody>{items.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-3 font-mono text-xs">{r.partner_ref}</td><td className="p-3 font-bold">{r.name}</td><td className="p-3">{REF_KIND[r.kind]}</td><td className="p-3">{r.locality}</td><td className="p-3">{r.contact || '—'}</td><td className="p-3 text-xs">{fmtDateTime(r.created_at)}</td><td className="p-3"><CPRefStatus id={r.id} status={r.status} /></td></tr>)}</tbody>
        </table></div>)}
    </div>
  );
}
