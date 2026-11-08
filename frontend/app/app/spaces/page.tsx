import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMySpaces } from '@/lib/server/spaces';
import { SPACE_MODELS, SPACE_STATUS, SPACE_TYPES } from '@/lib/spaces';
import { fmtDate } from '@/lib/format';
import { SpacesPageHeader, SpEmpty, SpIcon, SpStat } from '@/components/spaces/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Spaces', robots: { index: false, follow: false } };

// S4 — Space Owner dashboard (Phase 3). Any signed-in NOSTOPS account can list a Space (owner decision).
export default async function MySpacesPage() {
  if (!(await getSessionUser())) redirect('/login?next=/app/spaces');
  const spaces = await getMySpaces();
  return (
    <div className="mx-auto max-w-6xl" data-testid="my-spaces-page">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Spaces' }]} title="Venue Owner Dashboard"
        subtitle="List a hall, studio or community space in your neighbourhood so NOSTOPS teachers can run yoga programmes there."
        aside={<div className="flex flex-wrap gap-2"><Link href="/app/venue" className="sp-btn-secondary" data-testid="my-spaces-to-venues">Global Venues →</Link><Link href="/app/spaces/new" className="sp-btn-primary bg-brand" data-testid="list-space-btn">+ List a Space</Link></div>} />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="my-spaces-stats">
        <SpStat icon="building" value={spaces.length} label="My Spaces" />
        <SpStat icon="check" tone="green" value={spaces.filter((s) => s.status === 'approved').length} label="Approved · Live" />
        <SpStat icon="clock" value={spaces.filter((s) => s.status === 'submitted').length} label="Under Review" />
        <SpStat icon="doc" tone="lavender" value={spaces.filter((s) => s.status === 'draft' || s.status === 'changes_requested').length} label="Drafts & Changes" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[15px]">
        <Link href="/app/spaces/incoming" className="sp-btn-secondary !min-h-[44px] !text-[15px]"><SpIcon name="mail" className="h-5 w-5" />Enquiries & Programme Requests</Link>
      </div>

      {spaces.length === 0 ? (
        <div className="mt-6"><SpEmpty title="You haven't listed a Space yet" testId="my-spaces-empty">It takes about 10 minutes. Keep your PIN code, a few photos and the 4 documents ready.</SpEmpty></div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3" data-testid="my-spaces-list">
          {spaces.map((s) => {
            const st = SPACE_STATUS[s.status] || SPACE_STATUS.draft;
            return (
              <li key={s.id}>
                <Link href={`/app/spaces/${s.id}`} className="sp-card flex gap-4 p-4 hover:border-[#F2B574]" data-testid="my-space-card">
                  {s.photos?.[0] ? (
                    <img src={s.photos[0]} alt="" className="h-24 w-32 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-24 w-32 shrink-0 place-items-center rounded-xl bg-[#FCF4E6] text-[#F28A1E]"><SpIcon name="building" className="h-10 w-10" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 max-w-full truncate text-[19px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{s.name || 'Untitled Space'}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.tone}`} data-testid="my-space-status">{st.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {[s.location ? `${s.location.locality}, ${s.location.district} ${s.location.pin}` : '', SPACE_TYPES[s.space_type || ''], SPACE_MODELS[s.model || '']?.label].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {s.status === 'draft' && s.missing?.length ? `${s.missing.length} item(s) left before you can submit · ` : ''}
                      Updated {fmtDate(s.updated_at)}
                    </p>
                    {s.decision_note && (s.status === 'changes_requested' || s.status === 'rejected') && (
                      <p className="mt-1 text-xs font-semibold text-orange-800">Note from NOSTOPS: {s.decision_note}</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
