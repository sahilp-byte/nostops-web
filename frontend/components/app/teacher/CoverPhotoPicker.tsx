'use client';

import { useRef, useState } from 'react';
import { postBff } from '@/lib/auth-client';

// Cover/hero photo picker for the Host-your-retreat wizard. Compresses the chosen
// image to a ~1600px JPEG in the browser, uploads it via the host-only BFF (which
// stores it in Emergent Object Storage) and hands back a same-origin public URL to
// persist as the retreat's cover_image.
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

export default function CoverPhotoPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { setErr('Please choose an image file.'); return; }
    setErr(null);
    setBusy(true);
    try {
      const dataUri = await fileToJpegDataUri(file);
      const r = await postBff('/bff/teacher/retreat-cover', { base64: dataUri, contentType: 'image/jpeg' });
      if (!r.ok || !(r.data as any)?.url) {
        setErr((r.data as any)?.error || 'Could not upload your photo. Please try again.');
      } else {
        onChange(String((r.data as any).url));
      }
    } catch {
      setErr('Could not process that image. Try a different one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="cover-photo-picker">
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" data-testid="cover-photo-input" />
      {value ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Retreat cover preview" className="aspect-[16/9] w-full object-cover" data-testid="cover-photo-preview" />
          <div className="flex flex-wrap gap-2 p-3">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 disabled:opacity-60" data-testid="cover-photo-replace">
              {busy ? 'Uploading…' : 'Replace photo'}
            </button>
            <button type="button" onClick={() => onChange('')} disabled={busy} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:border-red-300 disabled:opacity-60" data-testid="cover-photo-remove">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-cream/50 text-center transition hover:border-brand hover:bg-brand-50/40 disabled:opacity-60"
          data-testid="cover-photo-add"
        >
          <span aria-hidden className="text-3xl">🖼️</span>
          <span className="text-sm font-bold text-ink-soft">{busy ? 'Uploading…' : 'Add a cover photo'}</span>
          <span className="text-xs text-muted">Landscape looks best · JPG, PNG or WebP</span>
        </button>
      )}
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
    </div>
  );
}
