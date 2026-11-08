import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import VenueEnquiryForm from '@/components/venue/VenueEnquiryForm';

const TITLE = 'Venue Enquiry · NOSTOPS';
const DESCRIPTION = 'Enquire about AI-assisted venue onboarding or retreat Marketing & PR support on NOSTOPS.';

export async function generateMetadata(): Promise<Metadata> {
  // A contact form — intentionally noindex (follow), like other auth/utility pages.
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonical('/list-your-venue/enquire') },
    robots: { index: false, follow: true },
  };
}

type Interest = 'ai-onboarding' | 'marketing-pr' | 'general';
function normInterest(v?: string): Interest {
  return v === 'ai-onboarding' || v === 'marketing-pr' ? v : 'general';
}

const HEADING: Record<Interest, string> = {
  'ai-onboarding': 'Enquire about AI-Assisted Venue Onboarding',
  'marketing-pr': 'Enquire about Retreat Marketing & PR Support',
  general: 'Venue listing enquiry',
};

export default async function VenueEnquirePage({ searchParams }: { searchParams: Promise<{ interest?: string }> }) {
  const { interest: raw } = await searchParams;
  const interest = normInterest(raw);

  return (
    <main className="bg-white pb-20" data-testid="venue-enquire">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/list-your-venue" className="hover:text-brand-700">List Your Venue</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">Enquire</span>
        </div>
      </nav>

      <section className="container-x py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-black tracking-tight text-ink md:text-3xl">{HEADING[interest]}</h1>
          <p className="mt-3 text-ink-soft">
            Tell us a little about your venue or retreat and what you&apos;re looking for. A NOSTOPS team member will review your enquiry and reply by email — there&apos;s no payment and no obligation.
            {interest === 'ai-onboarding' && ' AI-assisted onboarding is coming soon; we\u2019ll let you know the moment it\u2019s available.'}
          </p>
          <div className="mt-8">
            <VenueEnquiryForm defaultInterest={interest} />
          </div>
        </div>
      </section>
    </main>
  );
}
