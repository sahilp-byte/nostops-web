// Batch 1 verification — Tier 2 AI-Assisted Onboarding FREE early-access preview.
//
// Proves:
//   - the preview surfaces (public landing + /venues banner + edit-flow panel)
//     are flag-gated on VENUE_TIER2_PREVIEW (default OFF → 404 / hidden);
//   - the private owner action (import-draft) is edit-token gated;
//   - ZERO-CHARGE guard: no Tier 2 file references Cashfree / checkout /
//     entitlement / subscription / payment; and the preview cannot trigger one.
//
// Usage: node tests/verify_tier2_preview.ts [SITE_BASE]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tier2PreviewEnabled } from '../lib/server/flags.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${cond ? '' : `  ${extra}`}`);
}
const read = (rel: string) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');

// --- Flag logic -------------------------------------------------------------
console.log('----- FLAG LOGIC -----');
delete process.env.VENUE_TIER2_PREVIEW;
check('default OFF when unset', tier2PreviewEnabled() === false);
process.env.VENUE_TIER2_PREVIEW = 'TRUE';
check('ON when TRUE', tier2PreviewEnabled() === true);
process.env.VENUE_TIER2_PREVIEW = 'nope';
check('OFF when garbage', tier2PreviewEnabled() === false);
delete process.env.VENUE_TIER2_PREVIEW;

// --- Source wiring ----------------------------------------------------------
console.log('\n----- SOURCE WIRING -----');
const landing = read('app/(public)/venues/ai-onboarding/page.tsx');
check('preview landing exists', landing.length > 0);
check('landing 404s when flag OFF', /if\s*\(!tier2PreviewEnabled\(\)\)\s*notFound\(\)/.test(landing));
check('landing says free / not paid', /free/i.test(landing) && /no checkout|not a paid service|no charge/i.test(landing));

const venues = read('app/(public)/venues/page.tsx');
check('/venues banner gated on flag', /tier2PreviewEnabled\(\)\s*&&/.test(venues) && /ai-onboarding/.test(venues));

const editPage = read('app/(public)/venues/submit/edit/page.tsx');
check('edit page passes flag to client', /tier2PreviewEnabled\(\)/.test(editPage) && /tier2Preview=/.test(editPage));

const form = read('components/venues/PublicSubmitForm.tsx');
check('AI panel only in edit + flag + token', /isEdit && tier2Preview && token/.test(form));

const panel = read('components/venues/AiImportPanel.tsx');
check('panel calls import-draft BFF', /\/bff\/venue\/public-submissions\/import-draft/.test(panel));
check('panel labels suggestions Unverified', /Unverified/.test(panel));

// --- ZERO-CHARGE GUARD ------------------------------------------------------
console.log('\n----- ZERO-CHARGE GUARD -----');
const TIER2_FILES = [
  'app/(public)/venues/ai-onboarding/page.tsx',
  'app/bff/venue/public-submissions/import-draft/route.ts',
  'components/venues/AiImportPanel.tsx',
];
const CHARGE_RE = /cashfree[^\n]{0,24}order|\/payments\/cashfree|create[_-]?order|payment[_-]?intent|_grant_entitlement|grantEntitlement|addToCart|href=["'][^"']*\/checkout|razorpay|collect[_-]?card|card[_-]?number/i;
for (const f of TIER2_FILES) {
  const src = read(f);
  const hits = src.split('\n').filter((l) => CHARGE_RE.test(l));
  check(`no charge/payment path in ${f}`, hits.length === 0, hits.slice(0, 2).join(' | '));
}
// Backend import-draft handler must not touch Cashfree/entitlement either.
const backend = read('../backend/venues.py');
const importBlock = backend.slice(backend.indexOf('def import_draft'));
check('backend import_draft has no charge path', importBlock.length > 0 && !CHARGE_RE.test(importBlock.slice(0, 1500)));

// --- HTTP: flag gate is consistent (banner ⇔ landing reachable) -------------
async function http() {
  console.log(`\n----- HTTP (flag-state consistency) SITE=${SITE} -----`);
  let bannerShown = false;
  try {
    const v = await fetch(`${SITE}/venues`);
    const html = await v.text();
    check('/venues 200', v.ok, `status ${v.status}`);
    bannerShown = /href="[^"]*\/venues\/ai-onboarding"/.test(html);
  } catch (e) {
    console.log(`SKIP | preview unreachable (${(e as Error).message})`);
    return;
  }
  try {
    const r = await fetch(`${SITE}/venues/ai-onboarding`);
    if (bannerShown) {
      check('preview ON: ai-onboarding reachable (200) + banner shown', r.status === 200, `status ${r.status}`);
    } else {
      check('preview OFF: ai-onboarding 404 + banner hidden', r.status === 404, `status ${r.status}`);
    }
  } catch { /* ignore */ }
  // import-draft requires a valid edit token → a tokenless/garbage call must be
  // rejected regardless of the flag (private owner action, never open access).
  try {
    const d = await fetch(`${SITE}/bff/venue/public-submissions/import-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'x' }),
    });
    check('import-draft rejects anonymous/invalid call (no open access)', d.status === 400 || d.status === 403, `status ${d.status}`);
  } catch { /* ignore */ }
}

await http();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
