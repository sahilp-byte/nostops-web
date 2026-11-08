# NOSTOPS — Phase 1b Stage 1: final verification and closure (READ-ONLY)

**Date:** 26 Oct 2026. **Type:** read-only verification. No file was edited, except this report and a one-line note in
`PRD.md`. **Result:** ✅ Stage 1 verified complete in preview.

## 1. Files reviewed
**Patches and report:**
- `memory/PHASE_1B_STAGE1_CLEANUP_DIFF.patch`: one line in `frontend/app/app/teacher/locked/page.tsx`.
- `memory/PHASE_1B_STAGE1_DIFF.patch`: 18 files, 38 lines added, 36 removed. It is byte-identical to the current
  working tree compared with the Phase 1a baseline (commit `e80f8538`).
- `memory/PHASE_1B_STAGE1_COPY_REPORT.md` (§1–§7).

**Source files (the preview server serves these):**
- `app/(public)/become-a-teacher/page.tsx`
- `app/(public)/become-a-teacher/[city]/page.tsx`
- `app/(public)/how-it-works/page.tsx`
- `app/app/teacher/{wallet,locked,kyc,retreats/new}/page.tsx`
- `components/app/teacher/{PayoutStatus,SettlementLedger,WithdrawFlow,PayoutDetailsForm,ReferShare,TeacherProgressCards,OnboardingWizard,TeacherOneOnOneSnapshot}.tsx`
- `components/app/venue/VenueOwnerHome.tsx`
- `lib/guides.ts`
- `lib/i18n/messages.ts`

## 2. Verification of the changes
- **Locked wallet screen:**
  - "Withdrawal requests, when available" is **gone** from the source and the build output (0 occurrences).
  - "Withdrawal requests are currently paused." **remains**.
  - The Wallet list now has 2 points.
- **All approved Stage 1 wording is present:**
  - **39 of 39** approved strings were found in the source (every ID from T-1 to W-23, plus the PIN/OTP footer).
  - **0 of 32** replaced strings remain.
  - In the earlier build output, the copy check also found the approved strings present and every replaced string at
    0. The only exception was the Stage 2 Privacy line noted in §4.
- **Kept, as instructed:**
  - the PIN set-up line;
  - the "₹5,000+ need an SMS OTP" label;
  - "…it protects your payout details";
  - the 5 non-English InstaKYC versions.

## 3. Checks run

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` (whole frontend) | **0 errors** |
| ESLint, the 18 Stage 1 files | **clean** |
| Offline compile build (`next build --experimental-build-mode compile`, backend addresses pointed at an unreachable local port) | **Compiled successfully, exit 0.** This mode skips type-checking (run separately above) and static-page generation. |
| Money-lock tests, 6 in-process suites (`test_p0_freeze_gateway`, `test_p0_razorpay_callback`, `test_p0_encoded_delimiter_bypass`, `test_b51_admin_gate`, `test_cashfree_sandbox_guard`, `test_p0_cashfree_diag`) | **565 tests: 553 passed, 12 skipped, 0 failed, 0 errors.** The 12 skips are all in `test_p0_freeze_gateway`: the reviewed non-money routes. JUnit: `test_reports/p0/phase1b/stage1_closure_pytest.xml` |

**Not re-run, because they need a live backend or would write data:**
- **Full static production build:** it reads public catalogue data from the live backend.
  - The last full build, from **byte-identical sources** (checked by directory diff), passed earlier today: exit 0,
    287 of 287 pages (report §7).
- **`test_p0_inbound_payments`:** it writes test order and registration rows into the preview database.
- **Live and sign-in suites:** `test_p0_live_gateway_iter`, `test_t1_b51_admin_gateway_live`, `test_b511_signin_live`,
  `p0_diag_live_check`, and the `test_iter*` feature suites.
- **Frontend site tests:** `verify_site`, `verify_seo_feeds` and `verify_access_matrix`. They request the running site
  and backend.
- **Opening preview pages:** every preview page loads live data, and the teacher and venue screens need a live sign-in.
  - Instead, the preview's source files were verified.
  - The screens were rendered earlier today on a local copy with sample data, from the same sources (report §6 and §7).

## 4. Remaining payment, withdrawal, escrow, settlement and payout wording (not changed; outside approved scope)

**A. New findings, not in the Phase 1b audit inventory:**

| # | Where | Text | Concern |
|---|---|---|---|
| N-1 | `wallet/page.tsx` L58 and L70; `ReferShare.tsx` L58 | "Withdrawn · ₹X" / "Withdrawn" | Says money left the wallet. The audit found "withdraw" only writes a pending row (FIN-10). |
| N-2 | `teacher/widgets/page.tsx` L192 | "Referral available … withdrawable" | Suggests withdrawal is possible, but withdrawals are paused. |
| N-3 | `retreats/RetreatReserve.tsx` L150 | "Prefer UPI / bank transfer?" | Off-platform payment, the same open question as M-11 (Q-11). |
| N-4 | `TeacherProgressCards.tsx` L11; `become-a-teacher/page.tsx` L50 | "Unlocks your public directory listing & verified badges" / "…for your verified badge…" | These sit next to the new line "Teacher verification and empanelment are subject to the applicable review process." They may read as contradictory. |
| N-5 | `WithdrawFlow.tsx` L84–190 | "Withdraw funds", "Payout to", "You receive ₹Y", "Withdraw ₹Y", "…to start withdrawing. Your balance keeps accruing meanwhile." | These contradict the "currently paused" footer if the panel is shown. **Today the panel is hidden** while the lock is ON. |

**B. On hold for Stage 2 (legal, fee, deadline):**
- **Legal pages:**
  - Privacy "processing payments and payouts" (L-5; the only replaced phrase still in the build) and "enable payouts" (L-4);
  - Terms "before receiving payouts" (L-1);
  - FAQ "get paid" (L-9).
- **Payment deadlines and funding:**
  - Coordinator "paid within 7 days" (T-4);
  - Council "Council review payouts" (C-2);
  - Fast-Track "within 7 days" (W-25).
- **Fees:**
  - the venue fee card's "payments & payouts" (T-5);
  - the 15% platform-fee line in the withdraw panel (W-10);
  - the fee shown on the 1:1 offering form (W-21);
  - "You keep 85%" (W-23);
  - "70–85%" (M-1, L-7, L-8).
- **Off-platform payment:** GroupBook's "bank transfer" (M-11).

**C. On hold for Stage 3 (admin):**
- "Release ₹X to {teacher}?" (T-3);
- "No payouts awaiting approval" (D-3);
- "Retreat payouts processed" (D-4);
- the "Payouts" admin menu label.

**D. Text sent by the main backend (Stage 4):**
- The coordinator note "…credited when booking escrow is approved…" (C-1) is the **only "escrow" wording still
  reachable**.
- Wallet activity notes (W-26).

**E. Kept by your instruction:** the PIN set-up line, the OTP label, and "it protects your payout details".

**F. Accurate, no change needed:**
- "Payout details" (W-4);
- "Your payout bank account is verified." (W-20).

**G. Pending native-speaker review:** the InstaKYC message in hi/mr/bn/ta/te. No page uses it today.

## 5. No behaviour change; preview unchanged financially; not deployed
**Only display wording changed:**
- Since the Phase 1a baseline, only the **18 frontend display files** changed.
- A diff with string and JSX text stripped out shows no code-logic change. The only structural edits are display-only:
  2 added text paragraphs (the wallet and venue sub-lines), one removed list item, and one message changed from a
  template string to a plain string.
- **Unchanged:**
  - all BFF routes, `lib/server`, `proxy.ts`;
  - the backend, `.env` files, `backend/financial_lock.py` and `frontend/lib/financial-lock-rules.ts`;
  - API, schema, database, sign-in, OTP and PIN enforcement;
  - withdrawal and payment logic.
- The only other differences are `.pyc` bytecode caches from test runs, and a `frontend/yarn.lock` change dated 25 Oct.
  The yarn.lock change predates this work.

**Money lock:**
- The website lock is **ON** (fail-closed). `FINANCIAL_ACTIONS_UNLOCKED` is absent from both `.env` files and from the
  running backend and preview processes.
- `MONEY_OPS_FROZEN` is a **main-backend setting** and appears in no website code. It was neither read nor changed, and
  it cannot be verified from here (same as the P0 report).

**No financial action:**
- No Cashfree call, payment, refund, withdrawal, transfer or payout.
- The ₹1,062 discrepancy was not corrected, and the ₹13,600 stale holds were not reversed.
- `led_6693375254d1` and `led_a28204971867` are untouched.
- No Stage 2, Stage 3, legal, fee, tax, refund or provenance change.

**Not deployed:**
- Nothing published or deployed, and no mobile build generated.
- The only git commits are the platform's automatic preview checkpoints.
- The temporary local servers are stopped.

**Status:** Stage 1 is complete and verified in preview. **Stopped for founder review.** Stage 2, Stage 3, Stage 4,
B4.9 and B5.2 remain BLOCKED.
