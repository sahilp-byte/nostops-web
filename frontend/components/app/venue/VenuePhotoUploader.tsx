'use client';

import { useRef, useState } from 'react';
import { postBff, sendBff } from '@/lib/auth-client';

// Owner photo uploader for a venue (up to 5 photos). Compresses each chosen
// image to a ~1600px JPEG in the browser, uploads it via the owner BFF (Emergent
// Object Storage) and persists the resulting same-origin URLs into the venue's
// photos[] via PATCH /bff/venue/centers/{id}. Uploaded photos appear on the
// owner card and the public venue page — no Google connection needed.
const MAX = 5;

async function fileToJpegDataUri(file: File, maxW = 1600, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('load'));
      i.src = url;
    });
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
    const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Only manage owner-uploaded / absolute URLs here (Google place tokens are
// handled separately by the Google connect flow).
const isManageable = (p: string) => p.startsWith('/') || /^https?:\/\//.test(p);

export default function VenuePhotoUploader({ centerId, initial, onChange }: { centerId?: string; initial: string[]; onChange?: (photos: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>((initial || []).filter(isManageable).slice(0, MAX));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Update local state + notify the parent (create form includes photos in its
  // create payload). In EDIT mode (centerId set) also persist immediately via PATCH.
  async function commit(next: string[]) {
    setPhotos(next);
    onChange?.(next);
    if (!centerId) return true;
    setSaving(true);
    setSaved(false);
    const r = await sendBff(`/bff/venue/centers/${encodeURIComponent(centerId)}`, 'PATCH', { photos: next });
    setSaving(false);
    if (!r.ok) { setErr((r.data as { error?: string })?.error || 'Could not save your photos.'); return false; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    return true;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setErr(null);
    const room = MAX - photos.length;
    if (room <= 0) { setErr(`You can add up to ${MAX} photos.`); return; }
    setBusy(true);
    const added: string[] = [];
    for (const file of files.slice(0, room)) {
      if (!/^image\//.test(file.type)) continue;
      try {
        const dataUri = await fileToJpegDataUri(file);
        const r = await postBff('/bff/venue/photo', { base64: dataUri, contentType: 'image/jpeg' });
        const u = (r.data as { url?: string })?.url;
        if (r.ok && u) added.push(u);
        else if (!r.ok) setErr((r.data as { error?: string })?.error || 'Could not upload a photo.');
      } catch {
        setErr('Could not process one of those images. Try a different one.');
      }
    }
    setBusy(false);
    if (added.length) await commit([...photos, ...added].slice(0, MAX));
  }

  async function remove(url: string) {
    await commit(photos.filter((p) => p !== url));
  }

  return (
    <div data-testid="venue-photo-uploader">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-ink">Your photos <span className="font-semibold text-muted">({photos.length}/{MAX})</span></p>
        {saving ? <span className="text-xs font-bold text-muted">Saving…</span> : saved ? <span className="text-xs font-bold text-brand-700" data-testid="photos-saved">✓ Saved</span> : null}
      </div>
      <p className="mt-1 text-xs text-ink-soft">Add up to {MAX} photos of your space — the first becomes the cover. JPG, PNG or WebP.</p>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onPick} className="hidden" data-testid="venue-photo-input" />

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <div key={p} className="group relative overflow-hidden rounded-xl border border-line bg-cream" data-testid="venue-photo-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt={`Venue photo ${i + 1}`} className="aspect-square w-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-white">Cover</span>}
            <button type="button" onClick={() => remove(p)} disabled={saving} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50" aria-label="Remove photo" data-testid="venue-photo-remove">✕</button>
          </div>
        ))}
        {photos.length < MAX && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line bg-cream/50 text-center transition hover:border-brand hover:bg-brand-50/40 disabled:opacity-60"
            data-testid="venue-photo-add"
          >
            <span aria-hidden className="text-2xl">🖼️</span>
            <span className="text-xs font-bold text-ink-soft">{busy ? 'Uploading…' : 'Add photo'}</span>
          </button>
        )}
      </div>
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-red-600" data-testid="venue-photo-error">{err}</p>}
    </div>
  );
}
