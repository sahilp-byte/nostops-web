// Per-cohort copy + SEO for the public demonstration showcase pages
// (/for-organisations/{companies,educational-institutions,startup-networking-groups}).
import type { Metadata } from 'next';
import { canonical } from '@/lib/site';
import { FEE_STORY, COHORT_RATES, SESSIONS_PER_WEEK, UNAPPROVED_BANDS_TEXT, TEACHER_SHARE_SENTENCE, inrRate } from '@/lib/org/pricing';

export type CohortKey = 'COMPANY' | 'EDUCATIONAL_INSTITUTION' | 'STARTUP_NETWORK';

// Prompt 3C: list rate only; the suspended group-size discounts carry the UNAPPROVED label.
const groupPricing = (person: string, rate: number) =>
  `Pricing is per ${person}, per session — a list rate of ${inrRate(rate)}, ${SESSIONS_PER_WEEK} sessions a week, for any group size and any programme length. ${UNAPPROVED_BANDS_TEXT} ${FEE_STORY}`;
const WHO_TEACHES = { q: 'Who teaches?', a: `Verified, Council-empanelled Indian teachers. ${TEACHER_SHARE_SENTENCE}` };

export type CohortCopy = {
  key: CohortKey;
  path: string;
  icon: string;
  accent: string; // tailwind bg-* for the badge
  eyebrow: string;
  title: string;
  tagline: string;
  intro: string;
  audienceWord: string; // "your company" / "your campus" / "your network"
  how: { n: string; title: string; desc: string }[];
  faqs: { q: string; a: string }[];
  metaTitle: string;
  metaDesc: string;
};

const OG = '/brand/org/hero-og.jpg';

export const COHORT_COPY: Record<CohortKey, CohortCopy> = {
  COMPANY: {
    key: 'COMPANY',
    path: '/for-organisations/companies',
    icon: '🏢',
    accent: 'bg-blue-600',
    eyebrow: 'For Companies',
    title: 'Work Better. Live Better.',
    tagline: 'Council-curated Yoga programmes for resilient, high-performing teams.',
    intro:
      'Companies bring structured, Council-curated Yoga programmes to their people — delivered on-site by a NOSTOPS-verified teacher matched to the programme, location and schedule. See how real workplaces use the NOSTOPS model, from choosing a programme to a live, published event.',
    audienceWord: 'your company',
    how: [
      { n: '1', title: 'Choose a Programme', desc: 'Pick a Council-curated Mind, Body or Special Needs programme that fits your teams.' },
      { n: '2', title: 'Create Your Event', desc: 'Set date, time, your own space, capacity and language.' },
      { n: '3', title: 'We Match Your Teacher', desc: 'NOSTOPS matches an eligible verified teacher by programme, location, fit and availability.' },
      { n: '4', title: 'Publish & Participate', desc: 'Share the event with your teams and let your teacher lead the experience.' },
    ],
    faqs: [
      { q: 'Where do sessions take place?', a: 'On-site, at your office or a venue you choose. Every programme is delivered in person by a NOSTOPS-provided, Council-vetted teacher.' },
      { q: 'How large are the groups?', a: 'Each Council programme has its own recommended group size — 12–30 participants for most programmes and 6–20 for Special Needs programmes. You set the capacity of each session; if it is above the recommendation you’ll see a note, and larger groups can be run as separate sessions.' },
      { q: 'How does group pricing work?', a: groupPricing('employee', COHORT_RATES.COMPANY.rate) },
      { q: 'What will we see as the programme runs?', a: 'Your organisation dashboard shows registrations and attendance for each session, and participants can leave a rating and feedback once the programme is complete.' },
      WHO_TEACHES,
    ],
    metaTitle: 'Yoga Programmes for Companies · NOSTOPS',
    metaDesc:
      'See how companies bring Council-curated Yoga programmes to their teams on NOSTOPS, with verified teachers and clear per-participant pricing.',
  },
  EDUCATIONAL_INSTITUTION: {
    key: 'EDUCATIONAL_INSTITUTION',
    path: '/for-organisations/educational-institutions',
    icon: '🎓',
    accent: 'bg-emerald-600',
    eyebrow: 'For Educational Institutions',
    title: 'Learn Better. Grow Better.',
    tagline: 'Campus programmes that move from Council-curated programme to published event.',
    intro:
      'Colleges and universities bring authentic Yoga to students, faculty and staff — accessible campus programmes for focus, stress resilience and well-being, delivered on-site on your campus by a NOSTOPS-verified teacher. See how a campus programme moves from a Council-curated programme to a live, published event.',
    audienceWord: 'your campus',
    how: [
      { n: '1', title: 'Choose a Programme', desc: 'Select a Council-curated Mind, Body or Special Needs programme for your campus.' },
      { n: '2', title: 'Create Your Event', desc: 'Set date, time, campus venue, capacity and language around the academic calendar.' },
      { n: '3', title: 'We Match Your Teacher', desc: 'NOSTOPS matches an eligible verified teacher by programme, location, fit and availability.' },
      { n: '4', title: 'Publish & Participate', desc: 'Open it to students and staff and let your teacher lead the experience.' },
    ],
    faqs: [
      { q: 'Can it fit an academic calendar?', a: 'Yes — programmes run in phased terms and can align with your semester and exam schedules.' },
      { q: 'Students, faculty, or both?', a: 'Either. Groups can be dedicated to students, to staff, or blended across your campus.' },
      { q: 'Which programme suits our group?', a: 'You choose from the Council-curated programmes. Each one lists its recommended audience, group size and session length, so you can pick the one that fits your students or staff. The programme content itself is set by the Council and is not changed per campus.' },
      { q: 'How does pricing work?', a: `Pricing is per student or faculty member, per session — an exclusive flat campus rate of ${inrRate(COHORT_RATES.EDUCATIONAL_INSTITUTION.rate)}, ${SESSIONS_PER_WEEK} sessions a week. It is already our lowest rate, so no further discounts apply, whatever the group size or length. ${FEE_STORY}` },
      WHO_TEACHES,
    ],
    metaTitle: 'Campus Yoga Programmes for Educational Institutions · NOSTOPS',
    metaDesc:
      'See how schools, colleges and universities bring Council-curated Yoga to campus on NOSTOPS for focus, stress resilience and well-being.',
  },
  STARTUP_NETWORK: {
    key: 'STARTUP_NETWORK',
    path: '/for-organisations/startup-networking-groups',
    icon: '👥',
    accent: 'bg-amber-500',
    eyebrow: 'For Startup & Networking Groups',
    title: 'Build Better. Scale Better.',
    tagline: 'Shared Yoga programmes for founders, teams and professional communities.',
    intro:
      'Founder circles and professional networks create shared Yoga programmes that build resilience, clarity and sustained energy — delivered on-site at community venues and led by a NOSTOPS-verified teacher. See how a founder network creates a shared programme its members experience together.',
    audienceWord: 'your network',
    how: [
      { n: '1', title: 'Choose a Programme', desc: 'Pick a Council-curated Mind, Body or Special Needs programme for your community.' },
      { n: '2', title: 'Create Your Event', desc: 'Set date, time, a community venue, capacity and language.' },
      { n: '3', title: 'We Match Your Teacher', desc: 'NOSTOPS matches an eligible verified teacher by programme, location, fit and availability.' },
      { n: '4', title: 'Publish & Participate', desc: 'Open registration to members and their teams and practise together.' },
    ],
    faqs: [
      { q: 'Can we run it across many startups?', a: 'Yes — your network creates the programme under its own organisation and can open registration to members from any portfolio team. Each programme runs in person in one city.' },
      { q: 'Our calendars are chaotic — will it work?', a: 'Sessions are short and cadence-based, held on-site at a venue that suits your members, so busy teams can actually show up.' },
      { q: 'Is there a lightweight starting point?', a: 'Yes — start with a single month or a 3-month pilot, then extend to a longer engagement when it’s working for your members.' },
      { q: 'How does group pricing work?', a: groupPricing('member', COHORT_RATES.STARTUP_NETWORK.rate) },
      WHO_TEACHES,
    ],
    metaTitle: 'Shared Yoga Programmes for Startup & Networking Groups · NOSTOPS',
    metaDesc:
      'See how startup and networking groups run shared Council-curated Yoga programmes on NOSTOPS for stress resilience, focus and energy.',
  },
};

export function cohortMetadata(key: CohortKey): Metadata {
  const c = COHORT_COPY[key];
  const url = canonical(c.path);
  return {
    // absolute: the title already carries the brand, so skip the " · NOSTOPS" template.
    title: { absolute: c.metaTitle },
    description: c.metaDesc,
    alternates: { canonical: url },
    openGraph: {
      title: c.metaTitle, description: c.metaDesc, url, type: 'website', siteName: 'NOSTOPS',
      images: [{ url: OG, width: 1200, height: 630, type: 'image/jpeg', alt: `NOSTOPS — ${c.eyebrow}` }],
    },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc, images: [OG] },
  };
}
