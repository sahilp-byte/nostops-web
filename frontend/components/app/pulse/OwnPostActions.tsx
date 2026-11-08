'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Edit / delete controls shown only to the author of a thread or reply.
export default function OwnPostActions({
  kind, id, isOwner, initialTitle, initialBody,
}: { kind: 'thread' | 'post'; id: string; isOwner: boolean; initialTitle?: string; initialBody: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle || '');
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!isOwner) return null;
  const tp = kind === 'thread' ? 'thread' : 'reply';

  async function save() {
    if (busy) return;
    setBusy(true);
    const path = kind === 'thread' ? `/bff/pulse/threads/${id}` : `/bff/pulse/posts/${id}`;
    const payload = kind === 'thread' ? { title: title.trim(), body: body.trim() } : { body: body.trim() };
    const r = await sendBff(path, 'PATCH', payload);
    setBusy(false);
    if (r.ok) { setEditing(false); router.refresh(); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    const path = kind === 'thread' ? `/bff/pulse/threads/${id}` : `/bff/pulse/posts/${id}`;
    const r = await sendBff(path, 'DELETE');
    setBusy(false);
    if (r.ok) {
      if (kind === 'thread') router.push('/app/pulse');
      else router.refresh();
    }
  }

  if (editing) {
    return (
      <div className="mt-2 rounded-xl border border-line bg-cream p-3">
        {kind === 'thread' && (
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140}
            className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink focus:border-brand focus:outline-none" />
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={8000}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={save} disabled={busy} data-testid={`pulse-${tp}-save`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={() => setEditing(true)} data-testid={`pulse-${tp}-edit`} className="text-xs font-semibold text-muted transition hover:text-brand-700">Edit</button>
      {confirm ? (
        <span className="inline-flex items-center gap-2">
          <button type="button" onClick={remove} disabled={busy} data-testid={`pulse-${tp}-delete-confirm`} className="text-xs font-bold text-rose-600">{busy ? '…' : 'Confirm delete'}</button>
          <button type="button" onClick={() => setConfirm(false)} className="text-xs font-semibold text-muted">No</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} data-testid={`pulse-${tp}-delete`} className="text-xs font-semibold text-muted transition hover:text-rose-600">Delete</button>
      )}
    </span>
  );
}
