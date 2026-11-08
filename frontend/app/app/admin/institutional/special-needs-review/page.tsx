import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSpecialNeedsReview, type SpecialNeedsReviewRow } from '@/lib/server/institutional';
import { getAdminTeacherDirectory } from '@/lib/server/admin-teachers';
import { isPublicHandleBlocked } from '@/lib/public-teacher';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Special Needs review · Admin', robots: { index: false, follow: false } };

const STATUS: Record<SpecialNeedsReviewRow['verification_status'], { label: string; cls: string }> = {
  NOT_REVIEWED: { label: 'Not reviewed', cls: 'bg-amber-50 text-amber-700' },
  REVOKED: { label: 'Reviewed · revoked', cls: 'bg-rose-50 text-rose-700' },
  FLAG_WITHOUT_REVIEW_RECORD: { label: 'Flag set · no review record', cls: 'bg-rose-50 text-rose-700' },
};
const PATHWAY: Record<string, string> = { MIND: 'Mind', BODY: 'Body', SPECIAL_NEEDS: 'Special Needs' };

// READ-ONLY report: teachers who declared the Special Needs pathway but have no
// reviewed adaptive-practice verification record. Nothing on this page changes a
// profile, assigns a qualification or contacts a teacher.
export default async function SpecialNeedsReviewPage() {
  const user = await requireAdminUser();
  const [report, directory] = await Promise.all([getSpecialNeedsReview(user), getAdminTeacherDirectory()]);
  const reviewIdByHandle = new Map(directory.rows.filter((r) => r.handle).map((r) => [String(r.handle).toLowerCase(), r.teacherId]));
  const rows = report?.teachers ?? [];

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/app/admin/institutional" className="text-xs font-bold text-brand-700 hover:underline">‹ Institutional Engine</Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Special Needs · teachers awaiting review</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Teachers who selected the Special Needs pathway but have no reviewed adaptive-practice verification. Selecting
          the pathway is a declaration, not proof. This list is read-only: it changes no profile and contacts no one.
        </p>

        {report === null ? (
          <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" data-testid="sn-review-error">
            The report could not be loaded. Please refresh in a moment.
          </p>
        ) : (
          <>
            <p className="mt-5 text-sm font-bold text-ink" data-testid="sn-review-count">
              {rows.length} teacher{rows.length === 1 ? '' : 's'} awaiting review
              {report.generated_at && <span className="ml-2 text-xs font-semibold text-muted">· generated {report.generated_at.replace('T', ' ').replace('Z', ' UTC')}</span>}
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white" data-testid="sn-review-list">
              {rows.length === 0 && (
                <p className="p-6 text-center text-sm text-muted">No teacher has declared Special Needs without a reviewed verification.</p>
              )}
              {rows.map((t, i) => {
                const reviewId = t.handle ? reviewIdByHandle.get(t.handle.toLowerCase()) : undefined;
                const demo = t.is_demo_seeded || isPublicHandleBlocked(t.handle) || /^qa[_-]/i.test(t.teacher_id);
                const st = STATUS[t.verification_status] ?? STATUS.NOT_REVIEWED;
                return (
                  <div key={t.teacher_id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${i > 0 ? 'border-t border-line' : ''}`} data-testid={`sn-review-row-${t.teacher_id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {t.name || 'Unnamed teacher'}
                        {demo && <span className="ml-1.5 rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">demo / test account</span>}
                      </p>
                      <p className="break-all text-[11px] text-muted">
                        ID {t.teacher_id}{t.handle ? ` · @${t.handle}` : ''} · {t.city || 'No city'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">Declared: {t.declared_pathways.map((p) => PATHWAY[p] || p).join(', ')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`} data-testid={`sn-review-status-${t.teacher_id}`}>{st.label}</span>
                      {reviewId ? (
                        <Link href={`/app/admin/teachers/${encodeURIComponent(reviewId)}`} data-testid={`sn-review-link-${t.teacher_id}`}
                          className="inline-flex min-h-[44px] items-center rounded-lg border border-line bg-white px-3 text-xs font-bold text-brand-700 hover:bg-cream">
                          Open profile review →
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted" data-testid={`sn-review-nolink-${t.teacher_id}`}>No profile review record</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              To record a reviewed verification, use the Special Needs control on the Institutional Engine page after the review is complete.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
