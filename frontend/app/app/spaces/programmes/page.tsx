import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getMySpaceProgrammes, getOwnerSpaceProgrammes, problemText, refreshTeacherStatus, type SpaceProgramme } from '@/lib/server/space-programmes';
import { SpacesPageHeader } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Space Programmes', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const APPROVAL: Record<string, string> = { NOT_REQUESTED: 'Not sent to owner', PENDING: 'Awaiting owner approval', APPROVED: 'Owner approved', REJECTED: 'Owner rejected' };

function Row({ p }: { p: SpaceProgramme }) {
  return (
    <Link href={`/app/spaces/programmes/${p.event_id}`} className="sp-card block p-4 hover:border-[#F2B574]" data-testid={`sp-row-${p.event_id}`}>
      <p className="text-[18px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{p.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{p.space_snapshot?.name} · {p.programme?.taxonomy_label || p.programme?.taxonomy} · {p.event_date || 'No date yet'}</p>
      <p className="mt-1 text-xs font-bold text-muted">{p.lifecycle_effective || p.lifecycle} · {p.visibility} · {APPROVAL[p.listing_approval?.status || 'NOT_REQUESTED']}</p>
      {p.lifecycle !== 'DRAFT' && !!p.problems?.length && <p className="mt-1 text-xs font-semibold text-red-700">Not publicly available: {p.problems.map(problemText).join(' ')}</p>}
    </Link>
  );
}

export default async function SpaceProgrammesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/spaces/programmes');
  const role = normalizeRole(user.role);  // raw backend role 'guru' maps to 'council'
  const teacher = role === 'teacher' || role === 'council';
  // Keeps the teacher's authoritative status fresh for public visibility (narrow refresh; no offers).
  if (teacher) await refreshTeacherStatus();
  const [mine, owned] = await Promise.all([teacher ? getMySpaceProgrammes() : Promise.resolve({ items: [], accepted_enquiries: [] }), getOwnerSpaceProgrammes()]);
  return (
    <div className="mx-auto max-w-6xl" data-testid="sp-page">
      <div className="space-y-8">
        <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Programmes' }]} title="Space Programmes"
          subtitle="Programmes run by NOSTOPS teachers at approved Spaces. A programme needs an enquiry accepted in principle and the Space owner's approval of the listing. Neither is a booking." />
        {teacher && (
          <section className="space-y-3" data-testid="sp-accepted">
            <h2 className="text-lg font-black text-ink">Create from an accepted enquiry</h2>
            {mine.accepted_enquiries.length ? mine.accepted_enquiries.map((a) => (
              <div key={a.id} className="sp-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-bold text-ink">{a.space_name}</p><p className="text-sm text-ink-soft">{a.ref} · {a.programme_title} · {a.taxonomies.join(', ')}</p></div>
                <Link href={`/app/spaces/programmes/new?enquiry=${a.id}`} className="inline-flex min-h-[44px] items-center rounded-xl bg-accent px-4 text-sm font-black text-white" data-testid={`sp-create-${a.id}`}>Create programme</Link>
              </div>
            )) : <p className="text-sm text-ink-soft">No enquiries accepted in principle yet.</p>}
          </section>
        )}
        {teacher && (
          <section className="space-y-3" data-testid="sp-mine"><h2 className="text-lg font-black text-ink">My Space programmes</h2>
            {mine.items.length ? mine.items.map((p) => <Row key={p.event_id} p={p} />) : <p className="text-sm text-ink-soft">None yet.</p>}
          </section>
        )}
        {!!owned.length && (
          <section className="space-y-3" data-testid="sp-owned"><h2 className="text-lg font-black text-ink">{user.role === 'admin' ? 'All Space programmes' : 'Programmes proposed at my Spaces'}</h2>
            {owned.map((p) => <Row key={p.event_id} p={p} />)}
          </section>
        )}
      </div>
    </div>
  );
}
