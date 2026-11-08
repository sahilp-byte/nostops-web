'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { getBff, sendBff } from '@/lib/auth-client';
import { widgetApi } from '@/lib/venue-growth-client';

type Copy = { eyebrow: string; title: string; body: string; button: string; secondary?: string };
type Cfg = {
  brand: { name: string; tagline: string };
  colors: { accent: string; text: string; muted: string; background: string };
  font: 'serif' | 'system';
  layout: { radius: number; max_width: number };
  listed: Copy;
  teacher: Copy;
  pending: Copy;
  destinations: { teacher_signup: string; venues: string };
};
type History = { version: number; created_at?: string; created_by?: string; note?: string };
export type WidgetSettingsInitial = { version: number; config: Cfg; defaults: Cfg; updated_at?: string | null; history: History[] };

const LIMITS: Record<string, number> = { eyebrow: 40, title: 90, body: 320, button: 40, secondary: 50, name: 30, tagline: 80 };
const COPY_GROUPS: { key: 'listed' | 'teacher' | 'pending'; title: string; hint: string }[] = [
  { key: 'teacher', title: 'Widget 2 · Yoga Teacher Collaboration', hint: 'Published venues · main call to action for teachers.' },
  { key: 'listed', title: 'Widget 1 · Listed on NOSTOPS', hint: 'Published venues.' },
  { key: 'pending', title: 'General invitation', hint: 'Shown by both widgets until a venue is published. Never names the venue.' },
];
const COLORS: { key: keyof Cfg['colors']; label: string }[] = [
  { key: 'accent', label: 'Accent (buttons)' }, { key: 'text', label: 'Heading text' }, { key: 'muted', label: 'Body text' }, { key: 'background', label: 'Background' },
];
const PREVIEWS: { id: string; kind: 'listed' | 'teacher'; state: 'published' | 'pending'; label: string }[] = [
  { id: 'teacher', kind: 'teacher', state: 'published', label: 'Yoga Teacher Collaboration · published venue' },
  { id: 'listed', kind: 'listed', state: 'published', label: 'Listed on NOSTOPS · published venue' },
  { id: 'pending', kind: 'teacher', state: 'pending', label: 'Either widget · venue not published yet' },
];

const inputCls = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelCls = 'block text-xs font-extrabold text-ink-soft';
const clone = (c: Cfg): Cfg => JSON.parse(JSON.stringify(c));

function fmt(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function Text({ label, value, max, multiline, onChange, testid }: { label: string; value: string; max: number; multiline?: boolean; onChange: (v: string) => void; testid: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label} <span className="font-semibold text-muted">({value.length}/{max})</span></span>
      {multiline ? (
        <textarea className={`${inputCls} min-h-[84px] resize-y`} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
      ) : (
        <input className={inputCls} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
      )}
    </label>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <legend className="px-1 text-sm font-black text-ink">{title}</legend>
      {hint && <p className="-mt-1 mb-3 text-xs text-muted">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

// Admin editor for the ONE shared widget configuration. Previews use the real embed
// script's renderer, so what you see here is exactly what installed widgets show.
export default function VenueWidgetSettings({ initial }: { initial: WidgetSettingsInitial }) {
  const [live, setLive] = useState({ version: initial.version, config: initial.config, updated_at: initial.updated_at });
  const [draft, setDraft] = useState<Cfg>(() => clone(initial.config));
  const [history, setHistory] = useState<History[]>(initial.history);
  const [note, setNote] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(live.config);

  useEffect(() => {
    const api = widgetApi();
    if (!ready || !api) return;
    for (const p of PREVIEWS) {
      const el = refs.current[p.id];
      if (el) api.render(el, { state: p.state, config: draft, config_version: live.version }, p.kind, null);
    }
  }, [ready, draft, live.version]);

  const set = (fn: (c: Cfg) => void) => setDraft((cur) => { const n = clone(cur); fn(n); return n; });

  async function publish() {
    setBusy(true);
    setMsg(null);
    const r = await sendBff<{ version?: number; config?: Cfg; error?: string }>('/bff/admin/venue-growth/config', 'PUT', { config: draft, note });
    setBusy(false);
    if (!r.ok || !r.data?.config) {
      setMsg({ ok: false, text: r.data?.error || 'Could not publish the change.' });
      return;
    }
    setLive({ version: r.data.version || live.version + 1, config: r.data.config, updated_at: new Date().toISOString() });
    setDraft(clone(r.data.config));
    setNote('');
    setMsg({ ok: true, text: `Version ${r.data.version} is live on every installed widget.` });
    const h = await getBff<{ history?: History[] }>('/bff/admin/venue-growth/config');
    if (h.ok && h.data?.history) setHistory(h.data.history);
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start" data-testid="venue-widget-settings">
      <Script src="/widgets/venue.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/20 bg-brand-50/50 p-4 text-sm">
          <span className="font-black text-ink" data-testid="vw-version">Live version {live.version}</span>
          <span className="text-muted">· updated {fmt(live.updated_at)}</span>
          <a href="/widgets/demo" target="_blank" rel="noopener" className="ml-auto font-bold text-brand-700 hover:underline" data-testid="vw-demo-link">Open test page (preview only) ↗</a>
        </div>

        <Group title="Brand">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Name" value={draft.brand.name} max={LIMITS.name} onChange={(v) => set((c) => { c.brand.name = v; })} testid="vw-brand-name" />
            <Text label="Tagline" value={draft.brand.tagline} max={LIMITS.tagline} onChange={(v) => set((c) => { c.brand.tagline = v; })} testid="vw-brand-tagline" />
          </div>
        </Group>

        <Group title="Design">
          <div className="grid gap-3 sm:grid-cols-2">
            {COLORS.map((k) => (
              <label key={k.key} className="block">
                <span className={labelCls}>{k.label}</span>
                <span className="mt-1 flex items-center gap-2">
                  <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(draft.colors[k.key]) ? draft.colors[k.key] : '#000000'} onChange={(e) => set((c) => { c.colors[k.key] = e.target.value.toUpperCase(); })} className="h-10 w-12 shrink-0 cursor-pointer rounded border border-line bg-white" aria-label={`${k.label} colour picker`} />
                  <input className={`${inputCls} mt-0 font-mono uppercase`} value={draft.colors[k.key]} maxLength={7} onChange={(e) => set((c) => { c.colors[k.key] = e.target.value; })} data-testid={`vw-color-${k.key}`} />
                </span>
              </label>
            ))}
            <label className="block">
              <span className={labelCls}>Font</span>
              <select className={inputCls} value={draft.font} onChange={(e) => set((c) => { c.font = e.target.value as Cfg['font']; })} data-testid="vw-font">
                <option value="serif">Classic serif</option>
                <option value="system">Clean sans-serif</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Corner roundness: {draft.layout.radius}px</span>
              <input type="range" min={0} max={28} value={draft.layout.radius} onChange={(e) => set((c) => { c.layout.radius = Number(e.target.value); })} className="mt-3 w-full accent-brand" data-testid="vw-radius" />
            </label>
            <label className="block">
              <span className={labelCls}>Maximum width: {draft.layout.max_width}px</span>
              <input type="range" min={320} max={960} step={20} value={draft.layout.max_width} onChange={(e) => set((c) => { c.layout.max_width = Number(e.target.value); })} className="mt-3 w-full accent-brand" data-testid="vw-width" />
            </label>
          </div>
        </Group>

        {COPY_GROUPS.map((g) => (
          <Group key={g.key} title={g.title} hint={g.hint}>
            {(Object.keys(draft[g.key]) as (keyof Copy)[]).map((f) => (
              <Text
                key={f}
                label={f === 'secondary' ? 'Second button' : f === 'button' ? 'Main button' : f[0].toUpperCase() + f.slice(1)}
                value={draft[g.key][f] || ''}
                max={LIMITS[f]}
                multiline={f === 'body'}
                onChange={(v) => set((c) => { c[g.key][f] = v; })}
                testid={`vw-${g.key}-${f}`}
              />
            ))}
          </Group>
        ))}

        <Group title="Where buttons lead" hint="NOSTOPS pages only (for example /join). Published venues always open their own listing.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={labelCls}>Teacher sign-up page</span><input className={`${inputCls} font-mono`} value={draft.destinations.teacher_signup} maxLength={81} onChange={(e) => set((c) => { c.destinations.teacher_signup = e.target.value; })} data-testid="vw-dest-signup" /></label>
            <label className="block"><span className={labelCls}>General venues page</span><input className={`${inputCls} font-mono`} value={draft.destinations.venues} maxLength={81} onChange={(e) => set((c) => { c.destinations.venues = e.target.value; })} data-testid="vw-dest-venues" /></label>
          </div>
        </Group>

        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <label className="block">
            <span className={labelCls}>What changed? (optional, for the history)</span>
            <input className={inputCls} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Warmer wording for teachers" data-testid="vw-note" />
          </label>
          {msg && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} data-testid="vw-message">{msg.text}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={publish} disabled={!dirty || busy} className="min-h-[44px] rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="vw-publish">
              {busy ? 'Publishing…' : 'Publish to all widgets'}
            </button>
            <button type="button" onClick={() => { setDraft(clone(live.config)); setMsg(null); }} disabled={!dirty || busy} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50" data-testid="vw-discard">
              Discard changes
            </button>
            <button type="button" onClick={() => { setDraft(clone(initial.defaults)); setMsg(null); }} disabled={busy} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50" data-testid="vw-defaults">
              Use original wording
            </button>
          </div>
          {dirty && <p className="mt-2 text-xs font-semibold text-amber-700" data-testid="vw-unsaved">Unpublished changes — installed widgets still show version {live.version}.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="vw-history">
          <p className="text-sm font-black text-ink">History</p>
          {history.length === 0 ? (
            <p className="mt-2 text-xs text-muted">No changes published yet — widgets use the original wording.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {history.map((h) => (
                <li key={h.version} className="flex flex-wrap gap-x-3 py-2">
                  <span className="font-black text-ink">v{h.version}</span>
                  <span className="text-muted">{fmt(h.created_at)}</span>
                  <span className="text-ink-soft">{h.created_by || 'admin'}</span>
                  {h.note && <span className="w-full text-xs text-ink-soft">{h.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6" aria-label="Live preview">
        <p className="text-xs font-black uppercase tracking-wider text-muted">Live preview {dirty ? '(unpublished draft)' : `(version ${live.version})`}</p>
        {PREVIEWS.map((p) => (
          <div key={p.id} className="rounded-2xl border border-dashed border-line bg-cream/40 p-3">
            <p className="mb-2 text-[11px] font-bold text-muted">{p.label}</p>
            <div ref={(el) => { refs.current[p.id] = el; }} data-testid={`vw-preview-${p.id}`} />
          </div>
        ))}
      </aside>
    </div>
  );
}
