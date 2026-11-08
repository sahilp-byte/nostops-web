import { renderClaimOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/claim-og';
import { getProvisionalProfile } from '@/lib/server/discovery';

// Branded Open Graph card for an individual provisional teacher profile.
export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Claim your NOSTOPS teaching profile';

export default async function OgImage(
  { params }: { params: Promise<{ city: string; teacher: string }> },
) {
  const { city, teacher } = await params;
  let name = 'Your teaching profile';
  let place = '';
  try {
    const data = await getProvisionalProfile(city, teacher);
    if (data) {
      name = data.profile.name || name;
      place = [data.profile.locality, data.profile.city].filter(Boolean).join(', ');
    }
  } catch {
    /* fall back to generic copy */
  }
  return renderClaimOg({
    title: name,
    subtitle: place ? `Provisional profile · ${place}` : 'A provisional NOSTOPS teaching profile',
    badge: 'Provisional profile',
  });
}
