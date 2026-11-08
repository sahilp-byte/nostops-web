'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

type Reply = { by_name?: string | null; by_role?: string | null; message: string; created_at?: string | null };

// §14 — organiser's reply thread + input for a coordinator's at-risk flag.
export default function OrganiserFlagReply({ eventId, replies }: { eventId: string; replies: Reply[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    const text = msg.trim();
    if (!text) { setErr('Write a reply first.'); return; }
    setErr('');
    setBusy(true);
    const res = await postBff(`/bff/institutional/org/events/${encodeURIComponent(eventId)}/flag/reply`, { message: text });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not send your reply.'); return; }
    setMsg('');
    router.refresh();
  }

  return (
    <div className="mt-2" data-testid={`org-flag-reply-${eventId}`}>
      {replies.length > 0 && (
        <div className="space-y-1.5" data-testid={`org-flag-replies-${eventId}`}>
          {replies.map((r, i) => (
            <div key={i} className="rounded-lg bg-white/70 px-3 py-2">
              <p className="text-[11px] font-bold text-ink-soft">
                {r.by_role === 'admin' ? 'NOSTOPS' : (r.by_name || 'Organiser')}
                {r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ''}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{r.message}</p>
            </div>
          ))}
        </div>
      )}
      <textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 2000))} rows={2}
        placeholder="Reply with the fix or an update. The coordinator and NOSTOPS will see it here."
        data-testid={`org-reply-input-${eventId}`}
        className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted" />
      {err && <p className="mt-1 text-[11px] font-semibold text-red-600">{err}</p>}
      <button type="button" disabled={busy} onClick={send} data-testid={`org-reply-send-${eventId}`}
        className="mt-1 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
        {busy ? 'Sending…' : 'Send reply'}
      </button>
    </div>
  );
}
