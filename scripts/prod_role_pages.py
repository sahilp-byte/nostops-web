"""POST-DEPLOYMENT AUDIT — role-based page rendering on production (GET only, read-only).
Classifies what each signed-in role actually receives on protected pages (redirect, denied,
error boundary or real content). Run only after the production website lock is proven
deployed (the admin badge no longer calls /admin/payouts/list).
Output: /app/test_reports/prod_audit/role_pages.json
"""
import json
import re
import sys

sys.path.insert(0, "/app/scripts")
from prod_postdeploy_audit import PROD, web_session  # noqa: E402

PAGES = {
    "teacher": ["/app", "/app/admin", "/app/admin/payouts", "/app/teacher/wallet", "/app/teacher/refer",
                "/app/teacher/retreats", "/app/teacher/retreats/new", "/app/teacher/dashboard", "/app/org/dashboard"],
    "learner": ["/app", "/app/admin", "/app/teacher/wallet", "/app/teacher/retreats/new", "/app/org/events/new"],
    "hr": ["/app", "/app/admin", "/app/org/dashboard", "/app/org/events", "/app/org/events/new"],
    "admin": ["/app/admin", "/app/admin/payouts", "/app/admin/referrals", "/app/admin/institutional", "/app/admin/bookings",
              "/app/admin/teachers", "/app/admin/people", "/app/admin/reports", "/app/admin/kyc", "/app/admin/one-on-one",
              "/app/admin/venue-review", "/app/admin/support", "/app/admin/security", "/app/admin/error-monitor"],
}
MARKERS = {
    "next_redirect": r"NEXT_REDIRECT",
    "redirect_target": r"NEXT_REDIRECT;[a-z]+;([^;\"\\]+)",
    "error_boundary": r"Something went wrong",
    "not_available": r"Not available yet",
    "not_found": r"This page could not be found|NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND",
    "forbidden": r"NEXT_HTTP_ERROR_FALLBACK;403|Access denied|not authori[sz]ed|Admins only|admin access",
    "lock_notice": r"Money actions are paused",
    "verify_gate": r"[Gg]et verified|verification",
    "referral_off": r"no longer available|discontinued",
}


def classify(html):
    out = {}
    for k, rx in MARKERS.items():
        m = re.search(rx, html)
        out[k] = (m.group(1) if k == "redirect_target" and m else bool(m))
    out["h1"] = [re.sub(r"<[^>]+>", "", h)[:80] for h in re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S)][:3]
    return out


def main():
    res = []
    for role, pages in PAGES.items():
        ws = web_session(PROD, role)
        for p in pages:
            r = ws.get(f"{PROD}{p}", timeout=90, allow_redirects=False)
            row = {"role": role, "path": p, "status": r.status_code, "location": r.headers.get("location")}
            row.update(classify(r.text))
            res.append(row)
    json.dump(res, open("/app/test_reports/prod_audit/role_pages.json", "w"), indent=1)
    for x in res:
        print(json.dumps(x, ensure_ascii=False))


if __name__ == "__main__":
    main()
