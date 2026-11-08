import Link from 'next/link';
import Image from 'next/image';
import { JsonLd } from '@/components/JsonLd';
import { kalam } from '@/components/home/fonts';
import FestiveCelebration from '@/components/festive/FestiveCelebration';
import FestiveShare from '@/components/festive/FestiveShare';
import FestiveCountdown from '@/components/festive/FestiveCountdown';
import { canonical } from '@/lib/site';
import {
  FESTIVE_CLAIM_HREF, FESTIVE_CLAIM_READY, FESTIVE_REGISTER_HREF, type FestivePublic,
} from '@/lib/server/festive-public';

// /festive-free-kyc — public explainer for the Festive Complimentary InstaKYC campaign.
// No account data, no eligibility decision, no waiver here: claiming happens only in the signed-in
// teacher dashboard, which asks the website backend (backend/festive_kyc.py).
// Visual language: marigold toran, rangoli dots, diya numerals, calendar tiles — content unchanged.

const LEVELS = [
  { n: 'Level 1', name: 'Yoga Shikshak', desc: 'Teachers sharing yoga in their community.' },
  { n: 'Level 2', name: 'Yoga Pracharak', desc: 'Experienced teachers spreading yoga further.' },
  { n: 'Level 3', name: 'Yoga Guru', desc: 'Senior teachers and lineage holders.' },
];

const STEPS = [
  { t: 'Join NOSTOPS', d: 'Register or sign in using your existing Yoga Teacher account.' },
  { t: 'Complete Your Profile', d: 'Achieve at least 80% teacher profile completeness.' },
  { t: 'Claim Your Complimentary InstaKYC', d: 'Once eligible, sign in to your teacher dashboard and claim the offer. Continue through the normal KYC verification process.' },
];

const MEANS = [
  'Eligible teachers pay ₹0 for InstaKYC during the campaign.',
  'No payment is required to claim the promotional benefit.',
  'Existing KYC documentation and verification requirements continue to apply.',
  'Complimentary KYC does not mean automatic verification or empanelment.',
  'Teachers must complete the normal KYC process.',
];

// Benefits of verification. They match the real feature gates (lib/teacher-access.ts):
// earning and operating features need InstaKYC + admin verification + Council empanelment.
const BENEFITS = [
  { icon: '✅', t: 'Verified Teacher badge', d: 'A ✓ Verified Teacher badge on your public profile, so seekers and organisations can see your identity has been checked.' },
  { icon: '📍', t: 'Public directory listing', d: 'A listing in the NOSTOPS teacher directory and city pages, where seekers look for teachers near them.' },
  { icon: '🏅', t: 'Path to Council empanelment', d: 'InstaKYC is the step before you apply for empanelment by the NOSTOPS Council of Yoga Gurus.' },
  { icon: '🏢', t: 'Corporate and institutional programmes', d: 'NOSTOPS matches organisation, community and Special Needs programmes only with verified teachers.' },
  { icon: '📅', t: 'Bookings and 1:1 sessions', d: 'Take bookings from seekers and run online 1:1 sessions, scheduled in their local time.' },
  { icon: '🧘', t: 'Your own offerings', d: 'Publish your classes, workshops and events on NOSTOPS.' },
  { icon: '💳', t: 'Earnings wallet', d: 'A wallet that records your earnings against your verified bank details.' },
  { icon: '🤝', t: 'Refer & Earn and website widgets', d: 'Invite others with Refer & Earn, and add NOSTOPS booking widgets to your own website.' },
  { icon: '🌆', t: 'City Coordinator role', d: 'Verified teachers can take on the City Coordinator role in their city.' },
];

const FAQ = [
  { q: 'Who is eligible?', a: 'Indian yoga teachers satisfying the existing NOSTOPS India eligibility rules, with at least 80% profile completion and all other campaign conditions.' },
  { q: 'Does the offer apply to all teacher levels?', a: 'Yes. It applies to eligible Yoga Shikshak, Yoga Pracharak and Yoga Guru teachers.' },
  { q: 'Is there any payment required?', a: 'No. Eligible teachers receive a ₹0 InstaKYC fee during the campaign.' },
  { q: 'Is KYC verification waived?', a: 'No. Only the fee is waived. Existing documentation, credential checks and verification requirements remain unchanged.' },
  { q: 'What if my profile is below 80%?', a: 'Complete the remaining sections of your teacher profile. Once it reaches 80%, you may qualify, subject to other campaign conditions.' },
  { q: 'What if I already completed KYC?', a: 'Teachers who have already completed the relevant KYC process cannot claim the same promotional benefit again.' },
  { q: 'Can I claim after 31 December 2026?', a: 'No. New complimentary claims close at 11:59:59 PM IST on 31 December 2026.' },
  { q: 'What if I claim before expiry but complete verification later?', a: 'A successfully applied promotional waiver remains valid. Normal KYC verification must still be completed.' },
];

const LEVEL_TONES = [
  { card: 'bg-[#FFF3E4] border-[#F6D3AE]', num: 'text-[#F07A1A]', chip: 'bg-[#F07A1A] text-white' },
  { card: 'bg-[#FDEBEE] border-[#F4C9D1]', num: 'text-[#C7365A]', chip: 'bg-[#C7365A] text-white' },
  { card: 'bg-[#E8F3F0] border-[#C5E0D9]', num: 'text-[#0F5E5A]', chip: 'bg-[#0F5E5A] text-white' },
];

const Arrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.64l-3.22-3.22a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
  </svg>
);

function Sun({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </svg>
  );
}

/** Small clay diya with a flame. */
function Diya({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M24 6c3 5 5 8 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11Z" fill="#F5B521" />
      <path d="M24 11c1.5 3 2.5 4.5 2.5 6a2.5 2.5 0 0 1-5 0c0-1.5 1-3 2.5-6Z" fill="#FFF1C4" />
      <path d="M5 27h38c-2 9-9.5 14-19 14S7 36 5 27Z" fill="#C8642A" />
      <path d="M5 27h38c-.4 1.7-1 3.2-1.8 4.6H6.8C6 30.2 5.4 28.7 5 27Z" fill="#E07B3A" />
      <circle cx="16" cy="34" r="1.4" fill="#F5B521" /><circle cx="24" cy="35.5" r="1.4" fill="#F5B521" /><circle cx="32" cy="34" r="1.4" fill="#F5B521" />
    </svg>
  );
}

/** Marigold toran (garland) with mango leaves — hangs across the top of a section. */
function Toran({ className = '' }: { className?: string }) {
  const strands = Array.from({ length: 14 });
  return (
    <svg viewBox="0 0 1400 120" preserveAspectRatio="none" className={`pointer-events-none h-16 w-full sm:h-24 ${className}`} aria-hidden="true">
      <path d="M0 6 Q700 70 1400 6" fill="none" stroke="#2F7A3E" strokeWidth="3" />
      {strands.map((_, i) => {
        const x = 50 + i * 100;
        const t = x / 1400;
        const y = 6 + 4 * 64 * t * (1 - t);
        const len = i % 2 ? 4 : 5;
        return (
          <g key={i}>
            <path d={`M${x - 14} ${y} q14 ${22} 28 0 q-14 8 -28 0Z`} fill="#3E8E4A" />
            {Array.from({ length: len }).map((__, j) => (
              <circle key={j} cx={x} cy={y + 10 + j * 11} r={j === len - 1 ? 5 : 6.2} fill={j % 2 ? '#F5B521' : '#F07A1A'} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Rangoli dot grid used as a faint texture. */
const RANGOLI_BG = {
  backgroundImage:
    'radial-gradient(circle at 1px 1px, rgba(240,122,26,0.18) 1.2px, transparent 0), radial-gradient(circle at 13px 13px, rgba(15,94,90,0.10) 1.2px, transparent 0)',
  backgroundSize: '24px 24px',
} as const;

const btnPrimary = 'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#F07A1A] px-7 py-3 text-base font-black text-white shadow-[0_10px_24px_-10px_rgba(240,122,26,0.9)] transition hover:-translate-y-0.5 hover:bg-[#DD6A0E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F07A1A] focus-visible:ring-offset-2';
const btnSecondary = 'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-[#0E3D3B] bg-transparent px-7 py-3 text-base font-black text-[#0E3D3B] transition hover:bg-[#0E3D3B] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5E5A] focus-visible:ring-offset-2';

/** The claim CTA: a real link only while the campaign is open AND the dashboard claim is live. */
function ClaimCta({ campaign, testid }: { campaign: FestivePublic; testid: string }) {
  if (campaign.state === 'ended' || campaign.state === 'disabled') return null;
  if (!FESTIVE_CLAIM_READY) {
    return (
      <span role="button" aria-disabled="true" className={`${btnPrimary} cursor-not-allowed opacity-60 hover:translate-y-0 hover:bg-[#F07A1A]`} data-testid={testid}>
        Claiming opens soon
      </span>
    );
  }
  return (
    <Link href={FESTIVE_CLAIM_HREF} className={btnPrimary} data-testid={testid}>
      Claim Your Free InstaKYC <Arrow />
    </Link>
  );
}

function StateNote({ campaign }: { campaign: FestivePublic }) {
  if (campaign.state === 'ended' || campaign.state === 'disabled') {
    return (
      <div className="mt-6 rounded-2xl border border-[#F3D9C4] bg-white/90 px-5 py-4 text-[15px] text-[#3E5553]" role="status" data-testid="festive-ended">
        <p className="font-black text-[#0E3D3B]">This festive campaign has ended.</p>
        <p className="mt-1">New complimentary claims closed at 11:59:59 PM IST on 31 December 2026. Standard InstaKYC pricing now applies. Waivers applied before the deadline remain valid for completing KYC verification.</p>
      </div>
    );
  }
  const note = campaign.state === 'upcoming'
    ? 'Claiming opens on 1 November 2026. Complete your teacher profile now so you are ready.'
    : !FESTIVE_CLAIM_READY
      ? 'The claim button is being added to your teacher dashboard and will be available shortly.'
      : null;
  return note ? (
    <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#E8F3F0] px-4 py-2 text-sm font-bold text-[#0F5E5A]" role="status" data-testid="festive-note">
      <span className="h-2 w-2 animate-pulse rounded-full bg-[#0F5E5A]" aria-hidden="true" />
      {note}
    </p>
  ) : null;
}

function Eyebrow({ children, tone = 'saffron' }: { children: React.ReactNode; tone?: 'saffron' | 'teal' | 'light' }) {
  const c = tone === 'teal' ? 'text-[#0F5E5A]' : tone === 'light' ? 'text-[#FFD9B0]' : 'text-[#E06A10]';
  return (
    <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] ${c}`}>
      <span className="h-px w-8 bg-current" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Tear-off calendar tile for the dates section. */
function CalendarTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#EDE6DA] bg-white shadow-[0_14px_30px_-22px_rgba(14,61,59,0.6)]">
      <div className={`flex items-center justify-between px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white ${accent}`}>
        <dt>{label}</dt>
        <span className="flex gap-1.5" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-white/70" /><span className="h-2 w-2 rounded-full bg-white/70" /></span>
      </div>
      <dd className="px-4 py-4 text-xl font-black leading-snug text-[#0E3D3B]">{value}</dd>
    </div>
  );
}

export default function FestiveKycPage({ campaign }: { campaign: FestivePublic }) {
  const ended = campaign.state === 'ended' || campaign.state === 'disabled';
  const url = canonical('/festive-free-kyc');
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'NOSTOPS Festive Season — Complimentary InstaKYC',
      url,
      description: 'Complimentary InstaKYC for eligible Indian yoga teachers, 1 November – 31 December 2026.',
    },
  ];

  return (
    <div className="overflow-x-hidden bg-[#FCF7EE]" data-testid="festive-page">
      <JsonLd data={jsonLd} />
      {!ended && <FestiveCelebration />}

      {/* 1 — Hero */}
      <section className="relative" style={RANGOLI_BG}>
        <Toran className="absolute inset-x-0 top-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-20 sm:px-6 sm:pt-28 lg:grid-cols-[1.15fr_1fr] lg:pb-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-r-full border-l-4 border-[#C7365A] bg-white px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#0E3D3B] shadow-sm">
              <Sun className="h-4 w-4 text-[#C7365A]" /> 1 November – 31 December 2026
            </p>
            <h1 className="mt-5 text-[2rem] font-black leading-[1.1] tracking-tight text-[#0E3D3B] sm:text-5xl" data-testid="festive-heading">
              NOSTOPS Festive Season Celebration!
            </h1>
            <p className={`${kalam.className} relative mt-3 inline-block text-[2.6rem] leading-tight text-[#F07A1A] sm:text-6xl`} data-testid="festive-promo">
              Your InstaKYC is on us!
              <svg viewBox="0 0 300 16" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-[#F5B521]" aria-hidden="true">
                <path d="M2 10 C60 2, 120 14, 180 7 S270 4, 298 9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#3E5553] sm:text-lg">
              Celebrate the spirit of yoga with NOSTOPS. Complete your teacher profile and enjoy complimentary InstaKYC during our festive season campaign.
            </p>
            {!ended && <FestiveCountdown endsAt={campaign.endsAt} />}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ClaimCta campaign={campaign} testid="festive-claim-hero" />
              <a href="#eligibility" className={btnSecondary} data-testid="festive-explore">Explore Eligibility</a>
            </div>
            <StateNote campaign={campaign} />
            <div className="mt-7 border-t border-dashed border-[#F07A1A]/40 pt-5">
              <p className="mb-3 text-sm font-black text-[#0E3D3B]">Know a yoga teacher? Spread the festive cheer 🪔</p>
              <FestiveShare url={url} testid="festive-share-hero" />
            </div>
          </div>

          {/* Arched photo frame, like a temple doorway */}
          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute -inset-3 rounded-t-[999px] rounded-b-[2rem] border-2 border-dashed border-[#F5B521]/70" aria-hidden="true" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[2rem] border-[6px] border-white shadow-[0_30px_60px_-30px_rgba(14,61,59,0.55)]">
              <Image src="/brand/festive/festive-hero.jpg" alt="Glowing diyas, marigold flowers and a yoga mat decorated for the festive season" fill priority sizes="(min-width: 1024px) 420px, 90vw" className="object-cover object-[70%_center]" />
            </div>
            <Diya className="absolute -bottom-10 -left-6 h-20 w-20 drop-shadow-md" />
            <Diya className="absolute -bottom-8 right-4 h-14 w-14 drop-shadow-md" />
          </div>
        </div>
      </section>

      {/* 2 — Who can participate */}
      <section id="eligibility" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="who-heading">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.6fr] lg:items-center">
          <div>
            <Eyebrow>Who can participate?</Eyebrow>
            <h2 id="who-heading" className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#0E3D3B] sm:text-4xl">An Opportunity for Every Indian Yoga Teacher</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#3E5553] sm:text-base">
              The offer applies to eligible Indian yoga teachers across all three NOSTOPS teacher levels. Eligibility is determined by the NOSTOPS platform when you sign in — not on this page.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {LEVELS.map((l, i) => (
              <article
                key={l.n}
                className={`relative flex flex-col rounded-[1.75rem] border p-6 ${LEVEL_TONES[i].card} ${i === 1 ? 'sm:translate-y-6' : ''}`}
                data-testid={`festive-level-${i + 1}`}
              >
                <span className={`font-serif text-6xl font-black leading-none ${LEVEL_TONES[i].num}`} aria-hidden="true">{i + 1}</span>
                <span className={`mt-4 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${LEVEL_TONES[i].chip}`}>{l.n}</span>
                <h3 className="mt-2 text-xl font-black text-[#0E3D3B]">{l.name}</h3>
                <p className="mt-1.5 text-sm text-[#3E5553]">{l.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — How to qualify */}
      <section className="relative px-4 py-16 sm:px-6 sm:py-24" style={RANGOLI_BG} aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex justify-center"><Eyebrow tone="teal">How do you qualify?</Eyebrow></div>
            <h2 id="how-heading" className="mt-3 text-3xl font-black tracking-tight text-[#0E3D3B] sm:text-4xl">Complete Your Profile. Unlock Your Free KYC.</h2>
          </div>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
            <span className="absolute left-[16.6%] right-[16.6%] top-8 hidden border-t-2 border-dashed border-[#F07A1A]/50 md:block" aria-hidden="true" />
            <span className="absolute bottom-6 left-8 top-6 border-l-2 border-dashed border-[#F07A1A]/50 md:hidden" aria-hidden="true" />
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative flex gap-5 md:flex-col md:items-center md:text-center" data-testid={`festive-step-${i + 1}`}>
                <span className="relative z-10 grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-[#FCF7EE] bg-[#0E3D3B] text-2xl font-black text-white shadow-lg">
                  {i + 1}
                </span>
                <div className="md:mt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#E06A10]">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-black text-[#0E3D3B]">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#3E5553] md:mx-auto md:max-w-[17rem]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3b — Benefits of being verified */}
      <section id="benefits" className="scroll-mt-24 bg-[#FCF7EE] px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="benefits-heading" data-testid="festive-benefits">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex justify-center"><Eyebrow tone="teal">Why get verified?</Eyebrow></div>
            <h2 id="benefits-heading" className="mt-3 text-3xl font-black tracking-tight text-[#0E3D3B] sm:text-4xl">What You Get as a Verified NOSTOPS Teacher</h2>
            <p className="mt-4 text-base leading-relaxed text-[#3E5553]">InstaKYC is your first step. Here is what you can do once you are verified.</p>
          </div>
          <ul className="mt-12 grid gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <li key={b.t} className="flex gap-4 rounded-2xl border border-[#F1E4CF] bg-white p-5 shadow-sm" data-testid={`festive-benefit-${i + 1}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E6F2F0] text-xl" aria-hidden="true">{b.icon}</span>
                <div>
                  <h3 className="text-base font-black text-[#0E3D3B]">{b.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#3E5553]">{b.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-[#5B6F6D]">
            The ✓ Verified Teacher badge, bookings, offerings, wallet, Refer &amp; Earn, widgets and the City Coordinator role open once you pass InstaKYC, NOSTOPS verification and Council empanelment. Each step has its own review. Complimentary KYC does not guarantee verification or empanelment.
          </p>
        </div>
      </section>

      {/* 4 — What it means + 5 — Dates */}
      <section className="bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#F07A1A] via-[#E8662A] to-[#C7365A] p-7 text-white sm:p-10" data-testid="festive-means">
            <Sun className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 text-white/10" />
            <Eyebrow tone="light">What does complimentary InstaKYC mean?</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your KYC Fee. Waived.</h2>
            <ul className="relative mt-7 space-y-4">
              {MEANS.map((m, i) => (
                <li key={m} className="flex items-start gap-4 text-[15px] leading-relaxed text-white/95 sm:text-base">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-black" aria-hidden="true">{i + 1}</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>
          <div data-testid="festive-dates">
            <Eyebrow tone="teal">Campaign dates</Eyebrow>
            <dl className="mt-5 grid gap-4">
              <CalendarTile label="Campaign begins" value="1 November 2026" accent="bg-[#0F5E5A]" />
              <CalendarTile label="Last date to claim" value="31 December 2026" accent="bg-[#F07A1A]" />
              <CalendarTile label="Expiry" value="11:59:59 PM IST, 31 December 2026" accent="bg-[#C7365A]" />
            </dl>
            <p className="mt-5 border-l-4 border-[#F5B521] pl-4 text-sm leading-relaxed text-[#3E5553]">
              Claims must be successfully applied within the campaign period. A promotional waiver applied before expiry remains valid for completing normal KYC verification after the campaign ends.
            </p>
          </div>
        </div>
      </section>

      {/* 6 — FAQ */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="faq-heading">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>Questions</Eyebrow>
            <h2 id="faq-heading" className="mt-3 text-3xl font-black tracking-tight text-[#0E3D3B] sm:text-4xl">Frequently Asked Questions</h2>
            <Diya className="mt-6 hidden h-20 w-20 lg:block" />
          </div>
          <div className="grid gap-3 md:grid-cols-2" data-testid="festive-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="group h-fit rounded-2xl border border-[#EDE6DA] bg-white px-5 transition open:border-[#F6D3AE] open:shadow-[0_14px_30px_-24px_rgba(240,122,26,0.9)]">
                <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-black text-[#0E3D3B]">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFF1E2] text-lg leading-none text-[#F07A1A] transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-[#3E5553]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Final CTA */}
      <section className="px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#0E3D3B] px-6 pb-12 pt-16 text-center text-white sm:px-12 sm:pt-20">
          <Toran className="absolute inset-x-0 top-0 opacity-95" />
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,209,102,0.35) 1.2px, transparent 0)', backgroundSize: '22px 22px' }}
            aria-hidden="true"
          />
          <div className="relative flex justify-center gap-6" aria-hidden="true">
            <Diya className="h-12 w-12" /><Diya className="h-14 w-14 -translate-y-1" /><Diya className="h-12 w-12" />
          </div>
          <h2 className="relative mt-5 text-3xl font-black tracking-tight sm:text-4xl">Your Journey with NOSTOPS Begins Here.</h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            {ended
              ? 'The festive offer has ended and standard InstaKYC pricing applies — your NOSTOPS teacher profile is always free.'
              : 'Complete your teacher profile and take advantage of complimentary InstaKYC this festive season.'}
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ClaimCta campaign={campaign} testid="festive-claim-final" />
            <Link href={FESTIVE_REGISTER_HREF} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-white/80 px-7 py-3 text-base font-black text-white transition hover:bg-white hover:text-[#0E3D3B]" data-testid="festive-register">
              Register as a Yoga Teacher <Arrow />
            </Link>
          </div>
          <div className="relative mt-10 flex flex-col items-center">
            <p className="mb-3 text-sm font-black text-white/90">Share the offer with fellow teachers</p>
            <FestiveShare url={url} tone="dark" testid="festive-share-final" />
          </div>
        </div>
      </section>
    </div>
  );
}
