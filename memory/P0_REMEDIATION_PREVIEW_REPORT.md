# NOSTOPS — P0 Production Safety Remediation and Website Defect Fixes (preview report)

**Date:** 26 Oct 2026 (container clock). **Scope:** preview only. **Status:** code complete in preview, **not deployed**.
**Stopped for founder review.** B4.9 and B5.2 have not started.

**Unchanged by this phase:**
- Website money lock: **ON**. `FINANCIAL_ACTIONS_UNLOCKED` is not set, and only the exact value `true` unlocks it.
- Main backend `MONEY_OPS_FROZEN` (FS-00): **not touched**. We cannot read it or change it.
- Production data: **not modified**. No payment, refund, payout, withdrawal, heal, ledger or balance write was sent.
  The ₹1,062 correction and the two synthetic ledger rows were left alone.
- Nothing was published.

**Side effects of this phase on the live main backend** (none of them financial):
- Demo admin, HR and employee sign-ins created normal session records. They were needed for the segments and diag checks.
- The Cashfree diag was called a few times. Each call makes Cashfree look up an order that doesn't exist (an authentication check only; no order or payment is created).
- `/openapi.json` was read once to build the route inventory.
- The test calls used made-up ids, and any call the gateway would forward was never sent.

---

## 1. Summary

| # | Item | Result | Where the fix lives |
|---|---|---|---|
| P0 | Inventory of money routes + fail-closed freeze at the website gateway | **Done.** 96 money routes in the deployed list (648 routes). 18 had no gateway rule: **6 are now refused**, 12 were reviewed as moving no money and left open (pinned by tests). New: a catch-all that refuses any unreviewed write whose path names a money action. **1 critical bypass found during testing and fixed** (§2.2). | Website (preview) |
| P0 | Option B: record verified inbound payments, release nothing | **Done** for the two payment flows the website owns. Signed main-backend payment notifications still pass the gateway, unchanged byte for byte. | Website (preview) + main-backend fix pack |
| P1 | Cashfree production config diagnosis | **Diagnosed, not fixed** (keys are outside our code). The main backend is set to production, keys are present, and the key type matches production, but **Cashfree rejects them (401)**. This is not a sandbox-versus-live mix-up. | Founder / main backend |
| P2 | Cashfree diag admin-only, cached, minimal | **Done at the website gateway.** The main-backend host itself still serves the full diag publicly. | Website (preview) + fix pack |
| P2 | Retreat city/detail pages 500 | **Fixed.** Unknown city or retreat now gives 404, a valid page gives 200, and a backend outage gives 5xx (never a false 404). Production-build check: 20/20. | Website (preview) |
| P2 | Cohort Segments all zeros | **Investigated (read-only).** The report matches no records at all (even "unknown" is 0), so this is a data-source or filter fault in the main backend, not a cohort-mapping fault. | Main backend |

> **Correction to my earlier message:** I said "18 money routes are locked". More exactly: the inventory found 18 routes
> with no gateway rule. **6 are now refused**, and **12 were reviewed and left open** because they record no money (§2.1).
> The catch-all also refuses any future money-named route until someone reviews it.

---

## 2. Website fixes (implemented in preview, not deployed)

Everything in this section is in **this** repository and goes live only when the website is published.

### 2.1 P0: the gateway freeze fails closed
**Files:** `backend/financial_lock.py` (gateway) and `frontend/lib/financial-lock-rules.ts` (website copy; a test checks both give the same answer for every case).

**Inventory:** `scripts/p0_money_inventory.py` → `test_reports/p0/money_inventory.json`.
- It reads the **deployed** main-backend route list (snapshot `backend/tests/fixtures/main_backend_openapi_2026-10.json`, 648 paths).
- It sorts every route that can create, release, reverse or move money, or mark something paid, into 11 categories (withdraw/payout, refund/cancel, mark-paid/settle, credit/bonus, fake payment, webhook, payment in, jobs/sweeps, etc.).
- For each route, it checks whether the gateway refuses it.
- The main backend's handler code can't be seen from here. The route list is the contract.

**Now refused while the lock is on (423, nothing forwarded):**

| Route | Rule | Why |
|---|---|---|
| `POST /retreats/{id}/reservations/{id}/cancel` | `paid-state-change` | Cancels a paid reservation without the refund rules |
| `POST /empanelment/fast-track/{id}/cancel` | `paid-state-change` | Changes a payable Fast-Track request |
| `POST /group-booking-agreements/{id}/decline` | `split-reassign` | Re-assigns a revenue split |
| `POST /gurukul/issue-credit` | `credit-issue` | Issues a credit |
| `PUT/PATCH /referrals/{id}/status` | `credit-issue` | Records referral commission |
| `POST /v1/bookings/{id}/refund-receipt/resend` | `money-keyword` | Only resends a receipt. Refused by the catch-all, which is a harmless over-block. |

**Reviewed and left open (they record no money; each is pinned in a test, so changing one is a visible decision):**
- `home/my-streak/complete`
- `lineage/vouches/{id}/decline`
- `retreats/invitations/{id}/decline`
- `retreats/partnerships/{id}/decline`
- `referrals` (create), `referrals/generate-link`, `referrals/hr-invite/{token}/register`
- `teacher-referrals/generate-link`, `teacher-referrals/notifications/mark-all-read`, `teacher-referrals/notifications/{id}/read`
- `teacher-referrals/redeem` (the main backend already answers 410 `REFERRAL_OFF`)
- `v1/referrals/digest/send`

**Fail-closed additions:**
- **Catch-all `money-keyword` rule.** Any other write whose path names a money action is refused until reviewed. The words covered are withdraw, payout, refund, wallet, escrow, ledger, settle, commission, earning, bonus, cashback, chargeback, reversal, disburse, beneficiary, bank-account, bank-verify, mark-paid, credit, release and reconcile. This covers money routes the main backend adds later without telling us.
- **Body checks fail closed.** The wallet top-up and 1:1 decline checks refuse a body they can't read as a JSON object. On the website side, a non-text body (form data, blob or stream) counts as unreadable.
- **Lock checks on paths that skipped them before:**
  - the public read helper (`lib/api.ts` `buildUrl`), so a page can't send a state-changing GET;
  - the unauthenticated auth forwarder (`lib/server/bff.ts` `forward`);
  - the programme payment-order route;
  - the participant payment-status read.
- **Error handling:** if the rule check itself errors, the gateway answers 500 and forwards nothing (tested).

**Unchanged:**
- Mock-payment and bypass routes stay refused whether the lock is on or off.
- Payments **in** (order creation that is not a wallet top-up, reserve, group-book, 1:1 booking, InstaKYC) still work.

### 2.2 P0 (critical, found during testing): encoded `?` / `#` bypassed the whole freeze
- **Cause:** a path such as `POST /api/gurukul/issue-credit%3Fx=1` reached the gateway decoded as `gurukul/issue-credit?x=1`, so no rule matched. The HTTP client then re-read the `?` as the start of a query and sent `POST /api/gurukul/issue-credit` upstream. Both the ALWAYS and LOCK rules, and the webhook signature check, could be skipped this way. We confirmed through the preview ingress that such paths do reach the gateway, using a harmless `GET /api/health%3Fx=1`.
- **No money write reached the live backend** while this was being tested.
- **Fix:** `backend/server.py` answers **400 "bad path"** to any path that contains `?`, `#` or a control character once decoded, before any rule or upstream call. The website copy (`financial-lock-rules.ts`) refuses the same paths (`bad-path`).
- **Tests:** `tests/test_p0_encoded_delimiter_bypass.py`. 6 of its 9 cases failed before the fix; all 9 pass now.

### 2.3 P0 / Option B: inbound payment notifications at the gateway
- `payments/cashfree/webhook` and `v1/payments/webhook` are **forwarded even while locked**, byte for byte with their signature headers, so the main backend can record money coming in.
- A write to them **without** `x-webhook-signature` and `x-webhook-timestamp` gets 400 and is not forwarded. This applies to any method.
- The gateway can't check the HMAC itself (the main backend holds the key). Checking it is fix pack item MB-3.
- Payout and Razorpay notifications stay refused.

### 2.4 Option B in the two payment flows the website owns
These modules are mounted in **this** website backend (`server.py`, before the proxy) and use the website's own database. They have no wallet, payout or split, so "release nothing" holds by construction. A verified payment delivers only what the customer bought (a venue entitlement or a programme seat).

> The hand-off note asked me to label these as "main-backend" changes. That would be inaccurate: they ship with the
> website. The **same pattern** is recommended for the main backend's own webhook (MB-3).

**A. Venue AI-onboarding Cashfree webhook** (`backend/ai_onboarding.py`, the website's own Cashfree account):
- Never trusts the notification body: it re-reads the order from Cashfree.
- Marks the order paid only when Cashfree's **order id, amount and currency** match the order we created. Otherwise it grants nothing, flags `amount_mismatch` and records an Error Monitor entry.
- **Idempotent with states** (`processing` → `processed` / `failed` / `ignored`):
  - a duplicate delivery is acknowledged with no second effect;
  - a failed attempt answers 503, so Cashfree retries, and it is never acknowledged as done;
  - an event still in progress answers 503 ("retry later").
- A late "failed" notice never undoes a paid order.
- A signed notification for an order we didn't create is acknowledged and ignored (no retry loop).
- A body that isn't valid UTF-8 now gets 400 instead of a 500.

**B. Institutional programme payment confirm** (`backend/institutional.py` + `frontend/lib/server/participant.ts`):
- A seat is confirmed only when the **amount, currency and reference** equal the registration. A mismatch is refused (400), recorded as `PARTICIPANT_PAYMENT_MISMATCH`, and leaves the seat pending.
- The website no longer **assumes INR** when Cashfree gives no currency, so the check can't be skipped.
- Every checkout order is kept, so a payment made on an **earlier** checkout still confirms the seat.
- A **second payment** for a seat that is already confirmed is recorded once for review (`PARTICIPANT_DUPLICATE_PAYMENT`). It is not lost, and nothing is refunded automatically.
- A verified payment for a registration that is **no longer pending** (cancelled, waitlisted, expired) is recorded once (`PARTICIPANT_PAYMENT_RECEIVED_NOT_PENDING`) and answers 409. The seat is not changed.

### 2.5 P2: retreat city and detail pages (500 → 404)
- **Root cause:** both pages were static/ISR (`revalidate = 900`, `generateStaticParams`). There are no public retreats at build time, so nothing was prerendered. On the first visit, a live fetch (`teacher-status-override-bulk`, not cached) made Next.js switch "static to dynamic at runtime", and that throws in **production builds only**. This is why preview showed 404 while production showed 500 (71 + 15 errors in the production Error Monitor).
- **Fix** (`app/(public)/retreats/in/[city]/page.tsx`, `.../[retreat]/page.tsx`, `lib/retreat-url.ts`, `lib/server/retreat-og.tsx`):
  - Both pages are now rendered per request, like the other live public pages. Data fetches stay cached, so the backend load is the same.
  - Retreat ids and city slugs are checked first, so junk, traversal or oversized slugs get 404 without calling the backend.
  - A backend outage is now an error page (5xx, retried by crawlers), never a false "not found".
- **Evidence:** `test_reports/p0/retreat_pages_prod_check.json`, **20/20 on production builds**:
  - live backend: 4 former-500 URLs → 404, and `/retreats` → 200;
  - mock backend: a valid city and detail page → 200, stale slug → 308, missing → 404, 6 malformed slugs → 404;
  - backend outage → 500.

### 2.6 P2: Cashfree diag is admin-only at the gateway
**File:** `backend/cashfree_diag.py`, wired in `server.py`.
- **Admin check on every call,** before the cache is read: signed out or bad token → 401, non-admin → 403. A cached answer can never reach them.
- **Minimal answer:** `environment`, `credentials_configured`, `credential_type_matches_environment`, `credentials_accepted_by_cashfree`, `checked_at`, `cached`, `max_age_s`. It never includes an id, key prefix, URL or raw provider text.
- **Cache:** 60 s after a success, 10 s after a failure, and only one upstream call at a time. The caller's credentials are never sent upstream. Only GET is served; other methods get 405. Headers are `Cache-Control: no-store, private`.
- **Note:** on preview, the ingress replaces every Cache-Control header, `/api/health` included. This is infrastructure; the gateway itself sends the right header.

---

## 3. P1: Cashfree production diagnosis (no secret read or printed)
Tool: `scripts/p0_cashfree_env_diag.py` → `test_reports/p0/cashfree_env_diagnosis.json`.

| Check | Main backend (production) |
|---|---|
| Environment (API base and declared env agree) | **production** (`is_sandbox: false`) |
| Client id and secret configured | **yes** |
| Key type matches the environment (production key on the production API) | **yes** |
| Cashfree accepts the credentials | **no**: HTTP 401 "authentication Failed" |

**Conclusion:** this is not a sandbox-versus-live mix-up. The production keys are present and of the right type, but Cashfree refuses them. **Paid checkouts on the main backend will most likely fail** (1:1, retreat, programme, InstaKYC, Fast-Track). No checkout was tried, because it would create a real order.

**Likely causes, most likely first** (all on the Cashfree dashboard or in the main-backend settings):
1. The App ID and Secret are not a pair: one was rotated or regenerated, or they come from different apps.
2. The secret was copied with a missing character or extra spaces when it was set.
3. Payment Gateway production access is not active, or was suspended, for this merchant account (KYC or activation).
4. IP allow-listing is on in Cashfree and the main backend's outgoing IP is not listed.

**Website's own Cashfree** (venue AI onboarding, preview): production keys, key type matches. The preview refuses live-key checkouts by design (`preview_live_keys`). The website's **production** setting can't be read from here (UNKNOWN).

---

## 4. P2: Cohort Segments all zeros (read-only investigation)
Tool: `scripts/p0_segments_readonly.py` → `test_reports/p0/segments_investigation.json` (GET only, demo admin and HR).

| Source (same main backend) | Value |
|---|---|
| `/v1/stats/segments`, periods all / 30d / 90d / 12m | **0** organisations and **0** group bookings in every period. "unknown" bucket also **0**. |
| `/platform-stats` | 15 organisations, 15 corporates |
| `/dashboards/admin-stats` | 63 bookings (58 active, 1 completed) |
| `/mission/my-company` (demo HR) | 1 batch, 5 enrolled |
| `/bookings/hr/payment-summary` (demo HR) | 255 enrolled, 1 batch to act on |
| `/hr/me` (demo HR) | `cohort_type` is set on the HR sign-up record |
| Bad period value | 400 with the list of allowed values (validation works) |

**What this rules out:**
- **Cohort-type mapping:** a mapping fault would put records into "unknown", but "unknown" is 0 too.
- **Reporting period:** "All time" is also 0.

**Most likely causes, for the main-backend team to confirm in code:**
1. **Type mismatch on `created_at`.** The "all time" query still applies `until = now`. If `created_at` is stored as text in those collections but compared with a date (or the other way round), MongoDB matches nothing.
2. **Wrong source collection** for organisations and group bookings. The other reports above count 15 organisations and 63 bookings.
3. **A filter that no stored record passes.**

The report holds no individual financial data (only counts and percentages), and non-admins get 403. There is **no website page** for it yet. I recommend adding one only after the numbers are fixed.

---

## 5. Main-backend fix pack (recommendations — NOT implemented; the main backend is a separate codebase)
Each item lists the change, why it's needed, and an acceptance test the team can run safely. Use made-up ids, and an
amount below the minimum wherever a body is needed.

**MB-1 (P0) — FS-00 freeze checked first, on every money route, and on by default.**
- **Change:**
  - Make the `MONEY_OPS_FROZEN` check the **first** step (before the id lookup and before validation) on every route in `test_reports/p0/money_inventory.json` whose direction is outbound or fake-in.
  - Treat a **missing or unreadable** setting as frozen; unfreeze only on an explicit `false`.
  - Check the freeze again inside the handler, right before any ledger, wallet or payout write.
- **Why:** production answered 404 instead of 423 on 1:1 complete, 1:1 reassign, 1:1 student cancel, complete-pilot and v1 booking complete (audit F6). So the freeze isn't checked first, and the mobile app and direct callers aren't covered by our gateway. The 6 routes in §2.1 need the same check.
- **Test:** for each route, a direct call with a made-up id → `423 FS00_MONEY_FROZEN`, never 404. Start the service with the setting removed → still 423.

**MB-2 (P0) — retire every fake-payment route.**
- **Change:** answer **410** on `empanelment/fast-track/{id}/pay`, `premium-sessions/book`, `bookings/{id}/pay`, all `payments/razorpay/*` (including the **GET** `payments/razorpay/callback`), `empanelment/fast-track/{id}/razorpay-create|verify` and `payments/cashfree/mock-checkout`, with no body processing.
- **Why:** they mark things paid from a card number alone (audit D-2 / FIN-03). The website refuses them, but direct and mobile calls reach them. The Razorpay GET callback is not refused at our gateway (see decision 4).
- **Test:** each route gets 410 when signed out, as a teacher and as an admin, and no booking, empanelment or ledger record changes.

**MB-3 (P0) — inbound payment notifications follow Option B.**
- **Change** for `payments/cashfree/webhook` and `v1/payments/webhook`:
  1. Verify the HMAC on the **raw bytes** (non-UTF-8 → 400) and allow a timestamp window of 5 minutes at most.
  2. Keep an idempotency record with states `processing` / `processed` / `failed` / `ignored`. A duplicate gets 200 with no effect. A failure gets 5xx so Cashfree retries. A signed notice for an unknown order is acknowledged and ignored.
  3. **Re-read the order from Cashfree**, and require order id, amount and currency to equal the local order. On a mismatch, mark nothing paid and flag the order.
  4. While frozen, **record** the payment and the booking's paid state, but **create no wallet credit, hold, escrow release, commission, referral credit or payout**. Queue those as `deferred_while_frozen` entries for review at unfreeze (see decision 5).
  5. A late "failed" notice must never undo a paid order. A second payment for the same item is recorded for review, never auto-refunded while frozen.
- **Reference implementation:** the website's own `backend/ai_onboarding.py` webhook and `institutional.py` confirm (§2.4) and their tests `tests/test_p0_inbound_payments.py`.
- **Test:** with a sandbox order, send a signed notice 3× → one payment record and no wallet or ledger row. Wrong amount → not paid and flagged. Bad signature → 401. Stale timestamp → 400.

**MB-4 (P0) — scheduled jobs and sweeps obey the freeze.**
- **Change:** check the freeze inside every scheduled or retried job, not just at the route: payout sweep (cooling → eligible), `check-expired-pilots`, `auto-expire-unresponsive`, `claims/sweep-fallback`, any nightly release or commission job, and any retry queue. Log every skipped run.
- **Why:** jobs don't pass through any route. Audit F8 couldn't check them.
- **Test:** with the freeze on, trigger each job once → no ledger, wallet or payout change, and a "skipped: frozen" log line.

**MB-5 (P1) — fix the Cashfree production credentials.**
- **Change:**
  1. In the Cashfree **production** dashboard, take the App ID and Secret from the **same** app; regenerate the secret if unsure.
  2. Confirm Payment Gateway production access is active.
  3. Turn IP allow-listing off, or add the backend's outgoing IP.
  4. Set the values again (no spaces), restart the service, and **don't create an order**.
- **Test:** the admin diag through the website shows `credentials_accepted_by_cashfree: true`.

**MB-6 (P2) — make the main-backend diag admin-only too.**
- **Change:** `GET /api/payments/cashfree/diag` on the main-backend host requires an admin. It returns only the 4 yes/no fields from §2.6, and the Cashfree check is cached for at least 60 s.
- **Why:** our gateway shields `www.nostops.org`, but the main host still shows the environment, the last 4 of the client id, the key prefix and the URLs to anyone, and pings Cashfree on every call (audit D-4).
- **Test:** signed out → 401, teacher → 403, admin → the 4 fields only, and two quick calls cause one Cashfree check.

**MB-7 (P2) — fix the Cohort Segments counts.**
- **Change:** confirm the source collections and the `created_at` type (§4). Make "All time" apply no date filter, and compare dates as the same type.
- **Test:** for "all", `totals.organisations` equals the organisation count from `/platform-stats` (15), and group bookings are above 0. Percentages add up to 100% including "unknown".

**MB-8 (P1, carried over, not re-verified here)** — FIN-02 (withdrawal OTP not enforced), FIN-04 (₹1,062 owed, the wrong-sign row and the 2 synthetic rows), FIN-05 (15% fee taken twice; 85% "withdrawable" display) and FIN-10 (withdrawals never paid out). Spec: `/app/BACKEND_HANDOFF_FINANCIAL_SAFETY.md`.

---

## 6. Test results

**Re-run in this session, 26 Oct:**

| Suite | Result |
|---|---|
| `test_p0_freeze_gateway.py`, `test_p0_cashfree_diag.py`, `test_p0_inbound_payments.py`, `test_p0_encoded_delimiter_bypass.py` (in-process, mock upstream) | **296 passed, 13 skipped, 0 failed**. The 13 skips are the 12 reviewed left-open routes and the Razorpay GET callback. |
| `test_p0_live_gateway_iter.py` (local gateway + preview ingress; only sends calls the gateway must refuse) | **122 passed** |
| `tests/workflow/test_wf_financial_safety.py` | **121 passed, 1 skipped, 2 expected failures**. The 2 are FIN-04 and FIN-05, waiting on the main backend. |
| TypeScript (`tsc --noEmit`) | **clean** |

**From earlier in this phase (testing agent, iteration 175):**
- 7 money routes × 7 path variants (upper case, `%2F`, `//`, `./`, trailing `/`, leading `//`) → 423 with the right rule: **98/98**.
- Wallet top-up and unreadable bodies, plus unsigned webhooks: **24/24**.
- Cashfree diag live check: **30/31**. The one miss is the preview ingress rewriting Cache-Control.
- Retreat production-build check: **20/20**.

**Not re-run today, to avoid side effects:**
- the live diag check (it pings Cashfree and signs in demo accounts);
- the retreat production-build check (it needs throw-away production builds).

---

## 7. What the website gateway can't protect (residual risk)
- **Calls that skip the website:** direct calls to `pro-learn-connect-1.emergent.host`, the mobile app, and the main backend's own jobs. Only MB-1 to MB-4 close these.
- **Webhook signatures:** the gateway checks that a signature is present, not that it's valid (MB-3).
- **Shared backend:** preview uses the **same live main backend** as production.
- **Over-blocking:** the catch-all may refuse a harmless new route whose name contains a money word. That's intended (fail closed); each one is reviewed when found.

---

## 8. Decisions for you
1. **Publish the website fixes (§2)?** I recommend publishing them all together, with the lock kept ON. Nothing in them unfreezes money.
2. **Send the main-backend fix pack (§5)** to the main-backend team, the same way as last time (rajiv.dabhadkar@gmail.com, with a copy to nostops.org@gmail.com)?
3. **Cashfree keys (MB-5):** someone with access to the Cashfree production dashboard needs to check the App ID and Secret pair. Until then, treat paid checkouts as unavailable.
4. **Razorpay GET callback:** also refuse it at our gateway? I recommend yes, because Razorpay is retired. It's a one-line rule change plus tests.
5. **Option B detail:** while frozen, should a paid booking still put a "held" (not withdrawable) amount in the teacher's wallet? I recommend **no**: queue it for review at unfreeze, so nothing moves into a wallet while frozen.
6. **Cohort dashboard page:** add a website admin page only after MB-7 is fixed?

**B4.9 (payouts and billing) stays BLOCKED until you approve this report. Stopped here.**
