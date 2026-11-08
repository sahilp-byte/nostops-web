'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const V = 288; // crop viewport (square) in px

// Subtle, tasteful presets applied both to the live preview (CSS) and the
// exported canvas (ctx.filter) so what you see is what saves.
const FILTERS: Array<{ key: string; label: string; css: string }> = [
  { key: 'none', label: 'Original', css: 'none' },
  { key: 'bright', label: 'Bright', css: 'brightness(1.12) contrast(1.03) saturate(1.05)' },
  { key: 'warm', label: 'Warm', css: 'brightness(1.06) saturate(1.15) sepia(0.18)' },
  { key: 'cool', label: 'Cool', css: 'brightness(1.04) contrast(1.02) saturate(1.05) hue-rotate(-8deg)' },
  { key: 'mono', label: 'B&W', css: 'grayscale(1) contrast(1.05) brightness(1.03)' },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Dependency-free square photo cropper: pan by dragging, zoom via slider,
// outputs a compressed 512×512 JPEG data URI. The image always covers the frame.
export default function SquareImageCropper({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [cover, setCover] = useState(1); // scale so image covers the frame at zoom=1
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState('none');
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Load the picked file into an Image.
  useEffect(() => {
    const fr = new FileReader();
    fr.onload = () => {
      const dataUrl = fr.result as string;
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        const c = Math.max(V / img.naturalWidth, V / img.naturalHeight);
        const dw = img.naturalWidth * c;
        const dh = img.naturalHeight * c;
        setNat({ w: img.naturalWidth, h: img.naturalHeight });
        setCover(c);
        setZoom(1);
        setOffset({ x: (V - dw) / 2, y: (V - dh) / 2 });
        setSrc(dataUrl);
      };
      img.src = dataUrl;
    };
    fr.readAsDataURL(file);
  }, [file]);

  const dims = nat ? { dw: nat.w * cover * zoom, dh: nat.h * cover * zoom } : { dw: V, dh: V };

  const clampOffset = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, V - dims.dw, 0),
      y: clamp(y, V - dims.dh, 0),
    }),
    [dims.dw, dims.dh],
  );

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    setOffset(clampOffset(nx, ny));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function onZoom(nextZoom: number) {
    if (!nat) return;
    // Zoom around the frame centre so it feels natural.
    const oldDw = nat.w * cover * zoom;
    const oldDh = nat.h * cover * zoom;
    const cx = (-offset.x + V / 2) / oldDw;
    const cy = (-offset.y + V / 2) / oldDh;
    const newDw = nat.w * cover * nextZoom;
    const newDh = nat.h * cover * nextZoom;
    const nx = clamp(V / 2 - cx * newDw, V - newDw, 0);
    const ny = clamp(V / 2 - cy * newDh, V - newDh, 0);
    setZoom(nextZoom);
    setOffset({ x: nx, y: ny });
  }

  function save() {
    const img = imgRef.current;
    if (!img || !nat) return;
    const OUT = 512;
    const f = 1 / (cover * zoom);
    const sSize = V * f;
    const sx = clamp(-offset.x * f, 0, Math.max(0, nat.w - sSize));
    const sy = clamp(-offset.y * f, 0, Math.max(0, nat.h - sSize));
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = FILTERS.find((f) => f.key === filter)?.css || 'none';
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    ctx.filter = 'none';
    let q = 0.85;
    let out = canvas.toDataURL('image/jpeg', q);
    while (out.length > 900_000 && q > 0.4) {
      q -= 0.12;
      out = canvas.toDataURL('image/jpeg', q);
    }
    onCropped(out);
  }

  function recenter() {
    if (!nat) return;
    const dw = nat.w * cover;
    const dh = nat.h * cover;
    setZoom(1);
    setOffset({ x: (V - dw) / 2, y: (V - dh) / 2 });
  }

  const isReset = Math.abs(zoom - 1) < 0.001;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" data-testid="crop-modal">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-ink">Crop your photo</h3>
        <p className="mt-0.5 text-sm text-muted">Drag to reposition and use the slider to zoom.</p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative overflow-hidden rounded-2xl bg-cream touch-none select-none"
            style={{ width: V, height: V, cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt="Crop preview"
                draggable={false}
                style={{ position: 'absolute', left: offset.x, top: offset.y, width: dims.dw, height: dims.dh, maxWidth: 'none', filter: FILTERS.find((f) => f.key === filter)?.css || 'none' }}
              />
            )}
            {/* subtle guide ring */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-white/70" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-bold text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoom(parseFloat(e.target.value))}
            data-testid="crop-zoom"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand"
          />
          <button
            type="button"
            onClick={recenter}
            disabled={isReset}
            data-testid="crop-reset"
            className="shrink-0 text-xs font-bold text-brand-700 transition hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
          >
            Reset
          </button>
        </div>

        {/* Filter presets */}
        <div className="mt-4">
          <p className="text-xs font-bold text-muted">Filter</p>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="crop-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                data-testid={`crop-filter-${f.key}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  filter === f.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!src} data-testid="crop-save" className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
