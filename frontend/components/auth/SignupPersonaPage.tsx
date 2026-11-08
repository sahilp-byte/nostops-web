import Link from 'next/link';
import Image from 'next/image';
import { kalam } from '@/components/home/fonts';
import { TEACHER_SHARE_SENTENCE } from '@/lib/org/pricing';

// Sign Up = persona selection. Not a form: every card opens the EXISTING pathway unchanged
// (seeker /register, teacher /join, the other existing entry pages). Names and destinations are the
// ones that already existed on /signup, plus the two existing public entry pathways for retreat
// hosts and venue owners (footer "Host a Retreat" / "List your Venue"). "Joining a Programme" needs
// no account (programme registration stays account-free).

type Primary = {
  key: 'teacher' | 'seeker';
  href: string;
  img: string;
  title: string;
  desc: string;
  points: string[];
  cta: string;
  tone: 'saffron' | 'teal';
};

const PRIMARY: Primary[] = [
  {
    key: 'teacher',
    href: '/join',
    img: '/brand/home/teacher.jpg',
    title: 'Yoga Teacher',
    desc: 'Share your knowledge, reach more students and grow your impact.',
    points: ['Create your profile.', 'Offer classes and retreats.', 'Be part of a trusted community.'],
    cta: 'Sign Up as a Yoga Teacher',
    tone: 'saffron',
  },
  {
    key: 'seeker',
    href: '/register',
    img: '/brand/home2/seeker.jpg',
    title: 'Yoga Seeker',
    desc: 'Find verified yoga teachers and programmes that suit your goals.',
    points: ['One-to-one or group sessions.', 'Online, offline or at your workplace.', 'Mind, body and special needs support.'],
    cta: 'Sign Up as a Yoga Seeker',
    tone: 'teal',
  },
];

type Other = { key: string; href: string; img: string; icon: IconName; title: string; desc: string; cta: string; note?: string };

const OTHERS: Other[] = [
  {
    key: 'organisation',
    href: '/for-organisations',
    img: '/brand/org/companies-mind.jpg',
    icon: 'building',
    title: 'Organisation',
    desc: 'Host lineage-rooted wellbeing programmes for your team or institution — we match Council-verified teachers.',
    cta: 'Continue as an Organisation',
  },
  {
    key: 'participant',
    href: '/programmes',
    img: '/brand/org/schools-body.jpg',
    icon: 'ticket',
    title: 'Joining a Programme',
    desc: "Register for your company or institution's NOSTOPS programme — confirm your seat in seconds.",
    cta: 'Find your programme',
    note: 'No account needed',
  },
  {
    key: 'coordinator',
    href: '/city-coordinator',
    img: '/brand/auth/coordinator.jpg',
    icon: 'pin',
    title: 'City Coordinator',
    desc: 'Help grow the teacher-first cooperative in your city and support local teachers and seekers.',
    cta: 'Continue as a Coordinator',
  },
  {
    key: 'retreat-host',
    href: '/retreats/host',
    img: '/brand/home/retreat.jpg',
    icon: 'mountain',
    title: 'Host a Retreat',
    desc: 'Plan and host a meaningful yoga retreat with NOSTOPS teachers and venues.',
    cta: 'Host a Retreat',
  },
  {
    key: 'venue',
    href: '/list-your-venue',
    img: '/brand/home/closing.jpg',
    icon: 'home',
    title: 'List your Venue',
    desc: 'Retreat centres and studios can list their space free and welcome yoga retreats.',
    cta: 'List your Venue',
  },
];

type IconName = 'people' | 'building' | 'ticket' | 'pin' | 'mountain' | 'home' | 'shield' | 'leaf' | 'growth';

function Icon({ name, className = 'h-7 w-7' }: { name: IconName; className?: string }) {
  const p = { viewBox: '0 0 24 24', className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'people':
      return <svg {...p}><circle cx="12" cy="8" r="3" /><circle cx="5.5" cy="9.5" r="2.2" /><circle cx="18.5" cy="9.5" r="2.2" /><path d="M6.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M2 18c0-2.2 1.5-3.8 3.5-3.8M22 18c0-2.2-1.5-3.8-3.5-3.8" /></svg>;
    case 'building':
      return <svg {...p}><path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" /></svg>;
    case 'ticket':
      return <svg {...p}><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3v4Z" transform="translate(0 2)" /><path d="M14 6v12" strokeDasharray="2 2" /></svg>;
    case 'pin':
      return <svg {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
    case 'mountain':
      return <svg {...p}><path d="m2 20 7-11 4 6 3-4 6 9H2Z" /><circle cx="17" cy="5" r="2" /></svg>;
    case 'home':
      return <svg {...p}><path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5" /></svg>;
    case 'shield':
      return <svg {...p}><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.8 12.2 2.2 2.2 4.2-4.4" /></svg>;
    case 'leaf':
      return <svg {...p}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l7-7" /></svg>;
    case 'growth':
      return <svg {...p}><path d="M4 20V14M10 20V10M16 20V6M3 9l6-5 4 3 7-5" /></svg>;
  }
}

const Arrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.64l-3.22-3.22a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
  </svg>
);

function PrimaryCard({ p, selected }: { p: Primary; selected: boolean }) {
  const saffron = p.tone === 'saffron';
  return (
    <article
      data-testid={`signup-persona-${p.key}`}
      aria-current={selected ? 'true' : undefined}
      className={`flex flex-col overflow-hidden rounded-3xl border bg-white shadow-[0_12px_40px_-18px_rgba(14,61,59,0.35)] sm:flex-row ${
        selected ? (saffron ? 'border-[#F07A1A] ring-2 ring-[#F07A1A]/40' : 'border-[#0F5E5A] ring-2 ring-[#0F5E5A]/40') : 'border-[#EDE6DA]'
      }`}
    >
      <div className="relative h-52 sm:h-auto sm:w-[44%] sm:shrink-0">
        <Image src={p.img} alt="" fill sizes="(min-width: 1024px) 260px, (min-width: 640px) 40vw, 100vw" className="object-cover" />
      </div>
      <div className={`flex flex-1 flex-col p-6 sm:p-7 ${saffron ? 'bg-gradient-to-br from-[#FFF6EC] to-white' : 'bg-gradient-to-br from-[#EEF6F4] to-white'}`}>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${saffron ? 'bg-[#FDE7D2] text-[#E06A10]' : 'bg-[#D9ECE8] text-[#0F5E5A]'}`}>
          <Icon name={saffron ? 'leaf' : 'people'} />
        </span>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-black tracking-tight text-[#0E3D3B]">{p.title}</h2>
          {selected && <span className="rounded-full bg-[#0E3D3B] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Suggested for you</span>}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-[#3E5553]">{p.desc}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-[#3E5553]">
          {p.points.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${saffron ? 'bg-[#F07A1A]' : 'bg-[#0F5E5A]'}`} />
              {t}
            </li>
          ))}
        </ul>
        {p.key === 'teacher' && <p className="mt-3 text-xs text-[#6B7C7A]">{TEACHER_SHARE_SENTENCE}</p>}
        <Link
          href={p.href}
          data-testid={`signup-role-${p.key}`}
          autoFocus={selected}
          className={`mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-black text-white shadow-md transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            saffron ? 'bg-[#F07A1A] hover:bg-[#DD6A0E] focus-visible:ring-[#F07A1A]' : 'bg-[#0F5E5A] hover:bg-[#0B4A47] focus-visible:ring-[#0F5E5A]'
          }`}
        >
          {p.cta} <Arrow />
        </Link>
      </div>
    </article>
  );
}

function OtherCard({ o, selected }: { o: Other; selected: boolean }) {
  return (
    <article
      data-testid={`signup-persona-${o.key}`}
      aria-current={selected ? 'true' : undefined}
      className={`flex overflow-hidden rounded-2xl border bg-white shadow-[0_8px_28px_-18px_rgba(14,61,59,0.35)] ${selected ? 'border-[#0F5E5A] ring-2 ring-[#0F5E5A]/30' : 'border-[#EDE6DA]'}`}
    >
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <span className="text-[#0F5E5A]"><Icon name={o.icon} /></span>
        <h3 className="mt-3 text-lg font-black tracking-tight text-[#0E3D3B]">{o.title}</h3>
        {o.note && <span className="mt-1 inline-flex w-fit rounded-full bg-[#FDE7D2] px-2 py-0.5 text-[11px] font-bold text-[#B4530A]">{o.note}</span>}
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#3E5553]">{o.desc}</p>
        <Link
          href={o.href}
          data-testid={`signup-role-${o.key}`}
          autoFocus={selected}
          className="mt-4 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-xl border border-[#0F5E5A]/60 px-4 py-2 text-sm font-bold text-[#0E3D3B] transition hover:bg-[#EEF6F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5E5A]"
        >
          {o.cta} <Arrow />
        </Link>
      </div>
      <div className="relative hidden w-[36%] shrink-0 sm:block">
        <Image src={o.img} alt="" fill sizes="160px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/10 to-transparent" />
      </div>
    </article>
  );
}

const TRUST: { icon: IconName; text: string }[] = [
  { icon: 'people', text: 'A trusted national platform' },
  { icon: 'shield', text: 'Verified profiles and credentials' },
  { icon: 'leaf', text: 'Meaningful connections and opportunities' },
  { icon: 'growth', text: 'Support for personal and professional growth' },
];

export default function SignupPersonaPage({ preselect }: { preselect?: string }) {
  return (
    <div data-testid="signup-page">
      {/* Hero: landscape only, no people */}
      <section className="relative overflow-hidden">
        <Image src="/brand/auth/signup-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FCFAF6]/70 via-[#FCFAF6]/45 to-[#FCFAF6]" />
        <div className="relative mx-auto max-w-4xl px-4 pb-24 pt-16 text-center sm:pb-28 sm:pt-20">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-[#0E3D3B] sm:text-5xl lg:text-6xl" data-testid="signup-heading">
            Join NOSTOPS
            <span className="mt-1 block text-[#0F5E5A]">Explore Your Persona</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[#3E5553] sm:text-lg">
            Be part of a trusted yoga community. Create your account and access opportunities, programmes and connections.
          </p>
        </div>
        <p aria-hidden="true" className={`${kalam.className} absolute right-6 top-8 hidden rotate-[-8deg] text-right text-3xl leading-tight text-[#0F5E5A]/90 lg:block`}>
          People<br />Purpose<br />Progress
        </p>
      </section>

      <div className="relative mx-auto -mt-14 max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {PRIMARY.map((p) => <PrimaryCard key={p.key} p={p} selected={p.key === preselect} />)}
        </div>

        <h2 className="mt-14 text-2xl font-black tracking-tight text-[#0E3D3B] sm:text-3xl">Other Personas on NOSTOPS</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OTHERS.filter((o) => o.key !== 'coordinator').map((o) => <OtherCard key={o.key} o={o} selected={o.key === preselect} />)}
        </div>

        <ul className="mt-12 grid gap-4 rounded-2xl border border-[#EDE6DA] bg-white px-6 py-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="signup-trust">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-center gap-3 text-sm font-semibold text-[#3E5553]">
              <span className="text-[#F07A1A]"><Icon name={t.icon} className="h-6 w-6" /></span>
              {t.text}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-[#3E5553]">
          Already have an account?{' '}
          <Link href="/login" className="inline-flex min-h-[44px] items-center font-bold text-[#0F5E5A] underline-offset-2 hover:underline" data-testid="signup-login-link">Log in</Link>
        </p>
      </div>
    </div>
  );
}
