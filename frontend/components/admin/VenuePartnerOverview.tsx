'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBff, sendBff } from '@/lib/auth-client';

type Counts = Record<'invite_visit' | 'profile_view' | 'register_start' | 'register_complete' | 'existing_signin' | 'profile_complete', number>;
type Row = {
  id: string; name: string; city: string | null; country: string | null; status: string; status_label: string; code: string | null;
  website_host: string | null;
  widget: { host: string | null; seen_at: number | null; live: boolean; on_own_site: boolean };
  badge: boolean; counts: Counts | null; month_counts: Counts | null;
  email: { not_eligible: string | null; opted_out: boolean; last_sent: string | null };
  reminder: { state: string; due_at: number | null; variant: 'widget' | 'share'; sent_at: string | null };
};
type Run = { month: string; trigger: string; started_at: string; sent: number; failed: number; already: number; skipped: number; total_sent: number; preview_skipped?: number };
type ReminderRun = { trigger: string; started_at: string; sent: number; failed: number; already: number; not_due: number; preview_skipped?: number };
export type OverviewData = {
  rows: Row[]; month_label: string;
  monthly: { auto_enabled: boolean; next_auto_run: string; default_month: string; default_month_label: string; runs: Run[]; reminder_runs: ReminderRun[] };
};
type EmailType = 'monthly' | 'reminder';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Widget live' },
  { key: 'badge', label: 'Partner badge' },
  { key: 'email', label: 'Gets monthly email' },
  { key: 'reminder', label: 'Reminder due' },
  { key: 'none', label: 'No widget yet' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const COUNT_COLS: { key: keyof Counts; label: string }[] = [
  { key: 'invite_visit', label: 'Visits' }, { key: 'profile_view', label: 'Views' }, { key: 'register_start', label: 'Sign-up starts' },
  { key: 'register_complete', label: 'New teachers' }, { key: 'existing_signin', label: 'Existing teachers' }, { key: 'profile_complete', label: 'Profiles done' },
];
const REASONS: Record<string, string> = {
  no_widget: 'Widget not on own website', opted_out: 'Owner turned off partner emails', no_email: 'No owner email', closed: 'Venue closed',
};
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
function reminderText(r: Row['reminder']): string {
  switch (r.state) {
    case 'sent': return `Sent${r.sent_at ? ` ${fmtDay(Date.parse(r.sent_at))}` : ''}`;
    case 'due': return 'Due now';
    case 'waiting': return r.due_at ? `Due ${fmtDay(r.due_at)}` : 'Waiting';
    case 'widget_live': return 'Not needed (widget live)';
    case 'not_published': return 'After publishing';
    case 'opted_out': return 'Owner turned off partner emails';
    case 'no_email': return 'No owner email';
    default: return r.state;
  }
}
const LANG_LINKS = [{ code: 'en', label: 'EN' }, { code: 'hi', label: 'हिन्दी' }] as const;

function ago(ms: number | null): string {
  if (!ms) return '';
  const d = Math.floor((Date.now() - ms) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}
const monthLabel = (m: string | null) => (m ? new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '');
const sum = (rows: Row[], k: keyof Counts) => rows.reduce((n, r) => n + (r.counts?.[k] || 0), 0);
const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50';

export default function VenuePartnerOverview({ initial }: { initial: OverviewData }) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; name: string } | null>(null);
  const m = data.monthly;

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (s && !`${r.name} ${r.city || ''}`.toLowerCase().includes(s)) return false;
      if (filter === 'live') return r.widget.live;
      if (filter === 'badge') return r.badge;
      if (filter === 'email') return !r.email.not_eligible;
      if (filter === 'reminder') return r.reminder.state === 'due';
      if (filter === 'none') return !r.widget.live;
      return true;
    });
  }, [data.rows, filter, q]);

  const kpis = [
    { label: 'Venues with a toolkit', value: data.rows.filter((r) => r.code).length },
    { label: 'Widgets live', value: data.rows.filter((r) => r.widget.live).length },
    { label: 'Partner badges', value: data.rows.filter((r) => r.badge).length },
    { label: 'Get monthly email', value: data.rows.filter((r) => !r.email.not_eligible).length },
    { label: 'Invitation visits', value: sum(data.rows, 'invite_visit') },
    { label: 'New teachers', value: sum(data.rows, 'register_complete') },
    { label: 'Existing teachers', value: sum(data.rows, 'existing_signin') },
  ];

  async function refresh() {
    const r = await getBff<OverviewData>('/bff/admin/venue-growth/monthly?view=overview');
    if (r.ok && r.data?.rows) setData(r.data);
  }

  async function runNow() {
    if (!window.confirm(`Send the ${m.default_month_label} activity email to every eligible venue owner now? Venues already sent are skipped.`)) return;
    setBusy('run');
    setMsg(null);
    const r = await sendBff<Run & { error?: string }>('/bff/admin/venue-growth/monthly', 'POST', { action: 'run', type: 'monthly' });
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not send the monthly emails.' });
    const skipped = r.data.preview_skipped ? ` · ${r.data.preview_skipped} real owner${r.data.preview_skipped === 1 ? '' : 's'} skipped in this preview` : '';
    setMsg({ ok: true, text: `${m.default_month_label}: ${r.data.sent} sent · ${r.data.already} already sent · ${r.data.skipped} not eligible · ${r.data.failed} failed${skipped}.` });
    refresh();
  }

  async function runReminders() {
    if (!window.confirm(`Send the widget reminder to all ${dueCount} venue owners it is due for now? Each owner only ever gets one.`)) return;
    setBusy('reminders');
    setMsg(null);
    const r = await sendBff<ReminderRun & { error?: string }>('/bff/admin/venue-growth/monthly', 'POST', { action: 'run', type: 'reminder' });
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not send the reminders.' });
    const skipped = r.data.preview_skipped ? ` · ${r.data.preview_skipped} real owner${r.data.preview_skipped === 1 ? '' : 's'} skipped in this preview` : '';
    setMsg({ ok: true, text: `Widget reminders: ${r.data.sent} sent · ${r.data.already} already sent · ${r.data.failed} failed${skipped}.` });
    refresh();
  }

  async function showPreview(row: Row, type: EmailType) {
    setBusy(`p:${type}:${row.id}`);
    const r = await getBff<{ subject: string; html: string; error?: string }>(`/bff/admin/venue-growth/monthly?view=preview&type=${type}&venue_id=${encodeURIComponent(row.id)}`);
    setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not build the preview.' });
    setPreview({ subject: r.data.subject, html: r.data.html, name: row.name });
  }

  async function sendTest(row: Row, type: EmailType) {
    setBusy(`t:${type}:${row.id}`);
    setMsg(null);
    const r = await sendBff<{ to?: string; error?: string }>('/bff/admin/venue-growth/monthly', 'POST', { action: 'test', type, venue_id: row.id });
    setBusy('');
    const what = type === 'reminder' ? 'widget reminder' : 'monthly email';
    setMsg(r.ok ? { ok: true, text: `Test ${what} for ${row.name} sent to ${r.data?.to}.` } : { ok: false, text: r.data?.error || 'Could not send the test email.' });
  }

  const dueCount = data.rows.filter((r) => r.reminder.state === 'due').length;

  return (
    <div className="mt-6 space-y-5" data-testid="venue-partner-overview">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-3.5" data-testid={`vp-kpi-${k.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <p className="text-2xl font-black tabular-nums text-brand-700">{k.value}</p>
            <p className="mt-0.5 text-[11px] font-bold leading-tight text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-4 sm:p-5" data-testid="vp-monthly">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-ink">📬 Monthly activity email</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft" data-testid="vp-monthly-schedule">
              {m.auto_enabled
                ? `Sent automatically on the 1st of each month at 09:00 IST to owners whose widget is live on their own website. Next: ${fmtDate(m.next_auto_run)}.`
                : 'Automatic sending is off in this preview, so test owners are never emailed by accident. Use “Send now” to try it here; it runs automatically once deployed.'}
            </p>
          </div>
          <button type="button" onClick={runNow} disabled={!!busy} className="min-h-[44px] shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="vp-run-now">
            {busy === 'run' ? 'Sending…' : `Send ${m.default_month_label} emails now`}
          </button>
        </div>
        {m.runs.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink-soft" data-testid="vp-runs">
            {m.runs.map((r) => (
              <li key={r.started_at}>
                <span className="font-bold text-ink">{monthLabel(r.month)}</span> · {r.trigger === 'auto' ? 'automatic' : 'sent by an admin'} on {fmtDate(r.started_at)} — {r.sent} sent, {r.already} already sent, {r.skipped} not eligible, {r.failed} failed
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="vp-reminders">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-ink">🔔 Widget install reminder</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft" data-testid="vp-reminder-schedule">
              One gentle email per venue, ever, two weeks after it is published if its widget still isn’t live. Owners without a
              website get a version about WhatsApp sharing and posters.{' '}
              {m.auto_enabled
                ? 'Checked automatically every 30 minutes between 09:00 and 20:00 IST.'
                : 'Automatic sending is off in this preview; use the button to try it here.'}
            </p>
            <p className="mt-1 text-xs font-bold text-ink" data-testid="vp-reminder-due">{dueCount} due now</p>
          </div>
          <button type="button" onClick={runReminders} disabled={!!busy || dueCount === 0} className="min-h-[44px] shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="vp-reminders-run">
            {busy === 'reminders' ? 'Sending…' : 'Send due reminders now'}
          </button>
        </div>
        {m.reminder_runs?.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink-soft" data-testid="vp-reminder-runs">
            {m.reminder_runs.map((r) => (
              <li key={r.started_at}>
                {r.trigger === 'auto' ? 'Automatic' : 'Sent by an admin'} on {fmtDate(r.started_at)} — {r.sent} sent, {r.already} already sent, {r.failed} failed
              </li>
            ))}
          </ul>
        )}
      </section>

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} data-testid="vp-message">{msg.text}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter venues">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === f.key ? 'bg-ink text-white' : 'border border-line bg-white text-ink-soft hover:bg-cream'}`}
              data-testid={`vp-filter-${f.key}`}>
              {f.label}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venue or city" aria-label="Search venues"
          className="ml-auto min-h-[40px] w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand sm:w-64" data-testid="vp-search" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[980px] text-left text-sm" data-testid="vp-table">
          <thead className="border-b border-line bg-cream/50 text-[11px] font-black uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2.5">Venue</th>
              <th className="px-3 py-2.5">Widget</th>
              <th className="px-3 py-2.5">Badge</th>
              <th className="px-3 py-2.5">Invitation counts (this month in green)</th>
              <th className="px-3 py-2.5">Partner emails</th>
              <th className="px-3 py-2.5">Posters</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">No venues match.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top" data-testid={`vp-row-${r.id}`}>
                <td className="px-3 py-3">
                  <p className="font-extrabold text-ink">{r.name}</p>
                  <p className="text-xs text-muted">{[r.city, r.country].filter(Boolean).join(', ') || '—'}</p>
                  <span className="mt-1 inline-flex rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink-soft">{r.status_label}</span>
                </td>
                <td className="px-3 py-3 text-xs" data-testid={`vp-widget-${r.id}`}>
                  {r.widget.live ? (
                    <>
                      <p className="font-bold text-emerald-700">● Live on {r.widget.host}</p>
                      <p className="text-muted">Last seen {ago(r.widget.seen_at)}</p>
                      <p className={r.widget.on_own_site ? 'text-emerald-700' : 'text-amber-700'}>
                        {r.widget.on_own_site ? 'Own website ✓' : r.website_host ? `Not ${r.website_host}` : 'No website listed'}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">{r.code ? 'Not installed' : 'Toolkit not opened yet'}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-xs" data-testid={`vp-badge-${r.id}`}>
                  {r.badge ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-800">🤝 Active</span> : <span className="text-muted">—</span>}
                </td>
                <td className="px-3 py-3">
                  {r.counts ? (
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs" data-testid={`vp-counts-${r.id}`}>
                      {COUNT_COLS.map((c) => (
                        <div key={c.key}>
                          <span className="font-black tabular-nums text-ink">{r.counts?.[c.key] ?? 0}</span>
                          {!!r.month_counts?.[c.key] && <span className="ml-1 font-bold text-emerald-700">+{r.month_counts[c.key]}</span>}
                          <span className="block text-[10px] leading-tight text-muted">{c.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs" data-testid={`vp-email-${r.id}`}>
                  <p className="text-[10px] font-black uppercase tracking-wide text-muted">Monthly summary</p>
                  {r.email.not_eligible ? (
                    <p className="text-muted">{REASONS[r.email.not_eligible] || r.email.not_eligible}</p>
                  ) : (
                    <p className="font-bold text-emerald-700">Gets the monthly email</p>
                  )}
                  {r.email.last_sent && <p className="text-muted">Last sent: {monthLabel(r.email.last_sent)}</p>}
                  {r.status !== 'closed' && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button type="button" className={btn} disabled={!!busy} onClick={() => showPreview(r, 'monthly')} data-testid={`vp-preview-${r.id}`}>
                        {busy === `p:monthly:${r.id}` ? '…' : 'Preview'}
                      </button>
                      <button type="button" className={btn} disabled={!!busy} onClick={() => sendTest(r, 'monthly')} data-testid={`vp-test-${r.id}`}>
                        {busy === `t:monthly:${r.id}` ? 'Sending…' : 'Send test to me'}
                      </button>
                    </div>
                  )}
                  <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-muted">Widget reminder · {r.reminder.variant === 'widget' ? 'website' : 'no website'}</p>
                  <p className={r.reminder.state === 'due' ? 'font-bold text-amber-700' : r.reminder.state === 'sent' ? 'font-bold text-emerald-700' : 'text-muted'} data-testid={`vp-reminder-${r.id}`} data-state={r.reminder.state}>
                    {reminderText(r.reminder)}
                  </p>
                  {r.status !== 'closed' && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button type="button" className={btn} disabled={!!busy} onClick={() => showPreview(r, 'reminder')} data-testid={`vp-reminder-preview-${r.id}`}>
                        {busy === `p:reminder:${r.id}` ? '…' : 'Preview'}
                      </button>
                      <button type="button" className={btn} disabled={!!busy} onClick={() => sendTest(r, 'reminder')} data-testid={`vp-reminder-test-${r.id}`}>
                        {busy === `t:reminder:${r.id}` ? 'Sending…' : 'Send test to me'}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  <div className="flex flex-col gap-2">
                    {(['teachers', 'guests'] as const).map((a) => (
                      <div key={a}>
                        <p className="mb-1 font-bold text-ink-soft">{a === 'teachers' ? 'For teachers' : 'For guests'}</p>
                        <div className="flex gap-1.5">
                          {LANG_LINKS.map((l) => (
                            <a key={l.code} className={btn} lang={l.code} href={`/bff/admin/venue-growth/poster.pdf?venue_id=${encodeURIComponent(r.id)}&audience=${a}&lang=${l.code}&inline=1`} target="_blank" rel="noopener" data-testid={`vp-poster-${a}-${l.code}-${r.id}`}>
                              {l.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Email preview" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="vp-preview-modal">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Preview · {preview.name}</p>
                <p className="mt-0.5 text-sm font-black text-ink" data-testid="vp-preview-subject">{preview.subject}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-bold text-ink-soft hover:bg-cream" data-testid="vp-preview-close">Close</button>
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[60vh] w-full bg-white" data-testid="vp-preview-frame" />
          </div>
        </div>
      )}
    </div>
  );
}
