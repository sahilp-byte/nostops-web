import Link from 'next/link';
import type { ReactNode } from 'react';
import { COVERAGE_META, isCoverageStatus } from '@/lib/coverage';
import { SpBreadcrumbs, type Crumb } from '@/components/spaces/ui';

// Phase 8B.2 — small server-safe pieces shared by the four Localities screens.
export function CoverageBadge({ status, testId }: { status: string | null | undefined; testId?: string }) {
  if (!isCoverageStatus(status)) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#C9C2B6] bg-white px-2.5 py-1 text-xs font-semibold text-[#6E6A63]" data-testid={testId}>No record</span>;
  }
  const m = COVERAGE_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${m.chip}`} data-testid={testId}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden />{m.label}
    </span>
  );
}

const TABS = [
  { key: 'overview', label: 'Overview', href: '/app/admin/spaces-localities' },
  { key: 'manage', label: 'Manage localities', href: '/app/admin/spaces-localities/manage' },
];

export function CoverageHeader({ title, subtitle, crumbs, tab, aside }: { title: ReactNode; subtitle?: ReactNode; crumbs?: Crumb[]; tab?: 'overview' | 'manage'; aside?: ReactNode }) {
  return (
    <header className="mb-6" data-testid="coverage-header">
      <SpBreadcrumbs items={[{ label: 'Admin', href: '/app/admin' }, { label: 'Spaces Localities', href: '/app/admin/spaces-localities' }, ...(crumbs || [])]} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#E8690C]">Admin · NOSTOPS Spaces</p>
          <h1 className="mt-1 text-[28px] leading-tight sm:text-[34px]">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-[15px] text-[#3B4762]">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {tab && (
        <nav className="mt-4 flex gap-2 border-b border-[#EEDFC8]" aria-label="Localities sections" data-testid="coverage-tabs">
          {TABS.map((t) => (
            <Link key={t.key} href={t.href} aria-current={t.key === tab ? 'page' : undefined}
              className={`-mb-px inline-flex min-h-[44px] items-center border-b-[3px] px-3 text-sm font-semibold ${t.key === tab ? 'border-[#F28A1E] text-[#0F4C4A]' : 'border-transparent text-[#3B4762] hover:text-[#E8690C]'}`}
              data-testid={`coverage-tab-${t.key}`}>{t.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function CoverageError({ message, testId = 'coverage-error' }: { message: string; testId?: string }) {
  return <p role="alert" className="rounded-2xl border border-[#F3C1BC] bg-[#FDECEA] px-4 py-3 text-sm font-medium text-[#8A2A22]" data-testid={testId}>{message}</p>;
}

export function Field({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#6E6A63]">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-medium text-[#1C2A47]">{children}</dd>
    </div>
  );
}
