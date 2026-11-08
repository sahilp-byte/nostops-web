"""Prompt 4 engine test — rules-based empanelment (RULE-01..08), decision logic,
immutable version-stamped decision records, L3 council recognition, admin config,
and parallel/shadow mode. Deterministic + offline (known institutions + recorded
findings + config_override), unique run token avoids cross-run state pollution.

Empanelment Policy V2 (founder-approved, 2026-06): when every rule passes the
engine reports ELIGIBLE — it never empanels, verifies or grants a badge itself.
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


def mk(uid, country="India", level="L2", name=None):
    _, d = call("POST", "/api/verification/application", hdr(uid, name=name), {"teacher_level": level, "country": country})
    return d["application"]["application_id"]


def verify_identity(appid, uid, name=None):
    call("POST", f"/api/verification/application/{appid}/reuse-identity", hdr(uid, name=name),
         {"instakyc_verified": True, "provider_reference": "KYC-REF"})


def add_cred(appid, uid, cred, name=None):
    return call("POST", f"/api/verification/application/{appid}/credentials", hdr(uid, name=name), cred)


def assess(appid, override=None, profile_complete=True, teaching_hours=None):
    return call("POST", f"/api/verification/application/{appid}/empanelment/assess", ADMIN,
                {"profile_complete": profile_complete, "teaching_hours": teaching_hours,
                 "config_override": (override if override is not None else clean_override())})


# ── Config endpoints ─────────────────────────────────────────────────────────
s, d = call("GET", "/api/verification/empanelment/config", hdr("cfg_reader"))
check("config GET returns defaults (no invented thresholds)",
      s == 200 and d["config"]["minimum_teaching_years"] is None and d["config"]["engine_mode"] == "parallel", d)
s, d = call("PUT", "/api/verification/empanelment/config", hdr("cfg_teacher"), {"minimum_teaching_years": 3})
check("teacher cannot set config (403)", s == 403, f"{s} {d}")
s, d = call("PUT", "/api/verification/empanelment/config", ADMIN, {"required_qualification_level": "RYT-200"})
check("admin can set config", s == 200 and d["config"]["required_qualification_level"] == "RYT-200", d)

# ── 1. ALL PASS -> EMPANELLED ────────────────────────────────────────────────
a1 = mk("emp_t1", name="Anand Kumar")
verify_identity(a1, "emp_t1", name="Anand Kumar")
add_cred(a1, "emp_t1", {"qualification_name": "RYT-500", "institution_name": "Sivananda Yoga Vedanta",
                        "certificate_number": "S1", "certificate_url": "https://x/c.pdf",
                        "teacher_name_on_certificate": "Anand Kumar"}, name="Anand Kumar")
s, d = assess(a1)
asm = d.get("assessment", {})
check("all pass -> ELIGIBLE (Policy V2: never auto-empanelled)", asm.get("decision") == "ELIGIBLE", asm.get("decision"))
check("eligible is NOT AI score (rules recorded)", len(asm.get("rules_evaluated", [])) == 8, len(asm.get("rules_evaluated", [])))
check("all 8 rules passed", len(asm.get("rules_passed", [])) == 8, asm.get("rules_passed"))
check("default engine mode = parallel (shadow)", d.get("mode") == "parallel", d.get("mode"))
s, agg = call("GET", f"/api/verification/application/{a1}", ADMIN)
check("eligible reflected locally (shadow)", agg["application"]["empanelment_status"] == "ELIGIBLE", agg["application"]["empanelment_status"])
check("eligible -> verification NOT auto-VERIFIED", agg["application"]["verification_status"] != "VERIFIED", agg["application"]["verification_status"])
s, ent = call("GET", f"/api/verification/application/{a1}/entitlements", hdr("emp_t1", name="Anand Kumar"))
check("eligible -> NO empanelment entitlement / badge granted", (ent.get("entitlements") or {}).get("package") != "NOSTOPS_EMPANELLED", ent)

# decision record fields (section 5)
req_fields = {"application_id", "teacher_id", "rule_version", "rules_evaluated", "rules_passed",
              "rules_failed", "evidence_used", "exceptions", "decision", "decision_reason", "assessed_at"}
check("decision record has all required fields", req_fields <= set(asm.keys()), set(asm.keys()))
check("decision record stamped with rule_version", asm.get("rule_version") == "EMPANELMENT_RULES_V1.0", asm.get("rule_version"))

# ── 2. MISSING EVIDENCE -> ADDITIONAL_INFORMATION_REQUIRED ───────────────────
a2 = mk("emp_t2", name="Meera Nair")
verify_identity(a2, "emp_t2", name="Meera Nair")
add_cred(a2, "emp_t2", {"qualification_name": "RYT-200", "institution_name": "Bihar School of Yoga",
                        "teacher_name_on_certificate": "Meera Nair"}, name="Meera Nair")  # no certificate_url
s, d = assess(a2, override=clean_override(required_documents=["certificate"]))
asm = d.get("assessment", {})
check("missing evidence -> ADDITIONAL_INFORMATION_REQUIRED", asm.get("decision") == "ADDITIONAL_INFORMATION_REQUIRED", asm.get("decision"))
check("RULE-05 flagged ADDITIONAL", any(r["rule"] == "RULE-05" and r["status"] == "ADDITIONAL" for r in asm.get("rules_evaluated", [])), asm.get("rules_evaluated"))

# ── 3. UNUSUAL CREDENTIAL -> COUNCIL_REVIEW ──────────────────────────────────
a3 = mk("emp_t3", name="Ravi Shah")
verify_identity(a3, "emp_t3", name="Ravi Shah")
add_cred(a3, "emp_t3", {"qualification_name": "Traditional Gurukula Certificate", "institution_name": "Kaivalyadhama",
                        "certificate_number": "G1", "certificate_url": "https://x/g.pdf",
                        "teacher_name_on_certificate": "Ravi Shah"}, name="Ravi Shah")
s, d = assess(a3, override=clean_override(required_qualification_level="RYT-500"))
asm = d.get("assessment", {})
check("unusual credential -> COUNCIL_REVIEW", asm.get("decision") == "COUNCIL_REVIEW", asm.get("decision"))
check("RULE-02 flagged REVIEW", any(r["rule"] == "RULE-02" and r["status"] == "REVIEW" for r in asm.get("rules_evaluated", [])), asm.get("rules_evaluated"))

# ── 4. CREDENTIAL CONFLICT -> COUNCIL_REVIEW ─────────────────────────────────
a4 = mk("emp_t4", name="Sita Devi")
verify_identity(a4, "emp_t4", name="Sita Devi")
add_cred(a4, "emp_t4", {"qualification_name": "RYT-500", "institution_name": "Nonexistent Academy ZZZ",
                        "institution_result": {"established": False, "source": "ops"}}, name="Sita Devi")
s, d = assess(a4)
asm = d.get("assessment", {})
check("credential conflict -> COUNCIL_REVIEW", asm.get("decision") == "COUNCIL_REVIEW", asm.get("decision"))
check("RULE-07 flagged REVIEW", any(r["rule"] == "RULE-07" and r["status"] == "REVIEW" for r in asm.get("rules_evaluated", [])), asm.get("rules_evaluated"))
check("exceptions recorded", len(asm.get("exceptions", [])) >= 1, asm.get("exceptions"))

# ── 5. MANDATORY FAILURE -> NOT_EMPANELLED ───────────────────────────────────
a5 = mk("emp_t5", name="Priya Rao")
verify_identity(a5, "emp_t5", name="Priya Rao")
add_cred(a5, "emp_t5", {"qualification_name": "RYT-500", "institution_name": "Sivananda Yoga Vedanta",
                        "certificate_number": "P1", "certificate_url": "https://x/p.pdf",
                        "teacher_name_on_certificate": "Priya Rao"}, name="Priya Rao")
call("POST", f"/api/verification/application/{a5}/professional-evidence", hdr("emp_t5", name="Priya Rao"), {"years_teaching": 2})
s, d = assess(a5, override=clean_override(minimum_teaching_years=5))
asm = d.get("assessment", {})
check("mandatory failure -> NOT_EMPANELLED", asm.get("decision") == "NOT_EMPANELLED", asm.get("decision"))
check("RULE-03 flagged FAIL", any(r["rule"] == "RULE-03" and r["status"] == "FAIL" for r in asm.get("rules_evaluated", [])), asm.get("rules_evaluated"))
s, agg = call("GET", f"/api/verification/application/{a5}", ADMIN)
check("not-empanelled -> verification NOT_VERIFIED", agg["application"]["verification_status"] == "NOT_VERIFIED", agg["application"]["verification_status"])

# ── 6. LEVEL 3 -> COUNCIL_RECOGNITION_REQUIRED (never auto-granted) ──────────
a6 = mk("emp_t6", level="L3", name="Swami Ananda")
verify_identity(a6, "emp_t6", name="Swami Ananda")
add_cred(a6, "emp_t6", {"qualification_name": "RYT-500", "institution_name": "Bihar School of Yoga",
                        "certificate_number": "L3-1", "certificate_url": "https://x/l3.pdf",
                        "teacher_name_on_certificate": "Swami Ananda"}, name="Swami Ananda")
call("POST", f"/api/verification/application/{a6}/professional-evidence", hdr("emp_t6", name="Swami Ananda"), {"years_teaching": 20})
s, d = assess(a6)
asm = d.get("assessment", {})
check("L3 -> COUNCIL_REVIEW (not auto-granted)", asm.get("decision") == "COUNCIL_REVIEW", asm.get("decision"))
check("L3 -> council_recognition_required", asm.get("council_recognition_required") is True, asm.get("council_recognition_required"))
check("L3 decision_reason = COUNCIL_RECOGNITION_REQUIRED", asm.get("decision_reason") == "COUNCIL_RECOGNITION_REQUIRED", asm.get("decision_reason"))
s, agg = call("GET", f"/api/verification/application/{a6}", ADMIN)
check("L3 never auto-empanelled", agg["application"]["empanelment_status"] == "COUNCIL_REVIEW", agg["application"]["empanelment_status"])

# ── Immutability — re-assess inserts a NEW record, never overwrites ──────────
assess(a1)  # second assessment on app 1
s, d = call("GET", f"/api/verification/application/{a1}/empanelment/assessments", ADMIN)
check("assessments are immutable (history grows)", len(d.get("assessments", [])) == 2, len(d.get("assessments", [])))
s, d = call("GET", f"/api/verification/application/{a1}/empanelment/latest", ADMIN)
check("latest assessment retrievable", d.get("assessment", {}).get("decision") == "ELIGIBLE", d.get("assessment"))

# ── Parallel vs active mode flag ─────────────────────────────────────────────
s, d = call("POST", f"/api/verification/application/{a1}/empanelment/assess", ADMIN,
            {"profile_complete": True, "mode_override": "active", "config_override": clean_override()})
check("admin can run engine in 'active' mode flag", d.get("mode") == "active", d.get("mode"))

print("\n==== SUMMARY ====")
passed = sum(1 for _, c in results if c)
print(f"{passed}/{len(results)} passed")

# Hygiene: reset the shared rules config doc so tests leave no global state.
try:
    from pymongo import MongoClient
    MongoClient(_env("MONGO_URL") or "mongodb://localhost:27017")[_env("DB_NAME") or "nostops_web"]["verification_rules_config"].delete_many({})
except Exception:
    pass
