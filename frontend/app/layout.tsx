import type { Metadata } from 'next';
import './globals.css';
import './spaces-theme.css';
import { SITE_URL } from '@/lib/site';
import Analytics from '@/components/Analytics';
import AskGuru from '@/components/guru/AskGuru';
import ErrorReporter from '@/components/ErrorReporter';

// Minimal root layout. It only owns <html>/<body> + global metadata so that
// each route GROUP can supply its own chrome:
//   (public) -> marketing SiteHeader/SiteFooter (indexable SEO)
//   (auth)   -> centered auth shell (noindex)
//   app/*    -> authenticated application shell (noindex)
// metadataBase MUST live here so relative canonical/OG URLs resolve everywhere.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NOSTOPS · India's Teacher-First Yoga Cooperative",
    template: '%s · NOSTOPS',
  },
  description:
    'NOSTOPS is a teacher-first yoga cooperative building sustainable livelihoods for Indian yoga teachers — rooted in the Guru–Shishya Parampara.',
  applicationName: 'NOSTOPS',
  openGraph: {
    type: 'website',
    siteName: 'NOSTOPS',
    title: "NOSTOPS · India's Teacher-First Yoga Cooperative",
    description:
      'A teacher-first yoga cooperative building sustainable livelihoods for Indian yoga teachers — rooted in the Guru–Shishya Parampara.',
    // Branded default card. Pages that need a contextual card ship their own
    // file-based opengraph-image; everything else (incl. future pages that don't
    // override openGraph) inherits this branded default.
    images: [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "NOSTOPS · India's Teacher-First Yoga Cooperative",
    images: ['/brand/og-card.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {children}
        <AskGuru />
        <ErrorReporter />
      </body>
      <Analytics />
    </html>
  );
}
