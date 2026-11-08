'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PublicVenue } from '@/lib/server/venues';
import { useSavedVenues } from '@/lib/saved-venues';
import VenueCard from '@/components/venues/VenueCard';
import ShareShortlist from '@/components/venues/ShareShortlist';

const MAX_COMPARE = 4;

// Client view for /venues/saved: filters the full (server-fetched) venue list
// down to the visitor's shortlisted ids, preserving most-recently-saved order.
// Also hosts shortlist sharing and picking 2–4 venues to compare side by side.
export default function SavedVenuesList({ venues }: { venues: PublicVenue[] }) {
  const { ids } = useSavedVenues();
  const [picked, setPicked] = useState<string[]>([]);
  const byId = new Map(venues.map((v) => [v.id, v]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as PublicVenue[];
  const selected = picked.filter((id) => ordered.some((v) => v.id === id));

  if (ordered.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-10 text-center" data-testid="saved-empty">
        <span aria-hidden className="text-4xl">🤍</span>
        <p className="mt-3 text-lg font-bold text-ink">No saved venues yet</p>
        <p className="mt-1 text-ink-soft">Tap the heart on any venue to shortlist it here for later.</p>
        <Link href="/venues" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600">
          Explore venues →
        </Link>
      </div>
    );
  }

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_COMPARE ? p : [...p, id]));
  }
  const full = selected.length >= MAX_COMPARE;

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="saved-toolbar">
        <div>
          <p className="font-black text-ink" data-testid="saved-count">{ordered.length} saved venue{ordered.length === 1 ? '' : 's'}</p>
          <p className="mt-0.5 text-sm text-ink-soft">Share your shortlist, or tick up to {MAX_COMPARE} venues to compare them side by side.</p>
        </div>
        <ShareShortlist ids={ordered.map((v) => v.id)} />
      </div>

      <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="saved-list">
        {ordered.map((v) => {
          const on = selected.includes(v.id);
          const disabled = !on && full;
          return (
            <li key={v.id} className="flex flex-col gap-2">
              <VenueCard v={v} />
              <label
                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft hover:border-brand'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={() => togglePick(v.id)}
                  className="h-4 w-4 accent-brand"
                  data-testid="compare-pick"
                />
                {on ? 'Selected for comparison' : disabled ? `Max ${MAX_COMPARE} to compare` : 'Compare'}
              </label>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg" data-testid="compare-bar">
          <p className="text-sm font-bold text-ink">
            {selected.length} selected{selected.length < 2 ? ' · pick one more to compare' : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPicked([])}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 text-sm font-bold text-ink-soft transition hover:border-brand"
              data-testid="compare-clear"
            >
              Clear
            </button>
            {selected.length >= 2 ? (
              <Link
                href={`/venues/compare?ids=${selected.join(',')}`}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600"
                data-testid="compare-go"
              >
                Compare {selected.length} venues →
              </Link>
            ) : (
              <span className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-xl bg-brand/40 px-5 text-sm font-bold text-white" aria-disabled data-testid="compare-go-disabled">
                Compare →
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
