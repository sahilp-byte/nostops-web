import { ImageResponse } from 'next/og';
import { getYogaCity } from '@/lib/server/yoga-city';
import { fetchPhotoDataUri, toJpeg } from '@/lib/server/photo-og';
import { cityPhotoCandidates, cityDisplayLabel } from '@/lib/server/og-photos';

// Per-city social share image (1200x630) for /yoga-teachers/{city}. Launch
// cities render a signature local PHOTO (full-bleed, with a dark scrim) behind
// the city name + live community stats; every other city falls back to the
// branded NOSTOPS gradient card. Output is JPEG so every scraper (WhatsApp,
// LinkedIn, X) renders it reliably.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/jpeg';

function Pill({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 30px', borderRadius: 22, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
      <div style={{ display: 'flex', fontSize: 48, fontWeight: 800 }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.80)' }}>{label}</div>
    </div>
  );
}

// Shared foreground: NOSTOPS header, city headline, live stats, footer — white
// text that reads over either the gradient or a scrimmed photo.
function CityContent({ label, sub, slug, stats }: { label: string; sub: string; slug: string; stats: { value: number; label: string }[] }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 72px', color: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
          <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.80)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: 'rgba(13,148,136,0.42)', border: '2px solid #2DD4BF' }}>
          Yoga Teachers
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1010 }}>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>Yoga Teachers in {label}</div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: 'rgba(255,255,255,0.92)' }}>{sub}</div>
        {stats.length > 0 ? (
          <div style={{ display: 'flex', gap: 18, marginTop: 32 }}>
            {stats.map((s) => (
              <Pill key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: 'rgba(255,255,255,0.88)' }}>
        <div style={{ display: 'flex' }}>nostops.org/yoga-teachers/{slug}</div>
        <div style={{ display: 'flex' }}>Find your Guru. Honour the tradition.</div>
      </div>
    </div>
  );
}

export async function renderCityOg(slug: string): Promise<Response> {
  let d = null;
  try {
    d = await getYogaCity(slug);
  } catch {
    d = null;
  }

  const label = cityDisplayLabel(slug) || d?.label || 'India';
  const teacherCount = d?.teacherCount || 0;
  const empanelledCount = d?.empanelledCount || 0;
  const verifiedCount = d?.verifiedCount || 0;
  const traditionCount = d?.traditionCount || 0;
  // Launch cities with no listings yet read as an invitation rather than "0".
  const sub = teacherCount > 0
    ? `${teacherCount} verified ${teacherCount === 1 ? 'teacher' : 'teachers'}${traditionCount > 0 ? `   ·   ${traditionCount} traditions & styles` : ''}`
    : 'Empanelled yoga teachers · retreats & venues';

  const stats = teacherCount > 0
    ? [
        { value: teacherCount, label: teacherCount === 1 ? 'Teacher' : 'Teachers' },
        ...(empanelledCount > 0 ? [{ value: empanelledCount, label: 'Empanelled' }] : []),
        ...(verifiedCount > 0 ? [{ value: verifiedCount, label: 'Verified' }] : []),
      ]
    : [];
  const citySlug = d?.slug || slug;

  // Launch cities get a signature local photo; others fall back to the gradient.
  let photo: string | null = null;
  for (const c of cityPhotoCandidates(slug)) {
    photo = await fetchPhotoDataUri(c);
    if (photo) break;
  }

  const img = new ImageResponse(
    photo ? (
      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og ImageResponse renders plain <img> */}
        <img alt="" src={photo} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }} />
        {/* Left-weighted scrim keeps the headline + stats legible over any skyline. */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(90deg, rgba(8,11,23,0.90) 0%, rgba(8,11,23,0.58) 48%, rgba(8,11,23,0.20) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(180deg, rgba(8,11,23,0.42) 0%, rgba(8,11,23,0.00) 32%, rgba(8,11,23,0.00) 56%, rgba(8,11,23,0.82) 100%)' }} />
        <CityContent label={label} sub={sub} slug={citySlug} stats={stats} />
      </div>
    ) : (
      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif', background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)' }}>
        <div style={{ position: 'absolute', top: -90, left: -90, width: 340, height: 340, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -120, right: -60, width: 360, height: 360, borderRadius: 999, background: 'rgba(245,158,11,0.14)', display: 'flex' }} />
        <CityContent label={label} sub={sub} slug={citySlug} stats={stats} />
      </div>
    ),
    { ...OG_SIZE },
  );
  return toJpeg(img);
}
