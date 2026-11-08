import type { MinCohortInfo } from '@/lib/retreat-content';

// PROMPT 20 — Minimum Confirmed Cohort. Shows "X / Y confirmed" against the
// configured range, the booking deadline, and (for the host) the chosen
// shortfall plan. NOSTOPS never auto-cancels — the host decides.

const POLICY: Record<string, { label: string; hint: string }> = {
  continue: { label: 'Continue anyway', hint: 'The retreat runs even if the minimum isn’t met.' },
  extend: { label: 'Extend the deadline', hint: 'You’ll push the booking deadline out to gather more.' },
  reduce: { label: 'Reduce capacity', hint: 'You’ll right-size the retreat to who’s confirmed.' },
  manual: { label: 'Confirm manually', hint: 'You’ll decide case-by-case whether to run.' },
  cancel: { label: 'Cancel the retreat', hint: 'You’ll cancel and refund — done by you, never automatically.' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d?: string): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''} ${m[1]}` : '';
}
function isPast(d?: string): boolean {
  if (!d) return false;
  const t = Date.parse(d);
  return !Number.isNaN(t) && t < Date.now();
}

export default function MinimumCohort({
  confirmedCount,
  seatsTotal,
  info,
  variant = 'host',
}: {
  confirmedCount: number;
  seatsTotal: number;
  info?: MinCohortInfo;
  variant?: 'host' | 'public';
}) {
  const min = info?.min || 0;
  const max = info?.max || seatsTotal || 0;
  if (variant === 'public' && !min && confirmedCount <= 0) return null;
  if (!max) return null;

  const pct = Math.min(100, Math.round((confirmedCount / max) * 100));
  const minPct = min && max ? Math.min(100, Math.round((min / max) * 100)) : 0;
  const minMet = min ? confirmedCount >= min : true;
  const policy = POLICY[info?.policy || 'continue'] || POLICY.continue;
  const deadlinePassed = isPast(info?.deadline);

  if (variant === 'public') {
    return (
      <div className="rounded-xl border border-line bg-white p-4" data-testid="min-cohort-public">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-extrabold text-ink"><span className="text-brand-700">{confirmedCount}</span> / {max} confirmed</p>
          {min > 0 && <p className="text-xs font-semibold text-muted">{minMet ? '✓ Running' : `Runs at ${min}`}</p>}
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          {minPct > 0 && minPct < 100 && <span className="absolute top-[-2px] h-3 w-0.5 bg-ink/50" style={{ left: `${minPct}%` }} title={`Minimum ${min}`} />}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="min-cohort-card-view">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-muted">Minimum Confirmed Cohort</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${minMet ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{minMet ? (min ? 'Minimum met' : 'No minimum set') : 'Below minimum'}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-ink" data-testid="min-cohort-count"><span className="text-brand-700">{confirmedCount}</span> / {max} <span className="text-sm font-bold text-muted">confirmed</span></p>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-cream">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        {minPct > 0 && minPct < 100 && <span className="absolute top-[-3px] h-4 w-0.5 bg-ink/60" style={{ left: `${minPct}%` }} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {min > 0 && <span>Minimum <b>{min}</b></span>}
        <span>Maximum <b>{max}</b></span>
        {info?.deadline && <span>Deadline <b>{fmtDate(info.deadline)}</b>{deadlinePassed ? ' · passed' : ''}</span>}
      </div>

      <div className="mt-3 rounded-xl border border-line bg-cream/40 p-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-muted">If the minimum isn&apos;t reached</p>
        <p className="mt-0.5 text-sm font-bold text-ink">{policy.label}</p>
        <p className="text-xs text-muted">{policy.hint}</p>
        {min > 0 && !minMet && deadlinePassed && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" data-testid="min-cohort-alert">
            Deadline passed with {confirmedCount}/{min}. Nothing is automatic — act via Edit (dates/capacity) or the reservation buttons above.
          </p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">Your safeguard is confirmed participants, not a minimum price. NOSTOPS never auto-cancels.</p>
    </section>
  );
}
