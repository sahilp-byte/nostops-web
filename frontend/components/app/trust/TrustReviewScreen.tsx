import type { User } from '@/lib/roles';
import { getTrustQueue, type TrustCase } from '@/lib/server/trust-review';
import TrustReviewQueue from '@/components/app/trust/TrustReviewQueue';

// B4.8 — shared screen for /app/admin/trust-review and /app/council/trust-review.
// Each page runs its own role guard first; the backend re-checks the role.
const ORDER: Record<TrustCase['status'], number> = { PENDING_REVIEW: 0, SUSPENDED: 1, REVOKED: 2, CONFIRMED: 3 };

export default async function TrustReviewScreen({ user, eyebrow }: { user: User; eyebrow: string }) {
  const q = await getTrustQueue(user);
  const cases = q ? [...q.cases].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)) : [];
  const kpis = q
    ? [
        { label: 'Waiting for review', value: q.pendingCount, tone: q.pendingCount > 0 ? 'text-accent-600' : 'text-ink' },
        { label: 'Decided', value: q.cases.length - q.pendingCount, tone: 'text-brand-700' },
        { label: 'All cases', value: q.cases.length, tone: 'text-ink' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl pb-24" data-testid="trust-review-screen">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Trust Review</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        These teachers are listed as empanelled, but their identity check has not passed. Review each one yourself and
        record a decision with a note. Nothing is decided automatically. The teacher sees the status and your note, but not
        your name.
      </p>

      {!q ? (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700" role="alert">
          The review queue could not be loaded. Please refresh the page in a moment.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3" data-testid="trust-review-kpis">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
                <p className={`text-2xl font-black tabular-nums ${k.tone}`}>{k.value}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
              </div>
            ))}
          </div>
          {q.note && <p className="mt-3 text-xs text-muted">{q.note}</p>}
          <div className="mt-6">
            <TrustReviewQueue cases={cases} />
          </div>
        </>
      )}
    </div>
  );
}
