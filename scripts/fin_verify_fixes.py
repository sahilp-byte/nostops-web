"""FINANCIAL SAFETY — verify the main-backend fixes on the LIVE backend (SAFE CHECKS ONLY, 2026-06).

Founder's rule for this run: nothing may move money. Every request below is one of:
  * a read (GET) that the audit already showed is side-effect-free, or `/openapi.json`;
  * a SIGNED-OUT request (it cannot act for anyone), or
  * a signed-in request that the backend rejects BEFORE it writes anything
    (below-minimum amount, more than the available balance, an id that doesn't exist).
The PIN/OTP check is never reached (no failed-PIN counter moves). We never call
`/admin/payouts/list` or `/sweep` (the API list still says they sweep), and never call
`/admin/wallet/reconcile` with anything except `heal_direction=report_only`.

Outputs:
  /app/test_reports/fin_audit/verify_evidence.json  (same shape as evidence.json → fin_reconcile)
  /app/test_reports/fin_audit/verify_fixes.json     (per-check verdicts)
"""
import json
import sys
from datetime import datetime, timezone

import requests

sys.path.insert(0, "/app/scripts")
import fin_reconcile as fr  # noqa: E402

LIVE = "https://pro-learn-connect-1.emergent.host"
API = f"{LIVE}/api"
DEMO = {"teacher": ("teacher.demo@nostops.com", "<demo-password>"), "admin": ("admin.demo@nostops.com", "<demo-password>")}
OUT_DIR = "/app/test_reports/fin_audit"
NOWHERE = "qa_probe_does_not_exist"
BAD_CARD = {"card_number": "1234", "card_holder": "QA Probe", "expiry_month": 1, "expiry_year": 2020, "cvv": "1"}
_tokens: dict = {}


def token(role):
    if role and role not in _tokens:
        email, pw = DEMO[role]
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=60)
        _tokens[role] = (r.json() or {}).get("session_token", "") if r.ok else ""
    return _tokens.get(role, "")


def call(method, path, role=None, body=None, params=None):
    h = {"Accept": "application/json"}
    if role:
        h["Authorization"] = f"Bearer {token(role)}"
    r = requests.request(method, f"{API}{path}", headers=h, json=body, params=params, timeout=60, allow_redirects=False)
    try:
        data = r.json()
    except ValueError:
        data = {"text": r.text[:300]}
    return r.status_code, data


def detail(data):
    d = data.get("detail") if isinstance(data, dict) else None
    return (d if isinstance(d, str) else json.dumps(d or data, default=str))[:220]


# (id, finding, method, path, role, body, params, what each answer means)
SIGNED_OUT = [
    ("POST", "/teacher-wallet/withdraw"), ("POST", "/teacher-wallet/setup-pin"), ("POST", "/teacher-wallet/payout-details"),
    ("POST", "/v1/payouts/withdraw"), ("POST", "/v1/teachers/me/wallet/bank-account"), ("POST", "/teacher-referrals/withdraw"),
    ("POST", "/teachers/me/payout-request"), ("POST", "/admin/payouts/approve"), ("POST", "/admin/payouts/reject"),
]
REJECTED_BEFORE_WRITE = [
    ("FS00-wallet-withdraw", "FS-00", "POST", "/teacher-wallet/withdraw", "teacher",
     {"amount_inr": 1, "pin": "0000", "payout_method": "bank"}, None,
     "423 = switch on · 400 'Minimum withdrawal' = route open (checked before the PIN, nothing written)"),
    ("FS00-referral-withdraw", "FS-00", "POST", "/teacher-referrals/withdraw", "teacher", {"amount": 199999}, None,
     "423 = switch on · 400 'exceeds available' = route open (nothing written)"),
    ("FS00-payout-request", "FS-00", "POST", "/teachers/me/payout-request", "teacher", {"amount": 0}, None,
     "423 = switch on · 400 'Minimum payout' = route open (nothing written)"),
    ("FIN03-fast-track-pay", "FIN-03", "POST", f"/empanelment/fast-track/{NOWHERE}/pay", "teacher", BAD_CARD, None,
     "410/423 or 404 'Not Found' = removed · 404 'Request not found' = mock-card route still live"),
    ("FIN03-premium-book", "FIN-03", "POST", "/premium-sessions/book", None,
     {"teacher_handle": NOWHERE, "preferred_slot": "2030-01-01T10:00:00Z", "student_name": "QA Probe", "card": BAD_CARD}, None,
     "410/423 or 404 'Not Found' = removed · 404 'Teacher not found' = mock-card route still live"),
    ("FIN03-batch-pay", "FIN-03", "POST", f"/bookings/{NOWHERE}/pay", "teacher", None, None,
     "410 = mock batch pay disabled · 404/403 booking lookup = mock route still live"),
    ("FIN03-mock-checkout", "FIN-03", "GET", f"/payments/cashfree/mock-checkout/{NOWHERE}/complete", None, None,
     {"result": "failed"}, "404 'Mock checkout disabled' = off · 404 'Order not found' = mock checkout still live"),
]
READS = [
    ("teacher", "/teacher-wallet/balance", None), ("teacher", "/teacher-wallet/transactions", {"limit": 500}),
    ("teacher", "/teacher-referrals/dashboard", None),
    ("admin", "/admin/wallet/reconcile", {"heal_direction": "report_only"}),
]
CONTRACT = ["/api/admin/payouts/list", "/api/admin/payouts/sweep", "/api/admin/wallet/reconcile",
            "/api/teacher-wallet/withdraw", "/api/teacher-wallet/withdraw/otp/verify", "/api/v1/payouts/withdraw",
            "/api/teacher-referrals/withdraw", "/api/teachers/me/payout-request", "/api/v1/teachers/me/wallet/bank-account",
            "/api/empanelment/fast-track/{request_id}/pay", "/api/premium-sessions/book", "/api/bookings/{booking_id}/pay",
            "/api/payments/cashfree/mock-checkout/{order_id}/complete"]


def contract():
    o = requests.get(f"{LIVE}/openapi.json", timeout=60).json()
    schemas = o.get("components", {}).get("schemas", {})
    out = {"path_count": len(o.get("paths", {}))}
    for p in CONTRACT:
        ops = o["paths"].get(p)
        if not ops:
            out[p] = "MISSING"
            continue
        for m, op in ops.items():
            ref = (op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema") or {}).get("$ref")
            fields = list(schemas.get(ref.split("/")[-1], {}).get("properties", {})) if ref else None
            out[f"{m.upper()} {p}"] = {"summary": (op.get("description") or op.get("summary") or "")[:200], "body_fields": fields}
    return out


def main():
    started = datetime.now(timezone.utc).isoformat()
    report = {"started_at": started, "contract": contract(), "signed_out": [], "rejected_before_write": [], "reads": {}}
    for m, p in SIGNED_OUT:
        s, d = call(m, p, body={})
        report["signed_out"].append({"route": f"{m} {p}", "status": s, "detail": detail(d), "switch_on": s == 423})
    for cid, fin, m, p, role, body, params, meaning in REJECTED_BEFORE_WRITE:
        s, d = call(m, p, role=role, body=body, params=params)
        report["rejected_before_write"].append({"id": cid, "finding": fin, "route": f"{m} {p}", "status": s,
                                                "detail": detail(d), "meaning": meaning})
    calls = {}
    for role, p, params in READS:
        s, d = call("GET", p, role=role, params=params)
        key = f"{role} GET {p}" + (("?" + "&".join(f"{k}={v}" for k, v in params.items())) if params else "")
        calls[key] = {"status": s, "body": d}
    bal = calls["teacher GET /teacher-wallet/balance"]["body"]
    for k in ("bank_account", "upi_id", "payout_details", "phone"):  # keep the file free of payout details
        bal.pop(k, None) if isinstance(bal, dict) else None
    json.dump({"collected_at": started, "calls": calls}, open(f"{OUT_DIR}/verify_evidence.json", "w"), indent=1, default=str)
    report["reads"] = {k: v["status"] for k, v in calls.items()}
    report["reconciliation"] = fr.main(f"{OUT_DIR}/verify_evidence.json")
    json.dump(report, open(f"{OUT_DIR}/verify_fixes.json", "w"), indent=1, default=str)
    return report


if __name__ == "__main__":
    r = main()
    print(json.dumps({k: r[k] for k in ("signed_out", "rejected_before_write", "reads")}, indent=1, ensure_ascii=False))
