import { ImageResponse } from 'next/og';
import { apiGet } from '@/lib/api';
import { titleCase, inr } from '@/lib/format';
import { toPublicRetreat, fmtRange, type PublicRetreat } from '@/lib/server/retreats';

// Per-retreat social share image (1200x630). Renders a clean, self-hosted branded
// card (NOSTOPS gradient + title, hosting teacher, city, dates and price) so a
// shared retreat link previews as itself, not a generic card. Kept flat/lightweight
// (~150KB PNG, no embedded photo) and exactly 1200x630 so every scraper — including
// WhatsApp and LinkedIn, which reject large/unsized images — reliably renders it.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

function clamp(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function renderRetreatOg(id: string): Promise<ImageResponse> {
  let r: PublicRetreat | null = null;
  try {
    const raw = id ? await apiGet<any>(`/retreats/${id}`, { revalidate: 300 }) : null;
    r = raw ? toPublicRetreat(raw) : null;
  } catch {
    r = null;
  }

  const title = clamp(r?.title || 'Yoga Retreat', 80);
  const theme = (r?.theme ? titleCase(r.theme) : 'Immersive Gathering').toUpperCase();
  const teacher = r?.guruName ? `with ${r.guruName}` : '';
  const city = r?.city ? titleCase(r.city) : '';
  const dates = fmtRange(r?.startDate, r?.endDate);
  const sub = [teacher, city, dates].filter(Boolean).join('   ·   ');
  const price = typeof r?.priceInr === 'number' && r.priceInr > 0 ? `from ₹${inr(r.priceInr)}` : 'nostops.org/retreats';

  return new ImageResponse(
    (
      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 72px', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
              <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.72)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: 'rgba(245,158,11,0.22)', border: '2px solid #F59E0B' }}>
              Yoga Retreat
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1010 }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.82)', letterSpacing: 1 }}>{theme}</div>
            <div style={{ display: 'flex', marginTop: 12, fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
            {sub ? <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: 'rgba(255,255,255,0.92)' }}>{sub}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: 'rgba(255,255,255,0.85)' }}>
            <div style={{ display: 'flex', fontWeight: 700 }}>{price}</div>
            <div style={{ display: 'flex' }}>Book authentic, teacher-led retreats</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
