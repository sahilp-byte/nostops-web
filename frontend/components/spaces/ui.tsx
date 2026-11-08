import Link from 'next/link';
import type { ReactNode } from 'react';

// NOSTOPS Spaces — shared visual building blocks (see app/spaces-theme.css for tokens).
// Server-safe: no hooks, so every Spaces page (server or client) can use them.

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" />,
  pin: <><path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.4" /><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2M15 14.6c2.6-.3 4.9 1.2 5.6 4.4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" /></>,
  building: <><path d="M4 21V5.5L12 3v18M12 8h8v13M2.5 21h19" /><path d="M7 8h2M7 11.5h2M7 15h2M15 11.5h2M15 15h2" /></>,
  tag: <><path d="M3.5 12.5 12 4h7.5v7.5L11 20a1.6 1.6 0 0 1-2.2 0l-5.3-5.3a1.6 1.6 0 0 1 0-2.2Z" /><circle cx="15.5" cy="8" r="1.4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  doc: <><path d="M6 3h8.5L19 7.5V21H6Z" /><path d="M14 3v5h5M9 12.5h7M9 16h7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  chart: <path d="M4 20V10M9.5 20V6M15 20v-8M20.5 20V4M2.5 20.5h19" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H5M11 6l-6 6 6 6" />,
  camera: <><path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4Z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z" /><path d="m8.8 12 2.3 2.3 4.2-4.4" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 6.5L20.5 7" /></>,
  handshake: <path d="m2.5 11 4-4 3.5 1.5L13 6.5l3 1L21.5 11M2.5 11l7 7c.8.8 2 .8 2.8 0l1-1M21.5 11l-5.5 5.5M8 13l3 3M10.5 10.5l4 4" />,
  sprout: <path d="M12 21v-8M12 13c0-4-3-7-8-7 0 4 3 7 8 7Zm0-2c0-3.5 2.6-6.5 7.5-6.5 0 3.7-2.8 6.5-7.5 6.5Z" />,
  layers: <path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
};
export type SpIconName = keyof typeof PATHS;

export function SpIcon({ name, className = 'h-6 w-6', strokeWidth = 1.7 }: { name: SpIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export type Crumb = { label: string; href?: string };

export function SpBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-[#1C2A47]" data-testid="sp-breadcrumbs">
      <Link href="/" aria-label="NOSTOPS home" className="text-[#0F4C4A] hover:text-[#E8690C]"><SpIcon name="home" className="h-[18px] w-[18px]" strokeWidth={2.2} /></Link>
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-2">
          <span aria-hidden className="text-[#1C2A47]">›</span>
          {c.href && i < items.length - 1 ? <Link href={c.href} className="hover:text-[#E8690C]">{c.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// Orange brush-stroke underline used beneath every Spaces page title.
export function SpSwash({ className = 'w-64' }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 14" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path d="M2 10C60 3 150 1.5 258 6.5" stroke="#F28A1E" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M40 12C110 7.5 180 7 232 9" stroke="#F7B36B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Page title block: breadcrumb · large teal serif title · subtitle · swash,
// with the screenshot hero photograph fading in on the right (decorative only).
export function SpacesPageHeader({
  crumbs, title, subtitle, eyebrow, image = '/brand/spaces/hero-pavilion.jpg', aside, testId,
}: {
  crumbs?: Crumb[]; title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; image?: string | null; aside?: ReactNode; testId?: string;
}) {
  return (
    <header className="relative overflow-hidden" data-testid={testId || 'sp-page-header'}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden className="sp-fade-left pointer-events-none absolute right-0 top-0 hidden h-full min-h-[200px] max-h-[260px] w-[40%] object-cover object-[center_40%] lg:block" />
      )}
      <div className="relative flex items-start gap-3 pb-2 pt-1">
        <div className={`relative min-w-0 flex-1 ${image ? 'lg:max-w-[calc(58%-6rem)]' : ''}`}>
          {crumbs && <SpBreadcrumbs items={crumbs} />}
          {eyebrow && <div className="mt-3">{eyebrow}</div>}
          <h1 className="mt-2 text-[34px] leading-[1.15] lg:text-[42px]" style={{ fontFamily: 'var(--sp-serif)', color: 'var(--sp-teal)', fontWeight: 900 }}>{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-[17px] font-medium text-[#1C2A47] lg:text-[19px]">{subtitle}</p>}
          <SpSwash className="mt-1 h-3 w-56 lg:w-72" />
          {/* With a banner image, actions sit under the title so they never land on the image's faded edge. */}
          {aside && image && <div className="relative z-10 mt-4">{aside}</div>}
        </div>
        {aside && !image && <div className="relative z-10 shrink-0">{aside}</div>}
      </div>
    </header>
  );
}

// Numbered step tracker: green tick = complete, saffron = current (label sits in a soft pill), grey = to do.
export function SpStepper({
  steps, current, isDone, onSelect, isDisabled, testIdPrefix = 'sp-step', label = 'Progress',
}: {
  steps: string[]; current: number; isDone?: (i: number) => boolean; onSelect?: (i: number) => void; isDisabled?: (i: number) => boolean; testIdPrefix?: string; label?: string;
}) {
  return (
    <ol className="flex list-none items-start p-0" aria-label={label} data-testid="sp-stepper">
      {steps.map((s, i) => {
        const done = i !== current && (isDone ? isDone(i) : i < current);
        const active = i === current;
        const circle = (
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[19px] font-semibold ring-4 ${done ? 'bg-[#22A447] text-white ring-[#DFF1D3]' : active ? 'bg-gradient-to-b from-[#FFA149] to-[#E8690C] text-white ring-[#FDE2C2]' : 'border-2 border-[#C9C2B6] bg-white text-[#5B5B5B] ring-transparent'}`}>
            {done ? <SpIcon name="check" className="h-6 w-6" strokeWidth={3} /> : i + 1}
          </span>
        );
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={`h-[3px] flex-1 rounded ${i === 0 ? 'opacity-0' : done || active ? 'bg-[#7CC46A]' : 'bg-[#E3DCCF]'}`} />
              {onSelect ? (
                <button type="button" onClick={() => onSelect(i)} disabled={isDisabled?.(i)} aria-current={active ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s}`} className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FBC98E]" data-testid={`${testIdPrefix}-${i}`}>{circle}</button>
              ) : <span aria-current={active ? 'step' : undefined} data-testid={`${testIdPrefix}-${i}`}>{circle}</span>}
              <span className={`h-[3px] flex-1 rounded ${i === steps.length - 1 ? 'opacity-0' : done ? 'bg-[#7CC46A]' : 'bg-[#E3DCCF]'}`} />
            </div>
            <span className={`mt-2 hidden max-w-full rounded-full px-2 py-1 text-[14px] leading-tight sm:inline-block lg:px-4 lg:text-[15px] ${active ? 'bg-[#FDE7CC] font-semibold text-[#1C2A47] shadow-sm' : 'font-medium text-[#1C2A47]'}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function SpStepChip({ n, of }: { n: number; of: number }) {
  return <span className="inline-flex rounded-full bg-[#FDE2C2] px-4 py-1 text-[15px] font-semibold text-[#7A2E05]" data-testid="sp-step-chip">Step {n} of {of}</span>;
}

// Card section with an orange line icon + teal serif heading, as used across the references.
export function SpSection({ icon, title, children, className = '', testId, action }: { icon?: SpIconName; title?: ReactNode; children: ReactNode; className?: string; testId?: string; action?: ReactNode }) {
  return (
    <section className={`sp-card p-5 lg:p-6 ${className}`} data-testid={testId}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-[22px] leading-tight lg:text-[24px]">
            {icon && <span className="text-[#F28A1E]"><SpIcon name={icon} className="h-8 w-8" /></span>}
            <span>{title}</span>
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Big-number stat tile (dashboards).
export function SpStat({ icon, value, label, href, tone = 'peach', testId }: { icon: SpIconName; value: ReactNode; label: string; href?: string; tone?: 'peach' | 'green' | 'lavender' | 'red'; testId?: string }) {
  const tones = { peach: 'bg-[#FDE7CC] text-[#E8690C]', green: 'bg-[#E3F4D6] text-[#22A447]', lavender: 'bg-[#ECE5FB] text-[#6B48C8]', red: 'bg-[#FDE2E0] text-[#D6453D]' };
  const body = (
    <>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><SpIcon name={icon} className="h-7 w-7" /></span>
      <span className="min-w-0"><span className="block text-[28px] font-bold leading-none text-[#1C2A47]">{value}</span><span className="mt-1 block text-[14px] font-medium text-[#3B4762]">{label}</span></span>
    </>
  );
  const cls = 'sp-card flex items-center gap-3 p-4 transition hover:border-[#F2B574]';
  return href ? <Link href={href} className={cls} data-testid={testId}>{body}</Link> : <div className={cls} data-testid={testId}>{body}</div>;
}

// Empty state — icon + message (never placeholder data).
export function SpEmpty({ title, children, testId, action }: { title: string; children?: ReactNode; testId?: string; action?: ReactNode }) {
  return (
    <div className="sp-card flex flex-col items-center px-6 py-10 text-center" data-testid={testId}>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#FDE7CC] text-[#E8690C]"><SpIcon name="info" className="h-7 w-7" /></span>
      <p className="mt-2 text-[20px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{title}</p>
      {children && <div className="mt-1 max-w-md text-[15px] text-[#3B4762]">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Meditating-figure note panel ("Important Note" / "Good to Know").
export function SpNote({ title, children, tone = 'peach', testId }: { title: string; children: ReactNode; tone?: 'peach' | 'green'; testId?: string }) {
  return (
    <div className={`relative flex items-start gap-4 overflow-hidden p-5 ${tone === 'green' ? 'sp-panel-green' : 'sp-panel-peach'}`} data-testid={testId}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 ${tone === 'green' ? 'border-[#22A447] text-[#22A447]' : 'border-[#F28A1E] text-[#F28A1E]'}`}><SpIcon name={tone === 'green' ? 'sprout' : 'info'} className="h-6 w-6" /></span>
      <div className="relative z-10 min-w-0 flex-1 pr-0 lg:pr-28">
        <p className="text-[22px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{title}</p>
        <div className="mt-1 text-[15px] text-[#1C2A47]">{children}</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/spaces/note-figure.png" alt="" aria-hidden className="sp-blend pointer-events-none absolute bottom-0 right-2 hidden h-24 w-auto lg:block" />
    </div>
  );
}
