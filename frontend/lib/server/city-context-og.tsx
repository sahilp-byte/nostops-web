import { ImageResponse } from 'next/og';
import { Card, OG_SIZE } from '@/lib/server/parampara-og';
import { getPublicRetreats } from '@/lib/server/retreats';
import { citySlug, getCityEcosystem } from '@/lib/server/cities';

// Per-city social-share cards for the two flagship city landing routes:
//   /retreats/in/{city}        -> "Yoga Retreats in {City}"
//   /become-a-teacher/{city}   -> "Become a Yoga Teacher in {City}"
// Both reuse the shared branded gradient Card so the whole site keeps one
// consistent OG identity, but stamp the live city name + counts so each city
// shares with its own tailored preview. Data lookups fall back gracefully.

export async function renderRetreatsCityOg(slug: string): Promise<ImageResponse> {
  let label = 'India';
  let count = 0;
  try {
    const { retreats } = await getPublicRetreats();
    const list = retreats.filter((r) => r.city && citySlug(r.city) === slug);
    count = list.length;
    label = (list.find((r) => r.city)?.city as string) || slug;
  } catch {
    /* fall back to generic label */
  }
  const sub =
    count > 0
      ? `${count} immersive ${count === 1 ? 'retreat' : 'retreats'} led by teachers you can trust`
      : 'Immersive retreats led by teachers you can trust';
  return new ImageResponse(
    <Card
      eyebrow="YOGA RETREATS"
      title={`Yoga Retreats in ${label}`}
      sub={sub}
      tag="Explore"
      footer={`nostops.org/retreats/in/${slug}`}
    />,
    { ...OG_SIZE },
  );
}

export async function renderBecomeTeacherCityOg(slug: string): Promise<ImageResponse> {
  let label = 'India';
  let teacherCount = 0;
  let traditionCount = 0;
  try {
    const eco = await getCityEcosystem(slug);
    if (eco) {
      label = eco.label;
      teacherCount = eco.teacherCount;
      traditionCount = eco.traditionCount;
    }
  } catch {
    /* fall back to generic label */
  }
  const bits: string[] = [];
  if (teacherCount > 0) bits.push(`Join ${teacherCount} ${teacherCount === 1 ? 'teacher' : 'teachers'}`);
  if (traditionCount > 0) bits.push(`${traditionCount} ${traditionCount === 1 ? 'tradition' : 'traditions'}`);
  const sub = bits.length
    ? `${bits.join(' · ')} · your profile is always free`
    : 'A teacher-first cooperative · your profile is always free';
  return new ImageResponse(
    <Card
      eyebrow="TEACHERS NETWORK"
      title={`Become a Yoga Teacher in ${label}`}
      sub={sub}
      tag="Join free"
      tagAccent
      footer={`nostops.org/become-a-teacher/${slug}`}
    />,
    { ...OG_SIZE },
  );
}
