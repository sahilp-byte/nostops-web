'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { ReviewStatus } from '@/lib/venue-review-shared';

type ActionKey = 'approve' | 'approve-publish' | 'request-info' | 'reject' | 'mark-duplicate' | 'archive' | 'publish' | 'unpublish' | 'hide';

const ALL_ACTIONS: { key: ActionKey; label: string; tone: 'primary' | 'outline' | 'danger'; note?: string }[] = [
  { key: 'approve-publish', label: 'Approve & publish to directory', tone: 'primary' },
  { key: 'approve', label: 'Approve (hold in review)', tone: 'outline' },
  { key: 'publish', label: 'Publish', tone: 'primary' },
  { key: 'unpublish', label: 'Unpublish', tone: 'outline' },
  { key: 'hide', label: 'Temporarily hide', tone: 'outline' },
  { key: 'request-info', label: 'Request information', tone: 'outline', note: 'What information is needed from the submitter?' },
  { key: 'reject', label: 'Reject', tone: 'danger', note: 'Reason for rejection (strongly recommended — may be shared with the submitter)' },
  { key: 'mark-duplicate', label: 'Mark duplicate', tone: 'outline' },
  { key: 'archive', label: 'Archive', tone: 'outline' },
];

const toneCls: Record<'primary' | 'outline' | 'danger', string> = {
  primary: 'bg-brand text-white hover:bg-brand-600',
  outline: 'border border-line bg-white text-ink-soft hover:bg-cream',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};

// PROMPT 21/22 — moderation actions. Wired to the INTENDED admin contract
// (POST /api/admin/venue-submissions/{id}/{action}) via a CSRF-guarded BFF that
// is remote-first with a LOCAL fallback store — so actions genuinely persist
// today. Buttons are only disabled in the rare case neither path is reachable
// (backendReady=false); nothing is ever faked.
export default function VenueReviewActions({
  id,
  status,
  source,
  backendReady,
}: {
  id: string;
  status: ReviewStatus;
  source: 'submission' | 'published';
  backendReady: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const isPublished = source === 'published' || status === 'published';
  const isHidden = status === 'hidden';
  // PROMPT 32 — visibility actions depend on current status.
  let keys: ActionKey[];
  if (isPublished) keys = ['unpublish', 'hide', 'mark-duplicate', 'archive'];
  else if (isHidden) keys = ['publish', 'archive', 'mark-duplicate'];
  else if (status === 'approved') keys = ['publish', 'request-info', 'reject', 'mark-duplicate', 'archive'];
  else keys = ['approve-publish', 'approve', 'request-info', 'reject', 'mark-duplicate', 'archive'];
  const actions = ALL_ACTIONS.filter((a) => keys.includes(a.key));

  async function run(key: ActionKey) {
    setBusy(true);
    setMsg(null);
    const res = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/${key}`, note ? { note, reason: note } : {});
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: 'ok', text: 'Done.' });
      setPending(null);
      setNote('');
      router.refresh();
    } else {
      const text = (res.data && (res.data.error as string)) || 'This action isn’t available yet.';
      setMsg({ kind: 'err', text });
    }
  }

  function onClick(a: (typeof ALL_ACTIONS)[number]) {
    setMsg(null);
    if (a.note) {
      setPending(a.key);
      setNote('');
    } else {
      run(a.key);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="review-actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black tracking-tight text-ink">Moderation</h2>
        {!backendReady && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent-600">Activates when backend is live</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={!backendReady || busy}
            onClick={() => onClick(a)}
            data-testid={`action-${a.key}`}
            className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${toneCls[a.tone]}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {pending && (
        <div className="mt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={ALL_ACTIONS.find((a) => a.key === pending)?.note || ''}
            data-testid="action-note"
            className="w-full rounded-xl border border-line bg-white p-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(pending)} data-testid="action-confirm" className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              Confirm
            </button>
            <button type="button" onClick={() => { setPending(null); setNote(''); }} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-3 text-sm font-semibold ${msg.kind === 'ok' ? 'text-brand-700' : 'text-red-700'}`} data-testid="action-msg">{msg.text}</p>
      )}

      {!backendReady && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Moderation writes go to <code className="rounded bg-cream px-1 py-0.5">/api/admin/venue-submissions/{'{id}'}/{'{action}'}</code>. This console is fully wired and will act live the moment that endpoint ships — no changes needed here.
        </p>
      )}
    </div>
  );
}
