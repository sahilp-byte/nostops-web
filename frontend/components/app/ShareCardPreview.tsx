'use client';

import { useCallback, useState } from 'react';

// In-app preview of the auto-generated social share card (the 1200x630 image a
// link previews as on WhatsApp / X / LinkedIn / Facebook). `imagePath` is a
// stable same-origin route (/share-card/...) that re-renders the same next/og
// card. Teachers & retreat hosts see exactly what others will see BEFORE they
// share — with a Refresh (cache-bust) for after they update their photo/details.
export default function ShareCardPreview({
  imagePath,
  label = 'preview',
  className = '',
}: {
  imagePath: string;
  label?: string;
  className?: string;
}) {
  const [bust, setBust] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const src = bust ? `${imagePath}?v=${bust}` : imagePath;
  // The image can finish loading before hydration attaches onLoad — check `complete` once mounted.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setState(el.naturalWidth > 0 ? 'ok' : 'error');
  }, []);

  return (
    <div className={className} data-testid="share-card-preview">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-ink">Your share card</p>
        <button
          type="button"
          onClick={() => {
            setState('loading');
            setBust(Date.now());
          }}
          className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-xs font-bold text-brand-700 transition hover:underline"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        This is the preview people see when your link is shared on WhatsApp, X, LinkedIn and Facebook.
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-cream" style={{ aspectRatio: '1200 / 630' }}>
        {state === 'error' ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted">
            Your share card appears here once your public page is live.
          </div>
        ) : (
          <>
            {state === 'loading' && <div className="h-full w-full animate-pulse bg-line/40" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={src}
              ref={imgRef}
              src={src}
              alt={`NOSTOPS ${label} share card`}
              width={1200}
              height={630}
              onLoad={() => setState('ok')}
              onError={() => setState('error')}
              className={`h-full w-full object-cover ${state === 'ok' ? 'block' : 'hidden'}`}
            />
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Social platforms cache previews — after you update your photo or details, the new card can take a little while to
        show everywhere.
      </p>
    </div>
  );
}
