# NOSTOPS — P0 release review: final preview report (awaiting publication authorization)

**Date:** 26 Oct 2026 (container clock). **Scope:** preview only. **Published:** NO. **Status:** release review
complete. **I've stopped and am waiting for your separate authorization to publish.** B4.9 and B5.2 remain **BLOCKED**.

**Safeguards held throughout:**
- **Lock and freeze:**
  - Website financial lock **ON**: `FINANCIAL_ACTIONS_UNLOCKED` is not set, and only the exact value `true` unlocks it.
  - `MONEY_OPS_FROZEN` **unchanged**: we neither read it nor changed it.
- **Nothing written to production:**
  - no production write, financial repair, migration, balance change, provider activation or deployment;
  - no real order or transaction;
  - no secret exposed or modified.
- **Records left alone:**
  - teacher verification and empanelment status: unchanged;
  - the ₹1,062 correction: not applied;
  - the two synthetic ledger rows: not deleted.
- **Live main backend in this phase:** **no call at all**.
  - No sign-in, no diag ping and no write.
  - Every check was in-process, against the local preview engine, through the preview gateway (refused before
    forwarding), or a read-only GET page render for the retreat check.
  - The suites that sign in demo accounts on the live backend were **deliberately not run** (§5).

---

## 1. Your decisions → what was done

| # | Decision | Done in this phase | Type |
|---|---|---|---|
| 1 | Prepare the website release review; add the Razorpay rule first | Rule and tests added. All relevant suites re-run. Production build plus retreat check on the **release build**. Release diff saved and inspected. Contents and rollback target confirmed (§3, §4). **Not published.** | Implemented (preview) |
| 2 | Main-backend fix pack MB-1 … MB-8, MB-1 … MB-4 first | `/app/BACKEND_HANDOFF_P0_REMEDIATION.md`. Every item is labelled **"Recommendation — not implemented"**. Website reference implementations are named separately. **Not sent** (you asked to prepare it). | Recommendation only |
| 3 | Cashfree: paid checkout unavailable until fixed by an authorized admin | Nothing changed. No secret read, no order, no activation. Recorded as MB-5, with steps for an authorized administrator only. | No change |
| 4 | Refuse the Razorpay GET callback regardless of the lock | New ALWAYS rule `razorpay-callback`, in the gateway and the website copy, with encoded-path tests (§2) | Implemented (preview) |
| 5 | Frozen inbound payments: Option B, queue for controlled review, no auto-release | **Website-owned flows already comply.** They record only verified, correctly associated payments, idempotently. They have no wallet, earning, commission, referral, escrow, payout or refund step, so there is nothing to queue. A second payment for a venue is only *flagged* for review; no refund is called. **Main backend:** the queue is specified in MB-3 (one row per deferred effect, `PENDING_REVIEW`, drained only by an explicit admin action after a separately authorized unfreeze, never by a job or an unfreeze hook). No automatic release is implemented anywhere. | Website: implemented. Main backend: recommendation. |
| 6 | Defer the cohort dashboard until MB-7 is fixed | Deferred. No website page was built. | No change |

---

## 2. New in this phase: Razorpay GET callback refused (decision 4)

**Rule:** `("razorpay-callback", "ALWAYS", "ANY", r"^payments/razorpay/callback(/|$)")`, the same in
`backend/financial_lock.py` and `frontend/lib/financial-lock-rules.ts`.
- **What it does:**
  - refused with **423** "This action is not available. Nothing was sent and nothing changed.";
  - applies **whatever the lock state**, for every method and every caller;
  - forwards nothing, not even the admin role check.
- **Writes to the same path:** still refused by the older `razorpay` rule.
- **Money-in status reads** (`payments/cashfree/orders/{id}`): still forwarded (control test).

**Regression tests:**
- **New file** `backend/tests/test_p0_razorpay_callback.py`: **123 tests**.
  - Rule-level, lock on and off: GET, HEAD and OPTIONS, with and without the real query (`razorpay_payment_id`,
    `razorpay_order_id`, `razorpay_signature`, `booking_id`).
  - **14 path spellings:**
    - upper case, trailing `/`, leading `/`, an `api/` prefix;
    - `//` and `./`, `x/../`, backslashes;
    - `%2F`, `%2f`, double and triple encoding (`%252F`, `%25252F`), encoded letters (`%70ayments`, `%63allback`);
    - an extra segment.
  - **5 delimiter variants** (`%3F`, `%23`, encoded query, `%00`, `%0A`) → `bad-path`.
  - **Parity:** the website copy gives the same answer for every case.
  - **Through the gateway, lock ON and lock OFF:**
    - 4 caller types (none, bad token, cookie, admin);
    - every spelling and every delimiter variant;
    - HEAD, OPTIONS, POST, PUT, PATCH and DELETE;
    - 5 retries.

    Each case asserts **zero upstream calls**.
- **Live checks** (`test_p0_live_gateway_iter.py`): 9 spellings × local gateway and preview ingress → 423
  `razorpay-callback`. Each one is pre-checked in-process and sent only when it must be refused.
- **Inventory test:** `test_p0_freeze_gateway.py` no longer skips the Razorpay callback. Every outbound or fake-payment
  route in the deployed list is now asserted refused.
- **Proof that the tests catch the gap:** on the pre-change code, **40 of the 59** new rule-level cases fail.

---

## 3. Release contents

**Rollback target (= what production runs today):** commit **`5db887d8`** (26 Oct 04:29 UTC).
- Its application code is **identical** to `4e7e8ece`: `git diff 4e7e8ece 5db887d8 -- backend frontend` is empty
  outside tests.
- The post-deployment audit matched production to `4e7e8ece` by fingerprint. Production build id
  `vBGdQaLyJtuMawvwu6Pih`; the exact deployed commit was not accessible.

**Release candidate:** `5db887d8` + the changes below (the P0 remediation committed in `0dff5560`, plus this phase).
The platform commits the working tree when this task ends. That hash isn't known in advance, so the contents are pinned
by the diff file below.

**Release diff (runtime code only):** `/app/memory/P0_RELEASE_DIFF.patch`.
- 828 lines; sha256 `f62b576bf4d66b3522266b0530f9a8ecb2d852da1411e6673445437076023c2b`.
- Command: `git diff 5db887d8 -- backend frontend ':!**/__pycache__/**' ':!frontend/yarn.lock' ':!backend/tests/**' ':!frontend/tests/**'`.

### 3.1 Runtime files (15) — these change behaviour

| File | Change | Item |
|---|---|---|
| `backend/server.py` | Refuses `?`, `#` and control characters in a decoded path (400). Unsigned payment notifications → 400. Routes the Cashfree diag to the admin-only handler. | P0, P2 |
| `backend/financial_lock.py` | 4 new rules (`paid-state-change`, `split-reassign`, `credit-issue`, `money-keyword`), plus **`razorpay-callback`** (new) and `bad-path`. Unreadable bodies are refused. | P0, decision 4 |
| `backend/cashfree_diag.py` (new) | Admin-only, minimal (4 yes/no fields), cached 60 s / 10 s, one upstream call at a time | P2 |
| `backend/ai_onboarding.py` | Venue AI-onboarding webhook (the website's own Cashfree account): event states, re-read order, id/amount/currency match, unknown order ignored, failure → 503 so Cashfree retries, non-UTF-8 → 400 | Option B |
| `backend/institutional.py` | Programme payment confirm: exact amount, currency and reference match; mismatch audited; earlier checkouts kept; duplicate and not-pending payments recorded once | Option B |
| `frontend/lib/financial-lock-rules.ts` | Website copy of the rules (same answers, tested), including **`razorpay-callback`** | P0, decision 4 |
| `frontend/lib/server/financial-lock.ts` | A non-text body counts as unreadable (fails closed) | P0 |
| `frontend/lib/api.ts` | Public GET helper obeys the lock | P0 |
| `frontend/lib/server/bff.ts` | Unauthenticated forwarder obeys the lock | P0 |
| `frontend/app/bff/institutional/participant/payment/order/route.ts` | Programme order creation obeys the lock | P0 |
| `frontend/lib/server/participant.ts` | Order read obeys the lock. Currency and reference come from the order and are never assumed to be INR. | Option B |
| `frontend/app/(public)/retreats/in/[city]/page.tsx` | Rendered per request. Slug validated. An outage is an error (5xx), not a 404. | P2 |
| `frontend/app/(public)/retreats/in/[city]/[retreat]/page.tsx` | Same as the city page, plus id validation | P2 |
| `frontend/lib/retreat-url.ts` | Strict retreat-id parsing (a malformed id returns `''`, so the page 404s) | P2 |
| `frontend/lib/server/retreat-og.tsx` | No backend call for an invalid id | P2 |

**No** new dependency, **no** environment or config change, **no** migration.
- The new database fields are additive, and legacy rows are handled:
  - `ai_onboarding_webhook_events.status`, `attempts`, `updated_at`;
  - `ai_onboarding_orders.amount_mismatch`;
  - `inst_registrations.payment_order_ids`, `paid_order_id`;
  - new audit action names.
- A webhook event row without a status counts as processed.

### 3.2 Non-runtime files (no behaviour change)
- **Tests:** `backend/tests/test_p0_freeze_gateway.py`, `test_p0_cashfree_diag.py`, `test_p0_inbound_payments.py`,
  `test_p0_encoded_delimiter_bypass.py`, `test_p0_live_gateway_iter.py`, **`test_p0_razorpay_callback.py` (new)**,
  `p0_diag_live_check.py`, `workflow/test_wf_financial_safety.py` (one expectation updated); fixture
  `tests/fixtures/main_backend_openapi_2026-10.json`.
- **Scripts:** `scripts/p0_*.py` (6), read-only audit tools.
- **Documents:** `memory/P0_REMEDIATION_PREVIEW_REPORT.md`, this report, `memory/P0_RELEASE_DIFF.patch`,
  `BACKEND_HANDOFF_P0_REMEDIATION.md`, `memory/PRD.md`.
- **Test output:** `test_reports/p0/*`, `test_reports/pytest/p0_release_review_*.xml`.
- **10 tracked `backend/__pycache__/*.pyc` files:** compiled bytecode. Python rebuilds them from the source on start,
  so they have no effect.

### 3.3 Not part of this release
- **`frontend/yarn.lock`:**
  - It has an **uncommitted** change from **25 Oct 10:56 UTC**, before the release now in production, so production
    most likely already builds with it.
  - It only adds resolutions for the `eslint` / `eslint-config-next` devDependencies already declared in
    `package.json`: 2,596 lines added; the 3 removed lines are merged header lines.
  - No runtime package version changes. This phase didn't touch it.
  - **Recommendation:** leave it as it is (decision 2 in §8).

### 3.4 What users will notice after publication
- **Retreat city and detail pages:** a missing or unknown one shows **"Page not found" (404)** instead of a server
  error. Valid ones render as before.
- **Teacher Fast-Track "cancel request":**
  - now refused with "Money actions are paused…" while the lock is on (`paid-state-change`). This was already listed in
    the reviewed P0 report §2.1;
  - a static scan of the website code found **no other website call** that the new rules refuse;
  - the wallet and payout calls the website makes are reads, or were already locked.
- **Razorpay return link:** always refused. Razorpay is retired, and the website has no page that uses it.
- **Cashfree diag:** admins get 4 yes/no fields; everyone else gets 401/403. No website page reads it.
- **Programme payments:**
  - a seat is confirmed only on an exact amount, currency and reference match;
  - a mismatch stays **pending** and is recorded for review. It is not confirmed or refunded automatically.
- **Paid checkout on the main backend:** this release doesn't change it. Until MB-5 is fixed, a customer who tries to
  pay will most likely see the existing "could not start payment" error (decision 3 treats checkout as unavailable).

### 3.5 Rollback plan
- **Target:** commit `5db887d8`. Use the platform's rollback to that checkpoint, then redeploy.
- **Data compatibility:** the additive fields are ignored by the old code, and no data change is needed.
- **⚠️ Rolling back re-opens:**
  - the encoded `%3F` / `%23` freeze bypass;
  - the 6 newly refused routes and the money-keyword catch-all;
  - the Razorpay GET callback;
  - the public Cashfree diag through `www.nostops.org`;
  - the retreat 500s.

  Prefer fixing forward. If a single area misbehaves, revert only that area's files (for example, the two retreat
  pages) rather than the whole release.

---

## 4. Release-diff inspection
- **Every runtime hunk** in `P0_RELEASE_DIFF.patch` maps to an item in §3.1.
  - No unrelated edits, debug code, secrets, URLs or ports.
  - No environment-variable reads were added beyond the existing `FINANCIAL_ACTIONS_UNLOCKED` and `BACKEND_URL`.
- **Fail-closed paths:**
  - an error in the rule check → 500 and nothing forwarded (tested);
  - an unreadable body → refused;
  - an encoded delimiter → 400 before any rule.
- **Option B:** no hunk calls a refund, payout, transfer, wallet or commission endpoint. The only Cashfree calls in the
  changed webhook code are **GET** order reads (asserted by test).
- **Build notes (pre-existing, not from this release):**
  - the production build logs "Dynamic server usage" for `/yoga-teachers/[city]`. Next.js handles it at build time
    (the page is rendered per request), and production serves `/yoga-teachers/pune` with 200;
  - the frontend production build has only one known code-size note: the retreat detail page is 788 lines.

---

## 5. Test results (this phase, 26 Oct)

| Suite | Result |
|---|---|
| In-process gateway suites: `test_p0_freeze_gateway`, `test_p0_cashfree_diag`, `test_p0_inbound_payments`, `test_p0_encoded_delimiter_bypass`, **`test_p0_razorpay_callback`**, `test_b51_admin_gate`, `test_cashfree_sandbox_guard` | **580 passed, 12 skipped, 0 failed**. The 12 skips are the reviewed left-open, non-money routes. |
| Live gateway (local :8001 + preview ingress; only calls that must be refused are sent) | **140 passed** (122 earlier + 18 new Razorpay cases) |
| `workflow/test_wf_financial_safety.py`, offline subset (rules, parity, lock default, policy gate, calculators, page-code scan) | **60 passed**. 64 deselected because they sign in demo accounts on the live backend (§7). |
| `test_participant_paid_payment_chain.py` (local institutional engine; e-mails go to the Resend test sink) | **10 passed, 1 skipped**. The skip is the real-order step, which runs only with sandbox keys, so **no order was created**. |
| TypeScript `tsc --noEmit` | **clean** |
| ESLint, the 10 changed frontend files | **clean** |
| Production build (`next build`, in a separate copy outside the repository) | **compiled successfully**. 287 pages generated. Both retreat routes are rendered per request (ƒ). |
| Retreat check against the **release production build** (live backend read-only, mock backend, outage) | **20/20** (`test_reports/p0/retreat_pages_prod_check_release.json`) |

**Earlier today, before your decisions (same code apart from the Razorpay rule):**
- full workflow suite: 121 passed, 1 skipped, 2 expected failures;
- Cashfree diag live check: 30/31 (the miss is the preview ingress rewriting Cache-Control).

**JUnit files:**
- `test_reports/pytest/p0_release_review_suites.xml`
- `…_live_gateway.xml`
- `…_workflow_offline.xml`
- `…_participant_chain.xml`

## 6. Remaining failures
- **None** in the suites run in this phase.
- **Known and expected (main backend, not this release):**
  - FIN-04 (wallet ≠ ledger, ₹2,212) and FIN-05 (fee taken twice) stay as strict expected failures until the main
    backend fixes them;
  - Cashfree production authentication fails (MB-5).
- **Infrastructure:** the preview ingress replaces the Cache-Control header. The gateway sends the right one.

## 7. Explicit limitations
- **The website gateway protects only `www.nostops.org` and its `/api`.** These are not protected until MB-1 … MB-4
  are implemented by the main-backend team:
  - direct calls to `pro-learn-connect-1.emergent.host`;
  - the mobile app;
  - main-backend jobs and retries.
- **Webhook signatures:** the gateway checks that a signature is present, not that it's valid. The main backend holds
  the key (MB-3).
- **Unverifiable from here:** `MONEY_OPS_FROZEN`, its default when missing, and whether the main backend's handlers
  check it before writing.
- **Shared backend:** preview uses the **same live main backend** as production.
- **Not run in this phase, to avoid touching the live backend:**
  - the live diag check;
  - the live-sign-in suites (`test_b47_local_admin_authz`, `test_t1_b51_admin_gateway_live`, and the live subset of
    the workflow suite).

  Their last results are from earlier runs.
- **Code changes in this phase were only the Razorpay rule and its tests.** The other code was re-tested, not
  re-reviewed line by line beyond the diff inspection in §4.
- **Static scan:** the check of website calls against the new rules (§3.4) is best-effort. A path assembled at run
  time may not be visible to it.
- **Catch-all:** it can refuse a harmless future route whose name contains a money word. That's intended (fail closed).
- **A temporary build copy** remains at `/root/relbuild`, outside the repository, about 0.6 GB on the same disk.
  It isn't part of the release and can be removed.

## 8. What I need from you
1. **Publication authorization** for the release in §3, with the lock ON. Until you give it, nothing is published.
2. **`frontend/yarn.lock` (§3.3):** leave it as it is (recommended), or restore the committed version before publishing?
3. **Fix pack:** should I send `/app/BACKEND_HANDOFF_P0_REMEDIATION.md` to the main-backend team? It hasn't been sent.

**Stopped. B4.9 and B5.2 remain BLOCKED.**
