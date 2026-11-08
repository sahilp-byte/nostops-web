import { ImageResponse } from 'next/og';
import { Card, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

// Branded social share card for the City Coordinator programme hub. Reuses the
// shared gradient Card so it matches the Council / Gurus / Paramparā cards —
// consistent with the site's SEO OG foundation (file-based next/og images).
export { OG_SIZE, OG_CONTENT_TYPE };

export function renderCityCoordinatorOg(): ImageResponse {
  return new ImageResponse(
    (
      <Card
        eyebrow="CITY COORDINATOR PROGRAMME"
        title="Become a City Coordinator"
        sub="For empanelled Yoga Level 2 & 3 teachers · 9 cities across India"
        tag="Now inviting"
        tagAccent
        footer="nostops.org/city-coordinator"
      />
    ),
    { ...OG_SIZE },
  );
}
