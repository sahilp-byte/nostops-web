import { ImageResponse } from 'next/og';
import { Card, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';
import { apiGet } from '@/lib/api';
import { visibleCouncilMembers } from '@/lib/council-visibility';
import { getCouncilGate } from '@/lib/server/council-gate';

// Branded social share cards for the Council of Gurus hub + each member page.
// Reuses the shared gradient Card so the Council matches the gurus / scriptures
// / paramparā cards. Member data comes from the embedded Organization roster in
// /seo/council (same source the pages use).
export { OG_SIZE, OG_CONTENT_TYPE };

type CouncilData = { meta?: Record<string, string>; jsonld?: unknown[] };

function slugFromUrl(u?: string): string | null {
  if (!u || typeof u !== 'string') return null;
  const m = /\/council\/([^/?#"']+)/.exec(u);
  return m ? m[1] : null;
}

async function getCouncilMembers(): Promise<{ slug: string; name: string; jobTitle?: string; city?: string }[]> {
  let data: CouncilData | null = null;
  try {
    data = await apiGet<CouncilData>('/seo/council', { revalidate: 86400 });
  } catch {
    return [];
  }
  const org = Array.isArray(data?.jsonld) ? (data!.jsonld as any[]).find((o) => o?.['@type'] === 'Organization') : null;
  const raw: any[] = visibleCouncilMembers(Array.isArray(org?.member) ? org.member : [], await getCouncilGate());
  return raw
    .map((m) => {
      const slug = slugFromUrl(m?.url);
      if (!slug) return null;
      return { slug, name: String(m?.name || ''), jobTitle: m?.jobTitle || undefined, city: m?.address?.addressLocality || undefined };
    })
    .filter((m): m is NonNullable<typeof m> => !!m && !!m.name);
}

export async function renderCouncilHubOg(): Promise<ImageResponse> {
  let count = 0;
  try { count = (await getCouncilMembers()).length; } catch { count = 0; }
  return new ImageResponse(
    <Card eyebrow="COUNCIL OF GURUS" title="Council of Yoga Gurus"
      sub={count > 0 ? `${count} empanelled Gurus safeguarding lineage & ethics` : 'Stewards of authentic yoga in India'}
      tag="Guru Council" footer="nostops.org/council" />,
    { ...OG_SIZE },
  );
}

export async function renderCouncilMemberOg(slug: string): Promise<ImageResponse> {
  let member = null;
  try { member = (await getCouncilMembers()).find((m) => m.slug === slug) || null; } catch { member = null; }
  if (!member) return renderCouncilHubOg();
  return new ImageResponse(
    <Card eyebrow="COUNCIL OF YOGA GURUS" title={member.name}
      sub={[member.jobTitle, member.city].filter(Boolean).join(' · ') || 'Council Guru'}
      tag="Council Guru" footer={`nostops.org/council/${slug}`} />,
    { ...OG_SIZE },
  );
}
