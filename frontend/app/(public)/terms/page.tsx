import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import LegalEntityNotice from '@/components/legal/LegalEntityNotice';

export const revalidate = 86400;

const PATH = '/terms';
const TITLE = 'Terms of Service';
const DESC = 'The terms governing use of the NOSTOPS yoga cooperative platform by teachers, seekers and organisations.';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. Acceptance', p: [
    'By using NOSTOPS you agree to these terms. If you do not agree, please do not use the platform.',
  ] },
  { h: '2. Who we are', p: [
    'NOSTOPS is a teacher-first cooperative connecting seekers and organisations with verified Indian yoga teachers, retreats and lineages, supported by a Council of Gurus.',
  ] },
  { h: '3. Accounts', p: [
    'You are responsible for the accuracy of the information you provide and for keeping your account secure. Teachers must complete verification (InstaKYC and Council empanelment) before their public profile goes live and before receiving payouts.',
  ] },
  { h: '4. Bookings & payments', p: [
    'Bookings and programmes are subject to availability and confirmation. Payments are processed securely through our payment partners. Teacher earnings follow a teacher-first revenue share that increases with the length of the engagement.',
  ] },
  { h: '5. Conduct', p: [
    'You agree to use NOSTOPS respectfully and lawfully, to honour the traditions of the practice, and not to misrepresent your identity, lineage or qualifications.',
  ] },
  { h: '6. Content', p: [
    'You retain ownership of content you upload and grant NOSTOPS a licence to display it for the purpose of operating the platform, including on public, indexable profile pages.',
  ] },
  { h: '7. Cancellations & refunds', p: [
    'Cancellation and refund handling depends on the type of booking or programme and is shown at the time of booking. Where a teacher declines a confirmed session, eligible amounts are refunded. Full details are in our Refund & Cancellation Policy (nostops.org/refunds).',
  ] },
  { h: '8. Changes', p: [
    'We may update these terms from time to time. Continued use of NOSTOPS after changes means you accept the updated terms.',
  ] },
  { h: '9. Contact', p: [
    'Questions about these terms? Email nostops.org@gmail.com.',
  ] },
];

export default function TermsPage() {
  return (
    <div className="container-x py-12 sm:py-16">
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: TITLE, path: PATH }]} />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Terms of Service</h1>
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
