'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBff, postBff, sendBff } from '@/lib/auth-client';
import type { MonitorEvent, MonitorList } from '@/lib/server/monitoring-admin';

const KIND: Record<string, { label: string; tone: string }> = {
  payment: { label: 'Payment', tone: 'bg-red-50 text-red-700' },
  page: { label: 'Page', tone: 'bg-amber-50 text-amber-700' },
  server: { label: 'Server', tone: 'bg-accent-50 text-accent-600' },
  email: { label: 'Email', tone: 'bg-brand-50 text-brand-700' },
};
const when = (iso?: string) => (iso || '').replace('T', ' ').replace(/\+00:00$/, ' UTC');
const CARDS: { key: string; label: string }[] = [
  { key: 'payment', label: 'Payment problems' },
  { key: 'page', label: 'Page errors' },
  { key: 'server', label: 'Server errors' },
  { key: 'email', label: 'Email failures' },
];
const pill = (on: boolean) => (on ? 'rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white' : 'rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-brand-50');

function Row({ e, onToggle }: { e: MonitorEvent; onToggle: (e: MonitorEvent) => void }) {
  const [open, setOpen] = useState(false);
  const k = KIND[e.kind] || KIND.server;
  return (
    <li className="rounded-2xl border border-line bg-white p-4" data-testid={`monitor-row-${e.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${k.tone}`}>{k.label}</span>
            <span className="break-all font-mono text-xs text-ink-soft">{e.path || e.source}</span>
          </div>
          <p className="mt-1 break-words font-bold text-ink">{e.message}</p>
          <p className="mt-1 text-xs text-muted">
            ×{e.count} · last {when(e.last_at)} · first {when(e.first_at)} · {e.source}
            {e.alert_status ? ` · alert ${e.alert_status}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-[40px] rounded-xl border border-line px-3 text-xs font-bold text-ink-soft hover:bg-cream" aria-expanded={open}>
            {open ? 'Hide details' : 'Details'}
          </button>
          <button type="button" onClick={() => onToggle(e)} className="min-h-[40px] rounded-xl bg-brand px-3 text-xs font-bold text-white hover:bg-brand-600" data-testid={`monitor-toggle-${e.id}`}>
            {e.status === 'open' ? 'Mark resolved' : 'Reopen'}
          </button>
        </div>
      </div>
      {open && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {[...(e.samples || [])].reverse().map((s, i) => (
            <li key={i} className="rounded-lg bg-cream/60 p-2 font-mono text-[11px] text-ink-soft">
              {Object.entries(s).map(([k2, v]) => (
                <div key={k2} className="whitespace-pre-wrap break-all">
                  <span className="text-muted">{k2}:</span> {String(v ?? '—')}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ErrorMonitorList({ initial }: { initial: MonitorList }) {
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('');
  const [data, setData] = useState<MonitorList>(initial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const first = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status });
    if (kind) qs.set('kind', kind);
    const r = await getBff<MonitorList>(`/bff/admin/monitoring/events?${qs}`);
    if (r.ok && Array.isArray(r.data?.items)) setData(r.data);
    setLoading(false);
  }, [status, kind]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    load();
  }, [load]);

  const toggle = async (e: MonitorEvent) => {
    const next = e.status === 'open' ? 'resolved' : 'open';
    const { ok, data: d } = await sendBff<any>(`/bff/admin/monitoring/events/${e.id}`, 'PATCH', { status: next });
    if (ok) load(); // refresh the list AND the open counters
    else setMsg(d?.error || 'Could not update.');
  };

  const testAlert = async () => {
    setTesting(true);
    setMsg('');
    const { ok, data: d } = await postBff<any>('/bff/admin/monitoring/test-alert', {});
    setTesting(false);
    setMsg(d?.alert_status === 'preview_test_log' ? 'Preview: the test alert was kept in the test log (a preview never emails alerts).' : ok ? `Test alert sent to ${d?.to}.` : d?.alert_status === 'failed' || d?.error ? `Test alert could not be emailed (${d?.error || 'email service error'}). It is still listed below.` : 'Could not send the test alert.');
    load();
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="monitor-cards">
        {CARDS.map((c) => {
          const n = data.open_by_kind?.[c.key] || 0;
          return (
            <div key={c.key} className="rounded-2xl border border-line bg-white p-4">
              <p className={`text-2xl font-black tabular-nums ${n > 0 ? 'text-red-600' : 'text-ink'}`} data-testid={`monitor-count-${c.key}`}>{n}</p>
              <p className="text-xs font-semibold text-muted">{c.label} · open</p>
            </div>
          );
        })}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" data-testid="monitor-filters">
          {['open', 'resolved', 'all'].map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={pill(status === s)} data-testid={`monitor-filter-${s}`}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="mx-1 w-px bg-line" aria-hidden />
          {['', 'payment', 'page', 'server', 'email'].map((k) => (
            <button key={k || 'any'} type="button" onClick={() => setKind(k)} className={pill(kind === k)} data-testid={`monitor-kind-${k || 'any'}`}>
              {k ? KIND[k].label : 'All types'}
            </button>
          ))}
        </div>
        <button type="button" onClick={testAlert} disabled={testing} className="min-h-[40px] rounded-xl border border-line px-3 text-sm font-bold text-brand-700 hover:bg-cream disabled:opacity-50" data-testid="monitor-test-alert">
          {testing ? 'Sending…' : 'Send test alert'}
        </button>
      </div>
      {msg && <p className="mb-3 rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-ink-soft" role="status" data-testid="monitor-msg">{msg}</p>}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted" data-testid="monitor-empty">
          No {status === 'all' ? '' : status} problems{kind ? ` of this type` : ''}. 🎉
        </p>
      ) : (
        <ul className="space-y-2" data-testid="monitor-list">
          {data.items.map((e) => <Row key={e.id} e={e} onToggle={toggle} />)}
        </ul>
      )}
    </div>
  );
}
