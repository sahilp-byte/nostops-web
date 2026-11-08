import type { Metadata } from 'next';
import FestiveKycPage from '@/components/festive/FestiveKycPage';
import { pageMetadata } from '@/lib/seo';
import { getFestivePublic } from '@/lib/server/festive-public';

export const revalidate = 60;

// Public, indexable (also after the campaign ends, as an archived page — owner decision).
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Free InstaKYC for Indian Yoga Teachers — Festive Season 2026',
    description:
      'NOSTOPS Festive Season Celebration: eligible Indian yoga teachers get complimentary InstaKYC (₹0) from 1 November to 31 December 2026. Complete 80% of your profile and claim.',
    path: '/festive-free-kyc',
    image: { url: '/brand/festive/og-festive-free-kyc.jpg', alt: 'NOSTOPS Festive Season — Your InstaKYC is on us! 1 Nov – 31 Dec 2026' },
  });
}

export default async function Page() {
  const campaign = await getFestivePublic();
  return <FestiveKycPage campaign={campaign} />;
}
