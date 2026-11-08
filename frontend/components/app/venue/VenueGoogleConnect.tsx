'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Connect / disconnect a venue's public Google listing (adds rating, reviews &
// photos to its public profile). CSRF-guarded via sendBff.
const MAPS_RE = /^https?:\/\/.*(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|business\.google\.|share\.google)/i;

type Summary = { name?: string; rating?: number; reviewCount?: number; photoCount?: number };

function connectedToast(sum?: Summary): string {
  const bits: string[] = [];
  if (sum && typeof sum.photoCount === 'number' && sum.photoCount > 0) bits.push(`${sum.photoCount} ${sum.photoCount === 1 ? 'photo' : 'photos'}`);
  if (sum && typeof sum.rating === 'number' && sum.rating > 0) bits.push(`${sum.rating.toFixed(1)}★${sum.reviewCount ? ` (${sum.reviewCount})` : ''}`);
  return bits.length ? `Pulled ${bits.join(' & ')} from Google` : 'Google listing connected — photos & reviews will appear on your public page.';
}

export default function VenueGoogleConnect({ centerId, connected }: { centerId: string; connected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [perm, setPerm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [detected, setDetected] = useState('');       // live "we found …" preview
  const [previewing, setPreviewing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null); // success toast
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live preview: debounce the pasted link and ask the server which venue we
  // detected, so owners can confirm the right place BEFORE connecting.
  useEffect(() => {
    const u = url.trim();
    setDetected('');
    if (!open || !MAPS_RE.test(u)) { setPreviewing(false); return; }
    setPreviewing(true);
    const t = setTimeout(async () => {
      const r = await sendBff(`/bff/venue/centers/${centerId}/google`, 'POST', { action: 'preview', maps_url: u });
      // Ignore stale responses if the input changed meanwhile.
      setUrl((cur) => {
        if (cur.trim() === u) { setDetected(r.ok && r.data?.detectedName ? r.data.detectedName : ''); setPreviewing(false); }
        return cur;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [url, open, centerId]);

  function showFlash(msg: string) {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 7000);
  }

  async function connect() {
    setErr(null);
    if (!url.trim()) { setErr('Paste the venue’s Google Maps link.'); return; }
    if (!perm) { setErr('Please confirm you have permission.'); return; }
    setBusy(true);
    const r = await sendBff(`/bff/venue/centers/${centerId}/google`, 'POST', { action: 'connect', maps_url: url.trim(), i_have_venue_permission: true });
    if (!r.ok) {
      setBusy(false);
      setErr(r.data?.error || 'Could not connect.');
      if (r.data?.detectedName) setDetected(r.data.detectedName);
      return;
    }
    setBusy(false); setOpen(false); setUrl(''); setPerm(false); setDetected('');
    showFlash(`✓ ${connectedToast(r.data?.summary)}`);
    router.refresh();
  }
  async function disconnect() {
    setBusy(true); setErr(null);
    const r = await sendBff(`/bff/venue/centers/${centerId}/google`, 'POST', { action: 'disconnect' });
    if (!r.ok) { setBusy(false); setErr(r.data?.error || 'Could not disconnect.'); return; }
    setBusy(false); setFlash(null);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="venue-google">
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">✓ Google connected</span>
        <button type="button" onClick={disconnect} disabled={busy} className="text-[11px] font-bold text-muted underline hover:text-ink disabled:opacity-50">{busy ? '…' : 'Disconnect'}</button>
        {flash && <span className="w-full rounded-md bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700" data-testid="venue-google-flash">{flash}</span>}
        {err && <span className="text-[11px] font-bold text-red-600">{err}</span>}
      </div>
    );
  }

  return (
    <div data-testid="venue-google">
      {flash && <p className="mb-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700" data-testid="venue-google-flash">{flash}</p>}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} title="Add your venue's Google Business Profile link to auto-pull its photos, rating and reviews onto your public page." className="text-[11px] font-bold text-brand-700 underline hover:text-brand-600" data-testid="venue-google-open">+ Connect Google listing</button>
      ) : (
        <div className="mt-1 space-y-2 rounded-lg border border-line bg-cream/60 p-2.5">
          <div className="rounded-md border border-brand/15 bg-white p-2.5" data-testid="venue-google-help">
            <p className="text-[11px] font-black text-ink">Why connect it?</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">We’ll automatically pull your venue’s <strong>photos, star rating and reviews</strong> from Google onto your public NOSTOPS page — building instant trust with seekers, with no manual uploads. It also strengthens your case for the <strong>🛡️ NOSTOPS Verified</strong> badge.</p>
            <p className="mt-2 text-[11px] font-black text-ink">How to find your link</p>
            <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-ink-soft">
              <li>Search your venue’s name on <strong>Google Maps</strong> (app or google.com/maps).</li>
              <li>Open its listing, then tap <strong>Share</strong> → <strong>Copy link</strong>.</li>
              <li>Paste that link below (it looks like <code className="rounded bg-cream px-1">maps.app.goo.gl/…</code>).</li>
            </ol>
            <p className="mt-1.5 text-[11px] text-muted">Tip: use the venue’s own listing link — a general search-results link won’t work.</p>
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" inputMode="url" autoCapitalize="none" className="w-full rounded-md border border-line px-2.5 py-1.5 text-xs outline-none focus:border-brand" data-testid="venue-google-input" />
          {previewing && <p className="text-[11px] text-muted" data-testid="venue-google-detecting">Checking that link…</p>}
          {!previewing && detected && (
            <p className="rounded-md bg-white px-2 py-1 text-[11px] text-ink-soft" data-testid="venue-google-detected">
              📍 We found: <strong className="text-ink">{detected}</strong> — is this your venue? If not, paste your venue’s own listing link.
            </p>
          )}
          <label className="flex items-start gap-1.5 text-[11px] text-ink-soft"><input type="checkbox" checked={perm} onChange={(e) => setPerm(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-brand" /><span>I have permission to reference this venue’s public Google listing.</span></label>
          {err && (
            <div className="rounded-md bg-red-50 px-2 py-1.5" data-testid="venue-google-error">
              <p className="text-[11px] font-bold text-red-600">{err}</p>
              {detected && <p className="mt-0.5 text-[11px] text-red-700/80">We detected <strong>{detected}</strong> from your link.</p>}
              <button type="button" onClick={connect} disabled={busy} className="mt-1 rounded-md border border-red-300 bg-white px-2 py-0.5 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" data-testid="venue-google-retry">{busy ? 'Trying…' : 'Try again'}</button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setErr(null); setDetected(''); }} className="rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink-soft">Cancel</button>
            <button type="button" onClick={connect} disabled={busy} className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50" data-testid="venue-google-connect">{busy ? 'Connecting…' : 'Connect'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
