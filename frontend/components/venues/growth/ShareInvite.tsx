'use client';

import { useEffect, useState } from 'react';
import { copyText } from '@/lib/venue-growth-client';

// Step 3: a ready-to-send invitation for WhatsApp (English, plus a separate Hindi version), or to copy.
export default function ShareInvite({ message, messageHi }: { message: string; messageHi?: string }) {
  const [copied, setCopied] = useState('');
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), []);

  async function copy(which: 'en' | 'hi') {
    if (await copyText(which === 'hi' ? messageHi || '' : message)) {
      setCopied(which);
      setTimeout(() => setCopied(''), 1800);
    }
  }

  return (
    <div data-testid="share-invite">
      <pre className="whitespace-pre-wrap break-words rounded-2xl border border-line bg-cream/40 p-4 font-sans text-sm leading-relaxed text-ink [overflow-wrap:anywhere]" data-testid="share-message">{message}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: '#25D366' }}
          data-testid="share-whatsapp"
        >
          Share on WhatsApp
        </a>
        <button type="button" onClick={() => copy('en')} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream" data-testid="share-copy">
          {copied === 'en' ? 'Copied ✓' : 'Copy message'}
        </button>
        {canShare && (
          <button type="button" onClick={() => navigator.share({ text: message }).catch(() => undefined)} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
            More ways to share
          </button>
        )}
      </div>
      {messageHi && (
        <div className="mt-4" lang="hi" data-testid="share-hindi">
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(messageHi)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition hover:bg-[#25D366]/10"
              style={{ borderColor: '#25D366', color: '#128C7E' }}
              data-testid="share-whatsapp-hi"
            >
              Share in Hindi on WhatsApp
            </a>
            <button type="button" onClick={() => copy('hi')} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream" data-testid="share-copy-hi">
              {copied === 'hi' ? 'Copied ✓' : 'Copy Hindi message'}
            </button>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold text-brand-700" data-testid="share-hindi-toggle">See the Hindi message · हिन्दी संदेश</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl border border-line bg-cream/40 p-4 font-sans text-sm leading-relaxed text-ink [overflow-wrap:anywhere]" data-testid="share-message-hi">{messageHi}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
