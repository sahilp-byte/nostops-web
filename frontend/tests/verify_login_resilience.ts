// B5.1.1 — sign-in BFF resilience. Runs the REAL /bff/auth/login route handler
// in Node with a mocked backend `fetch` (no network, fixture credentials only).
// Run: node tests/verify_login_resilience.ts   (the slow-backend case waits for
// the real 10 s timeout, so the whole run takes ~11 s)
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
// LOGIN_ROUTE lets the same checks run against an older copy of the route (before/after evidence).
const { POST } = await import(process.env.LOGIN_ROUTE || '../app/bff/auth/login/route.ts');
const { NextRequest } = await import('next/server');

const CSRF = 'b511fixturecsrftoken0123456789ab';
const PASSWORD = 'fixture-password-123';
const TOKEN = 'fixture-session-token-abc';

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`  \u2713 ${name}`);
  else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}

type Upstream = (url: string, init: RequestInit) => Promise<Response>;
let calls = 0;
function mockBackend(impl: Upstream) {
  calls = 0;
  (globalThis as any).fetch = (url: string, init: RequestInit) => {
    calls++;
    return impl(String(url), init);
  };
}

function loginRequest(body: unknown, csrf: { cookie?: string; header?: string } = { cookie: CSRF, header: CSRF }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf.cookie) headers.cookie = `nostops_csrf=${csrf.cookie}`;
  if (csrf.header) headers['x-csrf-token'] = csrf.header;
  return new NextRequest('http://localhost:3000/bff/auth/login', { method: 'POST', headers, body: JSON.stringify(body) });
}

const creds = { email: 'fixture.teacher@example.test', password: PASSWORD };
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function run(name: string, impl: Upstream, req = loginRequest(creds)) {
  mockBackend(impl);
  const started = Date.now();
  const res: Response = await POST(req);
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { name, res, data, text, ms: Date.now() - started, cookie: res.headers.get('set-cookie') || '' };
}

function noLeak(r: { text: string; cookie: string }) {
  return !r.text.includes(PASSWORD) && !r.text.includes(TOKEN) && !r.text.toLowerCase().includes('session_token');
}

console.log('SIGN-IN BFF RESILIENCE:');

// 1. Successful sign-in is unchanged.
{
  const r = await run('success', async (url, init) => {
    const sent = JSON.parse(String(init.body));
    check('success: forwards to /api/auth/login with the same email + password', url.endsWith('/api/auth/login') && sent.email === creds.email && sent.password === PASSWORD, url);
    return json(200, { session_token: TOKEN, user: { user_id: 'user_fixture', role: 'teacher', email: creds.email } });
  });
  check('success: 200', r.res.status === 200, r.res.status);
  check('success: returns the user only', r.data?.user?.user_id === 'user_fixture' && !('session_token' in (r.data || {})), r.data);
  check('success: sets the httpOnly session cookie', /nostops_session=fixture-session-token-abc/.test(r.cookie) && /httponly/i.test(r.cookie) && /secure/i.test(r.cookie), r.cookie);
  check('success: exactly one backend call', calls === 1, calls);
}

// 2. Invalid credentials stay rejected with the backend's own 4xx message.
{
  const r = await run('invalid', async () => json(401, { detail: 'Invalid email or password' }));
  check('invalid: status 401 preserved', r.res.status === 401, r.res.status);
  check('invalid: backend message preserved', r.data?.error === 'Invalid email or password', r.data);
  check('invalid: no session cookie', !/nostops_session=/.test(r.cookie), r.cookie);
  const r2 = await run('validation', async () => json(422, { detail: [{ loc: ['body', 'email'], msg: 'value is not a valid email address' }] }));
  check('invalid: 422 preserved with readable message', r2.res.status === 422 && r2.data?.error === 'email: value is not a valid email address', r2.data);
}

// 3. Slow backend: the existing 10 s timeout fires → clear JSON 504, no crash.
{
  // AbortSignal.timeout() timers are unref'd in Node; keep this test process
  // alive while waiting (a running server always is).
  const keepAlive = setInterval(() => {}, 1000);
  const r = await run('slow', (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }),
  );
  clearInterval(keepAlive);
  check('slow: JSON 504 (not an unhandled 500)', r.res.status === 504 && typeof r.data?.error === 'string', { status: r.res.status, body: r.text.slice(0, 80) });
  check('slow: clear, actionable message', /taking longer than usual/i.test(r.data?.error || ''), r.data);
  check('slow: gave up at the existing ~10 s timeout', r.ms >= 9500 && r.ms < 12000, r.ms);
  check('slow: no session cookie (no false session)', !/nostops_session=/.test(r.cookie), r.cookie);
  check('slow: no automatic retry', calls === 1, calls);
  check('slow: no credential/token leak', noLeak(r));
}

// 4. Connection failure (DNS/refused/reset) → clear JSON 502.
{
  const r = await run('down', async () => {
    throw new TypeError('fetch failed');
  });
  check('down: JSON 502', r.res.status === 502 && typeof r.data?.error === 'string', r.res.status);
  check("down: clear message", /couldn't reach the sign-in service/i.test(r.data?.error || ''), r.data);
  check('down: no session cookie', !/nostops_session=/.test(r.cookie), r.cookie);
  check('down: no automatic retry', calls === 1, calls);
}

// 5. Backend / edge 5xx (incl. HTML error pages) → generic JSON, backend body not exposed.
for (const [status, expect] of [[500, 502], [503, 502], [520, 502], [504, 504], [524, 504]] as const) {
  const r = await run(`5xx-${status}`, async () =>
    new Response(`<!DOCTYPE html><title>${status}</title>internal-trace-xyz`, { status, headers: { 'content-type': 'text/html' } }),
  );
  check(`${status}: JSON ${expect}`, r.res.status === expect && /temporarily unavailable/i.test(r.data?.error || ''), { status: r.res.status, data: r.data });
  check(`${status}: backend body not exposed, no cookie`, !r.text.includes('internal-trace-xyz') && !/nostops_session=/.test(r.cookie));
}

// 6. A 200 reply WITHOUT a session token is not a sign-in.
{
  const r = await run('no-token', async () => json(200, { user: { user_id: 'user_fixture' } }));
  check('no-token: not reported as success (502)', r.res.status === 502, r.res.status);
  check('no-token: no session cookie', !/nostops_session=/.test(r.cookie), r.cookie);
}

// 7. CSRF double-submit + input validation still run BEFORE any backend call.
{
  const r1 = await run('csrf-missing', async () => json(200, {}), loginRequest(creds, { cookie: CSRF }));
  check('csrf: missing header → 403, backend not called', r1.res.status === 403 && r1.data?.error === 'invalid origin' && calls === 0, { s: r1.res.status, calls });
  const r2 = await run('csrf-mismatch', async () => json(200, {}), loginRequest(creds, { cookie: CSRF, header: CSRF.replace('b', 'c') }));
  check('csrf: mismatched header → 403, backend not called', r2.res.status === 403 && calls === 0, { s: r2.res.status, calls });
  const r3 = await run('csrf-none', async () => json(200, {}), loginRequest(creds, {}));
  check('csrf: no cookie/header → 403, backend not called', r3.res.status === 403 && calls === 0, { s: r3.res.status, calls });
  const r4 = await run('missing-fields', async () => json(200, {}), loginRequest({ email: creds.email }));
  check('input: missing password → 400, backend not called', r4.res.status === 400 && calls === 0, { s: r4.res.status, calls });
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll sign-in resilience checks passed.');
process.exit(failures ? 1 : 0);
