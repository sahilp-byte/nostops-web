import type { Metadata } from 'next';
import Link from 'next/link';

// One clear signal for every 404: replaces the public layout's "index, follow",
// its homepage canonical and og:url, so a missing page never points crawlers home.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: { type: 'website', siteName: 'NOSTOPS', title: 'Page not found · NOSTOPS' },
};

// Global 404 (root). Public routes render this with a 404 status.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl font-black text-white">N</span>
      <h1 className="mt-6 text-3xl font-black tracking-tight text-ink">Page not found</h1>
      <p className="mt-3 max-w-md text-ink-soft">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-6 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
        Go to homepage
      </Link>
    </div>
  );
}
