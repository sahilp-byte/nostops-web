'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Admin editorial controls for one NOSTOPS Voices article.
//   SUBMITTED → Approve / Reject
//   APPROVED  → Publish / Reject
//   PUBLISHED → Republication ON/OFF + Unpublish
export default function AdminVoicesControls({
  articleId,
  status,
  republication,
}: {
  articleId: string;
  status: string;
  republication: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  async function act(body: Record<string, unknown>, key: string) {
    setError(null);
    setBusy(key);
    const res = await postBff<{ ok?: boolean; error?: string }>(`/bff/admin/voices/${encodeURIComponent(articleId)}`, body);
    setBusy(null);
    if (!res.ok || !res.data?.ok) { setError(res.data?.error || 'Action failed.'); return; }
    setShowReject(false);
    setReason('');
    router.refresh();
  }

  const primary = 'rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50';
  const secondary = 'rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft hover:border-brand disabled:opacity-50';
  const danger = 'rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50';

  return (
    <div className="space-y-4" data-testid="voices-admin-controls">
      <div className="flex flex-wrap gap-3">
        {status === 'SUBMITTED' && (
          <button type="button" disabled={busy !== null} onClick={() => act({ action: 'approve' }, 'approve')} data-testid="voices-approve" className={primary}>
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
        )}
        {(status === 'APPROVED' || status === 'SUBMITTED') && (
          <button type="button" disabled={busy !== null} onClick={() => act({ action: 'publish' }, 'publish')} data-testid="voices-publish" className={primary}>
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {status !== 'PUBLISHED' && status !== 'REJECTED' && (
          <button type="button" disabled={busy !== null} onClick={() => setShowReject((v) => !v)} data-testid="voices-reject-open" className={danger}>Reject</button>
        )}
        {status === 'PUBLISHED' && (
          <button type="button" disabled={busy !== null} onClick={() => act({ action: 'unpublish' }, 'unpublish')} data-testid="voices-unpublish" className={secondary}>
            {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
          </button>
        )}
      </div>

      {showReject && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason shared with the teacher (optional)"
            data-testid="voices-reject-reason"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy !== null} onClick={() => act({ action: 'reject', reason }, 'reject')} data-testid="voices-reject" className={danger}>
              {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button type="button" onClick={() => setShowReject(false)} className={secondary}>Cancel</button>
          </div>
        </div>
      )}

      {status === 'PUBLISHED' && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-cream/40 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">Available for Republication</p>
            <p className="mt-0.5 text-xs text-muted">When ON, the Publisher API + embed/copy tools expose this article externally.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={republication}
            disabled={busy !== null}
            onClick={() => act({ republication: !republication }, 'republication')}
            data-testid="voices-republication"
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${republication ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${republication ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      )}

      {error && <p data-testid="voices-admin-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
