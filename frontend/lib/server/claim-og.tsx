import { ImageResponse } from 'next/og';

// Branded social share card (1200x630) for the "Claim your teaching profile"
// hub and individual provisional teacher pages. Mirrors the NOSTOPS gradient
// card used for city OG images so every share preview stays on-brand.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export function renderClaimOg({
  title,
  subtitle,
  badge = 'For Yoga Teachers',
  footer = 'Claim your profile — FREE',
}: {
  title: string;
  subtitle: string;
  badge?: string;
  footer?: string;
}): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif', background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)' }}>
        <div style={{ position: 'absolute', top: -90, left: -90, width: 340, height: 340, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -120, right: -60, width: 360, height: 360, borderRadius: 999, background: 'rgba(245,158,11,0.14)', display: 'flex' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 72px', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
              <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.72)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: 'rgba(13,148,136,0.30)', border: '2px solid #0D9488' }}>
              {badge}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1010 }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
            <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: 'rgba(255,255,255,0.90)' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: 'rgba(255,255,255,0.85)' }}>
            <div style={{ display: 'flex' }}>nostops.org/claim</div>
            <div style={{ display: 'flex' }}>{footer}</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
