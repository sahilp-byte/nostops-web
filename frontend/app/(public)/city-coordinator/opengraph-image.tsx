import { renderCityCoordinatorOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/city-coordinator-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Become a NOSTOPS City Coordinator';

export default function OgImage() {
  return renderCityCoordinatorOg();
}
