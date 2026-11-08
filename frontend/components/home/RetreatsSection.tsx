import Image from 'next/image';
import Link from 'next/link';
import SectionHead from './SectionHead';
import { ArrowRight, IconMeditate, IconVenue } from './icons';

// 8 — Create Meaningful Yoga Retreats (teachers host at listed venues; venue owners list or claim).
export default function RetreatsSection() {
  return (
    <section className="border-t border-[#EBE1D2] bg-white" data-testid="home-retreats">
      <div className="container-x py-12 lg:py-14">
        <SectionHead
          title="Create Meaningful Yoga Retreats"
          sub="Teacher-led retreats at listed venues across India."
          link={{ href: '/retreats', label: 'Browse Retreats', testId: 'home-retreats-browse' }}
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_1fr_1fr]">
          <div className="relative aspect-[3/1] overflow-hidden rounded-xl sm:aspect-[16/5] lg:aspect-auto lg:min-h-[190px]">
            <Image src="/brand/home/retreat.jpg" alt="An open-air yoga pavilion among palm trees at a retreat venue" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[70%_50%]" />
          </div>

          <div className="flex gap-4 rounded-xl border border-[#EBE1D2] bg-[#FCFAF6] p-5 shadow-sm">
            <IconMeditate className="h-11 w-11 shrink-0 text-[#0E3D3B]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="text-base font-bold text-[#0E3D3B]">For Yoga Teachers</h3>
              <p className="mt-1 text-sm leading-snug text-[#4A5F5C]">Host a retreat using existing listed venues.</p>
              <Link
                href="/retreats/host"
                data-testid="home-host-retreat"
                className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[#E4532A] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#C2401C] lg:mt-auto"
              >
                Host a Retreat <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-[#EBE1D2] bg-[#FCFAF6] p-5 shadow-sm">
            <IconVenue className="h-11 w-11 shrink-0 text-[#1F7A38]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="text-base font-bold text-[#0E3D3B]">For Venue Owners</h3>
              <p className="mt-1 text-sm leading-snug text-[#4A5F5C]">List or claim your venue. Optional AI-powered onboarding available.</p>
              <Link
                href="/list-your-venue"
                data-testid="home-list-venue"
                className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border-2 border-[#E4532A] bg-white px-5 text-sm font-bold text-[#E4532A] transition-colors hover:bg-[#FDEDE6] lg:mt-auto"
              >
                List Your Venue <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
