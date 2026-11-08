'use client';

import { useState } from 'react';

// Share the public festive campaign page. Only the public URL + a short message are shared — no
// account data. Instagram has no web "share link" address, so its button opens the phone's share
// sheet (where Instagram appears) or, on desktop, copies the caption + link to paste into a story.
const MESSAGE =
  '🪔 NOSTOPS Festive Season Celebration! Your InstaKYC is on us — complimentary InstaKYC for eligible Indian yoga teachers, 1 Nov – 31 Dec 2026.';

const ICONS: Record<string, React.ReactNode> = {
  whatsapp: <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.3-.3-.3-.5-.4Z" />,
  facebook: <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />,
  linkedin: <path d="M6.9 8.8H3.8V20h3.1V8.8ZM5.3 3.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM20.2 13.5c0-3-1.6-4.9-4.2-4.9-1.4 0-2.4.8-2.8 1.5V8.8h-3V20h3.1v-5.6c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20h3.1v-6.5Z" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.2" />
    </>
  ),
  link: <path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2a1 1 0 1 1-1.4-1.4l2-2a1 1 0 1 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0Zm2.8-2.8a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2a1 1 0 0 1 1.4 1.4l-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0Z" />,
};

export default function FestiveShare({ url, tone = 'light', testid = 'festive-share' }: { url: string; tone?: 'light' | 'dark'; testid?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote((n) => (n === t ? null : n)), 3200);
  };
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash('Copy this link: ' + url);
    }
  };
  const enc = encodeURIComponent;

  const instagram = async () => {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: 'NOSTOPS Festive Free InstaKYC', text: MESSAGE, url });
        return;
      } catch {
        /* cancelled — fall back to copying */
      }
    }
    copy(`${MESSAGE} ${url}`, 'Caption & link copied — paste it into your Instagram story or post.');
  };

  const items = [
    { key: 'whatsapp', label: 'WhatsApp', bg: 'bg-[#25D366]', onClick: () => open(`https://wa.me/?text=${enc(`${MESSAGE} ${url}`)}`) },
    { key: 'facebook', label: 'Facebook', bg: 'bg-[#1877F2]', onClick: () => open(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`) },
    { key: 'instagram', label: 'Instagram', bg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]', onClick: instagram },
    { key: 'linkedin', label: 'LinkedIn', bg: 'bg-[#0A66C2]', onClick: () => open(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`) },
    { key: 'link', label: 'Copy link', bg: tone === 'dark' ? 'bg-white/20' : 'bg-[#0E3D3B]', onClick: () => copy(url, 'Link copied!') },
  ];

  return (
    <div data-testid={testid}>
      <ul className="flex flex-wrap items-center gap-3" aria-label="Share this offer">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onClick={it.onClick}
              aria-label={`Share on ${it.label}`}
              title={it.label}
              data-testid={`${testid}-${it.key}`}
              className={`grid h-12 w-12 place-items-center rounded-full text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F07A1A] focus-visible:ring-offset-2 ${it.bg}`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">{ICONS[it.key]}</svg>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className={`mt-2 min-h-[1.25rem] text-sm font-semibold ${tone === 'dark' ? 'text-[#FFD9B0]' : 'text-[#0F5E5A]'}`}>
        {note}
      </p>
    </div>
  );
}
