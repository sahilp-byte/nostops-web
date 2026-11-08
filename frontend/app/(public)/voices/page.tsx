import type { Metadata } from 'next';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { normalizeJsonLd } from '@/lib/seo';
import PageHero from '@/components/PageHero';
import { getVoicesHub } from '@/lib/server/voices';
import VoicesBrowser from '@/components/voices/VoicesBrowser';

export const dynamic = 'force-dynamic';
const CANONICAL_URL = canonical('/voices');

export const metadata: Metadata = {
  title: { absolute: 'Voices: Perspectives from Our Yoga Teachers · NOSTOPS' },
  description:
    'Perspectives, knowledge and reflections from the teachers of NOSTOPS: editorial essays, opinion and scholarly writing by verified yoga teachers.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL,
    title: 'NOSTOPS Voices', description: 'Perspectives, knowledge and reflections from the teachers of NOSTOPS.',
    images: [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }],
  },
  twitter: { card: 'summary_large_image', title: 'NOSTOPS Voices', images: ['/brand/og-card.png'] },
};

export default async function VoicesHub() {
  const articles = await getVoicesHub();

  const jsonLd = normalizeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'NOSTOPS Voices',
    url: CANONICAL_URL,
    description: 'Perspectives, knowledge and reflections from the teachers of NOSTOPS.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.slice(0, 30).map((a, i) => ({
        '@type': 'ListItem', position: i + 1, url: canonical(`/voices/${a.slug}`), name: a.title,
      })),
    },
  });

  return (
    <div>
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'NOSTOPS Voices', path: '/voices' }]} />
      <PageHero
        eyebrow="NOSTOPS Voices"
        title="Voices from the Network"
        subtitle="Perspectives, knowledge and reflections from the teachers of NOSTOPS."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-lg font-black text-ink">The first Voices are being written.</p>
            <p className="mt-2 text-sm text-muted">Our teachers are custodians of a living tradition — their perspectives will appear here soon.</p>
          </div>
        ) : (
          <VoicesBrowser articles={articles} />
        )}
      </div>
    </div>
  );
}
