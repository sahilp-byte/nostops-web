import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { renderSiteOg } from '@/lib/server/site-og';
import { isAllowedRemoteImage } from '@/lib/server/image-safe';

// Photo-backed social share card (1200x630). Renders a REAL venue / retreat
// photo full-bleed, with a dark scrim + NOSTOPS branding overlaid — so shared
// links preview as a rich, inviting image rather than a flat text card. The
// Satori PNG is re-encoded to a compact JPEG (~150–300KB) so every scraper,
// including WhatsApp and LinkedIn, renders it reliably. Falls back to the
// branded text card when no usable photo is available.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/jpeg';

// Request a compact 1200x630 variant for hosts that support URL-based resizing
// (Unsplash). Other hosts (Object Storage) are fetched as-is, then normalised
// by sharp below.
function sizedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('images.unsplash.com')) {
      u.searchParams.set('w', '1200');
      u.searchParams.set('h', '630');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('q', '80');
      u.searchParams.set('fm', 'jpg');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export async function fetchPhotoDataUri(url: string): Promise<string | null> {
  // SEC-001: only fetch https images on the public image-host allowlist.
  if (!isAllowedRemoteImage(url)) return null;
  try {
    const res = await fetch(sizedUrl(url), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Normalise to a clean, predictable 1200x630 JPEG so the Satori <img> is
    // always correctly sized and never oversized.
    const jpg = await sharp(buf)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch {
    return null;
  }
}

// Re-encode a Satori ImageResponse (PNG) to a compact JPEG Response.
export async function toJpeg(img: ImageResponse): Promise<Response> {
  try {
    const png = Buffer.from(await img.arrayBuffer());
    const jpeg = await sharp(png).jpeg({ quality: 82 }).toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch {
    return img;
  }
}

type PhotoCardProps = {
  image: string;
  eyebrow?: string;
  title: string;
  sub?: string;
  tag?: string;
  tagAccent?: boolean;
  footer?: string;
};

function PhotoCard({ image, eyebrow, title, sub, tag, tagAccent, footer }: PhotoCardProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', fontFamily: 'sans-serif' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og ImageResponse renders plain <img> */}
      <img
        alt=""
        src={image}
        width={1200}
        height={630}
        style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }}
      />
      {/* Left-to-right scrim keeps the headline readable over any photo. */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(90deg, rgba(8,11,23,0.88) 0%, rgba(8,11,23,0.55) 46%, rgba(8,11,23,0.15) 100%)' }} />
      {/* Bottom scrim anchors the title block. */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(180deg, rgba(8,11,23,0.40) 0%, rgba(8,11,23,0.00) 34%, rgba(8,11,23,0.00) 58%, rgba(8,11,23,0.80) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '58px 68px', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
            <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.82)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
          </div>
          {tag ? (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: tagAccent ? 'rgba(245,158,11,0.34)' : 'rgba(13,148,136,0.38)', border: `2px solid ${tagAccent ? '#F59E0B' : '#2DD4BF'}` }}>{tag}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1000 }}>
          {eyebrow ? (
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.86)' }}>{eyebrow}</div>
          ) : null}
          <div style={{ display: 'flex', marginTop: 12, fontSize: 64, fontWeight: 800, lineHeight: 1.04 }}>{title}</div>
          {sub ? (
            <div style={{ display: 'flex', marginTop: 16, fontSize: 28, color: 'rgba(255,255,255,0.94)' }}>{sub}</div>
          ) : null}
          {footer ? (
            <div style={{ display: 'flex', marginTop: 26, fontSize: 22, color: 'rgba(255,255,255,0.82)' }}>{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type PhotoOgOpts = {
  /** Real photo URLs to try, in order. First one that loads wins. */
  photoCandidates: string[];
  /** Already-loaded photo (data URI); used before photoCandidates when present. */
  photoDataUri?: string | null;
  eyebrow?: string;
  title: string;
  sub?: string;
  tag?: string;
  tagAccent?: boolean;
  footer?: string;
};

export async function renderPhotoOg(opts: PhotoOgOpts): Promise<Response> {
  let dataUri: string | null = opts.photoDataUri || null;
  for (const c of opts.photoCandidates) {
    if (dataUri) break;
    if (!c) continue;
    dataUri = await fetchPhotoDataUri(c);
  }

  // No usable real photo -> keep the branded text card (still a valid preview),
  // re-encoded as JPEG so the emitted bytes match the route's contentType.
  if (!dataUri) {
    return toJpeg(renderSiteOg({
      eyebrow: opts.eyebrow,
      title: opts.title,
      sub: opts.sub,
      tag: opts.tag,
      tagAccent: opts.tagAccent,
      footer: opts.footer,
    }));
  }

  const img = new ImageResponse(
    (
      <PhotoCard
        image={dataUri}
        eyebrow={opts.eyebrow}
        title={opts.title}
        sub={opts.sub}
        tag={opts.tag}
        tagAccent={opts.tagAccent}
        footer={opts.footer}
      />
    ),
    { ...OG_SIZE },
  );
  return toJpeg(img);
}
