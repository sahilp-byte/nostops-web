import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import LegalEntityNotice from '@/components/legal/LegalEntityNotice';
import { CANCELLATION_TIERS, HOST_CANCELLATION_NOTE } from '@/lib/cancellation';

export const revalidate = 86400;

const PATH = '/refunds';
const TITLE = 'Refund & Cancellation Policy';
const DESC = 'When and how NOSTOPS refunds 1:1 sessions, organisation programme events, InstaKYC, Fast-Track, AI venue onboarding and retreats.';

// Metadata only (Phase 3 conventions); the policy wording below is unchanged.
export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. 1:1 sessions with a teacher', p: [
    'Full refund if the teacher declines your booking, or if you cancel 24 hours or more before the session starts.',
    'No refund if you cancel less than 24 hours before the session.',
  ] },
  { h: '2. Organisation programme events', p: [
    'Full refund if you cancel up to 48 hours before the event, or if the organiser cancels the event.',
    'No refund for cancellations made less than 48 hours before the event.',
  ] },
  { h: '3. InstaKYC, Fast-Track empanelment and AI venue onboarding', p: [
    'Full refund if you request it within 7 days of payment and work on your request has not started.',
    'No refund once work has started.',
  ] },
];

export default function RefundsPage() {
  return (
    <div className="container-x py-12 sm:py-16">
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: TITLE, path: PATH }]} />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Refund &amp; Cancellation Policy</h1>
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

          <section>
            <h2 className="text-lg font-extrabold text-ink">4. Retreats</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">Refunds depend on how far ahead of the retreat start date you cancel:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft" data-testid="refund-retreat-tiers">
              {CANCELLATION_TIERS.map((t) => (
                <li key={t.label}>{t.label}: {t.refundPct}% refund</li>
              ))}
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{HOST_CANCELLATION_NOTE}</p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-ink">5. How to request a refund</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Email <a href="mailto:nostops.org@gmail.com" className="font-semibold text-brand-700 hover:underline">nostops.org@gmail.com</a> with your booking, order or reference number. Approved refunds are returned to the original payment method. Processing time: [to be confirmed].
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Anything not covered here is handled under our <Link href="/terms" className="font-semibold text-brand-700 hover:underline">Terms of Service</Link>.
            </p>
          </section>

          <LegalEntityNotice />
        </div>
      </article>
    </div>
  );
}
