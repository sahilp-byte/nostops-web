'use client';

import { useState } from 'react';
import { copyText } from '@/lib/venue-growth-client';

type Line = { style: string; text: string; url: string | null };

// Step 2: the personalised invitation note — read it here, open/download it as a PDF (English or Hindi), or copy it.
export default function InvitationNote({ lines, linesHi = [], token }: { lines: Line[]; linesHi?: Line[]; token: string }) {
  const [copied, setCopied] = useState('');
  const pdf = `/bff/venue-growth/invitation.pdf?k=${encodeURIComponent(token)}`;
  const pdfHi = `${pdf}&lang=hi`;
  const plain = (ls: Line[]) => ls.map((l) => l.text).join('\n\n');

  async function copy(which: 'en' | 'hi') {
    if (await copyText(plain(which === 'hi' ? linesHi : lines))) {
      setCopied(which);
      setTimeout(() => setCopied(''), 1800);
    }
  }

  return (
    <div data-testid="invitation-note">
      <article className="rounded-2xl border border-line bg-cream/40 p-5 text-sm leading-relaxed text-ink sm:p-6" aria-label="Invitation note">
        {lines.map((l, i) => {
          if (l.style === 'h1') return <h3 key={i} className="text-base font-black tracking-wide text-brand-700">{l.text}</h3>;
          if (l.style === 'h2') return <p key={i} className="mt-4 text-xs font-black uppercase tracking-wider text-ink">{l.text}</p>;
          if (l.style === 'link' && l.url) return <a key={i} href={l.url} target="_blank" rel="noopener" className="mt-1 block break-all py-2 font-semibold text-brand-700 underline">{l.text}</a>;
          if (l.style === 'strong') return <p key={i} className="font-black">{l.text}</p>;
          return <p key={i} className="mt-2 text-ink-soft">{l.text}</p>;
        })}
      </article>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`${pdf}&inline=1`} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="note-view-pdf">
          View PDF
        </a>
        <a href={pdf} download className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="note-download-pdf">
          ⬇ Download PDF
        </a>
        <button type="button" onClick={() => copy('en')} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream" data-testid="note-copy">
          {copied === 'en' ? 'Copied ✓' : 'Copy note'}
        </button>
      </div>
      {linesHi.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" lang="hi" data-testid="note-hindi-actions">
          <a href={`${pdfHi}&inline=1`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="note-view-pdf-hi">
            View Hindi PDF · हिन्दी
          </a>
          <a href={pdfHi} download className="inline-flex min-h-[44px] items-center rounded-xl border border-brand bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50" data-testid="note-download-pdf-hi">
            ⬇ Download Hindi PDF
          </a>
          <button type="button" onClick={() => copy('hi')} className="min-h-[44px] rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream" data-testid="note-copy-hi">
            {copied === 'hi' ? 'Copied ✓' : 'Copy Hindi note'}
          </button>
        </div>
      )}
    </div>
  );
}
