'use client';

import { useState } from 'react';
import type { VenueReview } from '@/lib/server/retreats';

function Stars({ n }: { n?: number }) {
  if (typeof n !== 'number') return null;
  const full = Math.round(n);
  return (
    <span className="text-sm text-amber-500" aria-label={`${n} out of 5`}>
      {'★'.repeat(Math.max(0, Math.min(5, full)))}
      <span className="text-line">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

// Google reviews list with an expandable "read all". Clearly attributed to
// Google; NOSTOPS never presents these as its own reviews.
export default function VenueReviews({ reviews }: { reviews: VenueReview[] }) {
  const [expanded, setExpanded] = useState(false);
  if (reviews.length === 0) return null;
  const shown = expanded ? reviews : reviews.slice(0, 3);

  return (
    <div data-testid="venue-reviews">
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
        {shown.map((r, idx) => (
          <li key={idx} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-3">
              {r.authorPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.authorPhoto} alt="" loading="lazy" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-cream text-sm font-bold text-ink-soft">
                  {(r.author || '?').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{r.author || 'Google reviewer'}</p>
                <div className="flex items-center gap-2">
                  <Stars n={r.rating} />
                  {r.relativeTime && <span className="text-xs text-muted">{r.relativeTime}</span>}
                </div>
              </div>
            </div>
            {r.text && <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-ink-soft">{r.text}</p>}
          </li>
        ))}
      </ul>
      {reviews.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-accent hover:text-accent-600"
        >
          {expanded ? 'Show fewer reviews' : `Read all ${reviews.length} reviews`}
        </button>
      )}
    </div>
  );
}
