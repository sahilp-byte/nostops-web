import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import LegalEntityNotice from '@/components/legal/LegalEntityNotice';

export const revalidate = 86400;

const PATH = '/privacy';
const TITLE = 'Privacy Policy';
const DESC = 'How NOSTOPS collects, uses and protects your personal information as a teacher, seeker or organisation on the platform.';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. Information we collect', p: [
    'Account details you provide when you register (name, email, phone, role) and, for teachers, profile information such as lineage, styles, specialisations, location and media you upload.',
    'Verification data submitted during InstaKYC, processed solely to verify identity and enable payouts.',
    'Usage data such as pages viewed and actions taken, used to operate and improve the service.',
  ] },
  { h: '2. How we use your information', p: [
    'To provide the service — publishing verified teacher profiles, enabling bookings, processing payments and payouts, and running organisation programmes.',
    'To keep the platform safe, prevent fraud and meet legal obligations.',
    'To communicate with you about your account, bookings and programmes.',
  ] },
  { h: '3. What is public', p: [
    'Verified teacher profiles are public and indexable by design — they include your professional details, lineage and media you choose to publish.',
    'Private information such as KYC data, payment identifiers, wallet balances, phone and email are never shown publicly.',
  ] },
  { h: '4. Sharing', p: [
    'We share information only as needed to run the service — for example with payment processors and identity-verification providers — and never sell your personal data.',
    'For organisation programmes, we share only the participant information required to deliver sessions.',
  ] },
  { h: '5. Your choices', p: [
    'You can edit or hide your profile from your dashboard, and request access to or deletion of your personal data by contacting us.',
  ] },
  { h: '6. Contact', p: [
    'Questions about privacy? Email nostops.org@gmail.com.',
  ] },
];

export default function PrivacyPage() {
  return (
    <div className="container-x py-12 sm:py-16">
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: TITLE, path: PATH }]} />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: June 2026</p>
        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-extrabold text-ink">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">{para}</p>
              ))}
            </section>
          ))}
          <LegalEntityNotice />
        </div>
      </article>
    </div>
  );
}
