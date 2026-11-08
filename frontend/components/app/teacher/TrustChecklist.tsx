import Link from 'next/link';
import type { MyTrustCase } from '@/lib/server/trust-review';

// B4.8 — the teacher's own Trust checklist: profile, identity, empanelment,
// Council review and level, each with a plain status and one next action. After a
// Council decision the teacher sees the status plus the reviewer's own note
// (owner decision) — never the reviewer's name. Presentational only; every value
// is resolved server-side from the teacher's own records.
type Tone = 'done' | 'pending' | 'action' | 'blocked' | 'unavailable';
type Row = {
  key: string;
  label: string;
  status: string;
  tone: Tone;
  detail?: string;
  note?: { text: string; by?: string | null; at?: string | null };
  action: { label: string; href: string };
};

const TONE: Record<Tone, { icon: string; pill: string }> = {
  done: { icon: '✓', pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  pending: { icon: '⏳', pill: 'bg-amber-50 text-amber-800 ring-amber-300' },
  action: { icon: '!', pill: 'bg-orange-50 text-orange-800 ring-orange-300' },
  blocked: { icon: '×', pill: 'bg-rose-50 text-rose-800 ring-rose-200' },
  unavailable: { icon: '–', pill: 'bg-slate-100 text-slate-700 ring-slate-300' },
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null;

export type TrustChecklistProps = {
  profilePercent: number;
  identityVerified: boolean;
  international: boolean;
  internationalAvailable: boolean;
  empanelled: boolean;
  levelLabel: string;
  review: MyTrustCase;
};

function profileRow(p: TrustChecklistProps): Row {
  return p.profilePercent >= 100
    ? { key: 'profile', label: 'Profile', status: 'Complete', tone: 'done', action: { label: 'View profile', href: '/app/teacher/profile' } }
    : { key: 'profile', label: 'Profile', status: `${p.profilePercent}% complete`, tone: 'action', detail: 'A complete profile helps students and organisations trust you.', action: { label: 'Finish profile', href: '/app/teacher/profile/edit' } };
}

function identityRow(p: TrustChecklistProps): Row {
  if (p.identityVerified) {
    return { key: 'identity', label: 'Identity check', status: 'Passed', tone: 'done', action: { label: 'View details', href: p.international ? '/app/teacher/get-verified' : '/app/teacher/kyc' } };
  }
  if (p.international && !p.internationalAvailable) {
    return {
      key: 'identity', label: 'Identity check', status: 'Not yet available in your country', tone: 'unavailable',
      detail: 'Identity checks for teachers outside India are not open yet. There is nothing to pay.',
      action: { label: 'Learn more', href: '/app/teacher/get-verified' },
    };
  }
  return { key: 'identity', label: 'Identity check', status: 'Not passed yet', tone: 'action', detail: 'Needed for the ✓ Verified badge.', action: { label: 'Start InstaKYC', href: '/app/teacher/kyc' } };
}

function empanelmentRow(p: TrustChecklistProps): Row {
  const s = p.review?.status;
  if (s === 'SUSPENDED' || s === 'REVOKED') {
    return {
      key: 'empanelment', label: 'Empanelment', status: s === 'SUSPENDED' ? 'Suspended after review' : 'Revoked after review', tone: 'blocked',
      detail: '"Empanelled" is not shown on your public profile right now.',
      action: { label: 'Contact support', href: '/support' },
    };
  }
  if (p.empanelled) {
    return s === 'PENDING_REVIEW'
      ? { key: 'empanelment', label: 'Empanelment', status: 'Empanelled — under Council review', tone: 'pending', action: { label: 'View empanelment', href: '/app/teacher/empanelment' } }
      : { key: 'empanelment', label: 'Empanelment', status: 'Empanelled', tone: 'done', action: { label: 'View empanelment', href: '/app/teacher/empanelment' } };
  }
  return { key: 'empanelment', label: 'Empanelment', status: 'Not empanelled yet', tone: 'action', action: { label: 'Start empanelment', href: '/app/teacher/empanelment' } };
}

function councilRow(p: TrustChecklistProps): Row {
  const r = p.review;
  const base = { key: 'council', label: 'Council review' };
  if (!r) {
    return { ...base, status: 'No review needed', tone: 'done', action: { label: 'About the Council', href: '/council' } };
  }
  const note = r.note ? { text: r.note, by: r.decided_by, at: r.decided_at } : undefined;
  switch (r.status) {
    case 'CONFIRMED':
      return { ...base, status: 'Confirmed by review', tone: 'done', note, action: { label: 'View empanelment', href: '/app/teacher/empanelment' } };
    case 'SUSPENDED':
      return { ...base, status: 'Empanelment suspended', tone: 'blocked', note, action: { label: 'Contact support', href: '/support' } };
    case 'REVOKED':
      return { ...base, status: 'Empanelment revoked', tone: 'blocked', note, action: { label: 'Contact support', href: '/support' } };
    default:
      return {
        ...base, status: 'Pending Council review', tone: 'pending',
        detail: 'A Council member will look at your empanelment record. You do not need to do anything right now.',
        action: { label: 'Ask a question', href: '/support' },
      };
  }
}

export default function TrustChecklist(p: TrustChecklistProps) {
  const rows: Row[] = [
    profileRow(p),
    identityRow(p),
    empanelmentRow(p),
    councilRow(p),
    { key: 'level', label: 'Level', status: p.levelLabel, tone: 'done', detail: 'Levels are set by the NOSTOPS Council.', action: { label: 'See progression path', href: '/app/teacher/levels' } },
  ];
  const done = rows.filter((r) => r.tone === 'done').length;

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="trust-checklist" aria-labelledby="trust-checklist-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="trust-checklist-heading" className="text-base font-extrabold tracking-tight text-ink">Your Trust checklist</h2>
        <p className="text-xs font-bold text-muted" data-testid="trust-checklist-count">{done} of {rows.length} complete</p>
      </div>
      <p className="mt-1 text-sm text-muted">What students and organisations rely on when they choose you.</p>

      <ul className="mt-4 space-y-3 p-0">
        {rows.map((r) => {
          const t = TONE[r.tone];
          return (
            <li key={r.key} className="rounded-xl border border-line p-4" data-testid={`trust-row-${r.key}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ring-1 ${t.pill}`}>{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-ink">{r.label}</p>
                    <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${t.pill}`} data-testid={`trust-row-status-${r.key}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
                <Link
                  href={r.action.href}
                  className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-white px-4 text-sm font-bold text-brand-700 transition hover:bg-brand-50 sm:w-auto"
                  data-testid={`trust-row-action-${r.key}`}
                >
                  {r.action.label} →
                </Link>
              </div>
              {r.detail && <p className="mt-2 text-xs text-muted">{r.detail}</p>}
              {r.note && (
                <figure className="mt-3 rounded-lg border-l-4 border-brand bg-cream/60 px-3 py-2" data-testid="trust-reviewer-note">
                  <figcaption className="text-[11px] font-black uppercase tracking-wider text-ink-soft">Reviewer&apos;s note</figcaption>
                  <blockquote className="mt-1 text-sm text-ink" data-testid="trust-reviewer-note-text">“{r.note.text}”</blockquote>
                  <p className="mt-1 text-[11px] text-muted">— {[r.note.by, fmtDate(r.note.at)].filter(Boolean).join(' · ')}</p>
                </figure>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
