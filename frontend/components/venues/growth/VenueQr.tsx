'use client';

import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// The venue's stable QR code (never changes, so printed copies stay valid). It opens the
// venue's NOSTOPS profile once published, and a general NOSTOPS page until then.
export default function VenueQr({ url, code, published }: { url: string; code: string; published: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const download = () => {
    const canvas = wrap.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `nostops-venue-qr-${code}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center" data-testid="venue-qr">
      <div ref={wrap} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
        <QRCodeCanvas value={url} size={512} level="M" marginSize={2} fgColor="#0F766E" style={{ width: 168, height: 168 }} title="NOSTOPS venue QR code" />
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-sm font-extrabold text-ink">{published ? 'Scan to open your NOSTOPS listing' : 'Scan to discover NOSTOPS'}</p>
        <p className="mt-0.5 break-all text-xs text-muted">{url}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {published ? 'Print it for your reception, rooms or brochures.' : 'Until your venue is published it opens a general NOSTOPS page, then switches to your listing automatically.'}
        </p>
        <button type="button" onClick={download} className="mt-3 min-h-[44px] rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="qr-download">
          ⬇ Download QR code (PNG)
        </button>
      </div>
    </div>
  );
}
