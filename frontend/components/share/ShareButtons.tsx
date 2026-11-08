'use client';

import { useState } from 'react';
import { canonical } from '@/lib/site';

// Reusable one-tap share row (WhatsApp + X + copy link). Used on public Voices,
// Venue and Retreat pages so readers can spread the page — the shared link is
// the canonical www URL, so the rich Open Graph card (author photo / venue /
// retreat) unfurls on WhatsApp and X. canonical(path) is deterministic on the
// server and client → no hydration mismatch.
type Tone = 'light' | 'dark';

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 001.506 5.26l-.999 3.648 3.735-.98zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.151-.174.2-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function ShareButtons({
  path,
  title,
  message,
  tone = 'light',
  showCopy = true,
  className = '',
  testid = 'share-buttons',
}: {
  path: string;
  title: string;
  message?: string;
  tone?: Tone;
  showCopy?: boolean;
  className?: string;
  testid?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = canonical(path);
  const text = message || title;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition';
  const wa = 'bg-[#25D366] text-white hover:brightness-95';
  const x = tone === 'dark' ? 'bg-white text-ink hover:bg-white/90' : 'bg-ink text-white hover:bg-ink/90';
  const copyBtn =
    tone === 'dark'
      ? 'border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20'
      : 'border border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} data-testid={testid}>
      <a href={waHref} target="_blank" rel="noopener noreferrer" className={`${base} ${wa}`} data-testid={`${testid}-whatsapp`}>
        <WhatsAppIcon /> WhatsApp
      </a>
      <a href={xHref} target="_blank" rel="noopener noreferrer" className={`${base} ${x}`} data-testid={`${testid}-x`}>
        <XIcon /> Post on X
      </a>
      {showCopy && (
        <button type="button" onClick={copy} className={`${base} ${copyBtn}`} data-testid={`${testid}-copy`}>
          {copied ? '✓ Link copied' : 'Copy link'}
        </button>
      )}
    </div>
  );
}
