'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { EmpanelRosterRow } from '@/lib/server/admin-empanelment';

// Empanelment roster (PHASE 3). Revoke goes through the admin-guarded BFF →
// POST /api/admin/empanelment/{teacher_id} { is_empanelled: false }. Granting is
// only possible by activating a recorded approval in Empanelment Decisions.

type Filter = 'all' | 'empanelled' | 'not';

function Row({ t, onChanged }: { t: EmpanelRosterRow; onChanged: (id: string, v: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setBusy(true);
    const next = !t.isEmpanelled;
    const res = await postBff(`/bff/admin/empanelment/${encodeURIComponent(t.teacherId)}`, { is_empanelled: next });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) {
      setError(res.data?.error || 'Could not update empanelment.');
      return;
    }
    onChanged(t.teacherId, next);
    router.refresh();
  }

  return (
    <div data-testid={`empanel-row-${t.teacherId}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-ink">{t.name}</p>
          {t.badge && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{t.badge}</span>}
          {t.isEmpanelled && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Empanelled</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {[t.city, t.experienceYears ? `${t.experienceYears} yrs` : null, t.reviewsCount ? `★ ${t.rating} (${t.reviewsCount})` : null].filter(Boolean).join(' · ')}
        </p>
        {error && <p className="mt-1 text-[11px] font-semibold text-red-700">{error}</p>}
      </div>
      {t.isEmpanelled ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          data-testid={`empanel-toggle-${t.teacherId}`}
          className="shrink-0 rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          {busy ? '…' : 'Revoke'}
        </button>
      ) : (
        // Policy V2: granting = activating a recorded Council approval, never a direct switch.
        <Link href="/app/admin/empanelment/decisions" data-testid={`empanel-activate-${t.teacherId}`} className="shrink-0 rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-700">
          Activate via Decisions
        </Link>
      )}
    </div>
  );
}

export default function EmpanelmentRoster({ rows: initial }: { rows: EmpanelRosterRow[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const onChanged = (id: string, v: boolean) => setRows((prev) => prev.map((r) => (r.teacherId === id ? { ...r, isEmpanelled: v } : r)));

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'empanelled' && !r.isEmpanelled) return false;
      if (filter === 'not' && r.isEmpanelled) return false;
      if (needle && !`${r.name} ${r.city}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, filter]);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${rows.length})` },
    { key: 'empanelled', label: `Empanelled (${rows.filter((r) => r.isEmpanelled).length})` },
    { key: 'not', label: `Awaiting (${rows.filter((r) => !r.isEmpanelled).length})` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or city"
          data-testid="empanel-search"
          className="min-w-[180px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        <div className="flex gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setFilter(tb.key)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                filter === tb.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-white">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No teachers match.</p>
        ) : (
          visible.map((t) => <Row key={t.teacherId} t={t} onChanged={onChanged} />)
        )}
      </div>
    </div>
  );
}
