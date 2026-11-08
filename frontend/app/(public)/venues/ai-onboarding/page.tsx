import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { normalizeJsonLd, ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import { tier2PreviewEnabled } from '@/lib/server/flags';
import { AiOnboardingPurchase } from '@/components/venues/AiOnboardingPurchase';
import { checkoutMode, venueForToken } from '@/lib/server/venue-onboarding';
import SandboxPaymentBanner from '@/components/payments/SandboxPaymentBanner';
import { headers } from 'next/headers';

const CANONICAL_URL = canonical('/venues/ai-onboarding');
const TITLE = 'AI-Assisted Venue Onboarding · NOSTOPS';
const DESCRIPTION =
  'Let AI do the heavy lifting of listing your venue on NOSTOPS: we import and draft your full profile from your website, and you review and approve every detail. One-time ₹1,999 + GST (₹2,359) in India, or US$30 outside India (paid with PayPal).';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Phase 4 (F-D4): kept out of search while payments are locked; links still followed.
    robots: { index: false, follow: true },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL, title: TITLE, description: DESCRIPTION, images: ogImages() },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [DEFAULT_OG_IMAGE] },
  };
}

const STEPS = [
  {
    n: '1',
    tint: 'bg-indigo-50 text-indigo-700',
    title: 'Import from your website',
    body: 'Pull suggested details — like your description and address — from your own website. We only read public information you already publish.',
  },
  {
    n: '2',
    tint: 'bg-sky-50 text-sky-700',
    title: 'Review & edit',
    body: 'Every suggestion is clearly labelled “unverified”. You check and edit each field. Nothing is ever written to your live listing automatically.',
  },
  {
    n: '3',
    tint: 'bg-emerald-50 text-emerald-700',
    title: 'Approve what goes live',
    body: 'Only the fields you approve are saved — through the same review-and-publish process as a normal listing. You stay in control.',
  },
];

export default async function VenueAiOnboardingPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Open, public preview — anyone can explore. Flag-gated: 404 until approved for exposure.
  if (!tier2PreviewEnabled()) notFound();
  // The purchase is tied to the venue listing behind the owner's signed edit link.
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token.trim().slice(0, 512) : '';
  const { venue, error: linkError } = token ? await venueForToken(token) : { venue: null, error: undefined };
  // Sandbox banner: only when the backend confirms THIS host runs on the Cashfree sandbox.
  const h = await headers();
  const mode = await checkoutMode(h.get('x-forwarded-host') || h.get('host') || '');

  const jsonld = normalizeJsonLd([
    { '@context': 'https://schema.org', '@type': 'WebPage', '@id': CANONICAL_URL, url: CANONICAL_URL, name: TITLE, description: DESCRIPTION },
  ]);

  return (
    <main className="bg-white pb-20" data-testid="tier2-preview">
      <JsonLd data={jsonld} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/venues" className="hover:text-brand-700">Venues</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">AI-Assisted Onboarding</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50" />
        <div className="pointer-events-none absolute -right-24 top-6 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200 to-violet-200 opacity-70 blur-2xl" />
        <div className="container-x relative py-14 md:py-20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-xs font-bold text-white">✨ AI-Assisted Onboarding</span>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">One-time · done-for-you</span>
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.1] tracking-tight text-ink md:text-5xl">
            Let AI onboard your venue — you just review &amp; approve
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Our AI imports and drafts your full listing from your website — description, amenities, rooms and more.
            You review, edit and approve every field before anything goes live. One flat, one-time fee. No subscription.
          </p>
          <div className="mt-8 max-w-xl">
            <SandboxPaymentBanner show={mode.sandbox || mode.paypal.sandbox} />
            <AiOnboardingPurchase
              token={venue ? token : undefined}
              venue={venue}
              linkError={linkError}
              checkoutAvailable={mode.enabled}
              intlAvailable={mode.paypal.enabled}
            />
          </div>
          <p className="mt-4 max-w-2xl text-xs font-semibold text-muted">
            Prefer to do it yourself? You can always{' '}
            <Link href="/venues/submit" className="text-indigo-700 underline hover:text-indigo-800">list your venue for free</Link>{' '}
            and add every detail manually. AI-drafted fields are always shown as “unverified” for you to approve.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="container-x py-12">
        <h2 className="text-2xl font-black tracking-tight text-ink md:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-white p-6" data-testid={`tier2-step-${s.n}`}>
              <span aria-hidden className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${s.tint}`}>{s.n}</span>
              <h3 className="mt-4 text-lg font-black text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demonstration (clearly labelled) */}
      <section className="container-x pb-4">
        <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/40 p-6">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">Demonstration</span>
          <p className="mt-3 text-sm text-ink-soft">
            Here&apos;s an example of the kind of suggestion you&apos;d review (illustrative only):
          </p>
          <div className="mt-3 rounded-xl border border-indigo-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide text-muted">Description</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Unverified</span>
            </div>
            <p className="mt-1.5 text-sm text-ink-soft">
              “A riverside yoga retreat centre with 20 rooms, a shala overlooking the valley, sattvic kitchen and daily
              guided practice.” — You would review, edit and approve this before anything is saved.
            </p>
          </div>
        </div>
      </section>

      {/* Private-action note */}
      <section className="container-x py-8">
        <div className="rounded-2xl border border-line bg-cream p-6">
          <h2 className="text-lg font-black text-ink">What happens after you pay?</h2>
          <p className="mt-2 text-sm text-ink-soft">
            You&apos;ll be taken to a secure checkout: Cashfree in Indian rupees for an India billing address, PayPal in US
            dollars everywhere else. Once your one-time payment is confirmed, AI-assisted
            onboarding is unlocked for <strong>that venue listing</strong> — you&apos;re never charged twice for the same
            venue. Head back to your venue&apos;s edit page and generate suggestions: every AI-drafted field is shown as
            “unverified” for you to review, edit and approve. Paid listings can also show Google photos &amp; reviews once
            our team confirms the exact Google place.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/venues/submit" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-brand/40 bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50">List your venue (free, manual)</Link>
            <Link href="/venues" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-brand/40 bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50">Explore venues</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
