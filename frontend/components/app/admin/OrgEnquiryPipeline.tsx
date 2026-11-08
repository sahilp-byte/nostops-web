'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getBff } from '@/lib/auth-client';
import type { EnquiryList, OrgEnquiry } from '@/lib/server/org-enquiries';
import { ENQ_COHORTS, PARTICIPANT_LABELS, STAGES, labelOf } from '@/lib/org/enquiry';

const STAGE_FILTERS = [{ key: 'open', label: 'Open' }, { key: '', label: 'All' }, ...STAGES.map((s) => ({ key: s.key, label: s.label }))];
const select = 'min-h-[40px] rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand';

export function StageChip({ stage }: { stage: string }) {
  const s = STAGES.find((x) => x.key === stage);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${s?.tone || 'bg-cream text-ink-soft'}`} data-testid="enq-stage-chip">
      {s?.label || stage}
    </span>
  );
}

export default function OrgEnquiryPipeline({ initial }: { initial: EnquiryList }) {
  const [stage, setStage] = useState('open');
  const [cohort, setCohort] = useState('');
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<EnquiryList>(initial);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (stage) qs.set('stage', stage);
    if (cohort) qs.set('cohort', cohort);
    if (city) qs.set('city', city);
    if (q.trim()) qs.set('q', q.trim());
    const r = await getBff<EnquiryList>(`/bff/admin/org-enquiries?${qs}`);
    if (r.ok && Array.isArray(r.data?.items)) setData(r.data);
    setLoading(false);
  }, [stage, cohort, city, q]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const items: OrgEnquiry[] = data.items || [];
  const count = (k: string) => (k === 'open' ? null : k === '' ? data.total : data.by_stage?.[k] ?? 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="enq-stage-filters">
        {STAGE_FILTERS.map((f) => {
          const n = count(f.key);
          return (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => setStage(f.key)}
              data-testid={`enq-filter-${f.key || 'all'}`}
              className={stage === f.key ? 'rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white' : 'rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-brand-50'}
            >
              {f.label}
              {n != null && <span className="ml-1 opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <select className={select} value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label="Filter by organisation type" data-testid="enq-filter-cohort">
          <option value="">All organisation types</option>
          {ENQ_COHORTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className={select} value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city" data-testid="enq-filter-city">
          <option value="">All cities</option>
          {(data.cities || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={select} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisation, contact, ENQ-…" aria-label="Search enquiries" data-testid="enq-filter-q" />
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted" data-testid="enq-empty">No enquiries here.</p>
      ) : (
        <ul className="space-y-2" data-testid="enq-list">
          {items.map((e) => (
            <li key={e.id}>
              <Link href={`/app/admin/org-enquiries/${e.id}`} className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand" data-testid={`enq-row-${e.ref}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-ink">{e.organisation_name}</span>
                  <StageChip stage={e.stage} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {e.ref} · {labelOf(ENQ_COHORTS, e.cohort)} · {e.city} · {labelOf(PARTICIPANT_LABELS, e.participants)} participants
                </p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {e.contact_name}
                  {e.owner ? ` · Owner: ${e.owner}` : ' · Unassigned'} · {e.created_at?.slice(0, 10)}
                  {(e.notifications?.team?.status === 'failed' || e.notifications?.ack?.status === 'failed') && (
                    <span className="ml-1 text-red-600">· email failed</span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
