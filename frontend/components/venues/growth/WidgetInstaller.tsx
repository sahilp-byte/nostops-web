'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { copyText, widgetApi } from '@/lib/venue-growth-client';

type Kind = 'listed' | 'teacher';
const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: 'teacher', label: 'Yoga Teacher Collaboration', hint: 'Invites yoga teachers to explore your venue and create a free profile. Recommended.' },
  { key: 'listed', label: 'Listed on NOSTOPS', hint: 'A simple note that your venue is listed on NOSTOPS.' },
];

// Step 1 of the toolkit: pick a widget, see it live (the real embed script, so the
// preview is exactly what visitors see) and copy the one-time embed code.
export default function WidgetInstaller({ code, scriptUrl, published }: { code: string; scriptUrl: string; published: boolean }) {
  const [kind, setKind] = useState<Kind>('teacher');
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const snippet = `<div class="nostops-venue-widget" data-code="${code}" data-widget="${kind}"></div>\n<script src="${scriptUrl}" async></script>`;

  useEffect(() => {
    const api = widgetApi();
    if (ready && api && preview.current) api.mount(preview.current, code, kind);
  }, [ready, code, kind]);

  async function copy() {
    if (await copyText(snippet)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div data-testid="widget-installer">
      <Script src="/widgets/venue.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Choose a widget">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={kind === k.key}
            onClick={() => setKind(k.key)}
            className={`min-h-[48px] rounded-xl border p-3 text-left transition ${kind === k.key ? 'border-brand bg-brand-50/60 ring-2 ring-brand/20' : 'border-line bg-white hover:border-brand'}`}
            data-testid={`widget-kind-${k.key}`}
          >
            <span className="block text-sm font-extrabold text-ink">{k.label}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{k.hint}</span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-wider text-muted">Live preview</p>
      <div className="mt-2 rounded-2xl border border-dashed border-line bg-cream/40 p-4">
        <div ref={preview} data-testid="widget-preview" />
        {!published && (
          <p className="mt-3 text-xs text-ink-soft" data-testid="widget-general-note">
            Your venue isn&apos;t published yet, so the widget shows a general NOSTOPS invitation. It switches to your
            venue automatically the moment it goes live — no need to change the code.
          </p>
        )}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-wider text-muted">Embed code — paste once</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-ink p-3.5 text-xs leading-relaxed text-white" data-testid="widget-snippet">{snippet}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={copy} className="min-h-[44px] rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="widget-copy">
          {copied ? 'Copied ✓' : 'Copy embed code'}
        </button>
        <p className="text-xs text-ink-soft">Paste it where you want the widget to appear (most website builders have an “HTML” or “Embed” block).</p>
      </div>
      <p className="mt-3 text-xs text-muted">
        The wording and design are kept up to date by NOSTOPS centrally — you never need to change or reinstall this code.
      </p>
    </div>
  );
}
