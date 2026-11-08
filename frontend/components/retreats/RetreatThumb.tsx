'use client';

import { useEffect, useState } from 'react';

// Retreat card / hero thumbnail. Priority:
//   1) the retreat's own cover / uploaded image
//   2) the venue's first Google photo (fetched lazily, only when the retreat is
//      linked to a venue partner — so we never spam the listing with requests)
//   3) a tasteful theme-based cover so a card is never blank.
const GRADIENT: Record<string, string> = {
  meditation: 'from-royal/25 via-cream to-brand/20',
  mindfulness: 'from-royal/25 via-cream to-brand/20',
  detox: 'from-emerald-200/70 via-cream to-brand/20',
  wellness: 'from-emerald-200/70 via-cream to-brand/20',
  ashtanga: 'from-accent/25 via-cream to-royal/20',
  vinyasa: 'from-accent/25 via-cream to-brand/20',
  hatha: 'from-brand/25 via-cream to-accent/20',
  pranayama: 'from-sky-200/70 via-cream to-brand/20',
  silent: 'from-ink/10 via-cream to-royal/15',
  himalayan: 'from-sky-200/70 via-cream to-brand/20',
  spiritual: 'from-amber-200/70 via-cream to-brand/20',
  general: 'from-accent/20 via-cream to-brand/20',
};
const MOTIF: Record<string, string> = {
  meditation: '🧘',
  mindfulness: '🧘',
  detox: '🌿',
  wellness: '🌿',
  ashtanga: '🕉️',
  vinyasa: '🌀',
  hatha: '🧘',
  pranayama: '🌬️',
  silent: '🤍',
  himalayan: '🏔️',
  spiritual: '🪔',
  general: '🧘',
};

export default function RetreatThumb({
  id,
  cover,
  venuePartnerId,
  theme,
  alt,
}: {
  id: string;
  cover?: string | null;
  venuePartnerId?: string | null;
  theme?: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(cover || null);

  useEffect(() => {
    if (cover || !venuePartnerId) return;
    let alive = true;
    const url = `/bff/retreats/${id}/venue-thumb?w=800`;
    const probe = new Image();
    probe.onload = () => { if (alive) setSrc(url); };
    probe.src = url; // onerror → stay on themed cover
    return () => { alive = false; };
  }, [id, cover, venuePartnerId]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setSrc(null)}
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  const key = (theme || 'general').toLowerCase();
  const grad = GRADIENT[key] || GRADIENT.general;
  const motif = MOTIF[key] || MOTIF.general;
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${grad}`} data-testid="retreat-thumb-fallback">
      <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 text-[7rem] leading-none opacity-10 transition duration-500 group-hover:scale-110">{motif}</span>
      <div className="absolute inset-0 grid place-items-center">
        <span aria-hidden className="text-5xl opacity-40 transition duration-500 group-hover:scale-110">{motif}</span>
      </div>
    </div>
  );
}
