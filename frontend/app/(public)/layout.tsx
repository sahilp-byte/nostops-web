import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ListVenueStickyCta from '@/components/ListVenueStickyCta';
import AttributionCapture from '@/components/AttributionCapture';
import { SITE_URL } from '@/lib/site';

// Public / SEO layer chrome + indexable metadata. Individual public pages
// override title/description/canonical/JSON-LD per route. NO default canonical
// here: a page that forgets its own must not silently inherit the home-page
// canonical (Phase 3 — noindex pages then carry none at all).
export const metadata: Metadata = {
  openGraph: {
    type: 'website',
    siteName: 'NOSTOPS',
    url: SITE_URL,
    title: "NOSTOPS · India's Teacher-First Yoga Cooperative",
    description: 'A teacher-first yoga cooperative honouring the Guru–Shishya Parampara.',
    images: [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "NOSTOPS · India's Teacher-First Yoga Cooperative",
    description: 'A teacher-first yoga cooperative honouring the Guru–Shishya Parampara.',
    images: ['/brand/og-card.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-brand-700 focus:shadow-lg focus:ring-2 focus:ring-brand"
        data-testid="skip-link"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>
      <SiteFooter />
      <ListVenueStickyCta />
      <AttributionCapture />
    </>
  );
}
