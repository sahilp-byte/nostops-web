import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import { TEACHER_SHARE_SENTENCE, TEACHER_SHARE_OTHER_WORK } from '@/lib/org/pricing';

export const revalidate = 86400;

const PATH = '/faq';
const TITLE = 'Frequently Asked Questions';
const DESC = 'Answers about finding and booking yoga teachers, becoming a NOSTOPS teacher, retreats, the Council of Gurus, and organisation wellness programmes.';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'For seekers',
    items: [
      { q: 'What is NOSTOPS?', a: 'NOSTOPS is a teacher-first yoga cooperative connecting seekers with verified Indian yoga teachers, retreats and lineages — backed by a Council of Gurus.' },
      { q: 'How do I book a teacher?', a: 'Browse the Teacher Directory, open a teacher’s profile, and request a session. You’ll be asked to sign in or create a free account to confirm a booking.' },
      { q: 'Are teachers verified?', a: 'Yes. Public teacher profiles are for teachers who have completed KYC and Council empanelment, so you can book with confidence.' },
    ],
  },
  {
    heading: 'For teachers',
    items: [
      { q: 'How much do I keep?', a: `${TEACHER_SHARE_SENTENCE} ${TEACHER_SHARE_OTHER_WORK}` },
      { q: 'How do I join?', a: 'Register, build your profile, complete InstaKYC, and get empanelled by the Council. Then your public profile goes live and you can receive bookings.' },
      { q: 'Can I host retreats?', a: 'Eligible teachers can host retreats — create listings, manage reservations and get paid, with NOSTOPS handling payments.' },
    ],
  },
  {
    heading: 'Retreats & tradition',
    items: [
      { q: 'What is the Council of Gurus?', a: 'A body of senior gurus who vouch for teachers and safeguard the authenticity of the Guru–Shishya Parampara on NOSTOPS.' },
    ],
  },
  {
    heading: 'For organisations',
    items: [
      { q: 'Do you run corporate & campus programmes?', a: 'Yes — structured 1, 3, 6 or 12-month programmes for companies, educational institutions and startup networks, delivered in person at your office, campus or a venue you choose.' },
      { q: 'What does an organisation see as a programme runs?', a: 'The organisation dashboard shows registrations and attendance for every session, and participants can leave a rating and feedback once the programme is complete.' },
      { q: 'Who pays for an organisation programme?', a: 'The organiser sets a fee per participant, per session, and each person pays it online (card or UPI) when they register. Their place is confirmed once the payment goes through.' },
    ],
  },
];

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GROUPS.flatMap((g) => g.items).map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }]} />

      {/* Hero — unified public-marketing gradient */}
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions"
        subtitle="Everything you need to know about NOSTOPS — for seekers, teachers and organisations."
      />

      <div className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {GROUPS.map((g) => (
            <section key={g.heading} className="mt-10 first:mt-0">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">{g.heading}</h2>
              <div className="mt-3 space-y-3">
                {g.items.map((it) => (
                  <div key={it.q} className="rounded-2xl border border-line bg-white p-5">
                    <p className="text-sm font-extrabold text-ink">{it.q}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{it.a}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="mt-12 rounded-2xl bg-cream p-6 text-center">
            <p className="text-sm font-extrabold text-ink">Still have a question?</p>
            <Link href="/contact" className="mt-3 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Contact us →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
