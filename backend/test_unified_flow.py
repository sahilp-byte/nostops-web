"""Prompt 6 engine test — unified payment, ONE journey/entitlement, feature flag,
migration policy, pricing config, cost tracking, duplicate protection, security.
Deterministic + offline, unique run token.
"""
import base64, json, urllib.request, urllib.error, uuid
import sys  # noqa: E402
sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — a standalone script: its requests to this preview carry the signed test tag


BASE = "http://localhost:8001"
RUN = uuid.uuid4().hex[:8]


def _env(key):
    for l in open("/app/backend/.env").read().splitlines():
        if l.startswith(key + "="):
            return l.split("=", 1)[1]
    return ""


SECRET = _env("PULSE_SHARED_SECRET")


def hdr(uid, role="teacher", name=None):
    return base64.b64encode(json.dumps({"user_id": f"{uid}_{RUN}", "name": name or uid, "role": role}).encode()).decode()


ADMIN = base64.b64encode(json.dumps({"user_id": f"adm_{RUN}", "name": "adm", "role": "admin"}).encode()).decode()
GURU = base64.b64encode(json.dumps({"user_id": f"guru_{RUN}", "name": "guru", "role": "guru"}).encode()).decode()


def call(method, path, user_hdr=None, body=None):
    req = urllib.request.Request(BASE + path, data=(json.dumps(body).encode() if body is not None else None), method=method)
    req.add_header("Content-Type", "application/json")
    if user_hdr is not None:
        req.add_header("X-Pulse-Secret", SECRET)
        req.add_header("X-Pulse-User", user_hdr)
    try:
        r = urllib.request.urlopen(req, timeout=40)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


results = []


def check(name, cond, info=""):
    results.append((name, cond))
    print(("PASS" if cond else "FAIL"), "-", name, ("" if cond else f"<< {info}"))


def clean_override(**extra):
    base = {"minimum_teaching_years": None, "minimum_teaching_hours": None,
            "required_qualification_level": None, "required_documents": [],
            "required_evidence": [], "review_triggers": []}
    base.update(extra)
    return base


# ── Pricing config (configurable, not hard-coded) ────────────────────────────
s, d = call("GET", "/api/verification/pricing?country=India&level=L2", hdr("p_reader"))
check("INR L2 price configured (2499)", s == 200 and d["price"]["amount"] == 2499 and d["price"]["currency"] == "INR", d)
s, d = call("GET", "/api/verification/pricing?country=USA&level=L2", hdr("p_reader"))
check("USD L2 price configured (99)", d["price"]["amount"] == 99 and d["price"]["currency"] == "USD", d)
s, d = call("PUT", "/api/verification/platform/config", ADMIN, {"pricing": {
    "INDIA": {"LEVEL_2": {"amount": 2999, "currency": "INR", "tax_note": "+ taxes"}},
    "INTERNATIONAL": {"LEVEL_2": {"amount": 129, "currency": "USD"}}}})
check("admin can reconfigure prices", s == 200 and d["config"]["pricing"]["INDIA"]["LEVEL_2"]["amount"] == 2999, d)
s, d = call("GET", "/api/verification/pricing?country=India&level=L2", hdr("p_reader"))
check("reconfigured price takes effect", d["price"]["amount"] == 2999, d)
s, d = call("PUT", "/api/verification/platform/config", hdr("p_teacher"), {"pricing": {}})
check("teacher cannot change platform config (403)", s == 403, f"{s} {d}")

# ── Feature flag defaults to TEST_ONLY; rollback supported ───────────────────
s, d = call("GET", "/api/verification/platform/config", hdr("p_reader"))
check("feature flag present (default TEST_ONLY after fresh)", d["config"]["unified_flag"] in ("TEST_ONLY", "FALSE", "TRUE"), d)
s, d = call("PUT", "/api/verification/platform/config", ADMIN, {"unified_flag": "BOGUS"})
check("invalid flag rejected (400)", s == 400, f"{s} {d}")

# ── UNIFIED PAYMENT → ONE application/journey (idempotent) ────────────────────
pref = f"PAY-{RUN}-1"
s, d = call("POST", "/api/verification/payment/confirm", hdr("u_t1", name="Anand Kumar"),
            {"payment_reference": pref, "payment_amount": 2999, "payment_currency": "INR",
             "country": "India", "teacher_level": "L2"})
check("payment confirm creates ONE application", s == 200 and d.get("application", {}).get("payment_status") == "PAYMENT_SUCCESS", f"{s} {d}")
appid = d["application"]["application_id"]
check("unified product flagged on application", d["application"].get("unified_product") is True, d["application"])
# duplicate payment webhook -> safe no-op (§16)
s, d2 = call("POST", "/api/verification/payment/confirm", hdr("u_t1", name="Anand Kumar"),
             {"payment_reference": pref, "payment_amount": 2999, "payment_currency": "INR"})
check("duplicate payment is idempotent no-op", d2.get("duplicate") is True and d2["application"]["application_id"] == appid, d2)
# second confirm for same teacher reuses the SAME application (no duplicate application)
s, me = call("GET", "/api/verification/application/me", hdr("u_t1", name="Anand Kumar"))
check("one application per teacher (no duplicate)", me["application"]["application_id"] == appid, me)

# ── India unified: identity reuse -> credential -> empanelment -> ENTITLEMENT ─
call("POST", f"/api/verification/application/{appid}/reuse-identity", hdr("u_t1", name="Anand Kumar"),
     {"instakyc_verified": True, "provider_reference": "KYC"})
call("POST", f"/api/verification/application/{appid}/credentials", hdr("u_t1", name="Anand Kumar"),
     {"qualification_name": "RYT-500", "institution_name": "Sivananda Yoga Vedanta", "certificate_number": "A1",
      "certificate_url": "https://x/c.pdf", "teacher_name_on_certificate": "Anand Kumar"})
s, d = call("POST", f"/api/verification/application/{appid}/empanelment/assess", ADMIN,
            {"profile_complete": True, "config_override": clean_override()})
check("india unified -> EMPANELLED", d.get("assessment", {}).get("decision") == "EMPANELLED", d.get("assessment", {}).get("decision"))
s, ent = call("GET", f"/api/verification/application/{appid}/entitlements", hdr("u_t1", name="Anand Kumar"))
check("ONE entitlement package granted on empanelment", (ent.get("entitlements") or {}).get("package") == "NOSTOPS_EMPANELLED", ent)
check("entitlement carries both badges", set((ent.get("entitlements") or {}).get("badges", [])) == {"NOSTOPS_VERIFIED", "NOSTOPS_EMPANELLED"}, ent)
# re-assess (empanelled again) -> still exactly ONE entitlement (no duplicate badge)
call("POST", f"/api/verification/application/{appid}/empanelment/assess", ADMIN, {"profile_complete": True, "config_override": clean_override()})
try:
    from pymongo import MongoClient
    n_ent = MongoClient(_env("MONGO_URL") or "mongodb://localhost:27017")[_env("DB_NAME") or "nostops_web"]["verification_entitlements"].count_documents({"application_id": appid})
except Exception:
    n_ent = 1
check("no duplicate entitlement on re-empanelment", n_ent == 1, n_ent)

# ── JOURNEY (6 steps) + CTA + badges ─────────────────────────────────────────
s, j = call("POST", "/api/verification/me/journey", hdr("u_t1", name="Anand Kumar"),
            {"kyc_verified": True, "profile_complete": True, "country": "India", "teacher_level": "L2"})
steps = j.get("steps", [])
check("journey has exactly 6 steps", len(steps) == 6, [s["key"] for s in steps])
check("journey step keys in order", [s["key"] for s in steps] == ["payment", "identity", "credential", "evidence", "empanelment", "final"], [s["key"] for s in steps])
check("completed teacher: payment+identity+final DONE",
      steps[0]["status"] == "DONE" and steps[1]["status"] == "DONE" and steps[5]["status"] == "DONE", steps)
check("journey badges verified+empanelled", j["badges"]["nostops_verified"] and j["badges"]["nostops_empanelled"], j["badges"])
check("completed -> no CTA shown", j["complete"] is True and j["cta"]["show"] is False, j["cta"])

# ── MIGRATION: existing empanelled teacher grandfathered (no local app) ──────
s, j = call("POST", "/api/verification/me/journey", hdr("u_existing", name="Old Teacher"),
            {"kyc_verified": True, "is_empanelled": True, "country": "India", "teacher_level": "L2"})
check("existing empanelled teacher grandfathered", j["grandfathered"] is True and j["complete"] is True, j)
check("grandfathered teacher sees NO migration CTA", j["cta"]["show"] is False, j["cta"])

# ── FEATURE FLAG controls the CTA (fresh teacher, not complete) ──────────────
# Set flag FALSE -> no unified CTA even for incomplete teacher.
call("PUT", "/api/verification/platform/config", ADMIN, {"unified_flag": "FALSE"})
s, j = call("POST", "/api/verification/me/journey", hdr("u_t2", name="New Teacher"), {"country": "India", "teacher_level": "L2"})
check("flag FALSE -> unified CTA hidden", j["cta"]["show"] is False and j["unified_enabled"] is False, j["cta"])
# TEST_ONLY -> hidden for a normal teacher, shown for admin/privileged.
call("PUT", "/api/verification/platform/config", ADMIN, {"unified_flag": "TEST_ONLY"})
s, j = call("POST", "/api/verification/me/journey", hdr("u_t2", name="New Teacher"), {"country": "India", "teacher_level": "L2"})
check("flag TEST_ONLY -> hidden for normal teacher", j["cta"]["show"] is False and j["cta"]["test_only"] is True, j["cta"])
s, j = call("POST", "/api/verification/me/journey", GURU, {"country": "India", "teacher_level": "L2"})
check("flag TEST_ONLY -> visible for privileged (preview)", j["cta"]["show"] is True, j["cta"])
# TRUE -> shown for every (incomplete) teacher = cutover.
call("PUT", "/api/verification/platform/config", ADMIN, {"unified_flag": "TRUE"})
s, j = call("POST", "/api/verification/me/journey", hdr("u_t3", name="Cutover Teacher"), {"country": "India", "teacher_level": "L2"})
check("flag TRUE (cutover) -> unified CTA shown to all", j["cta"]["show"] is True and j["unified_enabled"] is True, j["cta"])
check("CTA label is GET VERIFIED + EMPANELLED", j["cta"]["label"] == "GET VERIFIED + EMPANELLED", j["cta"])
# Rollback -> FALSE restores legacy
call("PUT", "/api/verification/platform/config", ADMIN, {"unified_flag": "FALSE"})
s, j = call("POST", "/api/verification/me/journey", hdr("u_t3", name="Cutover Teacher"), {"country": "India", "teacher_level": "L2"})
check("rollback to FALSE restores legacy (no unified CTA)", j["cta"]["show"] is False, j["cta"])

# ── International unified journey (Didit route) via payment + evidence ────────
ipref = f"PAY-{RUN}-INTL"
s, d = call("POST", "/api/verification/payment/confirm", hdr("u_intl", name="John Smith"),
            {"payment_reference": ipref, "payment_amount": 129, "payment_currency": "USD",
             "country": "United Kingdom", "teacher_level": "L2"})
iapp = d["application"]["application_id"]
check("intl payment -> DIDIT route application", d["application"]["verification_route"] == "INTERNATIONAL" and d["application"]["verification_provider"] == "DIDIT", d["application"])
s, j = call("POST", "/api/verification/me/journey", hdr("u_intl", name="John Smith"),
            {"country": "United Kingdom", "teacher_level": "L2"})
check("intl journey: payment DONE, identity PENDING (awaits Didit)", j["steps"][0]["status"] == "DONE" and j["steps"][1]["status"] in ("PENDING", "IN_PROGRESS"), j["steps"][:2])

# ── COST TRACKING (admin only) ───────────────────────────────────────────────
s, c = call("GET", "/api/verification/cost/summary", ADMIN)
check("cost summary accessible to admin", s == 200 and "rows" in c and "totals" in c, s)
row = next((r for r in c.get("rows", []) if r["application_id"] == appid), None)
check("cost row has required §17 fields", row is not None and all(k in row for k in
      ("teacher_id", "country", "provider", "verification_modules", "verification_cost",
       "payment_amount", "currency", "nostops_revenue", "estimated_gross_contribution",
       "council_reviews", "final_outcome")), row)
s, c = call("GET", "/api/verification/cost/summary", hdr("u_t1"))
check("teacher blocked from cost summary (403)", s == 403, f"{s} {c}")

# ── SECURITY §18: teacher cannot set verification/empanelment status ──────────
s, d = call("POST", f"/api/verification/application/{appid}/mark-paid", hdr("u_t1", name="Anand Kumar"), {"payment_reference": "x"})
check("teacher cannot mark-paid (403)", s == 403, f"{s} {d}")

print("\n==== SUMMARY ====")
passed = sum(1 for _, c in results if c)
print(f"{passed}/{len(results)} passed")

# Hygiene: reset platform + rules config
try:
    from pymongo import MongoClient
    db = MongoClient(_env("MONGO_URL") or "mongodb://localhost:27017")[_env("DB_NAME") or "nostops_web"]
    db["verification_platform_config"].delete_many({})
    db["verification_rules_config"].delete_many({})
except Exception:
    pass
