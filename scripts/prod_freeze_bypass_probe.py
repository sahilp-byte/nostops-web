"""POST-DEPLOYMENT AUDIT — main-backend freeze on ALTERNATE money routes (read-only probes).
Every call targets an id that does not exist, so without the freeze the backend can only answer
"not found"/validation — nothing can be written. A 423 FS00_MONEY_FROZEN answer proves the freeze
is checked first on that route. Calls go DIRECTLY to the main backend (bypassing the website
gateway lock) to see whether the backend's own freeze holds.
Output: /app/test_reports/prod_audit/freeze_bypass.json
"""
import json
import sys

sys.path.insert(0, "/app/scripts")
from prod_postdeploy_audit import MB, NOWHERE, req, short  # noqa: E402

PROBES = [
    ("refund (Cashfree)", "admin", "POST", f"/api/payments/cashfree/orders/{NOWHERE}/refunds", {"amount": 1}),
    ("retreat cancel-with-refund", "teacher", "POST", f"/api/retreats/{NOWHERE}/reservations/{NOWHERE}/cancel-with-refund", {}),
    ("retreat mark-paid", "teacher", "POST", f"/api/retreats/{NOWHERE}/reservations/{NOWHERE}/mark-paid", {}),
    ("batch employee mark-paid", "hr", "POST", f"/api/bookings/{NOWHERE}/employees/{NOWHERE}/mark-paid", None),
    ("1:1 complete (escrow release)", "teacher", "POST", f"/api/one-on-one/booking/{NOWHERE}/complete", {}),
    ("1:1 reassign", "admin", "POST", f"/api/one-on-one/booking/{NOWHERE}/reassign", {}),
    ("1:1 student cancel (refund)", "learner", "POST", f"/api/one-on-one/booking/{NOWHERE}/student-cancel", {}),
    ("batch complete-pilot", "hr", "POST", f"/api/bookings/{NOWHERE}/complete-pilot", {}),
    ("v1 booking complete", "admin", "POST", f"/api/v1/bookings/{NOWHERE}/complete", {}),
    ("fast-track decide (split)", "admin", "POST", f"/api/empanelment/fast-track/{NOWHERE}/decide", {"outcome": "rejected"}),
]


def main():
    out = []
    for name, role, m, p, b in PROBES:
        s, d, _ = req(MB, m, p, role=role, body=b)
        out.append({"check": name, "route": f"{m} {p}", "as": role, "status": s, "frozen_423": s == 423, "detail": short(d)})
    json.dump(out, open("/app/test_reports/prod_audit/freeze_bypass.json", "w"), indent=1, ensure_ascii=False)
    for x in out:
        print(json.dumps(x, ensure_ascii=False))


if __name__ == "__main__":
    main()
