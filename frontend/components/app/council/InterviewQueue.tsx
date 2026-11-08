'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { InterviewRequest } from '@/lib/server/guru';
import FastTrackDecisionForm, { interviewHeld } from '@/components/app/empanelment/FastTrackDecisionForm';

const STATUS_META: Record<string, { label: string; color: string }> = {
  paid_review_pending: { label: 'Paid · awaiting review', color: '#14B8A6' },
  interview_scheduled: { label: 'Interview set', color: '#0F766E' },
  approved: { label: 'Empanelled ✓', color: '#0D9488' },
  rejected: { label: 'Not empanelled', color: '#EF4444' },
  cancelled: { label: 'Cancelled', color: '#94A3B8' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, color: '#94A3B8' };
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: m.color, backgroundColor: `${m.color}15` }}>{m.label}</span>;
}

function ScheduleForm({ requestId, existing, onDone, onCancel }: { requestId: string; existing: InterviewRequest['interview']; onDone: (m: string, ok: boolean) => void; onCancel: () => void }) {
  const [when, setWhen] = useState('');
  const [link, setLink] = useState(existing?.meetingLink || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!when) { setErr('Pick an interview date & time.'); return; }
    setBusy(true);
    const r = await postBff(`/bff/guru/empanelment/${requestId}/schedule`, {
      scheduled_at: new Date(when).toISOString(),
      meeting_link: link.trim(),
      notes: notes.trim(),
    });
    setBusy(false);
    if (r.ok) onDone('Interview scheduled ✓', true);
    else setErr(r.data?.error || 'Could not schedule.');
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream/60 p-3">
      <p className="text-xs font-extrabold text-ink">{existing ? 'Reschedule interview' : 'Schedule interview'}</p>
      <label className="mt-2 block text-[11px] font-bold text-muted">Date &amp; time</label>
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
      <label className="mt-2 block text-[11px] font-bold text-muted">Meeting link (optional)</label>
      <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
      <label className="mt-2 block text-[11px] font-bold text-muted">Notes to candidate (optional)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
      {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft">Cancel</button>
        <button type="button" onClick={submit} disabled={busy} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#14B8A6' }}>{busy ? 'Saving…' : 'Save schedule'}</button>
      </div>
    </div>
  );
}

function Card({ r, myUserId, policy, openForm, setOpenForm, onClaim, claimBusy, onDone }: {
  r: InterviewRequest;
  myUserId: string;
  policy?: { status: string; label: string };
  openForm: { id: string; kind: 'schedule' | 'decide' } | null;
  setOpenForm: (v: { id: string; kind: 'schedule' | 'decide' } | null) => void;
  onClaim: (id: string) => void;
  claimBusy: string | null;
  onDone: (m: string, ok: boolean) => void;
}) {
  const claimed = !!r.claimedByGuruId;
  const mine = r.claimedByGuruId === myUserId;
  const canAct = mine || !claimed;
  const form = openForm?.id === r.requestId ? openForm.kind : null;

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">{r.teacherName.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">{r.teacherName}</p>
          <p className="truncate text-xs text-muted">{r.city || '—'}{r.specialties.length ? ` · ${r.specialties.slice(0, 3).join(', ')}` : ''}</p>
        </div>
        <StatusPill status={r.status} />
      </div>

      {r.interview && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border p-2.5" style={{ borderColor: '#0F766E40', backgroundColor: '#0F766E0A' }}>
          <span>🎥</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-ink">Interview {r.status === 'interview_scheduled' ? 'scheduled' : 'was set'}</p>
            {r.interview.scheduledAt && <p className="text-xs text-ink-soft">{fmtDate(r.interview.scheduledAt)}</p>}
            {r.interview.meetingLink && <a href={r.interview.meetingLink} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-semibold" style={{ color: '#14B8A6' }}>{r.interview.meetingLink}</a>}
          </div>
        </div>
      )}

      {r.decision && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border p-2.5" style={{ borderColor: `${r.decision.outcome === 'approved' ? '#0D9488' : '#EF4444'}40`, backgroundColor: `${r.decision.outcome === 'approved' ? '#0D9488' : '#EF4444'}12` }}>
          <span>{r.decision.outcome === 'approved' ? '✅' : '⛔'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-ink">{r.decision.outcome === 'approved' ? 'Empanelled' : 'Not empanelled'}{r.decision.decidedAt ? ` · ${fmtDate(r.decision.decidedAt)}` : ''}</p>
            {r.decision.notes && <p className="text-xs text-ink-soft">{r.decision.notes}</p>}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted">{r.paidAt ? `Paid · ${fmtDate(r.paidAt)}` : ''}</span>
        {claimed && <span className="font-semibold text-ink-soft">Claimed by <span className="font-extrabold" style={{ color: mine ? '#0F766E' : '#475569' }}>{mine ? 'you' : r.claimedByGuruName || 'a guru'}</span></span>}
      </div>

      {/* Policy V2: an approval waits for an admin's activation — no second decision. */}
      {policy && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" data-testid={`iq-policy-${r.requestId}`}>
          {policy.label}
        </p>
      )}

      {/* Actions */}
      {!r.decision && !policy && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!claimed && (
            <button type="button" onClick={() => onClaim(r.requestId)} disabled={claimBusy === r.requestId} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#EA580C' }}>
              {claimBusy === r.requestId ? 'Claiming…' : '⚡ Claim'}
            </button>
          )}
          {canAct && (r.status === 'paid_review_pending' || r.status === 'interview_scheduled') && (
            <button type="button" onClick={() => setOpenForm(form === 'schedule' ? null : { id: r.requestId, kind: 'schedule' })} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: '#14B8A6' }}>
              📅 {r.status === 'interview_scheduled' ? 'Reschedule' : 'Schedule'}
            </button>
          )}
          {canAct && (r.status === 'interview_scheduled' || r.status === 'paid_review_pending') && (
            <button type="button" onClick={() => setOpenForm(form === 'decide' ? null : { id: r.requestId, kind: 'decide' })} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: '#0D9488' }}>
              🔨 Decide
            </button>
          )}
        </div>
      )}

      {form === 'schedule' && <ScheduleForm requestId={r.requestId} existing={r.interview} onDone={onDone} onCancel={() => setOpenForm(null)} />}
      {form === 'decide' && <FastTrackDecisionForm url={`/bff/guru/empanelment/${r.requestId}/decide`} teacher={r.teacherName} interviewHeld={interviewHeld(r.status, r.interview?.scheduledAt)} onDone={onDone} onCancel={() => setOpenForm(null)} />}
    </div>
  );
}

export default function InterviewQueue({ active, decidedRecent, myUserId, policy = {} }: { active: InterviewRequest[]; decidedRecent: InterviewRequest[]; myUserId: string; policy?: Record<string, { status: string; label: string }> }) {
  const router = useRouter();
  const [openForm, setOpenForm] = useState<{ id: string; kind: 'schedule' | 'decide' } | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function done(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setOpenForm(null);
    router.refresh();
    setTimeout(() => setToast(null), 4000);
  }

  async function claim(id: string) {
    setClaimBusy(id);
    const r = await postBff(`/bff/guru/empanelment/${id}/claim`);
    setClaimBusy(null);
    done(r.ok ? 'Claimed ✓' : r.data?.error || 'Could not claim — another Guru may have claimed it first.', r.ok);
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="sticky top-2 z-10 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: toast.ok ? '#0D948840' : '#EF444440', backgroundColor: toast.ok ? '#0D948812' : '#EF444412', color: toast.ok ? '#0F766E' : '#B91C1C' }}>
          {toast.msg}
        </div>
      )}

      {active.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🕊️</span>
          <h2 className="mt-2 text-base font-black text-ink">Your queue is clear</h2>
          <p className="mt-1 text-sm text-ink-soft">No active empanelment interviews right now. Newly-paid candidates appear here for you to claim.</p>
        </div>
      ) : (
        active.map((r) => (
          <Card key={r.requestId} r={r} myUserId={myUserId} policy={policy[r.requestId]} openForm={openForm} setOpenForm={setOpenForm} onClaim={claim} claimBusy={claimBusy} onDone={done} />
        ))
      )}

      {decidedRecent.length > 0 && (
        <div>
          <h2 className="mb-2 mt-6 text-sm font-extrabold text-ink">Recently decided</h2>
          <div className="space-y-2">
            {decidedRecent.slice(0, 8).map((r) => (
              <div key={r.requestId} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
                <span>{r.decision?.outcome === 'approved' ? '✅' : '⛔'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{r.teacherName}</p>
                  <p className="truncate text-xs text-muted">{r.city || '—'}{r.decision?.decidedAt ? ` · ${fmtDate(r.decision.decidedAt)}` : ''}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
