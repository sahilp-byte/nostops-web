import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import OrgEnquirySection from '@/components/org/OrgEnquirySection';

export const revalidate = 86400;

const PATH = '/contact';
const TITLE = 'Contact Us';
const DESC = 'Get in touch with NOSTOPS — for teachers joining the cooperative, organisations planning a wellness programme, or general questions.';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const EMAIL = 'nostops.org@gmail.com';

export default function ContactPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: TITLE,
    url: canonical(PATH),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }]} />

      {/* Hero — unified public-marketing gradient */}
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        subtitle={<>Whether you&apos;re a teacher joining the cooperative or an organisation planning a programme, we&apos;d love to hear from you.</>}
      >
        <div className="mt-8">
          <a href={`mailto:${EMAIL}`} className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-cream">
            Email {EMAIL}
          </a>
          <p className="mt-3 text-sm text-white/70">We typically reply within 1–2 working days.</p>
        </div>
      </PageHero>

      <div className="container-x py-12 sm:py-16">
        {/* Get help — Ask AI Guru is the primary support path (it can raise a
            human Support Request); email is the fallback. */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-2xl font-black tracking-tight text-ink sm:text-3xl">We&apos;re here to help</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-soft">
            Tap <span className="font-bold text-brand-700">✨ Ask AI Guru</span> at the bottom of the screen for instant answers — it
            can raise a support request to our team whenever you need a real person.
          </p>
          <p className="mt-4 text-sm text-muted">Prefer email? Write to <a href={`mailto:${EMAIL}`} className="font-bold text-brand-700 hover:underline">{EMAIL}</a> — we reply within 1–2 working days.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
          <Link href="/become-a-teacher" className="rounded-2xl border border-line bg-white p-5 transition hover:border-brand">
            <p className="text-2xl">🧘</p>
            <p className="mt-2 text-sm font-extrabold text-ink">Teachers</p>
            <p className="mt-1 text-sm text-ink-soft">Join the cooperative and start teaching.</p>
          </Link>
          <a href="#enquire" className="rounded-2xl border border-line bg-white p-5 transition hover:border-brand" data-testid="contact-org-card">
            <p className="text-2xl">🏢</p>
            <p className="mt-2 text-sm font-extrabold text-ink">Organisations</p>
            <p className="mt-1 text-sm text-ink-soft">Plan a workplace or campus programme. Request a proposal below.</p>
          </a>
          <Link href="/faq" className="rounded-2xl border border-line bg-white p-5 transition hover:border-brand">
            <p className="text-2xl">❓</p>
            <p className="mt-2 text-sm font-extrabold text-ink">FAQ</p>
            <p className="mt-1 text-sm text-ink-soft">Answers to common questions.</p>
          </Link>
        </div>
      </div>
      <OrgEnquirySection
        sourcePage={PATH}
        subtitle="Planning a programme for a company, an educational institution or a startup & networking group? Tell us what you need and the NOSTOPS team will come back with a tailored proposal."
      />
    </>
  );
}
