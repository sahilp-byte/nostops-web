'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Admin decision buttons for one venue ownership claim.
export default function ClaimDecision({ claimId, status }: { claimId: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === 'approved' || status === 'rejected') return null;
  async function act(decision: 'approve' | 'reject' | 'dispute') {
    if (decision === 'approve' && !window.confirm('Approve this claim and give this account editing rights for the venue?')) return;
    setBusy(true); setError(null);
    const { ok, data } = await postBff(`/bff/admin/venue-claims/${encodeURIComponent(claimId)}/${decision}`, { note });
    setBusy(false);
    if (!ok) { setError(data?.error || 'Could not record the decision.'); router.refresh(); return; }
    router.refresh();
  }
  return (
    <div className="mt-3 space-y-2">
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Admin note (shared with the claimant on rejection)" className="w-full rounded-lg border border-line px-3 py-2 text-sm" data-testid={`claim-note-${claimId}`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => act('approve')} className="min-h-11 rounded-lg bg-brand px-4 text-xs font-bold text-white" data-testid={`claim-approve-${claimId}`}>Approve claim</button>
        <button type="button" disabled={busy} onClick={() => act('reject')} className="min-h-11 rounded-lg border border-red-200 px-4 text-xs font-bold text-red-600" data-testid={`claim-reject-${claimId}`}>Reject</button>
        {status !== 'disputed' && <button type="button" disabled={busy} onClick={() => act('dispute')} className="min-h-11 rounded-lg border border-line px-4 text-xs font-bold text-ink-soft" data-testid={`claim-dispute-${claimId}`}>Mark disputed</button>}
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
