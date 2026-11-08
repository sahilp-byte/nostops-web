import { ImageResponse } from 'next/og';
import { getParampara, isModern, traditionKindLabel } from '@/lib/server/knowledge';
import { getYogaCitySegment } from '@/lib/server/yoga-city';
import { titleCase } from '@/lib/format';

// Lightweight (flat-gradient, no external images) social share cards for the
// Yogic Paramparā "living traditions" pages and the city+tradition combo pages.
// Kept ~simple per the Satori constraints so WhatsApp/LinkedIn never time out.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export function Card({ eyebrow, title, sub, tag, tagAccent, footer }: {
  eyebrow: string; title: string; sub?: string; tag?: string; tagAccent?: boolean; footer: string;
}) {
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif', background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)' }}>
      <div style={{ position: 'absolute', top: -90, left: -90, width: 340, height: 340, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
      <div style={{ position: 'absolute', bottom: -120, right: -60, width: 360, height: 360, borderRadius: 999, background: 'rgba(245,158,11,0.14)', display: 'flex' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 72px', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
            <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.72)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
          </div>
          {tag ? (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: tagAccent ? 'rgba(245,158,11,0.30)' : 'rgba(13,148,136,0.30)', border: `2px solid ${tagAccent ? '#F59E0B' : '#0D9488'}` }}>{tag}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1010 }}>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.72)' }}>{eyebrow}</div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 70, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          {sub ? <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: 'rgba(255,255,255,0.90)' }}>{sub}</div> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: 'rgba(255,255,255,0.85)' }}>
          <div style={{ display: 'flex' }}>{footer}</div>
          <div style={{ display: 'flex' }}>Find your Guru. Honour the tradition.</div>
        </div>
      </div>
    </div>
  );
}

export async function renderParamparaOg(slug: string): Promise<ImageResponse> {
  let d = null;
  try { d = await getParampara(slug); } catch { d = null; }
  if (!d) return renderParamparaHubOg();
  const p = d.parampara;
  const modern = isModern(p.classification);
  return new ImageResponse(
    <Card eyebrow="YOGIC PARAMPARĀ" title={p.display_name} sub={p.classification}
      tag={traditionKindLabel(p.classification)} tagAccent={modern}
      footer={`nostops.org/yoga-parampara/${p.slug}`} />,
    { ...OG_SIZE },
  );
}

export function renderParamparaHubOg(): ImageResponse {
  return new ImageResponse(
    <Card eyebrow="YOGIC PARAMPARĀ" title="Yoga's Living Traditions"
      sub="Traditions, teachers, texts & practices" tag="Explore"
      footer="nostops.org/yoga-parampara" />,
    { ...OG_SIZE },
  );
}

export async function renderSegmentOg(city: string, segment: string): Promise<ImageResponse> {
  let d = null;
  try { d = await getYogaCitySegment(city, segment); } catch { d = null; }
  if (!d) return renderParamparaHubOg();
  const count = d.count || 0;
  return new ImageResponse(
    <Card eyebrow="NOSTOPS YOGA TEACHERS" title={`${titleCase(d.label)} Yoga in ${d.cityLabel}`}
      sub={`${count} ${count === 1 ? 'teacher' : 'teachers'} carrying this tradition`}
      tag="Book directly" footer={`nostops.org/yoga-teachers/${d.citySlug}/${d.slug}`} />,
    { ...OG_SIZE },
  );
}
