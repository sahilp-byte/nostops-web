import Link from 'next/link';
import { titleCase } from '@/lib/format';
import type { TraditionExplorer } from '@/lib/server/knowledge';

// Server component. "Practise this living tradition today" — bridges a guru /
// scripture to the NOSTOPS teachers who carry the associated tradition(s) now.
// Shows ONLY public teacher listings (handle/city/verification) — no student or
// attendee data is ever surfaced (anti-poaching safe).
export default function TraditionExplorerSection({
  explorer,
  lead,
}: {
  explorer: TraditionExplorer[];
  lead: string;
}) {
  const withAny = explorer.filter((t) => t.slug);
  if (withAny.length === 0) return null;
  const anyTeachers = withAny.some((t) => t.teachers.length > 0);

  return (
    <section data-testid="tradition-explorer">
      <h2 className="text-xl font-extrabold tracking-tight">Practise this living tradition today</h2>
      <p className="mt-2 text-sm text-muted">{lead}</p>
      <div className="mt-4 space-y-4">
        {withAny.map((t) => (
          <div key={t.slug} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/yoga-parampara/${t.slug}`} className="text-base font-extrabold tracking-tight text-ink hover:text-brand-700">{t.name}</Link>
              <span className="text-xs font-semibold text-muted">
                {t.teachers.length > 0 ? `${t.teachers.length} teacher${t.teachers.length === 1 ? '' : 's'} on NOSTOPS` : 'No teachers yet'}
              </span>
            </div>
            {t.teachers.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.teachers.slice(0, 8).map((tc) => (
                  <Link
                    key={tc.handle}
                    href={`/teachers/${tc.handle}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700"
                  >
                    {tc.verified && <span aria-hidden="true" className="text-brand" title="Verified affiliation">✓</span>}
                    {tc.name}
                    {tc.city && <span className="text-xs font-normal text-muted">· {titleCase(tc.city)}</span>}
                  </Link>
                ))}
                {t.teachers.length > 8 && (
                  <Link href={`/yoga-parampara/${t.slug}`} className="inline-flex items-center rounded-full bg-cream px-3 py-1.5 text-sm font-bold text-brand-700 hover:underline">
                    +{t.teachers.length - 8} more →
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                No NOSTOPS teacher carries this tradition yet.{' '}
                <Link href="/become-a-teacher" className="font-bold text-brand-700 hover:underline">Teach in this tradition →</Link>
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {anyTeachers
          ? 'Teachers are shown with their public affiliation state. A self-declared affiliation is never presented as a verified lineage.'
          : 'As teachers join and declare these traditions, they will appear here.'}
        {' '}
        <Link href="/teachers" className="font-semibold text-brand-700 hover:underline">Browse all teachers →</Link>
      </p>
    </section>
  );
}
