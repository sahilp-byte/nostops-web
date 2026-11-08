'use client';
// Public event sharing (Prompt 5 §4) — WhatsApp, Email, LinkedIn, Copy Link and
// a QR Code, all built from the CANONICAL event URL.
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const text = `${title} — a NOSTOPS programme`;
  const e = encodeURIComponent;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const btn = 'flex flex-col items-center justify-center gap-1 rounded-xl border border-line py-2.5 text-[11px] font-semibold text-ink-soft transition hover:bg-cream min-h-[56px]';

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Share event</p>
      <div className="mt-3 grid grid-cols-5 gap-2 text-center">
        <a href={`https://wa.me/?text=${e(text + ' ' + url)}`} target="_blank" rel="noopener noreferrer" className={btn} data-testid="share-whatsapp"><span className="text-base">💬</span>WhatsApp</a>
        <a href={`mailto:?subject=${e(text)}&body=${e(url)}`} className={btn} data-testid="share-email"><span className="text-base">✉️</span>Email</a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`} target="_blank" rel="noopener noreferrer" className={btn} data-testid="share-linkedin"><span className="text-base">in</span>LinkedIn</a>
        <button type="button" onClick={copy} className={btn} data-testid="share-copy"><span className="text-base">{copied ? '✓' : '🔗'}</span>{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" onClick={() => setShowQr((v) => !v)} className={btn} data-testid="share-qr-toggle" aria-expanded={showQr}><span className="text-base">▦</span>QR Code</button>
      </div>

      {showQr && (
        <div className="mt-4 flex flex-col items-center rounded-xl bg-cream p-4" data-testid="share-qr">
          <div className="rounded-lg bg-white p-3 ring-1 ring-line">
            <QRCodeSVG value={url} size={160} level="M" marginSize={0} />
          </div>
          <p className="mt-2 break-all text-center text-[11px] text-muted">{url}</p>
        </div>
      )}
    </div>
  );
}
