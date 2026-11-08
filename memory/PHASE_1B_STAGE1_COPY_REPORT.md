# NOSTOPS — Phase 1b, Stage 1: safe presentational copy (preview only)

**Date:** 26 Oct 2026. **Authorised by:** founder decisions (Stage 1 only; the audit's wording exactly; English only for
InstaKYC; no Stage 2 values). **Source of wording:** `memory/PHASE_1B_TERMINOLOGY_LEGAL_AUDIT.md` §3 and §5.
**Status:** done in preview. **Not published or deployed. Stopped for founder review.**

## 1. Summary
- **18 website files changed**, copy only: 34 lines added, 33 removed.
- **Applied:** 24 findings. W-14 and W-17 were applied in part.
- **Skipped and flagged:** 3 lines (§3).
- **Not applied:** 1 optional line, T-1's sub-line (§3).
- **Not touched:**
  - fees, percentages, legal pages, tax wording and refund wording;
  - Stage 2 and Stage 3 items;
  - the 5 InstaKYC translations;
  - status-matching logic, amounts, API fields, test IDs and code comments.
- **Full diff:** `memory/PHASE_1B_STAGE1_DIFF.patch`. A one-line-per-change version follows in §2.

## 2. File-by-file diff (applied)

| # | ID | File | Before | After |
|---|---|---|---|---|
| 1 | T-1 | `components/app/venue/VenueOwnerHome.tsx` L162 | Settled to you | Settlement records |
| 2 | T-1 | same, L164 | {n} payout{s} to date. | {n} settlement record{s} to date. |
| 3 | T-2 | `app/(public)/become-a-teacher/page.tsx` L44 | **Fast, transparent payouts** — InstaKYC, a wallet, and secure withdrawals to your bank or UPI. | **A transparent earnings wallet** — InstaKYC and a wallet that records your earnings. Withdrawal options will be announced when available. |
| 4 | T-2 | `app/(public)/become-a-teacher/[city]/page.tsx` L76 | (same as #3) | (same as #3) |
| 5 | M-2 | `become-a-teacher/page.tsx` L50 | A one-time verification that unlocks payouts and badges. | A one-time identity verification for your verified badge and earnings features. |
| 6 | M-3 | `become-a-teacher/page.tsx` L52 | Receive bookings, teach, and get paid. | Receive bookings, teach, and earn — your share is recorded in your NOSTOPS wallet. |
| 7 | M-4 (first part) | `become-a-teacher/[city]/page.tsx` L340 | …NOSTOPS handles the venue, seats, payments and payouts — you keep the larger share. | …NOSTOPS handles the venue, seats and participant payments, and records your share in your wallet — you keep the larger share. |
| 8 | M-5 (payouts point) | `app/(public)/how-it-works/page.tsx` L108 | Secure payments & payouts | Secure participant payments |
| 9 | M-6 | `how-it-works/page.tsx` L118 | …NOSTOPS handles the venue economics, payments and payouts. | …NOSTOPS handles the venue economics and participant payments. |
| 10 | M-7 | `lib/guides.ts` L398 | …with payments and payouts handled for them. | …with participant payments handled for them and their share recorded in their NOSTOPS wallet. |
| 11 | W-1 | `app/app/teacher/wallet/page.tsx` L52 (+ new L54) | Available to withdraw | Wallet balance, plus a new sub-line under the amount: "Recorded earnings — not a bank transfer." |
| 12 | W-2 | `wallet/page.tsx` L104 | Complete InstaKYC to enable withdrawals → | Complete InstaKYC to verify your identity and bank details → |
| 13 | W-5 | `components/app/teacher/PayoutStatus.tsx` L14 | pill "Paid" | pill "Marked paid" (label only; status matching unchanged) |
| 14 | W-5 | same, L25 | Payout status | Withdrawal requests |
| 15 | W-5 | same, L28 | Paid out · ₹X | Marked paid · ₹X |
| 16 | W-5 | same, L33 | No withdrawals yet. Once you withdraw, each payout and its bank-settlement status appears here. | No withdrawal requests yet. Each request and the status recorded for it appears here. |
| 17 | W-6 | `components/app/teacher/SettlementLedger.tsx` L28 | Settlement ledger | Booking ledger |
| 18 | W-6 | same, L31 | …participant payment → NOSTOPS platform fee, venue settlement and your net. Only settled (paid) rows count toward totals… | …participant payment, NOSTOPS platform fee, venue share and your net. Only rows recorded as paid count toward totals… |
| 19 | W-6 | same, L63 | Settled | Recorded paid |
| 20 | W-6 | same, L73 | Settled totals | Totals (recorded paid) |
| 21 | W-6 | same, L86 | Refunds processed: ₹X — reversed, not counted in settled totals. | Refunds recorded: ₹X — reversed, not counted in totals. |
| 22 | W-7 | `components/app/teacher/WithdrawFlow.tsx` L33 | Wallet PIN set ✓ — you can now withdraw securely. | Wallet PIN set ✓ |
| 23 | W-8 | same, L40 | This 4-digit PIN protects every withdrawal from your wallet. | You’ll enter this 4-digit PIN to request a withdrawal from this wallet. |
| 24 | W-12 | `components/app/teacher/PayoutDetailsForm.tsx` L77 | Payout details saved ✓ — you can now withdraw. | Bank details saved ✓ |
| 25 | W-13 | `components/app/teacher/ReferShare.tsx` L60 | Withdraw from your wallet → | View your wallet → |
| 26 | W-14 (a, b) | `app/app/teacher/locked/page.tsx` L19 | Track your earnings and withdraw securely. · Withdraw to your verified bank account | Track your recorded earnings. · Withdrawal requests, when available |
| 27 | W-15 | same, L18 | Track attendance and payouts per session | Track attendance and earnings per session |
| 28 | W-16 | `app/app/teacher/kyc/page.tsx` L18 | Reverse penny-drop for payouts | Reverse penny-drop to verify your bank account |
| 29 | W-17 (first part) | `components/app/teacher/TeacherProgressCards.tsx` L13 | Enables secure payouts for your sessions | Verifies your identity and bank details |
| 30 | W-18 | `components/app/teacher/OnboardingWizard.tsx` L287 | …progress toward empanelment & payouts. | …progress toward empanelment and your earnings wallet. |
| 31 | W-19 (English only) | `lib/i18n/messages.ts` L118 (English value only) | Next: complete InstaKYC to unlock payouts → | Next: complete InstaKYC to verify your account → |
| 32 | W-22 (payout words only) | `app/app/teacher/retreats/new/page.tsx` L44 | NOSTOPS keeps {pct}% to run payments, secure seats and handle your payouts. | NOSTOPS keeps {pct}% to run payments and secure seats. |
| 33 | W-23 ("Monthly payouts") | `components/app/teacher/TeacherOneOnOneSnapshot.tsx` L42 | Monthly payouts | Monthly earnings (recorded) |

**Notes on how three of the approved lines were applied:**
- **M-4:** the audit's wording replaces only the payout words. "— you keep the larger share" is a fee claim (Stage 2,
  Q-1), so it is kept word for word.
- **W-19:**
  - The translation catalogue is looked up by the English sentence, so that lookup text is unchanged and only the
    English display text was edited. Hindi, Marathi, Bengali, Tamil and Telugu therefore still show their current
    translations.
  - **No page uses this message today**, so the change has no visible effect yet.
- **W-22, please confirm:**
  - The audit's full replacement, "NOSTOPS retains a {pct}% platform fee.", also removes the description of what the
    fee pays for. That description is a Stage 2 decision (Q-3).
  - So only "and handle your payouts" was deleted, and the fee percentage and the rest of the purpose wording are
    unchanged.
  - If you prefer the full audit sentence, it is a one-line change.

## 3. Skipped lines, flagged for founder review (old text left in place)

| ID | File | Current text (unchanged) | Audit's proposed text | Why it was skipped |
|---|---|---|---|---|
| **W-9** | `WithdrawFlow.tsx` L117 | "Withdrawal of ₹X initiated to your bank account / UPI ✓" | "Withdrawal request of ₹X recorded ✓ — this is not a bank transfer yet." | **"yet" implies this request will become a bank transfer.** No payout rail is approved (constraint 5). The panel is hidden while the money lock is ON, so the current text cannot appear today. **Possible alternative (not applied):** "Withdrawal request of ₹X recorded ✓ — this is not a bank transfer." |
| **W-14 (c)** | `teacher/locked/page.tsx` L19 | "PIN + OTP protected payouts" | "PIN-protected withdrawal requests" | **A security promise the system does not fully meet.** FIN-02 found three withdrawal routes that need no PIN. ⚠️ The current text is less accurate still, because the OTP is never checked. **Options:** (a) apply the audit text after the main backend fixes FIN-02; (b) remove this point. |
| **W-17 (second part)** | `TeacherProgressCards.tsx` L114 | "A one-time {price} (incl. GST) verification that activates your profile and payouts." | "…that activates your profile and verified status." | **InstaKYC alone does not grant verified status.** Under `BUSINESS_LOGIC.md`, verified means KYC verified **and** KYC paid **and** empanelled. "(incl. GST)" stays either way until Q-5. |

**Optional line, not applied:**
- **T-1 sub-line:** "Records only — not a bank-transfer confirmation."
- The audit marked it optional, pending finance confirming whether any venue was actually paid (Q-12). Your decision.

**InstaKYC translations: pending native-speaker review.** These are unchanged and were not machine-translated:
- `lib/i18n/messages.ts` line 365 (hi)
- line 612 (mr)
- line 859 (bn)
- line 1106 (ta)
- line 1353 (te)

## 4. Tests and build

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | clean (exit 0) |
| ESLint on the 18 changed files | clean (exit 0) |
| Production build (`next build`, separate build copy outside the repository) | compiled; TypeScript passed; 287/287 static pages; **exit 0** |
| Compiled-output check | all 34 new strings present. 28 old strings found **0 times**. The only old strings still present are the 3 skipped lines in §3. |
| Gateway regression (in-process: freeze, Razorpay callback, encoded path) | **359 passed, 12 skipped (the reviewed non-money routes), 0 failed** |
| Visual check, desktop 1440 px and mobile 390 px (`test_reports/p0/phase1b/phase1b_visual_check.{py,json}`) | all checks pass; no old strings on the pages checked; **no sideways scrolling on any page** |

**Pages in the visual check:** real page code with fake data.
- teacher wallet (hero and withdrawal requests, both pills);
- teacher dashboard (1:1 monthly heading and InstaKYC card);
- locked screen (Wallet and Bookings);
- `/become-a-teacher`;
- `/how-it-works`;
- the retreats guide.

**Screenshots:** `test_reports/p0/phase1b/p1b_*_{desktop,mobile}.png`.

**Checked in source and compiled output only (not rendered):**
- venue dashboard (T-1);
- booking ledger (W-6);
- withdraw panel (W-7, W-8; hidden while the lock is ON);
- bank-details success message (W-12);
- referral card (W-13);
- InstaKYC page (W-16);
- onboarding wizard (W-18);
- retreat creation page (W-22);
- the city recruitment page (M-4).

**Observation, not changed:**
- **Layout:** on a 390 px phone, the new heading "Withdrawal requests" wraps onto two lines beside the totals. Nothing
  overflows.
- **Old tests:**
  - `backend/tests/test_iter9_features.py` only checks that "Available to withdraw" is **absent** for non-teachers. It
    still passes.
  - The Phase 1a script `test_reports/p0/phase1a/phase1a_visual_check.py` finds the wallet hero by its old label, so it
    would need updating if re-run.

**Environment for the checks:**
- **Build:**
  - The first build, with the backend fully mocked, compiled and passed TypeScript, then stopped at the static-page
    step. Seven public hub pages are coded to refuse to build without real catalogue data.
  - It was re-run the same way as Phase 1a: in the separate build copy, with its normal settings. The static-page step
    therefore read public catalogue data (directory, retreats, council).
  - It did not sign in, call Cashfree or touch any money route.
- **Visual check:**
  - It used **only** the local production server (`127.0.0.1:3106`) and a local, read-only mock backend
    (`test_reports/p0/phase1b/phase1b_local_mock_backend.py`, port 9913).
  - The mock answered 95 reads and refused the only 2 writes.
  - The temporary servers are stopped.

## 5. Restrictions held
- Copy only, in preview. No backend, API, schema, database, wallet, ledger, order, refund, hold or deferred-effect change.
- No Cashfree call, payout operation or provenance migration. The ₹1,062 correction was not applied, the ₹13,600 stale
  holds were not reversed, and both protected ledger rows are untouched.
- `MONEY_OPS_FROZEN` ON; website lock ON (`FINANCIAL_ACTIONS_UNLOCKED` unset). Backend `.py` and `.env` files unchanged.
- Nothing published or deployed. Stage 2, Stage 3, Stage 4, B4.9 and B5.2 remain **BLOCKED**.

**Stopped. Waiting for founder review.**

---

## 6. Stage 1 final corrections (founder-approved 26 Oct, preview only)
**This supersedes §3:**
- W-9, W-14 (c), W-17 (second part) and the T-1 sub-line are now done with your exact wording.
- W-22 stays as it was.

**Diff:**
- **This round:** `memory/PHASE_1B_STAGE1_FINAL_DIFF.patch`. 4 files; 5 lines added, 4 removed.
- **All of Stage 1:** `memory/PHASE_1B_STAGE1_DIFF.patch`. 18 files; 38 lines added, 36 removed.

```diff
# 1 · W-9  frontend/components/app/teacher/WithdrawFlow.tsx L117 (confirmation after a withdrawal request)
-    if (r.ok) done(`Withdrawal of ${inr(amt)} initiated to your ${method === 'bank' ? 'bank account' : 'UPI'} ✓`, true);
+    if (r.ok) done('Your withdrawal request has been recorded. Withdrawals are currently paused.', true);

# 2 · security claims  frontend/components/app/teacher/WithdrawFlow.tsx L192 (line under the Withdraw button)
-      <p className="mt-2 text-center text-[11px] text-muted">Secured by your wallet PIN{otpRequired ? ' + SMS OTP' : ''}.</p>
+      <p className="mt-2 text-center text-[11px] text-muted">Withdrawal requests are currently paused.</p>

# 2 · W-14 (c)  frontend/app/app/teacher/locked/page.tsx L19 (Wallet "what you'll unlock" list)
-  … 'Withdrawal requests, when available', 'PIN + OTP protected payouts'] },
+  … 'Withdrawal requests, when available', 'Withdrawal requests are currently paused.'] },

# 3 · W-17  frontend/components/app/teacher/TeacherProgressCards.tsx L114 (InstaKYC card)
-  desc={`A one-time ${instaKycPriceLabel()} (incl. GST) verification that activates your profile and payouts.`}
+  desc={`A one-time ${instaKycPriceLabel()} (incl. GST) verification. Completes your identity verification step. Teacher verification and empanelment are subject to the applicable review process.`}

# 5 · T-1 sub-line  frontend/components/app/venue/VenueOwnerHome.tsx L165 (inside the "Settlement records" card)
+          <p className="mt-0.5 text-xs text-muted">Records only — not a bank-transfer confirmation.</p>
```

**Item by item:**

**1. Confirmation:**
- This is your exact sentence. It replaces the only success message the withdraw request shows.
- The message no longer shows the amount or bank/UPI method. That was display text only.

**2. PIN and OTP security claims:**
- Two statements claimed protection, and both now read "Withdrawal requests are currently paused.":
  - "Secured by your wallet PIN (+ SMS OTP)", under the withdraw button. This was approved in Phase 1a, but it is a PIN/OTP claim.
  - "PIN + OTP protected payouts", on the locked wallet screen.
- **Searched for and left unchanged** (these are not protection claims about withdrawal requests):
  - **W-8 PIN-setup line:** "You’ll enter this 4-digit PIN to request a withdrawal from this wallet." It describes the step the user takes in this form.
  - **W-11 OTP step label:** "Withdrawals of ₹5,000+ need an SMS OTP." It labels an input that the form really requires before its button turns on. The audit put it in the "decide after the main backend fixes FIN-02" group.
  - **Bank-details form:** "…it protects your payout details." It is about bank details, not withdrawal requests, and the audit has no finding on it.
  - All three are flagged for you. Say if you want them reworded too.

**3. InstaKYC card:**
- "A one-time ₹279 (incl. GST) verification." stays as it is. The price and "(incl. GST)" are Stage 2.
- Your two sentences follow word for word.

**4. Retreat creation page:**
- "and handle your payouts" stays removed.
- The fee percentage and the rest of the fee wording are untouched.

**5. Venue dashboard:**
- The sub-line sits inside the "Settlement records" card, under "{n} settlement records to date."
- The fee card ("NOSTOPS keeps this to run secure payments & payouts.", T-5) is unchanged, because it is Stage 2.

**Observation, not changed:** the locked wallet screen now lists both "Withdrawal requests, when available" and
"Withdrawal requests are currently paused." These are similar. You may want to drop the first one.

**No financial or security behaviour changed:**
- **Only display text changed.** The word diff shows changes only inside string literals and JSX text.
- **The withdraw form works exactly as before:**
  - the PIN requirement (`/^\d{4}$/`), the OTP threshold (₹5,000) and the button-enable rule (`canWithdraw`) are unchanged;
  - the request body sent to `/bff/teacher/wallet/withdraw` (`amount_inr`, `pin`, `payout_method`) is unchanged;
  - the success handler (`done(…, true)`: reset form, refresh) is unchanged.
- **The withdraw panel is still hidden** in the live wallet while the money lock is ON.
- **Nothing outside display text changed:**
  - no change to any BFF route, `lib/server` code, `proxy.ts`, the backend, `.env` files, schema or API;
  - the only backend files that differ are `.pyc` bytecode caches written by the test runs.

**Tests:**

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | clean |
| ESLint on the 4 changed files | clean |
| Production build (separate build copy, same method as §4) | compiled; TypeScript passed; 287/287 static pages; exit 0 |
| Compiled-output check | all 5 new strings present. Old strings found 0 times: "initiated to your", "Secured by your wallet PIN", "PIN + OTP protected payouts", "activates your profile and payouts", "handle your payouts". |
| Gateway regression (freeze, Razorpay callback, encoded path) | **359 passed, 12 skipped, 0 failed** |
| Visual check, desktop 1440 px and mobile 390 px (`test_reports/p0/phase1b/phase1b_final_visual_check.{py,json}`) | **every check passes**, including no old strings, no text overflow and no sideways scrolling |

**What the visual check showed (fake sample data):**
- **Venue dashboard:** the "Settlement records" card shows "2 settlement records to date." and the new sub-line. The fee card is unchanged.
- **Withdraw panel:**
  - the new line under the button shows;
  - the PIN-setup text shows;
  - after a sample submit (₹1,000, PIN 1234), the confirmation reads exactly "Your withdrawal request has been recorded. Withdrawals are currently paused."
- **Locked wallet screen:** the new list point shows.
- **Dashboard InstaKYC card:** the new text shows with the price and GST unchanged.

**Screenshots:** `test_reports/p0/phase1b/p1b_final_{venue,withdraw_confirm,locked_wallet,kyc_card}_{desktop,mobile}.png`.

**How the safe sample-data check was set up:**
- **Venue and withdraw pages:**
  - The venue dashboard and withdraw panel were shown on a **temporary page that existed only in the separate build copy**, as in Phase 1a. It was never in the repository, and it was deleted after the check.
  - The build copy's sources now match the repository exactly.
- **Sample withdraw submit:** Playwright answered it **inside the browser** with a fake "ok". It is logged as 2 intercepted calls (desktop and mobile). Nothing reached any server.
- **Other screens:** the locked screen and the dashboard used the local read-only mock backend. It answered 44 reads and refused 2 writes.
- **Clean-up:** the local server and mock were stopped. No live system was used during the visual check. The build reads public catalogue data, as described in §4.

**Restrictions held:**
- frontend copy only;
- `MONEY_OPS_FROZEN` ON; the website lock ON;
- no wallet, ledger, hold or order change;
- the ₹1,062 correction and the ₹13,600 holds untouched; protected rows untouched;
- no Cashfree call or payout processing;
- the 5 non-English InstaKYC versions unchanged;
- Stage 2 wording on hold;
- nothing published or deployed.

**Stopped. Waiting for founder review.**

---

## 7. Stage 1 cleanup (founder-approved 26 Oct, preview only) — STAGE 1 COMPLETE
**Diff:** `memory/PHASE_1B_STAGE1_CLEANUP_DIFF.patch`. One file, one line:

```diff
# frontend/app/app/teacher/locked/page.tsx L19 (Wallet "what you'll unlock" list)
-  Wallet: { icon: '👛', blurb: 'Track your recorded earnings.', points: ['Live balance & transaction history', 'Withdrawal requests, when available', 'Withdrawal requests are currently paused.'] },
+  Wallet: { icon: '👛', blurb: 'Track your recorded earnings.', points: ['Live balance & transaction history', 'Withdrawal requests are currently paused.'] },
```

**Kept unchanged, as instructed:**
- the PIN set-up instruction;
- the "₹5,000+ need an SMS OTP" label;
- "…it protects your payout details".

All three are still present in the build.

**Checks:**

| Check | Result |
|---|---|
| tsc and ESLint | clean |
| Production build (separate build copy) | compiled; TypeScript passed; 287/287 pages; exit 0 |
| Copy check on the build output | all Stage 1 new strings present. All 25 Stage 1 old strings found 0 times, including "Withdrawal requests, when available". |
| Gateway regression | 359 passed, 12 skipped, 0 failed |
| Locked wallet screen, desktop and mobile (local build + read-only mock; `phase1b_cleanup_check.json`) | shows the 2 points "Live balance & transaction history" and "Withdrawal requests are currently paused."; no overflow |

**Notes on the checks:**
- **"payments and payouts" still appears 2 times in the build.** It is the Privacy page's "processing payments and payouts" (L-5), a Stage 2 legal item kept on hold.
- **Visual check:** the mock answered 13 reads and refused 0 writes. The temporary servers are stopped.

**No behaviour changed:**
- Only one string was removed from a display list.
- No change to:
  - backend, API, database or `.env`;
  - BFF routes, `lib/server` code or `proxy.ts`;
  - sign-in, OTP, PIN enforcement or withdrawal behaviour.
- The backend files that show as changed are `.pyc` bytecode caches from the test runs.
- `frontend/yarn.lock` shows as changed, but that change dates from 25 Oct and was not made in this task.

**Stage 1 status: COMPLETE in preview.** Every Stage 1 finding is applied or settled by your decision. Still on hold:
- the 5 non-English InstaKYC versions (native-speaker review);
- Stage 2 (legal, fee, GST/TDS, refund timing, entity details), Stage 3 and Stage 4;
- B4.9 and B5.2.

**Restrictions held:**
- `MONEY_OPS_FROZEN` ON;
- the ₹1,062 correction and the ₹13,600 holds untouched; protected rows untouched;
- no Cashfree call;
- nothing published or deployed.

**Stopped. Waiting for founder review.**
