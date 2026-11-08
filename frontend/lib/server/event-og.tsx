import { ImageResponse } from 'next/og';
import { getPublicEvent } from '@/lib/server/institutional';
import { eventPriceLabel, eventWhenShort } from '@/lib/event-seo';

// Per-event social share card (1200x630): NOSTOPS branding + the event's name,
// date, city, organiser and price, so a shared event (or Register) link
// previews as itself. Flat gradient, no remote images, so every scraper —
// including WhatsApp and LinkedIn — renders it reliably.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';
export const OG_ALT = 'Yoga programme on NOSTOPS';

function clamp(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export async function renderEventOg(slug: string): Promise<ImageResponse> {
  const ev = await getPublicEvent(slug).catch(() => null);

  const title = clamp(ev?.title || 'Council-curated yoga programmes', 90);
  const titleSize = title.length > 60 ? 54 : 64;
  const tag = ev?.demo ? 'Illustrative example' : `${ev?.programme?.taxonomy_label || 'Yoga'} Programme`;
  const accent = !!ev?.demo;
  const sub = ev
    ? [eventWhenShort(ev), ev.city].filter(Boolean).join('   ·   ')
    : 'For companies, campuses and startup networks across India';
  const org = ev?.organisation?.name ? clamp(`Organised by ${ev.organisation.name}`, 70) : '';
  const price = ev ? eventPriceLabel(ev) : 'nostops.org/programmes';
  const cta = ev && ev.registration_open && ev.registration_access !== 'ORGANISATION_ONLY'
    ? 'Register at nostops.org' : 'nostops.org';

  return new ImageResponse(
    (
      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif', background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)' }}>
        <div style={{ position: 'absolute', top: -90, left: -90, width: 340, height: 340, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -120, right: -60, width: 360, height: 360, borderRadius: 999, background: 'rgba(245,158,11,0.14)', display: 'flex' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '60px 72px', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
              <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.72)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: accent ? 'rgba(245,158,11,0.30)' : 'rgba(13,148,136,0.30)', border: `2px solid ${accent ? '#F59E0B' : '#2DD4BF'}` }}>
              {tag}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1040 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.78)' }}>COUNCIL-CURATED YOGA PROGRAMME</div>
            <div style={{ display: 'flex', marginTop: 12, fontSize: titleSize, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
            {sub ? <div style={{ display: 'flex', marginTop: 18, fontSize: 30, color: 'rgba(255,255,255,0.92)' }}>{sub}</div> : null}
            {org ? <div style={{ display: 'flex', marginTop: 10, fontSize: 26, color: 'rgba(255,255,255,0.80)' }}>{org}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: 'rgba(255,255,255,0.88)' }}>
            <div style={{ display: 'flex', fontWeight: 700 }}>{price}</div>
            <div style={{ display: 'flex' }}>{cta}</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
