import Link from 'next/link';
import { NOT_ELIGIBLE_MSG } from '@/lib/server/venue-ownership';

// Shown to accounts that may not claim or manage Global Venues (seekers, non-empanelled teachers).
export default function VenueNotEligible({ venueName }: { venueName?: string }) {
  return (
    <div className="mx-auto max-w-2xl" data-testid="venue-not-eligible">
      <Link href="/venues" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-700 hover:underline">‹ Global Venues</Link>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">{venueName ? `Claiming ${venueName}` : 'Venue management'} is for empanelled teachers</h1>
      <p className="mt-2 text-sm text-ink-soft">{NOT_ELIGIBLE_MSG}</p>
      <p className="mt-2 text-sm text-ink-soft">If you own this venue and teach yoga, complete your teacher empanelment first. Otherwise you can still suggest updates to any listing.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/levels" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white">About empanelment</Link>
        <Link href="/venues" className="inline-flex min-h-11 items-center rounded-xl border-2 border-brand-700 bg-white px-4 text-sm font-bold text-brand-700">Browse Global Venues</Link>
      </div>
    </div>
  );
}
