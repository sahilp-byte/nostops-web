# NOSTOPS — Final pre-publication gate report (preview only)

**Date:** 26 Oct 2026. **Result: 🟢 GATE PASSED.** The release is ready for your publication decision.
**Not published.** Website lock **ON**, `MONEY_OPS_FROZEN` untouched, B4.9 and B5.2 **BLOCKED**.

**This step made no runtime change.** Its only changes are evidence and documents:
- `test_reports/p0/gate_zero_upstream_check.py` / `.json`
- handoff wording in `BACKEND_HANDOFF_P0_REMEDIATION.md`
- this report and `PRD.md`

`frontend/yarn.lock` was left unchanged.

**No contact with the live main backend** in this step: no sign-in, no order, no secret read or changed, no provider
activated, no financial operation. Every check was in-process against a mock backend, or against the local engine and
the local preview database.

---

## 1. Diff result: matches, nothing added or missing
- The working-tree runtime diff vs `5db887d8`, built with the same command as the reviewed patch, is **byte-for-byte
  identical** to `/app/memory/P0_RELEASE_DIFF.patch`: sha256 `f62b576b…023c2b`, 15 files.
- The last commit `f11fec35` vs `5db887d8` gives the same patch, so the committed state equals the reviewed one.
- **No additional changes:**
  - **No untracked runtime files** in `backend/` or `frontend/`.
  - **The only uncommitted file is `frontend/yarn.lock`.** It is outside the release by your decision and was left
    unchanged.
  - **Git-ignored files** (`backend/.env`, `frontend/.env`, `next-env.d.ts`, `tsconfig.tsbuildinfo`): no code, and not
    in any diff.

## 2. Targeted review: payment-sensitive code (read-only)

**No changed path starts money moving out.**
- No added line calls a refund, wallet credit, commission, payout, transfer or escrow release. The added lines that
  contain those words are the gateway's *refusal* rules and comments.
- **Outbound calls in the changed code:**
  - `ai_onboarding.py`: two Cashfree **GET** reads only (`/orders/{id}` and `/orders/{id}/payments`). The
    pre-existing Cashfree order creation (money in) is **not** in the release diff.
  - `institutional.py` confirm: no outbound call. It updates the seat and sends a receipt e-mail once, on first
    confirmation.
  - `server.py`: forwards only what passed the checks.

**Duplicate and mismatched payments:**

| Case | AI-onboarding webhook (`ai_onboarding.py`) | Programme confirm (`institutional.py`) |
|---|---|---|
| Same event delivered again | 200 "duplicate", no second effect | Same order on a confirmed seat → `already_confirmed`, no second receipt |
| Second, different payment | Order flagged `duplicate_payment` for review. **No refund.** | Recorded once (`PARTICIPANT_DUPLICATE_PAYMENT`). **No refund.** |
| Amount, currency or order id mismatch | Not paid; `amount_mismatch` flagged; nothing granted; alert | 400, `PARTICIPANT_PAYMENT_MISMATCH` recorded, seat stays pending |
| Payment for a seat no longer pending | n/a | 409, recorded once (`…RECEIVED_NOT_PENDING`), seat unchanged |
| Paid on an earlier checkout | n/a | Matched through the kept order list; seat confirmed once |
| Processing fails | 503, event `failed`; Cashfree's retry succeeds once | n/a |
| Unknown order | 200 "ignored", no Cashfree call | 404 |

**Inbound webhook safeguards:**
- **Website's own webhook:**
  - signature and timestamp headers are required (400 if missing);
  - HMAC-SHA256 over timestamp + raw body, compared in constant time (401 on mismatch);
  - non-UTF-8 body → 400;
  - timestamp no older than 24 h and no more than 5 min in the future (pre-existing setting);
  - live notifications that reach the preview are ignored.
- **Gateway, for the main backend's webhooks:**
  - forwarded byte for byte only when signature and timestamp headers are present (any write method; otherwise 400);
  - payout and Razorpay notifications are always refused.
- **Programme confirm:** callable only server-to-server, with the shared secret compared in constant time.

**Minor observations, all safe (no change made):**
- A *repeated mismatched* programme confirm adds one audit row per attempt; the other cases are de-duplicated.
- The order `reference` is checked only when Cashfree returns one. Amount and currency are always checked.
- **A single trailing encoded newline (`%0A`) is not refused with 400.** The web framework drops it before the
  gateway sees the path, so the gateway checks and forwards the **same plain route** (§3). It is not a bypass, but it
  is narrower than the code comment "control characters → 400" suggests. Optional hardening for later.
- OPTIONS requests to write-only money routes are forwarded. They cannot move money (the upstream answers 405 or a
  CORS response).

## 3. Encoded path and Razorpay callback: zero upstream calls, lock ON and OFF
Evidence: `test_reports/p0/gate_zero_upstream_check.json`. The real gateway app runs against a mock backend that
records every request.

**174 strict cases → 0 upstream calls, 0 failures.** The cases are:
- 29 paths × 3 callers (none, bad token, admin) × 2 lock states (unset, and `true`);
- 15 encoded `?`, `#`, NUL, CR, TAB and mid-path-newline attempts on money routes;
- 12 Razorpay-callback spellings, plus HEAD and OPTIONS.

The answers:

| Answer | Cases |
|---|---|
| 400 "bad path" | 108 |
| 423 refused | 54 |
| 404 (no route matched, never forwarded) | 6 |
| 405 | 6 |

The lock-ON and lock-OFF results are identical.

**Trailing `%0A` probes (8):**
- Lock ON: refused (423), nothing forwarded.
- Lock OFF: Razorpay and mock-card routes are still refused. Money routes are forwarded only as the plain, checked
  route, which is the designed unlocked behaviour.

> **Transparency note:** the first run of this script flagged these trailing-newline cases, because my expectation was
> wrong (I classified them as a bypass class). I traced them, confirmed what the upstream would receive, corrected the
> expectation in the script and re-ran it. No code was changed.

**Also re-run (pytest):**
- `test_p0_encoded_delimiter_bypass`: 9 passed.
- `test_p0_razorpay_callback`: 123 passed. Its gateway cases run with the lock ON and OFF, and assert zero upstream
  calls.

## 4. Lock and freeze settings
- **`FINANCIAL_ACTIONS_UNLOCKED` is unset everywhere we can see:**
  - not in `backend/.env` or `frontend/.env`;
  - not in any running backend or website process;
  - not a configured app key (the secrets list was checked: names only, no values read).

  So it cannot be injected on publish. The code only *reads* it (`financial_lock.py`, `financial-lock.ts`, `api.ts`),
  and anything but exactly `true` keeps the lock on (tested).
- **`MONEY_OPS_FROZEN` appears in no website code or config file.** No code in the release diff reads, sets or
  changes it, and no environment-writing code was added. It lives only in the main backend.

## 5. Test evidence (this step)

| Suite | Result |
|---|---|
| In-process: `test_p0_freeze_gateway` (227), `test_p0_razorpay_callback` (123), `test_b51_admin_gate` (124), `test_cashfree_sandbox_guard` (36), `test_p0_cashfree_diag` (34), `test_p0_inbound_payments` (27; local engine and mock Cashfree), `test_p0_encoded_delimiter_bypass` (9) | **580 passed, 12 skipped, 0 failed** (the skips are the reviewed non-money routes). JUnit: `test_reports/pytest/p0_final_gate_suites.xml` |
| Zero-upstream gate script, lock on and off | **174/174 strict cases + 8/8 trailing-newline probes** |

**From the release review (same runtime code):**
- tsc and ESLint clean;
- `next build` OK;
- retreat check on the production build: 20/20;
- live gateway (local + preview ingress, refused calls only): 140 passed.

**Not run:** any live sign-in suite, the live diag check, or anything that contacts the live main backend.

## 6. Rollback confirmation
- **Checkpoint `5db887d8` exists** (full hash `5db887d8a1d2…`, 26 Oct 04:29 UTC). Its app code equals the
  fingerprinted production release `4e7e8ece`.
- **The reviewed patch:**
  - applies cleanly to `5db887d8`;
  - replaying it reproduces all 15 working-tree runtime files exactly (0 differences);
  - reverses cleanly on the working tree.
- **Limitations:**
  - The platform's rollback button itself was not exercised (that would change the environment). Only the git side
    was verified.
  - **Rolling back re-opens:**
    - the `%3F` / `%23` freeze bypass;
    - the 6 newly refused routes and the catch-all;
    - the Razorpay GET callback;
    - the public Cashfree diag through the website;
    - the retreat 500s.
- **Data compatibility after a rollback** (the new fields stay but the old code ignores them):
  - A webhook event left `failed` would be treated as a duplicate by the old code, so a redelivery would be
    acknowledged unprocessed. The return-page status check would still confirm the payment.
  - An order flagged `amount_mismatch` could be granted on a later status check, because the old code doesn't compare
    amounts.
  - A programme payment made on an *earlier* checkout would get 404 again.
  - No data migration is needed in either direction.

## 7. Handoff status: prepared, NOT sent
- `/app/BACKEND_HANDOFF_P0_REMEDIATION.md`:
  - **MB-1 … MB-8 are each labelled "Recommendation — not implemented"** (checked: 8/8);
  - a **"NOT SENT"** status block was added at the top, with a pre-send checklist;
  - website references now say **preview only, not yet published**;
  - internal file paths were replaced with "available on request";
  - the earlier spec is referenced by its 25 Oct attachment name.
- **Scan:** no e-mail address, phone number, key, token, account id or demo-account name in the text.
- **Recipients: not filled in.** The previous hand-off went to the main-backend contact, with a copy to the NOSTOPS
  inbox. Please confirm the exact addresses before anything is sent.

## 8. Remaining risks
- **The website gateway covers only `www.nostops.org` and its `/api`.** Direct main-backend calls, the mobile app and
  main-backend jobs are covered only once MB-1 … MB-4 are built.
- **Webhook signatures:** the gateway checks that a signature is present, not that it's valid (MB-3).
- **Shared backend:** preview shares the live main backend.
- **Cashfree:** production authentication fails (MB-5), so paid checkout is unavailable.
- **Teachers can't cancel a Fast-Track request** while the lock is on.
- **Rollback trade-offs:** see §6.

**Stopped. Waiting for your explicit publication authorization. Lock ON. B4.9 and B5.2 BLOCKED.**
