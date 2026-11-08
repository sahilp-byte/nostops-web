'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

type Place = { id: string; name?: string; address?: string };

/** Admin switches Google photos & reviews on for a free venue listing by
 *  confirming its exact Google place (or turns them off). No purchase needed. */
export default function VenueGoogleGrantAdmin({
  id,
  active,
  placeId,
  grantedBy,
  defaultQuery,
}: {
  id: string;
  active: boolean;
  placeId: string | null;
  grantedBy?: string;
  defaultQuery: string;
}) {
  const router = useRouter();
  const [pid, setPid] = useState(placeId || '');
  const [query, setQuery] = useState(defaultQuery);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/bff/admin/venue-submissions/${encodeURIComponent(id)}/google-grant`;

  async function search() {
    setBusy(true);
    setMsg(null);
    const r = await postBff(`${base}/lookup`, { query });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: (r.data as { error?: string })?.error || 'Search failed.' }); return; }
    setPlaces(((r.data as { places?: Place[] })?.places) || []);
  }

  async function save(next: string) {
    setBusy(true);
    setMsg(null);
    const r = await postBff(base, { place_id: next });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: (r.data as { error?: string })?.error || 'Could not save.' }); return; }
    setPid(next);
    setMsg({ ok: true, text: next ? 'Switched on. Google photos and reviews now show on this listing.' : 'Switched off. The listing shows only the owner\u2019s photos.' });
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand/20 bg-white p-4" data-testid="google-grant-admin">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-ink">📍 Google photos &amp; reviews</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-cream text-ink-soft'}`} data-testid="google-grant-status">
          {active ? `On · switched on by ${grantedBy || 'an admin'}` : 'Off'}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Switch on to show this venue&apos;s Google photos, rating and reviews on its listing and directory card. Find the exact business first — the wrong place would show another venue&apos;s photos.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="grant-query">Search Google for this venue</label>
        <input id="grant-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Venue name and town" className="min-w-0 flex-1 rounded-xl border border-line bg-white p-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="google-grant-query" />
        <button type="button" onClick={search} disabled={busy} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50" data-testid="google-grant-search">
          {busy ? 'Working…' : 'Find on Google'}
        </button>
      </div>

      {places && (
        places.length === 0 ? (
          <p className="mt-2 text-xs text-muted" data-testid="google-grant-no-results">No Google places found. Try the name as it appears on Google Maps.</p>
        ) : (
          <ul className="mt-2 list-none space-y-2 p-0" data-testid="google-grant-results">
            {places.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-cream/40 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{p.name || 'Unnamed place'}</p>
                  {p.address && <p className="text-xs text-ink-soft">{p.address}</p>}
                  <a href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.id)}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-700 hover:underline">Check on Google Maps ↗</a>
                </div>
                <button type="button" onClick={() => save(p.id)} disabled={busy || p.id === pid} className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="google-grant-pick">
                  {p.id === pid ? 'Selected' : 'Use this place'}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-bold text-muted">Enter a Place ID instead</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="grant-place-id">Google Place ID</label>
          <input id="grant-place-id" value={pid} onChange={(e) => setPid(e.target.value)} placeholder="ChIJ…" className="min-w-0 flex-1 rounded-xl border border-line bg-white p-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="google-grant-input" />
          <button type="button" onClick={() => save(pid.trim())} disabled={busy || !pid.trim()} className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="google-grant-save">
            Save place
          </button>
        </div>
      </details>

      {active && (
        <button type="button" onClick={() => save('')} disabled={busy} className="mt-3 min-h-[44px] rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50" data-testid="google-grant-off">
          Switch off
        </button>
      )}
      {msg && <p className={`mt-2 text-xs font-semibold ${msg.ok ? 'text-brand-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
    </div>
  );
}
