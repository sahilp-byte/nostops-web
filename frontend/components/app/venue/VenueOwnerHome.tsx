import Link from 'next/link';
import { inr, titleCase } from '@/lib/format';
import { fmtRange } from '@/lib/server/retreats';
import type { VenueOwnerState, Partnership, OwnerListing } from '@/lib/server/venue-owner';
import VenueGoogleConnect from '@/components/app/venue/VenueGoogleConnect';
import InvitePartner from '@/components/app/venue/InvitePartner';
import PartnershipActions from '@/components/app/venue/PartnershipActions';

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    countered: 'bg-royal-50 text-royal',
    accepted: 'bg-brand-50 text-brand-700',
    active: 'bg-brand-50 text-brand-700',
    declined: 'bg-red-50 text-red-600',
    cancelled: 'bg-cream text-muted',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${map[status] || 'bg-cream text-ink-soft'}`}>{titleCase(status)}</span>;
}

// Review status of an owner's venue in the NOSTOPS admin verification pipeline.
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    submitted: { label: 'Submitted for review', cls: 'bg-accent/10 text-accent-600' },
    under_review: { label: 'Under review', cls: 'bg-royal-50 text-royal' },
    needs_information: { label: 'Needs information', cls: 'bg-accent/15 text-accent-600' },
    approved: { label: 'Approved', cls: 'bg-brand-50 text-brand-700' },
    published: { label: 'Published', cls: 'bg-brand text-white' },
    hidden: { label: 'Hidden', cls: 'bg-cream text-muted' },
    rejected: { label: 'Not accepted', cls: 'bg-red-50 text-red-600' },
    duplicate: { label: 'Marked duplicate', cls: 'bg-cream text-ink-soft' },
    archived: { label: 'Archived', cls: 'bg-cream text-muted' },
  };
  const m = map[status] || { label: titleCase(status), cls: 'bg-cream text-ink-soft' };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.cls}`} data-testid="venue-review-status">{m.label}</span>;
}


function Economics({ p }: { p: Partnership }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      <span>Model: <span className="font-bold text-ink capitalize">{p.model.replace(/_/g, ' ')}</span></span>
      {typeof p.ownerSharePct === 'number' && <span>Your share: <span className="font-bold text-brand-700">{p.ownerSharePct}%</span></span>}
      {typeof p.platformFeePct === 'number' && <span>Platform: <span className="font-semibold text-muted">{p.platformFeePct}%</span></span>}
      {typeof p.rentalInr === 'number' && p.rentalInr > 0 && <span>Rental: <span className="font-bold text-ink">₹{inr(p.rentalInr)}</span></span>}
      {typeof p.guestFeeInr === 'number' && p.guestFeeInr > 0 && <span>Guest fee: <span className="font-bold text-ink">₹{inr(p.guestFeeInr)}</span></span>}
    </div>
  );
}

// Split a venue's amenities into a dedicated practice-space line vs other services.
const PRACTICE_RE = /(yoga|shala|hall|practice|studio|deck|meditation|dhyana|asana)/i;
function venueServices(roomTypes: string[], amenities: string[]) {
  const practice = amenities.filter((a) => PRACTICE_RE.test(a));
  const other = amenities.filter((a) => !PRACTICE_RE.test(a));
  return { rooms: roomTypes, practice, other };
}
function pretty(x: string) {
  return x.replace(/_/g, ' ');
}

// One retreat hosted at the owner's venue. Shows OCCUPANCY / PARTICIPANTS / the
// owner's indicative payable — never the teacher's profit or negotiated margin.
function ListingCard({ l, platformFeePct, venueCapacity, canDuplicate }: { l: OwnerListing; platformFeePct: number; venueCapacity?: number; canDuplicate?: boolean }) {
  const filled = Math.max(0, l.seatsTotal - l.seatsRemaining);
  const pctFill = l.seatsTotal > 0 ? Math.round((filled / l.seatsTotal) * 100) : 0;
  const payable = Math.round(filled * l.pricePerSeatInr * (1 - platformFeePct / 100));
  const payableFull = Math.round(l.seatsTotal * l.pricePerSeatInr * (1 - platformFeePct / 100));
  return (
    <li className="rounded-2xl border border-line bg-white p-5" data-testid="venue-listing-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-black tracking-tight text-ink">{l.title}</p>
          <p className="text-sm text-muted">{[l.centerName, l.city].filter(Boolean).join(' · ')}{fmtRange(l.startsOn, l.endsOn) ? ` · ${fmtRange(l.startsOn, l.endsOn)}` : ''}</p>
        </div>
        <StatusChip status={l.status} />
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">Occupancy · participants</p>
          <p className="mt-0.5 text-sm font-bold text-ink" data-testid="venue-participant-count">{filled} / {l.seatsTotal} participants <span className="font-semibold text-muted">({pctFill}%)</span></p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-brand" style={{ width: `${pctFill}%` }} /></div>
          {typeof venueCapacity === 'number' && (
            <p className="mt-1 text-[11px] text-muted" data-testid="venue-accommodation-occupancy">Rooms: {filled} of {venueCapacity} guests{l.seatsTotal > venueCapacity ? ' · cohort exceeds venue capacity' : ''}</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">Seat price</p>
          <p className="mt-0.5 text-sm font-bold text-ink">₹{inr(l.pricePerSeatInr)}</p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">Your revenue (indicative)</p>
          <p className="mt-0.5 text-sm font-black text-brand-700">₹{inr(payable)}</p>
          <p className="mt-0.5 text-[11px] text-muted">Full house: ₹{inr(payableFull)}</p>
        </div>
      </div>
      {l.coHostCount > 0 && <p className="mt-2 text-xs text-muted">{l.coHostCount} co-host{l.coHostCount === 1 ? '' : 's'}</p>}
      {canDuplicate && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-xs text-muted">Loved this retreat? Run it again next season.</p>
          <Link href={`/app/venue/listings/new?from=${encodeURIComponent(l.id)}`} className="shrink-0 rounded-lg border border-brand/30 bg-brand-50/60 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50" data-testid="duplicate-retreat">⟳ Duplicate / Relaunch</Link>
        </div>
      )}
    </li>
  );
}

export default function VenueOwnerHome({ state, ownerName }: { state: VenueOwnerState; ownerName: string }) {
  if (!state.canOwnVenues) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-brand-700">Venue Studio</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">List & manage your retreat venue</h1>
        <div className="mt-6 rounded-2xl border border-brand/15 bg-brand-50/50 p-6">
          <h2 className="text-base font-extrabold text-ink">Venue-owner access</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Venue &amp; centre listing is open to empanelled Level 2 (Yoga Pracharak) and Level 3 (Yoga Guru) teachers,
            Council Gurus, and invited venue partners. Once you&apos;re empanelled you can list your venue, agree economics
            with co-hosts, and track every booking here — without ever exposing your negotiated terms to participants.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/venues" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Partner your venue</Link>
            <Link href="/app/teacher/empanelment" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">About empanelment</Link>
          </div>
        </div>
      </div>
    );
  }

  const { centers, listings, outgoing, incoming, payouts, platformFeePct } = state;
  const capById = new Map(centers.map((c) => [c.id, c.capacity]));
  const centersWithListings = new Set(listings.map((l) => l.centerId).filter(Boolean));
  const listingOptions = listings.map((l) => ({ id: l.id, title: l.title }));
  const revNow = listings.reduce((s, l) => s + Math.round(Math.max(0, l.seatsTotal - l.seatsRemaining) * l.pricePerSeatInr * (1 - platformFeePct / 100)), 0);
  const revFull = listings.reduce((s, l) => s + Math.round(l.seatsTotal * l.pricePerSeatInr * (1 - platformFeePct / 100)), 0);
  const seatsFilledAll = listings.reduce((s, l) => s + Math.max(0, l.seatsTotal - l.seatsRemaining), 0);
  const seatsTotalAll = listings.reduce((s, l) => s + l.seatsTotal, 0);
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (l: (typeof listings)[number]) => ['completed', 'cancelled'].includes(l.status) || (!!l.endsOn && l.endsOn < today);
  const upcomingListings = listings.filter((l) => !isPast(l));
  const pastListings = listings.filter(isPast);
  const cancelledCount =
    listings.filter((l) => l.status === 'cancelled').length +
    [...outgoing, ...incoming].filter((p) => ['cancelled', 'declined'].includes(p.status)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8" data-testid="venue-owner-home">
      <header>
        <p className="text-sm font-semibold text-brand-700">Venue Studio</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Welcome, {ownerName}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">Your venues, the retreats they host, the economics you’ve agreed, and what you’re owed — all in one place. Confidential terms stay between you and your teachers.</p>
      </header>

      {/* Venue payable */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-brand-700">Reserved earnings</p>
          <p className="mt-1 text-2xl font-black text-ink">₹{inr(payouts.heldInEscrow)}</p>
          <p className="mt-0.5 text-xs text-muted">Reserved until each retreat completes.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Settlement records</p>
          <p className="mt-1 text-2xl font-black text-ink">₹{inr(payouts.settled)}</p>
          <p className="mt-0.5 text-xs text-muted">{payouts.count} settlement record{payouts.count === 1 ? '' : 's'} to date.</p>
          <p className="mt-0.5 text-xs text-muted">Records only — not a bank-transfer confirmation.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Your platform fee</p>
          <p className="mt-1 text-2xl font-black text-ink">{platformFeePct}%</p>
          <p className="mt-0.5 text-xs text-muted">NOSTOPS keeps this to run secure payments &amp; payouts.</p>
        </div>
      </section>

      {/* My Venues */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight text-ink">My venues</h2>
          <div className="flex items-center gap-3">
            <Link href="/venues/submit" className="hidden text-sm font-bold text-brand-700 hover:underline sm:inline" data-testid="owner-public-submit-link">Suggest a venue →</Link>
            <Link href="/app/venue/centers/new" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="add-venue">+ Add a venue</Link>
          </div>
        </div>
        {centers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-line bg-white p-8 text-center">
            <p className="font-bold text-ink">No venues yet.</p>
            <p className="mt-1 text-ink-soft">Add your first centre to start hosting retreats and partnering with teachers.</p>
          </div>
        ) : (
          <ul className="mt-4 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
            {centers.map((c) => {
              const cover = c.photos?.[0];
              const coverSrc = cover ? ((cover.startsWith('http') || cover.startsWith('/')) ? cover : `/bff/venue/centers/${encodeURIComponent(c.id)}/photo?name=${encodeURIComponent(cover)}&w=800`) : null;
              const hasListing = centersWithListings.has(c.id);
              return (
              <li key={c.id} className="overflow-hidden rounded-2xl border border-line bg-white" data-testid="venue-center-card">
                {coverSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverSrc} alt={`${c.name} venue photo`} className="h-40 w-full object-cover" data-testid="venue-photo-thumb" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-brand-50 to-cream" data-testid="venue-photo-placeholder">
                    <span className="text-xs font-semibold text-muted">Connect Google listing to show photos</span>
                  </div>
                )}
                <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-black tracking-tight text-ink">{c.name}</p>
                    <p className="text-sm text-muted">{[c.city, c.state].filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {c.verified && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white" data-testid="venue-verified-pill">🛡️ NOSTOPS Verified</span>}
                    {c.reviewStatus && <StatusPill status={c.reviewStatus} />}
                    {!c.isActive && <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-muted">Hidden</span>}
                    {c.openToPartnerships && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">Open to partners</span>}
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2" data-testid="venue-services">
                  <div><dt className="font-black uppercase tracking-wide text-muted">Rooms</dt><dd className="capitalize text-ink-soft">{c.roomTypes.length ? c.roomTypes.map(pretty).join(', ') : (typeof c.capacity === 'number' ? `Up to ${c.capacity} guests` : 'On request')}</dd></div>
                  <div><dt className="font-black uppercase tracking-wide text-muted">Meals</dt><dd className="capitalize text-ink-soft">{c.foodType ? pretty(c.foodType) : 'Vegetarian, on request'}</dd></div>
                  <div><dt className="font-black uppercase tracking-wide text-muted">Practice space</dt><dd className="capitalize text-ink-soft">{venueServices(c.roomTypes, c.amenities).practice.map(pretty).join(', ') || 'Dedicated practice space'}</dd></div>
                  <div><dt className="font-black uppercase tracking-wide text-muted">Other services</dt><dd className="capitalize text-ink-soft">{venueServices(c.roomTypes, c.amenities).other.slice(0, 4).map(pretty).join(', ') || '—'}</dd></div>
                </dl>
                {c.reviewStatus === 'needs_information' && (
                  <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3.5" data-testid="venue-needs-info">
                    <p className="text-xs font-black uppercase tracking-wide text-accent-600">ℹ️ Action needed — our team needs a bit more</p>
                    <p className="mt-1 text-sm text-ink-soft">{c.reviewNote ? c.reviewNote : 'Please add more details about your venue so we can complete the review and publish it.'}</p>
                    <Link href={`/app/venue/centers/${c.id}/edit`} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-orange-700 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-orange-800" data-testid="venue-add-info">Add the missing details →</Link>
                  </div>
                )}
                {c.reviewStatus === 'rejected' && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3.5" data-testid="venue-rejected">
                    <p className="text-xs font-black uppercase tracking-wide text-red-600">This venue wasn’t accepted</p>
                    <p className="mt-1 text-sm text-ink-soft">{c.reviewNote ? c.reviewNote : 'Please review the details and update your venue, then it can be re-reviewed.'}</p>
                    <Link href={`/app/venue/centers/${c.id}/edit`} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50">Update venue →</Link>
                  </div>
                )}
                {!hasListing && (
                  <Link href={`/app/venue/listings/new?center=${encodeURIComponent(c.id)}`} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-50/60 px-3.5 py-2.5 transition hover:bg-brand-50" data-testid="host-first-retreat">
                    <span className="text-xs font-bold text-brand-700">✨ No retreats here yet — host your first retreat</span>
                    <span aria-hidden className="text-brand-700">→</span>
                  </Link>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <VenueGoogleConnect centerId={c.id} connected={!!coverSrc} />
                  <div className="flex items-center gap-2">
                    <Link href={`/app/venue/listings/new?center=${encodeURIComponent(c.id)}`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600" data-testid="host-retreat-here">Host a retreat</Link>
                    <Link href={`/app/venue/centers/${c.id}/edit`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="edit-venue">Edit</Link>
                  </div>
                </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* My Listings + occupancy + payable */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight text-ink">Retreats at my venues</h2>
          {centers.length > 0 && <Link href="/app/venue/listings/new" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="add-listing">+ Host a retreat</Link>}
        </div>
        {listings.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="venue-revenue-outlook">
            <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-brand-700">Expected venue revenue</p>
              <p className="mt-1 text-xl font-black text-ink">₹{inr(revNow)}</p>
              <p className="mt-0.5 text-[11px] text-muted">From {seatsFilledAll} participant{seatsFilledAll === 1 ? '' : 's'} booked.</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-muted">Potential at full house</p>
              <p className="mt-1 text-xl font-black text-ink">₹{inr(revFull)}</p>
              <p className="mt-0.5 text-[11px] text-muted">If every seat ({seatsTotalAll}) fills.</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-muted">Participants booked</p>
              <p className="mt-1 text-xl font-black text-ink">{seatsFilledAll} / {seatsTotalAll}</p>
              <p className="mt-0.5 text-[11px] text-muted">Group bookings fill rooms faster.</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4" data-testid="venue-cancellations">
              <p className="text-[11px] font-black uppercase tracking-wide text-muted">Cancellations</p>
              <p className="mt-1 text-xl font-black text-ink">{cancelledCount}</p>
              <p className="mt-0.5 text-[11px] text-muted">Cancelled retreats / proposals.</p>
            </div>
          </div>
        )}
        {listings.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-line bg-white p-8 text-center">
            <p className="font-bold text-ink">No retreats hosted yet.</p>
            <p className="mt-1 text-ink-soft">Host one yourself, or invite a teacher to co-host at your venue.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <div data-testid="venue-upcoming-retreats">
              <p className="text-xs font-black uppercase tracking-wide text-muted">Upcoming retreats</p>
              {upcomingListings.length > 0 ? (
                <ul className="mt-2 space-y-3 p-0">
                  {upcomingListings.map((l) => <ListingCard key={l.id} l={l} platformFeePct={platformFeePct} venueCapacity={capById.get(l.centerId || '')} />)}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl bg-cream/60 px-4 py-3 text-sm text-muted">No upcoming retreats scheduled yet.</p>
              )}
            </div>
            {pastListings.length > 0 && (
              <div data-testid="venue-past-retreats">
                <p className="text-xs font-black uppercase tracking-wide text-muted">Past retreats</p>
                <ul className="mt-2 space-y-3 p-0">
                  {pastListings.map((l) => <ListingCard key={l.id} l={l} platformFeePct={platformFeePct} venueCapacity={capById.get(l.centerId || '')} canDuplicate />)}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="mt-4"><InvitePartner listings={listingOptions} /></div>
      </section>

      {/* Partnerships */}
      {(outgoing.length > 0 || incoming.length > 0) && (
        <section className="space-y-4">
          <h2 className="text-xl font-black tracking-tight text-ink">Partnerships & agreed economics</h2>
          {outgoing.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted">Teachers you invited</p>
              <ul className="mt-2 space-y-3 p-0">
                {outgoing.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-line bg-white p-4" data-testid="partnership-outgoing">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-ink">{p.partnerName || p.partnerEmail}</p>
                        <p className="text-xs text-muted">{p.retreatTitle}{p.centerName ? ` · ${p.centerName}` : ''}</p>
                      </div>
                      <StatusChip status={p.status} />
                    </div>
                    <Economics p={p} />
                    {p.note && <p className="mt-1.5 text-xs italic text-muted">“{p.note}”</p>}
                    <PartnershipActions pid={p.id} side="outgoing" status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {incoming.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted">Proposals you received</p>
              <ul className="mt-2 space-y-3 p-0">
                {incoming.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-line bg-white p-4" data-testid="partnership-incoming">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-ink">{p.centerName || p.retreatTitle}</p>
                        <p className="text-xs text-muted">{p.retreatTitle}</p>
                      </div>
                      <StatusChip status={p.status} />
                    </div>
                    <Economics p={p} />
                    {p.note && <p className="mt-1.5 text-xs italic text-muted">“{p.note}”</p>}
                    <PartnershipActions pid={p.id} side="incoming" status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <p className="rounded-xl bg-cream/60 px-4 py-3 text-xs text-muted">
        🔒 Everything here is private to you and covers only your venues. You never see a teacher’s profit, their negotiated margin, unrelated retreats, or any participant’s personal details — only your own agreed terms and the occupancy that affects your rooms. Seekers only ever see the seat price.
      </p>
    </div>
  );
}
