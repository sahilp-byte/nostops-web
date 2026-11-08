import Link from 'next/link';
import SectionHead from './SectionHead';
import { ChevronRight, IconMeditate, IconMind, IconWheelchair } from './icons';

type Pathway = { key: string; label: string; slug: string };

const LOOK: Record<string, { blurb: string; Icon: typeof IconMind; card: string; ink: string }> = {
  MIND: {
    blurb: 'Mental wellbeing, mindfulness and concentration.',
    Icon: IconMind,
    card: 'bg-[#DFF2DD] ring-[#2F8F46]/20 hover:ring-[#2F8F46]/50',
    ink: 'text-[#1F7A38]',
  },
  BODY: {
    blurb: 'Movement, flexibility, strength and mobility.',
    Icon: IconMeditate,
    card: 'bg-[#FDE3D2] ring-[#E4532A]/20 hover:ring-[#E4532A]/50',
    ink: 'text-[#D3471F]',
  },
  SPECIAL_NEEDS: {
    blurb: 'Programmes with individual support and inclusive practices.',
    Icon: IconWheelchair,
    card: 'bg-[#EADFFB] ring-[#6A3FD0]/20 hover:ring-[#6A3FD0]/50',
    ink: 'text-[#5B33C2]',
  },
};

// 3 — Find Your Path to Wellbeing: the programme catalogue's own three pathways (Mind · Body · Special Needs).
export default function PathwaysSection({ pathways }: { pathways: Pathway[] }) {
  const items = pathways.filter((p) => LOOK[p.key]);
  if (!items.length) return null;
  return (
    <section className="bg-[#FCFAF6]" data-testid="home-pathways">
      <div className="container-x pb-12 pt-8 lg:pb-14">
        <SectionHead title="Find Your Path to Wellbeing" sub="Programmes designed around three key pathways." />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {items.map((p) => {
            const { blurb, Icon, card, ink } = LOOK[p.key];
            return (
              <Link
                key={p.key}
                href={`/programmes#${p.slug}`}
                data-testid={`home-pathway-${p.slug}`}
                className={`group flex items-center gap-4 rounded-xl p-5 ring-1 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${card}`}
              >
                <Icon className={`h-14 w-14 shrink-0 ${ink}`} />
                <div className="min-w-0 flex-1">
                  <h3 className={`text-lg font-black uppercase tracking-wide ${ink}`}>{p.label}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-[#3F4F4D]">{blurb}</p>
                </div>
                <ChevronRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${ink}`} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
