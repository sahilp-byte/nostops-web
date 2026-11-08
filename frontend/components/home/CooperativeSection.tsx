import Image from 'next/image';
import Link from 'next/link';
import SectionHead from './SectionHead';
import { ArrowRight, IconAward, IconGroup, IconNetwork, IconShieldCheck } from './icons';

const PILLARS = [
  { Icon: IconAward, title: 'Professional Recognition', desc: 'Greater visibility for yoga teachers.', tint: 'bg-[#E4532A]' },
  { Icon: IconNetwork, title: 'Opportunities', desc: 'Connect with individuals and organisations.', tint: 'bg-[#1F8A4C]' },
  { Icon: IconShieldCheck, title: 'Verified Credentials', desc: 'Build trust and professional credibility.', tint: 'bg-[#2F7FCF]' },
  { Icon: IconGroup, title: 'Supported by the Council of Yoga Gurus', desc: 'With decades of experience.', tint: 'bg-[#6A3FD0]' },
];

// 4 — The Teacher-First Yoga Cooperative.
export default function CooperativeSection() {
  return (
    <section className="relative flex flex-col overflow-hidden border-y border-[#EBE1D2] bg-[#F6EFE3] lg:block" data-testid="home-cooperative">
      <div className="relative order-2 h-80 sm:h-96 lg:absolute lg:inset-y-0 lg:right-0 lg:z-10 lg:h-auto lg:w-[42%]">
        <Image
          src="/brand/home/teacher.jpg"
          alt="A smiling yoga teacher greeting with namaste at sunset"
          fill
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover object-[28%_30%]"
        />
        <div aria-hidden className="absolute inset-y-0 left-0 hidden w-28 bg-gradient-to-r from-[#F6EFE3] to-transparent lg:block" />
        <div className="absolute bottom-4 right-4 w-[60%] rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur sm:w-auto sm:max-w-[280px] sm:p-5 lg:bottom-auto lg:right-6 lg:top-1/2 lg:max-w-[250px] lg:-translate-y-1/2 xl:right-10">
          <p className="font-serif text-lg font-bold leading-snug text-[#0E3D3B] sm:text-xl">
            <Link href="/teachers" data-testid="home-cooperative-movement" className="transition-colors hover:text-[#E4532A]">
              Join a movement that puts teachers first.
            </Link>
          </p>
          <Link
            href="/teachers"
            data-testid="home-cooperative-join"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#E4532A] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#C2401C]"
          >
            Join the Teachers Network <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="container-x relative order-1 py-12 lg:py-14">
        <div className="lg:w-[55%]">
          <SectionHead title="The Teacher-First Yoga Cooperative" sub="Dignity, opportunity and a thriving ecosystem for yoga teachers." />
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
            {PILLARS.map(({ Icon, title, desc, tint }) => (
              <li key={title} className="text-center">
                <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-white shadow-sm ${tint}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-3 text-sm font-bold leading-snug text-[#0E3D3B]">{title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-[#4A5F5C]">{desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
