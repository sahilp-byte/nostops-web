"""FINANCIAL SAFETY AUDIT — wallet reconciliation calculator (READ-ONLY, 2026-06).

Pure functions over the main backend's own records (`/teacher-wallet/balance` and
`/teacher-wallet/transactions`). Nothing is written anywhere except the report file.

Buckets, exactly as the backend's `/admin/wallet/reconcile` computes them:
  available ledger = payout_release + withdrawal + adjustment   (signed as stored)
  held ledger      = hold - payout_release - |hold_reversed|

`explain()` traces the difference between the wallet balance and the available ledger
to individual rows:
  * sign errors   — a `withdrawal` stored with a POSITIVE amount (adds 2x to the ledger);
  * anchor replay — the last heal row states the wallet value at that moment
    ("Reconcile wallet→ledger: wallet ₹X, ledger was ₹Y"); replaying the later rows with
    the correct signs gives the balance the wallet SHOULD have; any shortfall is matched
    to the later rows whose effect is missing from the wallet.

Usage: python scripts/fin_reconcile.py [/app/test_reports/fin_audit/evidence.json]
"""
import json
import re
import sys
from typing import Optional

AVAILABLE_TYPES = {"payout_release", "withdrawal", "adjustment"}
HEAL_NOTE = re.compile(r"wallet\s*₹\s*(-?[\d,]+).*?ledger was\s*₹\s*(-?[\d,]+)", re.I)


def _amt(t: dict) -> float:
    return float(t.get("amount_inr") or 0)


def correct_signed(t: dict) -> float:
    """The amount with the sign it should have: withdrawals always debit."""
    a = _amt(t)
    return -abs(a) if t.get("type") == "withdrawal" else a


def available_ledger(tx: list) -> float:
    return sum(_amt(t) for t in tx if t.get("type") in AVAILABLE_TYPES)


def held_ledger(tx: list) -> float:
    return (sum(_amt(t) for t in tx if t.get("type") == "hold")
            - sum(_amt(t) for t in tx if t.get("type") == "payout_release")
            - sum(abs(_amt(t)) for t in tx if t.get("type") == "hold_reversed"))


def heal_anchor(tx: list) -> Optional[dict]:
    rows = [t for t in tx if t.get("type") == "adjustment" and HEAL_NOTE.search(str(t.get("note") or ""))]
    if not rows:
        return None
    last = max(rows, key=lambda t: str(t.get("created_at") or ""))
    w, l = (float(x.replace(",", "")) for x in HEAL_NOTE.search(last["note"]).groups())
    return {"row": last, "wallet_at_heal": w, "ledger_before_heal": l, "unbacked_amount": w - l}


def _subset_matching(rows: list, target: float) -> list:
    """Smallest set of later rows whose correct amounts add up to `target` (small n)."""
    from itertools import combinations
    for n in range(1, min(len(rows), 6) + 1):
        for combo in combinations(rows, n):
            if abs(sum(correct_signed(t) for t in combo) - target) < 0.5:
                return list(combo)
    return []


def explain(balance: float, held: float, tx: list) -> dict:
    tx = sorted(tx, key=lambda t: str(t.get("created_at") or ""))
    ledger = available_ledger(tx)
    sign_errors = [t for t in tx if t.get("type") == "withdrawal" and _amt(t) > 0]
    out = {
        "wallet_balance": balance, "available_ledger": ledger, "delta_ledger_minus_wallet": ledger - balance,
        "wallet_held": held, "held_ledger": held_ledger(tx), "held_delta": held_ledger(tx) - held,
        "sign_errors": [{"ledger_id": t.get("ledger_id"), "created_at": t.get("created_at"), "amount_inr": _amt(t),
                         "ledger_excess": 2 * _amt(t)} for t in sign_errors],
        "anchor": None, "missing_from_wallet": [], "unexplained": None,
    }
    anchor = heal_anchor(tx)
    if anchor:
        later = [t for t in tx if str(t.get("created_at") or "") > str(anchor["row"].get("created_at") or "")
                 and t.get("type") in AVAILABLE_TYPES]
        expected = anchor["wallet_at_heal"] + sum(correct_signed(t) for t in later)
        shortfall = expected - balance
        missing = _subset_matching(later, shortfall) if abs(shortfall) >= 0.5 else []
        out["anchor"] = {"ledger_id": anchor["row"].get("ledger_id"), "created_at": anchor["row"].get("created_at"),
                         "note": anchor["row"].get("note"), "wallet_at_heal": anchor["wallet_at_heal"],
                         "ledger_before_heal": anchor["ledger_before_heal"], "unbacked_amount": anchor["unbacked_amount"],
                         "expected_wallet_now": expected, "wallet_shortfall": shortfall}
        out["missing_from_wallet"] = [{"ledger_id": t.get("ledger_id"), "type": t.get("type"), "created_at": t.get("created_at"),
                                       "amount_inr": correct_signed(t)} for t in missing]
        explained = sum(e["ledger_excess"] for e in out["sign_errors"]) + sum(m["amount_inr"] for m in out["missing_from_wallet"])
        out["unexplained"] = round(out["delta_ledger_minus_wallet"] - explained, 2)
    return out


def withdrawals(tx: list, lifetime_withdrawn: float) -> dict:
    rows = sorted((t for t in tx if t.get("type") == "withdrawal"), key=lambda t: str(t.get("created_at") or ""))
    gross = sum(abs(_amt(t)) for t in rows)
    fee = lambda t: float(t.get("fee_inr") if t.get("fee_inr") is not None else (t.get("meta") or {}).get("fee_inr") or 0)  # noqa: E731
    status = lambda t: t.get("status") or (t.get("meta") or {}).get("status")  # noqa: E731
    return {"count": len(rows), "gross_debited": gross, "withdrawal_fee_total": sum(fee(t) for t in rows),
            "statuses": sorted({str(status(t)) for t in rows}), "lifetime_withdrawn_counter": lifetime_withdrawn,
            "counter_gap": gross - lifetime_withdrawn,
            "rows": [{"ledger_id": t.get("ledger_id"), "created_at": t.get("created_at"), "amount_inr": _amt(t),
                      "fee_inr": fee(t), "status": status(t)} for t in rows]}


def fees(tx: list, platform_fee_pct: float) -> dict:
    """Is the platform fee taken at credit (hold stored net) AND again at withdrawal?"""
    holds = [t for t in tx if t.get("type") == "hold"]
    gross_rows = []
    for t in holds:
        m = t.get("meta") or {}
        g = m.get("gross_inr")
        if g is None:
            mt = re.search(r"gross ₹([\d,]+)", str(t.get("note") or ""))
            g = float(mt.group(1).replace(",", "")) if mt else None
        if g:
            gross_rows.append({"ledger_id": t.get("ledger_id"), "gross": float(g), "credited": _amt(t),
                               "fee_at_credit_pct": round(100 * (1 - _amt(t) / float(g)), 2)})
    w = [t for t in tx if t.get("type") == "withdrawal"]
    wfee = [round(100 * float(t.get("fee_inr") if t.get("fee_inr") is not None else (t.get("meta") or {}).get("fee_inr") or 0)
                  / abs(_amt(t)), 2) for t in w if _amt(t)]
    p = platform_fee_pct / 100
    return {"holds_with_gross": len(gross_rows), "fee_at_credit_pct": sorted({r["fee_at_credit_pct"] for r in gross_rows}),
            "fee_at_withdrawal_pct": sorted(set(wfee)), "platform_fee_pct": platform_fee_pct,
            "effective_fee_pct_if_both": round(100 * (1 - (1 - p) * (1 - p)), 2), "examples": gross_rows[:3]}


def main(path: str) -> dict:
    calls = json.load(open(path))["calls"]
    bal = calls["teacher GET /teacher-wallet/balance"]["body"]
    tx = calls["teacher GET /teacher-wallet/transactions?limit=500"]["body"]["transactions"]
    rec = calls.get("admin GET /admin/wallet/reconcile?heal_direction=report_only", {}).get("body")
    report = {
        "teacher_id": bal.get("teacher_id"),
        "explain": explain(float(bal["balance_inr"]), float(bal["held_inr"]), tx),
        "withdrawals": withdrawals(tx, float(bal.get("lifetime_withdrawn_inr") or 0)),
        "fees": fees(tx, float(bal.get("platform_fee_pct") or 0)),
        "withdrawable_vs_balance": {"balance": bal["balance_inr"], "withdrawable": bal.get("withdrawable_inr"),
                                    "ratio": round(float(bal.get("withdrawable_inr") or 0) / float(bal["balance_inr"]), 4)
                                    if bal["balance_inr"] else None},
        "backend_reconcile_report_only": rec,
    }
    return report


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "/app/test_reports/fin_audit/evidence.json"
    r = main(src)
    with open("/app/test_reports/fin_audit/reconciliation.json", "w") as f:
        json.dump(r, f, indent=1, default=str)
    print(json.dumps(r, indent=1, default=str)[:6000])
