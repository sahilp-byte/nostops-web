'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { VENUE_FIELD_LABEL, type PendingChanges } from '@/lib/venue-review-shared';

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '—';
  return String(v);
};

/** Owner changes to a LIVE venue, shown next to the live values for approval. */
export default function VenuePendingChanges({ id, pending, live }: { id: string; pending: PendingChanges; live: Record<string, unknown> }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fields = pending.changed.length ? pending.changed : Object.keys(pending.fields);
  const byAi = pending.actorType === 'ai';

  async function decide(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !window.confirm('Reject these changes? The live listing stays as it is.')) return;
    setBusy(decision);
    setErr(null);
    const r = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/pending/${decision}`, { note: note.trim() });
    setBusy(null);
    if (!r.ok) { setErr((r.data as { error?: string })?.error || 'Could not complete this action.'); return; }
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5" data-testid="pending-changes-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black tracking-tight text-ink">⏳ Pending changes from the owner</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            The live listing is unchanged. Approve to publish these changes, or reject to keep the current version.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-white px-2.5 py-1 text-ink">{pending.actor || 'Venue owner'}</span>
          {byAi && <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700" data-testid="pending-ai-tag">✨ AI-assisted</span>}
          {pending.submittedAt && <span className="text-muted">{new Date(pending.submittedAt).toLocaleString('en-IN')}</span>}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-line text-sm">
          <div className="bg-cream p-3 text-xs font-black uppercase tracking-wide text-muted">Field</div>
          <div className="bg-cream p-3 text-xs font-black uppercase tracking-wide text-muted">Live now</div>
          <div className="bg-cream p-3 text-xs font-black uppercase tracking-wide text-muted">Proposed</div>
          {fields.map((k) => (
            <div key={k} className="contents" data-testid={`pending-row-${k}`}>
              <div className="bg-white p-3 font-semibold text-ink">
                {VENUE_FIELD_LABEL[k] || k}
                {pending.aiFields.includes(k) && <span className="ml-1 text-[10px] font-bold text-indigo-600">AI</span>}
              </div>
              <div className="whitespace-pre-line break-words bg-white p-3 text-ink-soft">{fmt(live[k])}</div>
              <div className="whitespace-pre-line break-words bg-amber-50/50 p-3 font-semibold text-ink">{fmt(pending.fields[k])}</div>
            </div>
          ))}
        </div>
      </div>

      <label className="mt-4 block text-xs font-bold text-muted" htmlFor="pending-note">Note to the owner (optional, included in the email)</label>
      <textarea id="pending-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="pending-note" />
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => decide('approve')} disabled={!!busy} className="min-h-[44px] rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="pending-approve">
          {busy === 'approve' ? 'Approving…' : 'Approve & publish changes'}
        </button>
        <button type="button" onClick={() => decide('reject')} disabled={!!busy} className="min-h-[44px] rounded-xl border border-red-200 bg-white px-5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50" data-testid="pending-reject">
          {busy === 'reject' ? 'Rejecting…' : 'Reject changes'}
        </button>
      </div>
    </section>
  );
}
