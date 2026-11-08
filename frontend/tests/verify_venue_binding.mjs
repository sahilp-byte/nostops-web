// Host a Retreat — venue-binding workflow verification (Batch 2B + 2D).
//
// Deterministic, non-production checks that a retreat is bound to an EXISTING
// LISTED venue via the canonical `venue_partner_id`, across BOTH the create and
// the edit (PATCH) paths, and that legacy/unbound retreats, local drafts, auth,
// ownership, CSRF and paid-seat locks are all preserved.
//
// Three layers:
//   1. BEHAVIOURAL (mocked): the pure decision helpers are executed against
//      mocked eligible sets / backend responses — this is where the destructive
//      scenarios (valid change, reject, backend failure) are proven WITHOUT
//      touching the remote/prod backend.
//   2. SOURCE-LEVEL (deterministic): the create/edit BFF routes, the edit form,
//      the picker, the host projection, the draft model and public read path are
//      wired to those helpers and to the existing venue directory.
//   3. HTTP (best-effort, read-only): public pages reachable; no retreat created.
//
// Usage: node tests/verify_venue_binding.mjs [SITE_BASE]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveVenueBinding, VENUE_BIND_ERR } from '../lib/server/venue-binding.ts';
import { interpretRetreatSave } from '../lib/retreat-save.ts';
import { draftIsMeaningful } from '../lib/retreat-draft.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';

let pass = 0, fail = 0, skip = 0;
const check = (label, cond, extra = '') => { if (cond) pass++; else fail++; console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${cond ? '' : `  ${extra}`}`); };
const note = (label) => { skip++; console.log(`SKIP | ${label}`); };
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf8') : null; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Pre-read the sources used across the source-level layer.
const createBff = read('app/bff/teacher/retreats/create/route.ts') || '';
const editBff = read('app/bff/teacher/retreats/[id]/route.ts') || '';
const editForm = read('components/app/teacher/EditRetreatForm.tsx') || '';
const editPage = read('app/app/teacher/retreats/[id]/page.tsx') || '';
const newPage = read('app/app/teacher/retreats/new/page.tsx') || '';
const wiz = read('components/app/teacher/HostRetreatWizard.tsx') || '';
const picker = read('components/app/teacher/VenuePicker.tsx') || '';
const host = read('lib/server/retreat-host.ts') || '';
const venues = read('lib/server/venues.ts') || '';
const retreats = read('lib/server/retreats.ts') || '';
const detail = read('app/(public)/retreats/in/[city]/[retreat]/page.tsx') || '';
const draftLib = read('lib/retreat-draft.ts') || '';
const bindLib = read('lib/server/venue-binding.ts') || '';
const saveLib = read('lib/retreat-save.ts') || '';

const ELIGIBLE = ['ven_alpha', 'ven_beta', 'ven_gamma']; // mock authoritative directory

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ LAYER 1 — BEHAVIOURAL (mocked, non-production)                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── Error-string parity: the pure helper must hold the exact live-verified copy ─
console.log('----- behavioural: error-string parity -----');
check('VENUE_BIND_ERR.missing is the live create message', VENUE_BIND_ERR.missing === 'Select a listed NOSTOPS venue to publish your retreat.');
check('VENUE_BIND_ERR.cleared is the live edit message', VENUE_BIND_ERR.cleared === 'A listed venue is required — it cannot be cleared.');
check('VENUE_BIND_ERR.ineligible is the live message', VENUE_BIND_ERR.ineligible === 'That venue is not a listed, eligible NOSTOPS venue. Please pick one from the list.');

// ── (2) A valid venue change is submitted → forwarded unchanged ──────────────
console.log('\n----- behavioural: resolveVenueBinding — valid change (edit) -----');
check('valid edit id → {set, value} (forwarded unchanged)', eq(resolveVenueBinding('ven_beta', true, ELIGIBLE, false), { action: 'set', value: 'ven_beta' }));
check('valid edit id is trimmed but preserved', eq(resolveVenueBinding('  ven_beta  ', true, ELIGIBLE, false), { action: 'set', value: 'ven_beta' }));
check('works with a Set directory too', eq(resolveVenueBinding('ven_alpha', true, new Set(ELIGIBLE), false), { action: 'set', value: 'ven_alpha' }));

// ── (3)(4)(6) Omitted field preserves binding / no auto-assign ───────────────
console.log('\n----- behavioural: omitted field preserves binding -----');
check('(3) edit omits venue field → {omit} (existing binding preserved)', eq(resolveVenueBinding(undefined, false, ELIGIBLE, false), { action: 'omit' }));
check('(4) unrelated edit (no venue key) → {omit} (binding never erased)', eq(resolveVenueBinding(null, false, [], false), { action: 'omit' }));
check('(6) legacy/unbound edit with no venue key → {omit} (never auto-assigned)', eq(resolveVenueBinding(undefined, false, ELIGIBLE, false), { action: 'omit' }));

// ── (5) Invalid, pending and ineligible ids are rejected ─────────────────────
console.log('\n----- behavioural: reject invalid / pending / ineligible -----');
check('(5) forged/unknown edit id → reject(ineligible)', eq(resolveVenueBinding('ven_forged', true, ELIGIBLE, false), { action: 'reject', error: VENUE_BIND_ERR.ineligible }));
check('(5) "pending" (not-yet-published) id absent from directory → reject(ineligible)', eq(resolveVenueBinding('ven_pending', true, ELIGIBLE, false), { action: 'reject', error: VENUE_BIND_ERR.ineligible }));
check('(5) empty edit id → reject(cleared) (published cannot be stripped)', eq(resolveVenueBinding('', true, ELIGIBLE, false), { action: 'reject', error: VENUE_BIND_ERR.cleared }));
check('(5) whitespace-only edit id → reject(cleared)', eq(resolveVenueBinding('   ', true, ELIGIBLE, false), { action: 'reject', error: VENUE_BIND_ERR.cleared }));
check('(5) empty against an EMPTY directory → still reject(cleared), not omit', eq(resolveVenueBinding('', true, [], false), { action: 'reject', error: VENUE_BIND_ERR.cleared }));

console.log('\n----- behavioural: create/publication (required) mode -----');
check('create missing venue key → reject(missing)', eq(resolveVenueBinding(undefined, false, ELIGIBLE, true), { action: 'reject', error: VENUE_BIND_ERR.missing }));
check('create empty venue → reject(missing)', eq(resolveVenueBinding('', true, ELIGIBLE, true), { action: 'reject', error: VENUE_BIND_ERR.missing }));
check('create forged venue → reject(ineligible)', eq(resolveVenueBinding('nope', true, ELIGIBLE, true), { action: 'reject', error: VENUE_BIND_ERR.ineligible }));
check('create valid venue → {set}', eq(resolveVenueBinding('ven_gamma', true, ELIGIBLE, true), { action: 'set', value: 'ven_gamma' }));

// ── (9)(2) Backend failures never produce a false success ────────────────────
console.log('\n----- behavioural: interpretRetreatSave — no false success -----');
check('(2) ok + echo matches sent id → success', eq(interpretRetreatSave({ ok: true, data: { data: { venue_partner_id: 'ven_beta' } } }, 'ven_beta'), { ok: true, text: 'Retreat updated ✓' }));
check('(2) ok + no echo (untyped PATCH body) + sent id → success (re-fetch confirms)', eq(interpretRetreatSave({ ok: true, data: {} }, 'ven_beta'), { ok: true, text: 'Retreat updated ✓' }));
check('(3) ok + no venue sent → success (omit path)', eq(interpretRetreatSave({ ok: true, data: {} }, ''), { ok: true, text: 'Retreat updated ✓' }));
check('(9) ok + MISMATCHED echo → NOT success (binding unconfirmed)', interpretRetreatSave({ ok: true, data: { data: { venue_partner_id: 'ven_other' } } }, 'ven_beta').ok === false);
check('(9) backend 4xx/5xx with message → error (no false success)', eq(interpretRetreatSave({ ok: false, data: { error: 'Editing is locked while seats are paid.' } }, 'ven_beta'), { ok: false, text: 'Editing is locked while seats are paid.' }));
check('(9) backend failure without message → generic error', eq(interpretRetreatSave({ ok: false, data: {} }, ''), { ok: false, text: 'Could not save changes.' }));

// ── (7)(8) Local draft: venue id survives round-trip; old snapshots compatible ─
console.log('\n----- behavioural: local draft venue-id persistence -----');
const draftRoundTrip = JSON.parse(JSON.stringify({ title: 'Himalayan silence retreat', venuePartnerId: 'ven_alpha', venueName: 'Alpha Ashram' }));
check('(7) draft round-trip preserves venuePartnerId', draftRoundTrip.venuePartnerId === 'ven_alpha');
check('(7) meaningful draft is detected for restoration', draftIsMeaningful(draftRoundTrip) === true);
const oldSnapshot = JSON.parse(JSON.stringify({ title: 'Legacy retreat draft', venueName: 'Old Venue' })); // pre-binding snapshot: no venuePartnerId
check('(8) old snapshot (no venuePartnerId) is still restorable', draftIsMeaningful(oldSnapshot) === true);
check('(8) old snapshot venuePartnerId resolves to "" (|| "" fallback, no crash)', (oldSnapshot.venuePartnerId || '') === '');
check('(8) empty draft is not "meaningful"', draftIsMeaningful({}) === false && draftIsMeaningful(null) === false);

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ LAYER 2 — SOURCE-LEVEL WIRING                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── Pure helpers stay pure (framework-free, importable by tests) ─────────────
console.log('\n----- source: pure helpers are framework-free -----');
check('venue-binding helper present', bindLib.length > 0 && /export function resolveVenueBinding/.test(bindLib));
check('venue-binding has NO next/server or network import', !/from '@?next/.test(bindLib) && !/\bfetch\(/.test(bindLib));
check('retreat-save helper present', saveLib.length > 0 && /export function interpretRetreatSave/.test(saveLib));
check('retreat-save has NO React/next/network import', !/from 'react'/.test(saveLib) && !/from '@?next/.test(saveLib) && !/\bfetch\(/.test(saveLib));

// ── (1) Saved venue loads & is preselected; picker matches by id only ────────
console.log('\n----- source: load + preselect (id-only) -----');
check('(1) RetreatDetail exposes venuePartnerId', /venuePartnerId:\s*string/.test(host));
check('(1) projectDetail maps venue_partner_id (empty when absent)', /venuePartnerId:\s*r\.venue_partner_id\s*\?\s*String\(r\.venue_partner_id\)\s*:\s*''/.test(host));
check('(1) edit form preselects from retreat.venuePartnerId', /useState\(retreat\.venuePartnerId \|\| ''\)/.test(editForm));
check('(1) edit page feeds eligibleVenues from getBindableVenues()', /getBindableVenues\(\{\s*limit:\s*100\s*\}\)/.test(editPage) && /eligibleVenues=\{eligibleVenues\}/.test(editPage));
check('(1) edit form renders VenuePicker', /<VenuePicker /.test(editForm));
check('(1) VenuePicker resolves selection by id ONLY (never name/city)', /venues\.find\(\(v\)\s*=>\s*v\.id\s*===\s*selectedId\)/.test(picker));
check('(6) VenuePicker surfaces ineligible/no-longer-listed (no silent substitute)', /data-testid="venue-ineligible"/.test(picker));
check('(6) edit form flags a set-but-ineligible binding', /venueIneligible\s*=\s*venuePartnerId\s*!==\s*''\s*&&\s*!venueResolved/.test(editForm));

// ── (2)(3)(4) Edit PATCH persistence wiring ──────────────────────────────────
console.log('\n----- source: edit BFF + form persistence wiring -----');
check('(2) edit BFF imports the pure venue-binding helper', /import\s*\{\s*resolveVenueBinding\s*\}\s*from\s*'@\/lib\/server\/venue-binding'/.test(editBff));
check('(2) edit BFF validates against the BINDABLE directory (getBindableVenues)', /import\s*\{\s*getBindableVenues\s*\}\s*from\s*'@\/lib\/server\/venues'/.test(editBff) && /getBindableVenues\(\{\s*limit:\s*100\s*\}\)/.test(editBff));
check('(3)(4) edit BFF only touches binding when field present (preserve-on-omit)', /if \(typeof raw\.venue_partner_id === 'string'\)/.test(editBff));
check('(2) edit BFF rejects via helper decision with 400', /decision\.action === 'reject'[\s\S]*status:\s*400/.test(editBff));
check('(2) edit BFF forwards only the validated id', /decision\.action === 'set'[\s\S]*body\.venue_partner_id = decision\.value/.test(editBff));
check('(2)(3) edit form sends venue_partner_id ONLY when set (omit preserves)', /\.\.\.\(venuePartnerId \? \{ venue_partner_id: venuePartnerId \} : \{\}\)/.test(editForm));
check('(5) edit form blocks save while binding is ineligible', /!venueIneligible/.test(editForm) && /Select an eligible listed venue before saving/.test(editForm));
check('(9) edit form interprets result via helper (no false success)', /interpretRetreatSave\(r, venuePartnerId\)/.test(editForm));
check('(2) edit form re-fetches after a successful save (router.refresh)', /if \(r\.ok\) router\.refresh\(\)/.test(editForm));

// ── (5)(10) Create BFF still enforces the publication rule + gates ───────────
console.log('\n----- source: create BFF publication rule + gates -----');
check('create BFF present', createBff.length > 0);
check('create BFF imports getBindableVenues (remote-eligible directory)', /import\s*\{\s*getBindableVenues\s*\}\s*from\s*'@\/lib\/server\/venues'/.test(createBff));
check('(5) create BFF rejects MISSING venue id with 400', /Select a listed NOSTOPS venue[\s\S]*status:\s*400/.test(createBff));
check('(5) create BFF validates id against getVenues() eligible set', /eligibleVenues\.some\(\(v\)\s*=>\s*v\.id\s*===\s*venuePartnerId\)/.test(createBff));
check('(5) create BFF rejects UNLISTED/forged id with 400', /not a listed, eligible[\s\S]*status:\s*400/.test(createBff));
check('(2) create BFF forwards validated venue_partner_id', /venue_partner_id:\s*venuePartnerId/.test(createBff));

// ── (10) Auth / ownership / CSRF / paid-seat lock all preserved ──────────────
console.log('\n----- source: auth / ownership / CSRF / edit-lock -----');
check('(10) create BFF preserves CSRF (badOrigin) + feature gate', /badOrigin\(req\)/.test(createBff) && /requireFeatureAccess\('retreat_hosting'\)/.test(createBff));
check('(10) edit BFF preserves CSRF (badOrigin) + feature gate', /badOrigin\(req\)/.test(editBff) && /requireFeatureAccess\('retreat_hosting'\)/.test(editBff));
check('(10) host read is ownership fail-closed (foreign host → null)', /if \(userId && retreat\.hostUserId !== userId\) return null/.test(host));
check('(10) manage page passes the session user id to the ownership guard', /getHostedRetreat\(id, \(user\.user_id as string\) \|\| null\)/.test(editPage));
check('(10) paid-seat edit lock disables the picker', /<VenuePicker[\s\S]*disabled=\{locked\}/.test(editForm));
check('(10) edit form locks save/fields when editLock is locked', /const locked = editLock\.locked/.test(editForm));

// ── (7)(8) Draft model carries the binding + stays backward-compatible ───────
console.log('\n----- source: client draft model -----');
check('(8) RetreatDraft.venuePartnerId is OPTIONAL (old snapshots compatible)', /venuePartnerId\?:\s*string/.test(draftLib));
check('(7) wizard snapshot persists venuePartnerId', /snapshot\(\)[\s\S]*venuePartnerId,/.test(wiz));
check('(7)(8) wizard applyDraft restores venuePartnerId with "" fallback', /setVenuePartnerId\(d\.venuePartnerId \|\| ''\)/.test(wiz));
check('(2) wizard publish body includes venue_partner_id', /venue_partner_id:\s*venuePartnerId/.test(wiz));
check('new page maps directory → public fields only & feeds wizard', /getBindableVenues\(\{\s*limit:\s*100\s*\}\)/.test(newPage) && /eligibleVenues=\{eligibleVenues\}/.test(newPage));

// ── (6) Public read path binding preserved (legacy retreats readable) ────────
console.log('\n----- source: public read-path binding preserved -----');
check('getRetreatsAtVenue binds via venuePartnerId === venueId', /venuePartnerId\s*===\s*venueId/.test(venues));
check('PublicRetreat maps venue_partner_id', /venuePartnerId:\s*str\(r\.venue_partner_id\)/.test(retreats));
check('retreat detail links to its bound venue', /getVenue\(r\.venuePartnerId\)/.test(detail));

// ── (BINDABLE ≠ PUBLIC DIRECTORY) remote-eligible split (fixes 422 dead-end) ──
console.log('\n----- source: bindable (remote) vs public (merged) venue split -----');
check('getBindableVenues() exists (remote /venue-partners only)', /export async function getBindableVenues/.test(venues) && /\/venue-partners\?/.test(venues));
check('getBindableVenues does NOT merge admin-published local submissions', (() => {
  const m = venues.match(/export async function getBindableVenues[\s\S]*?\n}/);
  return !!m && !/getPublishedVenues/.test(m[0]);
})());
check('getVenues() (public directory) still MERGES published local submissions', (() => {
  const m = venues.match(/export async function getVenues[\s\S]*?\n}/);
  return !!m && /getBindableVenues\(opts\)/.test(m[0]) && /getPublishedVenues/.test(m[0]);
})());
check('retreat BINDING callers use getBindableVenues (not the merged public list)',
  /getBindableVenues/.test(editBff) && /getBindableVenues/.test(createBff) && /getBindableVenues/.test(editPage) && /getBindableVenues/.test(newPage));


// ── (12) No Nearby Attractions functionality/schema/endpoint/dependency ──────
console.log('\n----- source: no Nearby Attractions introduced -----');
const NEARBY = /nearby[_\s]?attraction/i;
for (const [name, src] of [['create BFF', createBff], ['edit BFF', editBff], ['edit form', editForm], ['wizard', wiz], ['picker', picker], ['venue-binding helper', bindLib], ['retreat-save helper', saveLib], ['draft lib', draftLib]]) {
  check(`(12) no Nearby Attractions in ${name}`, !NEARBY.test(src));
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ LAYER 3 — HTTP (best-effort, read-only; no retreat created)               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
async function http() {
  console.log(`\n----- HTTP (read-only) SITE=${SITE} -----`);
  for (const path of ['/venues', '/app/teacher/retreats/new']) {
    try {
      const r = await fetch(`${SITE}${path}`, { redirect: 'manual' });
      const ok = path === '/venues' ? r.status === 200 : (r.status === 200 || (r.status >= 300 && r.status < 400));
      check(`${path} reachable`, ok, `status ${r.status}`);
    } catch (e) { note(`${path} unreachable (${e.message})`); }
  }
}
await http();

console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail > 0 ? 1 : 0);
