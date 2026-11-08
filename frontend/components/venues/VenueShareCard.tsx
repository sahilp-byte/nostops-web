'use client';

import { useState } from 'react';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { venuePath, venueCitySlug, venueNameSlug } from '@/lib/venue-url';
import ShareButtons from '@/components/share/ShareButtons';

// Owner-facing "Share your listing" card shown on the edit page once a venue is
// live. Gives the owner their clean public link, the social preview image, and
// one-tap WhatsApp / X / Copy share. No payment, no private data.
export default function VenueShareCard({ name, city }: { name: string; city?: string }) {
  const [imgOk, setImgOk] = useState(true);
  const path = venuePath({ id: '', name, city });
  const url = canonical(path);
  const citySlug = venueCitySlug({ city });
  const nameSlug = venueNameSlug({ name });
  const previewSrc = citySlug && nameSlug
    ? `/bff/venue/preview-image?city=${encodeURIComponent(citySlug)}&venue=${encodeURIComponent(nameSlug)}`
    : '';

  return (
    <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5 sm:p-6" data-testid="venue-share-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">🔗 Share your listing</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-brand-700">Live on NOSTOPS</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Your venue has a clean, shareable page. Post the link below — it unfurls with the preview card
        shown here on WhatsApp, X and most apps.
      </p>

      {previewSrc && imgOk && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={`Social preview for ${name}`}
            className="aspect-[1200/630] w-full object-cover"
            loading="lazy"
            onError={() => setImgOk(false)}
            data-testid="venue-share-preview"
          />
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-black uppercase tracking-wide text-muted">Your public link</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Link href={path} className="min-w-0 flex-1 truncate rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:underline" data-testid="venue-share-url">
            {url}
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <ShareButtons
          path={path}
          title={name}
          message={`Discover ${name}${city ? `, ${city}` : ''} — a yoga retreat venue on NOSTOPS`}
          testid="venue-share-buttons"
        />
      </div>
    </div>
  );
}
