'use client';

import { useEffect, useState } from 'react';
import { canonical } from '@/lib/site';

// Share the visitor's saved-venue shortlist as a link (/venues/saved?ids=…).
// No account needed: the link carries the venue ids, and whoever opens it sees
// the same venues and can save them to their own shortlist.
export default function ShareShortlist({ ids }: { ids: string[] }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const link = canonical(`/venues/saved?ids=${ids.join(',')}`);
  const text = `My NOSTOPS venue shortlist (${ids.length} venue${ids.length === 1 ? '' : 's'})`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`;

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

  async function nativeShare() {
    try {
      await navigator.share({ title: text, url: link });
    } catch {
      /* dismissed */
    }
  }

  const base = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition';
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="share-shortlist">
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={`${base} bg-ink text-white hover:bg-ink/90`} data-testid="share-shortlist-native">
          Share…
        </button>
      )}
      <a href={waHref} target="_blank" rel="noopener noreferrer" className={`${base} bg-[#25D366] text-white hover:brightness-95`} data-testid="share-shortlist-whatsapp">
        WhatsApp
      </a>
      <button
        type="button"
        onClick={copy}
        className={`${base} border border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700`}
        data-testid="share-shortlist-copy"
      >
        {copied ? '✓ Link copied' : 'Copy shortlist link'}
      </button>
    </div>
  );
}
