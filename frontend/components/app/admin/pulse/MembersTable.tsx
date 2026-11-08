'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDate, timeAgo } from '@/lib/pulse-ui';

const TABS = ['ALL', 'ACTIVE', 'SUSPENDED'];

export default function MembersTable({ members, status, q }: { members: any[]; status: string; q: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [busy, setBusy] = useState('');
  const [suspendId, setSuspendId] = useState('');
  const [reason, setReason] = useState('');

  function go(next: Partial<{ status: string; q: string }>) {
    const s = next.status ?? status;
    const qq = next.q ?? query;
    const parts: string[] = [];
    if (s && s !== 'ALL') parts.push(`status=${encodeURIComponent(s)}`);
    if (qq) parts.push(`q=${encodeURIComponent(qq)}`);
    router.push(`/app/admin/pulse/members${parts.length ? '?' + parts.join('&') : ''}`);
  }

  async function suspend(id: string) {
    setBusy(id);
    const r = await postBff(`/bff/admin/pulse/members/${id}/suspend`, { reason: reason.trim() });
    setBusy(''); setSuspendId(''); setReason('');
    if (r.ok) router.refresh();
  }
  async function reinstate(id: string) {
    setBusy(id);
    const r = await postBff(`/bff/admin/pulse/members/${id}/reinstate`);
    setBusy('');
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); go({ q: query }); }} className="flex flex-1 items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" className="min-w-[180px] flex-1 rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>
        {TABS.map((t) => (
          <button key={t} onClick={() => go({ status: t })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === t ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft'}`}>{t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}</button>
        ))}
      </div>

      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="rounded-2xl border border-line bg-white p-4" data-testid="admin-member-row">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{m.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${m.status === 'SUSPENDED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{m.status}</span></p>
                  <p className="text-xs text-muted">{m.persona} · {m.thread_count} discussions · {m.post_count} replies · joined {fmtDate(m.joined_at)} · active {timeAgo(m.last_active_at)}</p>
                  {m.suspended_reason && <p className="mt-0.5 text-xs text-rose-600">Reason: {m.suspended_reason}</p>}
                </div>
                <div className="flex gap-2">
                  {m.status === 'SUSPENDED' ? (
                    <button disabled={busy === m.id} onClick={() => reinstate(m.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-cream disabled:opacity-50">Reinstate</button>
                  ) : (
                    <button disabled={busy === m.id} onClick={() => setSuspendId(suspendId === m.id ? '' : m.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Suspend</button>
                  )}
                </div>
              </div>
              {suspendId === m.id && (
                <div className="mt-3 rounded-xl border border-line bg-cream p-3">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, shown to moderators)" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
                  <div className="mt-2 flex gap-2">
                    <button disabled={busy === m.id} onClick={() => suspend(m.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Confirm suspend</button>
                    <button onClick={() => { setSuspendId(''); setReason(''); }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">Suspended members can read but cannot post, reply or report. <Link href="/app/admin/pulse" className="font-bold text-brand-700">Back to overview</Link></p>
    </div>
  );
}
