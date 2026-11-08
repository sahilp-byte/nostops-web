'use client';

import { useState } from 'react';

// Shared searchable venue picker — mirrors the create-wizard venue step so the
// edit flow reuses the same UX against the SAME existing venue directory. It
// never infers a venue from name/city and never silently substitutes one; the
// caller owns the selected id and decides when to persist it.
export type EligibleVenue = { id: string; name: string; city: string; state: string; lat: number | null; lng: number | null; capacity: number | null };

/** Capacity hint shown under a selected venue (seats are capped at capacity). */
export function VenueCapacityNote({ venue, seats }: { venue: EligibleVenue | null; seats: number }) {
  if (!venue) return null;
  if (venue.capacity == null) {
    return (
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" data-testid="venue-capacity-unknown">
        ⚠ This venue hasn&apos;t listed its capacity. Please confirm it can hold {seats > 0 ? `${seats} guests` : 'your group'} before publishing.
      </p>
    );
  }
  const over = seats > venue.capacity;
  return (
    <p className={`mt-2 text-xs font-semibold ${over ? 'text-red-600' : 'text-brand-700'}`} data-testid="venue-capacity">
      {over
        ? `⚠ This venue holds up to ${venue.capacity} guests — reduce seats to ${venue.capacity} or fewer, or pick a larger venue.`
        : `✓ Holds up to ${venue.capacity} guests.`}
    </p>
  );
}

const inputCls =
  'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-cream disabled:text-muted';

export default function VenuePicker({
  venues,
  selectedId,
  onSelect,
  disabled = false,
  ineligible = false,
}: {
  venues: EligibleVenue[];
  selectedId: string;
  onSelect: (v: EligibleVenue) => void;
  disabled?: boolean;
  /** selectedId is set but no longer resolves to an eligible venue */
  ineligible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = venues.find((v) => v.id === selectedId) || null;
  const q = query.trim().toLowerCase();
  const matches = (q ? venues.filter((v) => `${v.name} ${v.city} ${v.state}`.toLowerCase().includes(q)) : venues).slice(0, 8);
  const showList = open || !selected;

  return (
    <div className="rounded-xl border border-line bg-white p-3.5" data-testid="venue-picker-card">
      <p className="text-sm font-extrabold text-ink">Listed venue{selected ? '' : ' *'}</p>
      <p className="mt-0.5 mb-2 text-xs text-ink-soft">
        {selected ? 'Hosted at a venue listed on NOSTOPS. Change it to another listed venue if needed.' : 'Published retreats are hosted at a venue listed on NOSTOPS. Select the listed venue below.'}
      </p>

      {ineligible && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold" style={{ color: '#B45309' }} data-testid="venue-ineligible">
          The venue previously linked to this retreat is no longer listed or eligible. Please select an eligible venue.
        </p>
      )}

      {selected && !open && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-50/50 px-3 py-2" data-testid="venue-selected">
          <span className="text-sm font-bold text-ink">✓ {selected.name}{selected.city ? ` · ${selected.city}` : ''}{selected.state ? `, ${selected.state}` : ''}</span>
          {!disabled && <button type="button" onClick={() => { setOpen(true); setQuery(''); }} className="text-xs font-bold text-brand-700 hover:underline" data-testid="venue-change">Change</button>}
        </div>
      )}

      {showList && (
        <>
          <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search listed venues by name or city…" data-testid="venue-search" autoCapitalize="none" disabled={disabled} />
          <ul className="mt-2 max-h-56 divide-y divide-line overflow-auto rounded-lg border border-line" data-testid="venue-options">
            {matches.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted">No listed venues match. <a href="/venues/submit" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 hover:underline">Get it listed (free) →</a></li>
            )}
            {matches.map((v) => (
              <li key={v.id}>
                <button type="button" disabled={disabled} onClick={() => { onSelect(v); setOpen(false); setQuery(''); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cream/60 disabled:opacity-50" data-testid={`venue-opt-${v.id}`}>
                  <span className="font-semibold text-ink">{v.name}</span>
                  <span className="shrink-0 text-xs text-muted">{[v.city, v.state].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && open && !disabled && (
            <button type="button" onClick={() => { setOpen(false); setQuery(''); }} className="mt-2 text-xs font-bold text-muted hover:underline" data-testid="venue-cancel">Cancel</button>
          )}
        </>
      )}
    </div>
  );
}
