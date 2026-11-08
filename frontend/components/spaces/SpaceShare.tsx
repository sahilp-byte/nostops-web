'use client';

import { useState } from 'react';

// Share an approved Space: WhatsApp + copy link. The link previews with the Space's share card (og:image).
export default function SpaceShare({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${name} on NOSTOPS Spaces: ${url}`;
  return (
    <div className="flex flex-wrap gap-2" data-testid="space-share">
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0E7A3F] px-4 text-sm font-bold text-white" data-testid="space-share-whatsapp">Share on WhatsApp</a>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}
        className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink" data-testid="space-share-copy">{copied ? 'Link copied' : 'Copy link'}</button>
    </div>
  );
}
