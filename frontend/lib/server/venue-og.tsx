import { ImageResponse } from 'next/og';
import { titleCase } from '@/lib/format';
import { getVenue } from '@/lib/server/venues';

// Per-venue social share image (1200x630). Renders a clean, self-hosted branded
// card (NOSTOPS gradient + venue name, location and key facts) so a shared venue
// link previews as itself, not a generic card. Kept flat/lightweight (~150KB PNG,
// no embedded photo) and exactly 1200x630 so every scraper — including WhatsApp
// and LinkedIn, which reject large/unsized images — reliably renders it.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

function clamp(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function renderVenueOg(id: string): Promise<ImageResponse> {
  let v: Awaited<ReturnType<typeof getVenue>> = null;
  try {
    v = await getVenue(id);
  } catch {
    v = null;
  }

  const name = clamp(v?.name || 'Yoga Retreat Venue', 72);
  const loc = [v?.city, v?.state]
    .filter(Boolean)
    .map((s) => titleCase(String(s)))
    .join(', ');
  const eyebrow = (loc || 'Retreat Venue').toUpperCase();
  const capacity = typeof v?.capacity === 'number' && v.capacity > 0 ? `Sleeps ${v.capacity}` : '';
  const sattvic = v?.sattvicCertified ? 'Sattvic kitchen' : '';
  const framing = v?.bestForFramings?.[0] ? titleCase(v.bestForFramings[0]) : '';
  const sub = [capacity, sattvic].filter(Boolean).join('   ·   ');
  const foot = framing ? `Best for ${framing}` : 'Host your retreat at a trusted venue';

  return new ImageResponse(
    (
      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: 'flex',
            background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '64px 72px',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
              <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.72)' }}>
                A Teacher&apos;s-First Yoga Cooperative
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 24,
                fontWeight: 700,
                padding: '10px 24px',
                borderRadius: 999,
                background: 'rgba(245,158,11,0.22)',
                border: '2px solid #F59E0B',
              }}
            >
              Venue
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1010 }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.82)', letterSpacing: 1 }}>
              {eyebrow}
            </div>
            <div style={{ display: 'flex', marginTop: 12, fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
            {sub ? (
              <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: 'rgba(255,255,255,0.92)' }}>{sub}</div>
            ) : null}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 24,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <div style={{ display: 'flex', fontWeight: 700 }}>{foot}</div>
            <div style={{ display: 'flex' }}>nostops.org/venues</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
