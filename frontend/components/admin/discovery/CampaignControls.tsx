'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Per-campaign controls: start (run job), pause, resume, stop. Enable/disable
// map to active/paused.
export default function CampaignControls({ id, status, paused }: { id: string; status: string; paused?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patch(next: string) {
    setErr(null); setBusy(next);
    const r = await sendBff(`/bff/admin/discovery/campaigns/${id}`, 'PATCH', { status: next });
    setBusy(null);
    if (!r.ok) { setErr(r.data?.error || 'Failed.'); return; }
    router.refresh();
  }
  async function run() {
    setErr(null); setBusy('run');
    const r = await sendBff(`/bff/admin/discovery/campaigns/${id}/run`, 'POST', {});
    setBusy(null);
    if (!r.ok) { setErr(r.data?.error || 'Could not start.'); return; }
    // Give the background job a moment, then refresh stats.
    setTimeout(() => router.refresh(), 1500);
  }

  const btn = 'rounded-md px-2.5 py-1 text-[12px] font-bold disabled:opacity-50';
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {(status === 'active' && !paused) && (
        <button type="button" onClick={run} disabled={!!busy} className={`${btn} bg-brand text-white hover:bg-brand-600`} data-testid="campaign-run">{busy === 'run' ? 'Starting…' : 'Start'}</button>
      )}
      {status === 'active' && (
        <button type="button" onClick={() => patch('paused')} disabled={!!busy} className={`${btn} border border-line bg-white text-ink-soft hover:border-brand`} data-testid="campaign-pause">Pause</button>
      )}
      {(status === 'paused' || status === 'completed') && (
        <button type="button" onClick={() => patch('active')} disabled={!!busy} className={`${btn} border border-line bg-white text-ink-soft hover:border-brand`} data-testid="campaign-resume">Resume</button>
      )}
      {status !== 'stopped' && (
        <button type="button" onClick={() => patch('stopped')} disabled={!!busy} className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`} data-testid="campaign-stop">Stop</button>
      )}
      {status === 'stopped' && (
        <button type="button" onClick={() => patch('active')} disabled={!!busy} className={`${btn} border border-line bg-white text-ink-soft hover:border-brand`} data-testid="campaign-reopen">Reopen</button>
      )}
      {err && <span className="text-[11px] font-bold text-red-600">{err}</span>}
    </span>
  );
}
