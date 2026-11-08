import { renderParamparaOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Yogic Paramparā tradition';

export default async function TwitterImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderParamparaOg(slug);
}
