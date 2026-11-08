'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Admin photo review — curate the photos a submitter uploaded before the venue
// is published. The admin can REMOVE any unwanted submitted photo (the rest are
// kept/approved); the first remaining photo becomes the public cover. Changes
// persist via the same admin edit endpoint (original submission is retained by
// the backend). Google-enriched photos are shown read-only — they come live
// from Google, so they can't be curated here.
export default function VenuePhotoReview({
  id,
  initial,
  googlePhotos = [],
}: {
  id: string;
  initial: string[];
  googlePhotos?: string[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>(initial || []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function remove(url: string) {
    if (busy) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove this photo? It will not be shown on the public listing.')) return;
    const prev = photos;
    const next = photos.filter((p) => p !== url);
    setBusy(url);
    setMsg(null);
    setPhotos(next); // optimistic
    const res = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/edit`, { photos: next });
    setBusy(null);
    if (res.ok) {
      setMsg({ kind: 'ok', text: 'Photo removed.' });
      router.refresh();
    } else {
      setPhotos(prev); // revert
      setMsg({ kind: 'err', text: (res.data && (res.data.error as string)) || 'Could not remove the photo.' });
    }
  }

  const nothing = photos.length === 0 && googlePhotos.length === 0;

  return (
    <section className="mt-8" data-testid="photo-review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black tracking-tight text-ink">Photographs</h2>
          <p className="mt-1 text-sm text-muted">Review the submitted photos — remove any you don&apos;t want published. The first remaining photo becomes the cover.</p>
        </div>
        {msg && <span className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-brand-700' : 'text-red-700'}`} data-testid="photo-review-msg">{msg.text}</span>}
      </div>

      {nothing ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted" data-testid="photo-review-empty">No photos on this submission.</p>
      ) : (
        <>
          {photos.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="submitted-photos">
              {photos.map((src, i) => (
                <div key={`${src}-${i}`} className="group relative overflow-hidden rounded-xl border border-line bg-cream" data-testid="submitted-photo-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Submitted photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-white">Cover</span>}
                  <button
                    type="button"
                    onClick={() => remove(src)}
                    disabled={!!busy}
                    aria-label="Remove photo"
                    data-testid="submitted-photo-remove"
                    className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {busy === src ? '…' : '✕'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted" data-testid="submitted-photos-empty">No submitted photos — all have been removed. Only Google photos (below) will show.</p>
          )}

          {googlePhotos.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-wide text-muted">From Google (read-only)</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="google-photos">
                {googlePhotos.slice(0, 6).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${src}-${i}`} src={src} alt="" className="aspect-[4/3] w-full rounded-xl border border-line object-cover" loading="lazy" />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">Google photos come live from the venue&apos;s listing and can&apos;t be removed here.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
