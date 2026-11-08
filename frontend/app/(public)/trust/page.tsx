import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';

export const revalidate = 86400;

const PATH = '/trust';
const TITLE = 'Trust & Verification';
const DESC =
  'How NOSTOPS keeps programmes safe: what our Council-Curated and Verified badges mean, how teachers are verified and how your data is protected.';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold';

// The real badges a participant sees on a programme/event page, explained.
const BADGES: { pill: React.ReactNode; title: string; body: string }[] = [
  {
    pill: <span className={`${chip} bg-brand-50 text-brand-700`}>✓ Council-Curated Programme</span>,
    title: 'Council-Curated Programme',
    body:
      'The programme’s structure, objectives and practices are curated by the NOSTOPS Council of Gurus — a tradition-rooted curriculum, not an ad-hoc class. While a programme’s content is still in development, its pages also show “In development — pending Council review” until the Council has approved it.',
  },
  {
    pill: <span className={`${chip} bg-emerald-50 text-emerald-700`}>✓ Verified Organisation</span>,
    title: 'Verified Organisation',
    body:
      'The company, institution or network hosting this programme has been reviewed and verified by the NOSTOPS team. Programmes from unverified organisers are never shown this badge.',
  },
  {
    pill: <span className={`${chip} bg-emerald-50 text-emerald-700`}>✓ Verified Teacher</span>,
    title: 'Verified Teacher',
    body:
      'The teacher leading your session has passed the NOSTOPS identity check and been empanelled by the Council of Gurus — both, not just one. When a teacher has accepted but is not yet verified, the page says “Teacher confirmed”; before that it says “NOSTOPS teacher matching”. We never imply a teacher is verified when they are not.',
  },
];

const VERIFY_STEPS: { step: string; title: string; body: string }[] = [
  {
    step: '1',
    title: 'Identity (KYC)',
    body: 'Every teacher confirms who they are with a government-grade identity check before they can be empanelled or receive bookings.',
  },
  {
    step: '2',
    title: 'Council empanelment',
    body: 'Senior gurus of the Council review a teacher’s lineage and practice and vouch for them — safeguarding the authenticity of the Guru–Shishya Parampara.',
  },
  {
    step: '3',
    title: 'Ongoing quality',
    body: 'Participant feedback and attendance are tracked per programme so the Council can keep raising the bar — and step in if quality ever slips.',
  },
];

const PROMISES: { icon: string; title: string; body: string }[] = [
  {
    icon: '🔒',
    title: 'Your details stay yours',
    body: 'Your name, email and phone are used only to manage your own registration. We never sell your data or add you to another teacher’s marketing list.',
  },
  {
    icon: '🧘',
    title: 'Teacher-first, anti-poaching',
    body: 'NOSTOPS exists to honour teachers. No teacher can see another teacher’s students, attendees or contacts — so your relationship with your teacher is always protected.',
  },
  {
    icon: '💳',
    title: 'Secure payments',
    body: 'Paid registrations are processed by Cashfree on an encrypted checkout. NOSTOPS never stores your card details, and the amount you pay is exactly the organiser’s published fee.',
  },
  {
    icon: '🎓',
    title: 'Verifiable certificates',
    body: 'Completion certificates carry a reference you (or anyone) can check on NOSTOPS — proof that a session really happened and who led it.',
  },
];

export default function TrustPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    description: DESC,
    url: canonical(PATH),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Trust & Verification', path: '/trust' }]} />

      <PageHero
        eyebrow="Trust & Safety"
        title="How you know a NOSTOPS programme is the real thing"
        subtitle="Every badge on a programme page is earned, not bought. Here’s exactly what each one means, how our teachers are verified, and how we protect your data and your payment."
      />

      <div className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {/* Badges explained */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">What the badges mean</h2>
            <div className="mt-4 space-y-3">
              {BADGES.map((b) => (
                <div key={b.title} className="rounded-2xl border border-line bg-white p-5" data-testid="trust-badge">
                  <div>{b.pill}</div>
                  <p className="mt-3 text-sm font-extrabold text-ink">{b.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How teachers are verified */}
          <section className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">How we verify teachers</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {VERIFY_STEPS.map((s) => (
                <div key={s.step} className="rounded-2xl border border-line bg-white p-5">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">{s.step}</div>
                  <p className="mt-3 text-sm font-extrabold text-ink">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Your protection */}
          <section className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">Your protection</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PROMISES.map((p) => (
                <div key={p.title} className="rounded-2xl border border-line bg-white p-5">
                  <div className="text-2xl" aria-hidden>{p.icon}</div>
                  <p className="mt-2 text-sm font-extrabold text-ink">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-12 rounded-2xl bg-cream p-6 text-center">
            <p className="text-sm font-extrabold text-ink">Ready to join a verified programme?</p>
            <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/programmes" className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
                Explore programmes →
              </Link>
              <Link href="/contact" className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-cream">
                Ask us a question
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
