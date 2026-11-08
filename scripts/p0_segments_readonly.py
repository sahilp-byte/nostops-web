"""P0 REMEDIATION — Cohort Segments zero-count investigation (READ-ONLY).

Only GETs against the LIVE main backend, signed in as the existing demo admin (one sign-in
session record, as in every earlier audit). No writes, no repairs. Compares the segment
report with the other organisation / group-booking counts the same backend reports, so the
source of the zeros can be narrowed down (database vs field mapping vs aggregation vs
filtering vs reporting period). Output: /app/test_reports/p0/segments_investigation.json
"""
import json

import requests

MB = "https://pro-learn-connect-1.emergent.host/api"
OUT = "/app/test_reports/p0/segments_investigation.json"
FIN = ("wallet", "payout", "commission", "earning", "balance", "withdraw", "amount", "inr")


def login(email: str, pw: str) -> str:
    r = requests.post(f"{MB}/auth/login", json={"email": email, "password": pw}, timeout=60)
    return (r.json() or {}).get("session_token", "") if r.ok else ""


def get(path: str, tok: str = "") -> dict:
    h = {"Accept": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})}
    r = requests.get(f"{MB}{path}", headers=h, timeout=60)
    try:
        body = r.json()
    except ValueError:
        body = r.text[:300]
    return {"status": r.status_code, "body": body}


def shape(v, depth=0):
    """Keys + numbers only (no names, emails, ids or money)."""
    if isinstance(v, dict):
        return {k: shape(x, depth + 1) for k, x in v.items() if depth < 5 and not any(f in k.lower() for f in FIN)}
    if isinstance(v, list):
        return {"_list_len": len(v), "_first": shape(v[0], depth + 1) if v else None}
    if isinstance(v, (int, float, bool)) or v is None:
        return v
    return f"<str len={len(str(v))}>" if depth else str(v)[:120]


def main():
    admin = login("admin.demo@nostops.com", "<demo-password>")
    hr = login("hr.demo@nostops.com", "<demo-password>")
    out = {"admin_signed_in": bool(admin), "hr_signed_in": bool(hr)}
    out["segments"] = {p: get(f"/v1/stats/segments?period={p}", admin) for p in ("all", "30d", "90d", "12m")}
    out["segments_bad_period"] = get("/v1/stats/segments?period=bogus", admin)
    out["platform_stats"] = shape(get("/platform-stats")["body"])
    out["admin_stats"] = shape(get("/dashboards/admin-stats", admin)["body"])
    out["mission_progress"] = shape(get("/mission/progress", admin)["body"])
    out["hr_me"] = shape(get("/hr/me", hr)["body"])
    out["hr_mission_my_company"] = shape(get("/mission/my-company", hr)["body"])
    out["hr_payment_summary_shape"] = shape(get("/bookings/hr/payment-summary", hr)["body"])
    json.dump(out, open(OUT, "w"), indent=1, default=str)
    print(json.dumps({k: (v if k != "segments" else {p: x["status"] for p, x in v.items()}) for k, v in out.items()},
                     indent=1, default=str)[:6000])
    print("--- segments(all) ---")
    print(json.dumps(out["segments"]["all"], indent=1, default=str)[:4000])


if __name__ == "__main__":
    main()
