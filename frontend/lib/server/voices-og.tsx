import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getPublicArticle } from '@/lib/server/voices';
import { isAllowedRemoteImage } from '@/lib/server/image-safe';
import { initials, titleCase } from '@/lib/format';

// Per-article social share image (1200x630) for a NOSTOPS Voices article.
// The frozen backend never sets og:image, so we render a branded card that
// PROMINENTLY shows the author's profile photo (their real uploaded image when
// present) next to the article title + the article's public URL. Next wires
// this to og:image / twitter:image automatically as a real https PNG that
// social scrapers and search engines can fetch (base64 data-URIs cannot be).
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

async function loadAvatar(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url; // already inline
  if (!isAllowedRemoteImage(url)) return null; // SSRF guard
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const ct = r.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await r.arrayBuffer());
      return `data:${ct};base64,${buf.toString('base64')}`;
    }
  } catch {
    /* fall through to initials */
  }
  return null;
}

export async function renderVoicesOg(slug: string): Promise<ImageResponse> {
  const a = await getPublicArticle(slug);
  if (!a) notFound();

  const title = (a.title || 'NOSTOPS Voices').slice(0, 120);
  const author = a.author_name || 'NOSTOPS Teacher';
  const kind = titleCase(String(a.type || 'Article').replace(/_/g, ' '));
  const meta = [a.author_city ? titleCase(String(a.author_city)) : '', a.topic ? titleCase(String(a.topic)) : '']
    .filter(Boolean)
    .join('  ·  ');
  const avatar = await loadAvatar(a.author_avatar_url);
  const titleSize = title.length > 78 ? 46 : title.length > 52 ? 54 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          background: 'linear-gradient(135deg, #0A6B61 0%, #0D9488 55%, #0B7A6F 100%)',
        }}
      >
        {/* top row: wordmark + article type */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS Voices</div>
            <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.72)' }}>Teacher voices, from the mat</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 26,
              fontWeight: 700,
              padding: '10px 24px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              border: '2px solid rgba(255,255,255,0.45)',
            }}
          >
            {kind}
          </div>
        </div>

        {/* middle: article title */}
        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 800, lineHeight: 1.1, maxWidth: 1056 }}>{title}</div>

        {/* author row: profile photo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              width={120}
              height={120}
              style={{ width: 120, height: 120, borderRadius: 999, objectFit: 'cover', border: '5px solid rgba(255,255,255,0.30)' }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 120,
                height: 120,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                border: '5px solid rgba(255,255,255,0.30)',
                fontSize: 48,
                fontWeight: 800,
              }}
            >
              {initials(author)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 800 }}>{author}</div>
            {meta ? (
              <div style={{ display: 'flex', marginTop: 6, fontSize: 24, color: 'rgba(255,255,255,0.82)' }}>{meta}</div>
            ) : (
              <div style={{ display: 'flex', marginTop: 6, fontSize: 24, color: 'rgba(255,255,255,0.82)' }}>NOSTOPS Teacher</div>
            )}
          </div>
        </div>

        {/* bottom row: public article URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            color: 'rgba(255,255,255,0.80)',
          }}
        >
          <div style={{ display: 'flex' }}>nostops.org/voices/{a.slug}</div>
          <div style={{ display: 'flex' }}>Read on NOSTOPS</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
