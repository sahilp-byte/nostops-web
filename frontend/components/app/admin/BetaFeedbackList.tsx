'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { titleCase, fmtDateTime } from '@/lib/format';
import type { FeedbackItem } from '@/lib/server/admin-beta';

// Beta feedback triage (PHASE 14). Resolve an item through the admin-guarded BFF.

const SEV_CLS = ['bg-slate-100 text-slate-600', 'bg-slate-100 text-slate-600', 'bg-blue-50 text-blue-700', 'bg-amber-50 text-amber-700', 'bg-orange-50 text-orange-700', 'bg-red-50 text-red-700'];

function Card({ f, onResolved }: { f: FeedbackItem; onResolved: (id: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setError(null);
    setBusy(true);
    const res = await postBff(`/bff/admin/beta-feedback/${encodeURIComponent(f.id)}/resolve`, {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not resolve.'); return; }
    onResolved(f.id);
    router.refresh();
  }

  return (
    <div data-testid={`feedback-${f.id}`} className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SEV_CLS[f.severity] || SEV_CLS[0]}`}>Severity {f.severity}</span>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{titleCase(f.category)}</span>
        {f.persona && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{titleCase(f.persona)}</span>}
        {f.status !== 'open' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 capitalize">{f.status}</span>}
        <span className="ml-auto text-[11px] text-muted">{fmtDateTime(f.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">{f.message}</p>
      {f.reproSteps && <p className="mt-1 text-xs text-ink-soft"><span className="font-semibold">Repro:</span> {f.reproSteps}</p>}
      <p className="mt-2 text-[11px] text-muted">{[f.screen, f.devicePlatform, f.viewport, f.contactEmail].filter(Boolean).join(' · ')}</p>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}
      {f.status === 'open' && (
        <div className="mt-3">
          <button type="button" onClick={resolve} disabled={busy} data-testid={`feedback-resolve-${f.id}`} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? '…' : '✓ Mark resolved'}</button>
        </div>
      )}
    </div>
  );
}

export default function BetaFeedbackList({ items: initial, categories }: { items: FeedbackItem[]; categories: string[] }) {
  const [items, setItems] = useState(initial);
  const [cat, setCat] = useState('all');
  const [openOnly, setOpenOnly] = useState(true);
  const onResolved = (id: string) => setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'resolved' } : f)));

  const visible = useMemo(() => items.filter((f) => (cat === 'all' || f.category === cat) && (!openOnly || f.status === 'open')), [items, cat, openOnly]);

  // CSV is built client-side from the already-fetched admin data (the backend's
  // export.csv route is shadowed by its own /{feedback_id} route — a backend bug
  // we cannot fix). No business logic is duplicated; this only serialises rows.
  function exportCsv() {
    const cols: [string, (f: FeedbackItem) => string | number | null][] = [
      ['id', (f) => f.id], ['created_at', (f) => f.createdAt], ['status', (f) => f.status],
      ['category', (f) => f.category], ['severity', (f) => f.severity], ['persona', (f) => f.persona],
      ['screen', (f) => f.screen], ['message', (f) => f.message], ['repro_steps', (f) => f.reproSteps],
      ['contact_email', (f) => f.contactEmail], ['device', (f) => f.devicePlatform], ['viewport', (f) => f.viewport],
    ];
    const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [cols.map(([h]) => h).join(',')].concat(visible.map((f) => cols.map(([, get]) => esc(get(f))).join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beta-feedback.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} data-testid="feedback-cat-filter" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only
        </label>
        <button type="button" onClick={exportCsv} disabled={visible.length === 0} data-testid="feedback-export" className="ml-auto rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 disabled:opacity-50">⬇ Export CSV</button>
      </div>
      <div className="mt-3 space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">No feedback matches.</div>
        ) : (
          visible.map((f) => <Card key={f.id} f={f} onResolved={onResolved} />)
        )}
      </div>
    </div>
  );
}
