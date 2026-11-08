import Link from 'next/link';
import type { TeacherStatus } from '@/lib/teacher-status';
import type { TeacherFeature, FeatureAccessSummary } from '@/lib/teacher-access';
import {
  resolveFeatureState,
  verificationChipState,
  empanelmentChipState,
  FEATURE_STATE_LABEL,
  type FeatureState,
} from '@/lib/teacher-access-view';
import { TEACHER_LEVELS, LEVELS_ORDERED, type TeacherLevel } from '@/lib/teacher-levels';

// "Your NOSTOPS Access" — the teacher-facing progression + entitlement visual
// (Prompts 2-4). Read-only; every value comes from the AUTHORITATIVE account
// state (deriveTeacherStatus + the central canAccessFeature engine via the
// summary prop) resolved by the pure lib/teacher-access-view engine. This file is
// presentation-only (colours/icons); no permission logic and no demo data.
// Accessibility: each state carries a text label (state is never colour-only),
// decorative glyphs are aria-hidden, and every pill meets WCAG AA contrast.

// Presentation for each display state. The label comes from the shared engine
// (FEATURE_STATE_LABEL) so the words on screen match what the tests assert.
const STATE_META: Record<FeatureState, { icon: string; pill: string; dot: string }> = {
  unlocked: { icon: '✓', pill: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  completed: { icon: '✓', pill: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  pending: { icon: '⏳', pill: 'bg-amber-50 text-amber-800 ring-1 ring-amber-300', dot: 'bg-amber-500' },
  action: { icon: '⚠', pill: 'bg-orange-50 text-orange-800 ring-1 ring-orange-300', dot: 'bg-orange-500' },
  locked: { icon: '🔒', pill: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300', dot: 'bg-slate-400' },
};

// Teacher route for the "next action" deep-link, where one applies.
const FEATURE_HREF: Partial<Record<TeacherFeature, string>> = {
  profile: '/app/teacher/profile',
  kyc: '/app/teacher/kyc',
  empanelment: '/app/teacher/empanelment',
};

const GROUPS: { key: 'always' | 'operate' | 'host'; title: string; caption: string }[] = [
  { key: 'always', title: 'Foundation', caption: 'Open to every registered teacher' },
  { key: 'operate', title: 'Teaching & earning', caption: 'Unlocks with verification + empanelment' },
  { key: 'host', title: 'Hosting', caption: 'Unlocks at Level 2+' },
];

function JourneyChip({ label, value, state }: { label: string; value: string; state: FeatureState }) {
  const m = STATE_META[state];
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2"
      aria-label={`${label}: ${value}`}
    >
      <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${m.pill}`}>{m.icon}</span>
      <span className="min-w-0" aria-hidden="true">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <span className="block truncate text-sm font-extrabold text-ink">{value}</span>
      </span>
    </div>
  );
}

export default function TeacherAccessCard({
  status,
  level,
  profilePercent,
  kycVerified,
  kycPaid,
  international = false,
  withdrawn = false,
  summary,
}: {
  status: TeacherStatus;
  level: TeacherLevel;
  profilePercent: number;
  kycVerified: boolean;
  kycPaid: boolean;
  international?: boolean;
  withdrawn?: boolean;
  summary: FeatureAccessSummary[];
}) {
  const ctx = { status, profilePercent, kycVerified, kycPaid, international, withdrawn };
  const items = summary.map((s) => ({ ...s, ...resolveFeatureState(s.feature, s, ctx) }));
  const unlockedCount = items.filter((i) => i.state === 'unlocked' || i.state === 'completed').length;

  const currentMeta = TEACHER_LEVELS[level];
  const verifChip = verificationChipState(status);
  const empChip = empanelmentChipState(status, withdrawn);

  return (
    <section className="rounded-2xl border border-line bg-cream/40 p-5 sm:p-6" data-testid="teacher-access-card" aria-labelledby="nostops-access-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="nostops-access-heading" className="text-base font-extrabold tracking-tight text-ink">Your NOSTOPS Access</h2>
        {status.canOperate && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">Earning tools active</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Your journey: Level → Verification → Empanelment → Features. Set by NOSTOPS from your verified records.</p>

      {/* Journey strip */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch" data-testid="access-journey">
        <JourneyChip label="Level" value={`L${currentMeta.level} · ${currentMeta.badgeLabel}`} state="completed" />
        <span aria-hidden="true" className="hidden items-center text-muted sm:flex">›</span>
        <JourneyChip label="Verification" value={FEATURE_STATE_LABEL[verifChip]} state={verifChip} />
        <span aria-hidden="true" className="hidden items-center text-muted sm:flex">›</span>
        <JourneyChip label="Empanelment" value={FEATURE_STATE_LABEL[empChip]} state={empChip} />
        <span aria-hidden="true" className="hidden items-center text-muted sm:flex">›</span>
        <JourneyChip label="Features" value={`${unlockedCount} of ${items.length} unlocked`} state={unlockedCount > 0 ? 'unlocked' : 'locked'} />
      </div>

      {/* L1 / L2 / L3 progression */}
      <div className="mt-5" data-testid="access-levels">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {LEVELS_ORDERED.map((lvl) => {
            const isCurrent = lvl.level === level;
            const isEarned = lvl.level < level;
            const isLocked = lvl.level > level;
            const stateWord = isCurrent ? 'Current' : isEarned ? 'Earned' : 'Locked';
            return (
              <div
                key={lvl.level}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'rounded-xl border p-3 text-center transition',
                  isCurrent ? 'border-brand bg-white shadow-sm ring-2 ring-brand/30' : 'border-line bg-white',
                ].join(' ')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span aria-hidden="true" className="text-sm">{isLocked ? '🔒' : '✓'}</span>
                  <span className={`text-sm font-black ${isCurrent ? 'text-brand-700' : isEarned ? 'text-emerald-700' : 'text-slate-500'}`}>
                    L{lvl.level}
                  </span>
                </div>
                <p className={`mt-1 truncate text-xs font-bold ${isLocked ? 'text-slate-500' : 'text-ink'}`}>{lvl.badgeLabel}</p>
                {isCurrent ? (
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-brand-700">{stateWord}</p>
                ) : (
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{stateWord}</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Levels are assigned by the NOSTOPS Council — advancement isn&apos;t automatic.</p>
      </div>

      {/* Feature access matrix */}
      <div className="mt-5 space-y-4" data-testid="access-matrix">
        {GROUPS.map((g) => {
          const rows = items.filter((i) => i.category === g.key);
          if (rows.length === 0) return null;
          return (
            <div key={g.key} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-ink">{g.title}</p>
                <p className="text-[11px] text-muted">{g.caption}</p>
              </div>
              <ul className="mt-3 space-y-2 p-0">
                {rows.map((r) => {
                  const m = STATE_META[r.state];
                  const href = FEATURE_HREF[r.feature];
                  return (
                    <li key={r.feature} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 pt-2 first:border-t-0 first:pt-0">
                      <span className="min-w-[8rem] flex-1 text-sm font-semibold text-ink">{r.label}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.pill}`}>
                        <span aria-hidden="true">{m.icon}</span>
                        {FEATURE_STATE_LABEL[r.state]}
                      </span>
                      {(r.reason || r.nextAction) && (
                        <span className="w-full text-xs text-muted sm:w-auto sm:flex-1">
                          {r.reason}
                          {r.nextAction && (
                            <>
                              {r.reason ? ' · ' : ''}
                              {href ? (
                                <Link href={href} className="font-semibold text-brand-700 hover:underline">{r.nextAction} →</Link>
                              ) : (
                                <span className="font-semibold text-ink-soft">{r.nextAction}</span>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
