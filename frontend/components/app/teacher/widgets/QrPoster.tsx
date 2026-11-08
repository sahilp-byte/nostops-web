'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Downloadable QR poster for the teacher's PUBLIC profile URL. Renders to a
// <canvas> so we can export a crisp PNG for flyers, studio walls and cards.
export default function QrPoster({ url, handle, name }: { url: string; handle: string; name: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const download = () => {
    const canvas = wrap.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `nostops-${handle || 'profile'}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-line bg-cream/40 p-4 sm:flex-row sm:items-center">
      <div ref={wrap} className="rounded-xl bg-white p-3 shadow-sm" data-testid="qr-poster">
        <QRCodeCanvas value={url} size={168} level="M" marginSize={2} fgColor="#0F766E" title={`${name} · NOSTOPS`} />
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-sm font-extrabold text-ink">Scan to open my NOSTOPS profile</p>
        <p className="mt-0.5 break-all text-xs text-muted">{url}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <button type="button" onClick={download} className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-600" data-testid="qr-download">
            ⬇ Download PNG
          </button>
          <button type="button" onClick={copyLink} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream">
            {copied ? 'Copied ✓' : '🔗 Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
