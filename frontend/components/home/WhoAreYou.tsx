import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from './icons';

// "Who are you?" — the two primary pathways (Yoga Teachers, Yoga Seekers) as large photo cards,
// then four smaller discovery cards. Every CTA goes to an EXISTING route; nothing here creates a
// new persona or registration flow.
const TEAL = '#0E4D52';
const SAFFRON = '#EF7D22';

const svg = (d: ReactNode, cls = 'h-9 w-9') => (
  <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>{d}</svg>
);
const Sun = () => (
  <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" stroke={SAFFRON} strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
    <circle cx="24" cy="24" r="8" /><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M10.5 37.5l4.2-4.2M33.3 14.7l4.2-4.2" strokeLinecap="round" />
  </svg>
);
const Group = (cls?: string) => svg(<path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6.5 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 13.5c-3.6 0-6 2-6 4.5V20h12v-2c0-2.5-2.4-4.5-6-4.5zm-6.8.8C3 14.6 1 16 1 18v2h3.5v-2c0-1.4.6-2.7 1.7-3.7zm13.6 0c1.1 1 1.7 2.3 1.7 3.7v2H23v-2c0-2-2-3.4-4.2-3.7z" />, cls);
const Building = () => svg(<path d="M4 3h12v18H4zm2 2v2h2V5zm4 0v2h2V5zM6 9v2h2V9zm4 0v2h2V9zm-4 4v2h2v-2zm4 0v2h2v-2zm-2 4v4h4v-4zm9-8h3v12h-3z" />, 'h-8 w-8');
const Cap = () => svg(<path d="M12 3 1 9l11 6 9-4.9V17h2V9zM5 13.2V17c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.8l-7 3.8z" />, 'h-8 w-8');
const Pin = () => svg(<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />, 'h-8 w-8');
const Check = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden>
    <circle cx="10" cy="10" r="10" fill={color} />
    <path d="m6 10.2 2.6 2.6L14.2 7.4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Primary = {
  key: string; title: string; desc: string; points: string[]; cta: string; href: string;
  img: string; alt: string; pos: string; bg: string; accent: string; icon: ReactNode;
};
const PRIMARY: Primary[] = [
  {
    key: 'teachers', title: 'Yoga Teachers', desc: 'Share your knowledge, reach more students and grow your impact.',
    points: ['Create your profile', 'Offer classes and retreats', 'Be part of a trusted community'],
    cta: 'Register as a Yoga Teacher', href: '/signup?role=teacher',
    img: '/brand/home/teacher.jpg', alt: 'A smiling yoga teacher greeting with folded hands', pos: 'object-[50%_25%]',
    bg: 'bg-gradient-to-br from-[#FFF3E2] to-[#FFF9F1]', accent: SAFFRON, icon: <Sun />,
  },
  {
    key: 'seekers', title: 'Yoga Seekers', desc: 'Find verified yoga teachers and programmes that suit your goals.',
    points: ['One-to-one or group sessions', 'Online, offline or at your workplace', 'Mind, body and special needs support'],
    cta: 'Register as a Yoga Seeker', href: '/signup?role=seeker',
    img: '/brand/home2/seeker.jpg', alt: 'A woman meditating cross-legged in a bright room with plants', pos: 'object-center',
    bg: 'bg-gradient-to-br from-[#E6F1F1] to-[#F1F7F6]', accent: TEAL, icon: <span className="text-[#0E4D52]">{Group('h-11 w-11')}</span>,
  },
];

const SECONDARY = [
  { key: 'companies', title: 'Companies', desc: 'Bring yoga to your workplace. Healthier teams. Higher productivity.', cta: 'Register Your Company', href: '/for-organisations/companies?cohort=COMPANY#enquire', img: '/brand/home2/companies.jpg', alt: 'A modern glass office building', icon: <Building /> },
  { key: 'institutions', title: 'Educational Institutions', desc: 'Integrate yoga into your campus and curriculum.', cta: 'Register Your Institution', href: '/for-organisations/educational-institutions?cohort=EDUCATIONAL_INSTITUTION#enquire', img: '/brand/home2/education.jpg', alt: 'Students walking across a leafy campus', icon: <Cap /> },
  { key: 'groups', title: 'Startup & Networking Groups', desc: 'Add yoga to your community and events.', cta: 'Register Your Group', href: '/for-organisations/startup-networking-groups?cohort=STARTUP_NETWORK#enquire', img: '/brand/home2/startup.jpg', alt: 'Founders talking together at a meetup', icon: Group('h-8 w-8') },
  { key: 'venues', title: 'Venues & Retreat Hosts', desc: 'List your venue and host meaningful yoga retreats.', cta: 'List Your Venue', href: '/list-your-venue', img: '/brand/home/retreat.jpg', alt: 'An open-air yoga pavilion among palm trees', icon: <Pin /> },
];

export default function WhoAreYou() {
  return (
    <section className="bg-[#FCFAF6] pb-14 pt-4" data-testid="home-who">
      <div className="mx-auto max-w-[1480px] px-3 sm:px-5">
        <h2 className="sr-only">Who are you?</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {PRIMARY.map((c) => (
            <article key={c.key} data-testid={`who-${c.key}`} className="grid overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_-16px_rgba(14,77,82,0.35)] sm:grid-cols-[38%_1fr]">
              <div className="relative min-h-[220px] sm:min-h-[260px]">
                <Image src={c.img} alt={c.alt} fill sizes="(min-width: 1024px) 19vw, (min-width: 640px) 38vw, 100vw" className={`object-cover ${c.pos}`} />
              </div>
              <div className={`${c.bg} flex flex-col px-6 py-6 sm:px-7`}>
                <div className="flex items-center gap-3">
                  {c.icon}
                  <h3 className="text-2xl font-extrabold tracking-tight text-[#0E4D52]">{c.title}</h3>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[#24474A]">{c.desc}</p>
                <ul className="mt-3 space-y-1.5">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px] text-[#24474A]"><Check color={c.accent} />{p}</li>
                  ))}
                </ul>
                <Link
                  href={c.href}
                  data-testid={`who-${c.key}-cta`}
                  className="mt-5 inline-flex min-h-12 items-center gap-2 self-start rounded-xl px-6 text-[15px] font-bold text-white shadow-md transition-opacity hover:opacity-90"
                  style={{ background: c.accent }}
                >
                  {c.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SECONDARY.map((c) => (
            <article key={c.key} data-testid={`who-${c.key}`} className="relative flex min-h-[190px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#F1F6F7] to-[#FAFCFB] shadow-[0_8px_24px_-16px_rgba(14,77,82,0.35)]">
              <div className="absolute inset-y-0 right-0 w-[36%]">
                <Image src={c.img} alt={c.alt} fill sizes="(min-width: 1280px) 10vw, (min-width: 640px) 20vw, 40vw" className="object-cover object-right" />
                <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#F3F8F8] to-transparent" />
              </div>
              <div className="relative flex w-[72%] flex-col px-5 py-5">
                <span className="text-[#0E4D52]">{c.icon}</span>
                <h3 className="mt-2 text-lg font-extrabold leading-tight tracking-tight text-[#0E4D52]">{c.title}</h3>
                <p className="mt-1.5 pb-3 text-sm leading-snug text-[#24474A]">{c.desc}</p>
                <Link
                  href={c.href}
                  data-testid={`who-${c.key}-cta`}
                  className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start whitespace-nowrap rounded-xl border-2 border-[#0E4D52] bg-white/90 px-3.5 text-[13px] font-bold text-[#0E3D3B] transition-colors hover:bg-white"
                >
                  {c.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
