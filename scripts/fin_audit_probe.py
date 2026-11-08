"""FINANCIAL SAFETY AUDIT — READ-ONLY evidence collection (2026-06).

Only GET requests and demo-account logins. It NEVER calls the routes that change data
on a read (/admin/payouts/list, /admin/payouts/sweep, /payments/cashfree/mock-checkout/*).
The wallet reconcile check is called ONCE, with heal_direction=report_only spelled out
(founder approved). Bank, UPI, PAN, phone, email and name values are masked before
anything is written. Output: /app/test_reports/fin_audit/evidence.json
"""
import json
import os
import sys
from datetime import datetime, timezone

import requests

LIVE = "https://pro-learn-connect-1.emergent.host/api"
OUT = "/app/test_reports/fin_audit"
DEMO = {"teacher": ("teacher.demo@nostops.com", "<demo-password>"), "guru": ("guru.demo@nostops.com", "<demo-password>"),
        "admin": ("admin.demo@nostops.com", "<demo-password>"), "learner": ("employee.demo@nostops.com", "<demo-password>")}
NEVER = ("/admin/payouts/list", "/admin/payouts/sweep", "mock-checkout")
MASK_KEYS = ("account", "ifsc", "upi", "vpa", "pan", "phone", "mobile", "whatsapp", "email", "aadhaar", "holder", "session", "token", "card",
             "student_name", "teacher_name", "referee_name", "customer", "beneficiary", "name")
KEEP = {"ledger_id", "teacher_id", "txn_id", "booking_id", "request_id", "order_id", "type", "status", "kind", "source",
        "account_number_masked"}

_tok: dict = {}


def token(role: str) -> str:
    if role not in _tok:
        e, p = DEMO[role]
        r = requests.post(f"{LIVE}/auth/login", json={"email": e, "password": p}, timeout=60)
        _tok[role] = (r.json() or {}).get("session_token", "") if r.ok else ""
    return _tok[role]


def mask(v, key=""):
    k = key.lower()
    if isinstance(v, dict):
        return {kk: mask(x, kk) for kk, x in v.items()}
    if isinstance(v, list):
        return [mask(x, key) for x in v]
    if k not in KEEP and any(m in k for m in MASK_KEYS) and isinstance(v, str) and v:
        return f"<masked {len(v)} chars>"
    return v


def get(path: str, role: str = "", headers: dict | None = None):
    assert not any(n in path for n in NEVER), f"refusing a state-changing read: {path}"
    h = {"Accept": "application/json", **(headers or {})}
    if role:
        h["Authorization"] = f"Bearer {token(role)}"
    for attempt in range(3):
        try:
            r = requests.get(f"{LIVE}{path}", headers=h, timeout=60)
            if r.status_code == 502 and attempt < 2:
                continue
            try:
                body = r.json()
            except ValueError:
                body = r.text[:300]
            return {"status": r.status_code, "body": mask(body)}
        except requests.RequestException as e:  # noqa: PERF203
            last = str(e)
    return {"status": None, "body": last}


PLAN = [
    ("teacher", "/teacher-wallet/balance"), ("teacher", "/teacher-wallet/unified-summary?activity_limit=50"),
    ("teacher", "/teacher-wallet/transactions?limit=500"), ("teacher", "/teacher-wallet/payout-details"),
    ("teacher", "/teacher-wallet/pin-status"), ("teacher", "/teachers/me/commission-tier"),
    ("teacher", "/teachers/me/payouts"), ("teacher", "/retreats/payouts/mine"), ("teacher", "/mentor/me/wallet"),
    ("teacher", "/coordinators/me/revenue-share"), ("teacher", "/teacher-referrals/dashboard"),
    ("teacher", "/one-on-one/my-bookings"), ("teacher", "/premium-sessions/my"), ("teacher", "/v1/teachers/me/wallet"),
    ("teacher", "/v1/referrals/me/summary"), ("", "/v1/teachers/me/wallet"),
    ("guru", "/empanelment/fast-track/my-earnings"),
    ("admin", "/admin/wallet/reconcile?heal_direction=report_only"),
    ("admin", "/empanelment/fast-track/queue"), ("admin", "/empanelment/fast-track/revenue-summary"),
    ("admin", "/admin/retreats/payouts?limit=50"), ("admin", "/admin/refunds/pending"),
    ("admin", "/v1/teachers/tn_9b0aa00b35c5/wallet"), ("admin", "/v1/payments/admin/paid-bookings"),
    ("", "/payments/cashfree/orders?limit=5"), ("learner", "/payments/cashfree/orders?limit=5"),
    ("admin", "/payments/cashfree/orders?limit=50"), ("", "/kyc/pricing"), ("", "/retreats/settings/platform"),
]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    res = {"collected_at": datetime.now(timezone.utc).isoformat(), "read_only": True, "calls": {}}
    for role, path in PLAN:
        if only and path not in only:
            continue
        res["calls"][f"{role or 'anon'} GET {path}"] = get(path, role)
        print(role or "anon", path, res["calls"][f"{role or 'anon'} GET {path}"]["status"])
    with open(f"{OUT}/evidence.json", "w") as f:
        json.dump(res, f, indent=1, default=str)


if __name__ == "__main__":
    main()
