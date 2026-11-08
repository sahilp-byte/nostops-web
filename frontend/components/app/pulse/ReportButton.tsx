'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

// Report a thread or reply for moderator review.
export default function ReportButton({ targetType, targetId }: { targetType: 'thread' | 'post'; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <span className="text-xs font-semibold text-muted" data-testid="pulse-report-success">✓ Reported — thank you</span>;

  async function submit() {
    if (reason.trim().length < 3 || busy) return;
    setBusy(true);
    const r = await postBff('/bff/pulse/reports', { target_type: targetType, target_id: targetId, reason: reason.trim() });
    setBusy(false);
    if (r.ok) { setDone(true); setOpen(false); }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`pulse-report-${targetType}`}
        className="text-xs font-semibold text-muted transition hover:text-rose-600"
      >
        ⚑ Report
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-cream p-3">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Why are you reporting this?"
        data-testid="pulse-report-reason"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={submit} disabled={reason.trim().length < 3 || busy} data-testid="pulse-report-submit" className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy ? 'Sending…' : 'Submit report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft">Cancel</button>
      </div>
    </div>
  );
}
