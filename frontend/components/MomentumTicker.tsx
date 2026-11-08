'use client';

import { useEffect, useState } from 'react';

// Subtle "network is alive" ticker. Rotates through the most recently onboarded
// teachers with a gentle pulse. Data is passed in from the server (real public
// directory) — no client fetch, no layout shift. Renders nothing when empty.
export default function MomentumTicker({ items }: { items: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setI((v) => (v + 1) % items.length), 3500);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand/20 bg-white/70 py-1.5 pl-2.5 pr-3.5 shadow-sm backdrop-blur"
      aria-live="polite"
      data-testid="momentum-ticker"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
      </span>
      <span className="truncate text-xs font-semibold text-ink-soft sm:text-sm">
        <span className="font-bold text-brand-700">{items[i]}</span> just joined the network
      </span>
    </div>
  );
}
