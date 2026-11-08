import { renderCouncilMemberOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/council-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Council Guru';

export default async function TwitterImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderCouncilMemberOg(slug);
}
