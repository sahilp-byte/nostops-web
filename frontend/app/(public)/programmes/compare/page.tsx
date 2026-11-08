import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { listProgrammes, type Programme } from '@/lib/server/institutional';
import { compareHref, MAX_COMPARE } from '@/lib/programme-compare-url';
import { pendingCouncilReview } from '@/lib/org/programme-status';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import OrgEnquirySection from '@/components/org/OrgEnquirySection';
import { CompareSync, CopyCompareLink } from '@/components/programmes/CompareActions';

// Side-by-side comparison of 2–3 programmes (?p=slug,slug). Visitor-specific →
// noindex (founder choice), links followed. No prices (money lock).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare Programmes',
  description: 'Compare NOSTOPS Council-curated Yoga programmes side by side.',
  robots: { index: false, follow: true },
};

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
const CHIP: Record<string, string> = {
  MIND: 'bg-brand-50 text-brand-700',
  BODY: 'bg-emerald-50 text-emerald-700',
  SPECIAL_NEEDS: 'bg-royal-50 text-royal',
};
const dash = <span className="text-muted">—</span>;

function bullets(items: string[] | undefined): ReactNode {
  if (!items?.length) return dash;
  return (
    <ul className="m-0 list-none space-y-1 p-0">
      {items.map((a) => <li key={a}>• {a}</li>)}
    </ul>
  );
}

const ROWS: { label: string; value: (p: Programme) => ReactNode }[] = [
  {
    label: 'Pathway',
    value: (p) => <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${CHIP[p.taxonomy] || CHIP.MIND}`}>{p.taxonomy_label}</span>,
  },
  {
    label: 'Status',
    value: (p) => (
      <div className="flex flex-wrap gap-1.5">
        {p.council_curated && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Council-Curated</span>}
        {p.version && <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">{p.version}</span>}
        {pendingCouncilReview(p) && <ProgrammeDevNote programme={p} />}
      </div>
    ),
  },
  { label: 'What it’s for', value: (p) => p.essence || dash },
  { label: 'Goals', value: (p) => bullets(p.objectives) },
  { label: 'Who it suits', value: (p) => bullets(p.recommended_audience) },
  { label: 'Group size', value: (p) => p.recommended_group_size || dash },
  { label: 'How often', value: (p) => p.recommended_frequency || dash },
  { label: 'Session length', value: (p) => p.recommended_duration_label || (p.default_duration_minutes ? `${p.default_duration_minutes} minutes per session` : dash) },
  { label: 'Level', value: (p) => p.level || dash },
  { label: 'Languages', value: (p) => (p.languages?.length ? p.languages.join(', ') : dash) },
  { label: 'Teachers', value: (p) => bullets(p.teacher_competency_requirements) },
];

function parseSlugs(raw: string | string[] | undefined): string[] {
  const s = (Array.isArray(raw) ? raw.join(',') : raw || '').split(',').map((x) => x.trim().toLowerCase());
  return [...new Set(s.filter((x) => /^[a-z0-9-]{1,80}$/.test(x)))].slice(0, MAX_COMPARE);
}

export default async function CompareProgrammesPage({ searchParams }: { searchParams: Promise<{ p?: string | string[] }> }) {
  const wanted = parseSlugs((await searchParams).p);
  const all = wanted.length ? (await listProgrammes())?.programmes ?? [] : [];
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const progs = wanted.map((s) => bySlug.get(s)).filter(Boolean) as Programme[];
  const without = (slug: string) => compareHref(progs.filter((p) => p.slug !== slug).map((p) => p.slug));

  return (
    <>
      <nav aria-label="Breadcrumb" className="container-x pt-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li><Link href="/" className={`inline-flex min-h-11 items-center rounded hover:text-brand-700 ${FOCUS}`}>Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/programmes" className={`inline-flex min-h-11 items-center rounded hover:text-brand-700 ${FOCUS}`}>Programmes</Link></li>
          <li aria-hidden>/</li>
          <li className="font-semibold text-ink-soft" aria-current="page">Compare</li>
        </ol>
      </nav>

      <header className="container-x mt-2">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Compare Programmes</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">See goals, who each programme suits, group size and format side by side before you create one.</p>
      </header>

      <section className="container-x mb-16 mt-8" aria-label="Programme comparison">
        {progs.length < 2 ? (
          <div className="rounded-2xl border border-line bg-white p-10 text-center" data-testid="compare-empty">
            <span aria-hidden className="text-4xl">⚖️</span>
            <p className="mt-3 text-lg font-bold text-ink">Pick two or three programmes to compare</p>
            <p className="mt-1 text-ink-soft">Tick “Compare” on the programmes you’re considering, then open the comparison.</p>
            <Link href="/programmes" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600">
              Browse programmes →
            </Link>
          </div>
        ) : (
          <>
            <CompareSync picks={progs.map((p) => ({ slug: p.slug, name: p.name }))} />
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {/* Plain <a>: sign-in gated target; the form starts at the beginning. */}
              <a href="/app/org/events/new" data-testid="compare-create"
                className={`inline-flex min-h-[52px] items-center justify-center rounded-xl bg-brand px-7 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600 ${FOCUS}`}>
                Create a Programme →
              </a>
              <a href="#enquire" data-testid="compare-request-proposal"
                className={`inline-flex min-h-[52px] items-center justify-center rounded-xl border border-brand/40 bg-white px-7 py-3 text-base font-bold text-ink transition hover:bg-brand-50 ${FOCUS}`}>
                Request a proposal
              </a>
              <CopyCompareLink />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-line bg-white" data-testid="compare-table">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 w-32 bg-white p-4"><span className="sr-only">Detail</span></th>
                    {progs.map((p) => (
                      <th key={p.slug} scope="col" className="min-w-[200px] p-4 align-top font-normal" data-testid={`compare-col-${p.slug}`}>
                        <Link href={`/programmes/${p.slug}`} className={`block rounded text-base font-black leading-snug text-ink hover:text-brand-700 ${FOCUS}`}>{p.name}</Link>
                        {progs.length > 2 && (
                          <Link href={without(p.slug)} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-muted hover:text-brand-700" data-testid={`compare-remove-${p.slug}`}>
                            Remove from comparison
                          </Link>
                        )}
                      </th>
                    ))}
                    {progs.length < MAX_COMPARE && (
                      <th scope="col" className="min-w-[160px] p-4 align-top font-normal">
                        <Link href="/programmes" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border border-dashed border-brand/50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-50" data-testid="compare-add">
                          + Add a programme
                        </Link>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.label} className="border-t border-line">
                      <th scope="row" className="sticky left-0 z-10 bg-cream p-4 align-top text-xs font-bold uppercase tracking-wider text-muted">{r.label}</th>
                      {progs.map((p) => (
                        <td key={p.slug} className="p-4 align-top text-ink-soft">{r.value(p)}</td>
                      ))}
                      {progs.length < MAX_COMPARE && <td aria-hidden />}
                    </tr>
                  ))}
                  <tr className="border-t border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-cream p-4"><span className="sr-only">Link</span></th>
                    {progs.map((p) => (
                      <td key={p.slug} className="p-4">
                        <Link href={`/programmes/${p.slug}`} className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600">
                          View programme →
                        </Link>
                      </td>
                    ))}
                    {progs.length < MAX_COMPARE && <td aria-hidden />}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <OrgEnquirySection sourcePage="/programmes/compare" />
    </>
  );
}
