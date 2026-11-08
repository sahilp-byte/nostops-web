import { renderGuruHubOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/knowledge-og';

export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'The Gurus of Yoga · NOSTOPS';

export default function TwitterImage() {
  return renderGuruHubOg();
}
