'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Reply to a discussion. Hidden/disabled when the thread is locked or the
// community is read-only (server also rejects).
export default function ReplyComposer({ threadId, disabled, disabledReason }: { threadId: string; disabled?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (disabled) {
    return (
      <div className="rounded-2xl border border-line bg-cream p-4 text-center text-sm font-semibold text-muted">
        {disabledReason || 'Replies are closed for this discussion.'}
      </div>
    );
  }

  async function submit() {
    if (body.trim().length < 2 || busy) return;
    setBusy(true);
    setErr('');
    const r = await postBff<{ error?: string }>(`/bff/pulse/threads/${threadId}/replies`, { body: body.trim() });
    if (r.ok) {
      setBody('');
      router.refresh();
    } else {
      setErr(r.data?.error || 'Could not reply. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={8000}
        rows={3}
        placeholder="Add your reply…"
        data-testid="pulse-reply-body"
        className="w-full rounded-xl border border-line px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:border-brand focus:outline-none"
      />
      {err && <p className="mt-2 text-sm font-semibold text-rose-700">{err}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={body.trim().length < 2 || busy}
          data-testid="pulse-reply-submit"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Reply'}
        </button>
      </div>
    </div>
  );
}
