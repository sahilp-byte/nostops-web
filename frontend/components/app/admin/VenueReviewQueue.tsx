'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { titleCase } from '@/lib/format';
import { STATUS_META, QUEUE_BUCKETS, type VenueReviewRow, type ReviewStatus } from '@/lib/venue-review-shared';

type Sort = 'newest' | 'oldest' | 'name';

function StatusBadge({ status }: { status: ReviewStatus }) {
  const m = STATUS_META[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.badge}`}>{m.label}</span>;
}

// PROMPT 23 — admin submission queue: status buckets + rich filters + search.
// Runs over the full server-loaded record set (submissions + published venues).
// Mobile-first: bucket chips scroll horizontally; rows are cards on small
// screens and a dense list on desktop. Honest empty states per bucket.
export default function VenueReviewQueue({
  rows,
  counts,
  submissionsBackendReady,
  cities,
  states,
  venueTypes,
  submitterTypes,
}: {
  rows: VenueReviewRow[];
  counts: Record<ReviewStatus, number>;
  submissionsBackendReady: boolean;
  cities: string[];
  states: string[];
  venueTypes: string[];
  submitterTypes: string[];
}) {
  const [bucket, setBucket] = useState<ReviewStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [stateF, setStateF] = useState('');
  const [type, setType] = useState('');
  const [submitter, setSubmitter] = useState('');
  const [verification, setVerification] = useState('');
  const [claimed, setClaimed] = useState('');
  const [sort, setSort] = useState<Sort>('newest');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (bucket !== 'all' && r.status !== bucket) return false;
      if (city && r.city !== city) return false;
      if (stateF && r.state !== stateF) return false;
      if (type && r.venueType !== type) return false;
      if (submitter && r.submitterType !== submitter) return false;
      if (verification && (r.verificationStatus || 'unverified') !== verification) return false;
      if (claimed && String(r.claimed ? 'claimed' : 'unclaimed') !== claimed) return false;
      if (needle) {
        const hay = [r.name, r.city, r.state, r.submitterName, r.website, r.address].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const av = a.submittedAt || '';
      const bv = b.submittedAt || '';
      return sort === 'oldest' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [rows, bucket, q, city, stateF, type, submitter, verification, claimed, sort]);

  const activeCount = [city, stateF, type, submitter, verification, claimed].filter(Boolean).length + (q ? 1 : 0);
  function reset() {
    setQ(''); setCity(''); setStateF(''); setType(''); setSubmitter(''); setVerification(''); setClaimed(''); setSort('newest');
  }

  const selectCls = 'min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  const bucketIsSubmission = bucket !== 'all' && bucket !== 'published';
  const showBackendHint = bucketIsSubmission && !submissionsBackendReady;

  return (
    <div>
      {!submissionsBackendReady && (
        <div className="mb-6 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4 text-sm text-ink-soft" data-testid="submissions-backend-hint">
          <strong className="font-bold text-ink">Submissions API not live yet.</strong> New public venue submissions will appear in these queues automatically once the backend ships <code className="rounded bg-white px-1 py-0.5 text-xs">/admin/venue-submissions</code>. Published directory venues below are live and reviewable now.
        </div>
      )}

      {/* Bucket chips (PROMPT 23) */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Queue">
        <button
          type="button"
          role="tab"
          onClick={() => setBucket('all')}
          aria-selected={bucket === 'all'}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${bucket === 'all' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
          data-testid="bucket-all"
        >
          All <span className="opacity-80">· {rows.length}</span>
        </button>
        {QUEUE_BUCKETS.map((b) => (
          <button
            key={b.status}
            type="button"
            role="tab"
            onClick={() => setBucket(b.status)}
            aria-selected={bucket === b.status}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${bucket === b.status ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
            data-testid={`bucket-${b.status}`}
          >
            {b.title} <span className="opacity-80">· {counts[b.status]}</span>
          </button>
        ))}
      </div>

      {/* Search + filters (PROMPT 23) */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, city, submitter, website or address…"
            aria-label="Search submissions"
            data-testid="review-search"
            className="min-h-[44px] w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className={selectCls}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={stateF} onChange={(e) => setStateF(e.target.value)} aria-label="State" className={selectCls}>
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Venue type" className={selectCls}>
            <option value="">All types</option>
            {venueTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
          <select value={submitter} onChange={(e) => setSubmitter(e.target.value)} aria-label="Submitter type" className={selectCls}>
            <option value="">All submitters</option>
            {submitterTypes.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select value={verification} onChange={(e) => setVerification(e.target.value)} aria-label="Verification status" className={selectCls}>
            <option value="">Any verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          <select value={claimed} onChange={(e) => setClaimed(e.target.value)} aria-label="Claimed status" className={selectCls}>
            <option value="">Claimed & unclaimed</option>
            <option value="claimed">Claimed</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className={selectCls}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted" aria-live="polite" data-testid="review-count">
          {filtered.length} {filtered.length === 1 ? 'record' : 'records'}{activeCount > 0 ? ' match your filters' : ''}
        </p>
        {activeCount > 0 && (
          <button type="button" onClick={reset} className="text-sm font-bold text-brand-700 hover:underline" data-testid="review-clear">Clear filters</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-10 text-center" data-testid="review-empty">
          <span aria-hidden className="text-4xl">🗂️</span>
          <p className="mt-3 text-lg font-bold text-ink">Nothing here yet.</p>
          <p className="mt-1 text-muted">
            {showBackendHint
              ? 'Submissions will appear once the public submission API is live.'
              : 'No records match your current filters.'}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-1 gap-3 p-0">
          {filtered.map((r) => (
            <li key={`${r.source}:${r.id}`}>
              <Link
                href={`/app/admin/venue-review/${encodeURIComponent(r.id)}`}
                data-testid="review-row"
                className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-brand hover:shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {r.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverImage} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg">🏡</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-black text-ink group-hover:text-brand-700">{r.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[r.city, r.state].filter(Boolean).join(', ') || 'Location unknown'}
                      {r.venueType ? ` · ${titleCase(r.venueType)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <StatusBadge status={r.status} />
                  {r.hasPendingChanges && <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800" data-testid="queue-pending-changes">⏳ Changes to review</span>}
                  <span className="text-xs text-muted">
                    {r.submitterName ? `by ${r.submitterName}` : r.source === 'published' ? 'Directory venue' : '—'}
                  </span>
                </div>
                <span aria-hidden className="hidden shrink-0 text-sm font-bold text-brand-700 sm:inline">Review →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
