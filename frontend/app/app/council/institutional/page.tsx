import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getCouncilProgrammeUsage, type CouncilProgrammeUsage } from '@/lib/server/institutional';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Institutional Programmes · Council', robots: { index: false, follow: false } };

const TAX_STYLE: Record<string, string> = {
  MIND: 'bg-sky-50 text-sky-700',
  BODY: 'bg-emerald-50 text-emerald-700',
  SPECIAL_NEEDS: 'bg-violet-50 text-violet-700',
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function ProgrammeRow({ p }: { p: CouncilProgrammeUsage }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4" data-testid={`council-prog-${p.programme_id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-ink">{p.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TAX_STYLE[p.taxonomy] || 'bg-cream text-ink-soft'}`}>{p.taxonomy_label}</span>
          {p.version && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-muted">{p.version}</span>}
        </div>
        <p className="mt-1 text-xs text-muted">
          {p.published_count} live · {p.draft_count} draft · {p.organisation_count} organisation{p.organisation_count === 1 ? '' : 's'} · {p.city_count} cit{p.city_count === 1 ? 'y' : 'ies'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xl font-black text-brand-700">{p.event_count}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">events</p>
      </div>
    </div>
  );
}

export default async function CouncilInstitutionalPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const role = normalizeRole(user.role);
  if (role !== 'council' && role !== 'admin') redirect('/app');

  const data = await getCouncilProgrammeUsage(user);

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/app" className="text-xs font-bold text-brand-700 hover:underline">‹ Back to overview</Link>
        <div className="mt-3">
          <h1 className="text-2xl font-black tracking-tight text-ink">Institutional Programme Adoption</h1>
          <p className="mt-1 text-sm text-ink-soft">
            How organisations are running Council-curated programmes across companies, educational institutions and startup &amp; networking groups. Aggregate adoption only — participant data is private to each organisation.
          </p>
          <Link href="/app/council/institutional/quality" className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700" data-testid="council-quality-link">
            View programme quality intelligence →
          </Link>
        </div>

        {!data ? (
          <p className="mt-6 rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">Programme adoption data is unavailable right now.</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="council-inst-stats">
              <Stat label="Programmes" value={data.programme_count} />
              <Stat label="Events running" value={data.total_events} />
              <Stat label="Live events" value={data.total_published} />
              <Stat label="Organisations" value={data.adopting_organisations} />
            </div>

            {data.by_taxonomy.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-black uppercase tracking-wider text-ink">Adoption by stream</h2>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {data.by_taxonomy.map((t) => (
                    <div key={t.taxonomy} className="rounded-2xl border border-line bg-white p-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TAX_STYLE[t.taxonomy] || 'bg-cream text-ink-soft'}`}>{t.taxonomy_label}</span>
                      <p className="mt-2 text-xl font-black text-ink">{t.event_count} <span className="text-sm font-semibold text-muted">events</span></p>
                      <p className="text-xs text-muted">{t.programme_count} programme{t.programme_count === 1 ? '' : 's'}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-sm font-black uppercase tracking-wider text-ink">Programmes <span className="text-muted">({data.programmes.length})</span></h2>
              <p className="mt-0.5 text-xs text-muted">Sorted by how widely each is being run.</p>
              <div className="mt-3 space-y-2">
                {data.programmes.length === 0
                  ? <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">No programmes published yet.</p>
                  : data.programmes.map((p) => <ProgrammeRow key={p.programme_id} p={p} />)}
              </div>
            </section>

            <p className="mt-6 rounded-xl bg-cream/60 px-4 py-3 text-center text-xs italic text-muted">{data.council_attribution}</p>
          </>
        )}
      </div>
    </div>
  );
}
