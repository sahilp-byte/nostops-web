// Teacher rating journey — pure resolution rules (lib/server/bookings.ts).
// Run: node tests/verify_rating_journey.ts
// No network: only resolveProfileHandle / toReviewable are exercised, with an
// index shaped exactly like getInAppTeacherIndex() builds from the directory.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);

const { resolveProfileHandle, toReviewable } = await import('../lib/server/bookings.ts');

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` -> ${JSON.stringify(detail)}`}`);
}

// Live-shaped data (2026-06): handle "anjali-teacher-m" was renamed; teacher_id
// tn_9b0aa00b35c5 is now listed as "yoga-shikshak-demo".
const idx = {
  handles: new Set(['yoga-shikshak-demo', 'sarika-kakade-p', 'arjun-raghavan']),
  byId: new Map([
    ['tn_9b0aa00b35c5', 'yoga-shikshak-demo'],
    ['tn_14a2ff1764fe', 'sarika-kakade-p'],
    ['yoga_kyc_5d62a8cf01', 'arjun-raghavan'],
  ]),
};

// 1. Valid rating links
check('valid handle + matching id keeps the handle',
  resolveProfileHandle({ teacherHandle: 'sarika-kakade-p', teacherId: 'tn_14a2ff1764fe' }, idx) === 'sarika-kakade-p');
check('stale handle resolves to the CURRENT handle of the same teacher_id',
  resolveProfileHandle({ teacherHandle: 'anjali-teacher-m', teacherId: 'tn_9b0aa00b35c5' }, idx) === 'yoga-shikshak-demo');
check('handle-only booking with a listed handle still links',
  resolveProfileHandle({ teacherHandle: 'arjun-raghavan' }, idx) === 'arjun-raghavan');

// 2. Missing / unreliable teacher references -> no destination (never guessed)
check('unknown teacher_id -> null (teacher no longer listed)',
  resolveProfileHandle({ teacherHandle: 'anjali-teacher-m', teacherId: 'tn_gone' }, idx) === null);
check('id wins: a listed handle on a booking whose teacher_id is unknown is NOT used (no rating sent to another teacher)',
  resolveProfileHandle({ teacherHandle: 'sarika-kakade-p', teacherId: 'tn_someone_else' }, idx) === null);
check('handle-only booking with an unlisted handle -> null',
  resolveProfileHandle({ teacherHandle: 'anjali-teacher-m' }, idx) === null);
check('no reference at all -> null', resolveProfileHandle({}, idx) === null);
check('empty index (directory down) -> null, fails closed',
  resolveProfileHandle({ teacherHandle: 'sarika-kakade-p', teacherId: 'tn_14a2ff1764fe' }, { handles: new Set(), byId: new Map() }) === null);

// 3. Historical bookings preserved — toReviewable never drops or rewrites a booking record
const b = (id: string, status: string, extra: Record<string, unknown>) => ({
  id, teacherName: 'T', status, slotTs: 1, currency: 'INR', profileHandle: null, ...extra,
});
const past = [
  b('oob_1', 'completed', { teacherHandle: 'anjali-teacher-m', teacherId: 'tn_9b0aa00b35c5', profileHandle: 'yoga-shikshak-demo' }),
  b('oob_2', 'completed', { teacherHandle: 'anjali-teacher-m', teacherId: 'tn_gone', profileHandle: null }),
  b('oob_3', 'cancelled', { teacherHandle: 'sarika-kakade-p', teacherId: 'tn_14a2ff1764fe', profileHandle: 'sarika-kakade-p' }),
  b('oob_4', 'completed', {}),
];
const snapshot = JSON.stringify(past);
const rv = toReviewable(past as any);
check('completed sessions with a teacher reference are offered (rateable or unavailable)',
  JSON.stringify(rv.map((r: any) => [r.id, r.profileHandle])) === JSON.stringify([['oob_1', 'yoga-shikshak-demo'], ['oob_2', null]]), rv);
check('cancelled + reference-less sessions are not offered', !rv.some((r: any) => r.id === 'oob_3' || r.id === 'oob_4'));
check('input bookings are not mutated or dropped', JSON.stringify(past) === snapshot && past.length === 4);

console.log(failed ? `\n${failed} FAILED` : '\nall rating-journey checks pass');
process.exit(failed ? 1 : 0);
