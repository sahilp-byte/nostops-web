'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

const label = 'block text-sm font-extrabold text-ink';
const input = 'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const THEMES = [
  { v: 'general', label: 'General Hatha / Vinyasa' },
  { v: 'lineage', label: 'Lineage / Parampara' },
  { v: 'pranayama', label: 'Pranayama & breath' },
  { v: 'stress', label: 'Stress & renewal' },
  { v: 'leadership', label: 'Leadership' },
  { v: 'faculty', label: 'Faculty immersion' },
  { v: 'founders', label: 'Founders reset' },
];

export type ListingPrefill = { title?: string; theme?: string; seats?: string; price?: string; inclusions?: string };

export default function ListingForm({ centers, initialCenterId, prefill }: { centers: { id: string; name: string; city?: string; capacity?: number }[]; initialCenterId?: string; prefill?: ListingPrefill }) {
  const router = useRouter();
  const [centerId, setCenterId] = useState((initialCenterId && centers.some((c) => c.id === initialCenterId) ? initialCenterId : centers[0]?.id) || '');
  const [title, setTitle] = useState(prefill?.title || '');
  const [theme, setTheme] = useState(prefill?.theme || 'general');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [seats, setSeats] = useState(prefill?.seats || '');
  const [price, setPrice] = useState(prefill?.price || '');
  const [inclusions, setInclusions] = useState(prefill?.inclusions || '');
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const duplicating = !!prefill;

  const DRAFT_KEY = 'nostops:retreat-draft-v1';

  // Draft autosave: restore on mount, persist as you type, clear on submit.
  // When duplicating a past retreat, the prefill wins — never restore an old draft.
  useEffect(() => {
    if (duplicating) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.title) setTitle(d.title);
      if (d.theme) setTheme(d.theme);
      if (d.startsOn) setStartsOn(d.startsOn);
      if (d.endsOn) setEndsOn(d.endsOn);
      if (d.seats) setSeats(d.seats);
      if (d.price) setPrice(d.price);
      if (d.inclusions) setInclusions(d.inclusions);
      // A venue picked via "Host a retreat" (query) always wins over the draft.
      if (!initialCenterId && d.centerId && centers.some((c) => c.id === d.centerId)) setCenterId(d.centerId);
      if (d.title || d.seats || d.price) setRestored(true);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ centerId, title, theme, startsOn, endsOn, seats, price, inclusions }));
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [centerId, title, theme, startsOn, endsOn, seats, price, inclusions]);

  const seatsNum = parseInt(seats, 10) || 0;
  const priceNum = parseInt(price, 10) || 0;
  const venueCap = centers.find((c) => c.id === centerId)?.capacity || 0;
  const overCapacity = venueCap > 0 && seatsNum > venueCap;
  const capacityOk = !overCapacity || override;
  const valid = !!centerId && title.trim().length >= 6 && /^\d{4}-\d{2}-\d{2}/.test(startsOn) && /^\d{4}-\d{2}-\d{2}/.test(endsOn) && endsOn >= startsOn && seatsNum >= 1 && priceNum >= 500 && capacityOk;

  async function save() {
    setErr(null);
    if (!valid) { setErr('Please complete the venue, title, dates, seats and price.'); return; }
    setBusy(true);
    const r = await sendBff('/bff/venue/listings', 'POST', {
      center_id: centerId, title: title.trim(), theme, starts_on: startsOn, ends_on: endsOn,
      seats_total: seatsNum, price_per_seat_inr: priceNum,
      inclusions: inclusions.split(',').map((x) => x.trim()).filter(Boolean),
    });
    if (!r.ok) { setBusy(false); setErr(r.data?.error || 'Could not create the listing.'); return; }
    setBusy(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    router.push('/app/venue');
    router.refresh();
  }

  if (centers.length === 0) {
    return <div className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft">Add a venue first, then you can host a listing here.</div>;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5" data-testid="listing-form">
      {duplicating && (
        <div className="rounded-xl border border-brand/20 bg-brand-50/60 px-3.5 py-2.5" data-testid="retreat-duplicating">
          <span className="text-xs font-semibold text-brand-700">✨ Relaunching a past retreat — we&apos;ve carried over the details. Just pick this season&apos;s dates and publish.</span>
        </div>
      )}
      {restored && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-50/50 px-3.5 py-2.5" data-testid="retreat-draft-restored">
          <span className="text-xs font-semibold text-brand-700">✓ We restored your unsaved retreat draft.</span>
          <button type="button" onClick={() => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ } setTitle(''); setTheme('general'); setStartsOn(''); setEndsOn(''); setSeats(''); setPrice(''); setInclusions(''); setRestored(false); }} className="text-xs font-bold text-muted underline hover:text-ink">Start fresh</button>
        </div>
      )}
      <div>
        <label className={label} htmlFor="l-center">Host at venue *</label>
        <select id="l-center" className={input} value={centerId} onChange={(e) => setCenterId(e.target.value)} data-testid="listing-center">
          {centers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="l-title">Retreat title *</label>
        <input id="l-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="7-day Ganga Silence Immersion" data-testid="listing-title" />
      </div>
      <div>
        <label className={label} htmlFor="l-theme">Focus</label>
        <select id="l-theme" className={input} value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="l-start">Start date *</label><input id="l-start" type="date" className={input} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} data-testid="listing-start" /></div>
        <div><label className={label} htmlFor="l-end">End date *</label><input id="l-end" type="date" className={input} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} data-testid="listing-end" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="l-seats">Seats *</label><input id="l-seats" className={input} value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="16" data-testid="listing-seats" /></div>
        <div><label className={label} htmlFor="l-price">Price / seat (₹) *</label><input id="l-price" className={input} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="8000" data-testid="listing-price" /></div>
      </div>
      {venueCap > 0 && (
        <div className="rounded-xl border border-line bg-cream/40 px-3.5 py-2.5" data-testid="listing-capacity-note">
          <p className="text-xs text-ink-soft">Venue operational capacity: <span className="font-extrabold text-ink">{venueCap} guests</span>{seatsNum > 0 ? ` · this cohort: ${seatsNum}` : ''}.</p>
          {overCapacity && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-red-600" data-testid="listing-over-capacity">This retreat&apos;s {seatsNum} seats exceed the venue&apos;s operational capacity of {venueCap}.</p>
              <label className="mt-1.5 flex items-start gap-2 text-xs text-ink-soft" htmlFor="l-override">
                <input id="l-override" type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="listing-override" />
                <span>I&apos;m authorised to host beyond this venue&apos;s stated capacity for this retreat.</span>
              </label>
            </div>
          )}
        </div>
      )}
      <div><label className={label} htmlFor="l-incl">What&apos;s included</label><input id="l-incl" className={input} value={inclusions} onChange={(e) => setInclusions(e.target.value)} placeholder="Comma separated (e.g. Daily yoga, Sattvic meals, Accommodation)" /></div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/app/venue')} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
        <button type="button" onClick={save} disabled={busy || !valid} className="flex-1 rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="listing-save">{busy ? 'Publishing…' : 'Publish listing'}</button>
      </div>
    </div>
  );
}
