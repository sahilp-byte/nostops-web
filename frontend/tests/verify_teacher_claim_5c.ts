// Stage 5C — legacy teacher claim journey integration suite.
// Layer 1: server client (mocked backend) — exact endpoints, methods, bodies, bearer, no phone input,
//          profile sanitising/masking, env-only base URL (never the live backend).
// Layer 2: BFF route handler (mocked backend) — new-account claim + session cookie, conflict keeps token,
//          OTP request (masked phone / manual review / 429), OTP verify → httpOnly verification cookie →
//          claim continuation, CSRF refusal, no OTP/token/verification id in JSON.
// Layer 3: live Preview — real Preview backend 410 for every action, link requires a session,
//          GET never consumes (state stable on refresh), headers, no tracking, regressions.
// Run: node tests/verify_teacher_claim_5c.ts [SITE_BASE]
import { register } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
register('./alias-hooks.mjs', import.meta.url);
register('./server-only-hook.mjs', import.meta.url);

process.env.TEACHER_CLAIM_API_BASE = 'https://claim-preview.test/api';
const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

type Call = { url: string; method: string; body: any; auth: string | null };
const calls: Call[] = [];
let script: ((c: Call) => { status: number; body?: any }) = () => ({ status: 500 });
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = String(url);
  if (!u.startsWith('https://claim-preview.test/')) return realFetch(url, init);
  const c: Call = { url: u, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null, auth: new Headers(init.headers).get('authorization') };
  calls.push(c);
  const r = script(c);
  return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json' } });
}) as any;

const lib = await import('../lib/server/teacher-claim.ts');
const T = 'SYNTH_token_5c_abcdef1234567890';
const PROFILE = { name: 'Synthetic Teacher', email: 'synthetic.teacher@example.org', city: 'Pune', bio: 'Hatha', experience_years: 7,
  specializations: ['Hatha'], languages: ['English'], avatar_url: 'https://cdn.test/a.jpg', badges: ['Legacy'], teacher_id: 'yoga_synth', phone: '+919999999999' };

console.log('Layer 1 — server client');
script = () => ({ status: 200, body: PROFILE });
const v = await lib.checkClaimLink(T);
ok(v.state === 'valid' && v.profile?.name === 'Synthetic Teacher', 'valid invitation → profile');
ok(v.profile?.email_masked === 's•••@example.org' && !JSON.stringify(v.profile).includes('synthetic.teacher@'), 'email masked, full email never sent to browser');
ok(!('teacher_id' in (v.profile as any)) && !JSON.stringify(v.profile).includes('9999'), 'teacher_id and phone never reach the browser');
ok(calls.at(-1)!.url === `https://claim-preview.test/api/teachers/claim/${T}` && calls.at(-1)!.method === 'GET' && !calls.at(-1)!.auth, 'GET /teachers/claim/{token}, anonymous');
script = () => ({ status: 410 }); ok((await lib.checkClaimLink(T)).state === 'invalid', '410 → invalid/expired/used/claimed');
script = () => ({ status: 502 }); ok((await lib.checkClaimLink(T)).state === 'unavailable', '5xx → unavailable');
const saved = process.env.TEACHER_CLAIM_API_BASE; delete process.env.TEACHER_CLAIM_API_BASE;
const n0 = calls.length; ok((await lib.checkClaimLink(T)).state === 'unavailable' && calls.length === n0, 'no base configured → unavailable, no call (never falls back to the live backend)');
process.env.TEACHER_CLAIM_API_BASE = 'https://pro-learn-connect-1.emergent.host'; ok(lib.claimApiBase() === null, 'base must be an explicit …/api URL');
{ const env = process.env as Record<string, string | undefined>; const ne = env.NODE_ENV;
  env.TEACHER_CLAIM_API_BASE = 'https://pro-learn-connect-1.preview.emergentagent.com/api';
  env.NODE_ENV = 'production'; ok(lib.claimApiBase() === null, 'production build never uses a Preview claim backend');
  env.NODE_ENV = 'development'; ok(lib.claimApiBase() === 'https://pro-learn-connect-1.preview.emergentagent.com/api', 'preview (dev) keeps the Preview claim backend');
  env.NODE_ENV = ne; }
process.env.TEACHER_CLAIM_API_BASE = saved;
ok(lib.websiteRoute('/teacher-dashboard') === '/app/teacher' && lib.websiteRoute('/elsewhere') === '/app', 'next_route mapping');

console.log('Layer 2 — BFF route handler (mocked backend)');
const { NextRequest } = await import('next/server');
const route = await import('../app/bff/teachers/claim/[token]/[action]/route.ts');
const ORIGIN = 'http://localhost:3000';
const csrf = 'c'.repeat(32);
const mk = (action: string, body: any, cookies = '', origin = ORIGIN) => new NextRequest(`${ORIGIN}/bff/teachers/claim/${T}/${action}`, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', origin, host: 'localhost:3000', 'x-csrf-token': origin === ORIGIN ? csrf : 'x'.repeat(32), cookie: `nostops_csrf=${csrf}${cookies ? '; ' + cookies : ''}` },
});
const call = async (action: string, body: any, cookies = '', origin?: string) => {
  const r = await route.POST(mk(action, body, cookies, origin), { params: Promise.resolve({ token: T, action }) });
  return { status: r.status, json: await r.json(), setCookie: r.headers.get('set-cookie') || '', cc: r.headers.get('cache-control') };
};

let r = await call('complete', { password: 'longenough1', confirm: true }, '', 'https://evil.example');
ok(r.status === 403, 'cross-site POST without the matching CSRF token refused (403)');
const before = calls.length;
r = await call('complete', { password: 'longenough1', confirm: false });
ok(r.status === 422 && calls.length === before, 'claim requires explicit confirmation (no backend call)');
r = await call('complete', { password: 'short', confirm: true });
ok(r.status === 422 && r.json.code === 'password_invalid' && calls.length === before, 'password policy 8–128 enforced before calling');

script = (c) => (c.method === 'POST' && c.url.endsWith(`/claim/${T}`) ? { status: 409, body: { detail: 'Email synthetic.teacher@example.org already registered' } } : { status: 200, body: PROFILE });
r = await call('complete', { password: 'longenough1', confirm: true });
ok(r.status === 409 && r.json.code === 'conflict' && !JSON.stringify(r.json).includes('@'), 'email conflict → safe "conflict" (no other-account data)');
ok(!r.setCookie.includes('nostops_session'), 'no session on conflict');
script = (c) => (c.method === 'POST' ? { status: 200, body: { user: { user_id: 'u_s' }, session_token: 'SESS_synth_1', role: 'teacher', next_route: '/teacher-dashboard' } } : { status: 200, body: PROFILE });
r = await call('complete', { password: 'longenough1', confirm: true });
ok(r.status === 200 && r.json.next === '/app/teacher', 'retry after conflict succeeds with the same token (token preserved by backend)');
ok(/nostops_session=SESS_synth_1/.test(r.setCookie) && /HttpOnly/i.test(r.setCookie), 'session_token stored in the existing httpOnly session cookie');
ok(!JSON.stringify(r.json).includes('SESS_synth_1'), 'session token never returned to browser JS');
ok(JSON.stringify(calls.at(-1)!.body) === JSON.stringify({ password: 'longenough1' }), 'POST body = {password} only');
ok(/no-store/.test(r.cc || ''), 'BFF responses no-store');

script = () => ({ status: 200, body: { status: 'otp_sent', operation: 'claim', phone_masked: '+91•••••1234' } });
r = await call('otp-request', { operation: 'claim', phone: '+910000000000' });
ok(r.json.status === 'otp_sent' && r.json.phone_masked === '+91•••••1234', 'OTP request → masked phone only');
ok(JSON.stringify(calls.at(-1)!.body) === JSON.stringify({ operation: 'claim' }), 'browser-supplied phone is dropped (backend picks stored phone)');
script = () => ({ status: 200, body: { status: 'manual_review' } });
ok((await call('otp-request', { operation: 'link' })).json.status === 'manual_review', 'manual review surfaced');
script = () => ({ status: 429 });
ok((await call('otp-request', { operation: 'claim' })).json.code === 'rate_limited', '429 → rate_limited');
ok((await call('otp-request', { operation: 'admin' })).status === 422, 'unknown operation refused');

script = () => ({ status: 400, body: { detail: 'Invalid or expired code' } });
r = await call('otp-verify', { operation: 'claim', code: '000000' });
ok(r.status === 422 && r.json.code === 'otp_invalid' && !r.setCookie.includes('nostops_claim_v'), 'wrong/expired OTP → otp_invalid, no authorisation');
script = () => ({ status: 200, body: { ok: true, verification_id: 'VER_synth_1', operation: 'claim', expires_in_seconds: 600 } });
r = await call('otp-verify', { operation: 'claim', code: '123456' });
ok(r.status === 200 && !JSON.stringify(r.json).includes('VER_synth_1'), 'verification id never exposed to JS');
ok(/nostops_claim_v=claim%3AVER_synth_1|nostops_claim_v=claim:VER_synth_1/.test(r.setCookie) && /HttpOnly/i.test(r.setCookie) && /Max-Age=600/i.test(r.setCookie), 'verification kept in httpOnly cookie for 10 minutes');
ok(!r.setCookie.includes('nostops_session') && JSON.stringify(calls.at(-1)!.body) === JSON.stringify({ operation: 'claim', code: '123456' }), 'OTP success alone creates no session / claim');
script = (c) => (c.method === 'POST' ? { status: 200, body: { session_token: 'SESS_synth_2', role: 'teacher', next_route: '/teacher-dashboard' } } : { status: 200, body: PROFILE });
r = await call('complete', { password: 'longenough1', confirm: true }, 'nostops_claim_v=claim:VER_synth_1');
ok(JSON.stringify(calls.at(-1)!.body) === JSON.stringify({ password: 'longenough1', verification_id: 'VER_synth_1' }), 'claim continues with verification_id');
ok(/nostops_claim_v=;/.test(r.setCookie) || /nostops_claim_v=.*Max-Age=0/i.test(r.setCookie), 'verification cookie cleared after use (single-use)');
await call('complete', { password: 'longenough1', confirm: true }, 'nostops_claim_v=link:VER_synth_1');
ok(!('verification_id' in calls.at(-1)!.body), 'a "link" verification is never used for "claim"');

console.log('Layer 3 — live Preview backend + site');
const P = `SYNTH_live_5c_${Date.now()}`;
const live = (p: string, init?: RequestInit) => realFetch(`${SITE}${p}`, { redirect: 'manual', signal: AbortSignal.timeout(90000), ...init });
const page1 = await live(`/teachers/claim/${P}`); const h = await page1.text();
ok(h.includes('data-state="invalid"'), 'Preview backend: unknown token → invalid state');
ok((await (await live(`/teachers/claim/${P}`)).text()).includes('data-state="invalid"'), 'refresh: same state, nothing consumed');
ok(page1.headers.get('referrer-policy') === 'no-referrer' && /noindex/.test(page1.headers.get('x-robots-tag') || ''), 'no-referrer + noindex');
ok(!/googletagmanager|google-analytics/.test(h), 'no analytics');
const csrfCookie = (page1.headers.get('set-cookie') || '').match(/nostops_csrf=([^;]+)/)?.[1] || '';
const post = (a: string, b: any) => live(`/bff/teachers/claim/${P}/${a}`, { method: 'POST', body: JSON.stringify(b),
  headers: { 'content-type': 'application/json', origin: SITE, 'x-csrf-token': csrfCookie, cookie: `nostops_csrf=${csrfCookie}` } });
ok(!!csrfCookie, 'claim page issues the CSRF cookie');
ok((await (await post('otp-request', { operation: 'claim' })).json()).code === 'invalid_link', 'Preview backend: OTP request on unknown token → invalid_link');
ok((await post('complete', { password: 'longenough1', confirm: true })).status === 410, 'Preview backend: claim on unknown token → 410');
const lk = await post('link', { confirm: true });
ok(lk.status === 401 && (await lk.json()).code === 'auth_required', 'link without a session → auth_required');
for (const f of ['/var/log/supervisor/frontend.out.log', '/var/log/supervisor/frontend.err.log'])
  if (existsSync(f)) ok(!readFileSync(f, 'utf8').includes(P), `token absent from ${f}`);
for (const p of ['/claim', '/login', '/register']) ok((await live(p)).status === 200, `${p} still 200`);
ok([302, 307].includes((await live('/app/teacher')).status), '/app/teacher still requires sign-in (dashboard gate intact)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
