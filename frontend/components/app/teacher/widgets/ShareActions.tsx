'use client';

import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

type Channel = 'copy' | 'whatsapp' | 'email' | 'more';
type Social = 'facebook' | 'linkedin' | 'x' | 'instagram';

// Browser-native distribution actions. Every action targets the PUBLIC profile
// URL only — never a token or private data. No fake integrations: platforms
// that can't accept a prefilled web post (Instagram) get an honest
// "copy caption" behaviour instead.
export default function ShareActions({
  url,
  title,
  message,
  channels = ['copy', 'whatsapp', 'email', 'more'],
  social = [],
  showQr = false,
  testid,
}: {
  url: string;
  title: string;
  message: string;
  channels?: Channel[];
  social?: Social[];
  showQr?: boolean;
  testid?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const full = `${message} ${url}`.trim();

  const flash = (k: string) => {
    setCopied(k);
    setTimeout(() => setCopied((c) => (c === k ? null : c)), 1600);
  };
  const copy = async (text: string, k: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(k);
    } catch {
      /* clipboard denied — no-op */
    }
  };
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');
  const shareMore = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: message, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copy(url, 'link');
  };

  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50';
  const ghost = `${btn} border border-line bg-white text-ink-soft hover:bg-cream`;

  return (
    <div className="mt-3 space-y-2" data-testid={testid}>
      <div className="flex flex-wrap gap-2">
        {channels.includes('copy') && (
          <button type="button" onClick={() => copy(url, 'link')} className={`${btn} bg-brand text-white hover:bg-brand-600`} data-testid={testid ? `${testid}-copy` : undefined}>
            {copied === 'link' ? 'Copied ✓' : '🔗 Copy link'}
          </button>
        )}
        {channels.includes('whatsapp') && (
          <button type="button" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(full)}`)} className={ghost}>
            💬 WhatsApp
          </button>
        )}
        {channels.includes('email') && (
          <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`} className={ghost}>
            ✉️ Email
          </a>
        )}
        {social.includes('facebook') && (
          <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)} className={ghost}>
            Facebook
          </button>
        )}
        {social.includes('linkedin') && (
          <button type="button" onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)} className={ghost}>
            LinkedIn
          </button>
        )}
        {social.includes('x') && (
          <button type="button" onClick={() => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`)} className={ghost}>
            X / Twitter
          </button>
        )}
        {social.includes('instagram') && (
          <button type="button" onClick={() => copy(full, 'ig')} className={ghost}>
            {copied === 'ig' ? 'Caption copied ✓' : 'Instagram caption'}
          </button>
        )}
        {channels.includes('more') && (
          <button type="button" onClick={shareMore} className={ghost}>
            ⋯ More
          </button>
        )}
        {showQr && (
          <button type="button" onClick={() => setQrOpen((v) => !v)} className={ghost}>
            {qrOpen ? 'Hide QR' : '▦ QR'}
          </button>
        )}
      </div>

      {showQr && qrOpen && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-cream/50 p-3">
          <div className="rounded-lg bg-white p-2">
            <QRCodeCanvas value={url} size={96} level="M" marginSize={2} fgColor="#0F766E" />
          </div>
          <p className="text-xs text-muted">Scan to open your NOSTOPS profile. Use the QR Code widget below to download a print version.</p>
        </div>
      )}
    </div>
  );
}
