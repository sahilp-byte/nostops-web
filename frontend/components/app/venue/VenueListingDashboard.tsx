'use client';

import { useState } from 'react';
import Link from 'next/link';
import { venuePath } from '@/lib/venue-url';
import { prettyType } from '@/lib/venue-fields';
import { fieldLabels } from '@/lib/venue-fields';
import type { OwnedVenue, ClaimItem } from '@/lib/server/venue-ownership';

// "My Venues — Listing Management": every Global Venue this account owns, plus its open claims.
type Filter = 'all' | 'live' | 'review' | 'inactive';
const LIVE = new Set(['published', 'approved']);
const OPEN = new Set(['submitted', 'verification_pending', 'under_review', 'disputed']);
const CLAIM_LABEL: Record<string, string> = {
  submitted: 'Claim submitted', verification_pending: 'Claim — verification pending', under_review: 'Claim under review',
  disputed: 'Claim disputed — admin will resolve', rejected: 'Claim not approved',
};
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const months = (m?: string[]) => (m && m.length ? (m.length === 12 ? 'Year-round' : m.map((x) => x[0].toUpperCase() + x.slice(1)).join(' · ')) : 'Not set');

function Stat({ icon, n, label, tone }: { icon: string; n: number; label: string; tone: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-line p-4 ${tone}`}>
      <span aria-hidden className="text-3xl">{icon}</span>
      <div><p className="text-2xl font-black leading-none text-ink">{n}</p><p className="mt-1 text-sm text-ink-soft">{label}</p></div>
    </div>
  );
}

function Pill({ tone, children }: { tone: 'live' | 'review' | 'off'; children: React.ReactNode }) {
  const cls = tone === 'live' ? 'bg-emerald-100 text-emerald-800' : tone === 'review' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700';
  const dot = tone === 'live' ? 'bg-emerald-600' : tone === 'review' ? 'bg-amber-500' : 'bg-slate-500';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cls}`}><span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />{children}</span>;
}

const btnOutline = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-brand-700 bg-white px-3.5 text-xs font-bold text-brand-700 hover:bg-brand-50';

export default function VenueListingDashboard({ owned, claims }: { owned: OwnedVenue[]; claims: ClaimItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const shownClaims = claims.filter((c) => c.status !== 'approved' && !owned.some((v) => v.id === c.venue_id));
  const openClaims = shownClaims.filter((c) => OPEN.has(c.status));
  const kind = (v: OwnedVenue): Filter => (LIVE.has(v.status || '') ? 'live' : 'inactive');
  const live = owned.filter((v) => kind(v) === 'live').length;
  const pending = owned.filter((v) => v.pending).length;
  const inactive = owned.length - live + shownClaims.filter((c) => !OPEN.has(c.status)).length;
  const reviewCount = pending + openClaims.length;
  const showVenue = (v: OwnedVenue) => filter === 'all' || (filter === 'review' ? !!v.pending : kind(v) === filter);
  const showClaim = (c: ClaimItem) => filter === 'all' || (filter === 'review' ? OPEN.has(c.status) : filter === 'inactive' && !OPEN.has(c.status));
  const filters: { k: Filter; label: string; n: number }[] = [
    { k: 'all', label: 'All venues', n: owned.length + shownClaims.length },
    { k: 'live', label: '✓ Live', n: live }, { k: 'review', label: '🔍 Under review', n: reviewCount }, { k: 'inactive', label: '⏸ Inactive', n: inactive },
  ];
  const visible = owned.filter(showVenue).length + shownClaims.filter(showClaim).length;

  return (
    <section className="mx-auto mb-10 max-w-5xl" data-testid="owned-venues-panel">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line bg-gradient-to-r from-cream via-white to-emerald-50/60 p-5 sm:p-6">
        <div>
          <p className="text-sm font-bold text-brand-700">Venue Studio › My Venues</p>
          <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-brand-700">My Venues — Listing Management</h1>
          <p className="mt-1 text-ink-soft">View, manage and update your Global Venue listings on NOSTOPS.</p>
        </div>
        <Link href="/app/spaces" className="inline-flex min-h-[40px] items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 ring-1 ring-line hover:bg-brand-50" data-testid="venue-to-my-spaces">NOSTOPS Spaces (India) — My Spaces →</Link>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="venue-summary">
        <Stat icon="🏛️" n={owned.length} label="Total venues" tone="bg-white" />
        <Stat icon="✅" n={live} label="Live listings" tone="bg-emerald-50/60" />
        <Stat icon="🔍" n={reviewCount} label="Under review" tone="bg-amber-50/60" />
        <Stat icon="⏸️" n={inactive} label="Inactive" tone="bg-slate-50" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button key={f.k} type="button" onClick={() => setFilter(f.k)} aria-pressed={filter === f.k}
            className={`min-h-11 rounded-full border px-4 text-sm font-bold ${filter === f.k ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`} data-testid={`venue-filter-${f.k}`}>
            {f.label} ({f.n})
          </button>
        ))}
        <div className="relative ml-auto">
          <button type="button" onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen} className="min-h-11 rounded-full bg-orange-700 px-5 text-sm font-bold text-white shadow-md hover:bg-orange-800" data-testid="add-another-venue">+ Add another venue</button>
          {addOpen && (
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl" data-testid="add-venue-menu">
              <Link href="/venues/submit" className="block rounded-xl p-3 hover:bg-cream" data-testid="add-venue-new">
                <p className="text-sm font-black text-ink">List a new venue</p><p className="text-xs text-muted">Your venue isn’t on NOSTOPS yet — submit it for review.</p>
              </Link>
              <Link href="/venues" className="block rounded-xl p-3 hover:bg-cream" data-testid="add-venue-claim">
                <p className="text-sm font-black text-ink">Claim an existing venue</p><p className="text-xs text-muted">Find it on Global Venues and tap “Claim this venue”.</p>
              </Link>
            </div>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {owned.filter(showVenue).map((v) => {
          const isLive = kind(v) === 'live';
          return (
            <li key={v.id} className="card grid gap-4 p-4 md:grid-cols-[136px_1fr_190px_190px_auto] md:items-center" data-testid={`owned-venue-${v.id}`}>
              {v.photos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.photos[0]} alt="" className="h-24 w-full rounded-xl object-cover md:w-34" />
              ) : <div className="grid h-24 w-full place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-cream text-3xl" aria-hidden>🧘</div>}
              <div className="min-w-0">
                <p className="font-serif text-lg font-black text-brand-700">{v.name}</p>
                <p className="text-sm text-ink-soft">📍 {[v.city, v.state, v.country].filter(Boolean).join(', ')}</p>
                {v.venue_type && <span className="mt-1.5 inline-block rounded-full bg-orange-50 px-3 py-0.5 text-xs font-bold text-orange-800">{prettyType(v.venue_type)}</span>}
              </div>
              <div className="space-y-1 text-xs text-ink-soft md:border-l md:border-line md:pl-4">
                {isLive ? <Pill tone="live">Live</Pill> : <Pill tone="off">{v.status || 'Inactive'}</Pill>}
                <p>Owner since {fmt(v.owner_claimed_at)}</p>
                {v.pending && <p className="font-semibold text-amber-900" data-testid="owned-venue-pending">Awaiting review: {fieldLabels(v.pending.changed)}</p>}
              </div>
              <dl className="space-y-1 text-xs text-ink-soft">
                <div><dt className="inline font-bold text-ink">👥 Capacity: </dt><dd className="inline">{v.capacity ?? '—'}</dd></div>
                <div><dt className="inline font-bold text-ink">🗓️ Open: </dt><dd className="inline">{months(v.open_months)}</dd></div>
                <div><dt className="inline font-bold text-ink">📷 Photos: </dt><dd className="inline">{v.photos?.length || 0}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2 md:flex-col">
                <Link href={venuePath({ id: v.id, name: v.name || '', city: v.city })} className={btnOutline} data-testid="owned-venue-view">👁 View listing</Link>
                <Link href={`/app/venue/owned/${v.id}`} className={btnOutline} data-testid="owned-venue-edit">✎ Edit</Link>
              </div>
            </li>
          );
        })}
        {shownClaims.filter(showClaim).map((c) => (
          <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4" data-testid={`my-claim-${c.id}`}>
            <div>
              <p className="font-serif text-lg font-black text-brand-700">{c.venue_name}</p>
              <p className="text-sm text-ink-soft">📍 {c.venue_city || '—'} · Claimed {fmt(c.created_at)}</p>
            </div>
            <div className="text-xs text-ink-soft">
              <Pill tone={OPEN.has(c.status) ? 'review' : 'off'}>{CLAIM_LABEL[c.status] || c.status}</Pill>
              <p className="mt-1">{OPEN.has(c.status) ? 'We’ll email you once an admin decides.' : c.decision_note || ''}</p>
            </div>
          </li>
        ))}
        {visible === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-cream/50 p-6 text-center text-sm text-ink-soft" data-testid="venues-empty">
            {owned.length + shownClaims.length === 0
              ? <>Own or manage a listed venue? Open its page on <Link href="/venues" className="font-bold text-brand-700 underline">Global Venues</Link> and tap “Claim this venue”, or <Link href="/venues/submit" className="font-bold text-brand-700 underline">list a new venue</Link>.</>
              : 'No venues match this filter.'}
          </li>
        )}
      </ul>

      <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:grid-cols-[200px_1fr] sm:items-center" data-testid="venue-tips">
        <p className="font-serif text-xl font-black text-brand-700">💡 Tips for a successful listing</p>
        <ul className="space-y-1.5 text-sm text-ink-soft sm:border-l sm:border-line sm:pl-5">
          <li>✅ Provide clear, well-lit photographs of your venue.</li>
          <li>✅ Keep your open months up to date so teachers can plan retreats.</li>
          <li>✅ Make sure your facilities, capacity and getting-there details are complete and accurate.</li>
        </ul>
      </div>
    </section>
  );
}
