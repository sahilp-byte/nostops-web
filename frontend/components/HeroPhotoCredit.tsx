import type { ReactNode } from 'react';

type Attribution = { displayName: string; uri?: string };

// Google Maps Platform requires photo attribution to be shown with every Places
// photo. This renders the "Photo: Google · <author>" credit; never hide or alter it.
export function HeroPhotoCredit({ attributions }: { attributions: Attribution[] }): ReactNode {
  return (
    <span>
      Photo: Google
      {attributions.slice(0, 2).map((a, i) => (
        <span key={i}>
          {' · '}
          {a.uri ? (
            <a href={a.uri} target="_blank" rel="noreferrer" className="underline hover:text-white/90">
              {a.displayName}
            </a>
          ) : (
            a.displayName
          )}
        </span>
      ))}
    </span>
  );
}
