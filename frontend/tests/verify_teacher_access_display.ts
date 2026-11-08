// Prompt 18 — TEACHER ACCESS DISPLAY TEST MATRIX (runnable).
//
// Exercises the "Your NOSTOPS Access" card + "Your Next Step" DISPLAY engines
// across ALL 9 verification × empanelment combinations (3 × 3). Only one live demo
// teacher exists, so this drives the SAME pure functions the components render
// (lib/teacher-access-view + lib/teacher-next-step) and asserts every output —
// giving full coverage of the 9 states no live account can reach.
//
// It feeds each constructed status through the REAL central engine
// (summarizeFeatureAccess / canAccessFeature) for the gated feature rows, so the
// card + next-step + menu + guards can never drift.
//
// Run: node tests/verify_teacher_access_display.ts   (Node 24 strips TS types natively)

import { computeNextStep } from '../lib/teacher-next-step.ts';
import {
  resolveFeatureState,
  verificationChipState,
  empanelmentChipState,
  FEATURE_STATE_LABEL,
} from '../lib/teacher-access-view.ts';
import { summarizeFeatureAccess } from '../lib/teacher-access.ts';

type V = 'verified' | 'pending' | 'not_verified';
type E = 'empanelled' | 'pending' | 'not_empanelled';

type Status = { verification: V; empanelment: E; level: 1; canOperate: boolean };

function makeStatus(v: V, e: E, canOperate?: boolean): Status {
  // Foundational operate gate default: verified AND empanelled (see lib/teacher-status).
  return { verification: v, empanelment: e, level: 1, canOperate: canOperate ?? (v === 'verified' && e === 'empanelled') };
}

type Expected = {
  next: { tone: 'action' | 'info' | 'done'; title: string; ctaHref?: string };
  verifChip: string; // FeatureState
  empChip: string;
  kycRow: string;
  empRow: string;
  offeringsRow: string;
};

type Scenario = {
  v: V; e: E; note: string; exp: Expected;
  canOperate?: boolean; // override the default gate (revoked / final-approval edges)
  kycComplete?: boolean; // override the InstaKYC identity+₹279 record
};

// The core 3 × 3 verification × empanelment matrix (kycComplete tracks verification).
const MATRIX: Scenario[] = [
  {
    v: 'not_verified', e: 'not_empanelled', note: 'Fresh teacher — nothing done',
    exp: { next: { tone: 'action', title: 'Complete Verification', ctaHref: '/app/teacher/kyc' }, verifChip: 'action', empChip: 'locked', kycRow: 'action', empRow: 'locked', offeringsRow: 'locked' },
  },
  {
    v: 'not_verified', e: 'pending', note: 'Empanelment building but not verified yet',
    exp: { next: { tone: 'action', title: 'Complete Verification', ctaHref: '/app/teacher/kyc' }, verifChip: 'action', empChip: 'pending', kycRow: 'action', empRow: 'pending', offeringsRow: 'pending' },
  },
  {
    v: 'not_verified', e: 'empanelled', note: 'INVALID combo (empanelled⇒verified); next-step still routes to verify',
    exp: { next: { tone: 'action', title: 'Complete Verification', ctaHref: '/app/teacher/kyc' }, verifChip: 'action', empChip: 'completed', kycRow: 'action', empRow: 'completed', offeringsRow: 'locked' },
  },
  {
    v: 'pending', e: 'not_empanelled', note: 'InstaKYC under review',
    exp: { next: { tone: 'info', title: 'Verification in review' }, verifChip: 'pending', empChip: 'locked', kycRow: 'pending', empRow: 'locked', offeringsRow: 'pending' },
  },
  {
    v: 'pending', e: 'pending', note: 'Both in review',
    exp: { next: { tone: 'info', title: 'Verification in review' }, verifChip: 'pending', empChip: 'pending', kycRow: 'pending', empRow: 'pending', offeringsRow: 'pending' },
  },
  {
    v: 'pending', e: 'empanelled', note: 'INVALID combo; verification review takes precedence',
    exp: { next: { tone: 'info', title: 'Verification in review' }, verifChip: 'pending', empChip: 'completed', kycRow: 'pending', empRow: 'completed', offeringsRow: 'pending' },
  },
  {
    v: 'verified', e: 'not_empanelled', note: 'Verified — empanelment now open',
    exp: { next: { tone: 'action', title: 'Complete Empanelment', ctaHref: '/app/teacher/empanelment' }, verifChip: 'completed', empChip: 'action', kycRow: 'completed', empRow: 'action', offeringsRow: 'locked' },
  },
  {
    v: 'verified', e: 'pending', note: 'Verified — empanelment under review',
    exp: { next: { tone: 'info', title: 'Empanelment under review' }, verifChip: 'completed', empChip: 'pending', kycRow: 'completed', empRow: 'pending', offeringsRow: 'pending' },
  },
  {
    v: 'verified', e: 'empanelled', note: 'Fully operational — all set',
    exp: { next: { tone: 'done', title: "You're all set" }, verifChip: 'completed', empChip: 'completed', kycRow: 'completed', empRow: 'completed', offeringsRow: 'unlocked' },
  },

  // ── Real-world edge states (authoritative verification ≠ raw InstaKYC record) ──
  {
    v: 'verified', e: 'empanelled', canOperate: false, kycComplete: false,
    note: 'EDGE (teacher.demo): admin-verified + empanelled but InstaKYC ₹279 outstanding — must NOT say "Complete Verification"',
    exp: { next: { tone: 'action', title: 'Activate your earning tools', ctaHref: '/app/teacher/kyc' }, verifChip: 'completed', empChip: 'completed', kycRow: 'action', empRow: 'completed', offeringsRow: 'locked' },
  },
  {
    v: 'verified', e: 'empanelled', canOperate: false, kycComplete: true,
    note: 'EDGE: verified + empanelled + InstaKYC done, awaiting final NOSTOPS approval',
    exp: { next: { tone: 'info', title: 'Final approval pending' }, verifChip: 'completed', empChip: 'completed', kycRow: 'completed', empRow: 'completed', offeringsRow: 'locked' },
  },
];

let failures = 0;
const rows: string[] = [];

function check(id: string, field: string, got: unknown, want: unknown) {
  if (got !== want) {
    failures++;
    console.error(`  ✗ [${id}] ${field}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
}

for (const sc of MATRIX) {
  const { v, e, note, exp } = sc;
  const id = `${v}/${e}${sc.canOperate === false ? '/edge' : ''}`;
  const status = makeStatus(v, e, sc.canOperate);
  const kycComplete = sc.kycComplete ?? v === 'verified';

  // Central engine drives the gated feature rows (same call as menu + guards).
  const ctx = { authenticated: true, role: 'teacher', onboarded: true, status: status as any, hostEligible: false };
  const summary = summarizeFeatureAccess(ctx as any);
  const viewCtx = { status: status as any, profilePercent: 100, kycVerified: kycComplete, kycPaid: kycComplete };

  const next = computeNextStep(status as any, kycComplete);
  const verifChip = verificationChipState(status as any);
  const empChip = empanelmentChipState(status as any);
  const sFor = (f: string) => summary.find((x) => x.feature === f)!;
  const kycRow = resolveFeatureState('kyc', sFor('kyc'), viewCtx).state;
  const empRow = resolveFeatureState('empanelment', sFor('empanelment'), viewCtx).state;
  const offeringsRow = resolveFeatureState('offerings', sFor('offerings'), viewCtx).state;

  check(id, 'next.tone', next.tone, exp.next.tone);
  check(id, 'next.title', next.title, exp.next.title);
  check(id, 'next.cta', next.cta?.href, exp.next.ctaHref);
  check(id, 'verifChip', verifChip, exp.verifChip);
  check(id, 'empChip', empChip, exp.empChip);
  check(id, 'kycRow', kycRow, exp.kycRow);
  check(id, 'empRow', empRow, exp.empRow);
  check(id, 'offeringsRow', offeringsRow, exp.offeringsRow);

  // Sanity: the "done" state must NOT show a CTA; action states MUST show one.
  if (next.tone === 'done' && next.cta) check(id, 'done-has-no-cta', true, false);
  if (next.tone === 'action' && !next.cta) check(id, 'action-has-cta', false, true);
  // Every rendered word maps to a known label (no colour-only states).
  for (const s of [verifChip, empChip, kycRow, empRow, offeringsRow]) {
    if (!FEATURE_STATE_LABEL[s]) check(id, 'label-exists:' + s, false, true);
  }

  rows.push(
    `[${id.padEnd(28)}] next=${next.tone.padEnd(6)} "${next.title}"  ` +
    `V:${verifChip} E:${empChip} kyc:${kycRow} emp:${empRow} operate:${offeringsRow}  — ${note}`,
  );
}

console.log('\nTEACHER ACCESS DISPLAY MATRIX — 9 core states (verification × empanelment) + real-world edges:');
for (const r of rows) console.log('  ' + r);

if (failures) {
  console.error(`\n✗ DISPLAY MATRIX FAILED — ${failures} mismatch(es).`);
  process.exit(1);
}
console.log(`\n✓ DISPLAY MATRIX PASSED — ${MATRIX.length} states, all Next-Step + Access-Card outputs match.`);
