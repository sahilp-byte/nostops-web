# NOSTOPS — Phase 1a: user-facing terminology corrections (preview only)

**Date:** 26 Oct 2026. **Status:** done in preview. **Not published.** Stopped for founder review.

**Scope:** only the items you approved on 26 Oct. The original Phase 1 target list was **not found** in the project, so
this report does **not** claim that every Phase 1 target is complete.

## 1. Changed files and strings (5 files, 7 strings, copy only)

| # | File | Before | After |
|---|---|---|---|
| a | `frontend/components/app/learner/BookJourney.tsx` (line 32, card body) | "Your session fee is held safely and released to the teacher after your session — fair for everyone." | "Fair for teachers: your teacher’s share is recorded as reserved earnings. Its availability is subject to session completion and NOSTOPS’ applicable payment and verification rules." |
| c1 | `frontend/components/app/venue/VenueOwnerHome.tsx` (line 157) | "In escrow (owed to you)" | "Reserved earnings" |
| c2 | `frontend/components/app/venue/VenueOwnerHome.tsx` (line 159) | "Held safely until each retreat completes." | "Reserved until each retreat completes." |
| d | `frontend/components/app/teacher/TeacherOneOnOneSnapshot.tsx` (line 84) | "Get verified to receive these payouts to your wallet." | "Get verified to have eligible earnings recorded in your NOSTOPS wallet." |
| e1 | `frontend/app/app/teacher/wallet/page.tsx` (line 55) | "On hold · ₹…" | "Reserved earnings · ₹…" |
| e2 | `frontend/app/app/teacher/wallet/page.tsx` (line 67) | Stat label "On hold" | Stat label "Reserved earnings" |
| t | `frontend/components/app/teacher/WithdrawFlow.tsx` (line 192) | "Secured by your wallet PIN[ + SMS OTP]. Funds reach your account in 1–3 business days." | "Secured by your wallet PIN[ + SMS OTP]." |

- **Note on (a):** your quoted text left out the closing "— fair for everyone." of the same sentence. I replaced the
  whole sentence, because keeping that tail after the new text would have produced broken copy.
- **Unchanged in every row:** the amounts, variables (`w.combined.held`, `w.session.held`, `payouts.heldInEscrow`) and
  the conditions that decide when each line shows.

## 2. Flagged for your review (deliberately left unchanged)
- **(b) Booking-page badge "Escrow-protected"** (`BookJourney.tsx` line 395): **not** replaced with "Reserved until
  delivered". The condition you set can't be verified:
  - the audit evidence shows a 1:1 reservation is released on session **completion or teacher reassignment**;
  - stale holds exist (the ₹13,600).

  So "until delivered" would imply a guarantee. Options:
  - remove the badge;
  - or use neutral wording, for example "Reserved earnings".
- **Card title "Escrow-protected payments"** (`BookJourney.tsx` line 32): it still names escrow. Only the body was
  approved. Suggested title: "Fair payments for teachers".
- **Coordinator page: "Milestone bonuses are paid within 7 days of unlock…"** (`CoordinatorHome.tsx` line 149):
  unchanged, as you instructed. It is not verified.
- **Other financial claims, not in the approved list, unchanged:**
  - "Settled to you" (venue dashboard);
  - "Fast, transparent payouts … secure withdrawals to your bank or UPI" (become-a-teacher pages);
  - admin "Release ₹… to {teacher}?" (a real payout approval, admin only).

## 3. Confirmation that the excluded areas were not touched
- **Only these 5 frontend files changed** (7 lines added, 7 removed). Nothing changed in:
  - the backend (`git status -- backend`: no changes);
  - APIs, schema, database fields, ledger types, status values or balances;
  - wallet, escrow, payout, order or refund logic;
  - environment settings.
- **Not touched:**
  - **`MONEY_OPS_FROZEN`:** not touched; the website lock stays ON.
  - **Data:** the ₹1,062 discrepancy, the ₹13,600 stale holds and the protected ledger rows.
  - **Other:** `frontend/yarn.lock`.
- **No contact with Cashfree or the live main backend:** no call, payment, sign-in or deployment.

## 4. Tests

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | clean |
| ESLint on the 5 changed files | clean |
| Production build (`next build`, separate copy outside the repository) | compiled successfully. The only log noise is the known `/yoga-teachers/[city]` "Dynamic server usage" notes from before. |
| Compiled-output content check | New strings present: card text (3 files), venue line (2), 1:1 line (2), "Reserved earnings" (4). Old strings found **0 times**: "held safely and released to the teacher", "In escrow (owed to you)", "Held safely until each retreat", "receive these payouts to your wallet", "Funds reach your account in 1–3 business days", "On hold". |
| Gateway regression (in-process: freeze, Razorpay callback, encoded path) | 359 passed, 12 skipped (the reviewed non-money routes), 0 failed |

- No existing test pinned the changed strings, so none needed updating.
- Pages were not rendered while signed in, which would need live sign-ins.

**Stopped. Not published. B4.9 and B5.2 remain BLOCKED.**

---

## 5. Final corrections (founder-approved 26 Oct, preview only)
**Diff:** `frontend/components/app/learner/BookJourney.tsx` only. 2 lines added, 6 removed:

```diff
-  { icon: '🛡️', title: 'Escrow-protected payments', body: 'Fair for teachers: …' },
+  { icon: '🛡️', title: 'Fair payments for teachers', body: 'Fair for teachers: …' },
-        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
+        <div className="mt-4 grid grid-cols-3 gap-3">
-          <div className="card p-5 text-center">
-            <p className="text-2xl font-black text-ink">✓</p>
-            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">Escrow-protected</p>
-          </div>
```

- **The grid change is layout only.** With the 4th card removed, a 4-column grid would leave an empty slot, so the
  3 remaining cards now sit in one row of 3. *(Superseded by §6: phones now stack the cards, and 3 sit in a row from
  640 px.)*
- **The badge was removed, not replaced.** "Reserved until delivered" was not used.
- **No "escrow" wording is left** in any user-visible website copy.

**Recorded, not changed:** `memory/TERMINOLOGY_REVIEW_BACKLOG.md`.
- T-1: "Settled to you"
- T-2: "Fast, transparent payouts"
- T-3: "Release ₹… to teacher?"
- T-4: "Milestone bonuses are paid within 7 days of unlock"

**Earlier Phase 1a copy is intact:** all 7 approved strings are present in the source, and no old string is left.

**Build and tests:**
- tsc and ESLint clean.
- Production build compiled successfully.
- Gateway regression: 359 passed, 12 skipped, 0 failed.

**Preview review (desktop width, 1440 px):**
- **On the preview site,** every changed page is signed-in only (`/app/...`). A signed-out visit to `/app/book-journey`
  is sent to the sign-in page, and signing in would mean a live sign-in, so the pages **were not reviewed there**.
- **Instead:** the changed components were rendered with sample data on a **temporary page in the separate build copy
  outside the repository.** That page was never committed or deployed, and was deleted after the check. The backend
  address was deliberately unreachable.
- **Results:**
  - **Booking flow (region step clicked through):**
    - card title "Fair payments for teachers" and the approved body: ✅;
    - stats row shows 3 cards (Verified teachers, Empanelled, Verified & KYC): ✅;
    - no "escrow" anywhere: ✅.
  - **Venue dashboard:** "Reserved earnings" and "Reserved until each retreat completes.": ✅.
  - **Withdraw panel:** "Secured by your wallet PIN." with no timing promise: ✅. In the live app this panel is
    hidden anyway while the money lock is ON.
- **Not rendered:** the teacher wallet page and the teacher 1:1 card. They are server components that load live data,
  so they were checked in the source and the compiled output only.
- **Screenshots:** `test_reports/p0/phase1a/p1a_{card,stats,venue,withdraw}_desktop.png`.
- **Observation, not changed:** the venue dashboard's fee card reads "NOSTOPS keeps this to run secure payments &
  payouts." If you want it reviewed, it can be added to the backlog.

**Restrictions held:**
- frontend copy only;
- no backend, API, database, wallet, ledger or payment-flow change;
- no Cashfree call, financial change, publish or deploy;
- `MONEY_OPS_FROZEN` and the money lock ON;
- the ₹1,062 discrepancy, the ₹13,600 stale holds and the protected rows untouched.

---

## 6. Phase 1a visual verification (26 Oct, local safe environment)
**Environment:** fully local.
- The **production build of the current sources** (separate copy outside the repository) runs at `127.0.0.1:3106`.
- A **local mock backend** (`test_reports/p0/phase1a/phase1a_local_mock_backend.py`) serves fake QA data for every
  backend and local-engine call. It is read-only: it answered every write with 405.
- Nothing used the live system. The mock received all **112** page requests, the only 2 writes among them were refused
  by the mock, and no sign-in happened on the live system.
- The website lock stayed ON (`FINANCIAL_ACTIONS_UNLOCKED` unset).
- The temporary servers and the mock were stopped afterwards.
- Script and results: `test_reports/p0/phase1a/phase1a_visual_check.{py,json}`.

**🔧 One defect found and corrected (presentation only):**
- **Problem:** with the three-column row applied at every width (§5), the "EMPANELLED" label overflowed its card on a
  390 px phone (77 px of text in a 69 px space).
- **Fix:** the row now **stacks on phones and shows 3 in a row from 640 px**. Before the §5 change, phones used 2
  columns.
- **Diff:**

  ```diff
  -        <div className="mt-4 grid grid-cols-3 gap-3">
  +        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
  ```

**Numbers row (booking page), measured after the fix:**

| Width | Layout | Card width | Label overflow | Page side-scroll |
|---|---|---|---|---|
| 320 px | stacked (1 column) | 288 | none | none |
| 360 px | stacked | 328 | none | none |
| 390 px | stacked | 358 | none | none |
| 640 px | 3 in a row | 189 | none | none |
| 768 px | 3 in a row | 147 | none | none |
| 1024 px | 3 in a row | 227 | none | none |
| 1440 px | 3 in a row | 248 | none | none |

**Pages checked at desktop (1440 px) and mobile (390 px), using the real page code and fake data:**
- **Booking page** (`/app/book-journey`, after choosing a region):
  - card title "Fair payments for teachers" ✅;
  - no "escrow" anywhere ✅;
  - 3 stat cards ✅.
- **Teacher wallet** (`/app/teacher/wallet`, a verified teacher):
  - "Reserved earnings" appears **twice** (hero line and session-wallet stat) ✅;
  - "On hold" absent ✅;
  - the money-lock notice shows, as it should while the lock is ON ✅;
  - no overflow ✅.
- **Teacher 1:1 card** (`/app` dashboard, an unverified teacher with 1:1 bookings):
  - "Get verified to have eligible earnings recorded in your NOSTOPS wallet." ✅;
  - old text absent ✅;
  - no overflow ✅.
- **Earlier check, unchanged since:** the venue dashboard ("Reserved earnings", "Reserved until each retreat
  completes.") and the withdraw panel (no timing promise) were rendered in the §5 check.

**Screenshots:**
- Desktop, shown to you: `test_reports/p0/phase1a/p1a_{stats,card,wallet_hero,wallet_session,one_on_one}_desktop.png`.
- Mobile (390 px): measured and saved as `…_mobile.png` files. Per your earlier instruction, they are not displayed.

**Limitations:**
- These are the real page components with **fake data**, not real accounts. Live data could produce longer amounts or
  names than the samples.
- The signed-in pages on the shared preview site were not opened, because that would need a live sign-in.
- The booking stats show "—" for the two counts because the mock serves no directory data. That is the page's normal
  empty-data display.

**Phase 1a status:** visually verified for the approved scope, at mobile and desktop widths, in a safe local
environment.

**Backlog:** T-5 added. "NOSTOPS keeps this to run secure payments & payouts." has the **draft** replacement
"NOSTOPS retains its platform fee to support platform operations and payment processing." It is **not applied**; it
waits for confirmation of the fee's purpose and contractual wording.

**Tests after the fix:**
- tsc and ESLint clean.
- Production build compiled successfully.
- Gateway regression: 359 passed, 12 skipped, 0 failed.

**Restrictions held:**
- frontend presentation only;
- no backend, API, database or payment change;
- no Cashfree call or financial change;
- `MONEY_OPS_FROZEN` ON;
- nothing published or deployed.

**Stopped for founder review.**
