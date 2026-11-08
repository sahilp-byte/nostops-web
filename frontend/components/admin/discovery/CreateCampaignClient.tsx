'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import type { CityCfg } from '@/lib/server/discovery-admin';

// Create a discovery campaign. City is restricted to the supported list; target
// is configurable (pilot default 100).
export default function CreateCampaignClient({ cities }: { cities: CityCfg[] }) {
  const router = useRouter();
  const [city, setCity] = useState('Navi Mumbai');
  const [target, setTarget] = useState(100);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setErr(null); setBusy(true);
    const r = await sendBff('/bff/admin/discovery/campaigns', 'POST', { city, target });
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error || 'Could not create campaign.'); return; }
    router.refresh();
  }

  async function activateLaunch() {
    setErr(null); setBusy(true);
    const r = await sendBff('/bff/admin/discovery/activate-launch', 'POST', {});
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error || 'Could not activate launch cities.'); return; }
    router.refresh();
  }

  async function dedupe() {
    setErr(null); setMsg(null); setBusy(true);
    const r = await sendBff('/bff/admin/discovery/dedupe', 'POST', {});
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error || 'Could not clean up campaigns.'); return; }
    const n = r.data?.cities_deduped ?? 0;
    setMsg(n === 0 ? 'No duplicates found — one campaign per city already. ✓' : `Merged duplicates for ${n} cit${n === 1 ? 'y' : 'ies'}. ✓`);
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] font-bold text-ink-soft">
          City
          <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 block rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand" data-testid="campaign-city">
            {(cities.length ? cities.map((c) => c.city) : ['Navi Mumbai']).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-[12px] font-bold text-ink-soft">
          Target
          <input type="number" min={1} max={2000} value={target} onChange={(e) => setTarget(parseInt(e.target.value || '0', 10))} className="mt-1 block w-24 rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand" data-testid="campaign-target" />
        </label>
        <button type="button" onClick={create} disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-50" data-testid="campaign-create">
          {busy ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
      {err && <p className="mt-2 text-[13px] font-bold text-red-600" data-testid="campaign-error">{err}</p>}
      {msg && <p className="mt-2 text-[13px] font-bold text-emerald-700" data-testid="dedupe-msg">{msg}</p>}
      <div className="mt-3 border-t border-line/60 pt-3">
        <button type="button" onClick={activateLaunch} disabled={busy} className="rounded-md border border-brand/40 bg-brand-50 px-4 py-2 text-sm font-black text-brand-700 hover:bg-brand-100 disabled:opacity-50" data-testid="activate-launch">
          {busy ? 'Working…' : 'Activate all 9 launch cities (target 100 each)'}
        </button>
        <p className="mt-1 text-[11px] text-muted">Creates one independent campaign per city (Delhi, Gurgaon, Bangalore, Mumbai, Navi Mumbai, Pune, Nashik, Chandigarh, Hyderabad). Each is controlled &amp; measured separately; discovery runs only when you Start a city (needs the Google key).</p>
        <button type="button" onClick={dedupe} disabled={busy} className="mt-3 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft hover:border-brand disabled:opacity-50" data-testid="dedupe-campaigns">
          {busy ? 'Working…' : 'Clean up duplicate campaigns'}
        </button>
        <p className="mt-1 text-[11px] text-muted">Keeps one campaign per city (the one holding the most candidates) and moves any candidates from duplicates onto it. Safe to run any time.</p>
      </div>
    </div>
  );
}
