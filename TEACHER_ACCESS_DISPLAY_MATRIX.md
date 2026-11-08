# Teacher Access — Display Test Matrix (Prompt 18)

Runnable proof that the **"Your NOSTOPS Access"** card + **"Your Next Step"** directive
render correctly for every teacher status combination. Only one live demo teacher
exists, so this drives the exact pure functions the components render
(`lib/teacher-access-view.ts` + `lib/teacher-next-step.ts`) and asserts every output.
Gated feature rows are driven through the REAL central engine
(`summarizeFeatureAccess` / `canAccessFeature`) so the card, the Next Step, the menu
and the route/API guards can never drift.

Run:
```
cd frontend && yarn test:display     # node tests/verify_teacher_access_display.ts
```

## Core 3 × 3 (Verification × Empanelment)

| # | Verification | Empanelment | Your Next Step | Verif chip | Empan chip | KYC row | Empan row | Operate row |
|---|---|---|---|---|---|---|---|---|
| 1 | not_verified | not_empanelled | **action** · Complete Verification → /kyc | action | locked | action | locked | locked |
| 2 | not_verified | pending | **action** · Complete Verification → /kyc | action | pending | action | pending | pending |
| 3 | not_verified | empanelled¹ | **action** · Complete Verification → /kyc | action | completed | action | completed | locked |
| 4 | pending | not_empanelled | **info** · Verification in review | pending | locked | pending | locked | pending |
| 5 | pending | pending | **info** · Verification in review | pending | pending | pending | pending | pending |
| 6 | pending | empanelled¹ | **info** · Verification in review | pending | completed | pending | completed | pending |
| 7 | verified | not_empanelled | **action** · Complete Empanelment → /empanelment | completed | action | completed | action | locked |
| 8 | verified | pending | **info** · Empanelment under review | completed | pending | completed | pending | pending |
| 9 | verified | empanelled | **done** · You're all set (no CTA) | completed | completed | completed | completed | unlocked |

¹ Invalid per the foundational rule (empanelled ⇒ verified). The engine still renders a
sensible, non-contradictory output and the Next Step keeps routing to verification.

## Real-world edge states (authoritative verification ≠ raw InstaKYC record)

| Verification | Empanelment | canOperate | InstaKYC(₹799) | Your Next Step | Notes |
|---|---|---|---|---|---|
| verified | empanelled | false | **outstanding** | **action** · Activate your earning tools → /kyc | **teacher.demo** — admin-verified + empanelled but the ₹799 InstaKYC record is missing. Must **NOT** say "Complete Verification" (that contradicts the *Verification: Completed* chip). |
| verified | empanelled | false | done | **info** · Final approval pending | Everything done, awaiting the final NOSTOPS approval flip. |

## Invariants asserted every run
- `done` state never renders a CTA; every `action` state renders exactly one CTA.
- Every chip/row state maps to a known `FEATURE_STATE_LABEL` word → **state is never conveyed by colour alone**.
- The Next Step never contradicts the card's Verification / Empanelment chips.

**Result:** `✓ DISPLAY MATRIX PASSED — 11 states` (9 core + 2 edges), plus
`✓ ACCESS MATRIX PASSED — 8 states × 14 features` (`yarn test:access`).
