import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMyEnquiries } from '@/lib/server/spaces';
import { ENQUIRY_STATUS } from '@/lib/spaces';
import { SpacesPageHeader, SpEmpty, SpIcon, SpStat } from '@/components/spaces/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Space Enquiries', robots: { index: false, follow: false } };

const STATUS = ENQUIRY_STATUS;

export default async function MyEnquiriesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/spaces/enquiries');
  const admin = user.role === 'admin';
  const items = await getMyEnquiries();
  return (
    <div className="mx-auto max-w-6xl" data-testid="my-enquiries-page">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Space Enquiries' }]} title="Teacher Dashboard – My Space Enquiries"
        subtitle={admin ? 'Enquiries sent from this administrator account. An enquiry is not a confirmed booking.' : 'Track and manage your venue requests, discussions and arrangements. An enquiry is not a confirmed booking.'}
        aside={<Link href="/spaces" className="sp-btn-primary bg-brand">+ Find a Space</Link>} />
      {admin && <p className="mt-2 text-sm text-ink-soft" data-testid="my-enquiries-admin-note">To review every teacher’s enquiry, open <Link href="/app/spaces/incoming" className="font-bold text-brand-700 underline">All Space Enquiries</Link>.</p>}
      {items.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SpStat icon="mail" value={items.length} label="Total Enquiries" />
          <SpStat icon="clock" value={items.filter((e) => e.status === 'sent').length} label="Awaiting Response" />
          <SpStat icon="users" tone="lavender" value={items.filter((e) => e.status === 'in_discussion').length} label="In Discussion" />
          <SpStat icon="check" tone="green" value={items.filter((e) => e.status === 'accepted_in_principle').length} label="Accepted in principle" />
        </div>
      )}
      {items.length === 0 ? (
        <div className="mt-6"><SpEmpty title="No enquiries yet" testId="my-enquiries-empty" action={<Link href="/spaces" className="sp-btn-primary bg-brand">Find a Space</Link>} /></div>
      ) : (
        <ul className="mt-6 grid gap-3" data-testid="my-enquiries-list">
          {items.map((e) => {
            const st = STATUS[e.status] || { label: e.status, tone: 'bg-gray-100 text-gray-700' };
            return (
              <li key={e.id}>
                <Link href={`/app/spaces/enquiries/${e.id}`} className="sp-card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-[#F2B574]" data-testid="my-enquiry-card">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#FDE7CC] text-[#E8690C]"><SpIcon name="building" className="h-7 w-7" /></span>
                    <div>
                    <p className="text-[18px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{e.programme_title || 'Untitled programme'}</p>
                    <p className="text-sm text-ink-soft">{e.space_name}{e.ref ? ` · ${e.ref}` : ''}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone}`} data-testid="my-enquiry-status">{st.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
