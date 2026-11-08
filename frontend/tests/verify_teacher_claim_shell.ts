// Stage 5A — legacy teacher claim SHELL regression suite.
// Layer 1 (unit, mocked backend): status → state mapping, non-consuming GET-only call, token never in
//   errors/logs, outage ≠ invalid, token redaction for monitoring.
// Layer 2 (HTTP, live Preview server): invalid link state, refresh does not change state, headers
//   (no-store, no-referrer, noindex), no GA/third-party script, token absent from server logs,
//   /claim, /login, /register still 200.
// Run: node tests/verify_teacher_claim_shell.ts [SITE_BASE]   (default http://localhost:3000)
import { readFileSync, existsSync } from 'node:fs';
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
register('./server-only-hook.mjs', import.meta.url);

process.env.TEACHER_CLAIM_API_BASE = 'https://claim-preview.test/api';
const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

const { checkClaimLink } = await import('../lib/server/teacher-claim.ts');
const { classifyClaimStatus, redactClaimTokens, isClaimPath, isPlausibleClaimToken } = await import('../lib/teacher-claim.ts');

console.log('Layer 1 — mocked backend');
const TOKEN = 'QATOKEN_unit_5a_abcdef123456';
const calls: { url: string; init: RequestInit }[] = [];
const mock = (status: number | 'throw') => async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  if (status === 'throw') throw new Error(`network down for ${url}`);
  return { status };
};
ok((await checkClaimLink(TOKEN, mock(200))).state === 'valid', '200 → valid (neutral screen)');
ok((await checkClaimLink(TOKEN, mock(410))).state === 'invalid', '410 → invalid/expired');
ok((await checkClaimLink(TOKEN, mock(404))).state === 'invalid', '404 → invalid');
ok((await checkClaimLink(TOKEN, mock(500))).state === 'unavailable', '500 → unavailable (not "invalid")');
ok((await checkClaimLink(TOKEN, mock(503))).state === 'unavailable', '503 → unavailable');
ok((await checkClaimLink(TOKEN, mock(401))).state === 'unavailable', '401 → unavailable (never a false "not found")');
let threw = false;
try { ok((await checkClaimLink(TOKEN, mock('throw'))).state === 'unavailable', 'network error → unavailable, no throw'); } catch { threw = true; }
ok(!threw, 'token-bearing network error is swallowed (never propagated to logs)');
ok(calls.every((c) => (c.init.method || 'GET') === 'GET'), 'every backend call is GET (non-consuming)');
ok(calls.every((c) => c.url === `https://claim-preview.test/api/teachers/claim/${TOKEN}`), 'only the confirmed GET /api/teachers/claim/{raw_token} is called');
ok(calls.every((c) => !new Headers(c.init.headers).has('Authorization')), 'visitor session is not forwarded');
ok(calls.every((c) => c.init.cache === 'no-store'), 'backend call is uncached');
const before = calls.length;
ok((await checkClaimLink('bad token!', mock(200))).state === 'invalid' && calls.length === before, 'malformed token → invalid without calling the backend');
ok(!isPlausibleClaimToken('short') && isPlausibleClaimToken(TOKEN), 'token shape check');
ok(classifyClaimStatus(null) === 'unavailable', 'no status → unavailable');
ok(redactClaimTokens(`Error at /teachers/claim/${TOKEN}?x=1`) === 'Error at /teachers/claim/[redacted]?x=1', 'token redacted for error monitoring');
ok(isClaimPath('/teachers/claim/x') && !isClaimPath('/claim') && !isClaimPath('/teachers/anjali'), 'claim-path detection');

console.log('Layer 1b — source guards');
const page = readFileSync(new URL('../app/(claim)/teachers/claim/[token]/page.tsx', import.meta.url), 'utf8');
const srv = readFileSync(new URL('../lib/server/teacher-claim.ts', import.meta.url), 'utf8');
ok(!/method:\s*'POST'/.test(page) && !/localStorage|sessionStorage/.test(page + srv), 'page load never POSTs; no browser storage');
ok(!/console\.(log|error|warn)/.test(page + srv), 'claim shell never logs');
ok(readFileSync(new URL('../components/Analytics.tsx', import.meta.url), 'utf8').includes('isClaimPath(pathname)'), 'GA skips claim pages');
ok(readFileSync(new URL('../lib/report-client-error.ts', import.meta.url), 'utf8').includes('redactClaimTokens(window.location.pathname)'), 'error monitor redacts claim path');
ok(!existsSync(new URL('../app/(public)/teachers/claim', import.meta.url)), 'claim route sits outside the public layout (no attribution capture)');

console.log(`Layer 2 — live HTTP (${SITE})`);
const LIVE = `QATOKEN_live_5a_${Date.now()}`;
const get = (p: string) => fetch(`${SITE}${p}`, { redirect: 'manual', signal: AbortSignal.timeout(90000) });
const r1 = await get(`/teachers/claim/${LIVE}`);
const h1 = await r1.text();
ok(r1.status === 200 && h1.includes('data-state="invalid"'), 'unknown token shows the invalid/expired state (backend 410)');
const cc = r1.headers.get('cache-control') || '';
const devServer = process.env.CLAIM_TEST_PROD !== '1'; // set CLAIM_TEST_PROD=1 against a production build
ok(/no-store/.test(cc) || (devServer && /no-cache/.test(cc) && /must-revalidate/.test(cc)),
  `Cache-Control prevents caching (${cc})${/no-store/.test(cc) ? '' : ' — dev server forces no-cache; production dynamic pages send no-store'}`);
ok(r1.headers.get('referrer-policy') === 'no-referrer', 'Referrer-Policy: no-referrer');
ok(/noindex/.test(r1.headers.get('x-robots-tag') || '') && /<meta name="robots" content="noindex, nofollow/.test(h1), 'noindex, nofollow (header + meta)');
ok(!/googletagmanager|google-analytics|cloudflareinsights/.test(h1), 'no third-party tracking scripts');
ok(!h1.includes('Ask AI Guru'), 'no Ask Guru widget on claim page');
const r2 = await get(`/teachers/claim/${LIVE}`);
ok((await r2.text()).includes('data-state="invalid"'), 'refresh returns the same state (GET-only, nothing consumed)');
for (const f of ['/var/log/supervisor/frontend.out.log', '/var/log/supervisor/frontend.err.log']) {
  if (existsSync(f)) ok(!readFileSync(f, 'utf8').includes(LIVE), `token absent from ${f}`);
}
for (const p of ['/claim', '/login', '/register']) {
  const r = await get(p);
  ok(r.status === 200, `${p} still 200`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
