'use client';

import Link from 'next/link';
import type { PublicVenue } from '@/lib/server/venues';
import { useSavedVenues } from '@/lib/saved-venues';
import VenueCard from '@/components/venues/VenueCard';

// Client view for a shortlist someone shared (/venues/saved?ids=…): shows those
// venues and lets the visitor copy them into their own device shortlist.
export default function SharedShortlist({ venues }: { venues: PublicVenue[] }) {
  const { ids, saveMany } = useSavedVenues();

  if (venues.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-10 text-center" data-testid="shared-empty">
        <span aria-hidden className="text-4xl">🔗</span>
        <p className="mt-3 text-lg font-bold text-ink">This shortlist has no venues</p>
        <p className="mt-1 text-ink-soft">The shared venues may no longer be listed. You can browse all venues instead.</p>
        <Link href="/venues" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600">
          Explore venues →
        </Link>
      </div>
    );
  }

  const allSaved = venues.every((v) => ids.includes(v.id));
  const compareIds = venues.slice(0, 4).map((v) => v.id);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-brand/30 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="shared-banner">
        <div>
          <p className="font-black text-ink">Someone shared {venues.length} venue{venues.length === 1 ? '' : 's'} with you</p>
          <p className="mt-0.5 text-sm text-ink-soft">Save them to your own shortlist on this device, or compare them side by side.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {venues.length >= 2 && (
            <Link
              href={`/venues/compare?ids=${compareIds.join(',')}`}
              data-testid="shared-compare"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-brand"
            >
              Compare{venues.length > 4 ? ' first 4' : ''}
            </Link>
          )}
          {allSaved ? (
            <Link
              href="/venues/saved"
              data-testid="shared-view-mine"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              ✓ Saved · View my shortlist
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => saveMany(venues.map((v) => v.id))}
              data-testid="shared-save-all"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              Save all to my shortlist
            </button>
          )}
        </div>
      </div>
      <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="shared-list">
        {venues.map((v) => (
          <li key={v.id}><VenueCard v={v} /></li>
        ))}
      </ul>
    </>
  );
}
