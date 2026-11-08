// Prompt 4D — venue AI-onboarding checkout DUAL LOCK (OFFLINE, nothing is written anywhere).
// Runs the REAL venue checkout + status BFF routes, the venue server helpers and the purchase
// component in plain Node. `fetch` is replaced by a recorder that never sends a request, and raw
// sockets are refused, so no local backend, main backend or payment provider can be reached.
// The environment values below are set in THIS process only (fake secret, fake backend URL).
// Run: node tests/verify_venue_checkout_gate.ts
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import net from 'node:net';

register('./alias-hooks.mjs', import.meta.url);
register('./server-only-hook.mjs', import.meta.url);
register('./tsx-hook.mjs', import.meta.url);

process.env.PULSE_SHARED_SECRET = 'p4d-offline-fake-secret';
process.env.PULSE_API_URL = 'http://p4d-local-backend.invalid';
process.env.VENUE_TIER2_PREVIEW = 'true';
delete process.env.FINANCIAL_ACTIONS_UNLOCKED;
delete process.env.FINANCIAL_UNLOCKED_FLOWS;
delete process.env.VENUE_CHECKOUT_ENABLED;

// ── network: every socket is refused; every fetch is recorded and answered by a mock ──
let socketAttempts = 0;
net.Socket.prototype.connect = function () {
  socketAttempts++;
  throw new Error('p4d: network refused in this test');
} as never;
type Call = { url: string; method: string };
let calls: Call[] = [];
let mockMode: { enabled: boolean; mode: string; sandbox: boolean; paypal?: unknown } = { enabled: false, mode: 'disabled', sandbox: false };
// Prompt 4F — what the mocked backend answers to create-order / paypal capture (null = refuse).
let mockCreate: Record<string, unknown> | null = null;
(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const u = String(url);
  calls.push({ url: u, method: String(init.method || 'GET').toUpperCase() });
  if (u.endsWith('/api/ai-onboarding/checkout-mode')) return new Response(JSON.stringify(mockMode), { status: 200 });
  if (u.includes('/api/ai-onboarding/status?')) {
    return new Response(JSON.stringify({ status: 'PAID', paid: true, venue_name: 'QA venue', mode: 'production' }), { status: 200 });
  }
  if (u.endsWith('/api/ai-onboarding/paypal/capture')) {
    return new Response(JSON.stringify({ status: 'COMPLETED', paid: true, venue_name: 'QA venue', mode: 'production' }), { status: 200 });
  }
  if (u.endsWith('/api/ai-onboarding/create-order') && mockCreate) return new Response(JSON.stringify(mockCreate), { status: 200 });
  // create-order (and anything else) is NOT created: the mock answers with a refusal.
  return new Response(JSON.stringify({ detail: 'p4d mock: no order is created in this test' }), { status: 599 });
};

const { NextRequest } = await import('next/server');
const flags = await import('../lib/server/flags.ts');
const venue = await import('../lib/server/venue-onboarding.ts');
const checkout = await import('../app/bff/venue-onboarding/checkout/route.ts');
const status = await import('../app/bff/venue-onboarding/status/route.ts');
const { VENUE_CHECKOUT_UNAVAILABLE_MESSAGE } = await import('../lib/payment-mode.ts');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { AiOnboardingPurchase } = await import('../components/venues/AiOnboardingPurchase.tsx');

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`  \u2713 ${name}`);
  else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}
function setEnv(lock: string | undefined, gate: string | undefined) {
  if (lock === undefined) delete process.env.FINANCIAL_ACTIONS_UNLOCKED;
  else process.env.FINANCIAL_ACTIONS_UNLOCKED = lock;
  if (gate === undefined) delete process.env.VENUE_CHECKOUT_ENABLED;
  else process.env.VENUE_CHECKOUT_ENABLED = gate;
}

const CSRF = 'p4dfixturecsrftoken0123456789abcd';
const BODY = { token: 'qa-p4d-edit-token-0001', phone: '9876543210', billing_country: 'IN' };
function post(body: unknown, host: string, csrf = true) {
  return new NextRequest('http://localhost:3000/bff/venue-onboarding/checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(csrf ? { cookie: `nostops_csrf=${CSRF}`, 'x-csrf-token': CSRF } : {}),
      host,
      'x-forwarded-host': host,
    },
    body: JSON.stringify(body),
  });
}
const PROD = 'www.nostops.org';
const PREVIEW = 'qa-p4d.preview.emergentagent.com';
const MALFORMED = ['', 'false', 'FALSE', 'TRUE', 'True', ' true', 'true ', '1', 'yes', 'on', '"true"', 'true\n'];

console.log('1. The VENUE_CHECKOUT_ENABLED gate opens only for exactly "true"');
setEnv(undefined, undefined);
check('missing → closed', flags.venueCheckoutEnabled() === false);
for (const v of MALFORMED) {
  process.env.VENUE_CHECKOUT_ENABLED = v;
  check(`${JSON.stringify(v)} → closed`, flags.venueCheckoutEnabled() === false);
}
process.env.VENUE_CHECKOUT_ENABLED = 'true';
check('"true" → open', flags.venueCheckoutEnabled() === true);

console.log('2. Both controls are required (money lock checked first)');
setEnv(undefined, 'true');
check('lock absent + gate open → financial_lock', venue.venueCheckoutClosedReason() === 'financial_lock');
setEnv('TRUE', 'true');
check('lock "TRUE" (not exact) + gate open → financial_lock', venue.venueCheckoutClosedReason() === 'financial_lock');
setEnv('true', undefined);
check('lock lifted + gate missing → checkout_gate_closed', venue.venueCheckoutClosedReason() === 'checkout_gate_closed');
setEnv('true', 'false');
check('lock lifted + gate "false" → checkout_gate_closed', venue.venueCheckoutClosedReason() === 'checkout_gate_closed');
setEnv('true', 'true');
check('both open → null (only then)', venue.venueCheckoutClosedReason() === null);

console.log('3. Checkout route: refusals happen before any downstream call');
for (const host of [PROD, PREVIEW]) {
  setEnv(undefined, undefined);
  calls = [];
  let r = await checkout.POST(post(BODY, host));
  let d = await r.json();
  check(`[${host}] lock active → 423 financial-lock response`, r.status === 423 && d.financial_lock === true, { s: r.status, d });
  check(`[${host}] lock active → 0 fetch calls`, calls.length === 0, calls);

  setEnv(undefined, 'true');
  calls = [];
  r = await checkout.POST(post(BODY, host));
  check(`[${host}] lock active + gate open → still 423`, r.status === 423 && calls.length === 0, { s: r.status, calls });

  setEnv('true', undefined);
  calls = [];
  r = await checkout.POST(post(BODY, host));
  d = await r.json();
  check(`[${host}] lock lifted + gate missing → 503 unavailable`, r.status === 503 && d.checkout_unavailable === true
    && d.reason === 'checkout_gate_closed' && d.error === VENUE_CHECKOUT_UNAVAILABLE_MESSAGE, { s: r.status, d });
  check(`[${host}] gate missing → 0 fetch calls`, calls.length === 0, calls);
  for (const v of MALFORMED) {
    setEnv('true', v);
    calls = [];
    r = await checkout.POST(post(BODY, host));
    if (!(r.status === 503 && calls.length === 0)) check(`[${host}] gate ${JSON.stringify(v)} → 503, 0 calls`, false, { s: r.status, calls });
  }
  check(`[${host}] every malformed gate value → 503 with 0 fetch calls`, true);
}
setEnv(undefined, undefined);
calls = [];
let r0 = await checkout.POST(post(BODY, PROD, false));
check('CSRF preserved: missing CSRF token → 403 (before the lock)', r0.status === 403 && calls.length === 0, { s: r0.status });
process.env.VENUE_TIER2_PREVIEW = 'false';
r0 = await checkout.POST(post(BODY, PROD));
check('feature flag preserved: flag off → 404', r0.status === 404 && calls.length === 0, { s: r0.status });
process.env.VENUE_TIER2_PREVIEW = 'true';

console.log('4. Both controls open (mocked): control flow only, no order is created');
setEnv('true', 'true');
mockMode = { enabled: true, mode: 'production', sandbox: false };
calls = [];
let r = await checkout.POST(post(BODY, PROD));
check('production host → passes both gates, reaches checkout-mode then create-order (mock refuses)',
  calls.length === 2 && calls[0].url.endsWith('/api/ai-onboarding/checkout-mode') && calls[1].url.endsWith('/api/ai-onboarding/create-order')
  && r.status === 599, { s: r.status, calls });
check('no request left this process (all answered by the mock)', calls.every((c) => c.url.startsWith('http://p4d-local-backend.invalid/')), calls);
mockMode = { enabled: false, mode: 'disabled', sandbox: false };
calls = [];
r = await checkout.POST(post(BODY, PREVIEW));
check('preview host → existing preview guard still refuses (503), create-order never asked',
  r.status === 503 && calls.length === 1 && calls[0].url.endsWith('/checkout-mode'), { s: r.status, calls });
mockMode = { enabled: false, mode: 'disabled', sandbox: false };
calls = [];
r = await checkout.POST(post({ ...BODY, billing_country: 'US' }, PROD));
let dIntl = await r.json();
check('international buyer, PayPal not available → 503 provider_unavailable, create-order never asked',
  r.status === 503 && dIntl.provider_unavailable === true && calls.length === 1 && calls[0].url.endsWith('/checkout-mode'), { s: r.status, calls });

console.log('5. checkoutMode() reports the correct reason; closed → no backend call');
setEnv(undefined, undefined);
calls = [];
let m = await venue.checkoutMode(PROD);
check('lock active → disabled, reason financial_lock, 0 calls', !m.enabled && m.mode === 'disabled' && m.reason === 'financial_lock' && calls.length === 0, { m, calls });
setEnv('true', 'nope');
calls = [];
m = await venue.checkoutMode(PROD);
check('gate closed → disabled, reason checkout_gate_closed, 0 calls', !m.enabled && m.reason === 'checkout_gate_closed' && calls.length === 0, { m, calls });
setEnv('true', 'true');
mockMode = { enabled: true, mode: 'production', sandbox: false };
calls = [];
m = await venue.checkoutMode(PROD);
check('both open + backend allows (mock) → enabled, reason null, 1 call', m.enabled && m.reason === null && calls.length === 1, { m, calls });
mockMode = { enabled: false, mode: 'disabled', sandbox: false };
m = await venue.checkoutMode(PREVIEW);
check('both open + backend refuses (mock) → disabled, reason not_available', !m.enabled && m.reason === 'not_available', m);

console.log('6. createOnboardingLink() refuses on its own (second layer)');
for (const [lock, gate, code] of [[undefined, undefined, 423], [undefined, 'true', 423], ['true', undefined, 503], ['true', 'false', 503]] as const) {
  setEnv(lock, gate);
  calls = [];
  const res = await venue.createOnboardingLink({ ...BODY, region: 'IN' }, PROD);
  check(`lock=${lock ?? 'absent'} gate=${gate ?? 'absent'} → ${code}, 0 calls`, !res.ok && res.status === code && calls.length === 0, { res, calls });
}

console.log('7. Status reads for EXISTING orders are not disabled by the new-order gate');
setEnv(undefined, undefined);
calls = [];
const sr = await status.GET(new NextRequest('http://localhost:3000/bff/venue-onboarding/status?order_id=vob_qap4d000001', { headers: { host: PROD } }));
const sd = await sr.json();
check('both controls closed → status route still asks the backend (1 call) and relays its answer', sr.status === 200 && sd.paid === true
  && calls.length === 1 && calls[0].url.includes('/api/ai-onboarding/status?order_id=vob_qap4d000001'), { s: sr.status, sd, calls });
calls = [];
const bad = await status.GET(new NextRequest('http://localhost:3000/bff/venue-onboarding/status?order_id=../create-order', { headers: { host: PROD } }));
check('status route still rejects a malformed order id (400, 0 calls)', bad.status === 400 && calls.length === 0, { s: bad.status });

console.log('8. Purchase panel (rendered offline)');
const V = { venueName: 'QA Venue', city: 'Pune', emailHint: 'qa**@example.invalid', hasPhone: true, active: false };
const closedHtml = renderToStaticMarkup(createElement(AiOnboardingPurchase, { token: 'qa-p4d-edit-token-0001', venue: V, checkoutAvailable: false }));
const msgHtml = VENUE_CHECKOUT_UNAVAILABLE_MESSAGE.replace(/'/g, '&#x27;');
const payBtn = (html: string) => (html.match(/<button[^>]*data-testid="ai-onboarding-pay"[^>]*>[^<]*<\/button>/) || [''])[0];
check('closed → shows the approved message', closedHtml.includes('data-testid="ai-onboarding-checkout-unavailable"') && closedHtml.includes(msgHtml));
check('closed → Pay button disabled and says "Checkout unavailable"', /disabled=""/.test(payBtn(closedHtml)) && payBtn(closedHtml).includes('Checkout unavailable'), payBtn(closedHtml));
check('closed → no "Secure checkout by Cashfree" promise', !closedHtml.includes('ai-onboarding-cashfree-note'));
const defaultHtml = renderToStaticMarkup(createElement(AiOnboardingPurchase, { token: 'qa-p4d-edit-token-0001', venue: V }));
check('prop omitted → treated as closed (fail closed)', defaultHtml.includes(msgHtml) && /disabled=""/.test(payBtn(defaultHtml)));
const openHtml = renderToStaticMarkup(createElement(AiOnboardingPurchase, { token: 'qa-p4d-edit-token-0001', venue: V, checkoutAvailable: true }));
check('open → no unavailable message (button still waits for a billing country)', !openHtml.includes(msgHtml) && payBtn(openHtml).includes('Select your billing country'));
const activeHtml = renderToStaticMarkup(createElement(AiOnboardingPurchase, { token: 't', venue: { ...V, active: true }, checkoutAvailable: false }));
check('already-unlocked venue → unchanged "Already unlocked" panel', activeHtml.includes('data-testid="ai-onboarding-active"') && !activeHtml.includes(msgHtml));
const noVenueHtml = renderToStaticMarkup(createElement(AiOnboardingPurchase, { checkoutAvailable: false }));
check('no venue link → unchanged free-listing guidance', noVenueHtml.includes('data-testid="ai-onboarding-list-free"'));

console.log('9. Source order (static)');
const routeSrc = readFileSync(new URL('../app/bff/venue-onboarding/checkout/route.ts', import.meta.url), 'utf8');
const at = (s: string) => routeSrc.indexOf(s);
check('route: CSRF → lock → gate → body → checkoutMode → createOnboardingLink',
  at('badOrigin(req)') < at('financialLockedJson(VENUE_FLOW)') && at('financialLockedJson(VENUE_FLOW)') < at('venueCheckoutClosedReason()')
  && at('venueCheckoutClosedReason()') < at('await req.json()') && at('await req.json()') < at('await checkoutMode(')
  && at('await checkoutMode(') < at('await createOnboardingLink('));
const compSrc = readFileSync(new URL('../components/venues/AiOnboardingPurchase.tsx', import.meta.url), 'utf8');
const payFn = compSrc.slice(compSrc.indexOf('async function pay()'));
check('component: pay() returns before postBff when unavailable', payFn.indexOf('if (!available) return;') > 0
  && payFn.indexOf('if (!available) return;') < payFn.indexOf('postBff'));
const pageSrc = readFileSync(new URL('../app/(public)/venues/ai-onboarding/page.tsx', import.meta.url), 'utf8');
check('page: passes the server answer (checkoutAvailable={mode.enabled})', pageSrc.includes('checkoutAvailable={mode.enabled}'));
check('page: passes the PayPal answer (intlAvailable={mode.paypal.enabled})', pageSrc.includes('intlAvailable={mode.paypal.enabled}'));

console.log('9b. Prompt 4F — per-checkout unlock + PayPal (international)');
const lock = await import('../lib/server/financial-lock.ts');
const capture = await import('../app/bff/venue-onboarding/paypal-capture/route.ts');
setEnv(undefined, 'true');
process.env.FINANCIAL_UNLOCKED_FLOWS = 'venue_ai_onboarding';
check('venue checkout unlocked on its own → gate open, global money lock still ON',
  venue.venueCheckoutClosedReason() === null && lock.financialActionsLocked() === true);
check('other checkouts stay locked (event_fee, one_on_one)', !lock.financialFlowUnlocked('event_fee') && !lock.financialFlowUnlocked('one_on_one'));
for (const v of ['', 'VENUE_AI_ONBOARDING', 'venue', '*', 'true']) {
  process.env.FINANCIAL_UNLOCKED_FLOWS = v;
  if (venue.venueCheckoutClosedReason() !== 'financial_lock') check(`FINANCIAL_UNLOCKED_FLOWS=${JSON.stringify(v)} → closed`, false);
}
check('any other FINANCIAL_UNLOCKED_FLOWS value keeps the venue checkout closed', true);
process.env.FINANCIAL_UNLOCKED_FLOWS = 'venue_ai_onboarding';
const LIVE_PP = { enabled: true, mode: 'production', sandbox: false };
mockMode = { enabled: false, mode: 'disabled', sandbox: false, paypal: LIVE_PP };
mockCreate = { provider: 'paypal', order_id: 'vob_qap4f000000000001', mode: 'production', amount: 30, currency: 'USD',
  approve_url: 'https://www.paypal.com/checkoutnow?token=PPQA1' };
calls = [];
r = await checkout.POST(post({ ...BODY, billing_country: 'US' }, PROD));
let dpp = await r.json();
check('international buyer + PayPal live (mock) → 200 with PayPal approval link, no Cashfree session',
  r.status === 200 && dpp.provider === 'paypal' && dpp.approve_url === mockCreate.approve_url && !dpp.payment_session_id
  && calls.length === 2 && calls[1].url.endsWith('/create-order'), { s: r.status, dpp, calls });
mockCreate = { ...mockCreate, approve_url: 'https://www.paypal.com.evil.example/checkoutnow?token=PPQA1' };
r = await checkout.POST(post({ ...BODY, billing_country: 'US' }, PROD));
check('approval link not on www.paypal.com → refused (503)', r.status === 503);
mockCreate = { ...mockCreate, approve_url: 'https://www.sandbox.paypal.com/checkoutnow?token=PPQA1' };
r = await checkout.POST(post({ ...BODY, billing_country: 'US' }, PROD));
check('sandbox approval link on the production site → refused (503)', r.status === 503);
mockCreate = { ...mockCreate, mode: 'sandbox' };
r = await checkout.POST(post({ ...BODY, billing_country: 'US' }, PROD));
check('sandbox order on the production site → refused (503)', r.status === 503);
mockMode = { enabled: false, mode: 'disabled', sandbox: false, paypal: LIVE_PP };
calls = [];
r = await checkout.POST(post({ ...BODY, billing_country: 'US' }, PREVIEW));
check('preview host with live PayPal → preview guard refuses (503), create-order never asked',
  r.status === 503 && !calls.some((c) => c.url.endsWith('/create-order')), { s: r.status, calls });
mockCreate = null;
const capReq = (host: string, body: unknown = { order_id: 'vob_qap4f000000000001' }, csrf = true) => new NextRequest('http://localhost:3000/bff/venue-onboarding/paypal-capture', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(csrf ? { cookie: `nostops_csrf=${CSRF}`, 'x-csrf-token': CSRF } : {}), host, 'x-forwarded-host': host },
  body: JSON.stringify(body),
});
calls = [];
let cr = await capture.POST(capReq(PROD, undefined, false));
check('capture: missing CSRF → 403, 0 calls', cr.status === 403 && calls.length === 0);
delete process.env.FINANCIAL_UNLOCKED_FLOWS;
cr = await capture.POST(capReq(PROD));
check('capture: venue checkout locked → 423, 0 calls', cr.status === 423 && calls.length === 0);
process.env.FINANCIAL_UNLOCKED_FLOWS = 'venue_ai_onboarding';
process.env.VENUE_CHECKOUT_ENABLED = 'false';
cr = await capture.POST(capReq(PROD));
check('capture: venue gate closed → 503, 0 calls', cr.status === 503 && calls.length === 0);
process.env.VENUE_CHECKOUT_ENABLED = 'true';
cr = await capture.POST(capReq(PROD, { order_id: '../status' }));
check('capture: malformed order id → 400, 0 calls', cr.status === 400 && calls.length === 0);
cr = await capture.POST(capReq(PROD));
const cd = await cr.json();
check('capture: open → asks the backend once and relays a safe answer', cr.status === 200 && cd.paid === true
  && calls.length === 1 && calls[0].url.endsWith('/api/ai-onboarding/paypal/capture'), { s: cr.status, cd, calls });
const intlHtml = renderToStaticMarkup(createElement(AiOnboardingPurchase, { token: 'qa-p4f-edit-token-0001', venue: V, checkoutAvailable: false, intlAvailable: true }));
check('panel: PayPal available → no "temporarily unavailable" price note', !intlHtml.includes('international checkout temporarily unavailable'));
check('panel: PayPal not available → says so', closedHtml.includes('international checkout temporarily unavailable'));
delete process.env.FINANCIAL_UNLOCKED_FLOWS;
setEnv(undefined, undefined);

console.log('10. Network');
check('0 socket connections attempted', socketAttempts === 0, socketAttempts);

console.log(failures ? `\nFAILED: ${failures} check(s)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
