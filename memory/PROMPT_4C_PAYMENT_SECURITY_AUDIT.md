# Prompt 4C: payment security, webhook and backend exposure audit (read-only)

**Date:** 29 Oct 2026 (container clock). **Environment:** preview workspace only.
**Status:** audit complete. **Stopped for your review.** Nothing was implemented. Prompt 4D and Prompt 5 have not started.
- **Money lock:** ON. `FINANCIAL_ACTIONS_UNLOCKED` is absent from both `.env` files, from the app's secrets store and from the environment of the running website processes (names checked only).
- **Checkout:** off in preview (see §8 for exactly what keeps it off).
- **Tests:** none were run (your choice: read the code only).

**Confidence labels used throughout:**
- **[VS] VERIFIED FROM SOURCE**: directly supported by code, configuration names or saved documents in this workspace, read during this audit.
- **[RP] REPORTED BY PRIOR AUDIT**: stated in an earlier report and not re-established here.
- **[INF] INFERRED**: a reasonable conclusion or concern that the evidence does not prove.
- **[UNV] UNVERIFIED**: needs authorised access or evidence this workspace doesn't have.

When something is described in the main backend's **own saved API documentation** (`backend/tests/fixtures/main_backend_openapi_2026-10.json`, saved 26 Oct), the report says "documented upstream". That proves **only** that the documentation says so [VS]. The behaviour itself stays **[UNV]**, because the main backend's code is not in this workspace.

---

## 1. Executive summary

1. **The Prompt 4B containment is intact in the current source.** [VS]
   - The five payment actions, the payout and settlement initiation actions and the legacy Razorpay InstaKYC confirmation are refused, by the gateway and by the website server.
   - The 22 lock rules are identical in both copies: same order, ids, kinds, methods and patterns (static text comparison, §3.1).
   - No payment-related source file has changed since the 4B commit (`6dd781a3`). The 4B regression log (2,139 passed, 12 skipped) was written after the last source edit. Those test results themselves are **[RP]**; nothing was re-run.
2. **The website gateway is not a complete security boundary.**
   - The main backend `pro-learn-connect-1` is a public HTTPS service. Earlier audits called it directly [RP].
   - The website holds **no service credential** for it [VS]. It calls either as the signed-in user (bearer token kept server-side) or anonymously.
   - The main backend therefore can't tell website traffic from a direct call [INF]. Every website rule (the five actions, ALWAYS payout denial, Razorpay confirm lock, billing-country routing) can be bypassed by calling the main backend directly.
3. **Four main-backend risks are rated P0.** All are main-backend issues and none can be fixed from this workspace (§10):
   - **P0-1:** the main backend is directly reachable, and its own money freeze (FS-00) was confirmed on only 9 routes (26 Oct) [RP].
   - **P0-2:** its Cashfree order creation takes the **amount** from the caller. This was observed live for InstaKYC in September [RP]. The website's paid-event order is created with **no sign-in token** [VS], which suggests order creation may not require authentication [INF].
   - **P0-3:** its own PayPal notification route accepts **unsigned** events when its webhook ID is unset (documented upstream [VS]; configuration [UNV]).
   - **P0-4:** payout and withdrawal capability still exists upstream. Website denial does not cover direct calls.
4. **Cashfree notifications.**
   - **The website's own venue-onboarding webhook** is well built [VS]:
     - HMAC check over timestamp + raw body, compared in constant time;
     - replay window;
     - de-duplication;
     - an authoritative re-read of the order from Cashfree, with id, amount and currency matched;
     - idempotent fulfilment.

     It has never run against a real Cashfree sandbox [RP: 8 sandbox tests skipped, no sandbox keys]. One hardening gap: the de-duplication key can come from an **unsigned** header (§5, P2).
   - **The main backend's two Cashfree webhooks** are checked by the gateway only for the **presence** of signature headers [VS]. Everything else is documented upstream only [UNV].
   - **Paid institutional events have no notification or reconciler**: they confirm only through the return page [VS].
5. **PayPal: no checkout exists on the website** [VS]. There is no order or capture code, no PayPal setting anywhere and no approved USD price [VS].
   - Website-side capture is refused twice: by the lock, and by routing independently of the lock [VS].
   - The gateway's PayPal notification handler uses PayPal's documented verify-signature API. It is inert (503) because nothing is configured [VS].
6. **Remaining payout and settlement routes stay under the temporary lock only** [VS].
   - Several are **mixed or potentially mutating**:
     - `GET admin/payouts/list` runs the sweep (documented upstream);
     - `admin/wallet/reconcile` reads or writes depending on a query value;
     - three order-status GETs "mirror" provider state upstream (documented upstream). These pass both the lock and preview isolation, because they are GETs.
   - **Unlocking is one global switch** [VS], so lifting the lock would reopen every LOCK rule at once.
7. **Cashfree configuration.**
   - The same variable names serve preview and production. The secrets store keeps separate "test" and "live" values under those names [VS].
   - The preview values point at the **production** Cashfree API, with a production-style key [VS: mode and naming category only; no value read].
   - There are no sandbox-named settings, and the preview origin settings are absent [VS].
   - Preview is protected by the host-binding guard [VS], **not** by the money lock: the lock does not cover the website's own venue checkout at all [VS].
8. **Legacy Razorpay InstaKYC.**
   - Confirmation is blocked while locked [VS].
   - The number of teachers who paid a Razorpay link but were never confirmed is **unknown** [UNV].
   - The documented matching rule (the "latest payment link" per teacher) may not be a reliable link between a payment and an obligation [INF].
   - A manual reconciliation procedure is proposed (§9) but was **not executed**.
9. **Nothing here means the system is production-secure or ready to take money.** The next steps are evidence requests to the main-backend owner and website-only design work, each behind its own approval gate (§12).

---

## 2. Scope and evidence reviewed

**Reports read:**
- `PROMPT_4_PAYMENT_ARCHITECTURE_AUDIT.md`
- `PROMPT_4B_SECURITY_CONTAINMENT_REPORT.md`
- `PRICING_P3_REPORT.md` and `PRICING_P3_REVIEW.md`. Both exist; you had allowed for them to be missing, and nothing was missing.
- `PRICING_P3C_REPORT.md`
- `POST_DEPLOYMENT_PRODUCTION_AUDIT.md`, `FINANCIAL_SAFETY_AUDIT.md`, `FINANCIAL_FIX_VERIFICATION.md`
- `CASHFREE_SANDBOX_COMPLETION_REPORT.md`
- `B4_7_REPORT.md` and `B4_7_SECURITY_REMEDIATION_REPORT.md`
- `PAYMENTS_P1_READONLY_AUDIT.md` and `PAYMENTS_P2A_REMEDIATION_REPORT.md`
- the handoffs `/app/BACKEND_HANDOFF_FINANCIAL_SAFETY.md`, `/app/BACKEND_HANDOFF_P0_REMEDIATION.md`, `/app/BACKEND_HANDOFF_B47_main_backend.md` and `/app/BACKEND_HANDOFF_admin_authz_B511.md`
- `/app/BACKEND_REQUEST_instakyc_price.md` and `/app/BACKEND_REQUIREMENTS_cashfree_flows.md` (September 2026)

**Source read (not executed):**
- **Gateway** (`backend/`):
  - `server.py`, `financial_lock.py`, `payment_routing.py`
  - `payment_guard.py`, `preview_isolation.py`, `paypal_webhook.py`
  - `cashfree_diag.py`, `admin_gate.py`
  - `ai_onboarding.py` (checkout, status and webhook)
  - `institutional.py` (paid-event intent, attach-order and confirm)
- **Website server** (`frontend/`):
  - `lib/financial-lock-rules.ts`, `lib/server/financial-lock.ts`
  - `lib/api.ts`, `lib/server/session.ts` (`backendFetch`), `lib/server/bff.ts`
  - `lib/server/preview-isolation.ts`, `lib/server/payment-routing.ts`, `lib/server/participant.ts`, `lib/payment-mode.ts`
  - `app/bff/payments/cashfree/orders/**`, `app/bff/institutional/participant/payment/order/route.ts`
  - `app/bff/teacher/kyc/[...action]/route.ts`, `app/bff/admin/payouts/[action]/route.ts`
  - `app/bff/venue-onboarding/checkout/route.ts`
  - `proxy.ts`, `next.config.mjs`
- **Tests:** `tests/test_p4b_containment.py` and `test_p2a_payment_routing.py`, headers and test names only.

**Configuration:**
- Variable **names** in `frontend/.env` and `backend/.env`.
- The app's secrets-store metadata: names, slots and environment mode; no values.
- Three derived, non-secret facts:
  - the main-backend URL settings point at `pro-learn-connect-1` (yes/no);
  - the Cashfree API mode (`production`);
  - the Cashfree secret's naming category (`prod-style`).

**Saved main-backend API list:** 648 paths. The descriptions, parameters and request schemas of the money routes were read.

**Change evidence:**
- `git status`: no tracked source file is modified apart from `frontend/yarn.lock` and compiled caches.
- File timestamps for the payment files.

**Not reviewed, because it is not available here:**
- the main backend's code and configuration;
- provider dashboards;
- production runtime and its logs.

---

## 3. Current Prompt 4B containment assessment

### 3.1 How it was established (no tests run)

- **Source unchanged since 4B [VS].**
  - `financial_lock.py`, `payment_routing.py`, `financial-lock-rules.ts` and the InstaKYC route were last written at 06:41. The 4B regression log was written at 06:45 and the 4B commit made at 06:47.
  - `git status` shows none of these files modified since that commit.
  - The 4B results (289 containment tests; 2,139 passed and 12 skipped overall) therefore apply to today's source. The results themselves are **[RP]**, because nothing was re-run.
- **Rule parity [VS].**
  - A static text comparison parsed the 22 rule tuples in `financial_lock.py` and the first 22 rule objects in `financial-lock-rules.ts`, without importing or running app code.
  - Order, id, kind, methods and pattern were identical, with 0 mismatches.
  - The website copy adds 3 inline checks (`bad-path`, `wallet-topup`, `decline-refund`), which the Python copy has as code branches.
- **Rule-by-rule reading** of the current patterns against each route path (below) [VS].

### 3.2 Findings

| Claim (from 4B) | Present-source evidence | Status |
|---|---|---|
| The 5 payment actions are refused **while locked**, at the gateway | `financial_lock.RULES` "payment-request" (LOCK, WRITE) matches all five. No earlier rule matches them. `server.proxy` runs `rule_for` first, before any upstream call | **[VS]** |
| …and in the website server | `financial-lock-rules.ts` has the same rule. `backendFetch`, `forward` and `buildUrl` call `refuseFinancialCall` / `financialLockRule` before `fetch`. No website code calls any of the five routes (search found none) | **[VS]** |
| …and are refused by routing **when unlocked** (gateway only) | `v1/payments/orders` → "unknown" flow → 400. The three corporate actions → 403 `unroutable-payment-request`. PayPal capture → 503 `paypal-checkout-not-enabled`, which also covers `capture` with no id | **[VS]**. The website server has no routing copy for these, because it never calls them |
| Payout initiation is refused permanently (ALWAYS) | "payout-initiation" (ALWAYS, WRITE): `v1/payouts/withdraw`, `teacher-wallet/withdraw` (plus `otp/start` and `otp/verify` through `(/|$)`), `teachers/me/payout-request`, `teacher-referrals/withdraw`, `admin/payouts/approve`. "payout-sweep" (ALWAYS, ANY method): `admin/payouts/sweep`. ALWAYS rules are checked even when unlocked (`if kind == "LOCK" and not lock: continue`) | **[VS]**. "Permanent" means independent of the switch; a code change could still remove it, and tests pin it [RP] |
| Legacy Razorpay InstaKYC confirm is refused while locked | "legacy-kyc-confirm" (LOCK, WRITE) on `kyc/sandbox/verify-payment`. The website route still maps it, then `backendFetch` refuses it. In preview it is also refused by the payment guard (`_PAYMENT_WRITE` includes `kyc/sandbox/(create|verify)-payment`) | **[VS]**. Once unlocked it is forwarded in production. That is the designed rollback path |
| Read-only payout and wallet history stays open and is distinguishable | The history routes are GETs, and no WRITE rule applies to a GET. GET `teacher-wallet/payout-details` is open while POST is locked ("withdraw"). Admin reads need an administrator at the gateway (`admin_gate`) | **[VS]** |
| Ambiguous routes stay under the existing lock, not made permanent | See §7 for each route and its rule | **[VS]** |
| The gateway and website copies agree | §3.1 | **[VS]** (static). Behavioural parity: **[RP]** (4B parity test) |

**Edge cases noticed (not regressions):**
- **E1, a parity edge** [VS], P3.
  - For `admin/wallet/reconcile` with the query `heal_direction=report_only&heal_direction=` (a second, empty value):
    - the website copy refuses it, because it requires exactly one value;
    - the gateway copy exempts it, because Python's `parse_qs` drops blank values.
  - Upstream documents its GET as strictly report-only, so the impact is low [INF].
- **E2, case and encoding.** The gateway checks the canonical (decoded, lower-case) path but forwards the raw path [VS]. A mixed-case path is checked as its lower-case form. Whether upstream routing is case-sensitive is **[UNV]**. A case-sensitive upstream would answer 404 rather than reach a different route, so this fails safe [INF].

---

## 4. Website versus main-backend trust boundary

### 4.1 Which website components call the main backend [VS]

| Caller | Mechanism | Credentials sent | Checks before sending |
|---|---|---|---|
| `lib/api.ts` (`apiGet`, `apiGetSafe`, `apiGetOrNull`) | Server-side GET to `BACKEND_URL` | None (public reads) | Lock rule (GET) |
| `lib/server/session.ts` `backendFetch` | Server-side, any method | The user's bearer token, read from the httpOnly session cookie | Lock rule, then preview write isolation |
| `lib/server/bff.ts` `forward` | Server-side POST for sign-in, OTP and reset | None | Lock rule, then preview write isolation |
| `bff/institutional/participant/payment/order` | Raw `fetch` POST `payments/cashfree/orders` (`institutional_event`) | **None.** The code comment says the module "accepts a server-built customer identity" | Lock rule, then preview isolation |
| `lib/server/participant.ts` `confirmParticipantPayment` | Raw `fetch` GET `payments/cashfree/orders/{id}` | **None** | Lock rule (GET) |
| Gateway `server.py` `proxy` (`/api/*` not served locally) | httpx, any method, to `BACKEND_ORIGIN` | **The caller's own headers**, including `Authorization` and `Cookie`. Hop-by-hop headers and the test tag are removed | Lock, routing, billing country, preview isolation, PayPal handler, unsigned-webhook check, policy gate, admin gate, payment guard, retreat date |
| `admin_gate.check` | GET `auth/me` with the caller's credentials | The caller's own | — |
| `cashfree_diag` | GET `payments/cashfree/diag` | None (the caller's credentials are not sent) | Admin check on every call |
| `paypal_webhook.handle` | POST to upstream PayPal webhook, after verification | PayPal transmission headers only | §6 |
| `knowledge_bridge.py`, `trust_review.py`, `retreat_eligibility.py` | Reads | — | — |

### 4.2 Credentials and browser exposure [VS]

- **No service credential** for the main backend exists: no such name in either `.env` or the secrets store.
  - Every call is either the end user's own token or anonymous.
  - The website cannot prove to the main backend that a request was checked by the website.
- **Browser exposure:**
  - The main-backend URL is a server-only variable (`BACKEND_URL` / `BACKEND_ORIGIN`). The default is hard-coded in `lib/api.ts`, `server.py`, `knowledge_bridge.py` and `trust_review.py`, all server-side.
  - Public variables are only `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_GA_ID`.
  - No client component references the backend URL, `PULSE_SHARED_SECRET` or any `CASHFREE_` / `PAYPAL_` name (search found none).
  - The development build's static chunks (`.next/static`, dated 24 Oct) contain neither the backend host name nor those secret names.
  - **Limitation:** the production bundle was not inspected [UNV].
- The bearer token never reaches the browser: it is set as an httpOnly cookie by the website (`lib/server/bff.ts` `withSession`) [VS].
- **The main-backend URL is not secret:** it is a public HTTPS host. Earlier audits reached it directly [RP: `POST_DEPLOYMENT_PRODUCTION_AUDIT.md` §3, `B4_7_SECURITY_REMEDIATION_REPORT.md`].
- **Preview and production use the same main backend.** `BACKEND_URL` is a single shared value in the secrets store [VS], as the earlier audit noted [RP].

### 4.3 What the main backend owns [VS from the saved API list and the 4A ownership table]

- Cashfree orders for InstaKYC, 1:1 sessions, retreats, Fast-Track, group invites, corporate batches, institutional event fees and wallet top-up.
- `v1/payments` orders and webhooks.
- The Cashfree webhooks (`payments/cashfree/webhook`, `v1/payments/webhook`).
- The PayPal module (`config`, `create-order`, `capture`, `webhook`).
- Refunds, wallets, ledger, escrow, payout and withdrawal, the payout webhook, split agreements, session completion and pilot commissions.
- Razorpay (legacy) and the `kyc_paid` flag.

### 4.4 Is the gateway a complete boundary? **No.**

- The main backend is independently reachable [RP]. It is called with end-user or anonymous credentials [VS].
- The website gateway and website server are therefore **defence in depth for website traffic only**, not a security boundary.
- This applies equally to the mobile app, which calls the main backend directly [RP: B4.7 §4].

### 4.5 Evidence about main-backend authentication and authorisation

| Evidence | What it shows | Label |
|---|---|---|
| The saved API list defines **no security schemes**. Only 6 of 81 money-related operations declare an `Authorization` header parameter | Nothing either way: FastAPI dependencies can authenticate without declaring a parameter | [VS] (inconclusive) |
| Signed-out wallet, transaction and reconcile reads get 401; orders list gets 403; non-admins get 403 on several admin routes. Direct and through the gateway alike (26 Oct) | Some routes do authenticate and authorise | [RP] |
| The FS-00 money freeze answered 423 on 9 direct money routes (26 Oct). Six others answered "not found" first, so the freeze order is unknown (F6) | A partial server-side freeze exists | [RP] |
| Admin authorisation gaps (TVR-01) on admin GET routes, and an IDOR finding (teacher stats by id) | The main backend has had authorisation gaps. Partly fixed later (S9 PASS on 26 Oct) | [RP] |
| InstaKYC order creation stored the client-supplied amount verbatim (₹279, ₹123 and ₹799 test orders, September 2026) | The amount is trusted from the caller, at least for `order_type=instakyc`, at that time | [RP] (stale; current behaviour [UNV]) |
| The website creates paid-event orders and reads order status **without** a token | The website's own design assumes those two routes accept anonymous calls | [VS] (design); upstream acceptance [INF] |
| An independent security review, access-control specification or test report for the main backend's **code** | **None in this workspace.** Only outside-in probes and the handoff requests (FIN-01…10, MB-1…8, TVR-01, B4.7) exist. Whether they were implemented is [UNV] | [VS] (absence) |

### 4.6 Server-side controls the main-backend owner should verify (and evidence back)

1. **Authentication** on every money route (orders, capture, refunds, wallet, payout, KYC payment, splits, completion), except provider webhooks. Anonymous calls get 401.
2. **Authorisation and ownership:**
   - the caller may act on this booking, registration, teacher or wallet (no IDOR);
   - admin routes are admin-only, checked by a router-level dependency before validation (TVR-01 patch).
3. **Server-side amount:**
   - for every `order_type`, the amount, currency and product come from the main backend's own records or approved prices, never from the request body;
   - a mismatch is refused;
   - this covers `payments/cashfree/orders` (`amount` is a required **request** field today) and any `institutional_event` order, whose price the website engine owns, so the main backend needs a trusted way to know it.
4. **Billing-country and currency validation** independent of the website: India → Cashfree INR only; no Cashfree international; no automatic fallback.
5. **Its own money freeze** (FS-00 / MB-1):
   - checked **first** on every money route, including the six F6 routes;
   - ON by default when unset;
   - applied inside jobs, sweeps and retries (MB-4).
6. **Payouts permanently disabled** (no supported payout capability): `v1/payouts/withdraw`, `teacher-wallet/withdraw*`, `teachers/me/payout-request`, `teacher-referrals/withdraw`, `admin/payouts/approve|sweep`, the sweep inside `admin/payouts/list`, and the cooling → eligible job.
7. **Webhook authenticity:**
   - Cashfree HMAC over timestamp + raw body, in constant time;
   - a freshness window;
   - de-duplication by provider event id;
   - an authoritative re-read with order id, amount, currency and reference matched (MB-3);
   - PayPal verify-signature that **fails closed** when `PAYPAL_WEBHOOK_ID` is unset;
   - the payout webhook disabled while no payout account exists.
8. **Idempotency:** one fulfilment per order; one ledger effect per (event, effect, beneficiary); a duplicate payment is recorded for refund review, never auto-applied.
9. **No GET writes** (FIN-01):
   - `admin/payouts/list` must not run the sweep;
   - order-status GETs (`payments/cashfree/orders/{id}`, `v1/payments/orders/{id}/status`, `v1/payments/return`) must not trigger fulfilment or ledger effects while frozen.
10. **Fake-payment routes retired** (MB-2 / D-2): Fast-Track `pay`, `premium-sessions/book`, `bookings/{id}/pay`, and Razorpay create, verify and recover.
11. **Legacy Razorpay** `kyc/sandbox/verify-payment`:
    - matches the payment link to the right teacher, obligation, amount and currency;
    - is idempotent;
    - is disabled until reconciliation is approved (§9).
12. **Unverified payout destination:** `v1/teachers/me/wallet/bank-account` is documented upstream as setting `verified=True` optimistically, with no penny-drop check. It must not mark a destination verified without real verification.
13. **Cashfree diag** admin-only on the main host (MB-6).
14. **Optional, strongest:** restrict money routes to callers presenting a website service credential, or to the website's network origin, so that website-side checks can be relied on. This is a design decision for the owner.

---

## 5. Cashfree notification audit

### 5.1 Entry points [VS]

| Entry point | Owner | Where verified |
|---|---|---|
| `POST /api/ai-onboarding/webhook` (venue AI onboarding) | Website (local, its own Cashfree keys) | `ai_onboarding.webhook()` |
| `POST /api/payments/cashfree/webhook` | Main backend | Gateway: header presence only (`financial_lock.unsigned_webhook`). Upstream: documented |
| `POST /api/v1/payments/webhook` | Main backend | Same |
| `POST /api/v1/payouts/webhook` (payout status) | Main backend | Gateway: LOCK ("v1-money"); **not** treated as an incoming payment |
| Paid institutional events | — | **No notification route** (confirm through the return page only) |

Whether Cashfree delivers main-backend notifications **through** the website gateway (`www.nostops.org/api/...`) or straight to the main host depends on the `notify_url` the main backend sets [UNV]. If it is the main host, the gateway's header check never applies.

### 5.2 Property-by-property

**(A) Website venue webhook.** Evidence for every property: `backend/ai_onboarding.py` (`webhook()` L433–525, `_refresh_status()` L360–418, `_matches_order()` L345–352, `create_order()` L191–342).

| Property | What the code appears to do | What the evidence proves | What remains unverified | Recommended future test |
|---|---|---|---|---|
| Authenticity | Requires a client secret and both headers, otherwise 400. HMAC-SHA256 with the client secret over `timestamp + raw body`, base64, constant-time comparison, otherwise 401 (and a monitor record) | The check exists and runs before anything else **[VS]** | That this is Cashfree's current scheme for the configured API version (not re-checked against Cashfree's documentation in this stage) **[UNV]** | Offline: signed fixtures (good, bad, missing, non-UTF-8). Sandbox: a real delivery |
| Order reference validated | Ignores (acknowledges) an order id that doesn't start with `vob_` or isn't in `ai_onboarding_orders`. Otherwise re-reads the order from Cashfree with its own keys | **[VS]** | — | Offline: unknown id gives `ignored` and no provider call |
| Amount and currency matched | `_matches_order`: Cashfree's `order_amount` must be within ₹0.01 of the local amount, the currency equal, the id equal. A mismatch grants nothing and flags the order | **[VS]** | — | Offline: mock Cashfree returns +₹1 or USD, so not paid and flagged |
| Merchant and environment | No explicit merchant or app-id field is compared. The order is re-read with **this module's own credentials**, so it must exist in that account. On a preview host a notification is applied only when the API is the sandbox **and** the order is a sandbox order; otherwise it is acknowledged and ignored. Sandbox can't run outside preview (`checkout_decision`) | Environment separation **[VS]**. Merchant binding is implied by the authenticated re-read **[INF, strong]** | A stored order whose `mode` differs from the current API mode (for example after a misconfiguration) is not explicitly refused: the re-read would fail (404) and give 503 retries **[INF]** | Offline: production-mode order on a sandbox config, and the reverse |
| Duplicate, delayed, replayed, out-of-order | Freshness window **24 h** back, 5 min ahead. One event row per key (`processing` → `processed` / `ignored` / `failed`). An event still processing for less than 60 s gives 503. A failed event is retried. **The key is the unsigned `x-idempotency-key` header when present**, otherwise a hash of the signed bytes. Out-of-order: the status always comes from the authoritative re-read, and entitlement is never revoked automatically | **[VS]**, including the gap: a replayed signed body with a new header value is processed again (another Cashfree re-read) | Whether 24 h matches Cashfree's recommended tolerance **[UNV]**. The main backend documents 5 minutes | Offline: the same body with different idempotency headers gives 1 effective processing. A stale timestamp gives 400 |
| Duplicate fulfilment | Entitlement upsert keyed by submission, `$addToSet order_ids`. A second paid order for an active venue is flagged `duplicate_payment`, with no second grant | **[VS]**. Concurrent double checkout (TVR-24) is **[RP]** (not reproduced) | — | Offline + throwaway DB: parallel webhooks for the same and for different orders |
| Browser redirect or client status | The return page calls `/status`, which re-reads Cashfree. Nothing trusts the URL or the body's payment status | **[VS]** | — | Offline: tampered return URL, forged `payment_status=SUCCESS` in an unsigned body |
| Payment success versus fulfilment | Separate records (`ai_onboarding_orders.paid` and `ai_onboarding_entitlements`), but written in the same function as soon as the order is paid | **[VS]**. Not modelled as separate states (4A §8 proposal) | — | Stage D state-machine tests |
| Only established by unrun tests | 8 sandbox tests (order creation, reuse, abandoned checkout, duplicate webhook, sandbox return URL…) have never run: there are no sandbox keys | **[RP]** | The real end-to-end behaviour against Cashfree **[UNV]** | Stage E (Cashfree sandbox), separately approved |

**(B) Main-backend Cashfree webhooks (`payments/cashfree/webhook`, `v1/payments/webhook`).**

| Property | Evidence | Label |
|---|---|---|
| Gateway | Forwarded even while locked (incoming payments). Refused with 400 only when the signature or timestamp header is **absent** (`unsigned_webhook`). In preview, refused by the payment guard and preview isolation | **[VS]** |
| Authenticity, replay (5 min), de-duplication (event id / body hash), "amount-guarded" (v1) | Documented upstream only | **[UNV]** |
| Order, amount, currency and reference matched to an authoritative order | Recommended in MB-3; not confirmed as implemented | **[UNV]** |
| Duplicate fulfilment, ledger and wallet effects while frozen | MB-3 §5 requested "no wallet credit, earning, commission… while frozen" | **[UNV]** |
| Browser redirect | `v1/payments/return` and order-status GETs are documented as "not authoritative… poll Cashfree" | Documented; **[UNV]** |
| Payment success versus fulfilment | Unknown | **[UNV]** |

**Do not read "a webhook route exists" as "webhook security verified".** Only property (A) has source evidence. Property (B) needs the main-backend owner's code and staging evidence (MB-3 acceptance tests T3-1 … T3-7).

**(C) Paid institutional events.** Evidence: `institutional.py` L3404–3523, `lib/server/participant.ts` L91–131, `bff/institutional/participant/payment/order/route.ts`. [VS]
- There is no webhook or reconciler. A paid registration stays `PENDING_PAYMENT` if the browser never returns (C3).
- Confirmation re-reads `GET payments/cashfree/orders/{id}` from the main backend **anonymously**.
  - It requires the status to be PAID or SUCCESS.
  - The engine then requires the order to be attached to the registration, the amount equal to the fee within ₹0.01 and the currency equal.
  - **`reference_id` is compared only when the upstream returns one.**
  - The confirm is idempotent; a duplicate payment or a payment for a seat that is no longer pending is recorded for review.
- The authority for "PAID" is the main backend's answer. Whether that answer is a live Cashfree re-read or a stored value is [UNV].

---

## 6. PayPal notification and capture audit

| Question | Finding | Label |
|---|---|---|
| Order creation and capture implemented on the website? | **Absent.** There is no PayPal Orders or capture call anywhere in the website or gateway code. `PAYPAL_CHECKOUT_FLOWS` is empty. The venue checkout website server refuses international buyers (503) before anything reaches the backend | [VS] |
| Main backend | A PayPal module exists in the saved API list: `config` (returns client id and mode), `create-order` (request has teacher handle, slot and student details, **no amount**), `capture/{order_id}` (request has `booking_id`) and `webhook`. Whether it works, and its configuration, are unknown | [VS] (existence), [UNV] (behaviour) |
| Capture blocked while locked? | Yes: "payment-request" (LOCK) at the gateway and in the website server. **Also independently of the lock**: routing answers 503 for `international/paypal/(create-order|capture)` on every host | [VS] |
| Another route to capture through the website? | None. `create-order` gives 503. The PayPal webhook is handled locally and only forwards notifications; it never initiates a capture. No website code calls capture | [VS] |
| Capture by a **direct** call to the main backend | Possible, since the main backend is reachable | [INF] (reachability [RP]) |
| Server-side order and capture references validated | Website handler: after verification it requires a capture id and an order id, otherwise 422 | [VS] |
| Upstream: capture bound to the booking's order | Not known | [UNV] |
| Amount, currency, merchant and product checked | Website handler: **merchant id must equal** `PAYPAL_MERCHANT_ID`. **Amount, currency and product are not compared**: the website creates no PayPal orders, so it has nothing to compare against, and these checks are left upstream | [VS] (website), [UNV] (upstream) |
| Webhook authenticity and duplicates | Website handler, in order: settings must exist, with the environment matching the host; required headers; certificate URL must be HTTPS on `*.paypal.com` in the same environment; algorithm `SHA256withRSA`; transmission time ≤ 3 days old and ≤ 5 minutes ahead; **PayPal's documented verify-webhook-signature API** with the raw body; one record per event id; stale detection per capture; refunds and reversals HELD. With no settings: 503, nothing recorded | [VS] |
| Upstream webhook | Documented upstream: **accepts unsigned events when `PAYPAL_WEBHOOK_ID` is unset** | [VS] (documented), [UNV] (configured value) |
| Success from browser navigation or a client claim alone? | Website: no PayPal success path exists | [VS] |
| Upstream: capture result source | Not known | [UNV] |
| USD prices approved for any product? | **None.** Venue onboarding US$30 is RECORDED (not approved for sale, tax undecided). The US$99 combined offer is paused. All other products have no international price, and nothing is converted from INR | [VS] (pricing rules, P3/P3C reports) |
| PayPal credentials and environment | All `PAYPAL_*` names are **absent**: both `.env` files, the secrets store and the running processes | [VS] |
| Account readiness | REST app, Orders v2, webhook id, receiving currency, cross-border purpose code and FIRC, the unsupported-country list | [UNV] |

**Verdict:**
- The website side fails closed; there is no PayPal checkout to secure.
- The **main-backend PayPal module is the exposure** (P0-3), because it is reachable directly and documents an unsigned-acceptance mode.
- An approved PayPal account would not prove a working, verified integration exists. The missing evidence is listed in §13.

---

## 7. Remaining payout and mixed-operation routes

**How to read this table:**
- Methods and paths are from the saved API list.
- "Lock" is the gateway and website rule, identical in both [VS].
- "Main-backend control" is from earlier probes or documentation only.
- **Nothing was called.**

| Method and path | Type | May calling it change state? | Website lock and authorisation | Main-backend control (evidence) | Safe while locked: proven? | Recommendation (later approval) |
|---|---|---|---|---|---|---|
| `GET admin/payouts/list` | **MIXED / POTENTIALLY MUTATING** | **Yes**: documented upstream, "the sweep also runs on /list" | `payout-sweep-read` (LOCK, any method) plus the gateway admin gate. The website calls it only by an explicit admin action with `confirm_sweep: true`, and returns 423 first while locked | Not among the 9 FS-00 routes [RP]. Behaviour [UNV] | Through the website: yes [VS]. Directly: **no evidence** | Upstream: split into a pure read and a separate sweep, then make the sweep ALWAYS refused. Keep blocked |
| `GET` / `POST admin/payouts/sweep` | Write (trigger) | Yes | `payout-sweep` **ALWAYS** | [UNV] | Through the website: yes | Keep ALWAYS. Upstream: remove or freeze |
| `POST admin/payouts/reject` (`ledger_id`, `reason`) | Write | Yes (payout state; possibly a balance restore [UNV]) | `payout-decision` (LOCK) plus admin | FS-00 423 (26 Oct) [RP] | Through the website: yes. Directly: partly [RP] | Keep LOCK until reviewed. With no payout capability, consider ALWAYS |
| `GET admin/wallet/reconcile` | Read only when `heal_direction=report_only` (documented: "a GET must never write") | Documented no | `wallet-heal` (LOCK, any method), exempt only for an exact single `report_only` (E1 parity edge, §3) | [RP] 401 signed out, 403 non-admin | Through the website: yes | Keep. Fix the E1 parity edge |
| `POST admin/wallet/reconcile` | **MIXED by query** (`report_only` reads; `ledger_to_wallet` / `wallet_to_ledger` write) | Yes | `wallet-heal`; and even with `report_only`, the `money-keyword` rule (LOCK) refuses it | Documented: gated by FS-00 [UNV] | Through the website: yes | Upstream: separate the report from the heal |
| `POST teacher-wallet/payout-details` (needs `pin`) | Write (payout destination) | Yes | `withdraw` (LOCK) | [UNV] | Through the website: yes | Keep LOCK |
| `GET teacher-wallet/payout-details` | Read | No | Open | [RP] needs sign-in | n/a | — |
| `POST teacher-wallet/setup-pin`, `change-pin` | Write | Yes | `withdraw` (LOCK) | [UNV] | Through the website: yes | Keep LOCK |
| `POST v1/teachers/me/wallet/bank-account` | Write | Yes. **Documented: sets `verified=True` optimistically, with no penny-drop** | `v1-money` (LOCK) | [UNV] | Through the website: yes | Upstream must not mark a destination verified (§4.6 #12). Keep LOCK |
| `POST v1/payouts/webhook` (payout status; signature headers declared) | Write (inbound status) | Yes | `v1-money` (LOCK). **Not** in the incoming-payment pass list | Documented "idempotent + amount-guarded" [UNV] | Through the website: yes | No payout account exists, so consider ALWAYS. Upstream: disable |
| `POST one-on-one/booking/{id}/complete` | Write. Documented: "once BOTH have marked, funds release to wallet" | Yes | `release` (LOCK) | F6: freeze not checked first [RP] | Through the website: yes. Directly: **no** | Keep LOCK. Upstream: freeze first |
| `POST bookings/{id}/split-agreement/{propose|confirm|reject|reset}` | Write (revenue split) | Yes | `release` (LOCK). The GET read is open | [UNV] | Through the website: yes | Keep LOCK |
| `POST empanelment/claims/sweep-fallback` | Write (auto-assigns claims; cron or admin) | Yes (assignment; downstream split [INF]) | `release` (LOCK) | MB-4 jobs [UNV] | Through the website: yes. As a job: **no** | Keep LOCK. Upstream: freeze inside the job |
| `POST empanelment/fast-track/{id}/decide` | Write. Documented: "triggers revenue split realisation (85/15), non-refundable" | Yes | `fast-track-split` (LOCK) plus the Policy V2 gateway check | FS-00 423 [RP] | Through the website: yes | Keep LOCK |
| `POST v1/bookings/{id}/complete` | Write (credits the teacher through escrow; documented admin-only) | Yes | `v1-money` (LOCK) | F6 [RP] | Through the website: yes | Keep LOCK |
| `POST bookings/{id}/complete-pilot`, `bookings/check-expired-pilots` | Write (commissions) | Yes | `release` (LOCK) | F6 [RP] | Through the website: yes | Keep LOCK |
| `GET payments/cashfree/orders/{id}` | **MIXED / POTENTIALLY MUTATING** (documented "poll order status") | Possibly (status mirror, fulfilment [UNV]) | No lock (GET). **Forwarded from preview too** (preview isolation is by method) | [UNV] | **Not proven** | Upstream: confirm a status read can't trigger ledger or wallet effects while frozen (§4.6 #9). Website: decide later whether preview should forward it |
| `GET v1/payments/orders/{id}/status` | **MIXED** (documented: "poll Cashfree… mirror it locally") | Yes (local mirror) | No lock (GET) | [UNV] | **Not proven** | As above |
| `GET v1/payments/return` | **MIXED** (documented: return landing page, "confirm status via the backend") | Possibly | No lock (GET) | [UNV] | **Not proven** | As above |

**Global-switch observation [VS].** `FINANCIAL_ACTIONS_UNLOCKED=true` is one switch, read in two places. It disables **every** LOCK rule at once, in both copies: 15 listed rules plus the 2 inline checks (`wallet-topup`, `decline-refund`), including the five payment actions, the legacy KYC confirmation and all the ambiguous routes above. There is no per-flow unlock. → P1 design item (§10).

No route was blocked permanently in this stage.

---

## 8. Cashfree sandbox versus production configuration

| Question | Finding | Label |
|---|---|---|
| Which mode does the preview configuration use? | `CASHFREE_API_BASE` resolves to **production** (`api.cashfree.com`, exact host rule in `payment_guard.cashfree_mode`). The client id and secret are present; the secret's naming category is **production-style**. No values were printed | [VS] |
| Same names for preview and production? | **Yes.** The secrets store has `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_API_BASE` and `CASHFREE_API_VERSION`, each with separate **test** and **live** values. There are no sandbox-specific names | [VS] |
| Owner's earlier statement | The preview copy of the old production keys was rotated, and Cashfree production rejected the old keys with 401 | [RP] |
| Production credential state | The main backend's production credentials were rejected with 401 on 26 Oct (D-1) | [RP] |
| Current live-slot validity | Not known | [UNV] |
| Server-side environment selector? | **Derived, not declared.** The mode comes from the exact API host; `checkout_decision` binds it to the request host (sandbox only on the configured preview origin, live only on a production host); `ai_onboarding._decision` applies this to checkout and status reads. There is no explicit `CASHFREE_ENV` name, and no startup validation (an inconsistency is found per request, not at boot) | [VS] |
| Preview origin settings | `WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN` are **absent**, so even sandbox keys would be refused today | [VS] |
| Secrets exposed in frontend bundles? | No `CASHFREE_*` name in `frontend/.env`, no public variable for it, and no client reference. The development build's static chunks contain no secret names. Production bundle: not inspected | [VS] / [UNV] |
| Could preview accidentally use production credentials? | **Guarded, not impossible.** Live keys are refused on a preview, local or unknown host, or on any request routed through a preview ingress. Webhooks reaching preview are ignored unless sandbox. Status reads are refused | [VS] |
| Residual risk | The production-mode values sit in the preview environment. Any future code path that calls `CF_API_BASE` without `checkout_decision` would reach production | [INF] |
| Does the financial lock stop money independently of provider mode? | **Not for the website's own Cashfree module.** `/api/ai-onboarding/*` is served locally, before the catch-all proxy where the lock runs, and neither `ai_onboarding.py` nor the venue checkout website route checks the lock. In preview, checkout is off because of the host-binding guard and the missing sandbox origin, **not** because of the lock | [VS] |
| Main-backend flows | The lock refuses money **out** and the unrouted actions. By founder decision, India order creation and incoming notifications pass it. Checkout is off in preview because of the preview payment guard and preview isolation | [VS] |
| Can separate sandbox configuration be designed without changing current settings? | **Yes**, by adding new, separately named sandbox settings and selector logic. Design only (below) | [VS] (feasible by design) |

**Future isolation plan (design only; nothing implemented):**
1. **Separate names.**
   - Use `CASHFREE_SANDBOX_CLIENT_ID`, `CASHFREE_SANDBOX_CLIENT_SECRET` and `CASHFREE_SANDBOX_API_BASE` (sandbox host only) in preview.
   - Use the existing `CASHFREE_*` names for live, set **only** in the live slot. The preview test slot is emptied by the owner (a separately approved credential action).
2. **Explicit selector.** `CASHFREE_ENV` = `sandbox` | `production`, read server-side only.
3. **Startup validation.**
   - Fail closed unless the selector, the API host and the key-type naming all agree, and the selector suits the host class (sandbox on preview origins only; production only on production hosts).
   - On any ambiguity: refuse every checkout and status read, acknowledge-and-ignore webhooks (or 503), log once with no values, and raise one admin alert. Alerts are disabled in tests.
4. **Keep the per-request host binding** (`checkout_decision`) as a second layer.
5. **Add a checkout kill switch** to the website's own module, independent of the money lock (default OFF), so "checkout disabled" doesn't rest on missing configuration.
6. **Tests:**
   - an offline matrix (selector × API host × key type × request host);
   - a test that live names in a preview process cause refusal;
   - a test that no `CASHFREE_*` value reaches any client bundle.

---

## 9. Legacy Razorpay InstaKYC reconciliation

| Item | Finding | Label |
|---|---|---|
| Role of `POST /api/kyc/sandbox/verify-payment` | Documented upstream: "polls Razorpay for the user's most-recent KYC payment link and flips `kyc_paid=True` on the teacher record when status is 'paid'." No request body is declared, so the teacher is taken from the session | [VS] (documented) |
| Link creation | `kyc/sandbox/create-payment` gives 410 at the gateway (switch `LEGACY_RAZORPAY_KYC_CHECKOUT=allow`, which is **absent**) | [VS] |
| Website use | The website never created Razorpay links | [RP] (P2A) |
| Current containment | Refused while the lock is on, at the gateway and the website server (`legacy-kyc-confirm`), and in preview additionally by the payment guard. Code, credentials and history are kept | [VS] |
| Outstanding confirmations | **The number of teachers who paid a Razorpay link before 27 Oct 2026 and were never confirmed is unknown.** That data is in Razorpay and the main backend | [UNV] |
| Reliable association between link, teacher and obligation? | **Not established.** The only documented rule is "the user's most-recent link". If a teacher had more than one link (an expired and a re-issued one), or the obligation changed (₹799 → ₹279 price change, September), "most recent" may not identify the payment that settled the obligation | [INF] |
| Bridge from Cashfree to `kyc_paid` | In September, a Cashfree InstaKYC order did **not** flip `kyc_paid` (not bridged). Current behaviour unknown | [RP] / [UNV] |

**Proposed manual reconciliation procedure.** For separate authorisation only. **Not executed.** No records were enumerated.
1. **Scope approval:** a named authorised operator and a written authorisation for read-only access to the Razorpay dashboard and the main-backend KYC records.
2. **Verified identity and obligation:** for each candidate teacher, confirm identity in the main backend and that an InstaKYC obligation existed, with its price at link creation (₹799 or ₹279), currency INR and the link reference.
3. **Authoritative provider evidence**, through the approved dashboard or export process: the payment link id, payment id, amount, currency, status `paid`, payment date and the customer reference recorded on the link.
4. **Match all of:** the link is tied to that teacher's obligation; the amount equals the obligation; currency INR; the payment reference is unique.
5. **Independent duplicate check:** the teacher is not already `kyc_paid` or `instakyc_paid`; no Cashfree InstaKYC payment exists for the same obligation; no earlier reconciliation used the same payment id.
6. **Auditable decision:** the operator records decision, evidence references and reason. A second person reviews any mismatch or edge case.
7. **Controlled update:** a separately approved change **in the main backend** (which owns `kyc_paid`), idempotent per payment id, with an audit row. No change through this website, and no ledger entry here.
8. **Close-out:** once none remain, retire `verify-payment` (410 plus switch, like `create-payment`), with written rollback.

**Confirmation:** this procedure has not been executed. No teacher was marked paid or unpaid. The pending count remains unknown.

---

## 10. Prioritised findings

| ID | Finding | Evidence and confidence | Component, owner | Impact | Remediation | Where | Approval | Test without moving money |
|---|---|---|---|---|---|---|---|---|
| **P0-1** | Main backend directly reachable; the website gateway is not a boundary; FS-00 confirmed on 9 routes only | Reachable [RP]; no service credential, caller credentials forwarded [VS]; F6 [RP] | Main backend; owner: backend team | Every website rule can be bypassed: payment actions, payouts, refunds and legacy confirm | §4.6 #1–#6 and #14; MB-1 / MB-4 | **Main backend** | Yes (owner change plan; founder) | Staging with freeze ON; non-existent ids and below-minimum amounts; counts before and after |
| **P0-2** | Cashfree order creation trusts the caller's `amount`; order creation may be unauthenticated | `amount` required in the request schema [VS]; observed for InstaKYC in September [RP]; website creates event orders with no token [VS]; current behaviour [UNV] | Main backend `payments/cashfree/orders` | Underpriced orders. If fulfilment (`kyc_paid`, booking paid) doesn't re-check the expected price, payment integrity is compromised | Server-side amount per `order_type`; auth; reference bound to the caller; a trusted price source for `institutional_event` | **Main backend** (plus a website design for passing event prices securely) | Yes | Staging, sandbox keys: order with a tampered amount refused; fulfilment refuses an amount mismatch |
| **P0-3** | Main-backend PayPal webhook accepts unsigned events when `PAYPAL_WEBHOOK_ID` is unset; capture binding not known | Documented upstream [VS]; configuration [UNV] | Main backend PayPal module | A forged `PAYMENT.CAPTURE.COMPLETED` sent directly could confirm an international booking; capture integrity unknown | Fail closed without a webhook id; or disable the module until approved; capture bound to the booking's order, amount and currency | **Main backend** | Yes | Staging: unsigned or forged event refused; PayPal **sandbox** only, later |
| **P0-4** | Payout and withdrawal capability still exists upstream; website ALWAYS denial covers website traffic only | API list [VS]; FS-00 on withdraw, payout request, approve and reject [RP]; `v1/payouts/withdraw`, OTP, sweep and list-sweep upstream [UNV] | Main backend | Ledger debits, payout state changes or a payout attempt through direct calls | Disable payouts permanently upstream (§4.6 #6); remove the sweep from `list` | **Main backend** | Yes | Staging: each route gives 410/423 for every role; job runs record `skipped` |
| **P1-1** | Main-backend Cashfree webhooks: the gateway checks header presence only; HMAC, replay, de-duplication and amount matching are documented, not evidenced | [VS] gateway; [UNV] upstream | Main backend webhooks | Forged or replayed notifications could mark orders paid if upstream checks are weak | Owner supplies code and the MB-3 T3-1…T3-7 staging results; confirm the `notify_url` path | **Main backend** | Yes | Staging, sandbox: signed fixtures, ×3 duplicate, ₹1 mismatch, stale, non-UTF-8 |
| **P1-2** | Status GETs that poll and mirror provider state pass the lock and preview isolation | Documented upstream [VS]; effects [UNV] | Main backend; website gateway | While "locked", or from preview, a GET may trigger fulfilment or ledger effects in the shared production backend | Upstream: no ledger effects from status reads while frozen. Website: decide whether preview forwards them (a later approval) | Both | Yes | Upstream staging; website: offline matrix pinning the chosen behaviour |
| **P1-3** | Unlocking is one global switch | [VS] | Website (`financial_lock`, website lock rules) | One change reopens the five actions, the legacy confirm and every ambiguous route together | Per-flow allowlist, each entry needing its own approval and pinned by tests | **Website** | Yes | Offline: an unlock for flow X opens only flow X |
| **P1-4** | Paid-event confirmation has no notification or reconciler; it relies on an anonymous upstream status read; `reference_id` checked only if present | [VS] | Website (`institutional.py`, `participant.ts`) | A paid but unconfirmed seat if the browser doesn't return; weaker matching if upstream omits the reference | Read-only reconciler or webhook (Stage D); require the reference; authenticated or authoritative status source | **Website** (plus main-backend status contract) | Yes | Offline with a mock upstream and a throwaway database |
| **P1-5** | The billing country is client-supplied; `X-Billing-Country` on direct `/api` calls is caller-controlled | [VS] | Website routing; main backend | Routing proves only what the caller claims | Stage C: account country plus explicit confirmation, recorded on the order; main backend validates independently | Both | Yes | Offline matrix |
| **P1-6** | Preview holds production-mode Cashfree values; no sandbox names or startup validation; the lock doesn't cover the website's own venue checkout | [VS] (mode, names, code); rotation [RP]; live validity [UNV] | Website configuration and `ai_onboarding` | Checkout-off rests on host binding and missing settings; a future code path could reach production | §8 plan: separate sandbox names, selector, startup validation, kill switch | **Website** (configuration change by the owner) | Yes | Offline config matrix; then Stage E sandbox |
| **P1-7** | Legacy Razorpay: pending count unknown; matching rule may mis-associate | [UNV] / [INF] | Main backend; operations | Paid teachers unconfirmed, or a wrong confirmation on re-enable | §9 procedure; keep the lock | Main backend / operations | Yes (separate authorisation) | Dry-run on exported evidence with no writes |
| **P1-8** | `v1/teachers/me/wallet/bank-account` documented as marking a destination verified without verification | Documented upstream [VS]; behaviour [UNV] | Main backend | Unverified payout destinations | No optimistic verification; keep LOCK | **Main backend** | Yes | Staging |
| **P2-1** | Venue webhook de-duplication key may come from the **unsigned** `x-idempotency-key` header; 24 h window | [VS] | Website `ai_onboarding.py` | A replayed signed body with a new header is re-processed. The effect is idempotent, but it causes repeated provider re-reads | Key on the signed body hash or the provider event id; align the window with Cashfree's guidance | **Website** | Yes | Offline signed fixtures |
| **P2-2** | Two simultaneous venue checkouts can create two orders (TVR-24) | [RP] (code reading, not reproduced) | Website | Duplicate charge | Unique pending-order lock per venue | **Website** | Yes | Offline + throwaway database; sandbox later |
| **P2-3** | Payment success and fulfilment are written together | [VS] | Website | Harder reconciliation and refunds | Stage D state model | **Website** | Yes | Offline |
| **P2-4** | No price version or routing-decision link stored on main-backend orders (C9); venue orders do store them | [VS] | Both | Weak audit trail | Record them at order creation | Both | Yes | Offline / staging |
| **P2-5** | Public Cashfree diag on the main host (D-4). The gateway version is admin-only in source; deployed state not checked | [RP] / [VS] / [UNV] | Main backend | Configuration disclosure; provider ping per request | MB-6 | **Main backend** | Yes | Staging |
| **P2-6** | Which Cashfree account and merchant the main backend uses (C7) | [UNV] | Main backend / founder | Settlement to the wrong account | Owner confirms (no secrets) | Main backend | — | Documentation evidence |
| **P3-1** | Parity edge E1 (duplicate empty `heal_direction`) | [VS] | Website | Low (upstream GET is documented report-only) | Refuse duplicate query keys in both copies | **Website** | Yes | Offline parity test |
| **P3-2** | Production bundle not inspected for secrets | [UNV] | Website | Low (no client references in source) | Build-only check of the production output | **Website** | Yes | Offline build scan |
| **P3-3** | PayPal sandbox module, unsupported-country list, USD price and tax approvals | [VS] / [UNV] | Founder; website | Blocks international sales only | Deferred until P0/P1 are resolved and prices approved | Website | Yes | PayPal sandbox (Stage F) |
| **P3-4** | Teacher payout design (no capability today) | [VS] | Founder | — | A separate proposal (4A §10) | — | Yes | — |

**Nothing above is labelled resolved.** The 4B containment items are confirmed only for traffic through this website (§3).

---

## 11. Future isolated test plan (design only; nothing executed)

**Ground rules for every test:**
- Offline mocks (httpx `MockTransport`), a throwaway database (a separate `DB_NAME`, created and dropped by the test), or an **official provider sandbox** once that stage is approved.
- Never the main backend, production, live keys or the live preview. No email, SMS or alert: the monitor runs in memory and the email outbox is a test outbox.
- Socket-level network log; the test fails on any outside connection.
- A snapshot of the demo scope before and after must be identical.

| # | Area | Method | Pass criteria |
|---|---|---|---|
| T1 | Lock on every money route | Offline matrix over the saved API list (all money-related writes and mutating GETs) × path variants × hosts × lock state | Locked: 0 forwarded. Each route's rule id pinned. ALWAYS rules refused when unlocked |
| T2 | Per-flow unlock (after P1-3 is built) | Offline | Unlocking flow X opens only X's routes |
| T3 | Direct and alternate routes in the test environment | Offline: encoded, double-slash, case and dot-segment variants; `v1` versus non-`v1`; capture with and without id | All refused with zero upstream calls |
| T4 | Cashfree webhook authenticity | Offline signed fixtures (own test secret); then Cashfree **sandbox** deliveries | Bad or missing signature → 401/400; non-UTF-8 → 400; no writes |
| T5 | Amount and currency matching | Mock Cashfree re-read with +₹1 or another currency | Not paid; flagged; no fulfilment |
| T6 | Duplicate, delayed, replayed, out-of-order | Same body ×3, with altered idempotency header; stale timestamp; FAILED after PAID | 1 effective processing; stale refused; PAID stays PAID |
| T7 | PayPal order and capture integrity (when built) | Mock PayPal; then PayPal **sandbox** | Capture only for a server-created order; amount, currency, merchant and product matched |
| T8 | PayPal webhook | Mock verify API (SUCCESS / FAILURE / unreachable); duplicate event id; stale; wrong merchant | Matches the §6 behaviour |
| T9 | No duplicate fulfilment or ledger entries | Throwaway database; parallel deliveries; concurrent checkouts (TVR-24) | One entitlement or confirmation per order; duplicates flagged once |
| T10 | Browser redirect tampering | Offline: forged return URL, query `status=paid`, unsigned body | Only the authoritative re-read confirms |
| T11 | Unsupported country and currency | Offline grid (countries × currencies × providers × flows) | Only India + Cashfree + INR is allowed; no fallback |
| T12 | Missing approved USD price | Offline, from `pricing_rules` | Every international flow refused, except where a price is approved **and** PayPal is built |
| T13 | Payout initiation disabled | Offline (website); staging (main-backend owner) | ALWAYS 423 at the website; 410/423 upstream for every role |
| T14 | Mixed read/write separation | Offline at the website; staging upstream after the split | Reads change nothing (counts before and after); writes refused while locked |
| T15 | Sandbox-only credential isolation | Offline configuration matrix (§8) | Ambiguous or mismatched settings → fail closed; live names in preview → refused |
| T16 | No provider call to production | Network log plus a guard that fails on `api.cashfree.com`, `api-m.paypal.com` or Razorpay hosts | 0 such connections |
| T17 | No persistent business writes | Throwaway database; demo-scope snapshot identical; `git status` shows only intended files | Identical snapshots |
| T18 | No real notifications | Test outbox and in-memory monitor; SMS provider not configured | 0 sends; 0 alerts |

Provider sandbox tests (T4, T7 and T8 live parts) run **only** after the sandbox stage is approved, using the providers' documented sandbox procedures.

---

## 12. Remediation sequence and approval gates

| Gate | Stage | Contents | Owner | Needs |
|---|---|---|---|---|
| **G0** | Now | Review this report | You | — |
| **G1** | Main-backend evidence request (no code here) | A handoff asking for code-level evidence and staging results for P0-1…P0-4, P1-1, P1-2 and P1-8, and the §4.6 checklist. It extends MB-1…MB-8 | Backend owner | Your approval to send it |
| **G2** | Website hardening, offline only (call it 4D) | Per-flow unlock allowlist (P1-3); venue webhook de-duplication key (P2-1); parity edge (P3-1); TVR-24 lock (P2-2); a decision on forwarding mutating status GETs from preview (P1-2, website part); a checkout kill switch for the venue module (§8 #5) | Website | Your approval per item; the money lock stays ON |
| **G3** | Design approvals | Billing-country source (P1-5); order and state model with a paid-event reconciler (P1-4, P2-3, P2-4) | Founder plus website | Written approval |
| **G4** | Sandbox configuration | Separately named sandbox settings, selector and startup validation (§8). The owner stores sandbox credentials through the secure secrets process and empties the preview production values | Owner plus website | Credential action approval |
| **G5** | Cashfree sandbox tests | Run the 8 skipped tests plus T4–T6 and T9 against the **sandbox** | Website | Approval; no production |
| **G6** | Razorpay reconciliation | The §9 procedure | Operations plus backend owner | Separate authorisation |
| **G7** | PayPal (deferred) | Approve a USD price and tax; confirm the account; build the sandbox module; T7–T8 | Founder plus website | Approval |
| **G8** | Production enablement | One flow at a time, after G1 evidence is accepted and the residual risks signed off; matrix re-run | Founder | A separate deployment approval |

---

## 13. Unverified findings and the evidence needed

| # | Unverified item | Exact evidence needed |
|---|---|---|
| U1 | Main-backend authentication and authorisation on each money route | The owner's route-by-dependency list, plus a staging run of anonymous, other-user and non-admin calls per route (status codes only) |
| U2 | Server-side amount per `order_type` | Code reference and a staging result: a tampered amount refused for every `order_type`, including `instakyc` and `institutional_event` |
| U3 | FS-00 freeze order, its default when unset, and coverage of the F6 routes and jobs | Code reference, the default value's behaviour, and MB-4 T4-1 / T4-2 results |
| U4 | Cashfree webhook HMAC, window, de-duplication, matching and effects while frozen | MB-3 T3-1…T3-7 staging results, and the `notify_url` each order sets |
| U5 | Main-backend PayPal module: configuration, signature mode and capture binding | Whether `PAYPAL_WEBHOOK_ID` is set (yes/no), the capture code reference, and a staging forged-event test |
| U6 | Payout routes disabled upstream | Staging: 410/423 for every role on each §4.6 #6 route; the sweep removed from `list` |
| U7 | Whether status GETs write or trigger fulfilment | Code reference for `payments/cashfree/orders/{id}`, `v1/payments/orders/{id}/status` and `v1/payments/return` |
| U8 | Current validity of the Cashfree live credentials | The admin diag result through the website (`credentials_accepted_by_cashfree`), run by an authorised admin; no order created |
| U9 | Which Cashfree account the main backend uses | The owner's written confirmation (account name and activation state; no secrets) |
| U10 | Legacy Razorpay pending count and matching | §9 steps 2–5 under separate authorisation |
| U11 | Cashfree's current webhook signature scheme and tolerance for the configured API version | Cashfree's official documentation, reviewed in the sandbox stage |
| U12 | Production website bundle free of secrets | A build-only scan of the production output |
| U13 | Whether the deployed production gateway matches this source | A deployment fingerprint (as in the 26 Oct audit), from an approved, read-only process |
| U14 | PayPal account readiness | REST app (sandbox and live), Orders v2, webhook id, receiving currency, purpose code and FIRC, unsupported-country list |

---

## 14. Actions not taken

- **No source code, configuration, `.env`, secrets, database records, test fixtures, audit logs, ID counters or demo data were changed.** The only file created is this report. `PRD.md` was **not** updated, as you asked.
- **No tests were run** (your choice).
  - The only commands executed were read-only: listing files, `grep`, `git status` and `git log`, file timestamps, and parsing `.env` names and the saved API list.
  - There was one static text comparison of the two rule files, which parsed source text and imported no app modules.
  - One call to the platform's secrets list returned names and slots only, no values.
- **No call to Cashfree, PayPal, Razorpay or any provider.** No call to the main backend `pro-learn-connect-1`, its health, auth, payment, webhook or admin endpoints. No call to the live preview or production. No scanning, probing, authentication attempts or credential tests.
- **No secret value was read into the report or printed.** Only presence, the API mode (`production`) and the key naming category (`prod-style`) were derived.
- **No order, payment attempt, booking, registration, refund, payout, settlement, ledger entry, email, SMS or alert.**
- **The money lock was not lifted or weakened; checkout was not enabled.** No route was permanently blocked or unblocked.
- **No deployment, publishing, merge or promotion.**
- **No Razorpay reconciliation was performed.** No teacher was marked paid or unpaid.
- **Prompt 4D and Prompt 5 were not started.**

**What success means here:** a clear, evidence-based picture of payment security and the remaining work. It does **not** mean the system is production-secure, payment-ready or authorised to accept money.
