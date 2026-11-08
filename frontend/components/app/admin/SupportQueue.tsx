'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { postBff } from '@/lib/auth-client';
import type { SupportRequest } from '@/lib/server/guru-support';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'];
const FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'OPEN', label: 'New' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'WAITING_FOR_USER', label: 'Waiting' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

function priorityClass(p: string) {
  if (p === 'high') return 'bg-accent-50 text-accent-600';
  return 'bg-cream text-ink-soft';
}
function statusClass(s: string) {
  switch (s) {
    case 'OPEN':
      return 'bg-accent-50 text-accent-600';
    case 'IN_PROGRESS':
      return 'bg-brand-50 text-brand-700';
    case 'RESOLVED':
      return 'bg-brand-50 text-brand-700';
    default:
      return 'bg-cream text-ink-soft';
  }
}

export default function SupportQueue({ initial }: { initial: SupportRequest[] }) {
  const [filter, setFilter] = useState('open');
  const [items, setItems] = useState<SupportRequest[]>(initial);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SupportRequest | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/bff/admin/guru-support?status=${encodeURIComponent(status)}`, { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (filter !== 'open') load(filter);
    else setItems(initial);
  }, [filter, load, initial]);

  const onUpdated = (updated: SupportRequest) => {
    setSelected(updated);
    setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      {/* List */}
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? 'rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white'
                  : 'rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-brand-50'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">No requests here.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full rounded-2xl border bg-white p-3 text-left transition hover:border-brand ${
                    selected?.id === r.id ? 'border-brand ring-1 ring-brand' : 'border-line'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-ink">{r.ref}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${priorityClass(r.priority)}`}>
                      {r.priority}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-ink-soft">{r.summary || r.issue}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-muted">
                    <span className={`rounded px-1.5 py-0.5 ${statusClass(r.status)}`}>{r.status}</span>
                    <span>· {r.category}</span>
                    {r.role && <span>· {r.role}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detail */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        {selected ? (
          <SupportDetail key={selected.id} req={selected} onUpdated={onUpdated} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
            Select a request to view its details and the AI conversation.
          </div>
        )}
      </div>
    </div>
  );
}

function SupportDetail({ req, onUpdated }: { req: SupportRequest; onUpdated: (r: SupportRequest) => void }) {
  const [status, setStatus] = useState(req.status);
  const [assignee, setAssignee] = useState(req.assignee || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setStatus(req.status);
    setAssignee(req.assignee || '');
    setNote('');
    setMsg('');
  }, [req.id, req.status, req.assignee]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    const { ok, data } = await postBff<SupportRequest & { error?: string }>(`/bff/admin/guru-support/${req.id}`, {
      status,
      assignee,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (ok && (data as any)?.id) {
      onUpdated(data as SupportRequest);
      setNote('');
      setMsg('Saved.');
    } else {
      setMsg((data as any)?.error || 'Could not save.');
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-ink">{req.ref}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${priorityClass(req.priority)}`}>{req.priority}</span>
      </div>
      <div className="mt-1 text-xs font-semibold text-muted">
        {req.category}
        {req.role ? ` · ${req.role}` : ''} · {req.email}
      </div>
      {(req.page_type || req.route) && (
        <div className="mt-0.5 text-xs text-muted">
          {req.page_type ? `page: ${req.page_type}` : ''} {req.route ? `· ${req.route}` : ''}
          {req.reference ? ` · ref: ${req.reference}` : ''}
        </div>
      )}

      <p className="mt-3 text-xs font-black uppercase tracking-wide text-muted">Issue</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{req.issue}</p>

      {req.conversation.length > 0 && (
        <details className="mt-3 rounded-xl border border-line bg-cream/40 p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-muted">
            AI conversation ({req.conversation.length})
          </summary>
          <div className="mt-2 space-y-2">
            {req.conversation.map((t, i) => (
              <div key={i} className="text-sm">
                <span className="font-bold text-ink">{t.role === 'user' ? 'User' : 'Guru'}: </span>
                <span className="whitespace-pre-wrap text-ink-soft">{t.content}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {req.notes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Notes</p>
          <ul className="mt-1 space-y-1.5">
            {req.notes.map((n, i) => (
              <li key={i} className="rounded-lg bg-cream/50 px-2.5 py-1.5 text-sm text-ink-soft">
                {n.text}
                <span className="mt-0.5 block text-[11px] text-muted">
                  {n.author} · {n.at?.replace('T', ' ').replace(/\+.*/, '')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-ink">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink">Assignee</label>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Unassigned"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </div>
        </div>
        <label className="mt-3 block text-xs font-bold text-ink">Add a note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Resolution notes…"
          className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-[40px] items-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-sm font-semibold text-brand-700">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
