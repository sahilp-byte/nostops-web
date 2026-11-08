import type { MyStanding, Requirement } from '@/lib/server/empanelment-policy';
import { REVIEWS_HOW_TO } from '@/lib/empanelment-policy';
import RequestCouncilInteraction from '@/components/app/teacher/RequestCouncilInteraction';

// Policy V2 — the teacher's free-path progress. Every number comes from the
// backend evaluator; this component only presents it.
const EXCLUDED: Record<string, string> = {
  sessions_not_completed: 'sessions not yet marked completed',
  payment_not_verified: 'completed sessions whose payment NOSTOPS has not confirmed (including test-card payments)',
  refunded_sessions: 'refunded sessions',
  not_one_on_one_sessions: 'sessions that were not 1:1',
  free_sessions: 'free sessions',
  sessions_with_yourself: 'sessions booked with yourself',
  duplicate_session_records: 'duplicate session records',
  reviews_without_completed_session: 'reviews from people with no completed NOSTOPS session with you',
  extra_reviews_from_same_learner: 'extra reviews from the same learner (only their latest counts)',
  reviews_by_yourself: 'reviews written by you',
  reviews_without_learner_account: 'reviews without a NOSTOPS learner account',
  reviews_not_published: 'reviews that are not published',
  reviews_without_valid_rating: 'reviews without a 1–5★ rating',
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';

function valueText(r: Requirement): string {
  if (r.key === 'avg_rating') return `${Number(r.value).toFixed(1)}★ of ${r.target}★`;
  if (r.key === 'majority_positive') return `${r.value} of ${r.of ?? 0} · more than half needed`;
  return `${r.value} of ${r.target}`;
}

function Row({ id, label, value, done }: { id: string; label: string; value: string; done: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5" data-testid={`merit-row-${id}`}>
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span aria-hidden="true" className={done ? 'text-brand' : 'text-muted'}>{done ? '✓' : '•'}</span>
        {label}
      </span>
      <span className={`text-xs font-bold ${done ? 'text-brand-700' : 'text-ink-soft'}`} data-testid={`merit-value-${id}`}>{value}</span>
    </li>
  );
}

export default function MeritProgress({ standing }: { standing: MyStanding }) {
  if (!standing) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="merit-progress">
        <h2 className="text-sm font-extrabold text-ink">Your free-path progress</h2>
        <p className="mt-2 text-sm text-muted">We could not read your sessions and reviews right now. Please refresh in a moment.</p>
      </section>
    );
  }
  const { evaluation: ev, case: c } = standing;
  const excluded = Object.entries(ev.excluded || {}).filter(([, n]) => n > 0);
  const interactionDone = !!c?.interaction_held_on && c.status !== 'AWAITING_COUNCIL_INTERACTION';
  const interaction = !c || c.status === 'NOT_APPROVED' && !c.interaction_held_on
    ? 'Not requested yet'
    : c.status === 'AWAITING_COUNCIL_INTERACTION' ? 'Requested · a Council member will contact you' : `Done · ${fmtDate(c.interaction_held_on)}`;
  const decision = !c ? 'Not yet'
    : c.status === 'ACTIVATED' ? 'Approved · Empanelled'
    : c.status === 'APPROVED' ? 'Approved · an admin activates it next'
    : c.status === 'NOT_APPROVED' ? 'Not approved this time' : 'Waiting';
  const canApply = ev.merit_met && (!c || c.status === 'NOT_APPROVED');

  return (
    <section id="merit-progress" className="rounded-2xl border border-line bg-white p-5" data-testid="merit-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">Your free-path progress</h2>
        <span className="text-[11px] font-bold text-muted">Checked {fmtDate(standing.observedAt)}</span>
      </div>
      <ul className="mt-3 space-y-2 p-0">
        {ev.requirements.map((r) => <Row key={r.key} id={r.key} label={r.label} value={valueText(r)} done={r.met} />)}
        <Row id="council" label="Council interaction" value={interaction} done={interactionDone} />
        <Row id="decision" label="Final decision by a Council guru or admin" value={decision} done={c?.status === 'APPROVED' || c?.status === 'ACTIVATED'} />
      </ul>
      {!!ev.free_sessions_counted && (
        <p className="mt-2 text-xs text-muted" data-testid="merit-free-sessions">{ev.free_sessions_counted} of your counted sessions were free sessions. Free sessions count under the current policy.</p>
      )}

      {c?.note && (
        <figure className="mt-3 rounded-lg border-l-4 border-brand bg-cream/60 px-3 py-2" data-testid="merit-decision-note">
          <figcaption className="text-[11px] font-black uppercase tracking-wider text-ink-soft">Decision note</figcaption>
          <blockquote className="mt-1 text-sm text-ink">“{c.note}”</blockquote>
          <p className="mt-1 text-[11px] text-muted">— {[c.decided_by, fmtDate(c.decided_at)].filter(Boolean).join(' · ')}</p>
        </figure>
      )}

      {canApply ? (
        <RequestCouncilInteraction />
      ) : !ev.merit_met ? (
        <p className="mt-3 text-xs text-muted">You can ask for the Council interaction once the four items above are met.</p>
      ) : null}

      {excluded.length > 0 && (
        <div className="mt-4 rounded-xl bg-cream/60 p-3" data-testid="merit-excluded">
          <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft">Not counted</p>
          <ul className="mt-1 space-y-0.5 p-0 text-xs text-ink-soft">
            {excluded.map(([k, n]) => <li key={k}>{n} × {EXCLUDED[k] || k}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted" data-testid="merit-reviews-howto">{REVIEWS_HOW_TO}</p>
    </section>
  );
}
