'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

type Row = {
  id: string; teacher_id: string; parampara_id: string; parampara_name?: string; parampara_slug?: string;
  relationship_type: string; training_institution?: string | null; years_of_training?: number | null;
  certification?: string | null; guru_name?: string | null; city_id?: string | null; evidence_document?: string | null;
};

const VERIFIED_STATES = ['Verified', 'Institutionally verified', 'Historically documented'];

export default function KnowledgeReviewQueue({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial || []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>('');
  const [form, setForm] = useState<Record<string, { state: string; evidence: string }>>({});

  const setF = (id: string, k: 'state' | 'evidence', v: string) =>
    setForm((f) => ({ ...f, [id]: { state: f[id]?.state || VERIFIED_STATES[0], evidence: f[id]?.evidence || '', [k]: v } }));

  async function verify(r: Row) {
    const state = form[r.id]?.state || VERIFIED_STATES[0];
    const evidence = (form[r.id]?.evidence || '').trim();
    if (!evidence) { setMsg('Evidence is required to verify.'); return; }
    setBusy(r.id); setMsg('');
    const res = await postBff('/bff/admin/knowledge/teacher-parampara/verify', {
      affiliation_id: r.id, new_state: state, evidence_document: evidence,
    });
    setBusy(null);
    if (res.ok) { setRows((rs) => rs.filter((x) => x.id !== r.id)); setMsg(`Verified: ${r.teacher_id} → ${r.parampara_name || r.parampara_id} (${state}).`); }
    else setMsg((res.data as any)?.detail || (res.data as any)?.error || 'Verification failed.');
  }

  async function reject(r: Row) {
    setBusy(r.id); setMsg('');
    const res = await postBff('/bff/admin/knowledge/teacher-parampara/reject', { affiliation_id: r.id, reason: form[r.id]?.evidence || 'Unsupported claim' });
    setBusy(null);
    if (res.ok) { setRows((rs) => rs.filter((x) => x.id !== r.id)); setMsg(`Rejected: ${r.teacher_id} → ${r.parampara_name || r.parampara_id}.`); }
    else setMsg((res.data as any)?.detail || (res.data as any)?.error || 'Reject failed.');
  }

  if (rows.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No affiliations awaiting review. 🎉</p>;
  }

  return (
    <div>
      {msg && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700" data-testid="review-msg">{msg}</p>}
      <ul className="list-none space-y-4 p-0">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-white p-5" data-testid="review-row">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-ink">{r.teacher_id}</p>
                <p className="text-sm text-muted">declares <span className="font-semibold text-ink-soft">{r.parampara_name || r.parampara_id}</span> · {r.relationship_type}</p>
              </div>
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink-soft">Unverified</span>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {r.guru_name && <div className="flex justify-between gap-3"><dt className="text-muted">Guru</dt><dd className="font-semibold text-ink-soft">{r.guru_name}</dd></div>}
              {r.training_institution && <div className="flex justify-between gap-3"><dt className="text-muted">Institution</dt><dd className="font-semibold text-ink-soft">{r.training_institution}</dd></div>}
              {typeof r.years_of_training === 'number' && <div className="flex justify-between gap-3"><dt className="text-muted">Years</dt><dd className="font-semibold text-ink-soft">{r.years_of_training}</dd></div>}
              {r.city_id && <div className="flex justify-between gap-3"><dt className="text-muted">City</dt><dd className="font-semibold text-ink-soft">{r.city_id}</dd></div>}
              {r.evidence_document && <div className="flex justify-between gap-3"><dt className="text-muted">Submitted doc</dt><dd className="max-w-[60%] truncate font-semibold text-ink-soft">{r.evidence_document}</dd></div>}
            </dl>
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
              <select
                value={form[r.id]?.state || VERIFIED_STATES[0]}
                onChange={(e) => setF(r.id, 'state', e.target.value)}
                className="rounded-xl border border-line px-3 py-2 text-sm"
                aria-label="Verified state"
              >
                {VERIFIED_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                value={form[r.id]?.evidence || ''}
                onChange={(e) => setF(r.id, 'evidence', e.target.value)}
                placeholder="Evidence / reference (required)"
                className="flex-1 rounded-xl border border-line px-3 py-2 text-sm"
              />
              <button
                onClick={() => verify(r)}
                disabled={busy === r.id}
                className="rounded-xl bg-brand px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              >
                {busy === r.id ? 'Verifying…' : 'Verify'}
              </button>
              <button
                onClick={() => reject(r)}
                disabled={busy === r.id}
                className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                data-testid="reject-btn"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
