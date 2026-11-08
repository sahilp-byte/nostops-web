import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getCoverageLocality, getCoveragePin } from '@/lib/server/spaces-coverage';
import { isCoverageStatus } from '@/lib/coverage';
import { fmtDateTime } from '@/lib/format';
import { SpEmpty } from '@/components/spaces/ui';
import { CoverageBadge, CoverageError, CoverageHeader, Field } from '@/components/app/admin/coverage/CoverageUI';
import CoverageStatusForm from '@/components/app/admin/coverage/CoverageStatusForm';
import LocalityTeachers from '@/components/app/admin/coverage/LocalityTeachers';
import LocalityIntelligence from '@/components/app/admin/coverage/LocalityIntelligence';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Locality coverage', robots: { index: false, follow: false } };

const OFFICE: Record<string, string> = { BO: 'Branch Office', SO: 'Sub Office', HO: 'Head Office' };

// Phase 8B.2 Screen 3 — Locality Detail and Status Management (GET /api/spaces/coverage/locality/{lid}).
// Phase 8B.3 — consolidated locality intelligence: locality counts + PIN unique totals (GET /api/spaces/coverage/pin/{pin}).
export default async function LocalityDetail({ params }: { params: Promise<{ lid: string }> }) {
  await requireAdminUser();
  const { lid: raw } = await params;
  const lid = decodeURIComponent(raw).slice(0, 120);
  const pinGuess = /^[1-9][0-9]{5}-/.test(lid) ? lid.slice(0, 6) : '';
  const [r, pinFirst] = await Promise.all([getCoverageLocality(lid), pinGuess ? getCoveragePin(pinGuess) : Promise.resolve(null)]);
  const back = <Link href="/app/admin/spaces-localities/manage" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0F4C4A] hover:text-[#E8690C]" data-testid="detail-back">← Back to localities</Link>;

  if (!r.ok) {
    return (
      <div className="mx-auto max-w-5xl" data-testid="locality-detail-page">
        <CoverageHeader crumbs={[{ label: 'Manage localities', href: '/app/admin/spaces-localities/manage' }, { label: lid }]} title="Locality" />
        {r.status === 404 ? <SpEmpty title="Locality not found" testId="locality-not-found" action={back}>This identifier is not in the India Post directory and has no coverage record.</SpEmpty> : <><CoverageError message={r.error} />{back}</>}
      </div>
    );
  }
  const { reference: ref, coverage: cov, counts } = r.data;
  const name = ref?.locality || lid;
  const status = cov && isCoverageStatus(cov.status) ? cov.status : null;
  const pinR = ref ? (ref.pin === pinGuess ? pinFirst : await getCoveragePin(ref.pin)) : null;

  return (
    <div className="mx-auto max-w-5xl" data-testid="locality-detail-page">
      <CoverageHeader crumbs={[{ label: 'Manage localities', href: '/app/admin/spaces-localities/manage' }, { label: name }]} title={name}
        subtitle={ref ? `${ref.district}, ${ref.state} · PIN ${ref.pin}` : undefined}
        aside={<div className="flex items-center gap-3"><CoverageBadge status={cov?.status} testId="detail-status" />
          {cov && <Link href={`/app/admin/spaces-localities/locality/${encodeURIComponent(lid)}/history`} className="inline-flex min-h-[44px] items-center rounded-xl border border-[#F2B574] bg-white px-4 text-sm font-bold text-[#0F4C4A] hover:bg-[#FDE7CC]" data-testid="detail-history-link">Coverage history</Link>}</div>} />

      {r.data.reference_status === 'stale' && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="detail-stale">This coverage record refers to a locality that is not in the current India Post dataset.</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="sp-card p-5" data-testid="detail-reference">
            <h2 className="text-[20px]">Locality</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Locality name">{name}</Field>
              <Field label="Official locality ID"><span className="font-mono text-sm" data-testid="detail-lid">{lid}</span></Field>
              <Field label="PIN code">{ref?.pin || cov?.pin || '—'}</Field>
              <Field label="Post office type">{ref ? OFFICE[ref.office_type] || ref.office_type || '—' : '—'}</Field>
              <Field label="Taluk">{ref?.taluk || '—'}</Field>
              <Field label="District">{ref?.district || '—'}</Field>
              <Field label="State / UT">{ref?.state || '—'}</Field>
              <Field label="Coverage status"><CoverageBadge status={cov?.status} /></Field>
            </dl>
          </section>

          <section className="sp-card p-5" data-testid="detail-record">
            <h2 className="text-[20px]">Coverage record</h2>
            {!cov ? <p className="mt-2 text-sm text-[#3B4762]" data-testid="detail-no-record">No record yet — onboarding has not started in this locality.</p> : (
              <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Counts as covered">{cov.covered ? 'Yes (Active)' : 'No'}</Field>
                <Field label="Record version">{cov.version}</Field>
                <Field label="Last changed">{fmtDateTime(cov.updated_at)}{cov.updated_by ? ` · ${cov.updated_by.by_name}` : ''}</Field>
                <Field label="Created">{fmtDateTime(cov.created_at)}{cov.created_by ? ` · ${cov.created_by.by_name}` : ''}</Field>
              </dl>
            )}
            {!!cov?.notes.length && (
              <div className="mt-4" data-testid="detail-notes">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6E6A63]">Notes</p>
                <ul className="mt-1 space-y-2">{cov.notes.map((n) => <li key={n.id} className="rounded-lg bg-[#FCF4E6] p-2 text-sm"><span className="whitespace-pre-wrap">{n.text}</span><span className="mt-0.5 block text-xs text-[#6E6A63]">{n.by_name} · {fmtDateTime(n.at)}</span></li>)}</ul>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {ref ? <CoverageStatusForm lid={lid} pin={ref.pin} current={status} version={cov?.version ?? null} locality={name} />
            : <p className="sp-card p-5 text-sm text-[#3B4762]">Status changes are unavailable because this locality is not in the current India Post dataset.</p>}
          {ref && <LocalityTeachers lid={lid} />}
        </div>
      </div>
      {counts && ref && (
        <div className="mt-4">
          <LocalityIntelligence locality={name} pin={ref.pin} counts={counts} pinCounts={pinR?.ok ? pinR.data.pin_unique_counts : null}
            pinError={pinR && !pinR.ok ? pinR.error : ''} pinLocalities={pinR?.ok ? pinR.data.localities.length : 0} />
        </div>
      )}
      <div className="mt-4">{back}</div>
    </div>
  );
}
