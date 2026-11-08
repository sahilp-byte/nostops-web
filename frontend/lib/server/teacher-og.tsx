import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { initials, titleCase } from '@/lib/format';
import { isAllowedRemoteImage } from '@/lib/server/image-safe';
import { isPublicHandleBlocked, publicTrust } from '@/lib/public-teacher';

// Per-teacher social share image (1200x630) for the public profile page.
// The frozen backend never sets og:image, and many teachers have no uploaded
// photo — so we render a UNIQUE, branded card for each teacher from their
// approved public data (name, tradition, experience, city, standing) and use
// their real photo when they have one. No two teachers share the same image,
// and nothing private is ever drawn.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

async function loadAvatarDataUri(t: any): Promise<string | null> {
  const url = typeof t?.avatar_url === 'string' && t.avatar_url ? t.avatar_url : null;
  if (url && isAllowedRemoteImage(url)) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const ct = r.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await r.arrayBuffer());
        return `data:${ct};base64,${buf.toString('base64')}`;
      }
    } catch {
      /* fall through to base64 / initials */
    }
  }
  const b64 = typeof t?.avatar_base64 === 'string' && t.avatar_base64 ? t.avatar_base64 : null;
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  return null;
}

export async function renderTeacherOg(handle: string): Promise<ImageResponse> {
  // Retired-from-public profiles must not expose an OG/Twitter image either.
  if (isPublicHandleBlocked(handle)) notFound();

  let t: any = {};
  try {
    const d = await apiGet<{ teacher?: any }>(`/teachers/public/${handle}`, { revalidate: 300 });
    if (d && d.teacher === null) notFound(); // deleted from the website by an admin
    t = d?.teacher || {};
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_HTTP_ERROR_FALLBACK')) throw e;
    t = {};
  }

  const name: string = t.name || 'NOSTOPS Yoga Teacher';
  const empanelled = !!t.is_empanelled;
  const verified = publicTrust(t).verified;
  const badge = verified ? 'Verified Teacher' : empanelled ? 'Empanelled Teacher' : 'NOSTOPS Teacher';
  const badgeBorder = empanelled ? '#F59E0B' : 'rgba(255,255,255,0.45)';
  const badgeBg = empanelled ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.14)';

  const parampara = t.parampara ? `${titleCase(String(t.parampara))} tradition` : '';
  const exp = typeof t.experience_years === 'number' && t.experience_years > 0 ? `${t.experience_years} yrs teaching` : '';
  const city = t.city ? titleCase(String(t.city)) : '';
  const sub = [parampara, exp, city].filter(Boolean).join('  ·  ');

  const avatar = await loadAvatarDataUri(t);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          background: 'linear-gradient(135deg, #2E1065 0%, #6D28D9 55%, #4338CA 100%)',
        }}
      >
        {/* top row: wordmark + standing */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
            <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.72)' }}>
              A Teacher&apos;s-First Yoga Cooperative
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 28,
              fontWeight: 700,
              padding: '12px 26px',
              borderRadius: 999,
              background: badgeBg,
              border: `2px solid ${badgeBorder}`,
            }}
          >
            {badge}
          </div>
        </div>

        {/* middle: photo/initials + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              width={240}
              height={240}
              style={{ width: 240, height: 240, borderRadius: 36, objectFit: 'cover', border: '6px solid rgba(255,255,255,0.28)' }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 240,
                height: 240,
                borderRadius: 36,
                background: 'rgba(255,255,255,0.12)',
                border: '6px solid rgba(255,255,255,0.28)',
                fontSize: 96,
                fontWeight: 800,
              }}
            >
              {initials(name)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
            <div style={{ display: 'flex', fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
            {sub ? (
              <div style={{ display: 'flex', marginTop: 20, fontSize: 34, color: 'rgba(255,255,255,0.86)' }}>{sub}</div>
            ) : (
              <div style={{ display: 'flex', marginTop: 20, fontSize: 34, color: 'rgba(255,255,255,0.86)' }}>Yoga Teacher</div>
            )}
          </div>
        </div>

        {/* bottom row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 26,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          <div style={{ display: 'flex' }}>nostops.org/teachers/{handle}</div>
          <div style={{ display: 'flex' }}>Empanelled Yoga Teachers Network</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
