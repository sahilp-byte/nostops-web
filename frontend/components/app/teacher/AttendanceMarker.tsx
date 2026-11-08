'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';
import { formatSessionDate } from '@/lib/org/schedule';

type Row = {
  registration_id: string; name?: string | null; participant_type?: string | null; attendance_status?: string | null;
  booking_status?: string; session_id?: string | null;
};
type Session = { session_id: string; seq: number; date: string; can_mark: boolean };

export default function AttendanceMarker({
  eventId,
  roster,
  canMark,
  sessions = [],
}: {
  eventId: string;
  roster: Row[];
  canMark: boolean;
  /** B2.2 — a repeating programme: attendance is marked per session, from its day. */
  sessions?: Session[];
}) {
  const confirmed = roster.filter((r) => r.booking_status === 'CONFIRMED');
  const byId = Object.fromEntries(sessions.map((s) => [s.session_id, s]));
  const markable = (r: Row) => (r.session_id && byId[r.session_id] ? byId[r.session_id].can_mark : canMark);
  const [state, setState] = useState<Record<string, string>>(
    Object.fromEntries(confirmed.map((r) => [r.registration_id, r.attendance_status || ''])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function set(r: Row, status: string) {
    if (!markable(r)) return;
    const id = r.registration_id;
    setState((s) => ({ ...s, [id]: s[id] === status ? '' : status }));
  }

  async function save() {
    setErr(''); setMsg('');
    const entries = Object.entries(state).filter(([, v]) => v).map(([registration_id, status]) => ({ registration_id, status }));
    if (entries.length === 0) { setErr('Mark at least one participant.'); return; }
    setBusy(true);
    const res = await postBff('/bff/institutional/teacher/attendance', { event_id: eventId, entries });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not save attendance.'); return; }
    setMsg(`Saved · ${res.data?.present ?? 0} present`);
  }

  if (confirmed.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted">No confirmed participants yet.</p>;
  }

  const rowView = (r: Row) => {
    const v = state[r.registration_id] || '';
    const can = markable(r);
    return (
      <div key={r.registration_id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{r.name || 'Participant'}</p>
          <p className="text-xs text-muted">{r.participant_type || 'Participant'}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button" disabled={!can} onClick={() => set(r, 'PRESENT')}
            data-testid={`present-${r.registration_id}`}
            className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition ${v === 'PRESENT' ? 'bg-emerald-600 text-white' : 'border border-line bg-white text-ink hover:bg-cream'} disabled:opacity-40`}
          >Present</button>
          <button
            type="button" disabled={!can} onClick={() => set(r, 'ABSENT')}
            data-testid={`absent-${r.registration_id}`}
            className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition ${v === 'ABSENT' ? 'bg-red-500 text-white' : 'border border-line bg-white text-ink hover:bg-cream'} disabled:opacity-40`}
          >Absent</button>
        </div>
      </div>
    );
  };

  // Repeating programme → one group per session that has registrations.
  const groups = sessions
    .map((s) => ({ s, rows: confirmed.filter((r) => r.session_id === s.session_id) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div data-testid="attendance-marker">
      {groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map(({ s, rows }) => (
            <div key={s.session_id} data-testid={`attendance-session-${s.seq}`}>
              <p className="mb-1.5 text-xs font-black uppercase tracking-wider text-ink-soft">
                Session {s.seq} · {formatSessionDate(s.date)}
                {!s.can_mark && <span className="ml-2 font-semibold normal-case tracking-normal text-muted">opens on the day</span>}
              </p>
              <div className="space-y-2">{rows.map(rowView)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{confirmed.map(rowView)}</div>
      )}
      {canMark ? (
        <>
          {err && <p className="mt-3 text-sm font-semibold text-red-600" data-testid="attendance-error">{err}</p>}
          {msg && <p className="mt-3 text-sm font-semibold text-emerald-700" data-testid="attendance-saved">{msg}</p>}
          <button
            type="button" onClick={save} disabled={busy}
            className="mt-3 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            data-testid="attendance-save"
          >{busy ? 'Saving…' : 'Save attendance'}</button>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink-soft">Attendance opens on the day of the event.</p>
      )}
    </div>
  );
}
