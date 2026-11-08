'use client';

import { useEffect, useState } from 'react';
import ShareCardPreview from '@/components/app/ShareCardPreview';

// Shareable public retreat link + one-tap copy/invite. Public retreat pages
// live at /retreats/[id] and are only reachable once the retreat is published,
// so we only surface the link for public statuses.
export default function RetreatShare({
  retreatId,
  title,
  isPublic,
}: {
  retreatId: string;
  title: string;
  isPublic: boolean;
}) {
  const [copied, setCopied] = useState<'link' | 'invite' | null>(null);
  const path = `/retreats/${retreatId}`;
  // Derive the absolute URL after mount to avoid an SSR/client hydration mismatch
  // (server has no window). Until then the relative path is shown/used.
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = `${origin}${path}`;
  const invite = `Join me at “${title}” — a NOSTOPS yoga retreat. Reserve your seat: ${url}`;

  async function copy(text: string, which: 'link' | 'invite') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: invite, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copy(invite, 'invite');
    }
  }

  if (!isPublic) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-cream/50 p-5" data-testid="retreat-share">
        <h2 className="text-sm font-extrabold text-ink">Share this retreat</h2>
        <p className="mt-1 text-sm text-ink-soft">Your shareable public link appears here once the retreat is published.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-brand/25 bg-brand-50/40 p-5" data-testid="retreat-share">
      <h2 className="text-sm font-extrabold text-ink">Share this retreat</h2>
      <p className="mt-1 text-sm text-ink-soft">Send this link to seekers and organisations to fill your seats.</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-testid="retreat-share-url">{url}</span>
        <button
          type="button"
          onClick={() => copy(url, 'link')}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
        >
          {copied === 'link' ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(invite, 'invite')}
          data-testid="copy-invite"
          className="rounded-xl border border-brand/30 bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
        >
          {copied === 'invite' ? 'Invite copied ✓' : 'Copy invite'}
        </button>
        <button
          type="button"
          onClick={nativeShare}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          Share…
        </button>
      </div>
      <ShareCardPreview imagePath={`/share-card/retreat/${retreatId}`} label="retreat" className="mt-4 border-t border-brand/15 pt-4" />
    </section>
  );
}
