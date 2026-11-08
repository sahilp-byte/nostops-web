// Payments Prompt 2D — preview isolation, retreat start eligibility and waitlist protections.
// Runs the REAL BFF code in Node (backendFetch, forward, route handlers) with the REAL local
// routing policy (backend/payment_routing.py at PULSE_API_URL). Every other network call is
// intercepted, recorded and answered locally, so nothing reaches the main backend.
// Run: node tests/verify_preview_isolation.ts   (needs the local backend running)
import { readFileSync } from 'node:fs';
import { register as registerHook } from 'node:module';

registerHook('./alias-hooks.mjs', import.meta.url);
registerHook('./server-only-hook.mjs', import.meta.url);
registerHook('./next-headers-hook.mjs', import.meta.url);

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^(PULSE_SHARED_SECRET|PULSE_API_URL|BACKEND_URL)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { NextRequest } = await import('next/server');
const { backendFetch } = await import('../lib/server/session.ts');
const { forward } = await import('../lib/server/bff.ts');
const iso = await import('../lib/server/preview-isolation.ts');
const elig = await import('../lib/server/retreat-eligibility.ts');
const groupBook = await import('../app/bff/retreats/[id]/group-book/route.ts');
const reserve = await import('../app/bff/retreats/[id]/reserve/route.ts');
const invite = await import('../app/bff/booking-invite/[token]/[action]/route.ts');
const oneOnOne = await import('../app/bff/one-on-one/bookings/route.ts');
const register = await import('../app/bff/auth/register/route.ts');
const waitlist = await import('../app/bff/retreats/[id]/waitlist/route.ts');

let failures = 0;
let passes = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    passes++;
    console.log(`  \u2713 ${name}`);
  } else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}

// ── network ──
type Call = { url: string; method: string; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
let calls: Call[] = [];
const DAY = 86_400_000;
const istDate = (days: number) => new Date(Date.now() + 5.5 * 3_600_000 + days * DAY).toISOString().slice(0, 10);
const RETREATS: Record<string, unknown> = {};
(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const u = String(url);
  if (u.includes('/api/payment-routing/decide')) return realFetch(u, init);
  const method = String(init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((v, k) => { headers[k] = v; });
  let body: any = null;
  try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch { body = init.body; }
  calls.push({ url: u, method, headers, body });
  if (u.endsWith('/api/auth/me')) return new Response(JSON.stringify({ user: { user_id: 'u_qa_p2d', email: 'qa.p2d@example.com', name: 'QA P2D' } }), { status: 200 });
  const rm = /\/api\/retreats\/([^/?]+)$/.exec(u);
  if (rm && method === 'GET') {
    const v = RETREATS[rm[1]];
    if (v === undefined) return new Response(JSON.stringify({ detail: 'Retreat not found' }), { status: 404 });
    if (typeof v === 'number') return new Response(JSON.stringify({ detail: 'mock error' }), { status: v });
    return new Response(JSON.stringify(v), { status: 200 });
  }
  return new Response(JSON.stringify({ ok: true, forwarded: true, reservation_id: 'rs_qa' }), { status: 200 });
};
const writes = () => calls.filter((c) => c.method !== 'GET' && !c.url.includes('/api/payment-routing/'));

const CSRF = 'p2dfixturecsrftoken0123456789abcd';
const PREVIEW = 'qa-p2d.preview.emergentagent.com';
const PROD = 'www.nostops.org'; // only with the intercepted network above
(globalThis as any).__qaCookies = { nostops_session: 'qa_session_p2d' };
const setHost = (h: Record<string, string> | null) => {
  (globalThis as any).__qaNoRequest = h === null;
  (globalThis as any).__qaRequestHeaders = h || {};
};
const asHost = (host: string) => setHost({ host: 'localhost:3000', 'x-forwarded-host': host });

function req(path: string, body: unknown, host = PREVIEW, extra: Record<string, string> = {}, raw?: string) {
  asHost(host);
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `nostops_csrf=${CSRF}`, 'x-csrf-token': CSRF, 'x-forwarded-host': host, ...extra },
    body: raw ?? JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

console.log('PREVIEW ISOLATION — backendFetch / forward (every write from preview is refused before sending):');
const HOSTS: [string, Record<string, string> | null][] = [
  ['preview (x-forwarded-host)', { host: 'localhost:3000', 'x-forwarded-host': PREVIEW }],
  ['preview (emergentcf)', { host: 'qa-p2d.preview.emergentcf.cloud' }],
  ['local host, no forwarded host', { host: 'localhost:3000' }],
  ['no host headers at all', {}],
  ['outside a request (no context)', null],
];
for (const [label, h] of HOSTS) {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const path of ['/bookings', '/retreats/rt_qa/group-book', '/teachers/me/profile', '/auth/register', '/bookings/invite/tok/register']) {
      calls = [];
      setHost(h);
      const r = await backendFetch(path, { method, body: '{}' });
      const d: any = await r.json().catch(() => null);
      const ok = r.status === 423 && d?.preview_read_only === true && r.headers.get(iso.PREVIEW_READ_ONLY_HEADER) === '1' && calls.length === 0;
      if (!ok || (method === 'POST' && path === '/bookings')) check(`${label}: ${method} ${path} → 423, nothing sent`, ok, [r.status, calls.length]);
    }
  }
  calls = [];
  setHost(h);
  const fr = await forward('/auth/register', { email: 'qa@example.com' });
  check(`${label}: forward('/auth/register') (sign-up) → 423, nothing sent`, fr.status === 423 && calls.length === 0, [fr.status, calls.length]);
}
check('…all 100 write combinations above refused (only failures and one sample per host are listed)', failures === 0);

calls = [];
asHost(PREVIEW);
await backendFetch('/retreats/rt_qa');
check('preview GET (a read) → sent once', calls.length === 1 && calls[0].method === 'GET', calls.map((c) => c.method));
for (const p of iso.PREVIEW_SIGN_IN_PATHS) {
  calls = [];
  asHost(PREVIEW);
  const r = p === '/api/admin/totp/verify' ? await backendFetch(p, { method: 'POST', body: '{}' }) : await forward(p.replace('/api', ''), {});
  check(`preview sign-in ${p} → sent once`, r.status === 200 && calls.length === 1, [r.status, calls.length]);
}
for (const p of ['/auth/login/', '/Auth/Login', '/auth//login', '/auth/login/../../bookings', '/auth/login?next=/x', '/auth/login/x', '/api/auth/loginx', '/auth/otp/start/../../bookings']) {
  calls = [];
  asHost(PREVIEW);
  const r = await forward(p, {});
  check(`sign-in look-alike ${JSON.stringify(p)} → 423, nothing sent`, r.status === 423 && calls.length === 0, [r.status, calls.length]);
}
calls = [];
asHost(PROD);
const prodW = await backendFetch('/teachers/me/profile', { method: 'PATCH', body: '{"bio":"x"}' });
check('production host: PATCH /teachers/me/profile → sent once, unchanged', prodW.status === 200 && calls.length === 1 && calls[0].method === 'PATCH', [prodW.status, calls.length]);
calls = [];
asHost(PROD);
const prodF = await forward('/auth/register', { email: 'qa@example.com' });
check('production host: sign-up → sent once', prodF.status === 200 && calls.length === 1, [prodF.status, calls.length]);

console.log('\nReal booking routes in preview (India, so the country check passes):');
RETREATS.rt_qa = { retreat_id: 'rt_qa', start_date: istDate(60), seats_remaining: 5 };
const GROUP = { group_size: 7, organisation_name: 'QA P2D', contact_name: 'QA', contact_email: 'qa@example.com', contact_phone: '+910000000000', billing_country: 'IN' };
{
  calls = [];
  const r = await groupBook.POST(req('/bff/retreats/rt_qa/group-book', GROUP), params('rt_qa'));
  const d: any = await r.json();
  check('retreat group hold → 423 with the preview message; only reads were sent (sign-in check, retreat)', r.status === 423 && String(d.error).startsWith('Preview mode') && writes().length === 0, [r.status, calls.map((c) => `${c.method} ${c.url}`)]);
}
{
  calls = [];
  const r = await invite.POST(req('/bff/booking-invite/tokqa1234/register', { name: 'QA', email: 'qa@example.com', billing_country: 'IN' }), { params: Promise.resolve({ token: 'tokqa1234', action: 'register' }) });
  const d: any = await r.json();
  check('company-batch enrolment → 423 with the preview message, no write sent', r.status === 423 && String(d.error).startsWith('Preview mode') && writes().length === 0, [r.status, writes().map((c) => c.url)]);
}
{
  calls = [];
  const r = await oneOnOne.POST(req('/bff/one-on-one/bookings', { teacher_handle: 'qa', slot_iso: '2031-01-15T10:00:00Z', learner_name: 'QA', learner_phone: '+910000000000', billing_country: 'IN' }));
  check('1:1 booking → the preview payment guard answers first (503), nothing sent', r.status === 503 && calls.length === 0, [r.status, calls.length]);
}
{
  calls = [];
  const r = await reserve.POST(req('/bff/retreats/rt_qa/reserve', { name: 'QA', email: 'qa@example.com', phone: '+910000000000', billing_country: 'IN' }), params('rt_qa'));
  check('retreat seat → the preview payment guard answers first (503), nothing sent', r.status === 503 && calls.length === 0, [r.status, calls.length]);
}
{
  calls = [];
  const r = await register.POST(req('/bff/auth/register', { name: 'QA', email: 'qa@example.com', password: 'x'.repeat(12) }));
  check('sign-up → 423, nothing sent', r.status === 423 && calls.length === 0, [r.status, calls.length]);
}

console.log('\nRetreat start eligibility (production host, so a hold would otherwise be sent):');
const SEAT = { name: 'QA', email: 'qa@example.com', phone: '+910000000000', billing_country: 'IN' };
async function hold(kind: 'reserve' | 'group-book', retreat: unknown, extra: Record<string, unknown> = {}) {
  if (retreat === undefined) delete RETREATS.rt_case;
  else RETREATS.rt_case = retreat;
  calls = [];
  const body = { ...(kind === 'reserve' ? SEAT : GROUP), ...extra };
  const r = kind === 'reserve'
    ? await reserve.POST(req('/bff/retreats/rt_case/reserve', body, PROD), params('rt_case'))
    : await groupBook.POST(req('/bff/retreats/rt_case/group-book', body, PROD), params('rt_case'));
  const d: any = await r.json().catch(() => null);
  return { status: r.status, d, held: writes().filter((c) => c.url.endsWith(`/api/retreats/rt_case/${kind}`)).length };
}
for (const kind of ['reserve', 'group-book'] as const) {
  const up = await hold(kind, { start_date: istDate(30) });
  check(`${kind}: upcoming retreat → held once (legitimate booking preserved)`, up.status === 200 && up.held === 1, [up.status, up.held]);
  const tmr = await hold(kind, { start_date: istDate(1) });
  check(`${kind}: starts tomorrow (IST) → held once`, tmr.status === 200 && tmr.held === 1, [tmr.status, tmr.held]);
  for (const [label, r] of [['started today (midnight IST passed)', { start_date: istDate(0) }], ['started last week', { start_date: istDate(-7) }]] as const) {
    const s = await hold(kind, r);
    check(`${kind}: ${label} → 409 retreat_started, nothing held`, s.status === 409 && s.d?.reason === 'retreat_started' && s.d?.hold_refused === true && s.held === 0, [s.status, s.d?.reason, s.held]);
  }
  const spoof = await hold(kind, { start_date: istDate(-3) }, { start_date: istDate(90), timezone: 'Pacific/Kiritimati' });
  check(`${kind}: a start date sent by the browser is ignored → still 409`, spoof.status === 409 && spoof.held === 0, [spoof.status, spoof.held]);
  for (const bad of [{ start_date: '2026-02-30' }, { start_date: '' }, {}, { start_date: 'soon' }, { start_date: 20261201 }, { start_date: '01/12/2031' }, { start_date: '2031-12-01Z' }, { start_date: '2031-12-01', timezone: 'Mars/Olympus_Mons' }]) {
    const s = await hold(kind, bad);
    check(`${kind}: unreadable ${JSON.stringify(bad)} → 409 retreat_dates_unavailable, nothing held`, s.status === 409 && s.d?.reason === 'retreat_dates_unavailable' && s.held === 0, [s.status, s.d?.reason]);
  }
  const nf = await hold(kind, undefined);
  check(`${kind}: retreat not found → 404, nothing held`, nf.status === 404 && nf.held === 0, [nf.status, nf.held]);
  const err = await hold(kind, 500);
  check(`${kind}: retreat lookup fails → 503 (fail closed), nothing held`, err.status === 503 && err.held === 0, [err.status, err.held]);
}
{
  const at = (s: unknown, tz?: string) => elig.retreatStartsAt({ start_date: s, ...(tz ? { timezone: tz } : {}) });
  check('2026-12-08 in IST starts 2026-12-07T18:30Z', at('2026-12-08') === Date.parse('2026-12-07T18:30:00Z'), new Date(at('2026-12-08') || 0).toISOString());
  check('2026-12-08 in America/New_York starts 05:00Z (EST)', at('2026-12-08', 'America/New_York') === Date.parse('2026-12-08T05:00:00Z'));
  check('2026-07-08 in America/New_York starts 04:00Z (EDT, daylight saving)', at('2026-07-08', 'America/New_York') === Date.parse('2026-07-08T04:00:00Z'));
  check('2026-12-08T10:00 (wall time, IST) → 04:30Z', at('2026-12-08T10:00') === Date.parse('2026-12-08T04:30:00Z'));
  check('2026-12-08T10:00:00+05:30 → 04:30Z', at('2026-12-08T10:00:00+05:30') === Date.parse('2026-12-08T04:30:00Z'));
  check('2026-12-08T10:00:00Z → 10:00Z', at('2026-12-08T10:00:00Z') === Date.parse('2026-12-08T10:00:00Z'));
  const ist = Date.parse('2026-10-28T18:30:00Z');
  check('IST midnight boundary: one second before → open, at midnight → started', !!at('2026-10-29') && at('2026-10-29') === ist);
}

console.log('\nWaitlist (sold-out retreats only; server-side validation, CSRF-aware session, rate limits):');
RETREATS.rt_soldout = { retreat_id: 'rt_soldout', start_date: istDate(40), seats_total: 10, seats_filled: 10, seats_remaining: 0 };
RETREATS.rt_open = { retreat_id: 'rt_open', start_date: istDate(40), seats_remaining: 3 };
RETREATS.rt_unknown = { retreat_id: 'rt_unknown', start_date: istDate(40) };
RETREATS.rt_error = 500;
let ipN = 0;
const freshIp = () => `203.0.113.${++ipN}`;
async function wl(id: string, body: unknown, opts: { host?: string; csrf?: boolean; headers?: Record<string, string>; raw?: string; ip?: string } = {}) {
  calls = [];
  const host = opts.host || PROD;
  asHost(host);
  const h: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-host': host, 'x-forwarded-for': opts.ip || freshIp(), ...(opts.headers || {}) };
  if (opts.csrf !== false) Object.assign(h, { cookie: `nostops_csrf=${CSRF}`, 'x-csrf-token': CSRF });
  const r = await waitlist.POST(new NextRequest(`http://localhost:3000/bff/retreats/${id}/waitlist`, { method: 'POST', headers: h, body: opts.raw ?? JSON.stringify(body) }), params(id));
  const d: any = await r.json().catch(() => null);
  return { status: r.status, d, posted: writes().filter((c) => c.url.endsWith(`/api/retreats/${id}/waitlist`)) };
}
const OK = { name: 'QA Waitlister', email: 'qa.wait@example.com', phone: '+91 98200 12345' };
const REFUSALS: [string, string, unknown, Parameters<typeof wl>[2], number, string][] = [
  ['not a retreat id', 'nope', OK, {}, 404, 'retreat_not_found'],
  ['retreat id with a path', 'rt_soldout..', OK, {}, 404, 'retreat_not_found'],
  ['browser says cross-site (Sec-Fetch-Site)', 'rt_soldout', OK, { headers: { 'sec-fetch-site': 'cross-site' } }, 403, 'cross_site'],
  ['not JSON (form post)', 'rt_soldout', OK, { headers: { 'content-type': 'application/x-www-form-urlencoded' } }, 415, 'json_required'],
  ['body over 2 KB', 'rt_soldout', { ...OK, notes: 'x'.repeat(3000) }, {}, 413, 'too_large'],
  ['unreadable body', 'rt_soldout', null, { raw: 'not json' }, 400, 'invalid_body'],
  ['a list', 'rt_soldout', null, { raw: '[]' }, 400, 'invalid_body'],
  ['no name', 'rt_soldout', { ...OK, name: '' }, {}, 400, 'invalid_name'],
  ['one-letter name', 'rt_soldout', { ...OK, name: 'Q' }, {}, 400, 'invalid_name'],
  ['name with a control character', 'rt_soldout', { ...OK, name: 'QA\u0007Bell' }, {}, 400, 'invalid_name'],
  ['name over 120 characters', 'rt_soldout', { ...OK, name: 'Q'.repeat(121) }, {}, 400, 'invalid_name'],
  ['email without a domain', 'rt_soldout', { ...OK, email: 'qa@example' }, {}, 400, 'invalid_email'],
  ['email with markup', 'rt_soldout', { ...OK, email: '<x>@example.com' }, {}, 400, 'invalid_email'],
  ['email as a list', 'rt_soldout', { ...OK, email: ['qa@example.com'] }, {}, 400, 'invalid_email'],
  ['phone with letters', 'rt_soldout', { ...OK, phone: 'call me' }, {}, 400, 'invalid_phone'],
  ['phone too short', 'rt_soldout', { ...OK, phone: '123' }, {}, 400, 'invalid_phone'],
  ['phone as a number', 'rt_soldout', { ...OK, phone: 9820012345 }, {}, 400, 'invalid_phone'],
  ['seats still available (existing rule)', 'rt_open', OK, {}, 409, 'seats_available'],
  ['seat count unknown', 'rt_unknown', OK, {}, 503, 'retreat_unavailable'],
  ['retreat lookup fails', 'rt_error', OK, {}, 503, 'retreat_unavailable'],
  ['retreat not found', 'rt_missing', OK, {}, 404, 'retreat_not_found'],
];
for (const [label, id, body, opts, status, reason] of REFUSALS) {
  const r = await wl(id, body, opts);
  check(`${label} → ${status} ${reason}, nobody added`, r.status === status && r.d?.reason === reason && r.posted.length === 0, [r.status, r.d?.reason, r.posted.length]);
}
{
  const r = await wl('rt_soldout', OK, { host: PREVIEW });
  check('sold out, valid, but PREVIEW → 423 (preview write guard), nobody added', r.status === 423 && r.d?.preview_read_only === true && r.posted.length === 0, [r.status, r.posted.length]);
}
{
  const r = await wl('rt_soldout', OK);
  const p = r.posted[0];
  check('sold out + valid + CSRF token (production host) → added once, with the visitor’s session', r.status === 200 && r.posted.length === 1 && p?.headers.authorization === 'Bearer qa_session_p2d', [r.status, r.posted.length, p?.headers.authorization]);
  check('…only name, email and digits-only phone are passed on', JSON.stringify(p?.body) === JSON.stringify({ name: 'QA Waitlister', email: 'qa.wait@example.com', phone: '+919820012345' }), p?.body);
}
{
  const r = await wl('rt_soldout', { ...OK, email: 'qa.anon@example.com', phone: '' }, { csrf: false });
  const p = r.posted[0];
  check('sold out + valid + NO CSRF token → added once WITHOUT any session (a forged request can’t act as an account)', r.status === 200 && r.posted.length === 1 && !p?.headers.authorization, [r.status, r.posted.length, p?.headers.authorization]);
}
{
  const email = 'qa.repeat@example.com';
  const a = await wl('rt_soldout', { ...OK, email });
  const b = await wl('rt_soldout', { ...OK, email });
  const c = await wl('rt_soldout', { ...OK, email });
  check('same email + retreat: 2 allowed per day, the 3rd → 429, not sent', a.status === 200 && b.status === 200 && c.status === 429 && c.d?.reason === 'rate_limited' && c.posted.length === 0, [a.status, b.status, c.status]);
  const ip = '198.51.100.77';
  const st: number[] = [];
  for (let i = 0; i < 6; i++) st.push((await wl('rt_open', { ...OK, email: `qa.ip${i}@example.com` }, { ip })).status);
  check('same IP: 5 tries per 10 minutes, the 6th → 429 before the retreat is even read', st.slice(0, 5).every((s) => s === 409) && st[5] === 429, st);
}

console.log(failures ? `\n\u2717 PREVIEW ISOLATION FAILED (${failures} of ${failures + passes})` : `\n\u2713 PREVIEW ISOLATION PASSED (${passes} checks)`);
process.exit(failures ? 1 : 0);
