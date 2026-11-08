import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { listProgrammes } from '@/lib/server/institutional';
import { getSpaceProgramme, problemText } from '@/lib/server/space-programmes';
import SpaceProgrammeForm from '@/components/spaces/SpaceProgrammeForm';
import SpaceProgrammeActions from '@/components/spaces/SpaceProgrammeActions';
import SpaceRegistrationSettings from '@/components/spaces/SpaceRegistrationSettings';
import { SpacesPageHeader, SpNote } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Space Programme', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const APPROVAL: Record<string, string> = { NOT_REQUESTED: 'Not sent to the Space owner yet', PENDING: 'Awaiting the Space owner’s approval', APPROVED: 'Listing approved', REJECTED: 'Listing rejected' };

export default async function SpaceProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/spaces/programmes/${id}`);
  const r = await getSpaceProgramme(id);
  if (!r) notFound();
  const { programme: p, viewer, history } = r;
  const la = p.listing_approval || { status: 'NOT_REQUESTED' };
  const draft = p.lifecycle === 'DRAFT';
  const cat = viewer === 'teacher' && draft ? await listProgrammes() : null;
  const programmes = (cat?.programmes || []).filter((x) => x.taxonomy === p.programme?.taxonomy || x.programme_id === p.programme_id)
    .map((x) => ({ programme_id: x.programme_id, name: x.name, taxonomy: x.taxonomy }));
  return (
    <div className="mx-auto max-w-6xl" data-testid="sp-detail">
      <div className="space-y-5">
        <SpacesPageHeader crumbs={[{ label: 'My Programmes', href: '/app/spaces/programmes' }, { label: p.title }]} title={p.title}
          subtitle={`At ${p.space_snapshot?.name} (${p.space_snapshot?.locality}, ${p.space_snapshot?.district}) · ${p.programme?.name} · ${p.programme?.taxonomy_label}`} />
        <header className="sp-card p-4">
          <p className="text-[15px] font-semibold text-ink" data-testid="sp-status">{p.lifecycle_effective || p.lifecycle} · {p.visibility} · {APPROVAL[la.status] || la.status}
            {la.type === 'ADMIN_ON_BEHALF' ? ' (by a NOSTOPS administrator)' : ''}</p>
          {(la.note || la.reason) && <p className="mt-1 text-sm text-ink-soft">“{la.note || la.reason}”</p>}
          {p.slug && !draft && <Link href={`/events/${p.slug}`} className="mt-2 inline-block text-sm font-bold text-brand-700 underline" data-testid="sp-public-link">View public page</Link>}
        </header>
        {!!p.problems?.length && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-ink" data-testid="sp-problems">
            <p className="font-black">{draft ? 'Before this can be published:' : 'Not publicly available because:'}</p>
            <ul className="mt-1 list-disc pl-5">{p.problems.map((x) => <li key={x}>{problemText(x)}</li>)}</ul>
          </div>
        )}
        <SpNote title="Important Note">Only a participant fee can be set for this programme. NOSTOPS processes no venue rent, revenue share, commission or payouts, and the Space owner is not a payment recipient. Accepting the enquiry in principle and approving the listing are not bookings.</SpNote>
        <SpaceProgrammeActions id={p.event_id} viewer={viewer} lifecycle={p.lifecycle} approval={la.status} />
        {(viewer === 'teacher' || viewer === 'admin') && (
          <>
            <SpaceRegistrationSettings id={p.event_id} viewer={viewer} mode={p.space_pricing?.mode || 'FREE'} fee={(p.space_pricing?.fee_minor || 0) / 100}
              closed={!!p.space_registration_closed} hasRegistrations={(p.space_seats_used || 0) > 0} />
            <Link href={`/app/spaces/programmes/${p.event_id}/participants`} className="sp-btn-secondary" data-testid="sp-participants-link">
              View participants ({p.space_seats_used || 0} / {p.capacity || 0})
            </Link>
          </>
        )}
        {viewer === 'owner' && <p className="text-sm text-ink-soft" data-testid="sp-owner-count">Places taken: {p.space_seats_used || 0} / {p.capacity || 0}</p>}
        {viewer === 'teacher' && draft && programmes.length > 0 && <SpaceProgrammeForm init={{ id: p.event_id, ...p, programme_id: p.programme_id }} programmes={programmes} maxCapacity={p.space_snapshot?.capacity} />}
        <section className="rounded-2xl border border-line bg-white p-5" data-testid="sp-history">
          <h2 className="text-lg font-black text-ink">History</h2>
          <ol className="mt-2 space-y-1 text-sm text-ink-soft">{history.map((h, i) => <li key={i}><span className="font-bold text-ink">{h.action.replace(/_/g, ' ').toLowerCase()}</span> · {h.actor_role} · {new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</li>)}</ol>
        </section>
      </div>
    </div>
  );
}
