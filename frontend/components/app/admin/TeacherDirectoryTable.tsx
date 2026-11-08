'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import {
  type AdminTeacherRow,
  type TeacherFilter,
  TEACHER_FILTERS,
  VERIFICATION_META,
  EMPANELMENT_META,
  matchesFilter,
  matchesQuery,
  levelLabelShort,
  levelColor,
} from '@/lib/admin-teacher-shared';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-black text-brand-700">{(name || '?').slice(0, 1).toUpperCase()}</span>;
}

function LevelPill({ level }: { level: AdminTeacherRow['level'] }) {
  const c = levelColor(level);
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: c + '1a', color: c }}>{levelLabelShort(level)}</span>;
}

function Completion({ pct }: { pct: number }) {
  const c = pct >= 100 ? '#0D9488' : pct >= 60 ? '#0EA5E9' : '#F59E0B';
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
      </span>
      <span className="text-xs font-bold tabular-nums text-ink-soft">{pct}%</span>
    </span>
  );
}

// One-click admin Verify / Disable of a teacher's "Verified" badge (is_verified),
// straight from the directory — for ANY teacher, no drill-in. Backed by the
// proven POST /bff/admin/teachers/{id}/status { verification } which persists via
// the backend's dedicated verification endpoint. Admin-only (guarded server-side).
function VerifyToggle({
  teacherId,
  status,
  onChange,
}: {
  teacherId: string;
  status: AdminTeacherRow['verification'];
  onChange: (s: AdminTeacherRow['verification']) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const verified = status === 'verified';

  async function toggle() {
    setErr(null);
    setBusy(true);
    const next: AdminTeacherRow['verification'] = verified ? 'not_verified' : 'verified';
    const payload: Record<string, unknown> = { verification: next };
    if (next === 'not_verified') payload.verificationReason = 'Verification revoked by NOSTOPS admin.';
    const res = await postBff<{ ok?: boolean; error?: string; results?: Record<string, { persisted: boolean; message: string }> }>(
      `/bff/admin/teachers/${encodeURIComponent(teacherId)}/status`,
      payload,
    );
    setBusy(false);
    const vr = res.data?.results?.verification;
    if (!res.ok || !vr?.persisted) {
      setErr(vr?.message || res.data?.error || 'Could not update verification.');
      return;
    }
    onChange(next);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        data-testid={`teacher-verify-toggle-${teacherId}`}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
          verified ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50' : 'bg-brand text-white hover:bg-brand-600'
        }`}
      >
        {busy ? '…' : verified ? 'Disable' : '✓ Verify'}
      </button>
      {err && <span className="max-w-[190px] text-right text-[10px] font-semibold text-red-600">{err}</span>}
    </span>
  );
}

// Admin Teacher Directory table (Prompts 5–7). Search + filters run client-side
// over the server-loaded authoritative roster (no second search store) and
// compose. Dense sortable-feel table on desktop; card rows on mobile.
export default function TeacherDirectoryTable({ rows }: { rows: AdminTeacherRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<TeacherFilter>('all');
  const [overrides, setOverrides] = useState<Record<string, AdminTeacherRow['verification']>>({});
  const [empOverrides, setEmpOverrides] = useState<Record<string, AdminTeacherRow['empanelment']>>({});
  const [lvlOverrides, setLvlOverrides] = useState<Record<string, AdminTeacherRow['level']>>({});
  const vstatus = (r: AdminTeacherRow) => overrides[r.teacherId] ?? r.verification;
  const estatus = (r: AdminTeacherRow) => empOverrides[r.teacherId] ?? r.empanelment;
  const lstatus = (r: AdminTeacherRow) => lvlOverrides[r.teacherId] ?? r.level;
  const applyVer = (id: string, s: AdminTeacherRow['verification']) => setOverrides((o) => ({ ...o, [id]: s }));

  // Bulk selection — set Verification / Empanelment / Level on many at once.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const toggleSel = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSel = () => { setSelected(new Set()); setBulkMsg(null); };

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () => rows.filter((r) => matchesFilter(r, filter) && matchesQuery(r, needle)),
    [rows, filter, needle],
  );
  const chipCount = (f: TeacherFilter) => rows.filter((r) => matchesFilter(r, f)).length;
  const active = !!needle || filter !== 'all';

  const filteredIds = useMemo(() => filtered.map((r) => r.teacherId), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) filteredIds.forEach((id) => n.delete(id));
      else filteredIds.forEach((id) => n.add(id));
      return n;
    });

  type BulkField = 'verification' | 'empanelment' | 'level';
  async function runBulk(field: BulkField, value: string | number, label: string) {
    const ids = [...selected];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMsg(null);
    const res = await postBff<{ ok?: boolean; okCount?: number; failCount?: number; error?: string; results?: Record<string, { persisted: boolean; message: string }> }>(
      '/bff/admin/teachers/bulk-status',
      { teacherIds: ids, field, value },
    );
    setBulkBusy(false);
    if (!res.ok || !res.data?.ok) {
      setBulkMsg(res.data?.error || 'Bulk update failed. Please try again.');
      return;
    }
    const results = res.data.results || {};
    const persistedIds = Object.entries(results).filter(([, r]) => r.persisted).map(([id]) => id);
    if (field === 'verification') {
      setOverrides((o) => { const n = { ...o }; persistedIds.forEach((id) => (n[id] = value as AdminTeacherRow['verification'])); return n; });
    } else if (field === 'empanelment') {
      setEmpOverrides((o) => { const n = { ...o }; persistedIds.forEach((id) => (n[id] = value as AdminTeacherRow['empanelment'])); return n; });
    } else {
      const lvl = (Number(value) === 0 ? 'none' : Number(value)) as AdminTeacherRow['level'];
      setLvlOverrides((o) => { const n = { ...o }; persistedIds.forEach((id) => (n[id] = lvl)); return n; });
    }
    const ok = res.data.okCount ?? 0;
    const fail = res.data.failCount ?? 0;
    const tail = field === 'verification' ? ' (some may need a pending KYC record)' : '';
    setBulkMsg(
      fail === 0
        ? `${label} — ${ok} teacher${ok === 1 ? '' : 's'} updated.`
        : `${label} — ${ok} updated; ${fail} could not be updated${tail}.`,
    );
    router.refresh();
  }

  return (
    <div>
      {/* Search (Prompt 6) */}
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search teachers by name…"
          aria-label="Search teachers by name"
          data-testid="admin-teacher-search"
          className="min-h-[48px] w-full rounded-2xl border border-line bg-white pl-10 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* Filters (Prompt 7) */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Teacher filters">
        {TEACHER_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            onClick={() => setFilter(f.key)}
            aria-selected={filter === f.key}
            data-testid={`teacher-filter-${f.key}`}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold transition ${filter === f.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
          >
            {f.label} <span className="opacity-80">· {chipCount(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted" aria-live="polite" data-testid="teacher-count">
          {filtered.length} {filtered.length === 1 ? 'teacher' : 'teachers'}{active ? ' match' : ''}
        </p>
        {active && (
          <button type="button" onClick={() => { setQ(''); setFilter('all'); }} className="text-sm font-bold text-brand-700 hover:underline" data-testid="teacher-clear">
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-10 text-center" data-testid="teacher-empty">
          <span aria-hidden className="text-4xl">🧘</span>
          <p className="mt-3 text-lg font-bold text-ink">No teachers match.</p>
          <p className="mt-1 text-muted">Try a different name or filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-line bg-white lg:block">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-cream/80 backdrop-blur">
                <tr className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all teachers in view"
                      data-testid="teacher-select-all"
                      className="h-4 w-4 cursor-pointer accent-brand"
                    />
                  </th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Teacher ID</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Empanelment</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.teacherId} data-testid="teacher-row" className={`border-t border-line align-middle hover:bg-cream/40 ${selected.has(r.teacherId) ? 'bg-brand-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.teacherId)}
                        onChange={() => toggleSel(r.teacherId)}
                        aria-label={`Select ${r.name}`}
                        data-testid={`teacher-select-${r.teacherId}`}
                        className="h-4 w-4 cursor-pointer accent-brand"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar url={r.avatarUrl} name={r.name} />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-ink">{r.name}</p>
                          {r.handle && <p className="truncate text-xs text-muted">@{r.handle}</p>}
                          {!r.inDirectory && <p className="text-[11px] font-bold text-amber-700">Profile hidden / incomplete</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{r.city || '—'}</td>
                    <td className="px-4 py-3"><code className="rounded bg-cream px-1.5 py-0.5 text-xs text-ink-soft">{r.teacherId}</code></td>
                    <td className="px-4 py-3"><Completion pct={r.completion} /></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${VERIFICATION_META[vstatus(r)].badge}`}>{VERIFICATION_META[vstatus(r)].label}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${EMPANELMENT_META[estatus(r)].badge}`}>{EMPANELMENT_META[estatus(r)].label}</span></td>
                    <td className="px-4 py-3"><LevelPill level={lstatus(r)} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(r.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <VerifyToggle teacherId={r.teacherId} status={vstatus(r)} onChange={(s) => applyVer(r.teacherId, s)} />
                        <Link href={`/app/admin/teachers/${encodeURIComponent(r.teacherId)}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-cream" data-testid="teacher-review-link">
                          Review →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-4 grid list-none grid-cols-1 gap-3 p-0 lg:hidden">
            {filtered.map((r) => (
              <li key={r.teacherId} data-testid="teacher-row" className={`flex flex-col gap-3 rounded-2xl border p-4 ${selected.has(r.teacherId) ? 'border-brand bg-brand-50/40' : 'border-line bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.teacherId)}
                    onChange={() => toggleSel(r.teacherId)}
                    aria-label={`Select ${r.name}`}
                    data-testid={`teacher-select-${r.teacherId}`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-brand"
                  />
                  <Link href={`/app/admin/teachers/${encodeURIComponent(r.teacherId)}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    <Avatar url={r.avatarUrl} name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-ink group-hover:text-brand-700">{r.name}</p>
                      <p className="truncate text-xs text-muted">{r.city || 'City unknown'} · {r.teacherId}</p>
                    </div>
                    <LevelPill level={lstatus(r)} />
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${VERIFICATION_META[vstatus(r)].badge}`}>{VERIFICATION_META[vstatus(r)].label}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${EMPANELMENT_META[estatus(r)].badge}`}>{EMPANELMENT_META[estatus(r)].label}</span>
                  <Completion pct={r.completion} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[11px] text-muted">Registered {fmtDate(r.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <VerifyToggle teacherId={r.teacherId} status={vstatus(r)} onChange={(s) => applyVer(r.teacherId, s)} />
                    <Link href={`/app/admin/teachers/${encodeURIComponent(r.teacherId)}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-cream">
                      Review →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Bulk action bar — appears when one or more teachers are selected */}
      {selected.size > 0 && (
        <>
          <div aria-hidden className="h-32" />
          <div
            role="region"
            aria-label="Bulk status actions"
            data-testid="bulk-action-bar"
            className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur md:left-64"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white" data-testid="bulk-selected-count">{selected.size}</span>
                <span className="text-sm font-bold text-ink">selected</span>
                {bulkMsg && <span className="text-xs font-semibold text-brand-700" data-testid="bulk-result">{bulkMsg}</span>}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* Verification */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Verify</span>
                  <button
                    type="button"
                    onClick={() => runBulk('verification', 'verified', 'Verified')}
                    disabled={bulkBusy}
                    data-testid="bulk-verify"
                    className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    ✓ Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulk('verification', 'not_verified', 'Disabled')}
                    disabled={bulkBusy}
                    data-testid="bulk-disable"
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Disable
                  </button>
                </div>

                {/* Empanelment */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Empanel</span>
                  <button
                    type="button"
                    onClick={() => runBulk('empanelment', 'empanelled', 'Empanelled')}
                    disabled={bulkBusy}
                    data-testid="bulk-empanel"
                    className="rounded-lg bg-royal px-3 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Empanel
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulk('empanelment', 'not_empanelled', 'Empanelment removed')}
                    disabled={bulkBusy}
                    data-testid="bulk-unempanel"
                    className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                {/* Level */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Level</span>
                  <select
                    defaultValue=""
                    disabled={bulkBusy}
                    data-testid="bulk-level"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') return;
                      const n = Number(v);
                      runBulk('level', n, n === 0 ? 'Level cleared' : `Level ${n} set`);
                      e.target.value = '';
                    }}
                    className="rounded-lg border border-line bg-white px-2 py-2 text-sm font-bold text-ink-soft outline-none focus:border-brand disabled:opacity-50"
                  >
                    <option value="" disabled>Set level…</option>
                    <option value="1">Level 1 · Shikshak</option>
                    <option value="2">Level 2 · Pracharak</option>
                    <option value="3">Level 3 · Guru</option>
                    <option value="0">Clear level</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={clearSel}
                  disabled={bulkBusy}
                  data-testid="bulk-clear"
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
