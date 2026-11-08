import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getCPReferrals, REF_KIND } from '@/lib/server/community-partners';
import { fmtDateTime } from '@/lib/format';
import { SpacesPageHeader, SpEmpty } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Community Partner · My Referrals', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CPReferralsPage() {
  if (!(await getSessionUser())) redirect('/login?next=/app/spaces/partner/referrals');
  const items = await getCPReferrals();
  if (!items) redirect('/app/spaces/partner');
  return (
    <div className="mx-auto max-w-6xl" data-testid="cp-referrals">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'Community Partner Dashboard', href: '/app/spaces/partner' }, { label: 'My Referrals' }]} title="My Referrals" subtitle="Teachers, Spaces and Space owners you have referred to NOSTOPS." image="/brand/spaces/network-hero.jpg" />
      {items.length === 0 ? <div className="mt-4"><SpEmpty title="No referrals yet" action={<Link href="/app/spaces/partner/network#refer" className="sp-btn-primary bg-accent">Make one →</Link>} /></div> : (
        <div className="sp-card mt-4 overflow-x-auto"><table className="w-full text-left text-[15px]">
          <thead className="bg-[#FCF4E6] text-[13px] font-semibold text-[#3B4762]"><tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Locality</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead>
          <tbody>{items.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-3 font-bold text-ink">{r.name}</td><td className="p-3">{REF_KIND[r.kind]}</td><td className="p-3">{r.locality}</td><td className="p-3"><span className="rounded-full bg-[#FDE7CC] px-3 py-1 text-xs font-semibold capitalize text-[#7A2E05]">{r.status}</span></td><td className="p-3 text-ink-soft">{fmtDateTime(r.created_at)}</td></tr>)}</tbody>
        </table></div>)}
    </div>
  );
}
