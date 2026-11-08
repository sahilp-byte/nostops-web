import type { ReactNode } from 'react';

// Unified public-marketing hero, extracted from /teachers so every public page
// shares one visual language: the `ink → royal → brand` gradient, glowing accent
// orbs, and a consistent type scale / vertical rhythm. Pages supply their own
// (SEO-critical) H1 text, lede, CTAs and optional background photo — this only
// governs the hero chrome, never the content.
type PageHeroProps = {
  eyebrow?: ReactNode;
  /** Rendered as the page <h1> — pass the page's exact heading text. Optional so
   *  richer pages (e.g. detail views) can supply their own heading markup via children. */
  title?: ReactNode;
  /** Primary lede paragraph. */
  subtitle?: ReactNode;
  /** Optional secondary paragraph (softer). */
  note?: ReactNode;
  /** Optional background photo (kept under a unified on-palette gradient overlay). */
  imageSrc?: string | null;
  /** Optional photo credit (e.g. Google Places attribution) shown subtly in the corner. */
  attribution?: ReactNode;
  size?: 'default' | 'tall';
  /** Chips / CTAs / stat line — each child manages its own top margin. */
  children?: ReactNode;
};

export default function PageHero({ eyebrow, title, subtitle, note, imageSrc, attribution, size = 'default', children }: PageHeroProps) {
  const pad = size === 'tall' ? 'py-16 md:py-28' : 'py-16 md:py-24';
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
      {imageSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-ink/90 via-royal/80 to-brand/80" />
        </>
      ) : null}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      <div className={`container-x relative ${pad}`}>
        {eyebrow ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">
            {eyebrow}
          </span>
        ) : null}
        {title ? <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-white md:text-6xl">{title}</h1> : null}
        {subtitle ? <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/85">{subtitle}</p> : null}
        {note ? <p className="mt-4 max-w-3xl leading-relaxed text-white/70">{note}</p> : null}
        {children}
      </div>
      {attribution ? (
        <div className="pointer-events-auto absolute bottom-2 right-3 z-10 max-w-[70%] truncate text-right text-[10px] font-medium text-white/55">
          {attribution}
        </div>
      ) : null}
    </section>
  );
}
