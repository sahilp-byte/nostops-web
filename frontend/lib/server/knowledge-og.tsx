import { ImageResponse } from 'next/og';
import { Card, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';
import { getGuru, getScripture, type GuruNode } from '@/lib/server/knowledge';
import { getObject } from '@/lib/server/object-storage';

// Lightweight (flat-gradient, no external images) social share cards for the
// standalone Guru (Ācārya) and Scripture (Śāstra) pages. Reuses the shared
// gradient Card from parampara-og so all knowledge pages share one visual style.
export { OG_SIZE, OG_CONTENT_TYPE };

// Guru card WITH portrait (portrait fetched server-side from object storage and
// inlined as a data URL so Satori never has to make a network call at render).
function GuruPortraitCard({ g, img }: { g: GuruNode; img: string }) {
  const sub = [g.tradition, g.period].filter(Boolean).join(' · ');
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', fontFamily: 'sans-serif', background: 'linear-gradient(135deg, #0F172A 0%, #6D28D9 55%, #0D9488 100%)' }}>
      <div style={{ position: 'absolute', top: -90, left: -90, width: 340, height: 340, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 72px', color: '#ffffff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>NOSTOPS</div>
            <div style={{ display: 'flex', fontSize: 18, color: 'rgba(255,255,255,0.72)' }}>A Teacher&apos;s-First Yoga Cooperative</div>
          </div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 22, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.72)' }}>YOGA GURU · ĀCĀRYA</div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{g.canonical_name}</div>
          {sub ? <div style={{ display: 'flex', marginTop: 18, fontSize: 28, color: 'rgba(255,255,255,0.9)' }}>{sub}</div> : null}
          <div style={{ display: 'flex', marginTop: 44, fontSize: 22, color: 'rgba(255,255,255,0.85)' }}>{`nostops.org/gurus/${g.slug}`}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={img} width={360} height={360} style={{ width: 360, height: 360, objectFit: 'cover', borderRadius: 28, border: '6px solid rgba(255,255,255,0.28)' }} />
      </div>
    </div>
  );
}

export async function renderGuruOg(slug: string): Promise<ImageResponse> {
  let d = null;
  try { d = await getGuru(slug); } catch { d = null; }
  if (!d) return renderGuruHubOg();
  const g = d.guru;
  let img: string | null = null;
  if (g.portrait_url && g.portrait_url.startsWith('/bff/media/')) {
    try {
      const rel = g.portrait_url.replace('/bff/media/', ''); // retreats/_gurus/x.jpg
      const obj = await getObject(`nostops/${rel}`);
      if (obj) img = `data:${obj.contentType};base64,${Buffer.from(obj.body).toString('base64')}`;
    } catch { img = null; }
  }
  if (img) {
    return new ImageResponse(<GuruPortraitCard g={g} img={img} />, { ...OG_SIZE });
  }
  return new ImageResponse(
    <Card eyebrow="YOGA GURU · ĀCĀRYA" title={g.canonical_name}
      sub={[g.tradition, g.period].filter(Boolean).join(' · ') || undefined}
      tag="Lineage" footer={`nostops.org/gurus/${g.slug}`} />,
    { ...OG_SIZE },
  );
}
export function renderGuruHubOg(): ImageResponse {
  return new ImageResponse(
    <Card eyebrow="YOGA GURUS · ĀCĀRYAS" title="The Gurus of Yoga"
      sub="The teachers through whom Yoga has been transmitted" tag="Explore"
      footer="nostops.org/gurus" />,
    { ...OG_SIZE },
  );
}

export async function renderScriptureOg(slug: string): Promise<ImageResponse> {
  let d = null;
  try { d = await getScripture(slug); } catch { d = null; }
  if (!d) return renderScriptureHubOg();
  const s = d.scripture;
  return new ImageResponse(
    <Card eyebrow="YOGA SCRIPTURE · ŚĀSTRA" title={s.canonical_name}
      sub={[s.tradition, s.period].filter(Boolean).join(' · ') || undefined}
      tag="Key text" tagAccent footer={`nostops.org/scriptures/${s.slug}`} />,
    { ...OG_SIZE },
  );
}
export function renderScriptureHubOg(): ImageResponse {
  return new ImageResponse(
    <Card eyebrow="YOGA SCRIPTURES · ŚĀSTRA" title="The Texts of Yoga"
      sub="The foundational scriptures of the yogic traditions" tag="Explore" tagAccent
      footer="nostops.org/scriptures" />,
    { ...OG_SIZE },
  );
}
