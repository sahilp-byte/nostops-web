import Image from 'next/image';
import Link from 'next/link';
import type { Programme } from '@/lib/server/institutional';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import SectionHead from './SectionHead';
import { ChevronRight } from './icons';

const ORDER = ['MIND', 'BODY', 'SPECIAL_NEEDS'] as const;

const CHIP: Record<string, string> = {
  MIND: 'bg-[#DFF2DD] text-[#1F7A38]',
  BODY: 'bg-[#FDE3D2] text-[#C2401C]',
  SPECIAL_NEEDS: 'bg-[#EADFFB] text-[#5B33C2]',
};
const IMG_SLUG: Record<string, string> = { MIND: 'mind', BODY: 'body', SPECIAL_NEEDS: 'special-needs' };

/** One real catalogue programme per pathway (rotates each visit). */
export function pickHomeProgrammes(all: Programme[]): Programme[] {
  return ORDER.flatMap((k) => {
    const pool = (all || []).filter((p) => p.taxonomy === k);
    return pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
  });
}

function imageFor(p: Programme): string {
  const forStudents = (p.recommended_audience || []).some((a) => /student/i.test(a));
  return `/brand/org/${forStudents ? 'schools' : 'companies'}-${IMG_SLUG[p.taxonomy] || 'mind'}.jpg`;
}

// 6 — Discover Curated Programmes (hidden when the catalogue is unavailable).
export default function ProgrammesSection({ programmes }: { programmes: Programme[] }) {
  if (!programmes.length) return null;
  return (
    <section className="border-t border-[#EBE1D2] bg-white" data-testid="home-programmes">
      <div className="container-x py-12 lg:py-14">
        <SectionHead
          title="Discover Curated Programmes"
          sub="Yoga programmes for individuals, groups and organisations."
          link={{ href: '/programmes', label: 'Explore All Programmes', testId: 'home-programmes-explore' }}
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {programmes.map((p) => {
            const audience = (p.recommended_audience || []).slice(0, 2).join(' & ');
            return (
              <Link
                key={p.programme_id}
                href={`/programmes/${p.slug}`}
                data-testid="home-programme-card"
                className="group flex overflow-hidden rounded-xl border border-[#EBE1D2] bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4532A] focus-visible:ring-offset-2"
              >
                <div className="relative w-28 shrink-0 sm:w-32">
                  <Image src={imageFor(p)} alt="" fill sizes="128px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 p-3.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold leading-snug text-[#0E3D3B] group-hover:text-[#E4532A]">{p.name}</h3>
                    {audience && <p className="mt-0.5 line-clamp-1 text-[13px] text-[#4A5F5C]">For {audience}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${CHIP[p.taxonomy] || CHIP.MIND}`}>
                        {p.taxonomy_label}
                      </span>
                      {p.recommended_group_size && (
                        <span className="rounded-md bg-[#EEF4F8] px-2 py-0.5 text-[11px] font-semibold text-[#36566B]">{p.recommended_group_size}</span>
                      )}
                      <ProgrammeDevNote programme={p} size="xs" />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#E4532A] transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
