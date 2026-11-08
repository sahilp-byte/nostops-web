'use client';

import { useState } from 'react';

// Share this batch invite with colleagues over WhatsApp (or native share / copy).
export default function ShareInvite({ courseTitle, companyName }: { courseTitle: string; companyName: string }) {
  const [copied, setCopied] = useState(false);

  function url() {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  async function share() {
    const link = url();
    const text = `Join our ${courseTitle} at ${companyName} on NOSTOPS — the more colleagues join, the bigger the group discount. Reserve your spot: ${link}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: courseTitle, text, url: link });
        return;
      } catch {
        /* user cancelled — fall through to WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={share}
        className="flex-1 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95"
      >
        Share with colleagues on WhatsApp
      </button>
      <button
        type="button"
        onClick={copy}
        className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream"
      >
        {copied ? 'Link copied ✓' : 'Copy link'}
      </button>
    </div>
  );
}
