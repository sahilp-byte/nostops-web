import type { Metadata, Viewport } from 'next';
import { apiGetSafe } from '@/lib/api';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { listProgrammes } from '@/lib/server/institutional';
import { JsonLd } from '@/components/JsonLd';
import HomeHeroBanner from '@/components/home/HomeHeroBanner';
import CelebrationStrip from '@/components/home/CelebrationStrip';
import WhoAreYou from '@/components/home/WhoAreYou';
import OrgSection from '@/components/home/OrgSection';
import PathwaysSection from '@/components/home/PathwaysSection';
import CooperativeSection from '@/components/home/CooperativeSection';
import ProgrammesSection, { pickHomeProgrammes } from '@/components/home/ProgrammesSection';
import JourneySection from '@/components/home/JourneySection';
import RetreatsSection from '@/components/home/RetreatsSection';
import ClosingBanner from '@/components/home/ClosingBanner';
import FestiveCelebration from '@/components/festive/FestiveCelebration';
import { getFestivePublic } from '@/lib/server/festive-public';

export const dynamic = 'force-dynamic';

const HOME_TITLE = 'Yoga se kya hoga? · Join the NOSTOPS Empanelled Yoga Teachers Network';
const HOME_OG_TITLE = "Yoga se kya hoga? · India's Teacher-First Yoga Cooperative";
const HOME_DESC =
  "NOSTOPS is India's teacher-first yoga cooperative. Join the Empanelled Yoga Teachers Network, or bring curated yoga programmes to your organisation.";
const HOME_CANONICAL = canonical('/');
// Social / link-preview card built from the current homepage hero (1200×630, ~130 KB — small enough for WhatsApp).
const OG_IMAGE = '/brand/og-home-v2.jpg';
const OG_ALT = "Yoga se kya hoga? NOSTOPS — India's Teacher-First Yoga Cooperative: a yoga teacher and a group meditating on a hilltop at sunrise";
const ROBOTS_DIRECTIVES = { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } as const;

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESC,
  applicationName: 'NOSTOPS',
  keywords: [
    'Yoga se kya hoga',
    'teacher-first yoga cooperative',
    'yoga teachers network',
    'empanelled yoga teachers',
    'verified yoga teachers',
    'yoga teachers in India',
    'yoga teaching opportunities',
    'yoga for organisations',
    'corporate yoga programmes India',
    'yoga programmes for schools and colleges',
    'workplace wellbeing yoga',
    'yoga retreats India',
    'Council of Yoga Gurus',
    'Guru–Shishya Parampara',
  ],
  authors: [{ name: 'NOSTOPS', url: HOME_CANONICAL }],
  creator: 'NOSTOPS',
  publisher: 'NOSTOPS',
  category: 'Health & Wellness',
  classification: 'Yoga teachers, yoga programmes for organisations and yoga retreats in India',
  alternates: {
    canonical: HOME_CANONICAL,
    languages: { 'en-IN': HOME_CANONICAL, 'x-default': HOME_CANONICAL },
    // Plain-language site guide for AI assistants and answer engines (llms.txt convention).
    types: { 'text/markdown': canonical('/llms.txt') },
  },
  robots: { ...ROBOTS_DIRECTIVES, googleBot: { ...ROBOTS_DIRECTIVES } },
  openGraph: {
    type: 'website',
    siteName: 'NOSTOPS',
    url: HOME_CANONICAL,
    title: HOME_OG_TITLE,
    description: HOME_DESC,
    locale: 'en_IN',
    images: [{ url: OG_IMAGE, secureUrl: canonical(OG_IMAGE), width: 1200, height: 630, alt: OG_ALT, type: 'image/jpeg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_OG_TITLE,
    description: HOME_DESC,
    images: [{ url: OG_IMAGE, alt: OG_ALT }],
  },
  appleWebApp: { title: 'NOSTOPS' },
  formatDetection: { telephone: false, email: false, address: false },
  other: {
    bingbot: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    'geo.region': 'IN',
    'geo.placename': 'India',
  },
};

export const viewport: Viewport = { themeColor: '#EF7D22' };

// Same three pathways as the /programmes page fallback, used only if the catalogue is unreachable.
const FALLBACK_PATHWAYS = [
  { key: 'MIND', label: 'Mind', slug: 'mind' },
  { key: 'BODY', label: 'Body', slug: 'body' },
  { key: 'SPECIAL_NEEDS', label: 'Special Needs', slug: 'special-needs' },
];

export default async function HomePage() {
  const [about, catalogue, festive] = await Promise.all([
    apiGetSafe<any>('/seo/about', { jsonld: [] }, { revalidate: 86400 }),
    listProgrammes(),
    getFestivePublic(),
  ]);
  const programmes = pickHomeProgrammes(catalogue?.programmes || []);
  const pathways = catalogue?.taxonomy?.length ? catalogue.taxonomy : FALLBACK_PATHWAYS;

  // ---- Site-wide structured data (preserve existing SEO behaviour) ----
  const HOME = canonical('/');
  const aboutJsonld: any[] = Array.isArray(about?.jsonld) ? about.jsonld : [];
  const org = aboutJsonld.find((o) => o?.['@type'] === 'Organization');
  const website: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${HOME}#website`,
    url: HOME,
    name: 'NOSTOPS',
    inLanguage: 'en-IN',
  };
  if (org?.description) website.description = org.description;
  if (org?.['@id']) website.publisher = { '@id': org['@id'] };
  // Sitelinks search box → the public /search results page.
  website.potentialAction = {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${canonical('/search')}?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  };

  const webpage: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${HOME}#webpage`,
    url: HOME,
    name: HOME_TITLE,
    description: HOME_DESC,
    inLanguage: 'en-IN',
    isPartOf: { '@id': `${HOME}#website` },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: canonical(OG_IMAGE),
      contentUrl: canonical(OG_IMAGE),
      width: 1200,
      height: 630,
      caption: OG_ALT,
    },
    image: [canonical(OG_IMAGE), canonical('/brand/home/hero.jpg')],
    // Voice assistants / AI answer engines: the passages that best summarise the page.
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['[data-testid="hero-headline"]', '[data-testid="hero-tagline"]'] },
    audience: [
      { '@type': 'Audience', audienceType: 'Yoga teachers in India' },
      { '@type': 'BusinessAudience', audienceType: 'Companies, educational institutions and startup / networking groups' },
      { '@type': 'PeopleAudience', audienceType: 'People looking for a yoga teacher, programme or retreat' },
    ],
    significantLink: ['/teachers', '/for-organisations', '/programmes', '/retreats', '/venues', '/council'].map((p) => canonical(p)),
  };
  if (org?.['@id']) webpage.about = { '@id': org['@id'] };

  // The organisation from the backend, with a logo and image the website actually serves.
  const orgNode = org
    ? {
        ...org,
        url: HOME,
        logo: { '@type': 'ImageObject', url: canonical('/brand/nostops-logo.png'), contentUrl: canonical('/brand/nostops-logo.png') },
        image: canonical(OG_IMAGE),
      }
    : null;

  // What the page actually shows — the curated programmes — as a list search and AI answer engines can cite.
  const lists: Record<string, any>[] = [];
  const progItems = programmes
    .map((p: any) => ({ slug: String(p?.slug || ''), name: String(p?.name || p?.title || '') }))
    .filter((p) => p.slug && p.name);
  if (progItems.length) {
    lists.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${HOME}#programmes`,
      name: 'Discover Curated Programmes',
      description: 'Council-curated yoga programmes for organisations, across the Mind, Body and Special Needs pathways.',
      itemListElement: progItems.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: canonical(`/programmes/${p.slug}`), name: p.name })),
    });
  }

  const homeJsonld = normalizeJsonLd([website, webpage, ...(orgNode ? [orgNode] : []), ...lists]);

  return (
    <div className="bg-[#FCFAF6]">
      <JsonLd data={homeJsonld} />
      {festive.state !== 'ended' && festive.state !== 'disabled' && <FestiveCelebration />}
      <HomeHeroBanner />
      <CelebrationStrip />
      <WhoAreYou />
      <OrgSection />
      <PathwaysSection pathways={pathways} />
      <CooperativeSection />
      <ProgrammesSection programmes={programmes} />
      <JourneySection />
      <RetreatsSection />
      <ClosingBanner />
    </div>
  );
}
