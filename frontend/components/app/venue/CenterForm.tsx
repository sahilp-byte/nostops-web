'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import type { OwnerCenter } from '@/lib/server/venue-owner';
import VenueCapacityPlanner from '@/components/app/venue/VenueCapacityPlanner';
import VenuePhotoUploader from '@/components/app/venue/VenuePhotoUploader';
import { operationalCapacity, type VenueCapacityBreakdown } from '@/lib/venue-capacity';

const label = 'block text-sm font-extrabold text-ink';
const input = 'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const AMENITIES = ['wifi', 'sattvic_meals', 'ac_rooms', 'hot_water', 'yoga_hall', 'garden', 'parking', 'laundry', 'river_access', 'library'];
const ROOM_TYPES = ['single', 'twin_share', 'triple_share', 'dormitory', 'cottage', 'tent'];
const FOOD = ['', 'sattvic', 'vegetarian', 'vegan', 'mixed'];

// Common countries for the datalist — free text is still allowed, so any country
// works. Kept short (yoga/retreat destinations first) rather than an exhaustive list.
const COUNTRIES = [
  'India', 'Nepal', 'Sri Lanka', 'Bhutan', 'Thailand', 'Indonesia', 'Bali (Indonesia)', 'Vietnam',
  'United Arab Emirates', 'United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia',
  'New Zealand', 'Germany', 'France', 'Spain', 'Portugal', 'Italy', 'Greece', 'Netherlands',
  'Switzerland', 'Sweden', 'Costa Rica', 'Mexico', 'Brazil', 'South Africa', 'Kenya', 'Singapore', 'Japan',
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>
      {String(children).replace(/_/g, ' ')}
    </button>
  );
}

export default function CenterForm({ mode, centerId, initial }: { mode: 'create' | 'edit'; centerId?: string; initial?: OwnerCenter | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || '');
  const [city, setCity] = useState(initial?.city || '');
  const [state, setState] = useState(initial?.state || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [pincode, setPincode] = useState(initial?.pincode || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [cap, setCap] = useState<VenueCapacityBreakdown>(initial?.capacity ? { accommodation: initial.capacity } : {});
  const [foodType, setFoodType] = useState(initial?.foodType || '');
  const [amenities, setAmenities] = useState<string[]>(initial?.amenities || []);
  const [amenMore, setAmenMore] = useState('');
  const [roomTypes, setRoomTypes] = useState<string[]>(initial?.roomTypes || []);
  const [feature, setFeature] = useState(initial?.distinguishingFeature || '');
  const [mapsUrl, setMapsUrl] = useState(initial?.websiteOrMapsUrl || '');
  const [photos, setPhotos] = useState<string[]>((initial?.photos || []).filter((p) => p.startsWith('/') || /^https?:\/\//.test(p)));
  const [openPartner, setOpenPartner] = useState(initial?.openToPartnerships ?? true);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const DRAFT_KEY = 'nostops:venue-draft-v1';

  // Draft autosave (create only): restore on mount, persist as you type, clear on submit.
  useEffect(() => {
    if (mode !== 'create') return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.name) setName(d.name);
      if (d.city) setCity(d.city);
      if (d.state) setState(d.state);
      if (d.address) setAddress(d.address);
      if (d.pincode) setPincode(d.pincode);
      if (d.country) setCountry(d.country);
      if (d.cap && typeof d.cap === 'object') setCap(d.cap);
      if (d.foodType) setFoodType(d.foodType);
      if (Array.isArray(d.amenities)) setAmenities(d.amenities);
      if (d.amenMore) setAmenMore(d.amenMore);
      if (Array.isArray(d.roomTypes)) setRoomTypes(d.roomTypes);
      if (d.feature) setFeature(d.feature);
      if (d.mapsUrl) setMapsUrl(d.mapsUrl);
      if (Array.isArray(d.photos)) setPhotos(d.photos);
      if (typeof d.openPartner === 'boolean') setOpenPartner(d.openPartner);
      if (d.name || d.city || d.feature) setRestored(true);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'create') return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, city, state, address, pincode, country, cap, foodType, amenities, amenMore, roomTypes, feature, mapsUrl, photos, openPartner }));
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [mode, name, city, state, address, pincode, country, cap, foodType, amenities, amenMore, roomTypes, feature, mapsUrl, photos, openPartner]);

  const capNum = operationalCapacity(cap);
  const valid = name.trim().length >= 3 && city.trim().length >= 2 && capNum >= 1 && capNum <= 500;
  const csv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    setErr(null);
    if (!valid) { setErr('Please complete the venue name, city and a valid capacity.'); return; }
    setBusy(true);
    const payload = {
      name: name.trim(), city: city.trim(), state: state.trim(), address: address.trim(), pincode: pincode.trim(), country: country.trim(),
      capacity: capNum, food_type: foodType, distinguishing_feature: feature.trim(),
      amenities: Array.from(new Set([...amenities, ...csv(amenMore)])), room_types: roomTypes,
      website_or_maps_url: mapsUrl.trim(), photos,
      open_to_partnerships: openPartner, ...(mode === 'edit' ? { is_active: isActive } : {}),
    };
    const r = mode === 'edit' && centerId
      ? await sendBff(`/bff/venue/centers/${centerId}`, 'PATCH', payload)
      : await sendBff('/bff/venue/centers', 'POST', payload);
    if (!r.ok) { setBusy(false); setErr(r.data?.error || 'Could not save the venue.'); return; }
    setBusy(false);
    if (mode === 'edit') {
      router.push('/app/venue');
      router.refresh();
      return;
    }
    // Created: clear the draft and land on the new venue's page with an "add photos" nudge.
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    const newId = (r.data as any)?.data?.center_id;
    router.push(newId ? `/app/venue/centers/${encodeURIComponent(newId)}/edit?created=1` : '/app/venue');
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5" data-testid="center-form">
      {restored && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-50/50 px-3.5 py-2.5" data-testid="draft-restored">
          <span className="text-xs font-semibold text-brand-700">✓ We restored your unsaved venue draft.</span>
          <button type="button" onClick={() => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ } setName(''); setCity(''); setState(''); setAddress(''); setPincode(''); setCountry(''); setCap({}); setFoodType(''); setAmenities([]); setAmenMore(''); setRoomTypes([]); setFeature(''); setMapsUrl(''); setPhotos([]); setRestored(false); }} className="text-xs font-bold text-muted underline hover:text-ink">Start fresh</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="c-name">Venue name *</label><input id="c-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Ganga Riverside Ashram" data-testid="center-name" /></div>
        <div><label className={label} htmlFor="c-city">City *</label><input id="c-city" className={input} value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="e.g. Rishikesh, Bali, Lisbon" data-testid="center-city" /></div>
        <div>
          <label className={label} htmlFor="c-country">Country</label>
          <input id="c-country" className={input} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} list="c-country-list" placeholder="e.g. India, Indonesia, Portugal" data-testid="center-country" />
          <datalist id="c-country-list">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div><label className={label} htmlFor="c-state">State / Region / Province</label><input id="c-state" className={input} value={state} onChange={(e) => setState(e.target.value)} maxLength={60} placeholder="e.g. Uttarakhand, Bali, Lisboa" data-testid="center-state" /></div>
        <div><label className={label} htmlFor="c-pin">Postal / ZIP code</label><input id="c-pin" className={input} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 12))} inputMode="text" placeholder="e.g. 249201, SW1A 1AA, 80361" data-testid="center-postal" /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="c-addr">Address</label><input id="c-addr" className={input} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Street / area / landmark" /></div>
        <div>
          <label className={label} htmlFor="c-food">Food type</label>
          <select id="c-food" className={input} value={foodType} onChange={(e) => setFoodType(e.target.value)}>
            {FOOD.map((f) => <option key={f} value={f}>{f ? f[0].toUpperCase() + f.slice(1) : 'Not specified'}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-cream/40 p-3.5">
        <p className={label}>Operational capacity *</p>
        <p className="mt-0.5 mb-2 text-xs text-ink-soft">Your venue&apos;s own limits — separate from any teacher&apos;s cohort size. A retreat here can&apos;t take bookings beyond this unless an authorised host overrides it.</p>
        <VenueCapacityPlanner value={cap} onChange={setCap} />
      </div>

      <div>
        <p className={label}>Amenities & Yoga facilities</p>
        <div className="mt-2 flex flex-wrap gap-2">{AMENITIES.map((a) => <Chip key={a} active={amenities.includes(a)} onClick={() => toggle(amenities, setAmenities, a)}>{a}</Chip>)}</div>
        <input className={`${input} mt-2`} value={amenMore} onChange={(e) => setAmenMore(e.target.value)} placeholder="Add more, comma separated (e.g. Meditation cave, Ayurveda)" />
      </div>
      <div>
        <p className={label}>Room types</p>
        <div className="mt-2 flex flex-wrap gap-2">{ROOM_TYPES.map((r) => <Chip key={r} active={roomTypes.includes(r)} onClick={() => toggle(roomTypes, setRoomTypes, r)}>{r}</Chip>)}</div>
      </div>
      <div>
        <label className={label} htmlFor="c-feat">What makes this place special</label>
        <textarea id="c-feat" className={`${input} min-h-[90px] resize-y`} value={feature} onChange={(e) => setFeature(e.target.value)} maxLength={500} placeholder="The silence at dawn on the river, the old satsang hall, the kitchen…" />
      </div>

      <div>
        <label className={label} htmlFor="c-maps">Google listing or website link</label>
        <input id="c-maps" className={input} value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} maxLength={400} inputMode="url" placeholder="https://maps.app.goo.gl/…  or  https://your-venue.com" data-testid="center-maps-url" />
        <p className="mt-1.5 text-xs text-ink-soft">Paste your Google Maps or Google Business link so NOSTOPS can show your ratings, reviews &amp; photos.{mode === 'create' ? ' You can also connect Google after saving.' : ''}</p>
      </div>

      {mode === 'create' && (
        <div className="rounded-xl border border-line bg-cream/40 p-3.5">
          <VenuePhotoUploader initial={photos} onChange={setPhotos} />
        </div>
      )}

      <label className="flex items-start gap-2.5" htmlFor="c-open">
        <input id="c-open" type="checkbox" checked={openPartner} onChange={(e) => setOpenPartner(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="center-open" />
        <span><span className="text-sm font-extrabold text-ink">Open to teacher partnerships</span><span className="mt-0.5 block text-xs text-ink-soft">Let verified teachers discover this venue and propose co-hosting retreats.</span></span>
      </label>
      {mode === 'edit' && (
        <label className="flex items-start gap-2.5" htmlFor="c-active">
          <input id="c-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
          <span><span className="text-sm font-extrabold text-ink">Venue is active</span><span className="mt-0.5 block text-xs text-ink-soft">Uncheck to hide this venue from discovery without deleting it.</span></span>
        </label>
      )}

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/app/venue')} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
        <button type="button" onClick={save} disabled={busy || !valid} className="flex-1 rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="center-save">{busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create venue'}</button>
      </div>
    </div>
  );
}
