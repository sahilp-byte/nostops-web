'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBff } from '@/lib/auth-client';

// Present-location pill shown in the app header for EVERY logged-in persona,
// sitting just left of the search icon. Uses the browser Geolocation API and the
// existing server-side reverse-geocoder (/bff/geo/reverse) — no maps key on the
// client, and coordinates are rounded to ~city precision before leaving the
// device. Respects permission states (granted / prompt / denied / unavailable),
// never dead-ends, and caches the last city so it shows instantly on reload.
const CACHE_KEY = 'nostops.geo.v1';
type Cache = { city: string; region?: string; ts: number };
type Status = 'idle' | 'loading' | 'ok' | 'prompt' | 'denied' | 'unavailable';

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    return c && c.city ? c : null;
  } catch {
    return null;
  }
}

function writeCache(city: string, region?: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ city, region, ts: Date.now() } satisfies Cache));
  } catch {
    /* ignore */
  }
}

export default function HeaderLocation() {
  const [city, setCity] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [hint, setHint] = useState<string | null>(null);
  const resolving = useRef(false);

  const resolve = useCallback((haveCached: boolean) => {
    if (resolving.current) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!haveCached) setStatus('unavailable');
      return;
    }
    resolving.current = true;
    if (!haveCached) setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const r = await getBff<{ city?: string; region?: string }>(
          `/bff/geo/reverse?lat=${latitude.toFixed(3)}&lng=${longitude.toFixed(3)}`,
        );
        resolving.current = false;
        const c = r.ok ? r.data?.city || '' : '';
        if (c) {
          setCity(c);
          setStatus('ok');
          setHint(null);
          writeCache(c, r.ok ? r.data?.region : undefined);
        } else if (!haveCached) {
          setStatus('unavailable');
        }
      },
      (err) => {
        resolving.current = false;
        if (err.code === err.PERMISSION_DENIED) {
          setStatus(haveCached ? 'ok' : 'denied');
          setHint('Location is blocked. Enable it for this site in your browser settings.');
        } else if (!haveCached) {
          setStatus('unavailable');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached?.city) {
      setCity(cached.city);
      setStatus('ok');
    }

    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    if (perms?.query) {
      perms
        .query({ name: 'geolocation' as PermissionName })
        .then((p) => {
          if (p.state === 'granted') resolve(Boolean(cached?.city));
          else if (p.state === 'denied') {
            if (!cached?.city) setStatus('denied');
          } else if (!cached?.city) {
            setStatus('prompt');
          }
        })
        .catch(() => {
          if (!cached?.city) setStatus('prompt');
        });
    } else if (!cached?.city) {
      setStatus('prompt');
    }
  }, [resolve]);

  // Contextual request on tap (clear user intent) for prompt/denied/unavailable.
  function onTap() {
    setHint(null);
    resolve(Boolean(city));
  }

  const label =
    status === 'loading' ? 'Locating…' : city ? city : status === 'denied' ? 'Set location' : status === 'unavailable' ? 'Set location' : 'Set location';

  const isPill = !city && (status === 'prompt' || status === 'denied' || status === 'unavailable');
  const showSpinner = status === 'loading';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onTap}
        data-testid="header-location"
        aria-label={city ? `Your location: ${city}. Update location` : 'Set your location'}
        title={city ? `Your location: ${city}` : 'Use your current location'}
        className={`inline-flex h-9 max-w-[46vw] items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold transition sm:max-w-[220px] sm:px-3 ${
          isPill
            ? 'border-dashed border-brand/40 text-brand-700 hover:bg-brand-50'
            : 'border-line text-ink-soft hover:bg-cream'
        }`}
      >
        <span aria-hidden="true" className="text-base leading-none">📍</span>
        {/* Icon-only on phones (the aria-label/title still name the city). */}
        <span className="hidden truncate sm:inline">{label}</span>
        {showSpinner && (
          <span
            aria-hidden="true"
            className="ml-0.5 h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
          />
        )}
      </button>
      {hint && (
        <span
          role="status"
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-line bg-white p-2 text-[11px] font-semibold text-ink-soft shadow-lg"
        >
          {hint}
        </span>
      )}
    </div>
  );
}
