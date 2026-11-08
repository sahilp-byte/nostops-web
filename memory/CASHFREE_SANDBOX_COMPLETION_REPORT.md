# NOSTOPS — Cashfree Sandbox Completion (No Deploy) · Acceptance Report

**Date:** 2026-06 · **Environment:** preview only · **Production:** untouched (no deploy, no publish, no production
setting, credential, payment, payout or data changed). No secret values were printed, logged or pasted anywhere.

## Scope in this workspace
Cashfree runs in exactly one place here: the local, isolated **venue AI-assisted onboarding upgrade**
(`backend/ai_onboarding.py`). That is the "existing implementation" and the reported 19 passing tests
(`tests/workflow/test_wf_ai_onboarding.py`: 19 passed, 5 sandbox-only tests skipped). Bookings, InstaKYC, Fast-Track,
wallet, escrow and refunds use the **main backend's** own Cashfree account, which is outside this workspace. Those
checkouts stay **off** in preview, because that backend holds live keys.

## Results by task
| # | Task | Status |
|---|---|---|
| 1 | Rotation of the exposed production keys | **Owner confirmed rotated.** Supporting evidence: a read-only lookup of a non-existent order using the preview's copy of the old keys now gets `401` from Cashfree production (it was `404` in B4.7), so the old keys no longer authenticate. That lookup was made by the existing status test before the new guard below; preview can no longer make that call. **Not done:** the new production keys were not entered. The secure card was skipped, so the Live slots are unchanged and live payments were not enabled. |
| 2 | `WEB_APP_BASE_URL` / `CASHFREE_CHECKOUT_ORIGIN` | **Code ready, values not saved** (card skipped). Verified preview origin (it serves this site and `/api`): **`https://nostops-spaces--0fieag2d.preview.emergentagent.com`**. Whitelist exactly this origin in the Cashfree **Sandbox** dashboard. |
| 3 | "Sandbox Test Payment — No real money will be charged" banner | **Done**, on the venue checkout page and its result page. It shows only when the backend confirms sandbox for this exact preview host **and** the browser is on a preview host, so a production page can never show it. It is an inline strip, not fixed. The site-wide preview strip now reads "no real payments can be made in this preview". |
| 4 | Browser checkout on sandbox (success / cancel / failure / webhook / duplicate / entitlement) | **Not run: no sandbox keys.** The code paths are built and unit-tested (below). They are ready to run once keys exist. |
| 5 | Full and partial refunds | **Not in scope here** (owner decision: no refunds in this workspace). Booking/escrow refunds belong to the main backend; its checklist is below. |
| 6 | Rerun tests; no production fallback; missing sandbox credentials fail safe | **Done** (below). |
| 7 | Security review and report | **Done** (this file). |

## What changed
| File | Change |
|---|---|
| `backend/payment_guard.py` | `cashfree_mode()` (exact host: `sandbox.cashfree.com` / `api.cashfree.com`, https only, else "unset") and `checkout_decision()`: sandbox keys **only** on the configured preview origin (`WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN` must both equal it); live keys **only** on a production host; missing or mismatched config is refused. |
| `backend/ai_onboarding.py` | One decision for checkout **and** status reads, so preview never calls the live gateway. No default API base (unset means refused, never a silent fallback to live). In sandbox, return and notify URLs are built server-side from `WEB_APP_BASE_URL` (never the production site). Order records store `mode`. Webhook: signature, then **replay window** (24 h, epoch ms or s; fixes TVR-17), then preview isolation (applied only for this preview's own sandbox orders), then **duplicate-delivery de-dupe** (`x-idempotency-key` or a hash of the signed payload), then the authoritative re-read of the order. Status now reports the latest attempt (FAILED / USER_DROPPED), so a cancelled or failed checkout is shown as such. New secret-guarded `GET /api/ai-onboarding/checkout-mode`. Amount authority, idempotent entitlement and checkout reuse are unchanged. |
| `frontend/app/bff/venue-onboarding/checkout/route.ts` | Proceeds in preview only if the backend confirms sandbox for this host; the SDK mode must match the order's mode; otherwise 503 (fail closed). |
| `frontend/app/bff/venue-onboarding/status/route.ts`, `lib/server/venue-onboarding.ts` | Pass the public host; return `sandbox` and `last_payment_status`. |
| `frontend/components/payments/SandboxPaymentBanner.tsx` (new), `venues/ai-onboarding/page.tsx`, `.../result/page.tsx` | Banner, plus a "Payment didn't go through" state for cancelled or failed attempts. |
| `frontend/components/venues/AiOnboardingPurchase.tsx` | Browser-side check: sandbox SDK only on a preview host, live SDK never on a test host. |
| `frontend/components/payments/PreviewPaymentBanner.tsx` | Accurate preview wording. |
| `frontend/lib/offers.ts` | Type fix (`AmountCheck`) so the project type-checks cleanly (0 tsc errors). |
| Tests | new `tests/test_cashfree_sandbox_guard.py`; `test_wf_ai_onboarding.py`, `test_wf_b47_privacy_payments.py`, `test_wf_monitoring.py` made sandbox-aware. |

## Tests executed (actual)
| Suite | Result |
|---|---|
| `tests/test_cashfree_sandbox_guard.py` (environment matrix) | **36 passed** |
| `tests/workflow/test_wf_ai_onboarding.py` + `test_wf_monitoring.py` | **35 passed, 8 skipped** (skipped = need sandbox keys: order creation, reuse, abandoned checkout, closed listing, duplicate webhook, sandbox return URL, sandbox-vs-production origin, simultaneous checkouts) |
| `tests/workflow/test_wf_b47_privacy_payments.py` + `test_wf_web_bff.py` | **136 passed, 1 xfailed** (TVR-15, unrelated) |
| `tests/test_b51_admin_gate.py` | 124 passed |
| `npx tsc --noEmit` | 0 errors |
| `npm run test:pricing` | passed |
| `npm run test:tier2` | 16 passed, **2 failed: already failing in the B4.7 log**, not caused by this work (old copy checks: "landing says free", "/venues banner") |

Fail-safe evidence: with no sandbox keys, preview reports `mode: disabled`, every checkout returns 503 and **no order or
entitlement is created**. The status read returns 503 without calling the gateway. A signed live webhook reaching preview
is acknowledged and ignored. Sandbox keys with a production origin are refused (unit + live test).

## Security review of the changes
- No regression found. Every new path fails closed. The new endpoint needs the shared secret and returns no secrets.
- Amount is still server-decided. Webhooks are still HMAC-verified before anything else and still re-read Cashfree
  before granting. Entitlement upserts are still idempotent.
- Tightened: no live-gateway fallback; return/notify URLs are never taken from the client in sandbox; in production,
  test-host return URLs are refused; replay window added; duplicate webhooks recorded once.
- Residual: TVR-24 (two truly simultaneous checkouts can create two orders) is still open (xfail). The 24 h replay
  window is a trade-off for Cashfree retries.

## Outstanding manual steps (owner)
1. In the secure card, **Test** slots: `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET` = Cashfree **Sandbox** keys;
   `CASHFREE_API_BASE` = `https://sandbox.cashfree.com/pg`; `WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN` =
   `https://nostops-spaces--0fieag2d.preview.emergentagent.com`. This also replaces the old revoked keys still in the preview slots.
2. **Live** slots: the newly rotated production App ID and Secret (they take effect only at the next publish, which needs your approval).
3. Cashfree **Sandbox** dashboard: Developers → Whitelisting: add the preview origin above. Webhook URL (per order):
   `https://nostops-spaces--0fieag2d.preview.emergentagent.com/api/ai-onboarding/webhook`.
4. Then rerun `cd /app/backend/tests/workflow && python -m pytest -q test_wf_ai_onboarding.py` (the 8 skips must pass)
   and a browser checkout with sandbox UPI: `testsuccess@gocash` (paid → entitlement active), `testfailure@gocash`
   (failed → nothing granted), and closing the checkout (cancelled → nothing granted). Then check that the webhook
   events were recorded once each.
5. If the preview address changes (for example after a fork), update both origin values.

## Main backend (booking/escrow refunds): for its owner
Full and partial refunds, refund status, booking/escrow reversal, idempotency (same `refund_id` twice → one refund),
payment/refund reconciliation and failure handling are all on `pro-learn-connect-1`. They must be tested on **its** sandbox
by its owner. It should also refuse orders whose return/notify URL is not a production host
(`BACKEND_HANDOFF_B47_main_backend.md` §4).

## Remaining risks
- Sandbox flows are unverified end-to-end until the keys exist.
- The rotated production keys are not yet stored in the Live slots. Production venue checkout will fail
  (safely, "not configured") until they are, once published.
- Main-backend checkouts stay off in preview by design.
