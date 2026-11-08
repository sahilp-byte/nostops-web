// Prompts 25 & 26 — ACCESS TEST MATRIX (runnable).
//
// Drives the REAL central engine (lib/teacher-access.ts) through 8 teacher states
// (A–H) for every feature and asserts the decision matches the documented matrix
// in /app/TEACHER_ACCESS_TEST_MATRIX.md.
//
// WHY this proves all four access methods at once: the menu builder
// (buildTeacherNav), the page guard (guardTeacherFeature), the BFF/API guard
// (requireFeatureAccess) and a fresh page-refresh/session ALL call the same pure
// canAccessFeature(ctx, feature) with a context assembled SERVER-SIDE from the
// authoritative record. There is no other decision path, so a single assertion of
// canAccessFeature per (state × feature) covers every method. This test cannot
// exercise the network, so the live multi-method run is done by the testing agent
// on the demo accounts; the two together give end-to-end coverage.
//
// Run: node tests/verify_access_matrix.ts   (Node 24 strips the TS types natively)

import {
  canAccessFeature,
  featureCategory,
  summarizeFeatureAccess,
  FEATURE_RULES,
} from '../lib/teacher-access.ts';

type Status = {
  verification: 'verified' | 'pending' | 'not_verified';
  empanelment: 'empanelled' | 'pending' | 'not_empanelled';
  level: 'none' | 1 | 2 | 3;
  canOperate: boolean;
};
type State = {
  id: string;
  name: string;
  authenticated: boolean;
  onboarded: boolean;
  status: Status | null;
  hostEligible: boolean;
  // expected access by category
  expect: { open: boolean; operate: boolean; host: boolean };
};

const STATES: State[] = [
  {
    id: 'A', name: 'Signed-in, NOT onboarded (no teacher record)',
    authenticated: true, onboarded: false, status: null, hostEligible: false,
    expect: { open: false, operate: false, host: false },
  },
  {
    id: 'B', name: 'Fresh teacher — nothing done (L1)',
    authenticated: true, onboarded: true, hostEligible: false,
    status: { verification: 'not_verified', empanelment: 'not_empanelled', level: 1, canOperate: false },
    expect: { open: true, operate: false, host: false },
  },
  {
    id: 'C', name: 'KYC in progress — pending, not empanelled (L1)',
    authenticated: true, onboarded: true, hostEligible: false,
    status: { verification: 'pending', empanelment: 'not_empanelled', level: 1, canOperate: false },
    expect: { open: true, operate: false, host: false },
  },
  {
    id: 'D', name: 'Verified (KYC+₹279+admin) but NOT empanelled (L1)',
    authenticated: true, onboarded: true, hostEligible: false,
    status: { verification: 'verified', empanelment: 'not_empanelled', level: 1, canOperate: false },
    expect: { open: true, operate: false, host: false },
  },
  {
    id: 'E', name: 'Operate-eligible L1 (verified + empanelled + admin-verified)',
    authenticated: true, onboarded: true, hostEligible: false,
    status: { verification: 'verified', empanelment: 'empanelled', level: 1, canOperate: true },
    expect: { open: true, operate: true, host: false },
  },
  {
    id: 'F', name: 'Operate-eligible L2 Pracharak, host-eligible',
    authenticated: true, onboarded: true, hostEligible: true,
    status: { verification: 'verified', empanelment: 'empanelled', level: 2, canOperate: true },
    expect: { open: true, operate: true, host: true },
  },
  {
    id: 'G', name: 'L3 Guru — full access',
    authenticated: true, onboarded: true, hostEligible: true,
    status: { verification: 'verified', empanelment: 'empanelled', level: 3, canOperate: true },
    expect: { open: true, operate: true, host: true },
  },
  {
    // Owner decision (Phase B1 pre-publish): the ID check applies even to Level 3.
    id: 'I', name: 'L3 Guru WITHOUT ID check / ₹279 payment (operate locked, rest open)',
    authenticated: true, onboarded: true, hostEligible: false,
    status: { verification: 'verified', empanelment: 'empanelled', level: 3, canOperate: false },
    expect: { open: true, operate: false, host: true },
  },
  {
    id: 'H', name: 'REVOKED — admin removed verification (operate off, host stays)',
    authenticated: true, onboarded: true, hostEligible: true,
    status: { verification: 'not_verified', empanelment: 'empanelled', level: 2, canOperate: false },
    expect: { open: true, operate: false, host: true },
  },
];

const FEATURES = Object.keys(FEATURE_RULES) as (keyof typeof FEATURE_RULES)[];

function expectedFor(state: State, feature: keyof typeof FEATURE_RULES): boolean {
  if (feature === 'dashboard') return true; // always open to any signed-in teacher
  const cat = featureCategory(feature);
  if (cat === 'operate') return state.expect.operate;
  if (cat === 'host') return state.expect.host;
  return state.expect.open; // 'always' but requiresOnboarded (profile/kyc/empanelment/mentor)
}

let failures = 0;
const rows: string[] = [];

for (const s of STATES) {
  const ctx = {
    authenticated: s.authenticated,
    role: 'teacher',
    onboarded: s.onboarded,
    status: s.status as any,
    hostEligible: s.hostEligible,
  };
  const flags: string[] = [];
  for (const f of FEATURES) {
    const got = canAccessFeature(ctx as any, f).allowed;
    const want = expectedFor(s, f);
    const ok = got === want;
    if (!ok) {
      failures++;
      console.error(`  ✗ [${s.id}] ${f}: expected ${want}, got ${got}`);
    }
    flags.push(`${f}=${got ? '✓' : '·'}`);
  }
  // summary shape sanity (accessible + locked == 14)
  const summary = summarizeFeatureAccess(ctx as any);
  if (summary.length !== FEATURES.length) {
    failures++;
    console.error(`  ✗ [${s.id}] summary length ${summary.length} != ${FEATURES.length}`);
  }
  const acc = summary.filter((x) => x.allowed).length;
  rows.push(`[${s.id}] ${acc}/${FEATURES.length} accessible — ${s.name}`);
}

console.log('\nACCESS MATRIX — states A–H (accessible/total):');
for (const r of rows) console.log('  ' + r);

if (failures) {
  console.error(`\n✗ ACCESS MATRIX FAILED — ${failures} mismatch(es).`);
  process.exit(1);
}
console.log(`\n✓ ACCESS MATRIX PASSED — ${STATES.length} states × ${FEATURES.length} features, all decisions match the documented matrix.`);
