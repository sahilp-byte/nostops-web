# NOSTOPS — Main-Backend Financial Safety Audit (read-only)

**Status:** The money lock is ON in preview. Nothing was published or deployed. No payout, refund, withdrawal, balance
or ledger row was created, changed or "healed". **B4.9 has not started.** Everything below waits for your review.

- Evidence: one read-only snapshot, `/app/test_reports/fin_audit/evidence.json` (29 GET calls, demo accounts, bank / UPI /
  phone / name values masked, collected 25 Oct 2026 12:20 UTC by the container clock).
- Reconciliation: `/app/test_reports/fin_audit/reconciliation.json` (script `/app/scripts/fin_reconcile.py`).
- No new calls were made to the main backend for this report (your choice).
- **Code evidence.** The main-backend code was developed inside this project until 28 Aug 2026. We read its last
  version from the project history; nothing was run. The live backend may have changed since, so the main-backend team
  must confirm each point. See §3a.
- The technical fix list for the main-backend team is in `/app/BACKEND_HANDOFF_FINANCIAL_SAFETY.md`.
- All amounts are on **QA / demo accounts** (teacher.demo, guru.demo). We found no proof that a rupee of real teacher
  money has left the company through the session wallet. We **cannot rule it out** for the v1 wallet or the referral
  wallet (see §5).

---

## 1. In one minute

| # | Finding | Severity | Who fixes |
|---|---|---|---|
| FIN-01 | **Opening a page changes payout state.** Four main-backend GET routes write data: the payout list and sweep, the wallet "heal" and the mock checkout. Our admin pages called the payout list on **every admin page view** since Sep 2026. | 🔴 P0 | Main backend (website part done) |
| FIN-02 | **Withdrawals without PIN or OTP.** Three withdrawal routes need neither PIN nor OTP: v1 withdraw, referral withdraw and payout request. The payout request also has **no balance check**: any amount from ₹1,000, to any account typed in. On the normal wallet, the OTP for ₹5,000 or more is **never checked** (code confirmed). | 🔴 P0 | Main backend + website |
| FIN-03 | **Fake cards are accepted.** Three main-backend routes mark something "paid" from a card number that passes a checksum. A fourth, a GET, fires the payment confirmation itself. 18 Fast-Track fees, 3 premium sessions and 7 Cashfree orders are recorded "paid" this way. | 🔴 P0 | Main backend (website part done) |
| FIN-04 | **The wallet doesn't match its ledger.** The gap is ₹2,212, and every rupee is traced. Worse, ₹96,909 of the balance is not backed by any earning. Escrow money was counted as spendable, and a wallet "heal" in July papered over it. **Every new withdrawal widens the gap** (code confirmed). | 🔴 P0 | Main backend |
| FIN-05 | **The 15% fee was taken twice.** It was taken at credit and again on all 7 past withdrawals, so the teacher lost **27.75%**, not 15%. The withdrawal fee was removed on 26 Jul, but the wallet still says only 85% of the balance can be withdrawn. | 🔴 P0 | Main backend + your decision |
| FIN-06 | **Two wallet systems.** The current `teacher-wallet` and a second `v1` wallet use different sign-ins and different rules. | 🟠 P1 | Your decision, then main backend |
| FIN-07 | **Escrow is counted as spendable.** All ₹2,81,457 "held" is retreat money. Before the July heal, it was also counted in the withdrawable balance. The retreat payout views show ₹0. | 🟠 P1 | Main backend |
| FIN-08 | **Payouts are allowed before verification.** Withdrawals go through with KYC, PAN and bank all unverified. The v1 bank-account route marks a bank "verified" without any check. | 🟠 P1 | Main backend + your decision |
| FIN-09 | **Three different Fast-Track splits.** The backend shows 85/15, 15% to the company and a 30% reviewer share. Reviewer earnings are also built from mock-paid fees and paid on rejections. | 🟠 P1 | Your decision, then main backend |
| FIN-10 | **Withdrawals that never pay out, plus bookkeeping gaps.** The current wallet's "withdraw" only writes a "pending" row; nothing sends the money or returns it (code confirmed). teacher.demo has ₹5,175 debited and unpaid. The referral "withdraw" is a mock. One withdrawal is missing from the "withdrawn" counter (₹700). One order is "paid" while its booking is still "pending payment". | 🟠 P1 | Main backend |

---

## 2. The lock: what is paused now, and what is not

**Paused**, in two places: the website and our `/api` gateway. A paused call answers *"Money actions are paused…
Nothing was sent and nothing changed"* and never reaches the main backend.
- **Money out:** withdrawals on all wallets (current, v1 and referral), payout requests, wallet PIN setup and change,
  payout bank / UPI changes, and v1 bank-account changes.
- **Admin payouts:** the payout list and sweep (they change state on a read), approve and reject.
- **Refunds:** Cashfree refunds, retreat cancel-with-refund, 1:1 student cancel, a teacher declining a paid 1:1
  booking, auto-expiry refunds and batch-booking cancellation.
- **Credits and releases:** wallet top-ups, "mark paid" (retreat and batch), 1:1 complete or reassign (releases escrow),
  pilot completion and split agreements, the Fast-Track decision (it realises the split), and v1 referral credits.
- **Wallet heal:** allowed **only** as `heal_direction=report_only`, for admins.
- **Always refused, lock or no lock:** mock checkout, mock-card payment routes, the self-empanel bypass and the old
  Razorpay routes.

**Still working:**
- Every balance, history and earnings page (read-only). The wallet page shows the balances with a notice in place of
  the money forms. The admin Payouts page shows a notice and loads nothing.
- **Payments in** still work: 1:1, retreat, InstaKYC and programme checkouts. While the lock is on, those payments
  **cannot be refunded through the website**. Tell us if payments in should pause too (decision F-3).

**Not covered by our lock (important):**
- The lock exists **in preview only**. Any website build published before today still has the old admin badge, which
  runs the payout sweep on every admin page view.
- It does not cover the NOSTOPS mobile app or anyone calling the main backend directly.
- Only the main-backend team can close those. That is the first item in their spec (FS-00: a server-side money switch).

**Tests:** `backend/tests/workflow/test_wf_financial_safety.py`.
- The 56 offline checks were re-run today and pass. They cover every lock rule, a check that the website and gateway
  copies give the same answer, and the reconciliation calculator.
- The live-read checks were not re-run today, on your instruction. The last saved log predates the final wallet-page
  test fix, and the previous session reported them passing after that fix.
- Two checks are expected to fail until the main backend fixes FIN-04 and FIN-05.

---

## 3. Findings

### FIN-01 — Opening a page changes payout state (P0)
**What happens.** Four main-backend routes change data on a plain GET (a page view, a link preview, a prefetch or a
crawler):

| Route | What it changes |
|---|---|
| `GET /admin/payouts/list` | Runs the "cooling → eligible" payout sweep (the backend's own description: "also runs on /list") |
| `GET /admin/payouts/sweep` | Runs the same sweep |
| `GET /admin/wallet/reconcile?heal_direction=wallet_to_ledger` or `ledger_to_wallet` | Writes a ledger adjustment or overwrites a wallet balance |
| `GET /payments/cashfree/mock-checkout/{order}` and `…/complete` | Fires the payment confirmation itself and marks the order paid (mock mode) |

**Evidence.**
- Our website called `GET /admin/payouts/list` from the admin sidebar badge on **every admin page** from 11 Sep 2026.
  The admin Payouts page also called it from 16 Jul 2026, and called `/sweep` from 11 Sep 2026.
- The preview talks to the live main backend, so every admin page view in that period may have moved payout states.
- Ledger row `wl_recon_877e6523f3fa` (25 Jul 2026, 16:38 UTC) is a **₹96,909 adjustment written by a GET** "heal"
  (see FIN-04).
  - No website code ever sent `heal_direction`.
  - The project history shows it was run during a main-backend development session, "P0 Wallet Ledger Drift Fix". The
    commit 3 minutes later recorded "zero drift" as a pass.
- In the code, the sweep only promotes entries whose 48-hour cooling window has already ended. So page views did not
  make payouts eligible early, but they did it on a read, with no record of who triggered it.
- 7 Cashfree orders were turned "PAID" in mock mode (see FIN-03).

**Risk.** Payouts become "eligible" without anyone deciding it. Balances can be rewritten by opening a link. The order
of events can't be reconstructed from who clicked what.

**Done on our side.**
- The badge no longer asks for payouts.
- The Payouts page loads nothing while locked.
- Both routes are refused at the website and the gateway. A test proves that 8 admin page views leave the teacher's
  payout records unchanged.

**Main-backend fix.**
- Make all four routes side-effect-free. Move the sweep and heal to admin POST actions with a confirmation and an
  audit row.
- Turn mock checkout off in every non-test environment.
- From their own logs, list every payout whose state changed through `/list` or `/sweep` since 16 Jul 2026.

### FIN-02 — Withdrawals without PIN or OTP (P0)
**What happens.** These are the request bodies each route accepts, from the main backend's API list and its code
(§3a):

| Route | Needs | Missing |
|---|---|---|
| `POST /teacher-wallet/withdraw` | amount, **PIN**, method | **No OTP.** The code checks the PIN, a ₹500 minimum and the balance. It **never checks the OTP token**. The ₹5,000 OTP threshold is defined but unused. |
| `POST /teacher-wallet/withdraw/otp/start` | phone, purpose (defaults to "login") | The code uses the phone on file. It uses a **typed-in number only if none is on file**. |
| `POST /teacher-wallet/withdraw/otp/verify` | phone, code (the general **login** OTP form) | Issues a 10-minute "withdrawal token" that **nothing ever reads**. |
| `POST /v1/payouts/withdraw` | **amount only** | No PIN, no OTP. It does need a Cashfree-verified bank account, with a 60-minute gap between withdrawals. It debits the wallet and asks Cashfree Payouts for a **real bank transfer**. |
| `POST /teacher-referrals/withdraw` | **amount only** | No PIN, no OTP. It is also a mock: it marks referral money "withdrawn" and sends nothing. |
| `POST /teachers/me/payout-request` | amount (₹1,000 minimum) + **any account text** | No PIN, no OTP, **no balance check**. It files a "pending" payout request to whatever account is typed in. |
| `POST /v1/teachers/me/wallet/bank-account` | holder, account number, IFSC | No PIN, no OTP. Marks the account **verified without any check** (the backend's own note). |

**Our website's part.**
- The wallet page asked for an OTP on large withdrawals, but it never passed the OTP result to the withdrawal. The
  OTP step was **cosmetic**.
- The website never called the v1, referral or payout-request routes.

**Risk.** Anyone who gets a teacher's sign-in can:
- file a payout request for any amount to their own account (no PIN, no balance check), which is paid if anyone acts
  on these requests;
- withdraw the referral wallet;
- on the normal wallet, take out any amount with just the 4-digit PIN.

**Fix.**
- **Main backend:** one withdrawal route with PIN, plus an OTP sent only to the registered phone. The OTP must be bound
  to the teacher, the amount and a single use, and it is required at or above the threshold. Retire or lock the v1,
  referral and payout-request routes. A payout destination change needs PIN + OTP and a cooling period before the next
  payout.
- **Website (after your approval):** send the OTP authorisation with the withdrawal.

### FIN-03 — Fake cards are accepted (P0)
**What happens.**

| Route | Check made | Effect |
|---|---|---|
| `POST /empanelment/fast-track/{id}/pay` | Card number checksum + future expiry, "no real charge" | Marks the ₹4,999 Fast-Track fee **paid** and notifies the Council |
| `POST /premium-sessions/book` | Mock card, **anonymous allowed** | Books a "paid" 1:1 session and credits the teacher's share |
| `POST /bookings/{id}/pay` | None (a deprecated mock) | Marks a whole batch "pilot active". Off only if a server setting is turned on. |
| `GET /payments/cashfree/mock-checkout/{order}/complete` | None | Fires the payment confirmation (mock mode) |

Any well-known test card number passes a checksum. We did **not** try one on the live backend, on your instruction.

**Evidence (records already marked paid this way).**
- **18 Fast-Track requests** are recorded as paid ₹4,999 by "card_mock" (₹89,982 in total).
  - 17 are demo seed data.
  - **`ef_aad45e0ad440` is not seed data**: paid by mock card on 13 May 2026, then approved.
- **3 premium sessions** for teacher.demo are "paid" by `credit_card_mock` (`mock_txn_…`) at ₹1,500 each. The teacher
  sees ₹3,825 "earned".
- **7 Cashfree orders** are "PAID" in mock mode (Aug–Sep 2026):
  - a ₹500 wallet top-up and two ₹799 InstaKYC orders for teacher.demo;
  - two ₹799 generic orders;
  - one ₹1,250 1:1 order (`order_33572aa0888244b9`, see FIN-10).
- Cashfree is now in **production** mode.

**Risk.** Empanelment, sessions, Council reviewer earnings and referral bonuses can all be created from money that
never arrived.

**Done on our side.** The gateway and website refuse all four routes, always. The website never called them.

**Main-backend fix.**
- Remove the mock-card routes from production, or make them return 410.
- Turn mock mode off outside tests.
- Flag every record paid by `card_mock`, `credit_card_mock`, `mock_txn_*` or a mock-mode order. Exclude them from
  earnings, empanelment evidence, referral bonuses and revenue.

### FIN-04 — The wallet does not match its ledger (P0)
The main backend's own **report-only** check, run once across all wallets, finds **one** wallet with drift: teacher.demo.

| | ₹ |
|---|---|
| Wallet balance | 91,743 |
| Ledger: releases + adjustments + withdrawals | 93,955 |
| **Gap (ledger higher)** | **2,212** |
| Withdrawal `wl_7d013798d0564c9a` (26 Jul, ₹575) saved as **+575 instead of −575**. The wallet was debited correctly; the ledger counts it twice. | 1,150 |
| Release `wl_090d507cf3c14a4a` (26 Jul, ₹1,062) is in the ledger but was **never added to the wallet**. The teacher may be owed ₹1,062. | 1,062 |
| **Unexplained** | **0** |

**The bigger problem: ₹96,909 of the balance has no earning behind it.**
- On 25 Jul 2026 a GET "heal" (`wallet_to_ledger`) wrote adjustment `wl_recon_877e6523f3fa`: *"wallet ₹92,318, ledger
  was ₹−4,591"*. It made the ledger agree with the wallet, instead of finding out why they differed.
- Before that heal, the teacher had **withdrawn ₹4,600 while only ₹9 had ever been released** (ledger −₹4,591).
- The wallet's ₹92,318 at that moment equals, **to the rupee**: every hold (₹96,911) − hold reversal (₹2) + releases (₹9)
  − withdrawals (₹4,600).
  - So the wallet counted money **still in escrow**, mostly 4 undelivered retreat reservations worth ₹96,900, as
    spendable.
  - It also counted each released session a second time.
- Those same retreat holds are still counted in "held" too. **Today's withdrawable ₹77,981 rests on escrow money.**
- **The code confirms this.** Until 25 Jul 16:41 UTC, the wallet helper added *every* ledger amount, holds included,
  to the spendable balance. That session fixed the helper, then ran the heal. The heal wrote the ledger **up** to the
  inflated wallet instead of bringing the wallet **down**.
- **The wrong-sign row is a live bug** (code confirmed). The withdraw route passes a positive amount, and the helper
  stores it unchanged while debiting the wallet. **Every withdrawal since 25 Jul is saved with the wrong sign, and each
  one widens the gap by twice its amount.**
- **The ₹1,062 release.** The normal release path does credit the wallet. These two rows were written 1 second apart,
  at a time when automated tests with ₹1,250 bookings were being run. They were probably written outside the normal
  path. The main-backend team must check their logs.

**Risk.**
- Payouts of money that isn't earned yet (a retreat could still be cancelled and refunded).
- A teacher owed ₹1,062.
- The report-only check now looks almost clean, because the heal hid the real gap.

**Fix.**
- **Main backend:** the wallet balance is computed from the ledger, never stored separately. Holds never count as
  spendable. Withdrawals are always stored negative. Each release credits once.
- **No heal** without your written sign-off. Repair rows are reversible, each with a reason. Any heal rewrites a
  teacher's balance, so decision F-4 is yours.

### FIN-05 — The 15% platform fee was taken twice (P0)
- **At credit.** 19 retreat holds are stored net of 15%: gross ₹3,31,125, fee ₹49,668, credited ₹2,81,457.
  - The ₹1,062 session hold also matches a ₹1,250 session less 15%.
  - Premium sessions are split 85 / 15 at booking.
- **At withdrawal.** All 7 withdrawals carry a further 15% fee (₹776.25 in total; for example ₹575 → ₹86.25 fee →
  ₹488.75).
  - The code charged this fee until **26 Jul 2026 02:31 UTC**, when it was removed ("no additional fee at
    withdrawal"). All 7 withdrawals are older than that.
  - **The balance screen still shows withdrawable = balance × 85%** (₹91,743 → ₹77,981), which has been the case since
    13 Jun.
  - So today teachers are told they can take out 85%, while the withdraw route checks the full balance and charges no
    fee (August code).
- **Example (before 26 Jul):** a ₹12,000 retreat seat credits ₹10,200 and pays out ₹8,670. NOSTOPS keeps ₹3,330
  (**27.75%**) against the advertised 15% (₹1,800).
- **Fix:** take the fee **once** (your decision B9-2; we recommend at credit, because that is what teachers see on
  every row). Remove the 85% from the balance screen. Refund the ₹776.25 over-charged on past withdrawals.

### FIN-06 — Two wallet systems (P1)
- **The current `teacher-wallet`:** normal sign-in, PIN, used by the website.
- **The v1 Cashfree Payouts wallet:** its own sign-in (our normal sign-in gets "Invalid or expired session"; the admin
  view needs a separate admin key). It withdraws with amount only: no PIN or OTP, but a Cashfree-checked bank account
  is required.
- We could not read the v1 wallet, so **we do not know what money is in it, or whether it has paid anything out.**
- **Fix:** you pick one source of truth (B9-1). The main-backend team then retires or locks the other and reconciles
  both into it.

### FIN-07 — Escrow is counted as spendable (P1)
- The whole ₹2,81,457 "held" is 19 retreat reservations, and none has been released.
- The teacher's retreat payout view and the admin retreat payout ledger both show **₹0 held, ₹0 settled, 0 batches**.
- So retreat escrow is tracked in the wallet but not in the retreat payout system. Before July, it was also counted as
  spendable (FIN-04).
- **Fix:** one escrow record per reservation, released only after delivery, and visible in both places.

### FIN-08 — Payouts before verification (P1)
- teacher.demo has bank and UPI on file, but KYC, PAN and bank are **all unverified**. It still made 7 withdrawals.
- `v1/teachers/me/wallet/bank-account` marks a bank "verified" with no check. The v1 withdraw separately requires a
  Cashfree bank check.
- **Fix:** you decide the payout rule (B9-3). We recommend KYC + bank penny-drop verified, plus empanelled. The main
  backend then enforces it on every withdrawal route.

### FIN-09 — Fast-Track split: three different numbers (P1)
| Source | Says |
|---|---|
| Fast-Track decide route (backend description) | 85% guru / 15% company |
| Admin revenue summary | 1 fee, ₹4,999 → guru ₹4,249.15 / company ₹749.85 |
| Guru earnings (guru.demo) | 30% reviewer share, ₹1,499.70 × 14 reviews = **₹20,995.80**, **including 2 rejections**, all from mock-paid fees |

**Fix:** your decisions B9-4 and B9-5. Then the main backend uses one figure everywhere, and counts only gateway-paid
fees.

### FIN-10 — Withdrawals that never pay out, and bookkeeping gaps (P1)
- **Withdrawals never leave.**
  - In the code, `teacher-wallet/withdraw` debits the wallet and writes a "pending" row. That is all: no transfer is
    requested, and we found no code that pays those rows out or returns them.
  - teacher.demo's 7 withdrawals (₹5,175, Jun–Jul 2026) are still "pending", and the payout statements show ₹0 paid.
  - **For a real teacher, this means money taken out of their wallet and never paid.**
- **Referral "withdraw" is a mock.** It marks the money "withdrawn" ("Mock UPI/bank transfer") and sends nothing.
  - Two such withdrawals (₹500 and ₹150) have been "processing" since May 2026.
  - One ₹2,000 withdrawal is marked "paid" to an ICICI account ending 4521. Whether that was real is unknown.
- **Withdrawn counter.**
  - The counter shows ₹4,475, but the ledger debits add up to ₹5,175. The first withdrawal, `wd_8f4057cf889e` (₹700,
    13 Jun), is not counted.
  - *Correction:* the B4.9 readiness report gave a ₹450 gap. That figure netted the wrong-sign row (FIN-04).
- **Paid order, unpaid booking.** `order_33572aa0888244b9` (₹1,250, mock mode) is "PAID", but its booking
  `oob_e6bd5a74ee4149` is still "pending payment". With a real payment, that would be a learner charged for a
  booking that never confirmed.

---

## 3a. What the main-backend code confirms
Source: the project history. This is the last version kept here, as of 28 Aug 2026 (`4089ab92^`). It was read only,
never run.

| Finding | Where in the code | What it does |
|---|---|---|
| FIN-01 | `routes/payout_escrow.py` `list_payouts` (L455–462), `trigger_sweep` (L555) | Both GETs run `sweep_cooling_to_eligible()`, which updates many `payout_escrow` rows at once (cooling → eligible) |
| FIN-01 / 04 | `routes/wallet_helpers.py` `reconcile_wallets` (L182+) | A GET with `wallet_to_ledger` inserts adjustment rows into `teacher_wallet_ledger` |
| FIN-02 | `routes/teacher_wallet.py` `withdraw` (L458–503); `routes/twilio_verify.py` (L470–510) | Checks the PIN only. `WITHDRAWAL_OTP_THRESHOLD_INR = 5000` and the `withdrawal_auth_tokens` it issues are never used. |
| FIN-02 | `routes/teachers.py` `request_payout` (L728) | Any amount from ₹1,000, any account text, no balance, PIN or OTP check |
| FIN-02 / 10 | `routes/teacher_referrals.py` `request_withdrawal` (L454) | "Withdraw (mocked — instant credit to bank)": writes a "processing" row and sends nothing |
| FIN-03 | `routes/empanelment.py` `_luhn_ok` (L73), `/fast-track/{id}/pay` (L234) | "Mock card validation — Luhn checksum only", then marked paid by `credit_card_mock` |
| FIN-04 | Commit `16b74714` (25 Jul 16:41 UTC) | Before it, `apply_wallet_delta` added every amount, holds included, to `balance_inr`. This commit made holds escrow-only, and the same session ran the heal. |
| FIN-04 | `wallet_helpers.apply_wallet_movement` + `teacher_wallet.withdraw` | The withdrawal is passed as a positive amount and stored as given, while the wallet is debited −\|amount\|. The ledger sum then counts it as a credit. |
| FIN-05 | Commit `a6d07e1c` (26 Jul 02:31 UTC); `teacher_wallet.py` L180 | The 15% withdrawal fee was removed, but `withdrawable_inr = balance × 0.85  # 15% platform fee on payout` remains |
| FIN-10 | `teacher_wallet.withdraw` | Writes a "pending" row and requests no transfer. We found no other code that processes pending withdrawals. |

---

## 4. Affected records (QA / demo accounts)
| Record | Finding |
|---|---|
| Teacher `tn_9b0aa00b35c5` (teacher.demo) wallet | FIN-04, 05, 07, 08, 10 |
| `wl_recon_877e6523f3fa` (+₹96,909 adjustment, 25 Jul) | FIN-01, FIN-04 |
| `wl_7d013798d0564c9a` (withdrawal saved as +₹575) | FIN-04 |
| `wl_090d507cf3c14a4a` (₹1,062 release not credited) / hold `wl_f9f4f0e5d8e54b4b` | FIN-04 |
| Withdrawals `wd_8f4057cf889e`, `wd_afbba8dd52f7`, `wd_327902407b6a`, `wd_1065befab0b1`, `wd_fc93941be1f7`, `wd_8770e3dd549d`, `wl_7d013798d0564c9a` (all "pending", 15% fee each) | FIN-05, 08, 10 |
| 19 retreat holds (₹2,81,457 net) | FIN-05, FIN-07 |
| Fast-Track `ef_aad45e0ad440` (non-seed, mock card, approved) + 17 demo-seed requests | FIN-03, FIN-09 |
| 3 premium sessions for teacher.demo (`credit_card_mock`) | FIN-03 |
| 7 mock-mode Cashfree orders (incl. wallet top-up `order_0b1e7946337e439d`) | FIN-01, FIN-03 |
| `order_33572aa0888244b9` / booking `oob_e6bd5a74ee4149` | FIN-10 |
| guru.demo reviewer earnings (₹20,995.80) | FIN-09 |
| Referral withdrawals `trln_b30d8d6f3b8e`, `trln_a96d4e2659c5` (mock, processing), `trln_6213cb1b5c5d` (₹2,000, paid) | FIN-02, FIN-10 |
| Every payout moved by `/admin/payouts/list` or `/sweep` since 16 Jul 2026 | FIN-01 — **unknown until the main-backend team pulls their logs** |

---

## 5. What was not checked, and why
- **The payout list itself.** Reading it runs the sweep, so we never called it. Current payout states are unknown.
- **The v1 wallet and its Cashfree Payouts transfers.** They need a separate sign-in and admin key.
- **Other teachers' ledgers.** We only see the demo teacher from the teacher side. The backend's report-only check
  covers all wallets but only compares wallet to ledger, so problems like FIN-05 and FIN-07 would not show in it.
- **Main-backend code after 28 Aug 2026 and its server logs.** The code we read is the last copy kept in this project;
  the live backend may have changed since. The server logs are outside our access.
- **Live attempts** (fake card, withdrawal without PIN, OTP to another phone). These were skipped on your instruction
  and handed over as test specs.

## 6. Decisions needed from you
| # | Decision | Our recommendation |
|---|---|---|
| F-1 | Publish the lock to the live website now? | Yes, it only pauses money actions. Nothing is published until you say so. |
| F-2 | Ask the main-backend team to switch off money routes on their side (FS-00) now? | Yes, it is the only way to cover the mobile app and direct calls |
| F-3 | Should **payments in** also pause while refunds are paused? | Your call. Today they keep working. |
| F-4 | Who signs off the teacher.demo repair (+₹1,062 owed; ₹96,909 unbacked; ₹1,150 wrong-sign row)? | You, in writing, applied in staging first |
| F-5 | Refund the second 15% fee on past withdrawals? | Yes, once B9-2 is decided |
| B9-1…B9-8 | Still open from the B4.9 readiness report (source wallet, fee point, payout rule, Fast-Track split, cooling, mock referral withdrawals) | As in that report |

## 7. Next step (only after your approval)
1. Forward `/app/BACKEND_HANDOFF_FINANCIAL_SAFETY.md` to the main-backend team. FS-00 (the server-side switch) comes
   first.
2. After the team confirms their fixes in staging, we re-run the read-only checks. The two expected failures (FIN-04,
   FIN-05) must then pass.
3. Only then lift the lock (`FINANCIAL_ACTIONS_UNLOCKED=true`), with your approval, and start B4.9.

**Until you approve, nothing else will be done.** The lock stays on, no payout is touched and B4.9 stays blocked.
