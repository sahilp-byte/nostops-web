import type { User } from '@/lib/roles';
import { normalizeRole } from '@/lib/roles';
import { getPolicyCases } from '@/lib/server/empanelment-policy';
import { FREE_PATH_SUMMARY } from '@/lib/empanelment-policy';
import EmpanelmentDecisionQueue from '@/components/app/empanelment/EmpanelmentDecisionQueue';

// Policy V2 — shared screen for /app/admin/empanelment/decisions and
// /app/council/empanelment-decisions. Each page runs its own role guard; the
// backend re-checks the role on every request.
export default async function EmpanelmentDecisionScreen({ user, eyebrow }: { user: User; eyebrow: string }) {
  const q = await getPolicyCases(user);
  const viewerRole = normalizeRole(user.role) === 'admin' ? 'admin' : 'council';
  const count = (s: string) => (q?.cases || []).filter((c) => c.status === s).length;
  const kpis = [
    { label: 'Waiting for interaction', value: count('AWAITING_COUNCIL_INTERACTION') },
    { label: 'Waiting for decision', value: count('AWAITING_DECISION') },
    { label: 'Approved · awaiting activation', value: count('APPROVED') },
    { label: 'Activated', value: count('ACTIVATED') },
    { label: 'Not approved', value: count('NOT_APPROVED') },
  ];
  return (
    <div className="mx-auto max-w-4xl pb-24" data-testid="ep-screen">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Empanelment Decisions</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Free path: {FREE_PATH_SUMMARY} Record the Council interaction first, then the final decision; a NOSTOPS admin then
        activates an approval. Nothing is approved automatically, and payment, ID checks, sessions or ratings alone never empanel anyone.
      </p>
      {!q ? (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700" role="alert">
          The decisions queue could not be loaded. Please refresh the page in a moment.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="ep-kpis">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
                <p className="text-2xl font-black tabular-nums text-ink">{k.value}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6"><EmpanelmentDecisionQueue cases={q.cases} viewerRole={viewerRole} /></div>
        </>
      )}
    </div>
  );
}
