'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Phase 5B — role-specific actions on a Space programme: teacher submit/publish, owner approve/reject, admin decision with reason.
export default function SpaceProgrammeActions({ id, viewer, lifecycle, approval }: { id: string; viewer: string; lifecycle: string; approval: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const draft = lifecycle === 'DRAFT';

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(true); setErr(null);
    const r = await postBff(`/bff/spaces/programmes/${id}/${action}`, extra);  // CSRF header required by badOrigin
    const d = r.data || {};
    setBusy(false);
    if (!r.ok) return setErr(d.error || 'Could not complete that action.');
    setText('');
    router.refresh();
  }
  const btn = 'min-h-[48px] rounded-xl px-5 text-sm font-black disabled:opacity-60';
  if (!draft || (viewer !== 'teacher' && approval !== 'PENDING')) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="sp-actions">
      {viewer === 'teacher' && (
        <div className="flex flex-wrap gap-3">
          {approval !== 'PENDING' && approval !== 'APPROVED' && <button disabled={busy} onClick={() => act('submit')} className={`${btn} bg-accent text-white`} data-testid="sp-submit">Send to Space owner for approval</button>}
          {approval === 'APPROVED' && <button disabled={busy} onClick={() => act('publish')} className={`${btn} bg-accent text-white`} data-testid="sp-publish">Publish programme</button>}
          {approval === 'APPROVED' && <p className="w-full text-xs text-muted">Note: editing this draft resets the owner&apos;s approval and it must be approved again.</p>}
          {approval === 'PENDING' && <p className="text-sm text-ink-soft" data-testid="sp-pending">Waiting for the Space owner to approve this listing.</p>}
        </div>
      )}
      {(viewer === 'owner' || viewer === 'admin') && approval === 'PENDING' && (
        <div className="space-y-3">
          <h2 className="text-lg font-black text-ink">{viewer === 'admin' ? 'Decide on behalf of the Space owner (administrator)' : 'Approve this programme listing at your Space?'}</h2>
          <p className="text-sm text-ink-soft">Approving the listing is separate from accepting the enquiry in principle, and it is not a booking.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-xl border border-line p-3 text-sm"
            placeholder={viewer === 'admin' ? 'Reason (required, at least 10 characters)' : 'Note to the teacher (optional)'} data-testid="sp-decision-text" />
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} onClick={() => act(viewer === 'admin' ? 'admin-decision' : 'owner-decision', viewer === 'admin' ? { decision: 'approve', reason: text } : { decision: 'approve', note: text })} className={`${btn} bg-accent text-white`} data-testid="sp-approve">Approve listing</button>
            <button disabled={busy} onClick={() => act(viewer === 'admin' ? 'admin-decision' : 'owner-decision', viewer === 'admin' ? { decision: 'reject', reason: text } : { decision: 'reject', note: text })} className={`${btn} border border-red-300 text-red-700`} data-testid="sp-reject">Reject</button>
          </div>
        </div>
      )}
      {err && <p className="mt-3 text-sm font-semibold text-red-700" role="alert" data-testid="sp-action-error">{err}</p>}
    </section>
  );
}
