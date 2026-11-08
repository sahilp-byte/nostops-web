import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMySpaceRegistrations, inr, REG_STATUS } from '@/lib/server/space-registrations';
import { fmtDateLong } from '@/lib/format';
import { SpacesPageHeader, SpEmpty } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'My Space Programme Registrations', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function MySpaceRegistrationsPage() {
  if (!(await getSessionUser())) redirect('/login?next=/app/spaces/registrations');
  const items = await getMySpaceRegistrations();
  return (
    <div className="mx-auto max-w-5xl" data-testid="space-regs-mine">
      <div className="space-y-5">
        <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Programme Registrations' }]} title="My Programme Registrations" subtitle="Programmes you have registered for at NOSTOPS Spaces." />
        {items.length === 0 ? (
          <SpEmpty title="No registrations yet" testId="space-regs-empty" action={<Link href="/events" className="sp-btn-primary bg-accent">Find a programme →</Link>} />
        ) : items.map((r) => (
          <Link key={r.registration_id} href={`/app/spaces/registrations/${r.registration_id}`} className="sp-card block p-4 hover:border-[#F2B574]" data-testid={`space-reg-row-${r.registration_id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[19px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{r.event?.title}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${REG_STATUS[r.status]?.tone || ''}`}>{REG_STATUS[r.status]?.label || r.status}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{r.event?.space?.name} · {r.event?.event_date ? fmtDateLong(r.event.event_date) : 'Date TBC'} · {r.pricing_mode === 'PAID' ? inr(r.amount) : 'Free'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
