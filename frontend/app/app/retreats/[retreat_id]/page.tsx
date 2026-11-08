import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import { inr } from '@/lib/format';
import { isPublicRetreatRecord, toPublicRetreat, fmtRange, durationDays, type PublicRetreat } from '@/lib/server/retreats';
import RetreatBookingPanel from '@/components/retreats/RetreatBookingPanel';
import EnquiryForm from '@/components/retreats/EnquiryForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reserve a retreat seat', robots: { index: false, follow: false } };

type Params = { params: Promise<{ retreat_id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function getRetreat(id: string): Promise<PublicRetreat | null> {
  try {
    const d = await apiGet<any>(`/retreats/${id}`, { noStore: true });
    if (!isPublicRetreatRecord(d)) return null;
    return toPublicRetreat(d);
  } catch {
    return null;
  }
}

export default async function AppRetreatReservePage({ params, searchParams }: Params) {
  const { retreat_id } = await params;
  const sp = await searchParams;
  const cohort = typeof sp.cohort === 'string' ? sp.cohort.slice(0, 120) : undefined;
  const via = typeof sp.via === 'string' ? sp.via.slice(0, 80) : undefined;
  const initialMode = sp.mode === 'group' ? 'group' : 'individual';
  const [user, r] = await Promise.all([getSessionUser(), getRetreat(retreat_id)]);
  if (!r) notFound();

  const location = [r.venueName, r.city, r.state].filter(Boolean).join(', ');
  const days = durationDays(r.startDate, r.endDate);
  const dateStr = fmtRange(r.startDate, r.endDate);
  const soldOut = r.status === 'sold_out' || r.seatsRemaining === 0;
  const u = (user || {}) as Record<string, any>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/retreats/${r.id}`} className="text-sm font-bold text-brand-700 hover:underline">‹ Back to retreat</Link>
      <h1 className="mt-4 text-2xl font-black tracking-tight text-ink sm:text-3xl">{r.title}</h1>
      {r.guruName && <p className="mt-1 text-ink-soft">Hosted by {r.guruName}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div>
          {soldOut ? (
            <div className="card p-6">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">This retreat is sold out</h2>
              <p className="mt-2 text-sm text-ink-soft">Join the waitlist and we&apos;ll let you know if a seat opens up.</p>
              <div className="mt-4"><EnquiryForm retreatId={r.id} /></div>
            </div>
          ) : (
            <RetreatBookingPanel
              retreatId={r.id}
              retreatTitle={r.title}
              priceInr={r.priceInr}
              startISO={r.startDate}
              endISO={r.endDate}
              defaultName={displayName(user) || String(u.name || '')}
              defaultEmail={String(u.email || '')}
              defaultPhone={String(u.phone || u.mobile || '')}
              cohort={cohort}
              via={via}
              initialMode={initialMode}
            />
          )}
        </div>

        <aside className="md:sticky md:top-20 md:self-start">
          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Retreat summary</h2>
            {typeof r.priceInr === 'number' && (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-black text-ink">₹{inr(r.priceInr)}</span>
                <span className="text-sm text-muted">/ seat</span>
              </div>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              {dateStr && (<div className="flex justify-between gap-3"><dt className="text-muted">Dates</dt><dd className="text-right font-semibold text-ink">{dateStr}</dd></div>)}
              {days && (<div className="flex justify-between"><dt className="text-muted">Duration</dt><dd className="font-semibold text-ink">{days} days</dd></div>)}
              {location && (<div className="flex justify-between gap-3"><dt className="text-muted">Venue</dt><dd className="text-right font-semibold text-ink">{location}</dd></div>)}
              {typeof r.seatsRemaining === 'number' && (
                <div className="flex justify-between"><dt className="text-muted">Availability</dt><dd className={`font-semibold ${soldOut ? 'text-ink-soft' : 'text-brand-700'}`}>{soldOut ? 'Sold out' : `${r.seatsRemaining} seats left`}</dd></div>
              )}
            </dl>
            <p className="mt-4 text-xs text-muted">Your seat is held for a limited time once you reserve. Payment is completed on a secure hosted checkout.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
