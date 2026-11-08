import type { Metadata } from 'next';
import Link from 'next/link';
import { getOwnedVenue, venueAccess } from '@/lib/server/venue-ownership';
import NotEligible from '@/components/app/venue/VenueNotEligible';
import { venuePath } from '@/lib/venue-url';
import { prettyType } from '@/lib/venue-fields';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Public listing preview', robots: { index: false, follow: false } };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const BEST_FOR_COPY: Record<string, string> = {
  retreats: 'Residential yoga retreats hosted by NOSTOPS teachers.', workshops: 'Day workshops and short intensives.',
  teacher_training: 'Multi-day teacher training programmes.', yoga_camps: 'Group yoga camps and community gatherings.',
  wellness_programmes: 'Wellbeing and wellness programmes.', corporate_offsites: 'Organisation offsites and group programmes.',
};

// Owner-only preview of the PUBLISHED Global Venue listing (pending changes are not shown until approved).
export default async function OwnedVenuePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await venueAccess()).eligible) return <NotEligible />;
  const v = await getOwnedVenue(id);
  if (!v) {
    return (
      <div className="mx-auto max-w-2xl" data-testid="owned-venue-unavailable">
        <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Venue Studio</Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">You can’t preview this venue</h1>
        <p className="mt-2 text-sm text-ink-soft">Only the approved owner of a venue can open its listing preview.</p>
      </div>
    );
  }
  const isLive = v.status === 'published' || v.status === 'approved';
  const path = venuePath({ id: v.id, name: v.name || '', city: v.city });
  const photos = v.photos || [];
  const loc = [v.city, v.state, v.country].filter(Boolean).join(', ');
  const months = v.open_months || [];
  const checks: [boolean, string][] = [
    [true, 'Ownership claim approved by NOSTOPS'],
    [isLive, 'Listing details reviewed and published'],
    [photos.length >= 3, `Venue photos (${photos.length}, min. 3 recommended)`],
    [v.verification_status === 'verified', 'NOSTOPS Verified Venue'],
  ];
  return (
    <div className="mx-auto max-w-6xl" data-testid="venue-public-preview">
      <p className="text-sm font-bold text-ink-soft"><Link href="/app/venue" className="text-brand-700 hover:underline">Venue Studio</Link> › <Link href={`/app/venue/owned/${v.id}`} className="text-brand-700 hover:underline">Profile &amp; Settings</Link> › Listing preview</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-black tracking-tight text-brand-700">Public Venue Listing Preview</h1>
          <p className="mt-1 text-ink-soft">This is how your listing appears to yoga teachers, seekers and organisations on Global Venues.</p>
        </div>
        <div className={`rounded-2xl border p-4 ${isLive ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-white'}`} data-testid="preview-status">
          <p className="font-black text-ink">{isLive ? '👁 Live listing (approved) ✅' : `Not live — ${v.status}`}</p>
          <p className="text-sm text-ink-soft">{isLive ? 'Visible on NOSTOPS Global Venues' : 'Not visible to the public yet'}</p>
          {v.pending && <p className="mt-1 text-xs font-semibold text-amber-900" data-testid="preview-pending-note">Changes awaiting review are not shown yet.</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className={`grid gap-2 ${photos.length > 1 ? 'grid-cols-[1fr_110px]' : 'grid-cols-1'}`} data-testid="preview-gallery">
              <div className="relative">
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt={`${v.name} photo`} className="h-full max-h-80 min-h-56 w-full rounded-2xl object-cover" />
                ) : <div className="grid h-full min-h-56 w-full place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-cream text-5xl" aria-hidden>🧘</div>}
                {photos.length > 0 && <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white">1 / {photos.length}</span>}
              </div>
              {photos.length > 1 && <div className="grid gap-2">
                {[1, 2, 3].map((i) => photos[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={photos[i]} alt="" className="h-24 w-full rounded-xl object-cover" />
                ) : <div key={i} className="h-24 rounded-xl bg-cream" aria-hidden />)}
              </div>}
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <h2 className="font-serif text-2xl font-black text-brand-700">{v.name}</h2>
              {loc && <p className="mt-1 font-semibold text-ink">📍 {loc}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {v.venue_type && <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800">{prettyType(v.venue_type)}</span>}
                {(v.best_for || []).slice(0, 3).map((b) => <span key={b} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-800">{b.replace(/_/g, ' ')}</span>)}
              </div>
              {v.description && <p className="mt-3 line-clamp-5 text-sm text-ink-soft">{v.description}</p>}
              <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center text-xs text-ink-soft">
                <div><p className="text-xl">👥</p><p className="font-black text-ink">{v.capacity ?? '—'}</p><p>Max capacity</p></div>
                <div><p className="text-xl">🏛️</p><p className="font-bold text-ink">{prettyType(v.venue_type) || 'Venue'}</p></div>
                <div><p className="text-xl">🗓️</p><p className="font-bold text-ink">{months.length ? (months.length === 12 ? 'Year-round' : `${months.length} months`) : 'Not set'}</p><p>Open</p></div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-line bg-white p-5 shadow-sm" data-testid="preview-usage">
              <h3 className="font-serif text-xl font-black text-brand-700">🤝 Best suited for</h3>
              {(v.best_for || []).length ? (
                <ul className="mt-3 space-y-2">{(v.best_for || []).map((b) => (
                  <li key={b} className="rounded-xl bg-cream/70 p-3"><p className="text-sm font-black capitalize text-orange-800">{b.replace(/_/g, ' ')}</p><p className="text-xs text-ink-soft">{BEST_FOR_COPY[b] || ''}</p></li>
                ))}</ul>
              ) : <p className="mt-2 text-sm text-muted">Not specified yet.</p>}
              <p className="mt-3 text-xs text-muted">{v.open_to_partnerships !== false ? '✅ Open to retreat partnerships with NOSTOPS teachers.' : 'Not currently open to new retreat partnerships.'}</p>
            </section>
            <section className="rounded-2xl border border-line bg-white p-5 shadow-sm" data-testid="preview-amenities">
              <h3 className="font-serif text-xl font-black text-brand-700">Key amenities</h3>
              {(v.amenities || []).length ? (
                <ul className="mt-3 grid grid-cols-2 gap-2">{(v.amenities || []).map((a) => <li key={a} className="rounded-lg border border-line px-3 py-2 text-sm capitalize text-ink-soft">✓ {a}</li>)}</ul>
              ) : <p className="mt-2 text-sm text-muted">No amenities listed yet.</p>}
              <h4 className="mt-4 font-serif text-lg font-black text-brand-700">🗓️ Availability (open months)</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MONTHS.map((m) => <span key={m} className={`rounded-md px-2 py-1 text-xs font-bold capitalize ${months.includes(m) ? 'bg-emerald-600 text-white' : 'bg-cream text-muted'}`}>{m}</span>)}
              </div>
              {v.getting_there?.text && <p className="mt-3 text-sm text-ink-soft"><strong className="text-ink">Getting there:</strong> {v.getting_there.text}</p>}
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm" data-testid="preview-owner">
            <h3 className="font-serif text-xl font-black text-brand-700">👤 Venue owner</h3>
            <p className="mt-2 font-black text-ink">{v.owner_name || v.name}</p>
            <p className="text-sm text-ink-soft">Venue owner · since {fmt(v.owner_claimed_at)}</p>
            <div className="mt-3 rounded-xl bg-amber-50 p-3">
              <p className="font-black text-ink">{v.verification_status === 'verified' ? '🛡️ NOSTOPS Verified Venue' : '✅ Owner approved by NOSTOPS'}</p>
              <p className="text-xs text-ink-soft">Ownership approved on {fmt(v.owner_claimed_at)}</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">{checks.map(([ok, t]) => <li key={t} className={ok ? 'text-ink' : 'text-muted'}>{ok ? '✅' : '⬜'} {t}</li>)}</ul>
          </section>
          <div className="space-y-3" data-testid="preview-actions">
            <Link href="/retreats/host" className="flex min-h-12 items-center justify-center rounded-2xl bg-orange-700 px-4 text-center text-sm font-bold text-white shadow-md hover:bg-orange-800">🗓️ Enquire / plan a retreat here</Link>
            <Link href={`${path}#retreats`} className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-brand-700 bg-white px-4 text-sm font-bold text-brand-700 hover:bg-brand-50">📅 Check availability</Link>
            <Link href="/for-organisations" className="flex min-h-12 flex-col items-center justify-center rounded-2xl border-2 border-brand-700 bg-white px-4 py-2 text-center text-sm font-bold text-brand-700 hover:bg-brand-50">👥 Use for an organisation programme<span className="text-[11px] font-semibold text-muted">via the NOSTOPS event &amp; group booking engine</span></Link>
            <p className="text-center text-xs text-muted">These are the actions visitors see. <Link href={path} className="font-bold text-brand-700 underline" data-testid="preview-open-live">Open the live page</Link></p>
          </div>
          <Link href={`/app/venue/owned/${v.id}`} className="flex min-h-11 items-center justify-center rounded-xl border-2 border-brand-700 bg-white text-sm font-bold text-brand-700" data-testid="preview-back-edit">✎ Back to editing</Link>
        </aside>
      </div>
    </div>
  );
}
