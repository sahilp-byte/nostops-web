import Image from 'next/image';
import Link from 'next/link';
import { ORG_COHORTS } from '@/lib/site-nav';
import SectionHead from './SectionHead';
import { ChevronRight, IconBuilding, IconGradCap, IconGroup } from './icons';

const COHORT_CARD: Record<string, { img: string; Icon: typeof IconBuilding; blurb: string }> = {
  '/for-organisations/companies': {
    img: '/brand/org/companies.jpg',
    Icon: IconBuilding,
    blurb: 'Build healthier workplaces, engaged teams and resilient organisations.',
  },
  '/for-organisations/educational-institutions': {
    img: '/brand/org/education.jpg',
    Icon: IconGradCap,
    blurb: 'Bring yoga and wellbeing into educational communities.',
  },
  '/for-organisations/startup-networking-groups': {
    img: '/brand/org/startup.jpg',
    Icon: IconGroup,
    blurb: 'Make wellbeing part of your professional network.',
  },
};

// 2 — Yoga for Every Organisation (the three real organisation cohorts).
export default function OrgSection() {
  const cards = ORG_COHORTS.filter((c) => COHORT_CARD[c.href]);
  return (
    <section className="bg-[#FCFAF6]" data-testid="home-organisations">
      <div className="container-x pb-6 pt-12 lg:pt-14">
        <SectionHead
          title="Yoga for Every Organisation"
          sub="Customised programmes for workplaces, campuses and professional networks."
          link={{ href: '/for-organisations', label: 'Explore for Organisations', testId: 'home-org-explore' }}
        />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const { img, Icon, blurb } = COHORT_CARD[c.href];
            return (
              <Link
                key={c.href}
                href={c.href}
                data-testid="home-org-card"
                className="group flex flex-col overflow-hidden rounded-xl border border-[#EBE1D2] bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4532A] focus-visible:ring-offset-2"
              >
                <div className="relative aspect-[16/7] overflow-hidden">
                  <Image src={img} alt={`Group yoga session for ${c.label.toLowerCase()}`} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="flex flex-1 items-center gap-3 p-4">
                  <Icon className="h-9 w-9 shrink-0 self-start text-[#0E3D3B]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-[#0E3D3B]">{c.label}</h3>
                    <p className="mt-0.5 text-sm leading-snug text-[#4A5F5C]">{blurb}</p>
                  </div>
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FDE8DF] text-[#E4532A] transition-colors group-hover:bg-[#E4532A] group-hover:text-white">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
