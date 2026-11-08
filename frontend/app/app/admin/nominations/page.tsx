import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getNominations } from '@/lib/server/admin-nominations';
import { adminListGuruNominations, getAppNominationArchive } from '@/lib/server/guru-nominations';
import { APP_PENDING } from '@/lib/nomination-status';
import AppNominationsQueue from '@/components/app/admin/AppNominationsQueue';
import GuruNominationCard from '@/components/app/admin/GuruNominationCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Guru Nominations', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ view?: string; status?: string }> };

const WEBSITE_FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Waiting for review' },
  { key: 'council', label: 'With the Council' },
  { key: 'approved', label: 'Approved' },
  { key: 'published', label: 'Published' },
  { key: 'closed', label: 'Closed' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

function Chip({ href, active, label, count, testId }: { href: string; active: boolean; label: string; count?: number; testId: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
    >
      {label}
      {count !== undefined && <span className={`tabular-nums ${active ? 'text-white/80' : 'text-muted'}`}>{count}</span>}
    </Link>
  );
}

export default async function AdminNominationsPage({ searchParams }: Props) {
  const user = await requireAdminUser();
  const sp = await searchParams;
  const view = sp.view === 'app' ? 'app' : 'website';

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Guru Nominations</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Living Gurus nominated to the Council of Yoga Gurus by signed-in members. The Council decides outside the
        website; record each step here. A Guru appears on the public Council page only after you record their
        acceptance, link their Council profile and publish.
      </p>

      <div className="mt-6 flex gap-2 border-b border-line" role="tablist">
        {[
          { key: 'website', label: 'Website nominations' },
          { key: 'app', label: 'From the mobile app' },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/app/admin/nominations?view=${t.key}`}
            role="tab"
            aria-selected={view === t.key}
            data-testid={`nom-tab-${t.key}`}
            className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-4 text-sm font-bold ${view === t.key ? 'border-brand text-brand-700' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {view === 'website' ? <WebsiteView user={user} status={sp.status} /> : <AppView user={user} status={sp.status} />}
    </div>
  );
}

async function WebsiteView({ user, status }: { user: Awaited<ReturnType<typeof requireAdminUser>>; status?: string }) {
  const filter = WEBSITE_FILTERS.some((f) => f.key === status) ? (status as string) : 'open';
  const data = await adminListGuruNominations(user, filter);
  if (!data) {
    return <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft" data-testid="gnom-unavailable">Nominations can&apos;t be loaded right now. Please try again shortly.</p>;
  }
  const c = data.counts;
  const kpis = [
    { label: 'Waiting for review', value: c.open || 0, tone: c.open > 0 ? 'text-accent-600' : 'text-ink' },
    { label: 'With the Council', value: c.council || 0, tone: 'text-ink' },
    { label: 'Approved, not yet public', value: c.approved || 0, tone: 'text-ink' },
    { label: 'Published', value: c.published || 0, tone: 'text-brand-700' },
  ];
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="gnom-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${k.tone}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {WEBSITE_FILTERS.map((f) => (
          <Chip key={f.key} href={`/app/admin/nominations?view=website&status=${f.key}`} active={filter === f.key} label={f.label} count={c[f.key]} testId={`gnom-filter-${f.key}`} />
        ))}
      </div>
      <div className="mt-6 space-y-4" data-testid="gnom-list">
        {data.items.length === 0 ? (
          <div data-testid="gnom-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-4xl" aria-hidden>📜</p>
            <p className="mt-3 text-lg font-black text-ink">Nothing here</p>
            <p className="mt-1 text-sm text-ink-soft">New nominations from the website&apos;s Nominate a Guru form appear under “Waiting for review”.</p>
          </div>
        ) : (
          data.items.map((n) => <GuruNominationCard key={n.id} n={n} channels={data.channels} />)
        )}
      </div>
    </>
  );
}

async function AppView({ user, status }: { user: Awaited<ReturnType<typeof requireAdminUser>>; status?: string }) {
  const [data, archive] = await Promise.all([getNominations(), getAppNominationArchive(user)]);
  const live = data.items.filter((n) => !archive[n.nominationId]);
  const statuses = [APP_PENDING, ...Array.from(new Set(live.map((n) => n.status))).filter((s) => s !== APP_PENDING).sort()];
  const filter = status === 'archived' || status === 'all' || statuses.includes(status || '') ? (status as string) : APP_PENDING;
  const items =
    filter === 'all' ? data.items : filter === 'archived' ? data.items.filter((n) => archive[n.nominationId]) : live.filter((n) => n.status === filter);
  const label = (s: string) => (s === APP_PENDING ? 'Waiting for review' : s.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()));
  return (
    <>
      <p className="mt-6 text-sm text-ink-soft">
        Nominations made in the NOSTOPS mobile app. Archive hides one from this list without deleting it.
      </p>
      {!data.ok && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">The mobile-app nominations couldn&apos;t be loaded right now.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Chip key={s} href={`/app/admin/nominations?view=app&status=${s}`} active={filter === s} label={label(s)} count={live.filter((n) => n.status === s).length} testId={`nom-filter-${s}`} />
        ))}
        <Chip href="/app/admin/nominations?view=app&status=archived" active={filter === 'archived'} label="Archived" count={data.items.length - live.length} testId="nom-filter-archived" />
        <Chip href="/app/admin/nominations?view=app&status=all" active={filter === 'all'} label="All" count={data.items.length} testId="nom-filter-all" />
      </div>
      <div className="mt-6">
        <AppNominationsQueue items={items} archive={archive} />
      </div>
    </>
  );
}
