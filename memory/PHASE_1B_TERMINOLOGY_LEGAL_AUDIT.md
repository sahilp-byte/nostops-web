# NOSTOPS — Phase 1b preparation: financial terminology and legal accuracy audit (READ-ONLY)

**Date:** 26 Oct 2026. **Type:** audit and recommendations only. **Nothing was implemented.**
**Inputs used:** `memory/PHASE_1A_COPY_REPORT.md` and `memory/TERMINOLOGY_REVIEW_BACKLOG.md` (both found), a full
search of the website source (`frontend/app`, `components`, `lib`) and of the website backend (`backend/*.py`),
`memory/FINANCIAL_SAFETY_AUDIT.md`, and stored read-only evidence from earlier audits
(`test_reports/fin_audit/evidence.json`, `test_reports/iteration_11.json`).
No live system was contacted for this audit.

## 0. How to read this report

**Evidence labels:**
- **[V]** Verified fact: read directly from the current files today.
- **[CD]** Code-derived observation: what the code does or displays. This is not proof of what happened to money.
- **[RA]** Reported audit finding, from `FINANCIAL_SAFETY_AUDIT.md` or stored evidence from earlier read-only calls.
- **[FC]** Founder-stated business constraint (§1).
- **[UD]** Unresolved business or legal decision.

**Classes:**
- **A:** supported and accurate; no change.
- **B:** inaccurate or potentially misleading; correction recommended.
- **C:** needs a founder, finance or legal decision before any definitive wording.
- **D:** internal/admin wording; change only to stop operators mistaking an accounting action for a payment.

**Audience types:**
- **User:** shown to teachers, seekers, venues or coordinators.
- **Contract:** a legal page, or a fee or deadline promise.
- **Admin:** shown to operators only.
- **Tech:** text supplied by the backend or the system.

**⚠️ Limitation on item 6 (Terms, FAQ, Privacy).** The website's `/terms`, `/privacy`, `/faq` and `/refunds` pages, and
the shared legal-entity block, were read in full [V].
- They contain **no reference** to Razorpay, escrow, instant withdrawal, TDS, an 8% fee or a 15% fee.
- Those statements, if they exist, are **outside this repository** (for example the mobile app, the main backend or an
  earlier site version). I could not locate them and have not invented their text or location (question Q-15).
- **What was found** is listed in §3.2 and §3.7:
  - an older 8% preview, recorded in a test report;
  - a "no TDS" note from the main backend;
  - several fee figures that conflict with one another.

## 1. Business constraints applied [FC]
1. The NOSTOPS Cashfree proprietorship account supports **payment acceptance and refunds**, not teacher payouts.
2. Internal wallet credits, accrued or reserved earnings and payout-status records are **not proof** of an external bank
   transfer.
3. The PAID orders in the inspected dataset were reported as mock-gateway orders. They are **not verified real-money
   collections**.
4. A transfer marked SUCCESS is not assumed to be a real, provider-confirmed transfer.
5. **No production teacher-payment rail or payout service-level agreement is approved.**
6. The contractual platform fee and TDS treatment are **not inferred** from code.

**Supporting audit facts [RA]:**
- **FIN-02:** the OTP for ₹5,000+ is never checked, and three withdrawal routes need no PIN.
- **FIN-03:** mock-card and mock-mode "paid" records exist.
- **FIN-04:** the wallet doesn't match its ledger, and ₹96,909 of balance is unbacked.
- **FIN-05:** the 15% fee was taken twice, and the withdrawal fee was removed on 26 Jul.
- **FIN-07:** retreat payout views show ₹0.
- **FIN-09:** three different Fast-Track splits.
- **FIN-10:** the wallet "withdraw" only writes a pending row; nothing sends money.

---

## 2. Summary

| Class | Count | Meaning for the plan |
|---|---|---|
| A | 14 | No change |
| B | 27 | Correct. 22 can go in Stage 1 (copy only); 5 sit on legal or FAQ pages and go in Stage 2 |
| C | 20 | Decision needed first (Stage 2) |
| D | 4 | Admin wording (Stage 3) |

**The four largest risks:**
1. Teacher-facing text that says money was **"paid out"**, **"settled"** or a withdrawal **"initiated to your bank"**,
   when no payout rail exists (W-5, W-6, W-9, T-1).
2. **Conflicting fee figures** across marketing, FAQ, calculators, the withdraw panel and the main backend (§3.7).
3. **Deadline promises** with no approved service level: "within 7 days" for bonuses and Fast-Track (T-4, W-27).
4. The **legal-entity block** is still "[to be confirmed]", and the refund processing time is a placeholder (L-11,
   L-13).

---

## 3. Inventory of findings

### 3.1 Known terminology backlog (T-1 … T-5)

| ID | Where | Exact current wording | Type | Implies → evidence | Class | Recommendation (approval) |
|---|---|---|---|---|---|---|
| T-1 | `components/app/venue/VenueOwnerHome.tsx` lines 162–164 | "Settled to you" / "{n} payout{s} to date." | User (venue) | That money reached the venue's bank. → The value is main-backend `total_settled` and `count` (`lib/server/venue-owner.ts` 248–250) [CD]. Constraints 2 and 4. Retreat payout views show ₹0 (FIN-07) [RA]. | **B** | "Settlement records" / "{n} settlement record{s} to date." Optional sub-line: "Records only — not a bank-transfer confirmation." (founder; finance to confirm whether any venue was really paid) |
| T-2 | `app/(public)/become-a-teacher/page.tsx` line 44; `…/[city]/page.tsx` line 76 | "Fast, transparent payouts" — "InstaKYC, a wallet, and secure withdrawals to your bank or UPI." | User / public promise | That fast bank/UPI payouts exist. → No payout rail (constraint 5); withdrawals paused by the lock [V]; "withdraw" sends nothing (FIN-10) [RA]. | **B** | Title "A transparent earnings wallet"; text "InstaKYC and a wallet that records your earnings. Withdrawal options will be announced when available." (founder) |
| T-3 | `components/app/admin/PayoutsQueue.tsx` line 67 | "Release ₹{amount} to {teacher}?" | Admin | That approving sends money. → It calls the main-backend approve route, frozen today [V]. Whether approve starts any transfer is unknown [UD]. No rail (constraint 5). | **D** | "Approve the ₹{amount} payout request for {teacher}? Approval records a decision; it does not confirm a bank transfer." (founder, after the main backend confirms what approve does: Q-14) |
| T-4 | `components/app/coordinator/CoordinatorHome.tsx` line 149 | "Milestone bonuses are paid within 7 days of unlock, from NOSTOPS' share only. The teacher's 70–85% revenue share is never touched." | Contract (coordinator) | A guaranteed payment deadline and a funding source. → No payout SLA (constraint 5). Coordinator money is a wallet credit ("credited", backend share note) [RA]. The 70–85% figure is unconfirmed (§3.7). | **C** | No definitive text until decided. Placeholder: "Milestone bonuses are recorded in your coordinator wallet when unlocked. Payment timing will be confirmed separately." (founder + finance + legal: Q-7) |
| T-5 | `components/app/venue/VenueOwnerHome.tsx` line 169 | "NOSTOPS keeps this to run secure payments & payouts." | Contract (fee purpose) | What the fee pays for, including "payouts". → No payout rail (constraint 5). The fee's purpose is undocumented [UD]. | **C** | Draft, **not applied**: "NOSTOPS retains its platform fee to support platform operations and payment processing." (founder + legal: Q-3) |

### 3.2 Legal pages (Terms, Privacy, FAQ, Refunds, legal entity)
None of these pages mentions Razorpay, escrow, instant withdrawal, TDS, 8% or 15% [V] (see the §0 limitation).

| ID | Where | Exact current wording | Type | Implies → evidence | Class | Recommendation (approval) |
|---|---|---|---|---|---|---|
| L-1 | `app/(public)/terms/page.tsx` line 31 (§3) | "…before their public profile goes live and before receiving payouts." | Contract | That payouts happen after verification. → No rail (constraint 5). | **B** | "…before their public profile goes live and before any earnings can become eligible for withdrawal." (legal) |
| L-2 | `terms/page.tsx` line 34 (§4) | "Payments are processed securely through our payment partners. Teacher earnings follow a teacher-first revenue share that increases with the length of the engagement." | Contract | Several processors, and a fee schedule tied to engagement length. → Cashfree is the only active acceptance processor [FC]. The schedule conflicts with the flat 15% for 1:1 and retreats (§3.7). | **C** | Name the processor if legal agrees, and link one published fee schedule. No figures until Q-1 is decided (legal + finance) |
| L-3 | `terms/page.tsx` line 43 (§7) | "Where a teacher declines a confirmed session, eligible amounts are refunded." | Contract | Refund on a teacher decline. → Matches the refund policy; refunds are supported [FC]. | **A** | No change |
| L-4 | `app/(public)/privacy/page.tsx` line 26 | "Verification data submitted during InstaKYC, processed solely to verify identity and enable payouts." | Contract (privacy) | That data is used only for identity and payouts. → No rail (constraint 5). The full purpose list is a legal matter. | **B** | "…processed to verify identity and, where applicable, to enable withdrawal of eligible earnings." (legal) |
| L-5 | `privacy/page.tsx` line 30 | "…enabling bookings, processing payments and payouts, and running organisation programmes." | Contract (privacy) | That NOSTOPS processes payouts. → No rail (constraint 5). | **B** | "…processing payments and refunds, keeping earnings records…" (legal) |
| L-6 | `privacy/page.tsx` line 39 | "…with payment processors and identity-verification providers — and never sell your personal data." | Contract (privacy) | Generic sharing statement. → Consistent with Cashfree and KYC use [CD]. | **A** | No change (legal may choose to name providers) |
| L-7 | `app/(public)/faq/page.tsx` line 37 | "The larger share of every rupee is always yours — 70% on a 3-month engagement, rising to 85% on a 12-month partnership." | Contract (fee) | A fee schedule. → Conflicts with the city FAQ (adds 80% at 6 months), the main backend (pilot 70%, 80% from 3 months, 1:1 flat 85%) and the wallet's 15% [RA]/[CD]. | **C** | No change until Q-1 (finance + legal) |
| L-8 | `lib/server/cities.ts` line 264 (city-page FAQ) | "Teachers keep 70% on a 3-month pilot, 80% on a 6-month engagement and 85% on a 12-month partnership — the longer the commitment, the more you keep." | Contract (fee) | A fee schedule. → Conflicts with L-7 and the main backend (§3.7). | **C** | Align with the single schedule from Q-1 |
| L-9 | `faq/page.tsx` line 39 | "Eligible teachers can host retreats — create listings, manage reservations and get paid, with NOSTOPS handling payments." | Contract (FAQ) | "Get paid" means money paid out. → No rail (constraint 5). | **B** (Stage 2) | "…create listings and manage reservations, with NOSTOPS accepting participant payments and recording your share in your wallet." (legal, because this is FAQ) |
| L-10 | `faq/page.tsx` line 53 | "…each person pays it online (card or UPI) when they register. Their place is confirmed once the payment goes through." | Contract (FAQ) | Seat confirmed when paid. → The confirm requires a verified amount, currency and reference [CD]. Checkout availability depends on MB-5 (operational). | **A** | No change |
| L-11 | `app/(public)/refunds/page.tsx` line 70 | "Approved refunds are returned to the original payment method. Processing time: [to be confirmed]." | Contract | Refund method, plus a missing time. → Refunds supported [FC]. The time is a placeholder [V]. | **C** | Finance to supply the processing time (Q-9) |
| L-12 | `refunds/page.tsx` line 35 | "Full refund if you request it within 7 days of payment and work on your request has not started." | Contract | A request window for customers (not a NOSTOPS deadline). | **A** | No change (legal may confirm) |
| L-13 | `components/legal/LegalEntityNotice.tsx` lines 4–6 | "Legal entity / Registered address / Grievance Officer: [to be confirmed]" | Contract | Operator identity is missing. → Placeholder by design [V]. | **C** | Legal to supply the proprietorship details (Q-10) |

### 3.3 Public marketing pages

| ID | Where | Exact current wording | Type | Implies → evidence | Class | Recommendation (approval) |
|---|---|---|---|---|---|---|
| M-1 | `become-a-teacher/page.tsx` lines 13, 15, 39; `[city]/page.tsx` lines 39, 44, 71; `components/auth/TeacherJoinForm.tsx` line 88; `components/app/teacher/ReferShare.tsx` line 14; `lib/server/widgets.ts` line 511 | "Keep 70–85%" / "keep 70–85% of every rupee" / "the bigger share is always yours, and it grows with commitment" | User / fee promise | A fee schedule applying to all income. → Conflicts in §3.7. "Every rupee" may not hold for fees such as InstaKYC or Fast-Track [UD]. | **C** | Keep until Q-1, then one figure set everywhere (finance + legal) |
| M-2 | `become-a-teacher/page.tsx` line 50 | "InstaKYC — A one-time verification that unlocks payouts and badges." | User | That payouts are unlocked. → No rail (constraint 5). | **B** | "A one-time identity verification for your verified badge and earnings features." (founder) |
| M-3 | `become-a-teacher/page.tsx` line 52 | "Active teacher — Receive bookings, teach, and get paid." | User | Money paid out. → Constraint 5. | **B** | "Receive bookings, teach, and earn — your share is recorded in your NOSTOPS wallet." (founder) |
| M-4 | `become-a-teacher/[city]/page.tsx` line 340 | "NOSTOPS handles the venue, seats, payments and payouts — you keep the larger share." | User | NOSTOPS pays teachers out. → Constraint 5. "Larger share" depends on Q-1. | **B** | "NOSTOPS handles the venue, seats and participant payments, and records your share in your wallet." (founder; the share wording waits for Q-1) |
| M-5 | `app/(public)/how-it-works/page.tsx` line 108 | "Secure payments & payouts" · "Fair, transparent platform fee" | User | That payouts exist, and that the fee is consistent. → Constraint 5; the fee figures conflict (§3.7). | **B** (payouts) / **C** (fee) | "Secure participant payments" (founder). The fee point waits for Q-1. |
| M-6 | `how-it-works/page.tsx` line 118 | "…NOSTOPS handles the venue economics, payments and payouts." | User | As M-4. | **B** | "…handles the venue economics and participant payments." (founder) |
| M-7 | `lib/guides.ts` line 398 | "…with payments and payouts handled for them." | User (guide) | As M-4. | **B** | "…with participant payments handled for them and their share recorded in their NOSTOPS wallet." (founder) |
| M-8 | `app/(public)/teachers/page.tsx` line 31 | "Offer 1:1 sessions with secure payments and clear pricing you set — your terms, your practice." | User | Secure payment acceptance, and a price the teacher sets. → Cashfree acceptance [FC]; the teacher sets the fee within a suggested range (`OfferingsForm.tsx` line 66) [CD]. | **A** | No change |
| M-9 | `app/(public)/trust/page.tsx` lines 81–82 | "Secure payments — Paid registrations are processed by Cashfree on an encrypted checkout. NOSTOPS never stores your card details, and the amount you pay is exactly the organiser's published fee." | User | Processor, card handling and exact amount. → Card entry is on Cashfree's hosted checkout; the confirm requires an exact amount and currency [CD]. Availability depends on MB-5 (operational). | **A** | No change |
| M-10 | `components/learner/BookJourney.tsx` line 184; `components/retreats/RetreatReserve.tsx` line 129; `components/booking/PayNow.tsx` line 28; `components/app/org/CloseEnrollment.tsx` line 64 | "Pay securely in ₹." / "Pay securely to confirm" / "secure payment link" | User | Secure payment acceptance. → Cashfree acceptance [FC]. | **A** | No change |
| M-11 | `components/retreats/GroupBook.tsx` line 179 | "Your group is held. The host will share payment details (a secure payment link or bank transfer) shortly." | User | Paying the host off-platform by bank transfer. → An off-platform payment path is not covered by the Cashfree constraint [UD]. | **C** | Decide whether off-platform transfer is allowed (Q-11). If not: "…The host will share a secure payment link shortly." |

### 3.4 Teacher app

| ID | Where | Exact current wording | Type | Implies → evidence | Class | Recommendation (approval) |
|---|---|---|---|---|---|---|
| W-1 | `app/app/teacher/wallet/page.tsx` line 52 | "Available to withdraw" (wallet headline amount) | User | Money can be withdrawn now. → Withdrawals paused [V]; no rail; wallet ≠ ledger, ₹96,909 unbacked (FIN-04) [RA]; some balances come from mock orders (constraint 3). | **B** | "Wallet balance", sub-line "Recorded earnings — not a bank transfer." (founder) |
| W-2 | `wallet/page.tsx` line 103 | "Complete InstaKYC to enable withdrawals →" | User | KYC turns withdrawals on. → Constraint 5. | **B** | "Complete InstaKYC to verify your identity and bank details →" (founder) |
| W-3 | `wallet/page.tsx` line 117 | "Withdrawals, top-ups and payout changes are paused" | User | Paused. → True [V]. | **A** | No change |
| W-4 | `wallet/page.tsx` line 85; `components/app/teacher/WithdrawFlow.tsx` line 141 | "Payout details" / "Payout to" | User (form labels) | Where any future payout would go. | **A** | No change (optional: "Bank details") |
| W-5 | `components/app/teacher/PayoutStatus.tsx` lines 14, 25, 28, 33 | Status pill **"Paid"** for any status containing paid, success, completed or settled; "Payout status"; "Paid out · ₹X"; "No withdrawals yet. Once you withdraw, each payout and its bank-settlement status appears here." | User | Money reached the teacher's bank. → The pill relabels backend status strings [CD]; `total_paid` comes from the main backend [CD]; constraint 4; FIN-10 [RA]. | **B** | Pill "Marked paid"; "Withdrawal requests"; "Marked paid · ₹X"; "No withdrawal requests yet. Each request and the status recorded for it appears here." Label strings only; the matching logic is unchanged. (founder) |
| W-6 | `components/app/teacher/SettlementLedger.tsx` lines 28, 31, 63, 73, 86 | "Settlement ledger"; "…participant payment → NOSTOPS platform fee, venue settlement and your net. Only settled (paid) rows count toward totals…"; "Settled"; "Settled totals"; "Refunds processed: ₹X — reversed, not counted in settled totals." | User | Money collected and settled, and refunds executed. → Rows are reservation records [CD]; mock PAID orders (constraint 3). | **B** | "Booking ledger"; "…participant payment, NOSTOPS platform fee, venue share and your net. Only rows recorded as paid count toward totals…"; "Recorded paid"; "Totals (recorded paid)"; "Refunds recorded: ₹X — reversed, not counted in totals." (founder) |
| W-7 | `WithdrawFlow.tsx` line 33 | "Wallet PIN set ✓ — you can now withdraw securely." | User | Withdrawals are available. → Constraint 5; paused. | **B** | "Wallet PIN set ✓" (founder) |
| W-8 | `WithdrawFlow.tsx` line 40 | "This 4-digit PIN protects every withdrawal from your wallet." | User / security | That every withdrawal path needs the PIN. → Three routes need no PIN (FIN-02) [RA]. | **B** | "You'll enter this 4-digit PIN to request a withdrawal from this wallet." (founder; full accuracy depends on MB/FIN-02) |
| W-9 | `WithdrawFlow.tsx` line 117 | "Withdrawal of ₹X initiated to your bank account / UPI ✓" | User | A bank transfer has started. → "Withdraw" only writes a pending row (FIN-10) [RA]; no rail. The panel is hidden while the lock is on [V]. | **B** | "Withdrawal request of ₹X recorded ✓ — this is not a bank transfer yet." (founder) |
| W-10 | `WithdrawFlow.tsx` lines 65, 161–162 | "Platform fee ({pct}%) −₹X … You receive ₹Y" | User / fee | A fee deducted again at withdrawal. → The website computes 15% at withdrawal [CD]; the fee was taken twice and the withdrawal fee removed on 26 Jul (FIN-05) [RA]. | **C** | Finance decides whether any withdrawal fee applies (Q-2). This changes the displayed financial figure, so it is not Stage 1. |
| W-11 | `WithdrawFlow.tsx` line 169 | "Withdrawals of ₹5,000+ need an SMS OTP" | User / security | The OTP is enforced. → The website asks for it; the main backend never checks it (FIN-02) [RA]. | **C** | Keep until MB fixes FIN-02, or reword after a decision |
| W-12 | `components/app/teacher/PayoutDetailsForm.tsx` line 77 | "Payout details saved ✓ — you can now withdraw." | User | Withdrawals available. → Constraint 5. | **B** | "Bank details saved ✓" (founder) |
| W-13 | `ReferShare.tsx` line 60 | "Withdraw from your wallet →" | User | Referral money can be withdrawn. → Referral withdraw is a mock (FIN-10) [RA]; paused. | **B** | "View your wallet →" (founder) |
| W-14 | `app/app/teacher/locked/page.tsx` line 19 | "Track your earnings and withdraw securely." · "Withdraw to your verified bank account" · "PIN + OTP protected payouts" | User | Working, OTP-protected payouts. → Constraint 5; FIN-02 and FIN-10 [RA]. | **B** | "Track your recorded earnings." · "Withdrawal requests, when available" · "PIN-protected withdrawal requests" (founder) |
| W-15 | `locked/page.tsx` line 18 | "Track attendance and payouts per session" | User | Per-session payouts. → Constraint 5. | **B** | "Track attendance and earnings per session" (founder) |
| W-16 | `app/app/teacher/kyc/page.tsx` line 18 | "Bank account — Reverse penny-drop for payouts" | User / tech | That the account is used for payouts. → Describes a verification method [CD]. | **B** (minor) | "Reverse penny-drop to verify your bank account" (founder) |
| W-17 | `components/app/teacher/TeacherProgressCards.tsx` lines 13, 114 | "Enables secure payouts for your sessions" · "A one-time {price} (incl. GST) verification that activates your profile and payouts." | User / tax | That payouts are enabled, and GST is included. → Constraint 5. The GST treatment is a finance and legal fact [UD]. | **B** (payouts) / **C** (GST) | "Verifies your identity and bank details" · "…that activates your profile and verified status." Keep "(incl. GST)" until Q-5. |
| W-18 | `components/app/teacher/OnboardingWizard.tsx` line 287 | "…progress toward empanelment & payouts." | User | Payouts follow. → Constraint 5. | **B** | "…progress toward empanelment and your earnings wallet." (founder) |
| W-19 | `lib/i18n/messages.ts` line 118, with Hindi, Marathi, Bengali, Tamil and Telugu versions at lines 365, 612, 859, 1106 and 1353 | "Next: complete InstaKYC to unlock payouts →" | User (6 languages) | Payouts unlocked. → Constraint 5. | **B** | English: "Next: complete InstaKYC to verify your account →". The translations need native-speaker review. (founder) |
| W-20 | `components/app/teacher/InstaKycFlow.tsx` line 211 | "Your payout bank account is verified." | User | The bank account was verified. → Shown after InstaKYC bank verification [CD]. (The v1 route that marks banks verified without a check, FIN-08, is a different path.) | **A** | No change (optional: "Your bank account is verified.") |
| W-21 | `components/app/teacher/OfferingsForm.tsx` lines 65, 111; fallback in `lib/server/teacher.ts` line 980 | "NOSTOPS keeps {feePct \|\| 15}% to host & secure the booking." · "NOSTOPS · {feePct \|\| 15}%" | Contract (fee and purpose) | A fee and its purpose. → 15% is hard-coded as a fallback when the backend sends no value [CD]. The fee's purpose is undocumented [UD]. | **C** | Align with T-5 and Q-1/Q-3; remove the hard-coded fallback in Stage 4 |
| W-22 | `app/app/teacher/retreats/new/page.tsx` line 44 | "NOSTOPS keeps {pct}% to run payments, secure seats and handle your payouts." | Contract (fee purpose) | NOSTOPS pays teachers out. → Constraint 5. | **B** (payouts) / **C** (purpose) | "NOSTOPS retains a {pct}% platform fee." Purpose per the T-5 decision (founder + legal) |
| W-23 | `components/app/teacher/TeacherOneOnOneSnapshot.tsx` lines 22, 42, 71 | "You keep 85%" · "Monthly payouts" · amount × 0.85 (hard-coded) | User / fee | Payouts each month, and a fixed 85%. → The numbers are audit-engine net estimates [CD]. The main backend's 1:1 split is 85/15 [RA]; FIN-05. | **B** ("Monthly payouts") / **C** (85%) | "Monthly earnings (recorded)" (founder). 85% waits for Q-1; the hard-coded value moves to Stage 4. |
| W-24 | `components/app/teacher/TeacherHome.tsx` line 233; `HostRetreatWizard.tsx` lines 720, 986; `RetreatEconomicsCalculator.tsx` line 218; `RetreatEconomics.tsx` line 39 | "Platform fee {pct}%" · "NOSTOPS platform ({pct}%)" · "You keep / seat …" | User (calculators) | An estimate using the backend's fee. → Calculated from the main backend's figure [CD]. | **A** | No change (follows the Q-1 outcome automatically) |
| W-25 | `components/app/teacher/FastTrackApply.tsx` line 149 | "Submit your details, pay ₹X, and we'll get you in front of a Council Guru within 7 days." | Contract (paid-service deadline) | A guaranteed 7-day deadline for a paid service. → No SLA documented [UD]; Fast-Track fees were mock-paid (FIN-03/09) [RA]. | **C** | Confirm or remove the deadline (Q-8). Placeholder: "…and we'll schedule your Council interview after review." |
| W-26 | Wallet activity notes from the main backend, shown on the wallet page (for example "Retreat reservation · gross ₹3,000 · platform fee 15% (₹450)") | Backend text | Tech | Bookings and fees. → Built from orders that include mock-paid ones (constraint 3) [RA]. | **D** / Stage 4 | Label where each record came from in the backend (Stage 4); no website copy change |

### 3.5 Coordinator and Council

| ID | Where | Exact current wording | Type | Implies → evidence | Class | Recommendation (approval) |
|---|---|---|---|---|---|---|
| C-1 | Main-backend `revenue_share_note`, shown at `CoordinatorHome.tsx` line 106 (mapped in `lib/server/coordinator.ts` line 112) | "2% of gross · credited when booking escrow is approved · attribution locked at teacher empanelment (never re-drawn)." | Tech → user, contractual | An escrow arrangement, a 2% rate and permanent attribution. → Text seen in stored evidence from `/coordinators/me/revenue-share` [RA]. It is the **only "escrow" wording still reachable on the website**. | **B** (escrow) / **C** (2% and attribution) | Main backend to change the text (Stage 4), or the website shows its own text after Q-7. Suggested: "2% of gross, recorded in your coordinator wallet when the booking is approved." |
| C-2 | `components/app/council/CouncilHome.tsx` line 274 | "Council review payouts come from NOSTOPS' share only — a teacher's 70–85% revenue share is never touched." | Contract (reviewer pay) | Reviewer payouts exist, and a funding source. → Reviewer earnings were built from mock-paid fees and paid on rejections (FIN-09) [RA]; no rail. | **C** | "Council review fees are recorded from NOSTOPS' share only…" after Q-7 (finance) |
| C-3 | `CoordinatorHome.tsx` line 149 | (= T-4) | | | **C** | See T-4 |

### 3.6 Admin (operator) wording

| ID | Where | Exact current wording | Implies → evidence | Class | Recommendation (approval) |
|---|---|---|---|---|---|
| D-1 | `PayoutsQueue.tsx` line 67 | (= T-3) "Release ₹… to …?" | See T-3 | **D** | See T-3 |
| D-2 | `PayoutsQueue.tsx` line 104 | "Loading the queue moves eligible payouts out of their cooling period on the main backend. It is recorded with your name." | Accurate warning (FIN-01) [RA] | **A** | No change |
| D-3 | `PayoutsQueue.tsx` lines 118–119 | "No payouts awaiting approval" / "Payout requests appear here after their cooling period elapses." | "Payouts" means payout *requests* | **D** | "No payout requests awaiting approval" (founder) |
| D-4 | `app/app/admin/payouts/page.tsx` lines 45–53 | "Retreat payouts processed" (count) · "Retreat platform fee" · "Retreat gross processed" | That money was processed and paid. → The figures are main-backend aggregates (`lib/server/admin-payouts.ts` lines 54–55) [CD]; FIN-07 shows ₹0 payouts; mock orders [RA]. | **D** | "Retreat payout records" · "Retreat platform fee (recorded)" · "Retreat gross (recorded)" (founder) |
| D-5 | `admin/payouts/page.tsx` lines 23, 27 | "Payouts" · "Payouts are paused for the financial safety audit" | Accurate [V] | **A** | No change |

### 3.7 Fee, tax and "8% / 15%" cluster (all C — no definitive wording until decided)
Every figure below appears today. **None is assumed contractual.**

| Source | Figure | Label |
|---|---|---|
| Marketing and sign-up (M-1) | "Keep 70–85%" | [V] |
| FAQ (L-7) | 70% (3 months) → 85% (12 months) | [V] |
| City FAQ (L-8) | 70% / 80% / 85% at 3, 6 and 12 months | [V] |
| Main backend `commission-tier` | org batch: teacher 70 / platform 30 ("pilot"), next tier 80% at 3 months; 1:1: teacher 85 / platform 15 | [RA] |
| Wallet `platform_fee_pct` | 15 | [RA] |
| Withdraw panel (W-10) | a further 15% at withdrawal; FIN-05 says the withdrawal fee was removed on 26 Jul | [CD]/[RA] |
| 1:1 card (W-23) | 85% hard-coded | [CD] |
| 1:1 offering form (W-21) | 15% fallback | [CD] |
| Coordinator (C-1) | 2% of gross | [RA] |
| Fast-Track | three different splits: 85/15, 15% to the company, 30% reviewer (FIN-09) | [RA] |
| **8%** | Found **only** in an older test report: a "92% to you / NOSTOPS 8%" preview in the teacher pricing form, later aligned to the backend's 15% (`test_reports/iteration_11.json`). **No 8% remains in the current website code.** The legal-page 8% you referenced was not found (§0). | [V]/[RA] |
| **TDS** | Main-backend `commission-tier` `tax_note`: "Teachers are responsible for filing their own income tax and GST. The platform does not deduct TDS on payouts." **The website never displays it.** No TDS wording exists on the website. Whether TDS applies is a legal question; it is not inferred from code. | [RA]/[V] |
| **GST** | "(incl. GST)" on the InstaKYC price (W-17) and a main-backend `tax_note` on verification prices (`components/app/teacher/UnifiedVerification.tsx` lines 48, 89) | [CD] |

**Searched for and not found in user-visible website copy [V]:**
- "Razorpay";
- "instant withdrawal", "instant payout" or "instant transfer";
- "escrow" — except the backend-supplied coordinator note C-1.

The only "instant" wording is non-financial: the AI Guru, and "Seekers reserve instantly".

**Non-financial time promises (noted, A):**
- "We reply within 1–2 working days": `contact/page.tsx` lines 51 and 64, `support/page.tsx` lines 55 and 172.
- The org enquiry SLA "within 2 working days": `lib/org/enquiry.ts` line 7.

These are service-response targets, not money claims. The founder may confirm them.

---

## 4. Questions for founder, finance or legal
- **Q-1 (fee schedule):** what is the single contractual fee schedule?
  - Which applies: 70/80/85 by engagement length (and at which months), a flat 15% for 1:1 and retreats, 70/30 for org
    pilots?
  - Does "of every rupee" cover service fees (InstaKYC, Fast-Track)?
  - Where should the one published schedule live?
- **Q-2 (withdrawal fee):** is any fee charged at withdrawal (FIN-05)? If not, the withdraw panel's "Platform fee (15%)"
  line is wrong.
- **Q-3 (fee purpose):** approve the platform-fee purpose wording for T-5, W-21 and W-22. The draft for T-5 is "NOSTOPS
  retains its platform fee to support platform operations and payment processing."
- **Q-4 (TDS):** is NOSTOPS required to deduct TDS on teacher, venue or coordinator earnings? The main backend
  currently says it does not. Legal opinion required.
- **Q-5 (GST):** is the proprietorship GST-registered, and is "incl. GST" on InstaKYC and other service prices
  accurate?
- **Q-6 (payout rail):** until a teacher-payment rail is approved, should "withdraw" exist at all for teachers, beyond
  the current pause, or appear only as a "request" that is clearly labelled?
- **Q-7 (coordinator and Council money):**
  - Confirm the 2% coordinator share, the "attribution never re-drawn" rule, the milestone-bonus timing and its source,
    and the Council reviewer share.
  - Is "never touches the teacher's 70–85%" accurate?
- **Q-8 (Fast-Track deadline):** keep or remove "a Council Guru within 7 days"?
- **Q-9 (refund time):** what refund processing time should replace "[to be confirmed]"?
- **Q-10 (legal entity):** the legal entity name, registered address and Grievance Officer details for the
  proprietorship.
- **Q-11 (off-platform payment):** may a retreat host collect group payments by direct bank transfer (M-11)?
- **Q-12 (venue settlements):** were any venue "settled" amounts real bank transfers? If none, T-1 becomes "records".
- **Q-13 (processor naming):** should Terms and Privacy name Cashfree as the payment processor?
- **Q-14 (admin approve):** does the main backend's payout "approve" start any external transfer? The main-backend
  team must confirm.
- **Q-15 (missing legal statements):** where are the Terms, FAQ and Privacy statements about Razorpay, escrow, instant
  withdrawal, TDS and 8% that you referenced? They are not in this website. They may be in the mobile app or the main
  backend.

---

## 5. Implementation plan with approval gates (nothing started)

| Stage | Scope | Findings | Affected files | Dependencies | Risks | Tests | Approval gate |
|---|---|---|---|---|---|---|---|
| **1 — Safe presentational copy** (no contractual change) | Replace payout, "paid out", "settled" and "withdraw now" wording with record-based wording | T-1, T-2, M-2, M-3, M-4 (first part), M-5 ("payouts" point), M-6, M-7, W-1, W-2, W-5, W-6, W-7, W-8, W-9, W-12, W-13, W-14, W-15, W-16, W-17 (first part), W-18, W-19, W-22 (first part), W-23 ("Monthly payouts") | `VenueOwnerHome.tsx`, `become-a-teacher/page.tsx`, `become-a-teacher/[city]/page.tsx`, `how-it-works/page.tsx`, `lib/guides.ts`, `teacher/wallet/page.tsx`, `PayoutStatus.tsx`, `SettlementLedger.tsx`, `WithdrawFlow.tsx` (lines 33, 40, 117 only), `PayoutDetailsForm.tsx`, `ReferShare.tsx`, `teacher/locked/page.tsx`, `teacher/kyc/page.tsx`, `TeacherProgressCards.tsx`, `OnboardingWizard.tsx`, `lib/i18n/messages.ts`, `teacher/retreats/new/page.tsx`, `TeacherOneOnOneSnapshot.tsx` | Founder approval of the exact strings; native-speaker review for the 5 translations | Some lines (M-4, W-22) sit next to fee claims, so only the payout words change. Watch for layout overflow. Status-matching logic must stay unchanged. | tsc and ESLint; production build; check old strings are gone from the build; desktop and mobile visual check on the local mock; gateway regression | **Founder** (exact before/after list, as in Phase 1a) |
| **2 — Legal and commercial wording** | Fee schedule, fee purpose, deadlines, legal pages, tax, off-platform payment, coordinator and Council terms | L-1, L-2, L-4, L-5, L-7, L-8, L-9, L-11, L-13, M-1, M-4/M-5 (fee part), M-11, W-10, W-11, W-17 (GST), W-21, W-22 (purpose), W-23 (85%), W-25, T-4, T-5, C-1 (2%), C-2 | `terms`, `privacy`, `faq` and `refunds` pages, `LegalEntityNotice.tsx`, `lib/server/cities.ts`, marketing pages, `OfferingsForm.tsx`, `WithdrawFlow.tsx` (fee line), `FastTrackApply.tsx`, `CoordinatorHome.tsx`, `CouncilHome.tsx`, `GroupBook.tsx` | Answers to Q-1 … Q-11 and Q-13. The same wording must be used in the mobile app and main backend (Q-15). | Contractual exposure; inconsistency with the main backend and mobile app; "Last updated" dates | Same as Stage 1, plus a legal-page snapshot review | **Founder + finance + legal, in writing** |
| **3 — Admin terminology** | Operator wording that could be read as "money moved" | T-3/D-1, D-3, D-4 | `PayoutsQueue.tsx`, `app/app/admin/payouts/page.tsx` | Q-14 (what approve does) | Low: payouts are frozen; operators must not be misled at unfreeze | Admin pages rendered on the local mock; admin-gate tests | **Founder** (+ main-backend confirmation) |
| **4 — Backend provenance, reporting, schema and API** (scoped separately) | Tag mock-gateway orders and derived credits; exclude them from totals; separate "recorded" from "provider-confirmed"; one fee source; remove hard-coded 15/85; backend texts (C-1 note, activity notes, `tax_note`); FIN-03/04/05/07/10 | W-21 (fallback), W-23 (0.85), W-26, C-1 text, and the main-backend items MB-1 … MB-8 | Main backend (separate codebase) first; then `lib/server/*` mappers and displays | Founder decisions (B9-x, Q-1, Q-2, Q-4, Q-6); main-backend team; the separate fix pack | Financial correctness; data migration risk; must not touch the ₹13,600 holds, the ₹1,062 correction or the protected rows without separate sign-off | Main-backend staging tests (MB acceptance tests); website parity tests | **Founder + finance**, separate authorization. **Never combined with Stage 1–3 copy work.** |

**Order:** Stage 1 and Stage 3 can follow founder approval. Stage 2 waits for the decisions. Stage 4 is scoped and
approved on its own track.

---

## 6. Confirmation: nothing changed
- **Read-only audit:** no code, copy, legal text, data, configuration, environment, schema, API or financial
  calculation was changed.
- **No financial operations or provider calls:**
  - no wallet balance, ledger row, order, refund, hold or deferred effect was touched;
  - the ₹13,600 stale holds were not reversed, the ₹1,062 correction was not applied, and `led_6693375254d1` and
    `led_a28204971867` were not touched;
  - no payout or escrow-release workflow was enabled;
  - no call was made to Cashfree, any payment provider or the live main backend.
- **Lock, freeze, deployment:** `MONEY_OPS_FROZEN` is unchanged (ON) and the website lock is ON. Nothing was published
  or deployed.
- **The only files written:** this report and a one-line note in `memory/PRD.md` (documentation only).
- **Stopped. Waiting for explicit founder approval.** B4.9 and B5.2 remain BLOCKED.
