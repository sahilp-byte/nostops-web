'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { postBff } from '@/lib/auth-client';
import type { InterviewerPerson } from '@/lib/server/admin-interviewers';

// Interviewer roster management (PHASE 9). Assign an eligible candidate as an
// empanelment interviewer, or revoke an active interviewer. Both write through
// the admin-guarded BFF → POST /api/admin/empanelment/interviewers/{handle}/{assign|revoke}.

function Person({ m, action, onDone }: { m: InterviewerPerson; action: 'assign' | 'revoke'; onDone: (handle: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    const res = await postBff(`/bff/admin/interviewers/${encodeURIComponent(m.handle)}/${action}`, { note: note.trim() });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not complete the action.'); return; }
    onDone(m.handle);
    router.refresh();
  }

  return (
    <div data-testid={`interviewer-${m.handle}`} className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        {m.photoUrl ? (
          <Image src={m.photoUrl} alt={m.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-cream">🧘</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{m.name}</p>
          <p className="mt-0.5 text-xs text-muted">{[m.title, m.city].filter(Boolean).join(' · ')}</p>
          {action === 'revoke' && <p className="mt-0.5 text-[11px] font-semibold text-brand-700">{m.interviewsCompleted} interviews completed</p>}
        </div>
      </div>
      {m.specialtyFocus.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{m.specialtyFocus.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{s}</span>)}</div>
      )}
      {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}
      {open && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-brand" />}
      <div className="mt-3 flex gap-2">
        {open ? (
          <>
            <button type="button" onClick={run} disabled={busy} className={`rounded-xl px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-50 ${action === 'assign' ? 'bg-brand hover:bg-brand-600' : 'bg-red-600 hover:bg-red-700'}`}>{busy ? '…' : 'Confirm'}</button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">Cancel</button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid={`interviewer-${action}-${m.handle}`}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${action === 'assign' ? 'bg-brand text-white hover:bg-brand-600' : 'border border-red-200 text-red-700 hover:bg-red-50'}`}
          >
            {action === 'assign' ? 'Assign as interviewer' : 'Revoke'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Interviewers({ interviewers: initI, candidates: initC }: { interviewers: InterviewerPerson[]; candidates: InterviewerPerson[] }) {
  const [interviewers, setInterviewers] = useState(initI);
  const [candidates, setCandidates] = useState(initC);

  const onAssign = (handle: string) => {
    const found = candidates.find((c) => c.handle === handle);
    setCandidates((prev) => prev.filter((c) => c.handle !== handle));
    if (found) setInterviewers((prev) => [{ ...found, interviewsCompleted: 0 }, ...prev]);
  };
  const onRevoke = (handle: string) => {
    const found = interviewers.find((c) => c.handle === handle);
    setInterviewers((prev) => prev.filter((c) => c.handle !== handle));
    if (found) setCandidates((prev) => [found, ...prev]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-black text-ink">Active interviewers ({interviewers.length})</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {interviewers.length === 0 ? (
            <p className="text-sm text-muted">No interviewers assigned yet.</p>
          ) : (
            interviewers.map((m) => <Person key={m.handle} m={m} action="revoke" onDone={onRevoke} />)
          )}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-black text-ink">Eligible candidates ({candidates.length})</h2>
        <p className="mt-1 text-sm text-ink-soft">Senior council gurus who can be assigned to conduct empanelment interviews.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">No eligible candidates right now.</p>
          ) : (
            candidates.map((m) => <Person key={m.handle} m={m} action="assign" onDone={onAssign} />)
          )}
        </div>
      </div>
    </div>
  );
}
