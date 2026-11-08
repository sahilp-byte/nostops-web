import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';

export const revalidate = 86400;

const PATH = '/support';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');
const OG_IMAGE = '/brand/og-card.png';

const TITLE = 'Help & Support';
const DESC =
  'Get help with NOSTOPS. Ask AI Guru answers on every page and can raise a Support Request for teachers, venues, retreats, organisations and participants.';
const EMAIL = 'nostops.org@gmail.com';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: CANONICAL_URL },
    openGraph: {
      type: 'website',
      siteName: 'NOSTOPS',
      url: CANONICAL_URL,
      title: TITLE,
      description: DESC,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'NOSTOPS Help & Support' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESC,
      images: [OG_IMAGE],
    },
  };
}

// Support-specific FAQ — unique to this page (distinct from the general /faq),
// so it earns rich results and genuinely explains how help works on NOSTOPS.
const SUPPORT_FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I get help on NOSTOPS?',
    a: 'Tap “✨ Ask AI Guru” at the bottom of any page for instant, context-aware answers. If it cannot fully resolve your issue, it can raise a Support Request to the NOSTOPS team on your behalf.',
  },
  {
    q: 'What is a Support Request?',
    a: 'When Ask AI Guru cannot resolve something, it creates a Support Request that captures your question and the page you were on — so a NOSTOPS team member can follow up without you repeating yourself. You receive a reference ID (for example SR-AB12CD34).',
  },
  {
    q: 'How long does a reply take?',
    a: 'A NOSTOPS team member reviews each request and replies to the email you provided, typically within 1–2 working days. Payment, login and event issues are prioritised.',
  },
  {
    q: 'Can I get help without an account?',
    a: 'Yes. Ask AI Guru works on every page whether you are signed in or not. To raise a Support Request you only add an email address so we can reach you.',
  },
  {
    q: 'I have an urgent payment or booking problem.',
    a: 'Open Ask AI Guru, choose “Create Support Request”, and select the Payment or Event category — these are prioritised. Include any reference details so we can resolve it quickly.',
  },
];

const HELP_LINKS: { href: string; icon: string; title: string; desc: string }[] = [
  { href: '/faq', icon: '❓', title: 'FAQ', desc: 'Common answers for seekers, teachers and organisations.' },
  { href: '/how-it-works', icon: '🧭', title: 'How it works', desc: 'Understand the NOSTOPS journey end to end.' },
  { href: '/trust', icon: '🛡️', title: 'Trust & verification', desc: 'How we verify teachers and safeguard quality.' },
];

export default function SupportPage() {
  const jsonLd = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': CANONICAL_URL,
      url: CANONICAL_URL,
      name: TITLE,
      description: DESC,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Help & Support', item: CANONICAL_URL },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: SUPPORT_FAQ.map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
    },
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        eyebrow="Help & Support"
        title="We're here to help"
        subtitle={<>Ask AI Guru is your front desk — it answers instantly on every page, and raises a human Support Request whenever you need a real person.</>}
      />

      <div className="container-x py-12 sm:py-16">
        {/* Two primary support paths */}
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-6" aria-label="Ask AI Guru">
            <span aria-hidden className="text-2xl">✨</span>
            <h2 className="mt-2 text-lg font-black tracking-tight text-ink">Ask AI Guru</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Tap the <span className="font-bold text-brand-700">✨ Ask AI Guru</span> button at the bottom of any page.
              It understands where you are on NOSTOPS and gives instant, trustworthy answers for teachers, venues,
              retreats, organisations and participants — then points you to the right next step.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6" aria-label="Create a Support Request">
            <span aria-hidden className="text-2xl">🧑‍💻</span>
            <h2 className="mt-2 text-lg font-black tracking-tight text-ink">Create a Support Request</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              If the Guru cannot resolve your issue, choose <span className="font-bold text-ink">Create Support Request</span>{' '}
              inside the chat. Your conversation and the page you were on are attached automatically, so a NOSTOPS team
              member can help — and you get a reference ID to track it.
            </p>
          </section>
        </div>

        {/* Browse help */}
        <div className="mx-auto mt-10 max-w-4xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">Browse help</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {HELP_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-2xl border border-line bg-white p-5 transition hover:border-brand">
                <p className="text-2xl" aria-hidden>{l.icon}</p>
                <p className="mt-2 text-sm font-extrabold text-ink">{l.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Support FAQ */}
        <div className="mx-auto mt-12 max-w-3xl">
          <h2 className="font-serif text-2xl font-black tracking-tight text-ink sm:text-3xl">How support works</h2>
          <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {SUPPORT_FAQ.map((f, i) => (
              <details key={i} className="group px-6 py-5" data-testid="support-faq-item">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-ink">
                  <span>{f.q}</span>
                  <span aria-hidden className="shrink-0 text-xl leading-none text-brand-700 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Email fallback */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-cream p-6 text-center">
          <p className="text-sm font-extrabold text-ink">Prefer email?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Write to <a href={`mailto:${EMAIL}`} className="font-bold text-brand-700 hover:underline">{EMAIL}</a> — we reply within 1–2 working days.
          </p>
          <Link href="/contact" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
            Contact NOSTOPS →
          </Link>
        </div>
      </div>
    </>
  );
}
