# Financial fixes — verification on the live main backend (safe checks only)

- **Run:** `python scripts/fin_verify_fixes.py` against `https://pro-learn-connect-1.emergent.host`.
- **Results:** `test_reports/fin_audit/verify_fixes.json` and `verify_evidence.json`.
- **Safe checks only:** every request was a read, signed out, or rejected before any write (an amount below the
  minimum, more than the available balance, or an id that does not exist). The PIN check was never reached, and no
  balance, ledger, payout or order changed.
- **Not called:** `/admin/payouts/list` and `/sweep`, because they still sweep. The wallet reconcile was called only as
  `report_only`.

## Verdict: none of the reported fixes is visible on the live backend

| Fix | What we checked | Result | Status |
|---|---|---|---|
| FS-00 money switch | 9 money routes signed out | 401 "Not authenticated", not 423 | ❌ Not live |
| FS-00 money switch | Signed-in demo teacher: withdraw ₹1, referral ₹1,99,999, payout request ₹0 | 400 "Minimum withdrawal is ₹500" / "exceeds available balance ₹0" / "Minimum payout amount is Rs.1000". The routes run as before. | ❌ Not live |
| FIN-01 read-only pages | API list | `/admin/payouts/sweep` still a GET, "also runs on /list". Wallet reconcile still offers `wallet_to_ledger` on a GET. | ❌ No change visible (not called) |
| FIN-02 withdrawal checks | API list | `teacher-wallet/withdraw` still takes only amount, PIN and method (no OTP token). v1 and referral withdraw still take amount only. Payout request is still free-form. v1 bank account is still "verified=True set optimistically". | ❌ No change visible |
| FIN-03 fake cards off | Non-existent ids with an invalid card | Fast-Track pay: 404 "Request not found". Premium book: 404 "Teacher not found". Batch pay: 404 "Booking not found". The mock routes are still live. | ❌ Not removed |
| FIN-03 mock checkout | Non-existent order | 404 "Mock checkout disabled" | ✅ Off (it was already in production mode in the October snapshot) |
| FIN-04 wallet = ledger | Reconcile, our calculator + backend report-only | Same ₹2,212 gap (₹1,150 wrong-sign row + ₹1,062 not credited). The backend still reports 1 drift row. | ❌ Unchanged |
| FIN-05 fee once | Balance | Withdrawable still ₹77,981 of ₹91,743 (85%) | ❌ Unchanged |
| FIN-06–10 | Ledger and referral wallet | Same 37 ledger rows (none added or changed since 25 Oct). 7 withdrawals still "pending". Counter gap still ₹700. 2 mock referral withdrawals still "processing". | ❌ Unchanged |

Our suite `test_wf_financial_safety.py` had 121 pass, 1 skipped and **2 expected failures still failing**: the wallet
gap (FIN-04) and the double fee (FIN-05). Those two flip to "fixed" automatically once the backend fixes them.

## Possible reasons
- The changes are not deployed to `pro-learn-connect-1.emergent.host` yet. They may be on a branch, a staging copy or
  waiting for a deploy.
- The data repairs (FIN-04, 05, 10) were not applied. They should wait for the founder's sign-off anyway.

The money lock stays ON. B4.9 stays blocked.
