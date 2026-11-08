import Link from 'next/link';
import { getGuide } from '@/lib/guides';

// Contextual promo for the NOSTOPS editorial guides. Renders real guide data
// (title + description) from lib/guides.ts — never invented copy — as internal
// links to drive discovery and search traffic from product pages.
export default function GuidesPromo({
  slugs,
  heading = 'Helpful guides',
  subtitle,
  className = '',
}: {
  slugs: string[];
  heading?: string;
  subtitle?: string;
  className?: string;
}) {
  const guides = slugs.map(getGuide).filter((g): g is NonNullable<typeof g> => Boolean(g));
  if (guides.length === 0) return null;
  return (
    <section className={`container-x py-12 ${className}`} aria-label={heading} data-testid="guides-promo">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{heading}</h2>
          {subtitle && <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p>}
        </div>
        <Link href="/guides" className="hidden shrink-0 text-sm font-bold text-brand-700 hover:underline sm:inline">All guides →</Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            data-testid="guide-promo-card"
            className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
          >
            <p className="text-xs font-black uppercase tracking-wide text-brand-700">{g.topic}</p>
            <h3 className="mt-2 text-base font-black leading-snug text-ink group-hover:text-brand-700">{g.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{g.description}</p>
            <span className="mt-4 text-sm font-bold text-brand-700">Read guide →</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 sm:hidden">
        <Link href="/guides" className="text-sm font-bold text-brand-700 hover:underline">All guides →</Link>
      </div>
    </section>
  );
}
