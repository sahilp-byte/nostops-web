import Image from 'next/image';
import Link from 'next/link';

const BTN = 'inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-sm font-bold shadow-sm transition-colors sm:min-w-[190px]';

// 9 — Closing banner. The shared site footer follows directly; -mb-24 cancels the footer's
// top margin on this page only, so the banner sits flush on the footer.
export default function ClosingBanner() {
  return (
    <section className="relative -mb-24 overflow-hidden" data-testid="home-closing">
      <Image src="/brand/home/closing.jpg" alt="" fill sizes="100vw" className="object-cover object-[30%_50%]" />
      <div aria-hidden className="absolute inset-0 bg-[#FBF7EF]/35" />
      <div className="container-x relative py-14 text-center sm:py-16">
        <h2 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-[#0E3D3B] sm:text-[34px]">
          A Healthier Society Begins With Empowered Teachers.
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-[15px] font-semibold text-[#1F3E3C] sm:text-base">
          Join organisations, communities and individuals in building a healthier, more mindful India.
        </p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href="/for-organisations" data-testid="closing-organisations" className={`${BTN} bg-[#0E4D4A] text-white hover:bg-[#0A3A38]`}>
            For Organisations
          </Link>
          <Link href="/teachers" data-testid="closing-teachers" className={`${BTN} bg-[#0E4D4A] text-white hover:bg-[#0A3A38]`}>
            For Yoga Teachers
          </Link>
          <Link href="/programmes" data-testid="closing-programmes" className={`${BTN} border-2 border-[#E4532A] bg-white text-[#E4532A] hover:bg-[#FDEDE6]`}>
            Explore Programmes
          </Link>
        </div>
      </div>
    </section>
  );
}
