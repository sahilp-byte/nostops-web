'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff } from '@/lib/auth-client';

// "Find teachers near me" — asks for GPS on tap (clear intent), reverse-geocodes
// server-side to a city, then filters Discover by that city. Degrades gracefully
// on permission denial with guidance (never dead-ends the user).
export default function LocationButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function detect() {
    setMsg(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMsg('Location isn’t available on this device — search by city below.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const r = await getBff<{ city?: string; error?: string }>(`/bff/geo/reverse?lat=${latitude}&lng=${longitude}`);
        setBusy(false);
        // Round to ~3 decimals (~100 m) — enough for distance ranking, never
        // precise. Sort teachers & venues by real distance; keep the city label.
        const q = new URLSearchParams({ lat: latitude.toFixed(3), lng: longitude.toFixed(3) });
        const city = r.ok ? r.data?.city || '' : '';
        if (city) q.set('near', city);
        router.push(`/app/discover?${q.toString()}`);
      },
      (err) => {
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED)
          setMsg('Location permission denied. Enable it in your browser settings, or just search by city below.');
        else setMsg('Couldn’t get your location — please search by city below.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={detect}
        disabled={busy}
        data-testid="use-my-location"
        className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-50/60 px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
      >
        📍 {busy ? 'Detecting your area…' : 'Find teachers & venues near me'}
      </button>
      {msg && (
        <p className="mt-2 text-sm font-semibold text-amber-700" data-testid="location-msg">
          {msg}
        </p>
      )}
    </div>
  );
}
