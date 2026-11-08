import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import { getMySpace } from '@/lib/server/spaces';
import { SPACE_MODELS, SPACE_STATUS, SPACE_TYPES } from '@/lib/spaces';
import { fmtDateTime } from '@/lib/format';
import SpaceWizard from '@/components/spaces/SpaceWizard';
import { SpacesPageHeader } from '@/components/spaces/ui';
import { DuplicateWarning, WithdrawDraftButton } from '@/components/spaces/SpaceDraftTools';
import ShareCardPreview from '@/components/app/ShareCardPreview';
import OwnerShareKit from '@/components/spaces/OwnerShareKit';
import { canonical } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Space', robots: { index: false, follow: false } };

const EDITABLE = new Set(['draft', 'changes_requested', 'rejected']);
const ACTION_LABEL: Record<string, string> = {
  created: 'Draft created', submitted: 'Submitted for review', approved: 'Approved', rejected: 'Not approved',
  changes_requested: 'Changes requested', site_visit_recorded: 'Site visit recorded', unlisted: 'Unlisted from public search', withdrawn: 'Draft withdrawn by you',
};

export default async function MySpacePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/spaces/${id}`);
  const space = await getMySpace(id);
  if (!space) notFound();
  const st = SPACE_STATUS[space.status] || SPACE_STATUS.draft;

  return (
    <div className="mx-auto max-w-6xl" data-testid="my-space-page">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Spaces', href: '/app/spaces' }, { label: space.name || 'Untitled Space' }]}
        title={space.name || 'Untitled Space'} subtitle={<span className="font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>Venue Owner Onboarding</span>}
        eyebrow={<span className={`rounded-full px-3 py-1 text-[14px] font-semibold ${st.tone}`} data-testid="space-status">{st.label}</span>} />

      {space.decision_note && space.status !== 'approved' && (
        <p className="mt-3 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900" data-testid="space-decision-note">
          <strong>Note from NOSTOPS:</strong> {space.decision_note}
        </p>
      )}

      {EDITABLE.has(space.status) ? (
        <>
          <DuplicateWarning id={space.id} />
          <div className="mt-5"><SpaceWizard initial={space} ownerName={displayName(user)} /></div>
          {space.status === 'draft' && !space.submitted_at && <WithdrawDraftButton id={space.id} />}
        </>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="sp-card p-5" data-testid="space-locked">
            <p className="text-sm text-ink-soft">
              {space.status === 'approved'
                ? 'Your Space is approved and listed on NOSTOPS Spaces. To change its details, contact NOSTOPS support.'
                : space.status === 'unlisted'
                  ? 'NOSTOPS has unlisted this Space, so it is hidden from public search. Nothing has been deleted. Contact NOSTOPS support if you have questions.'
                  : space.status === 'withdrawn'
                    ? 'You withdrew this draft. It is kept in your history but can no longer be edited or submitted.'
                    : 'Your Space is with NOSTOPS for review. You can’t edit it until there is a decision. We’ll email you.'}
            </p>
            {space.status === 'approved' && (
              <>
                <Link href={`/spaces/${space.id}`} className="sp-btn-secondary mt-3" data-testid="view-public-space">View public page</Link>
                <ShareCardPreview imagePath={`/share-card/space/${space.id}`} label="Space" className="mt-4 border-t border-line pt-4" />
                <OwnerShareKit id={space.id} url={canonical(`/spaces/${encodeURIComponent(space.id)}`)} name={space.name || 'Our space'}
                  locality={[space.location?.locality, space.location?.district].filter(Boolean).join(', ')} model={SPACE_MODELS[space.model || '']?.label || ''} />
              </>
            )}
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {[
                ['Type', SPACE_TYPES[space.space_type || '']], ['Model', SPACE_MODELS[space.model || '']?.label],
                ['Capacity', space.capacity ? `${space.capacity} people` : ''],
                ['Locality', space.location ? `${space.location.locality}, ${space.location.district}, ${space.location.state} ${space.location.pin}` : ''],
                ['Documents', `${space.documents?.length || 0} of 4 uploaded`], ['Photos', String(space.photos?.length || 0)],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-muted">{k}</dt><dd className="font-bold text-ink">{v || '—'}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      )}

      <section className="sp-card mt-6 p-5" data-testid="space-history">
        <h2 className="text-[22px]">History</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {(space.history || []).slice().reverse().map((h, i) => (
            <li key={i} className="text-ink-soft"><span className="font-bold text-ink">{ACTION_LABEL[h.action] || h.action}</span> · {fmtDateTime(h.at)}{h.note ? ` · “${h.note}”` : ''}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
