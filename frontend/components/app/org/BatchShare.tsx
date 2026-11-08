'use client';

import { useEffect, useState } from 'react';

// Share a batch invite link with the team over WhatsApp (mirrors the mobile
// getShareMessage copy). Falls back to native share / clipboard copy.
export default function BatchShare({
  token,
  companyName,
  venue,
  capacity,
  compact = false,
}: {
  token: string;
  companyName: string;
  venue: string;
  capacity: number;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // Derive the invite origin on the client only. Computing window.location during
  // render would diverge from the server ('') and trip a hydration mismatch, so
  // we start empty (matching SSR) and fill it in after mount.
  const [link, setLink] = useState('');
  useEffect(() => {
    setLink(`${window.location.origin}/booking-invite/${token}`);
  }, [token]);

  function message() {
    return (
      `Hi Team! 🧘\n\nWe're starting a *Yoga programme* at ${companyName}!\n\n` +
      `📍 Venue: ${venue}\n👥 Capacity: ${capacity} participants\n` +
      `🧘 Led by a verified NOSTOPS teacher, on-site\n\n` +
      `See the details and confirm your spot:\n👉 ${link}\n\nLooking forward to seeing you on the mat! 🧘‍♀️`
    );
  }

  async function share() {
    const text = message();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Yoga program at ${companyName}`, text });
        return;
      } catch {
        /* fall through */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
      >
        Share on WhatsApp
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-cream/60 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-testid="invite-link">{link}</span>
        <button type="button" onClick={copy} className="shrink-0 text-sm font-bold text-brand-700 hover:underline">{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={share} className="flex-1 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95">
          Share with team on WhatsApp
        </button>
        <a href={`/booking-invite/${token}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
          Preview invite
        </a>
      </div>
    </div>
  );
}
