import { renderClaimOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/claim-og';

// Twitter/X card for the claim hub (same branded card as OG).
export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Claim your yoga teaching profile on NOSTOPS';

export default function TwitterImage() {
  return renderClaimOg({
    title: 'Claim your teaching profile',
    subtitle: 'Search your name & city, find your listing, and claim it free — no payment.',
  });
}
