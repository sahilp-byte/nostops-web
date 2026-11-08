import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getProvisionalProfile } from '@/lib/server/discovery';
import { getCityCoordinator } from '@/lib/server/city-coordinator';
import { detectVisitorCity } from '@/lib/server/detect-city';
import ProvisionalClaimClient from '@/components/discovery/ProvisionalClaimClient';
import { canonical } from '@/lib/site';

// Provisional teacher profile + FREE claim.
//   /teachers/in/{city-slug}/{teacher-slug}
// Server-rendered from the LOCAL discovery store (no static HTML).
// NOINDEX while unclaimed: a thin, consent-pending listing must not be indexed or
// made to look like a Google Business Profile. Once a teacher has CLAIMED it
// (owner rule — the claim is their consent) the page is indexable and is listed
// in the sitemap and site search; after graduation it redirects to the live profile.
export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ city: string; teacher: string }> },
): Promise<Metadata> {
  const { city, teacher } = await params;
  const data = await getProvisionalProfile(city, teacher);
  if (!data) return { title: 'Provisional profile', robots: { index: false, follow: false } };
  const p = data.profile;
  const place = [p.locality, p.city].filter(Boolean).join(', ');
  const indexable = data.indexable;
  const robots = indexable ? { index: true, follow: true } : { index: false, follow: false };
  const description = indexable
    ? `${p.name}${place ? ` in ${place}` : ''} has claimed this NOSTOPS yoga teacher listing. Their full profile is on the way.`
    : `A provisional NOSTOPS teacher profile for ${p.name}${place ? `, ${place}` : ''}. Claim it free.`;
  // The root layout's title template appends " · NOSTOPS".
  const title = indexable
    ? `${p.name}${p.city ? ` · Yoga in ${p.city}` : ''}`
    : `${p.name} — Provisional profile`;
  return {
    title,
    description,
    robots,
    ...(indexable ? { alternates: { canonical: canonical(`/teachers/in/${p.city_slug}/${p.teacher_slug}`) } } : {}),
    openGraph: {
      type: 'profile',
      title: `${title} · NOSTOPS`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · NOSTOPS`,
      description,
    },
  };
}

export default async function ProvisionalProfilePage(
  { params }: { params: Promise<{ city: string; teacher: string }> },
) {
  const { city, teacher } = await params;
  const data = await getProvisionalProfile(city, teacher);
  if (!data) notFound();

  // Graduation: once the teacher's verified profile is live, the provisional URL
  // permanently redirects to it, so there is only ever one public home.
  if (data.profile.verified_handle) {
    permanentRedirect(`/teachers/${data.profile.verified_handle}`);
  }

  const thisUrl = `/teachers/in/${city}/${teacher}`;
  // "City coordinators near me": resolve the coordinator for the VISITOR's own
  // detected city (geo/saved), not the profile's city — so a teacher always
  // sees a local human they can reach. Fails open to null (NOSTOPS-team
  // fallback) when no city is detected or none is listed for it yet.
  const near = await detectVisitorCity();
  const coordinator = near.slug ? await getCityCoordinator(near.slug) : null;
  return (
    <ProvisionalClaimClient
      profile={data.profile}
      signedIn={data.signedIn}
      claimPath={`/bff/discovery/claim/${encodeURIComponent(city)}/${encodeURIComponent(teacher)}`}
      loginHref={`/login?next=${encodeURIComponent(thisUrl)}`}
      onboardingHref="/app/teacher/onboarding"
      coordinator={coordinator}
      cityLabel={near.label || data.profile.city}
    />
  );
}
