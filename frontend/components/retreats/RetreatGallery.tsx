'use client';

import { useCallback, useEffect, useState } from 'react';

function track(event: string, params: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', event, params);
  }
}

// Responsive photo experience: a hero + thumbnail grid with a full-screen,
// keyboard-navigable lightbox. Lazy-loads images and never shifts layout
// (fixed aspect-ratio tiles). Renders nothing when there are no images.
export default function RetreatGallery({ images, title, attribution }: { images: string[]; title: string; attribution?: string }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const go = useCallback((d: number) => setI((v) => (v + d + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  if (images.length === 0) return null;

  function openAt(idx: number) {
    setI(idx);
    setOpen(true);
    track('retreat_gallery_open', { index: idx });
  }

  const hero = images[0];
  const rest = images.slice(1, 5);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-4" data-testid="retreat-gallery">
        <button
          type="button"
          onClick={() => openAt(0)}
          className={`relative overflow-hidden rounded-2xl ${rest.length ? 'sm:col-span-2 sm:row-span-2' : 'sm:col-span-4'}`}
        >
          <span className="block aspect-[4/3] w-full sm:aspect-auto sm:h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt={title} className="h-full w-full object-cover transition hover:scale-[1.02]" />
          </span>
        </button>
        {rest.map((src, idx) => (
          <button key={src} type="button" onClick={() => openAt(idx + 1)} className="relative overflow-hidden rounded-2xl">
            <span className="block aspect-[4/3] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${title} — photo ${idx + 2}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-[1.03]" />
            </span>
            {idx === rest.length - 1 && images.length > 5 && (
              <span className="absolute inset-0 grid place-items-center bg-ink/50 text-sm font-bold text-white">
                +{images.length - 5} more
              </span>
            )}
          </button>
        ))}
      </div>
      {attribution && <p className="mt-2 text-[11px] text-muted">{attribution}</p>}

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photo gallery`}
          onClick={() => setOpen(false)}
        >
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-2xl leading-none text-white hover:bg-white/20">×</button>
          {images.length > 1 && (
            <>
              <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 rounded-full bg-white/10 p-3 text-xl text-white hover:bg-white/20">‹</button>
              <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 rounded-full bg-white/10 p-3 text-xl text-white hover:bg-white/20">›</button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[i]} alt={`${title} — photo ${i + 1}`} className="max-h-[85vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{i + 1} / {images.length}</span>
        </div>
      )}
    </>
  );
}
