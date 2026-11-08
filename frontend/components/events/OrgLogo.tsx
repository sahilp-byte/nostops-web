'use client';
// Organisation logo with an initials tile when the image fails to load.
import { useState } from 'react';

export default function OrgLogo({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const box = 'h-7 w-7 shrink-0 rounded-md ring-1 ring-line';
  if (failed) {
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return (
      <span aria-hidden className={`${box} inline-flex items-center justify-center bg-brand-50 text-[10px] font-black text-brand-700`} data-testid="event-organiser-initials">
        {initials}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- organisation logo URL, no next/image loader
  return <img src={src} alt={`${name} logo`} onError={() => setFailed(true)} className={`${box} bg-white object-contain`} />;
}
