'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Embeds } from '@/lib/server/widgets';

function previewHeight(id: string): number {
  if (id === 'reviews') return 360;
  if (id.startsWith('badge')) return 72;
  return 220;
}

// Website-embed gallery — the backend-owned copy-paste widgets
// (GET /teachers/me/embeds). Empanelled-only; non-empanelled teachers see an
// honest upgrade prompt (never a fake/locked-but-clickable card).
export default function EmbedGallery({ embeds, forbidden }: { embeds: Embeds; forbidden: boolean }) {
  const [cat, setCat] = useState('All');
  const [mode, setMode] = useState<Record<string, 'iframe' | 'snippet'>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const cats = useMemo(() => ['All', ...(embeds?.categories || [])], [embeds]);
  const visible = useMemo(
    () => (embeds?.widgets || []).filter((w) => cat === 'All' || w.category === cat),
    [embeds, cat],
  );

  if (forbidden || !embeds) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center">
        <span className="text-3xl">🔒</span>
        <p className="mt-2 text-base font-extrabold text-ink">Website badges are for Empanelled Teachers</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
          Embeddable badges, a reviews showcase and Mission widgets unlock once you&apos;re empanelled by the Council of Gurus.
        </p>
        <Link href="/app/teacher/empanelment" className="mt-4 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          View empanelment paths →
        </Link>
      </div>
    );
  }

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${cat === c ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft hover:bg-cream'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((w) => {
          const m = mode[w.id] || 'iframe';
          const code = m === 'iframe' ? w.iframe : w.snippet;
          return (
            <div key={w.id} className="rounded-2xl border border-line bg-white p-4" data-testid={`embed-${w.id}`}>
              <p className="text-sm font-extrabold text-ink">{w.title}</p>
              <p className="mt-0.5 text-xs text-muted">{w.description}</p>

              <div className="mt-3 overflow-hidden rounded-xl border border-line bg-cream/40">
                <p className="border-b border-line px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Live preview</p>
                {w.previewSrc ? (
                  <iframe src={w.previewSrc} title={w.title} width="100%" height={previewHeight(w.id)} style={{ border: 'none', background: '#FAFAF7' }} />
                ) : (
                  <div className="p-6 text-center text-xs text-muted">Preview unavailable</div>
                )}
              </div>

              <div className="mt-3 flex gap-1.5">
                {(['iframe', 'snippet'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setMode((mm) => ({ ...mm, [w.id]: k }))} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${m === k ? 'bg-ink text-white' : 'bg-cream text-ink-soft'}`}>
                    {k === 'iframe' ? 'iframe (recommended)' : 'Inline HTML'}
                  </button>
                ))}
              </div>
              <pre className="mt-2 max-h-28 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-emerald-300"><code>{code}</code></pre>
              <button type="button" onClick={() => copy(w.id, code)} className="mt-2 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-600" data-testid={`embed-${w.id}-copy`}>
                {copied === w.id ? 'Copied ✓' : `Copy ${m === 'iframe' ? 'iframe' : 'HTML'}`}
              </button>
            </div>
          );
        })}
      </div>
      {embeds.tip && <p className="text-xs text-muted">{embeds.tip}</p>}
    </div>
  );
}
