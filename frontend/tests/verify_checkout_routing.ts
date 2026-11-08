// Payments Prompt 2B — the six website checkouts route by billing country SERVER-SIDE.
// Runs the REAL BFF route handlers in Node. The routing policy is the real local one
// (backend/payment_routing.py at PULSE_API_URL); every other network call is intercepted
// and fails the test, so no order, provider or main-backend call can happen.
// Run: node tests/verify_checkout_routing.ts   (needs the local backend running)
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
register('./server-only-hook.mjs', import.meta.url);

// The BFF reads these at import time (same values the Next server uses).
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^(PULSE_SHARED_SECRET|PULSE_API_URL)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { NextRequest } = await import('next/server');
const orders = await import('../app/bff/payments/cashfree/orders/route.ts');
const participant = await import('../app/bff/institutional/participant/payment/order/route.ts');
const retreat = await import('../app/bff/retreats/[id]/reservations/[rid]/pay/route.ts');
const fastTrack = await import('../app/bff/teacher/empanelment/fast-track/[...action]/route.ts');
const invite = await import('../app/bff/booking-invite/[token]/[action]/route.ts');
const pricing = await import('../lib/pricing.ts');
const offers = await import('../lib/offers.ts');

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`  \u2713 ${name}`);
  else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}

// ── network: the routing policy is real; anything else is recorded and refused ──
const realFetch = globalThis.fetch;
let policyMode: 'real' | 'down' | 'tampered' = 'real';
let policyCalls = 0;
let otherCalls: string[] = [];
(globalThis as any).fetch = async (url: string, init: RequestInit) => {
  const u = String(url);
  if (u.includes('/api/payment-routing/decide')) {
    policyCalls++;
    if (policyMode === 'down') throw new TypeError('fetch failed (policy unreachable, mock)');
    if (policyMode === 'tampered') {
      return new Response(JSON.stringify({ allowed: true, provider: 'paypal', currency: 'USD', billing_country: 'US' }), { status: 200 });
    }
    return realFetch(u, init);
  }
  otherCalls.push(u);
  return new Response(JSON.stringify({ detail: 'test: no network beyond the routing policy' }), { status: 599 });
};

const CSRF = 'p2bfixturecsrftoken0123456789abcd';
const PREVIEW_HOST = 'qa-p2b.preview.emergentagent.com'; // a test host: an allowed order stops at the preview guard
function req(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `nostops_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      'x-forwarded-host': PREVIEW_HOST,
    },
    body: JSON.stringify(body),
  });
}

type Journey = { name: string; base: Record<string, unknown>; call: (body: unknown) => Promise<Response> };
const JOURNEYS: Journey[] = [
  { name: '1:1 session', base: { orderType: 'one_on_one', referenceId: 'bk_qa_p2b' }, call: (b) => orders.POST(req('/bff/payments/cashfree/orders', b)) },
  { name: 'event fee', base: { registration_id: 'reg_qa_p2b' }, call: (b) => participant.POST(req('/bff/institutional/participant/payment/order', b)) },
  {
    name: 'retreat seat',
    base: {},
    call: (b) => retreat.POST(req('/bff/retreats/rt_qa/reservations/rs_qa/pay', b), { params: Promise.resolve({ id: 'rt_qa', rid: 'rs_qa' }) }),
  },
  {
    name: 'Fast-Track',
    base: {},
    call: (b) => fastTrack.POST(req('/bff/teacher/empanelment/fast-track/ftr_qa_p2b/cashfree-order', b), { params: Promise.resolve({ action: ['ftr_qa_p2b', 'cashfree-order'] }) }),
  },
  {
    // The application step creates the paid request upstream, so it is routed and guarded too.
    name: 'Fast-Track application (initiate)',
    base: { experience_years: 5, specializations: ['Hatha'], motivation: 'QA P2B fixture, never sent upstream', phone: '+910000000000' },
    call: (b) => fastTrack.POST(req('/bff/teacher/empanelment/fast-track/initiate', b), { params: Promise.resolve({ action: ['initiate'] }) }),
  },
  { name: 'InstaKYC', base: { orderType: 'instakyc' }, call: (b) => orders.POST(req('/bff/payments/cashfree/orders', b)) },
  {
    name: 'group invitation',
    base: { email: 'qa.p2b@example.com' },
    call: (b) => invite.POST(req('/bff/booking-invite/tokqa1234/cashfree-order', b), { params: Promise.resolve({ token: 'tokqa1234', action: 'cashfree-order' }) }),
  },
];

const CASES: { label: string; extra: Record<string, unknown>; status: number; reason?: string }[] = [
  { label: 'missing billing country', extra: {}, status: 400, reason: 'billing_country_required' },
  { label: 'empty billing country', extra: { billing_country: '  ' }, status: 400, reason: 'billing_country_required' },
  { label: 'invalid billing country (name)', extra: { billing_country: 'India' }, status: 400, reason: 'billing_country_invalid' },
  { label: 'invalid billing country (code)', extra: { billing_country: 'XX' }, status: 400, reason: 'billing_country_invalid' },
  { label: 'non-text billing country', extra: { billing_country: 91 }, status: 400, reason: 'billing_country_invalid' },
  { label: 'billing country as a list', extra: { billing_country: ['IN'] }, status: 400, reason: 'billing_country_invalid' },
  { label: 'billing country as an object', extra: { billing_country: { code: 'IN' } }, status: 400, reason: 'billing_country_invalid' },
  { label: 'India + numeric currency', extra: { billing_country: 'IN', currency: 840 }, status: 400, reason: 'currency_invalid' },
  { label: 'India + currency as a list', extra: { billing_country: 'IN', currency: ['INR'] }, status: 400, reason: 'currency_invalid' },
  { label: 'India + provider as a list', extra: { billing_country: 'IN', provider: ['cashfree'] }, status: 400, reason: 'provider_invalid' },
  { label: 'India + USD', extra: { billing_country: 'IN', currency: 'USD' }, status: 422, reason: 'currency_not_supported' },
  { label: 'India + PayPal', extra: { billing_country: 'IN', provider: 'paypal' }, status: 422, reason: 'provider_conflict' },
  { label: 'India + unknown provider', extra: { billing_country: 'IN', provider: 'stripe' }, status: 400, reason: 'provider_invalid' },
  { label: 'outside India (no USD price)', extra: { billing_country: 'US' }, status: 422, reason: 'international_not_offered' },
  { label: 'outside India + INR + Cashfree', extra: { billing_country: 'GB', currency: 'INR', provider: 'cashfree' }, status: 422, reason: 'provider_conflict' },
  { label: 'outside India + USD + PayPal', extra: { billing_country: 'US', currency: 'USD', provider: 'paypal' }, status: 422, reason: 'international_not_offered' },
  { label: 'invalid currency', extra: { billing_country: 'IN', currency: 'RUPEE' }, status: 400, reason: 'currency_invalid' },
];

console.log('CHECKOUT ROUTING (real BFF handlers, real routing policy, no other network):');
for (const j of JOURNEYS) {
  console.log(`\n${j.name}:`);
  for (const c of CASES) {
    otherCalls = [];
    policyCalls = 0;
    const res = await j.call({ ...j.base, ...c.extra });
    const data: any = await res.json().catch(() => null);
    check(`${c.label} → ${c.status} ${c.reason}`, res.status === c.status && data?.reason === c.reason && data?.routing_refused === true, [res.status, data?.reason]);
    check(`${c.label}: refused before anything else is called`, otherCalls.length === 0 && policyCalls === 1, otherCalls);
  }
  // India → Cashfree, INR: the policy allows it, and the next gate (preview test mode) stops it.
  otherCalls = [];
  policyCalls = 0;
  for (const extra of [{ billing_country: 'IN' }, { billing_country: 'in', currency: 'INR', provider: 'cashfree' }]) {
    const res = await j.call({ ...j.base, ...extra });
    const data: any = await res.json().catch(() => null);
    check(`India ${JSON.stringify(extra)} passes routing, then the preview guard stops it (503)`, res.status === 503 && data?.payments_disabled === true, [res.status, data]);
  }
  check('India: no order, provider or main-backend call', otherCalls.length === 0, otherCalls);

  policyMode = 'down';
  otherCalls = [];
  const down = await j.call({ ...j.base, billing_country: 'IN' });
  check('policy unreachable → 503, fail closed', down.status === 503 && otherCalls.length === 0, down.status);
  policyMode = 'tampered';
  const bad = await j.call({ ...j.base, billing_country: 'US' });
  const badData: any = await bad.json().catch(() => null);
  check('a non-Cashfree answer never becomes a Cashfree order → 503', bad.status === 503 && badData?.routing_refused === true && otherCalls.length === 0, bad.status);
  policyMode = 'real';
}

console.log('\nFast-Track application (initiate) — bodies that bypass the form:');
{
  const initiateReq = (raw: string) =>
    new NextRequest('http://localhost:3000/bff/teacher/empanelment/fast-track/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `nostops_csrf=${CSRF}`, 'x-csrf-token': CSRF, 'x-forwarded-host': PREVIEW_HOST },
      body: raw,
    });
  for (const raw of ['not json', 'null', '[]', '"IN"', '{"billing_country":null}']) {
    otherCalls = [];
    const res = await fastTrack.POST(initiateReq(raw), { params: Promise.resolve({ action: ['initiate'] }) });
    const data: any = await res.json().catch(() => null);
    check(`body ${raw} → 400 billing_country_required, nothing sent upstream`, res.status === 400 && data?.reason === 'billing_country_required' && otherCalls.length === 0, [res.status, data?.reason, otherCalls]);
  }
  otherCalls = [];
  const noCsrf = await fastTrack.POST(
    new NextRequest('http://localhost:3000/bff/teacher/empanelment/fast-track/initiate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-host': PREVIEW_HOST }, body: '{"billing_country":"IN"}' }),
    { params: Promise.resolve({ action: ['initiate'] }) },
  );
  check('without the CSRF token → 403, nothing sent upstream', noCsrf.status === 403 && otherCalls.length === 0, noCsrf.status);
  // Unchanged non-payment actions are not routed (phone OTP never needs a billing country).
  policyCalls = 0;
  otherCalls = [];
  await fastTrack.POST(req('/bff/teacher/empanelment/fast-track/phone/start', { phone: '+910000000000' }), { params: Promise.resolve({ action: ['phone', 'start'] }) }).catch(() => null);
  check('phone OTP step is not sent to the routing policy', policyCalls === 0, policyCalls);
}

console.log('\nExisting rules still run first (unchanged):');
{
  otherCalls = [];
  const wallet = await orders.POST(req('/bff/payments/cashfree/orders', { orderType: 'wallet_topup', amount: 500, billing_country: 'IN' }));
  check('wallet top-up is refused by the money lock (423)', wallet.status === 423, wallet.status);
  const tampered = await orders.POST(req('/bff/payments/cashfree/orders', { orderType: 'instakyc', amount: 1, billing_country: 'IN' }));
  check('InstaKYC with a changed amount is refused (400)', tampered.status === 400, tampered.status);
  const noRef = await orders.POST(req('/bff/payments/cashfree/orders', { orderType: 'one_on_one', billing_country: 'IN' }));
  check('1:1 without a booking reference is refused (400)', noRef.status === 400, noRef.status);
  const unknown = await orders.POST(req('/bff/payments/cashfree/orders', { orderType: 'mystery', billing_country: 'IN' }));
  check('an unknown offer is refused (400)', unknown.status === 400, unknown.status);
  check('none of these reached the network', otherCalls.length === 0, otherCalls);
}

console.log('\nPrices unchanged; group tiers are reference only (Prompt 3C):');
{
  const tiers = [{ min_seats: 5, discount_pct: 10 }, { min_seats: 10, discount_pct: 15 }];
  // Unapproved tiers passed by an old caller are ignored: no group price is worked out from them.
  const g5 = pricing.resolveBooking({ standardInr: 12000, groupSize: 5, groupTiers: tiers, minGroupSize: 5 } as any);
  // Only a verified per-retreat group rate is used (none exists today).
  const v10 = pricing.resolveBooking({ standardInr: 12000, groupSize: 10, minGroupSize: 5, verifiedGroupPerSeatInr: 10200 });
  // Prompt 3C: a host-listed early-bird offer is ignored (old callers' extra field has no effect).
  const eb = pricing.resolveBooking({ standardInr: 12000, groupSize: 1, earlyBird: { amount: 10000, until: '2026-12-31' } } as any);
  check('unapproved tiers ignored → listed ₹12,000/seat, ₹60,000', g5.applied === 'standard' && g5.perSeatInr === 12000 && g5.totalInr === 60000 && g5.candidates.length === 1, [g5.applied, g5.perSeatInr, g5.totalInr]);
  check('verified group rate → ₹10,200/seat, ₹1,02,000', v10.applied === 'group' && v10.perSeatInr === 10200 && v10.totalInr === 102000, [v10.applied, v10.perSeatInr, v10.totalInr]);
  check('early-bird offer ignored → listed price ₹12,000', eb.applied === 'standard' && eb.perSeatInr === 12000, [eb.applied, eb.perSeatInr]);
  const kyc = offers.resolveCheckoutAmount('instakyc', undefined);
  check('InstaKYC price ₹279 (server-side)', kyc.ok === true && kyc.amount === 279 && pricing.INSTAKYC_PRICE_INR === 279, kyc);
  const one = offers.checkBookingAmount(1500, 1500);
  check('1:1 amount comes from the booking', one.ok === true && one.amount === 1500, one);
}

console.log(failures ? `\n\u2717 CHECKOUT ROUTING FAILED (${failures})` : '\n\u2713 CHECKOUT ROUTING PASSED');
process.exit(failures ? 1 : 0);
