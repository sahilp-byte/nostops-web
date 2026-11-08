'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

const STATES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'PRE_LAUNCH', label: 'Pre-launch', hint: 'Hidden from teachers until you go live.' },
  { key: 'ACTIVE', label: 'Active', hint: 'Open for discussions and replies.' },
  { key: 'CLOSING_SOON', label: 'Closing soon', hint: 'Shows a banner; you can still allow or stop new discussions.' },
  { key: 'ARCHIVED', label: 'Archived', hint: 'Read-only. Content preserved. No new posts.' },
];

function toDateInput(ms?: number) { if (!ms) return ''; const d = new Date(ms); return d.toISOString().slice(0, 10); }
function toMs(v: string) { return v ? new Date(v + 'T00:00:00Z').getTime() : undefined; }

export default function LifecycleForm({ config }: { config: { status: string; allow_new_threads: boolean; public_read?: boolean; launch_date: number; close_date: number } }) {
  const router = useRouter();
  const [status, setStatus] = useState(config.status);
  const [allow, setAllow] = useState(!!config.allow_new_threads);
  const [pub, setPub] = useState(!!config.public_read);
  const [launch, setLaunch] = useState(toDateInput(config.launch_date));
  const [close, setClose] = useState(toDateInput(config.close_date));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    const r = await sendBff('/bff/admin/pulse/config', 'PATCH', {
      status, allow_new_threads: allow, public_read: pub, launch_date: toMs(launch), close_date: toMs(close),
    });
    setBusy(false);
    if (r.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Experiment lifecycle</h2>
        <p className="mt-1 text-sm text-muted">A three-month listening experiment. Content is always preserved — archiving never deletes anything.</p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STATES.map((s) => (
            <button key={s.key} onClick={() => setStatus(s.key)} data-testid={`lifecycle-${s.key}`} className={`rounded-xl border p-3 text-left transition ${status === s.key ? 'border-brand bg-brand-50' : 'border-line bg-white hover:bg-cream'}`}>
              <span className="block text-sm font-extrabold text-ink">{s.label}</span>
              <span className="block text-xs text-muted">{s.hint}</span>
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-xl border border-line px-4 py-3">
          <input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} className="h-4 w-4 accent-[#0D9488]" />
          <span className="text-sm font-semibold text-ink">Allow new discussions</span>
          <span className="text-xs text-muted">Turn off to keep replies open but stop new threads.</span>
        </label>

        <div className="mt-4 rounded-xl border border-line px-4 py-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} data-testid="lifecycle-public" className="h-4 w-4 accent-[#0D9488]" />
            <span className="text-sm font-semibold text-ink">Make discussions public</span>
          </label>
          <p className="mt-1.5 pl-7 text-xs text-muted">
            When on, discussions you mark <span className="font-bold text-ink-soft">Featured</span> appear publicly as a title + short
            snippet, and are published to RSS. Full reading &amp; replying still require sign-in. Reversible anytime.
          </p>
          {pub && (
            <p className="mt-1.5 pl-7 text-xs text-brand-700">
              📡 Public RSS feed: <a href="/teacher-pulse/feed.xml" className="font-bold underline">/teacher-pulse/feed.xml</a>
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Launch date</label>
            <input type="date" value={launch} onChange={(e) => setLaunch(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Closing date</label>
            <input type="date" value={close} onChange={(e) => setClose(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={busy} data-testid="lifecycle-save" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? 'Saving…' : 'Save settings'}</button>
          {saved && <span className="text-sm font-bold text-emerald-700" data-testid="pulse-settings-saved">✓ Saved</span>}
        </div>
      </div>

      {/* Export */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Export data</h2>
        <p className="mt-1 text-sm text-muted">NOSTOPS owns 100% of this data. Export anytime to preserve insights — before or after archiving.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {['threads', 'posts', 'members'].map((type) => (
            <div key={type} className="rounded-xl border border-line p-3">
              <p className="text-sm font-extrabold capitalize text-ink">{type}</p>
              <div className="mt-2 flex gap-2">
                <a href={`/bff/admin/pulse/export?type=${type}&format=csv`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">CSV</a>
                <a href={`/bff/admin/pulse/export?type=${type}&format=json`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">JSON</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
