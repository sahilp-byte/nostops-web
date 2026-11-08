'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDate } from '@/lib/format';
import type { VideoSubmission } from '@/lib/server/admin-video';

// Teacher intro-video review. Approve publishes the video; reject returns it to
// the teacher with a reason. Both write through the admin-guarded BFF.

function Card({ v, onDone }: { v: VideoSubmission; onDone: (id: string) => void }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject') {
    setError(null);
    if (action === 'reject' && reason.trim().length < 5) { setError('Give a short reason so the teacher can improve.'); return; }
    setBusy(action);
    const body = action === 'reject' ? { reason: reason.trim() } : {};
    const res = await postBff(`/bff/admin/video-reviews/${encodeURIComponent(v.teacherId)}/${action}`, body);
    setBusy(null);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not complete the action.'); return; }
    onDone(v.teacherId);
    router.refresh();
  }

  return (
    <div data-testid={`video-${v.teacherId}`} className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-ink">{v.name}</h3>
          <p className="mt-0.5 text-xs text-muted">{[v.city, v.handle ? `@${v.handle}` : null, v.submittedAt ? `Submitted ${fmtDate(v.submittedAt)}` : null].filter(Boolean).join(' · ')}</p>
        </div>
        {v.durationSeconds > 0 && <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{Math.round(v.durationSeconds)}s</span>}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-ink/5">
        {v.videoUrl ? (
          <video src={v.videoUrl} poster={v.thumbnailUrl ?? undefined} controls preload="metadata" className="aspect-video w-full bg-black" data-testid={`video-player-${v.teacherId}`} />
        ) : (
          <div className="grid aspect-video w-full place-items-center text-sm text-muted">No playable video URL provided.</div>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
      {rejecting && (
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shared with the teacher)" data-testid={`video-reason-${v.teacherId}`} className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => act('approve')} disabled={busy !== null} data-testid={`video-approve-${v.teacherId}`} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy === 'approve' ? 'Approving…' : '✓ Approve & publish'}</button>
        {rejecting ? (
          <>
            <button type="button" onClick={() => act('reject')} disabled={busy !== null} data-testid={`video-confirm-reject-${v.teacherId}`} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50">{busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}</button>
            <button type="button" onClick={() => { setRejecting(false); setError(null); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setRejecting(true)} disabled={busy !== null} data-testid={`video-reject-${v.teacherId}`} className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50">Reject</button>
        )}
      </div>
    </div>
  );
}

export default function VideoReviewQueue({ items: initial }: { items: VideoSubmission[] }) {
  const [items, setItems] = useState(initial);
  const remove = (id: string) => setItems((prev) => prev.filter((v) => v.teacherId !== id));

  if (items.length === 0) {
    return (
      <div data-testid="video-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-4xl">🎬</p>
        <p className="mt-3 text-lg font-black text-ink">No videos awaiting review</p>
        <p className="mt-1 text-sm text-ink-soft">Teacher intro videos appear here after upload, ready for you to approve or reject.</p>
      </div>
    );
  }
  return <div className="space-y-4" data-testid="video-queue">{items.map((v) => <Card key={v.teacherId} v={v} onDone={remove} />)}</div>;
}
