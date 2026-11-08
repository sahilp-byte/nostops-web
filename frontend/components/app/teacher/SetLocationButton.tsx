'use client';

import { useState } from 'react';
import { getBff, postBff } from '@/lib/auth-client';

// Teacher drops their GPS location (reverse-geocoded to a city server-side) so
// they appear in seekers' nearby/distance searches. Graceful permission flow.
export default function SetLocationButton({ initialCity }: { initialCity?: string }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(initialCity || null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  function set() {
    setMsg(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMsg({ kind: 'err', text: 'Location isn’t available on this device.' });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const rg = await getBff<{ city?: string; region?: string; country?: string }>(`/bff/geo/reverse?lat=${latitude}&lng=${longitude}`);
        const city = rg.ok ? rg.data?.city || '' : '';
        const r = await postBff<{ ok?: boolean; error?: string }>('/bff/teacher/location', {
          latitude,
          longitude,
          city,
          state: rg.data?.region,
          country: rg.data?.country,
        });
        setBusy(false);
        if (r.ok && r.data?.ok) {
          setSaved(city || 'your location');
          setMsg({ kind: 'ok', text: `Saved — you’ll appear in nearby searches${city ? ` around ${city}` : ''}.` });
        } else {
          setMsg({ kind: 'err', text: r.data?.error || 'Could not save your location.' });
        }
      },
      (err) => {
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED)
          setMsg({ kind: 'info', text: 'Location permission denied. Enable it in your browser settings to appear in nearby searches.' });
        else setMsg({ kind: 'err', text: 'Couldn’t get your location. Please try again.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="set-location">
      <h2 className="text-base font-extrabold text-ink">📍 Your location for nearby search</h2>
      <p className="mt-0.5 text-sm text-ink-soft">Drop your location so seekers nearby can find you — not just by city name.</p>
      {saved && <p className="mt-2 text-sm font-semibold text-brand-700" data-testid="set-location-current">Current: {saved}</p>}
      <button
        type="button"
        onClick={set}
        disabled={busy}
        data-testid="set-location-btn"
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? 'Getting your location…' : saved ? 'Update my location' : 'Use my current location'}
      </button>
      {msg && (
        <p className={`mt-2 text-sm font-semibold ${msg.kind === 'ok' ? 'text-brand-700' : msg.kind === 'err' ? 'text-red-600' : 'text-amber-700'}`} data-testid="set-location-msg">
          {msg.text}
        </p>
      )}
    </section>
  );
}
