'use client';

import { useEffect, useState } from 'react';
import { getBff, sendBff } from '@/lib/auth-client';

type Status = 'due' | 'sent' | 'failed' | 'sending' | 'no_email';
type Row = { teacherId: string; name: string; handle: string; email: string | null; status: Status; at: string | null };
type Run = { started_at: string; sent: number; failed: number; already: number; preview_skipped: number };
type Data = { rows: Row[]; runs: Run[]; preview: boolean };

const STATUS: Record<Status, { label: string; cls: string }> = {
  due: { label: 'Not emailed yet', cls: 'text-amber-700' },
  failed: { label: 'Failed — will retry', cls: 'text-red-700' },
  sending: { label: 'Sending…', cls: 'text-muted' },
  sent: { label: 'Emailed', cls: 'text-emerald-700' },
  no_email: { label: 'No email on file', cls: 'text-muted' },
};
const BTN = 'min-h-[44px] rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50';
const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

// Admin › Teachers — the one-time "add your profile photo" email for listed teachers without a photo.
export default function PhotoReminderPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    getBff<Data & { error?: string }>('/bff/admin/teacher-photo-reminders').then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setError('');
      } else setError(r.data?.error || 'Could not load the photo reminder list.');
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
  const due = rows.filter((r) => r.email && (r.status === 'due' || r.status === 'failed')).length;
  const sent = rows.filter((r) => r.status === 'sent').length;
  const noEmail = rows.filter((r) => r.status === 'no_email').length;
  const sample = rows.find((r) => r.status === 'due')?.name || rows[0]?.name || '';

  async function showPreview() {
    setBusy('preview');
    const r = await getBff<{ subject: string; html: string; error?: string }>(`/bff/admin/teacher-photo-reminders?view=preview&name=${encodeURIComponent(sample)}`);
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not build the preview.' });
    setPreview({ subject: r.data.subject, html: r.data.html });
  }

  async function sendTest() {
    setBusy('test');
    const r = await sendBff<{ to?: string; error?: string }>('/bff/admin/teacher-photo-reminders', 'POST', { action: 'test', name: sample });
    setBusy('');
    setMsg(r.ok ? { ok: true, text: `Test email sent to ${r.data.to}.` } : { ok: false, text: r.data?.error || 'Could not send the test email.' });
  }

  async function run() {
    const where = data?.preview ? '\n\nThis is the preview site: only test addresses are emailed (test outbox); real teachers are skipped.' : '';
    if (!window.confirm(`Email the photo reminder to ${due} teacher${due === 1 ? '' : 's'} now? Each teacher only ever gets it once.${where}`)) return;
    setBusy('run');
    setMsg(null);
    const r = await sendBff<Run & { error?: string }>('/bff/admin/teacher-photo-reminders', 'POST', { action: 'run' });
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not send the emails.' });
    const skipped = r.data.preview_skipped ? ` · ${r.data.preview_skipped} real teachers skipped (preview)` : '';
    setMsg({ ok: true, text: `Photo reminders: ${r.data.sent} sent · ${r.data.already} already sent · ${r.data.failed} failed${skipped}.` });
    setReload((n) => n + 1);
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="photo-reminder-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-black text-ink">📷 Photo reminder email</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            One email, ever, to each publicly listed teacher who has no profile photo, with a link to add one. Teachers also see
            a reminder on their dashboard until they add a photo. Teachers with a photo are shown first on the homepage.
          </p>
          {data && (
            <p className="mt-2 text-xs font-bold text-ink" data-testid="photo-reminder-counts">
              {rows.length} listed without a photo · <span className="text-amber-700">{due} due</span> · {sent} emailed
              {noEmail ? ` · ${noEmail} no email` : ''}
            </p>
          )}
          {data?.preview && (
            <p className="mt-1 text-[11px] font-semibold text-muted" data-testid="photo-reminder-preview-note">
              Preview site: real teachers are skipped — only test addresses go to the test outbox.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} disabled={!data || !!busy} onClick={showPreview} data-testid="photo-reminder-preview">
            {busy === 'preview' ? '…' : 'Preview email'}
          </button>
          <button type="button" className={BTN} disabled={!data || !!busy} onClick={sendTest} data-testid="photo-reminder-test">
            {busy === 'test' ? 'Sending…' : 'Send test to me'}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={!data || !!busy || due === 0}
            className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
            data-testid="photo-reminder-run"
          >
            {busy === 'run' ? 'Sending…' : `Email ${due} teacher${due === 1 ? '' : 's'} now`}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" data-testid="photo-reminder-error">{error}</p>}
      {!data && !error && <p className="mt-3 text-xs text-muted">Loading teachers…</p>}
      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} data-testid="photo-reminder-msg">
          {msg.text}
        </p>
      )}

      {rows.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-brand-700" data-testid="photo-reminder-list-toggle">Show teachers ({rows.length})</summary>
          <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm" data-testid="photo-reminder-list">
            {rows.map((r) => (
              <li key={r.teacherId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3 py-2" data-testid="photo-reminder-row" data-status={r.status}>
                <span className="min-w-0">
                  <a href={`/teachers/${r.handle}`} target="_blank" rel="noreferrer" className="font-bold text-ink hover:underline">{r.name}</a>
                  <span className="ml-2 text-xs text-muted">{r.email || '—'}</span>
                </span>
                <span className={`text-xs font-bold ${STATUS[r.status].cls}`}>
                  {STATUS[r.status].label}{r.status === 'sent' && r.at ? ` · ${fmt(r.at)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data && data.runs.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-soft" data-testid="photo-reminder-runs">
          {data.runs.map((r, i) => (
            <li key={`${r.started_at}-${i}`}>
              {fmt(r.started_at)} — {r.sent} sent · {r.already} already · {r.failed} failed{r.preview_skipped ? ` · ${r.preview_skipped} skipped (preview)` : ''}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Email preview" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="photo-reminder-modal">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Preview{sample ? ` · ${sample}` : ''}</p>
                <p className="mt-0.5 text-sm font-black text-ink" data-testid="photo-reminder-subject">{preview.subject}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-bold text-ink-soft hover:bg-cream" data-testid="photo-reminder-close">Close</button>
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[60vh] w-full bg-white" />
          </div>
        </div>
      )}
    </section>
  );
}
