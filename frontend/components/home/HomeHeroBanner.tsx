import Image from 'next/image';
import Link from 'next/link';
import { kalam } from './fonts';
import { ArrowRight } from './icons';

// Homepage hero (2026 redesign). Wide rounded photographic banner: hand-lettered headline,
// supporting copy and two CTAs on the left; the yoga photograph and "People · Purpose ·
// Progress" on the right. On phones the photo follows the copy as its own band.
export default function HomeHeroBanner() {
  return (
    <section className="bg-[#FCFAF6] pt-3 sm:pt-4" data-testid="home-hero">
      <div className="mx-auto max-w-[1480px] px-3 sm:px-5">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#DCEDF2] via-[#EAF4F1] to-[#DDEBDD] shadow-[0_10px_30px_-12px_rgba(14,77,82,0.25)]">
          <div className="absolute inset-y-0 right-0 hidden w-[60%] md:block" aria-hidden>
            <Image src="/brand/home2/hero-woman.jpg" alt="" fill priority sizes="60vw" className="object-cover object-[55%_30%]" />
            <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#E3F0F1] to-transparent" />
          </div>

          <p
            aria-label="People, Purpose, Progress"
            className={`${kalam.className} absolute right-6 top-8 hidden -rotate-12 text-right text-[30px] leading-[1.15] text-[#0E3D3B] lg:block xl:right-12 xl:text-[36px]`}
            data-testid="hero-ppp"
          >
            People<br />Purpose<br />Progress
            <svg aria-hidden viewBox="0 0 120 20" className="ml-auto mt-1 h-4 w-28 text-[#EF7D22]">
              <path d="M4 16C40 6 80 4 116 6" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
            </svg>
          </p>

          <div className="relative max-w-[780px] px-6 py-8 sm:px-10 sm:py-9 lg:px-16 xl:px-20">
            <h1 className={`${kalam.className} whitespace-normal text-[50px] leading-[1.05] text-[#0E4D52] sm:text-[64px] lg:whitespace-nowrap lg:text-[66px] xl:text-[76px]`} data-testid="hero-headline">
              <span className="relative inline-block">
                Yoga
                <svg aria-hidden viewBox="0 0 200 16" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-3 w-full text-[#EF7D22]">
                  <path d="M3 12C60 4 130 3 197 7" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
                </svg>
              </span>{' '}
              se kya hoga?
            </h1>
            <h2 className="mt-3 text-xl leading-snug text-[#0E3D3B] sm:text-[23px]" style={{ fontWeight: 800 }} data-testid="hero-tagline">
              A calmer mind. A healthier body. A brighter tomorrow.
            </h2>
            <p className="mt-3 max-w-[480px] text-base leading-relaxed text-[#24474A] sm:text-[17px]" data-testid="hero-description">
              NOSTOPS connects people, organisations and communities with trusted yoga teachers and curated programmes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:gap-6">
              <Link
                href="/teachers"
                data-testid="hero-cta-find-teacher"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#EF7D22] px-5 text-[15px] font-bold text-white shadow-md shadow-[#EF7D22]/30 transition-colors hover:bg-[#D86A12]"
              >
                Find a Yoga Teacher <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/programmes"
                data-testid="hero-cta-programmes"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#0E4D52] bg-white/80 px-5 text-[15px] font-bold text-[#0E3D3B] transition-colors hover:bg-white"
              >
                Explore Programmes <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative aspect-[16/10] md:hidden">
            <Image src="/brand/home2/hero-woman.jpg" alt="A woman breathing in with open arms on a misty hilltop" fill sizes="100vw" className="object-cover object-[60%_30%]" />
            <p className={`${kalam.className} absolute right-4 top-3 -rotate-12 text-right text-xl leading-tight text-[#0E3D3B]`} aria-hidden>
              People<br />Purpose<br />Progress
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
