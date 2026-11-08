'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import { timeAgo, type PulseThreadLite, type PulseCategoryLite } from '@/lib/pulse-ui';

const STATUSES = ['ALL', 'ACTIVE', 'LOCKED', 'HIDDEN'];

export default function ThreadsAdmin({
  threads, categories, status, category, q,
}: { threads: PulseThreadLite[]; categories: PulseCategoryLite[]; status: string; category: string; q: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [busy, setBusy] = useState('');

  function go(next: Partial<{ status: string; category: string; q: string }>) {
    const s = next.status ?? status;
    const c = next.category ?? category;
    const qq = next.q ?? query;
    const parts: string[] = [];
    if (s && s !== 'ALL') parts.push(`status=${encodeURIComponent(s)}`);
    if (c) parts.push(`category=${encodeURIComponent(c)}`);
    if (qq) parts.push(`q=${encodeURIComponent(qq)}`);
    router.push(`/app/admin/pulse/threads${parts.length ? '?' + parts.join('&') : ''}`);
  }

  async function act(id: string, fn: () => Promise<{ ok: boolean }>) {
    setBusy(id);
    const r = await fn();
    setBusy('');
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); go({ q: query }); }} className="flex flex-1 items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search discussions…" className="min-w-[180px] flex-1 rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>
        <select value={status} onChange={(e) => go({ status: e.target.value })} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft">
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>)}
        </select>
        <select value={category} onChange={(e) => go({ category: e.target.value })} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft">
          <option value="">All topics</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      {threads.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">No discussions match.</p>}

      <div className="space-y-3">
        {threads.map((t) => {
          const b = busy === t.id;
          return (
            <div key={t.id} className="rounded-2xl border border-line bg-white p-4" data-testid="admin-thread-row">
              <div className="flex flex-wrap items-center gap-2">
                {t.pinned && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black uppercase text-accent-600">Pinned</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : t.status === 'HIDDEN' ? 'bg-rose-50 text-rose-700' : 'bg-cream text-muted'}`}>{t.status}</span>
                {t.category_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{t.category_name}</span>}
                {t.featured && <span className="rounded-full bg-royal/15 px-2 py-0.5 text-[10px] font-black uppercase text-royal">🌐 Public</span>}
                {!!t.open_reports && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700">⚑ {t.open_reports} report{t.open_reports === 1 ? '' : 's'}</span>}
              </div>
              <Link href={`/app/admin/pulse/threads/${t.id}`} className="mt-1.5 block text-sm font-extrabold text-ink hover:text-brand-700">{t.title}</Link>
              <p className="mt-0.5 text-xs text-muted">{t.author_name} · {t.reply_count} replies · {timeAgo(t.last_activity_at)}</p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <button disabled={b} onClick={() => act(t.id, () => postBff(`/bff/admin/pulse/threads/${t.id}/pin?pinned=${!t.pinned}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50">{t.pinned ? 'Unpin' : 'Pin'}</button>
                <button disabled={b} onClick={() => act(t.id, () => postBff(`/bff/admin/pulse/threads/${t.id}/lock?locked=${t.status !== 'LOCKED'}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50">{t.status === 'LOCKED' ? 'Unlock' : 'Lock'}</button>
                <button disabled={b} onClick={() => act(t.id, () => postBff(`/bff/admin/pulse/threads/${t.id}/hide?hidden=${t.status !== 'HIDDEN'}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50">{t.status === 'HIDDEN' ? 'Unhide' : 'Hide'}</button>
                <button disabled={b} onClick={() => act(t.id, () => postBff(`/bff/admin/pulse/threads/${t.id}/feature?featured=${!t.featured}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-royal transition hover:bg-cream disabled:opacity-50">{t.featured ? 'Unfeature' : 'Make public'}</button>
                <button disabled={b} onClick={() => act(t.id, () => sendBff(`/bff/admin/pulse/threads/${t.id}`, 'DELETE'))} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">Delete</button>
                <Link href={`/app/admin/pulse/threads/${t.id}`} className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white">Open →</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
