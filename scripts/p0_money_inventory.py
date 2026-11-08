"""P0 REMEDIATION — main-backend money-path inventory from the DEPLOYED route list (read-only).

Fetches the live main backend's /openapi.json (no other call), classifies every route that can
create, release, reverse or transfer money, or mark something paid, and checks whether the
website gateway lock (backend/financial_lock.py) refuses it. The route list is the deployed
contract; handler code is NOT visible (the 28 Aug copy in git history is not treated as current).

Output: /app/test_reports/p0/money_inventory.json  (+ a copy of the API list it was built from)
"""
import json
import re
import sys

import requests

sys.path.insert(0, "/app/backend")
import financial_lock  # noqa: E402

MB = "https://pro-learn-connect-1.emergent.host"
OUT = "/app/test_reports/p0"

# category, path regex (after /api/), methods ("WRITE" or "ANY"), direction
CLASSES = [
    ("fake-payment", r"mock-checkout|/pay$|premium-sessions/book$|razorpay", "ANY", "fake-in"),
    ("webhook", r"webhook", "WRITE", "inbound"),
    ("payment-in", r"^(payments/cashfree/orders$|v1/payments/(create|order|checkout)|retreats/[^/]+/(reserve|group-book)|"
                   r"one-on-one/(book|bookings?)$|kyc/.*(order|pay|checkout)|instakyc|subscriptions?/|wallet/top-?up|"
                   r"v1/payments/(?!admin))", "WRITE", "inbound"),
    ("withdraw/payout", r"withdraw|payout|bank-account|bank-verify|payout-details|setup-pin|change-pin|beneficiar", "WRITE", "outbound"),
    ("payout-read-mutation", r"^admin/payouts/(list|sweep)", "ANY", "outbound"),
    ("refund/cancel", r"refund|cancel|reversal|reverse|chargeback|dispute|expire|decline|teacher-action", "WRITE", "outbound"),
    ("mark-paid/settle", r"mark-paid|settle|reconcile|adjust|ledger|wallet|escrow|release|complete|reassign|split|commission", "WRITE", "outbound"),
    ("heal-read-mutation", r"^admin/wallet/reconcile", "ANY", "outbound"),
    ("credit/bonus", r"referral|credit|bonus|reward|earning|incentive|cashback", "WRITE", "outbound"),
    ("paid-status decision", r"fast-track/[^/]+/(decide|claim)|empanel|council/.*decision", "WRITE", "status"),
    ("job/sweep", r"sweep|cron|jobs?/|check-expired|auto-|scheduled|nightly|daily", "WRITE", "job"),
]
WRITE = {"post", "put", "patch", "delete"}


def sample(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "qa_probe_id", path)


def main():
    o = requests.get(f"{MB}/openapi.json", timeout=60).json()
    json.dump(o, open(f"{OUT}/main_backend_openapi_snapshot.json", "w"))
    rows = []
    for full, ops in sorted(o["paths"].items()):
        p = full[len("/api/"):] if full.startswith("/api/") else full.lstrip("/")
        for m, op in ops.items():
            if m not in WRITE and m != "get":
                continue
            hits = [(c, d) for c, rx, meth, d in CLASSES
                    if re.search(rx, p, re.I) and (meth == "ANY" or m in WRITE)]
            if not hits:
                continue
            body = b'{"order_type":"wallet_topup"}' if p == "payments/cashfree/orders" else b'{"action":"decline"}' \
                if p.endswith("teacher-action") else None
            rule = financial_lock.rule_for(m.upper(), sample(p), "", body, is_locked=True)
            desc = (op.get("description") or op.get("summary") or "").replace("\n", " ")
            rows.append({"method": m.upper(), "path": "/api/" + p, "categories": sorted({c for c, _ in hits}),
                         "direction": sorted({d for _, d in hits}), "website_gateway_rule": rule,
                         "frozen_mentioned": bool(re.search(r"FS-00|frozen|423", desc)), "summary": desc[:220]})
    json.dump({"route_count": len(o["paths"]), "money_routes": rows}, open(f"{OUT}/money_inventory.json", "w"), indent=1)
    out_unblocked = [r for r in rows if "outbound" in r["direction"] and not r["website_gateway_rule"]]
    print(f"{len(rows)} money-related routes of {len(o['paths'])} paths; outbound not refused by the gateway: {len(out_unblocked)}")
    for r in out_unblocked:
        print(f"  {r['method']:6} {r['path']:70} {r['categories']} | {r['summary'][:90]}")


if __name__ == "__main__":
    main()
