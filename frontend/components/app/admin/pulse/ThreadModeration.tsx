'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import { timeAgo, initials, avatarColor, type PulseThreadLite, type PulsePostLite } from '@/lib/pulse-ui';

// Full moderation view for a single discussion (thread + all replies + reports).
export default function ThreadModeration({
  thread, posts, reports,
}: { thread: PulseThreadLite; posts: PulsePostLite[]; reports: any[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');

  async function act(key: string, fn: () => Promise<{ ok: boolean }>, gotoList = false) {
    setBusy(key);
    const r = await fn();
    setBusy('');
    if (r.ok) { if (gotoList) router.push('/app/admin/pulse/threads'); else router.refresh(); }
  }

  return (
    <div className="space-y-5">
      {/* Thread + moderation bar */}
      <article className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          {thread.pinned && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black uppercase text-accent-600">Pinned</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${thread.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : thread.status === 'HIDDEN' ? 'bg-rose-50 text-rose-700' : thread.status === 'DELETED' ? 'bg-rose-100 text-rose-700' : 'bg-cream text-muted'}`}>{thread.status}</span>
          {thread.category_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{thread.category_name}</span>}
          {thread.featured && <span className="rounded-full bg-royal/15 px-2 py-0.5 text-[10px] font-black uppercase text-royal">🌐 Public</span>}
        </div>
        <h1 className="mt-1.5 text-xl font-black tracking-tight text-ink">{thread.title}</h1>
        <p className="mt-0.5 text-xs text-muted">{thread.author_name} · {thread.author_persona} · {timeAgo(thread.created_at)}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{thread.body}</p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          <button disabled={!!busy} onClick={() => act('pin', () => postBff(`/bff/admin/pulse/threads/${thread.id}/pin?pinned=${!thread.pinned}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">{thread.pinned ? 'Unpin' : 'Pin'}</button>
          <button disabled={!!busy} onClick={() => act('lock', () => postBff(`/bff/admin/pulse/threads/${thread.id}/lock?locked=${thread.status !== 'LOCKED'}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">{thread.status === 'LOCKED' ? 'Unlock' : 'Lock'}</button>
          <button disabled={!!busy} onClick={() => act('hide', () => postBff(`/bff/admin/pulse/threads/${thread.id}/hide?hidden=${thread.status !== 'HIDDEN'}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">{thread.status === 'HIDDEN' ? 'Unhide' : 'Hide'}</button>
          <button disabled={!!busy} onClick={() => act('feature', () => postBff(`/bff/admin/pulse/threads/${thread.id}/feature?featured=${!thread.featured}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-royal hover:bg-cream disabled:opacity-50">{thread.featured ? 'Unfeature (make private)' : 'Make public'}</button>
          <button disabled={!!busy} onClick={() => act('del', () => sendBff(`/bff/admin/pulse/threads/${thread.id}`, 'DELETE'), true)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Delete discussion</button>
        </div>
      </article>

      {/* Reports on this thread */}
      {reports.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <h2 className="text-sm font-extrabold text-rose-700">⚑ {reports.length} report{reports.length === 1 ? '' : 's'}</h2>
          <ul className="mt-2 space-y-1.5">
            {reports.map((r) => (
              <li key={r.id} className="text-xs text-ink-soft">
                <span className="font-bold">{r.reporter_name}</span> reported this {r.target_type}: “{r.reason}” <span className="text-muted">· {timeAgo(r.created_at)} · {r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Replies */}
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">Replies ({posts.length})</h2>
        <div className="mt-3 space-y-3">
          {posts.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-4 ${p.status === 'ACTIVE' ? 'border-line bg-white' : 'border-rose-200 bg-rose-50/40'}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: avatarColor(p.author_name) }} aria-hidden="true">{initials(p.author_name)}</span>
                <div className="text-xs text-muted">
                  <span className="font-bold text-ink-soft">{p.author_name}</span> · {timeAgo(p.created_at)}
                  {p.status !== 'ACTIVE' && <span className="ml-1 font-bold text-rose-600">· {p.status}</span>}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{p.body}</p>
              <div className="mt-2 flex gap-2">
                <button disabled={!!busy} onClick={() => act(p.id, () => postBff(`/bff/admin/pulse/posts/${p.id}/hide?hidden=${p.status !== 'HIDDEN'}`))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">{p.status === 'HIDDEN' ? 'Unhide' : 'Hide'}</button>
                <button disabled={!!busy} onClick={() => act(p.id, () => sendBff(`/bff/admin/pulse/posts/${p.id}`, 'DELETE'))} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Delete</button>
              </div>
            </div>
          ))}
          {posts.length === 0 && <p className="text-sm text-muted">No replies.</p>}
        </div>
      </div>
    </div>
  );
}
