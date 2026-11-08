import { renderCouncilHubOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/council-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Council of Yoga Gurus · NOSTOPS';

export default function OgImage() {
  return renderCouncilHubOg();
}
