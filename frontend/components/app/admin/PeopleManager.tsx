'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDate } from '@/lib/format';
import type { PersonRow, PeopleKind } from '@/lib/server/admin-people';

// People Manager (PHASE 4). Suspend / reinstate teachers and council gurus.
// Writes → admin-guarded BFF → POST /api/admin/people/{kind}/{id}/{action}.

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    suspended: 'bg-amber-50 text-amber-700',
    deleted: 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

function Row({ p, onChanged }: { p: PersonRow; onChanged: (id: string, status: string) => void }) {
  const router = useRouter();
  const [suspending, setSuspending] = useState(false);
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suspend() {
    setError(null);
    const d = Number(days);
    if (!Number.isFinite(d) || d < 1) { setError('Enter a valid number of days.'); return; }
    setBusy(true);
    const res = await postBff(`/bff/admin/people/${p.kind}/${encodeURIComponent(p.id)}/suspend`, { days: d, reason: reason.trim() });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not suspend.'); return; }
    setSuspending(false);
    onChanged(p.id, 'suspended');
    router.refresh();
  }

  async function reinstate() {
    setError(null);
    setBusy(true);
    const res = await postBff(`/bff/admin/people/${p.kind}/${encodeURIComponent(p.id)}/reinstate`, {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not reinstate.'); return; }
    onChanged(p.id, 'active');
    router.refresh();
  }

  const isSuspended = p.status === 'suspended' || (!p.isActive && !!p.suspendedUntil);

  return (
    <div data-testid={`person-${p.id}`} className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">{p.name}</p>
            <StatusPill status={p.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {[p.title, p.city, p.email].filter(Boolean).join(' · ')}
            {p.suspendedUntil ? ` · until ${fmtDate(p.suspendedUntil)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isSuspended ? (
            <button type="button" onClick={reinstate} disabled={busy} data-testid={`reinstate-${p.id}`} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {busy ? '…' : 'Reinstate'}
            </button>
          ) : (
            <button type="button" onClick={() => setSuspending((v) => !v)} disabled={busy} data-testid={`suspend-${p.id}`} className="rounded-xl border border-amber-200 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50">
              Suspend
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}

      {suspending && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cream p-3">
          <label className="text-xs font-semibold text-ink-soft">Days
            <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="ml-2 w-20 rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-brand" />
          </label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="min-w-[160px] flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-brand" />
          <button type="button" onClick={suspend} disabled={busy} className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">{busy ? 'Suspending…' : 'Confirm suspend'}</button>
        </div>
      )}
    </div>
  );
}

export default function PeopleManager({ teachers, council }: { teachers: PersonRow[]; council: PersonRow[] }) {
  const [tab, setTab] = useState<PeopleKind>('teachers');
  const [t, setT] = useState(teachers);
  const [c, setC] = useState(council);
  const [q, setQ] = useState('');

  const onChanged = (id: string, status: string) => {
    const upd = (rows: PersonRow[]) => rows.map((r) => (r.id === id ? { ...r, status, isActive: status === 'active' } : r));
    if (tab === 'teachers') setT(upd); else setC(upd);
  };

  const rows = tab === 'teachers' ? t : c;
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => `${r.name} ${r.city ?? ''} ${r.email ?? ''}`.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);

  return (
    <div>
      <div className="flex gap-1.5">
        {(['teachers', 'council'] as PeopleKind[]).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} data-testid={`people-tab-${k}`} className={`rounded-xl border px-4 py-2 text-sm font-bold capitalize transition ${tab === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>
            {k === 'teachers' ? `Teachers (${t.length})` : `Council (${c.length})`}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, city or email"
        data-testid="people-search"
        className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      />

      <div className="mt-3 rounded-2xl border border-line bg-white">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No people match.</p>
        ) : (
          visible.map((p) => <Row key={p.id} p={p} onChanged={onChanged} />)
        )}
      </div>
    </div>
  );
}
