import { renderClaimOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/claim-og';

// Branded Open Graph card for the "Claim your teaching profile" hub.
export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Claim your yoga teaching profile on NOSTOPS';

export default function OgImage() {
  return renderClaimOg({
    title: 'Claim your teaching profile',
    subtitle: 'Search your name & city, find your listing, and claim it free — no payment.',
  });
}
