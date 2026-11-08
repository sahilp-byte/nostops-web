'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fieldLabels } from '@/lib/venue-fields';

// "Review & Submit" — final step before a venue (or an owner's sensitive changes) goes to the
// NOSTOPS review queue. Purely presentational: the caller owns the actual submit.
export type ReviewData = {
  name: string; city?: string; state?: string; country?: string; address?: string; venueType?: string;
  bestFor?: string[]; amenities?: string[]; capacity?: number | null; openMonths?: string[]; photos?: string[];
  description?: string; relationship?: string; website?: string;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DECLS = [
  'I confirm that the information provided is true and accurate.',
  'I am authorised to list this venue on NOSTOPS (as owner or an appointed representative).',
  'terms',
];

function Card({ title, icon, children, testid }: { title: string; icon: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm" data-testid={testid}>
      <h3 className="flex items-center gap-2 font-serif text-lg font-black text-brand-700"><span aria-hidden className="text-xl">{icon}</span>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-line/70 py-1.5 text-sm last:border-0">
      <dt className="font-bold text-brand-700">{k}</dt><dd className="min-w-0 break-words text-ink-soft">{v || '—'}</dd>
    </div>
  );
}

export default function VenueReviewSubmit({ mode, data, changed = [], busy, error, onEdit, onSubmit }: {
  mode: 'new' | 'changes'; data: ReviewData; changed?: string[]; busy?: boolean; error?: string | null;
  onEdit: () => void; onSubmit: () => void;
}) {
  const [ticks, setTicks] = useState([false, false, false]);
  const all = ticks.every(Boolean);
  const loc = [data.city, data.state, data.country].filter(Boolean).join(', ');
  const photos = data.photos || [];
  const steps = ['Location', 'Venue details', 'Facilities & photos', 'Review & Submit'];
  return (
    <div className="space-y-5" data-testid="review-submit">
      <header className="rounded-2xl border border-line bg-gradient-to-r from-cream to-white p-5 sm:p-6">
        <p className="text-sm font-bold text-orange-700">{mode === 'new' ? 'List your venue on NOSTOPS' : 'Send changes for review'}</p>
        <h2 className="mt-1 font-serif text-2xl font-black tracking-tight text-brand-700 sm:text-3xl">Review your details &amp; submit{mode === 'new' ? ' for listing' : ''}</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          {mode === 'new'
            ? 'Please review all the details below. Once submitted, our team will assess your venue and get in touch with you for confirmation.'
            : `These changes need a quick check by our team: ${fieldLabels(changed)}. Your published listing stays exactly as it is until they are approved.`}
        </p>
        {mode === 'new' && (
          <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s} className="flex flex-col items-center text-center">
                <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white ${i < 3 ? 'bg-emerald-600' : 'bg-orange-700'}`} aria-hidden>{i < 3 ? '✓' : i + 1}</span>
                <span className={`mt-1.5 text-[11px] font-bold sm:text-sm ${i === 3 ? 'text-orange-700' : 'text-brand-700'}`}>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Venue to be listed" icon="🏛️" testid="review-venue">
          <div className="flex gap-3">
            {photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[0]} alt="" className="h-24 w-28 shrink-0 rounded-xl object-cover" />
            ) : <div className="grid h-24 w-28 shrink-0 place-items-center rounded-xl bg-cream text-2xl" aria-hidden>🧘</div>}
            <div className="min-w-0">
              <p className="break-words font-serif text-lg font-black leading-tight text-ink">{data.name}</p>
              {loc && <p className="mt-1 text-sm text-ink-soft">📍 {loc}</p>}
              {data.venueType && <span className="mt-2 inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800">{data.venueType}</span>}
            </div>
          </div>
        </Card>
        <Card title="Venue details" icon="📍" testid="review-details">
          <dl>
            <Row k="Address" v={data.address} />
            <Row k="City" v={data.city} />
            <Row k="State / region" v={data.state} />
            <Row k="Country" v={data.country} />
            {data.relationship && <Row k="Ownership" v={data.relationship} />}
            {data.website && <Row k="Website" v={data.website} />}
          </dl>
        </Card>
        <Card title="Best suited for" icon="🧘" testid="review-bestfor">
          {data.bestFor?.length ? (
            <div className="flex flex-wrap gap-2">{data.bestFor.map((b) => <span key={b} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold capitalize text-brand-700">{b.replace(/_/g, ' ')}</span>)}</div>
          ) : <p className="text-sm text-muted">Not specified yet.</p>}
          {data.description && <p className="mt-3 line-clamp-5 text-sm text-ink-soft">{data.description}</p>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Facilities & amenities" icon="✅" testid="review-amenities">
          {data.amenities?.length ? (
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{data.amenities.map((a) => <li key={a} className="flex items-start gap-2 text-sm text-ink-soft"><span aria-hidden className="font-black text-emerald-600">✓</span><span className="capitalize">{a}</span></li>)}</ul>
          ) : <p className="text-sm text-muted">No amenities added.</p>}
        </Card>
        <Card title="Capacity & availability" icon="👥" testid="review-capacity">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-brand-700">Capacity (guests)</span>
            <span className="rounded-xl bg-emerald-50 px-4 py-1.5 text-lg font-black text-ink">{data.capacity || '—'}</span>
          </div>
          {data.openMonths && (
            <>
              <p className="mt-3 text-sm font-bold text-brand-700">Open months</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MONTHS.map((m) => <span key={m} className={`rounded-md px-2 py-0.5 text-xs font-bold capitalize ${data.openMonths!.includes(m) ? 'bg-emerald-600 text-white' : 'bg-cream text-muted'}`}>{m}</span>)}
              </div>
            </>
          )}
        </Card>
        <Card title={`Venue photographs (${photos.length})`} icon="🖼️" testid="review-photos">
          {photos.length ? (
            <div className="grid grid-cols-3 gap-2">{photos.slice(0, 6).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={p} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
            ))}</div>
          ) : <p className="text-sm text-muted">No photos added.</p>}
        </Card>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 sm:flex sm:items-center sm:gap-6" data-testid="review-declaration">
        <h3 className="flex shrink-0 items-center gap-2 font-serif text-xl font-black text-brand-700"><span aria-hidden>🛡️</span>Declaration &amp; Terms</h3>
        <div className="mt-3 space-y-2 sm:mt-0 sm:border-l sm:border-line sm:pl-6">
          {DECLS.map((d, i) => (
            <label key={i} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
              <input type="checkbox" checked={ticks[i]} onChange={(e) => setTicks((t) => t.map((x, j) => (j === i ? e.target.checked : x)))} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" data-testid={`review-decl-${i + 1}`} />
              <span>{d === 'terms' ? <>I have read and agree to the NOSTOPS <Link href="/terms" target="_blank" className="font-bold text-brand-700 underline">Terms &amp; Conditions</Link> and <Link href="/privacy" target="_blank" className="font-bold text-brand-700 underline">Privacy Policy</Link>.</> : d}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert" data-testid="review-error">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onEdit} disabled={busy} className="min-h-12 rounded-full border-2 border-brand-700 bg-white px-8 text-sm font-bold text-brand-700 hover:bg-brand-50" data-testid="review-edit">← Edit details</button>
        <button type="button" onClick={onSubmit} disabled={busy || !all} className="min-h-12 rounded-full bg-orange-700 px-8 text-sm font-bold text-white shadow-md hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50" data-testid="review-submit-btn">
          {busy ? 'Submitting…' : 'Submit for review →'}
        </button>
      </div>
      {!all && <p className="text-right text-xs text-muted">Tick all three declarations to submit.</p>}
    </div>
  );
}
