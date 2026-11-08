'use client';

import { useEffect, useState } from 'react';
import { getBff, sendBff } from '@/lib/auth-client';

type State = 'due' | 'waiting' | 'finished' | 'stopped' | 'complete' | 'no_email';
type Row = {
  id: string; name: string; locality: string; city: string; city_slug: string; teacher_slug: string;
  claimed_at: number | null; claimer: string; email: string | null; state: State; sent: number;
  last_sent_at: number | null; next_step: number | null; due_at: number | null;
};
type Run = { started_at: number; trigger: string; sent: number; failed: number; already: number; preview_skipped: number };
type Data = { rows: Row[]; runs: Run[]; preview: boolean; auto_enabled: boolean; schedule_days: number[] };

const fmt = (ms: number) => new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const LABEL: Record<State, { text: (r: Row) => string; cls: string }> = {
  due: { text: (r) => `Reminder ${r.next_step} due now`, cls: 'text-amber-700' },
  waiting: { text: (r) => `Reminder ${r.next_step} on ${r.due_at ? fmt(r.due_at) : '—'}`, cls: 'text-ink-soft' },
  finished: { text: () => 'Profile finished — no more reminders', cls: 'text-emerald-700' },
  stopped: { text: () => 'Teacher turned reminders off', cls: 'text-muted' },
  complete: { text: () => 'All 3 reminders sent', cls: 'text-muted' },
  no_email: { text: () => 'No email yet — saved at their next sign-in', cls: 'text-muted' },
};
const BTN = 'min-h-[44px] rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50';

// Admin › Discovery — automatic "finish your profile" reminders (2, 7 and 21 days after claiming).
export default function ClaimReminderPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    getBff<Data & { error?: string }>('/bff/admin/claim-reminders').then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setError('');
      } else setError(r.data?.error || 'Could not load claimed listings.');
    });
    return () => { live = false; };
  }, [reload]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const rows = data?.rows || [];
  const due = rows.filter((r) => r.state === 'due').length;
  const inProgress = rows.filter((r) => r.state !== 'finished').length;
  const sample = rows.find((r) => r.state !== 'finished')?.id || '';

  async function showPreview() {
    setBusy('preview');
    const r = await getBff<{ subject: string; html: string; error?: string }>(`/bff/admin/claim-reminders?view=preview&step=${step}&id=${encodeURIComponent(sample)}`);
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not build the preview.' });
    setPreview({ subject: r.data.subject, html: r.data.html });
  }

  async function sendTest() {
    setBusy('test');
    const r = await sendBff<{ to?: string; error?: string }>('/bff/admin/claim-reminders', 'POST', { action: 'test', step, id: sample });
    setBusy('');
    setMsg(r.ok ? { ok: true, text: `Test of reminder ${step} sent to ${r.data.to}.` } : { ok: false, text: r.data?.error || 'Could not send the test email.' });
  }

  async function run() {
    const where = data?.preview ? '\n\nThis is the preview site: only test addresses are emailed (test outbox); real teachers are skipped.' : '';
    if (!window.confirm(`Send the ${due} reminder${due === 1 ? '' : 's'} that are due now?${where}`)) return;
    setBusy('run');
    setMsg(null);
    const r = await sendBff<Run & { error?: string }>('/bff/admin/claim-reminders', 'POST', { action: 'run' });
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not send the reminders.' });
    const skipped = r.data.preview_skipped ? ` · ${r.data.preview_skipped} real teachers skipped (preview)` : '';
    setMsg({ ok: true, text: `Reminders: ${r.data.sent} sent · ${r.data.already} already sent · ${r.data.failed} failed${skipped}.` });
    setReload((n) => n + 1);
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="claim-reminder-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-black text-ink">✉️ Finish-your-profile reminders</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Teachers who claimed a listing get up to 3 emails — {data?.schedule_days?.join(', ') || '2, 7, 21'} days after
            claiming — until their profile is live. They stop when the profile is finished, when the teacher turns them off,
            or after the third.{' '}
            {data && (data.auto_enabled ? 'Sent automatically in Indian daytime.' : 'Automatic sending is off on the preview site.')}
          </p>
          {data && (
            <p className="mt-2 text-xs font-bold text-ink" data-testid="claim-reminder-counts">
              {rows.length} claimed · {inProgress} in progress · <span className="text-amber-700">{due} due now</span>
            </p>
          )}
          {data?.preview && (
            <p className="mt-1 text-[11px] font-semibold text-muted" data-testid="claim-reminder-preview-note">
              Preview site: real teachers are skipped — only test addresses go to the test outbox.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="claim-reminder-step">Reminder</label>
          <select id="claim-reminder-step" value={step} onChange={(e) => setStep(Number(e.target.value))} className="min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink" data-testid="claim-reminder-step">
            <option value={1}>Reminder 1</option>
            <option value={2}>Reminder 2</option>
            <option value={3}>Reminder 3</option>
          </select>
          <button type="button" className={BTN} disabled={!data || !!busy} onClick={showPreview} data-testid="claim-reminder-preview">
            {busy === 'preview' ? '…' : 'Preview'}
          </button>
          <button type="button" className={BTN} disabled={!data || !!busy} onClick={sendTest} data-testid="claim-reminder-test">
            {busy === 'test' ? 'Sending…' : 'Send test to me'}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={!data || !!busy || due === 0}
            className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
            data-testid="claim-reminder-run"
          >
            {busy === 'run' ? 'Sending…' : `Send ${due} due now`}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" data-testid="claim-reminder-error">{error}</p>}
      {!data && !error && <p className="mt-3 text-xs text-muted">Loading claimed listings…</p>}
      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} data-testid="claim-reminder-msg">
          {msg.text}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm" data-testid="claim-reminder-list">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3 py-2" data-testid="claim-reminder-row" data-state={r.state}>
              <span className="min-w-0">
                <a href={`/teachers/in/${r.city_slug}/${r.teacher_slug}`} target="_blank" rel="noreferrer" className="font-bold text-ink hover:underline">{r.name}</a>
                <span className="ml-2 text-xs text-muted">{[r.locality, r.city].filter(Boolean).join(', ')}</span>
                <span className="block text-xs text-muted">
                  {r.claimer || 'Claimer'} · {r.email || 'no email yet'}{r.claimed_at ? ` · claimed ${fmt(r.claimed_at)}` : ''} · {r.sent}/3 sent
                </span>
              </span>
              <span className={`text-xs font-bold ${LABEL[r.state].cls}`}>{LABEL[r.state].text(r)}</span>
            </li>
          ))}
        </ul>
      )}
      {data && rows.length === 0 && <p className="mt-3 text-xs text-muted">No claimed listings yet.</p>}

      {data && data.runs.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-soft" data-testid="claim-reminder-runs">
          {data.runs.map((r, i) => (
            <li key={`${r.started_at}-${i}`}>
              {fmt(r.started_at)} ({r.trigger}) — {r.sent} sent · {r.already} already · {r.failed} failed{r.preview_skipped ? ` · ${r.preview_skipped} skipped (preview)` : ''}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Email preview" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="claim-reminder-modal">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Preview · reminder {step}</p>
                <p className="mt-0.5 text-sm font-black text-ink" data-testid="claim-reminder-subject">{preview.subject}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-bold text-ink-soft hover:bg-cream" data-testid="claim-reminder-close">Close</button>
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[60vh] w-full bg-white" />
          </div>
        </div>
      )}
    </section>
  );
}
