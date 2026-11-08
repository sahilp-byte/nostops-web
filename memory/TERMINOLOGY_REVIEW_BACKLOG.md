# NOSTOPS — Terminology review backlog (recorded, NOT changed)

**Recorded:** 26 Oct 2026, at the founder's request during Phase 1a.
**Status:** waiting for a separate terminology review. None of these strings has been changed. Don't treat any of them
as verified, and don't copy them to other pages.

| # | Where | Current text | Why it needs review |
|---|---|---|---|
| T-1 | Venue dashboard: `frontend/components/app/venue/VenueOwnerHome.tsx` (line 162) | "Settled to you" (with "{n} payout(s) to date") | "Settled" can read as an external bank settlement. The figure comes from the main backend's `total_settled`; whether it means money actually transferred is not verified from the website. |
| T-2 | Become-a-teacher pages: `frontend/app/(public)/become-a-teacher/page.tsx` (line 44) and `…/[city]/page.tsx` (line 76) | "Fast, transparent payouts": "InstaKYC, a wallet, and secure withdrawals to your bank or UPI." | A public promise about payout speed and withdrawals. Withdrawals are paused (money lock), and the audit found withdrawals never paid out (FIN-10). |
| T-3 | Admin payout queue: `frontend/components/app/admin/PayoutsQueue.tsx` (line 67) | "Release ₹{amount} to {teacher}?" | An admin confirmation for a real payout approval (frozen today). "Release" mixes up internal wallet terms with an external transfer. |
| T-4 | Coordinator page: `frontend/components/app/coordinator/CoordinatorHome.tsx` (line 149) | "Milestone bonuses are paid within 7 days of unlock, from NOSTOPS' share only…" | An unverified payment-timing promise that may be contractual. Founder review only. |
| T-5 | Venue dashboard, fee card: `frontend/components/app/venue/VenueOwnerHome.tsx` (line 169, third card, under "Your platform fee") | "NOSTOPS keeps this to run secure payments & payouts." | It describes what the platform fee is for, which may be contractual. **Proposed replacement (draft — NOT applied):** "NOSTOPS retains its platform fee to support platform operations and payment processing." Apply only after the fee's purpose and contractual wording are confirmed. |

**Rules for the review:** copy only. No change to amounts, status values, API fields or payment logic. Each replacement
must describe the real event, and an internal ledger entry must never be presented as an external settlement.

## Update: Phase 1b Stage 1 (26 Oct 2026)
- **Done in preview:** T-1 and T-2 were changed in Stage 1 (see `memory/PHASE_1B_STAGE1_COPY_REPORT.md`).
- **Still open:** T-3, T-4 and T-5.
- **Waiting for founder review:** W-9, W-14 (c) and W-17 (second part) were skipped and flagged.
- **Waiting for native-speaker review:** the InstaKYC message in 5 languages (hi/mr/bn/ta/te,
  `lib/i18n/messages.ts` lines 365, 612, 859, 1106 and 1353). They are unchanged and were not machine-translated.
- **26 Oct, Stage 1 final:**
  - **Done in preview:** W-9, W-14 (c), W-17 (second part) and the T-1 sub-line.
  - **Left unchanged and flagged:**
    - the W-8 PIN-setup line;
    - the W-11 OTP step label;
    - "…it protects your payout details" on the bank-details form.
