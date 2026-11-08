'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getBff } from '@/lib/auth-client';

type NearbyData = {
  city: string;
  source: string;
  hasOrigin: boolean;
  radiusKm: number;
  counts: { teachers: number; batches: number; coordinators: number; retreats: number };
  error?: string;
};

const RADII = [5, 10, 25, 50, 100];

const STAT_META: Array<{ key: keyof NearbyData['counts']; label: string; icon: string }> = [
  { key: 'teachers', label: 'Teachers', icon: '🧘' },
  { key: 'batches', label: 'Upcoming batches', icon: '📅' },
  { key: 'coordinators', label: 'Coordinators', icon: '🤝' },
  { key: 'retreats', label: 'Retreats', icon: '🏞️' },
];

// Live "within X km" summary for the signed-in learner. Wired to the real
// backend (/api/users/me/nearby via the BFF), which resolves the caller's own
// saved/live origin server-side and returns real counts. Never dead-ends:
// when no origin is saved, it guides the user to set their location.
export default function NearbyPanel() {
  const [radius, setRadius] = useState(25);
  const [data, setData] = useState<NearbyData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: number) => {
    setBusy(true);
    setError(null);
    const res = await getBff<NearbyData>(`/bff/nearby?radius_km=${r}`);
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 401 ? 'signin' : 'error');
      return;
    }
    setData(res.data);
  }, []);

  useEffect(() => {
    load(radius);
  }, [radius, load]);

  function pick(r: number) {
    if (r !== radius) setRadius(r);
  }

  return (
    <section className="mt-4 rounded-2xl border border-brand/20 bg-brand-50/40 p-4" data-testid="nearby-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wider text-brand-700">📍 Near you</h2>
        {data?.hasOrigin && data.city && (
          <span className="text-xs font-semibold text-ink-soft" data-testid="nearby-origin">
            around <strong className="text-ink">{data.city}</strong>
          </span>
        )}
      </div>

      {/* Radius selector */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted">Search radius</label>
          <span className="text-sm font-black text-brand-700" data-testid="nearby-radius-label">
            within {radius} km
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Search radius">
          {RADII.map((r) => {
            const selected = r === radius;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(r)}
                data-testid={`nearby-radius-${r}`}
                className={`min-h-[36px] rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  selected
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
                }`}
              >
                {r} km
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="mt-4" aria-live="polite">
        {error === 'signin' ? (
          <p className="text-sm font-semibold text-ink-soft">
            <Link href="/login" className="text-brand-700 underline">
              Sign in
            </Link>{' '}
            to see what&apos;s near you.
          </p>
        ) : error === 'error' ? (
          <div className="flex items-center gap-3 text-sm font-semibold text-amber-700">
            <span>Couldn&apos;t load nearby results.</span>
            <button type="button" onClick={() => load(radius)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50">
              Retry
            </button>
          </div>
        ) : busy && !data ? (
          <p className="text-sm font-semibold text-muted">Finding what&apos;s near you…</p>
        ) : data && !data.hasOrigin ? (
          <div className="text-sm text-ink-soft">
            <p className="font-semibold text-ink">We don&apos;t know where you are yet.</p>
            <p className="mt-1">
              Tap <strong>Find teachers near me</strong> above to detect your city, or set your area in{' '}
              <Link href="/app/settings" className="text-brand-700 underline">
                settings
              </Link>
              .
            </p>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAT_META.map((s) => (
                <div
                  key={s.key}
                  className="rounded-xl border border-line bg-white px-3 py-2.5 text-center"
                  data-testid={`nearby-count-${s.key}`}
                >
                  <div className={`text-2xl font-black ${busy ? 'text-muted' : 'text-brand-700'}`}>
                    {data.counts[s.key]}
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                    <span aria-hidden="true">{s.icon} </span>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            {data.counts.teachers === 0 && (
              <p className="mt-2.5 text-xs text-muted">
                No teachers have shared their exact location within {radius} km yet — widen the radius or use the city
                filters below to find them.
              </p>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
