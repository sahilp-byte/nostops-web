// Printable A4 posters with the venue's QR code — one for yoga teachers, one for guests —
// each in English or Hindi.
const POSTERS = [
  { audience: 'teachers', title: 'For yoga teachers', desc: '“Yoga teachers, host your retreat here” with your QR code and the free teacher profile invite.' },
  { audience: 'guests', title: 'For guests and visitors', desc: 'Points guests to your NOSTOPS listing with your QR code.' },
] as const;
const LANGS = [
  { code: 'en', label: 'English', view: 'View', download: 'Download' },
  { code: 'hi', label: 'हिन्दी', view: 'देखें', download: 'डाउनलोड' },
] as const;

export default function PosterDownloads({ token }: { token: string }) {
  const href = (audience: string, lang: string, inline: boolean) =>
    `/bff/venue-growth/poster.pdf?k=${encodeURIComponent(token)}&audience=${audience}&lang=${lang}${inline ? '&inline=1' : ''}`;
  return (
    <div className="mt-6 border-t border-line pt-5" data-testid="poster-downloads">
      <p className="text-sm font-extrabold text-ink">Printable posters (A4) · English and हिन्दी</p>
      <p className="mt-0.5 text-xs text-ink-soft">For your reception, rooms, shala or notice board. The QR code never changes.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {POSTERS.map((p) => (
          <div key={p.audience} className="rounded-xl border border-line bg-cream/40 p-4" data-testid={`poster-${p.audience}`}>
            <p className="text-sm font-black text-ink">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{p.desc}</p>
            <div className="mt-3 space-y-2">
              {LANGS.map((l) => (
                <div key={l.code} className="flex flex-wrap items-center gap-2" data-testid={`poster-${p.audience}-${l.code}`}>
                  <span className="w-16 text-xs font-black text-ink-soft" lang={l.code}>{l.label}</span>
                  <a href={href(p.audience, l.code, true)} target="_blank" rel="noopener" lang={l.code} className="inline-flex min-h-[44px] min-w-[76px] items-center justify-center rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid={`poster-${p.audience}-${l.code}-view`}>
                    {l.view}
                  </a>
                  <a href={href(p.audience, l.code, false)} download lang={l.code} className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-600" data-testid={`poster-${p.audience}-${l.code}-download`}>
                    ⬇ {l.download}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
