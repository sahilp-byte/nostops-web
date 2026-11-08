'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDateTime } from '@/lib/format';
import type { FastTrackRequest } from '@/lib/server/admin-empanelment';
import FastTrackDecisionForm, { interviewHeld } from '@/components/app/empanelment/FastTrackDecisionForm';

// Admin oversight of the Council fast-track pipeline (PHASE 3). Schedule an
// interview or record a decision. Writes → admin-guarded BFF →
// POST /api/empanelment/fast-track/{request_id}/{schedule|decide}.

const STATUS_META: Record<string, { label: string; cls: string }> = {
  claimed_pending_interview: { label: 'Pending interview', cls: 'bg-amber-50 text-amber-700' },
  interview_scheduled: { label: 'Interview scheduled', cls: 'bg-blue-50 text-blue-700' },
  unclaimed: { label: 'Unclaimed', cls: 'bg-slate-100 text-slate-600' },
};

function Card({ r, policy, onDone }: { r: FastTrackRequest; policy?: { status: string; label: string }; onDone: (id: string) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'schedule' | 'decide'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');

  const sm = STATUS_META[r.status] || { label: r.status, cls: 'bg-slate-100 text-slate-600' };

  async function schedule() {
    setError(null);
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) { setError('Pick a valid date & time.'); return; }
    if (!meetingLink.trim()) { setError('A meeting link is required.'); return; }
    setBusy(true);
    const res = await postBff(`/bff/admin/empanelment/fast-track/${encodeURIComponent(r.requestId)}/schedule`, {
      scheduled_at: new Date(scheduledAt).toISOString(),
      meeting_link: meetingLink.trim(),
      notes: notes.trim(),
    });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not schedule.'); return; }
    setMode(null);
    router.refresh();
  }

  return (
    <div data-testid={`ft-card-${r.requestId}`} className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-ink">{r.teacherName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sm.cls}`}>{sm.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {[r.teacherCity, r.claimedByGuruName ? `Reviewer: ${r.claimedByGuruName}` : null, r.paidAmount ? `₹${r.paidAmount} paid` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {r.interview?.scheduledAt && (
        <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">
          📅 Interview {fmtDateTime(r.interview.scheduledAt)}{r.interview.meetingLink ? ` · ${r.interview.meetingLink}` : ''}
        </p>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      {mode === 'schedule' && (
        <div className="mt-3 space-y-2">
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} data-testid={`ft-date-${r.requestId}`} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="Meeting link (Google Meet / Zoom)" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the teacher (optional)" rows={2} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
        </div>
      )}
      {mode === 'decide' && (
        <FastTrackDecisionForm
          url={`/bff/admin/empanelment/fast-track/${encodeURIComponent(r.requestId)}/decide`}
          teacher={r.teacherName}
          interviewHeld={interviewHeld(r.status, r.interview?.scheduledAt)}
          onDone={() => { onDone(r.requestId); router.refresh(); }}
          onCancel={() => setMode(null)}
        />
      )}

      {policy && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" data-testid={`ft-policy-${r.requestId}`}>
          {policy.label} · <Link href="/app/admin/empanelment/decisions" className="underline">open Empanelment Decisions</Link>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {mode === null && !policy && (
          <>
            <button type="button" onClick={() => setMode('schedule')} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-700">
              📅 {r.interview?.scheduledAt ? 'Reschedule' : 'Schedule interview'}
            </button>
            <button type="button" onClick={() => setMode('decide')} data-testid={`ft-decide-${r.requestId}`} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600">
              Record decision
            </button>
          </>
        )}
        {mode === 'schedule' && (
          <>
            <button type="button" onClick={schedule} disabled={busy} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? 'Saving…' : 'Save schedule'}</button>
            <button type="button" onClick={() => { setMode(null); setError(null); }} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft hover:bg-cream">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function FastTrackQueue({ active: initial, policy = {} }: { active: FastTrackRequest[]; policy?: Record<string, { status: string; label: string }> }) {
  const [active, setActive] = useState(initial);
  const remove = (id: string) => setActive((prev) => prev.filter((r) => r.requestId !== id));

  if (active.length === 0) {
    return (
      <div data-testid="ft-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-black text-ink">Pipeline is clear</p>
        <p className="mt-1 text-sm text-ink-soft">No active fast-track requests need attention right now.</p>
      </div>
    );
  }
  return <div className="space-y-4" data-testid="ft-queue">{active.map((r) => <Card key={r.requestId} r={r} policy={policy[r.requestId]} onDone={remove} />)}</div>;
}
