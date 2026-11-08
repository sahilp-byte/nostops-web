'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';
import { timeAgo } from '@/lib/pulse-ui';

type Digest = { summary: string | null; generated_at?: number; based_on?: { threads: number; replies: number }; model?: string };

// Minimal markdown renderer for the digest (## headings + bullet lines only).
function renderMd(md: string) {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    const t = line.trim();
    if (t.startsWith('## ')) return <h3 key={i} className="mt-4 text-sm font-black uppercase tracking-wide text-brand-700">{t.slice(3)}</h3>;
    if (t.startsWith('# ')) return <h3 key={i} className="mt-4 text-base font-black text-ink">{t.slice(2)}</h3>;
    if (t.startsWith('- ') || t.startsWith('• ')) return <li key={i} className="ml-4 list-disc text-sm text-ink-soft">{t.slice(2)}</li>;
    if (!t) return <div key={i} className="h-1.5" />;
    return <p key={i} className="text-sm leading-relaxed text-ink-soft">{t}</p>;
  });
}

export default function ThemeDigest({ initial }: { initial: Digest }) {
  const [digest, setDigest] = useState<Digest>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function generate() {
    if (busy) return;
    setBusy(true); setMsg('');
    const r = await postBff<Digest & { empty?: boolean; error?: string }>('/bff/admin/pulse/digest/generate');
    setBusy(false);
    if (r.ok && r.data.summary) setDigest(r.data);
    else if (r.data?.empty) setMsg('No discussions yet — themes will appear once teachers start talking.');
    else setMsg(r.data?.error || 'Could not generate the summary right now.');
  }

  return (
    <section className="rounded-2xl border border-royal/30 bg-royal-50/40 p-5" data-testid="theme-digest">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-ink">✨ Theme Digest</h2>
          <p className="mt-0.5 text-sm text-ink-soft">A one-tap AI read of what teachers are talking about. Signals, not conclusions.</p>
        </div>
        <button onClick={generate} disabled={busy} data-testid="digest-generate" className="rounded-xl bg-royal px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
          {busy ? 'Analysing…' : digest.summary ? 'Refresh summary' : 'Generate summary'}
        </button>
      </div>

      {msg && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-muted">{msg}</p>}

      {digest.summary ? (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <ul className="space-y-0.5">{renderMd(digest.summary)}</ul>
          <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
            Generated {timeAgo(digest.generated_at)} · from {digest.based_on?.threads ?? 0} discussions &amp; {digest.based_on?.replies ?? 0} replies · {digest.model}
          </p>
        </div>
      ) : (
        !msg && <p className="mt-3 text-sm text-muted">No summary yet. Tap “Generate summary” to analyse recent discussions.</p>
      )}
    </section>
  );
}
