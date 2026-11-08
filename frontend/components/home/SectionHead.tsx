import Link from 'next/link';
import { ArrowRight } from './icons';

// Homepage section heading: serif title + one-line intro, optional "Explore …" link on the right.
export default function SectionHead({
  title,
  sub,
  link,
}: {
  title: string;
  sub: string;
  link?: { href: string; label: string; testId: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <h2 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-[#0E3D3B] sm:text-[30px]">{title}</h2>
        <p className="mt-1 text-[15px] text-[#4A5F5C]">{sub}</p>
      </div>
      {link && (
        <Link
          href={link.href}
          data-testid={link.testId}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#E4532A] transition-colors hover:text-[#C2401C] hover:underline"
        >
          {link.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
