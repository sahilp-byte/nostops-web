'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import type { RetreatDetail, EditLock } from '@/lib/server/retreat-host';
import CoverPhotoPicker from '@/components/app/teacher/CoverPhotoPicker';
import VenuePicker, { VenueCapacityNote, type EligibleVenue } from '@/components/app/teacher/VenuePicker';
import { interpretRetreatSave } from '@/lib/retreat-save';

const label = 'block text-sm font-extrabold text-ink';
const input =
  'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-cream disabled:text-muted';

export default function EditRetreatForm({ retreat, editLock, eligibleVenues = [] }: { retreat: RetreatDetail; editLock: EditLock; eligibleVenues?: EligibleVenue[] }) {
  const router = useRouter();
  const locked = editLock.locked;
  const [title, setTitle] = useState(retreat.title);
  const [description, setDescription] = useState(retreat.description);
  const [venuePartnerId, setVenuePartnerId] = useState(retreat.venuePartnerId || '');
  const [venueName, setVenueName] = useState(retreat.venueName);
  const [venueCity, setVenueCity] = useState(retreat.venueCity);
  const [state, setState] = useState(retreat.state);
  const [cover, setCover] = useState(retreat.coverImage || '');
  const [seats, setSeats] = useState(String(retreat.seatsTotal));
  const [price, setPrice] = useState(String(retreat.priceInr));
  const [inclusions, setInclusions] = useState(retreat.inclusions.join(', '));
  const [audience, setAudience] = useState(retreat.audienceTags.join(', '));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const seatsNum = parseInt(seats, 10) || 0;
  const priceNum = parseInt(price, 10) || 0;

  // Venue binding (LOAD + PRESELECT only in this step — PATCH payload unchanged).
  // A saved id that no longer resolves to an eligible venue is flagged, never
  // silently substituted. Selecting another venue is user-initiated.
  const venueResolved = eligibleVenues.find((v) => v.id === venuePartnerId) || null;
  const venueIneligible = venuePartnerId !== '' && !venueResolved;
  // A bound venue supplies name / city / state (read-only) and caps the seats.
  const vName = venueResolved ? venueResolved.name : venueName;
  const vCity = venueResolved ? venueResolved.city || venueCity : venueCity;
  const vState = venueResolved ? venueResolved.state || state : state;
  const seatsOverVenue = venueResolved?.capacity != null && seatsNum > venueResolved.capacity;
  function onSelectVenue(v: EligibleVenue) {
    setVenuePartnerId(v.id);
    setVenueName(v.name);
    setVenueCity(v.city || '');
    setState(v.state || '');
  }

  const valid =
    title.trim().length >= 6 &&
    description.trim().length >= 40 &&
    vName.trim().length >= 3 &&
    vCity.trim().length >= 2 &&
    seatsNum >= 4 && seatsNum <= 200 && !seatsOverVenue &&
    priceNum >= 500 &&
    !venueIneligible;  // a set-but-ineligible binding must be re-selected before saving

  async function save() {
    setMsg(null);
    if (!valid) {
      setMsg({ text: venueIneligible ? 'Select an eligible listed venue before saving.' : seatsOverVenue ? `This venue holds up to ${venueResolved?.capacity} guests — reduce the seats.` : 'Please complete all fields correctly.', ok: false });
      return;
    }
    setBusy(true);
    const r = await sendBff(`/bff/teacher/retreats/${retreat.id}`, 'PATCH', {
      title: title.trim(),
      description: description.trim(),
      venue_name: vName.trim(),
      venue_city: vCity.trim(),
      state: vState.trim(),
      // Send the binding only when set; omitting it preserves the existing
      // venue (partial-update semantics). Never send an empty value.
      ...(venuePartnerId ? { venue_partner_id: venuePartnerId } : {}),
      cover_image: cover.trim(),
      seats_total: seatsNum,
      price_per_seat_inr: priceNum,
      inclusions: inclusions.split(',').map((s) => s.trim()).filter(Boolean),
      audience_tags: audience.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setBusy(false);
    // Interpret the result with a pure, test-covered helper so a backend failure
    // (or a mismatched venue echo) can never surface as a false success.
    const outcome = interpretRetreatSave(r, venuePartnerId);
    setMsg({ text: outcome.text, ok: outcome.ok });
    if (r.ok) router.refresh();  // re-fetch so the saved binding is reloaded
  }

  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-2xl border p-4" style={{ borderColor: '#F59E0B55', backgroundColor: '#F59E0B0F' }}>
          <p className="text-sm font-extrabold" style={{ color: '#B45309' }}>🔒 Editing locked</p>
          <p className="mt-1 text-sm text-ink-soft">
            {editLock.paidCount > 0
              ? `${editLock.paidCount} ${editLock.paidCount === 1 ? 'seat is' : 'seats are'} paid, so retreat details are frozen to protect confirmed guests.`
              : editLock.reason || 'This retreat can no longer be edited.'}
          </p>
        </div>
      )}

      <div>
        <label className={label} htmlFor="e-title">Title</label>
        <input id="e-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} disabled={locked} data-testid="edit-title" />
      </div>
      <div>
        <label className={label} htmlFor="e-desc">Description</label>
        <textarea id="e-desc" className={`${input} min-h-[110px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={locked} data-testid="edit-desc" />
      </div>
      <div>
        <label className={label}>Cover photo</label>
        {locked ? (
          cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="Retreat cover" className="mt-1.5 aspect-[16/9] w-full rounded-2xl border border-line object-cover" />
          ) : (
            <p className="mt-1.5 text-sm text-muted">No cover photo.</p>
          )
        ) : (
          <div className="mt-1.5"><CoverPhotoPicker value={cover} onChange={setCover} /></div>
        )}
      </div>
      <VenuePicker venues={eligibleVenues} selectedId={venuePartnerId} onSelect={onSelectVenue} disabled={locked} ineligible={venueIneligible} />
      {!locked && <VenueCapacityNote venue={venueResolved} seats={seatsNum} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><label className={label} htmlFor="e-venue">Venue</label><input id="e-venue" className={input} value={vName} onChange={(e) => setVenueName(e.target.value)} disabled={locked || !!venueResolved} data-testid="edit-venue-name" /></div>
        <div><label className={label} htmlFor="e-city">City</label><input id="e-city" className={input} value={vCity} onChange={(e) => setVenueCity(e.target.value)} disabled={locked || (!!venueResolved && !!venueResolved.city)} data-testid="edit-venue-city" /></div>
        <div><label className={label} htmlFor="e-state">State</label><input id="e-state" className={input} value={vState} onChange={(e) => setState(e.target.value)} disabled={locked || (!!venueResolved && !!venueResolved.state)} /></div>
      </div>
      {venueResolved && !locked && <p className="-mt-2 text-xs text-muted">Venue name, city and state come from the venue listing.</p>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="e-seats">Seats</label><input id="e-seats" inputMode="numeric" className={input} value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, '').slice(0, 3))} disabled={locked} data-testid="edit-seats" /></div>
        <div><label className={label} htmlFor="e-price">Price / seat (₹)</label><input id="e-price" inputMode="numeric" className={input} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={locked} data-testid="edit-price" /></div>
      </div>
      <div><label className={label} htmlFor="e-inc">Inclusions <span className="font-normal text-muted">· comma separated</span></label><input id="e-inc" className={input} value={inclusions} onChange={(e) => setInclusions(e.target.value)} disabled={locked} /></div>
      <div><label className={label} htmlFor="e-aud">Audience <span className="font-normal text-muted">· comma separated</span></label><input id="e-aud" className={input} value={audience} onChange={(e) => setAudience(e.target.value)} disabled={locked} /></div>

      {msg && <p className="rounded-lg px-3 py-2 text-sm font-bold" style={{ backgroundColor: msg.ok ? '#0D948812' : '#EF444412', color: msg.ok ? '#0F766E' : '#B91C1C' }}>{msg.text}</p>}

      {!locked && (
        <button type="button" onClick={save} disabled={busy || !valid} className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="edit-save">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </div>
  );
}
