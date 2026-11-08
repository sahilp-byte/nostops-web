import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getDiscoveryCampaign, getDiscoveryCandidates } from '@/lib/server/discovery-admin';
import CandidateTableClient from '@/components/admin/discovery/CandidateTableClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Discovery candidates', robots: { index: false, follow: false } };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'accepted', label: 'Relevant' },
  { key: 'rejected', label: 'Rejected' },
];

export default async function CampaignCandidatesPage({
  params, searchParams,
}: { params: Promise<{ campaign: string }>; searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser();
  const { campaign } = await params;
  const { status } = await searchParams;
  const camp = await getDiscoveryCampaign(campaign);
  if (!camp?.campaign) notFound();
  const filter = FILTERS.some((f) => f.key === status) ? status! : 'accepted';
  const qs = filter === 'all' ? '?limit=300' : `?status=${filter}&limit=300`;
  const { items, total } = await getDiscoveryCandidates(campaign, qs);

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <Link href="/app/admin/discovery" className="text-[12px] font-bold text-brand-700 hover:underline">← Discovery</Link>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">{camp.campaign.city} · candidates</h1>
      <p className="mt-1 text-sm text-muted">{camp.campaign.accepted_total}/{camp.campaign.target} accepted · status {camp.campaign.status}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/app/admin/discovery/${campaign}?status=${f.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${f.key === filter ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft hover:border-brand'}`}>
            {f.label}
          </Link>
        ))}
        <a href={`/bff/admin/discovery/campaigns/${campaign}/export`} className="ml-auto rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-brand">Export CSV</a>
      </div>

      <p className="mt-3 text-[12px] text-muted">{total} candidate{total === 1 ? '' : 's'}</p>
      <CandidateTableClient items={items} />
    </div>
  );
}
