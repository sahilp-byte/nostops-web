import { renderParamparaHubOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Yoga's Living Traditions · NOSTOPS Yogic Paramparā";

export default function OgImage() {
  return renderParamparaHubOg();
}
