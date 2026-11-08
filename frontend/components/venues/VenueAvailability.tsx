'use client';

import { useState } from 'react';
import Link from 'next/link';

// PROMPT 9 — Live venue availability. Fetches occupancy + remaining capacity for
// upcoming retreats at this venue over a date window via the public endpoint
// GET /venues/{id}/availability. No confidential rates are shown.
type Item = {
  retreatId: string;
  title: string;
  start?: string;
  end?: string;
  seatsTotal: number;
  seatsFilled: number;
  seatsRemaining: number;
  occupancyPct: number;
  status: string;
  availability: 'available' | 'filling' | 'sold_out';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(d?: string): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return '';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}
function range(a?: string, b?: string): string {
  if (a && b && a !== b) return `${fmt(a)} – ${fmt(b)}`;
  return fmt(a || b);
}

const BADGE: Record<Item['availability'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-brand-50 text-brand-700' },
  filling: { label: 'Filling fast', cls: 'bg-amber-100 text-amber-700' },
  sold_out: { label: 'Sold out', cls: 'bg-red-50 text-red-600' },
};

export default function VenueAvailability({ venueId, initial, initialFrom }: { venueId: string; initial: Item[]; initialFrom: string }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState('');
  const [items, setItems] = useState<Item[]>(initial);
  const [loading, setLoading] = useState(false);

  async function refetch(nextFrom: string, nextTo: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (nextFrom) qs.set('from', nextFrom);
      if (nextTo) qs.set('to', nextTo);
      const res = await fetch(`/venues/${venueId}/availability?${qs.toString()}`, { headers: { accept: 'application/json' } });
      const data = await res.json().catch(() => null);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-testid="venue-availability">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wide text-muted" htmlFor="av-from">From</label>
          <input id="av-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); refetch(e.target.value, to); }} className="mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" data-testid="availability-from" />
        </div>
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wide text-muted" htmlFor="av-to">To <span className="font-normal">· optional</span></label>
          <input id="av-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); refetch(from, e.target.value); }} className="mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" data-testid="availability-to" />
        </div>
        {loading && <span className="pb-2 text-xs font-semibold text-muted">Checking…</span>}
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-bold text-ink">No retreats in this window.</p>
          <p className="mt-1 text-ink-soft">Try a wider date range, or <Link href="/retreats" className="font-bold text-brand-700 hover:underline">browse all retreats →</Link></p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3 p-0">
          {items.map((it) => {
            const badge = BADGE[it.availability];
            return (
              <li key={it.retreatId} className="rounded-2xl border border-line bg-white p-4" data-testid="availability-row">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/retreats/${it.retreatId}`} className="font-black text-ink hover:text-brand-700 hover:underline">{it.title}</Link>
                    {range(it.start, it.end) && <p className="text-xs text-muted">{range(it.start, it.end)}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
                    <div className={`h-full rounded-full ${it.availability === 'sold_out' ? 'bg-red-500' : it.availability === 'filling' ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, it.occupancyPct)}%` }} />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-ink-soft">
                    {it.availability === 'sold_out' ? 'Fully booked' : `${it.seatsRemaining} of ${it.seatsTotal} seats left`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
