import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import SubmitEditClient from '@/components/venues/SubmitEditClient';
import { tier2PreviewEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Edit your venue submission',
  robots: { index: false, follow: false },
};

export default function SubmitEditPage() {
  const tier2Preview = tier2PreviewEnabled();
  return (
    <main>
      <PageHero
        eyebrow="Venues"
        title="Edit your venue submission"
        subtitle={<>Update the details you sent us — no account needed. We&apos;ll send it back for a quick review.</>}
      />
      <div className="container-x mx-auto max-w-2xl py-10">
        <Link href="/venues/submit" className="text-sm font-bold text-brand-700 hover:underline">‹ Suggest a new venue instead</Link>
        <div className="mt-5">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <SubmitEditClient tier2Preview={tier2Preview} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
