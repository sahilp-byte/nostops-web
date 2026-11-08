"""Prompt 5 engine test — Council governance, exceptions, appeals, audit, security.
Deterministic + offline, unique run token. Builds on the Prompt 3/4 engines.
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


def mk(uid, country="India", level="L2", name=None):
    _, d = call("POST", "/api/verification/application", hdr(uid, name=name), {"teacher_level": level, "country": country})
    return d["application"]["application_id"]


def verify_identity(appid, uid, name=None):
    call("POST", f"/api/verification/application/{appid}/reuse-identity", hdr(uid, name=name),
         {"instakyc_verified": True, "provider_reference": "KYC"})


def add_cred(appid, uid, cred, name=None):
    return call("POST", f"/api/verification/application/{appid}/credentials", hdr(uid, name=name), cred)


def assess(appid, override=None, profile_complete=True):
    return call("POST", f"/api/verification/application/{appid}/empanelment/assess", ADMIN,
                {"profile_complete": profile_complete, "config_override": override if override is not None else clean_override()})


def _db():
    from pymongo import MongoClient
    return MongoClient(_env("MONGO_URL") or "mongodb://localhost:27017")[_env("DB_NAME") or "nostops_web"]


def policy_approval(uid):
    """Stand-in for a recorded Empanelment Policy V2 approval (Council interaction +
    explicit decision, see tests/workflow/test_wf_b48_policy.py). Removed at the end."""
    now = "2026-06-01T00:00:00+00:00"
    _db().empanelment_policy_cases.insert_one({
        "case_id": f"epc_qa{RUN}{uid[-2:]}", "path": "FREE", "status": "APPROVED", "teacher_user_id": f"{uid}_{RUN}",
        "qa_fixture": True, "interactions": [{"held_on": "2026-06-01"}], "decisions": [{"outcome": "APPROVE"}],
        "created_at": now, "updated_at": now})


# ── ACCEPTANCE 1: Normal Level 2 -> automated ELIGIBLE, NOT in Council queue ──
a1 = mk("c_t1", name="Anand Kumar")
verify_identity(a1, "c_t1", name="Anand Kumar")
add_cred(a1, "c_t1", {"qualification_name": "RYT-500", "institution_name": "Sivananda Yoga Vedanta",
                      "certificate_number": "S1", "certificate_url": "https://x/c.pdf",
                      "teacher_name_on_certificate": "Anand Kumar"}, name="Anand Kumar")
s, d = assess(a1)
check("normal L2 -> ELIGIBLE (Policy V2: never auto-empanelled)", d.get("assessment", {}).get("decision") == "ELIGIBLE", d.get("assessment", {}).get("decision"))
s, q = call("GET", "/api/verification/council/queue", GURU)
qids = {i["application_id"] for i in q.get("queue", [])}
check("normal automated L2 NOT in council queue", a1 not in qids, qids)

# ── ACCEPTANCE 2: Exception -> Council queue (with all §2 fields) ────────────
a2 = mk("c_t2", country="United Kingdom", name="John Smith")
add_cred(a2, "c_t2", {"qualification_name": "RYT-500", "institution_name": "Nonexistent Academy ZZZ",
                      "institution_result": {"established": False, "source": "ops"}}, name="John Smith")
assess(a2)  # credential conflict -> COUNCIL_REVIEW
s, q = call("GET", "/api/verification/council/queue", GURU)
item = next((i for i in q.get("queue", []) if i["application_id"] == a2), None)
check("exception -> appears in council queue", item is not None, qids)
if item:
    needed = {"teacher_id", "country", "teacher_level", "identity_status", "credential_status",
              "professional_evidence_status", "exception_codes", "reason", "evidence_summary",
              "automated_assessment", "rule_version"}
    check("queue item has all required §2 fields", needed <= set(item.keys()), set(item.keys()))
    check("queue item carries exception codes (EX-05)",
          any(e["code"] == "EX-05" for e in item.get("exception_codes", [])), item.get("exception_codes"))
    check("exception codes have labels", all("label" in e for e in item.get("exception_codes", [])), item.get("exception_codes"))

# ── SECURITY: teacher cannot access council queue/audit ──────────────────────
s, d = call("GET", "/api/verification/council/queue", hdr("c_t2", name="John Smith"))
check("teacher blocked from council queue (403)", s == 403, f"{s} {d}")
s, d = call("GET", "/api/verification/council/audit", hdr("c_t1"))
check("teacher blocked from council audit (403)", s == 403, f"{s} {d}")

# ── SECURITY: teacher sees redacted evidence (no raw identity / fraud signals) ─
# Give a2's teacher a bogus-institution credential already; now check redaction.
s, agg = call("GET", f"/api/verification/application/{a2}", hdr("c_t2", name="John Smith"))
cred0 = (agg.get("credentials") or [{}])[0]
check("teacher credential view hides internal 'checks'", "checks" not in cred0, cred0.keys())
check("teacher credential view hides 'institution_result'", "institution_result" not in cred0, cred0.keys())
# council sees full
s, agg_c = call("GET", f"/api/verification/application/{a2}", GURU)
cred0c = (agg_c.get("credentials") or [{}])[0]
check("council credential view includes 'checks'", "checks" in cred0c, cred0c.keys())

# identity redaction
a1_ident_teacher = None
s, agg1 = call("GET", f"/api/verification/application/{a1}", hdr("c_t1", name="Anand Kumar"))
it = agg1.get("identity_verification") or {}
check("teacher identity view hides risk/face/failure signals",
      all(k not in it for k in ("risk_status", "face_match_status", "liveness_status", "failure_reason", "didit_status")), it.keys())
check("teacher still sees identity verification_status", it.get("verification_status") == "IDENTITY_VERIFIED", it)

# ── ACCEPTANCE 3: Council APPROVE -> EMPANELLED (only after a Policy V2 decision) ─
s, d = call("POST", f"/api/verification/application/{a2}/council/action", GURU,
            {"action": "APPROVE", "note": "Verified the institution out-of-band.", "exception_code": "EX-12"})
check("council APPROVE without a Policy V2 decision is refused (409)", s == 409 and d.get("detail") == "empanelment_policy_decision_required", f"{s} {d}")
policy_approval("c_t2")
s, d = call("POST", f"/api/verification/application/{a2}/council/action", GURU,
            {"action": "APPROVE", "note": "Verified the institution out-of-band.", "exception_code": "EX-12"})
check("council APPROVE returns EMPANELLED", s == 200 and d.get("decision") == "EMPANELLED", f"{s} {d}")
s, agg = call("GET", f"/api/verification/application/{a2}", GURU)
check("approved app -> EMPANELLED", agg["application"]["empanelment_status"] == "EMPANELLED", agg["application"]["empanelment_status"])
# internal council note is NOT exposed to teacher
s, dec = call("GET", f"/api/verification/application/{a2}/council/decisions", GURU)
check("council decision recorded (immutable)", len(dec.get("council_decisions", [])) >= 1, dec)
check("council sees internal note", dec["council_decisions"][-1].get("internal_note") == "Verified the institution out-of-band.", dec["council_decisions"][-1])
s, d = call("GET", f"/api/verification/application/{a2}/council/decisions", hdr("c_t2", name="John Smith"))
check("teacher blocked from council decisions (403)", s == 403, f"{s} {d}")

# ── ACCEPTANCE 4: Council REQUEST INFORMATION -> teacher sees what's missing ─
a3 = mk("c_t3", name="Ravi Shah")
add_cred(a3, "c_t3", {"qualification_name": "Traditional Cert", "institution_name": "Kaivalyadhama",
                      "certificate_url": "https://x/g.pdf", "teacher_name_on_certificate": "Ravi Shah"}, name="Ravi Shah")
assess(a3, override=clean_override(required_qualification_level="RYT-500"))  # -> COUNCIL_REVIEW
s, d = call("POST", f"/api/verification/application/{a3}/council/action", GURU,
            {"action": "REQUEST_INFORMATION", "requested_information": ["Upload RYT-500 certificate", "Provide training hours"]})
check("council REQUEST_INFORMATION ok", s == 200 and d.get("decision") == "ADDITIONAL_INFORMATION_REQUIRED", f"{s} {d}")
s, ir = call("GET", f"/api/verification/application/{a3}/information-request", hdr("c_t3", name="Ravi Shah"))
check("teacher sees ADDITIONAL_INFORMATION_REQUIRED", ir.get("status") == "ADDITIONAL_INFORMATION_REQUIRED", ir)
check("teacher sees exactly what is missing", ir.get("information_requested") == ["Upload RYT-500 certificate", "Provide training hours"], ir)
# teacher submits info WITHOUT restarting (same application id still works)
s, d = add_cred(a3, "c_t3", {"qualification_name": "RYT-500", "institution_name": "Kaivalyadhama",
                             "certificate_number": "R1", "certificate_url": "https://x/r.pdf",
                             "teacher_name_on_certificate": "Ravi Shah"}, name="Ravi Shah")
check("teacher can add info to same application (no restart)", s == 200, f"{s} {d}")

# ── ACCEPTANCE 5: Level 3 -> Council recognition ─────────────────────────────
a4 = mk("c_t4", level="L3", name="Swami Ananda")
verify_identity(a4, "c_t4", name="Swami Ananda")
add_cred(a4, "c_t4", {"qualification_name": "RYT-500", "institution_name": "Bihar School of Yoga",
                      "certificate_number": "L3", "certificate_url": "https://x/l3.pdf",
                      "teacher_name_on_certificate": "Swami Ananda"}, name="Swami Ananda")
assess(a4)  # -> COUNCIL_RECOGNITION_REQUIRED
s, q = call("GET", "/api/verification/council/queue", GURU)
l3item = next((i for i in q.get("queue", []) if i["application_id"] == a4), None)
check("L3 in council queue w/ recognition flag", bool(l3item) and l3item.get("council_recognition_required") is True, l3item)
# non-L3 cannot use guru recognition action
s, d = call("POST", f"/api/verification/application/{a3}/council/action", GURU, {"action": "RECOGNISE_AS_YOGA_GURU"})
check("guru recognition blocked for non-L3 (400)", s == 400, f"{s} {d}")
policy_approval("c_t4")
s, d = call("POST", f"/api/verification/application/{a4}/council/action", GURU,
            {"action": "RECOGNISE_AS_YOGA_GURU", "note": "Recognised at annual council."})
check("L3 RECOGNISE_AS_YOGA_GURU -> EMPANELLED", s == 200 and d.get("decision") == "EMPANELLED", f"{s} {d}")
s, agg = call("GET", f"/api/verification/application/{a4}", GURU)
check("L3 recognised -> EMPANELLED + flag", agg["application"]["empanelment_status"] == "EMPANELLED" and agg["application"].get("council_recognition") is True, agg["application"])

# ── APPEAL flow ──────────────────────────────────────────────────────────────
a5 = mk("c_t5", name="Priya Rao")
verify_identity(a5, "c_t5", name="Priya Rao")
add_cred(a5, "c_t5", {"qualification_name": "RYT-200", "institution_name": "Sivananda Yoga Vedanta",
                      "certificate_number": "PR", "certificate_url": "https://x/pr.pdf",
                      "teacher_name_on_certificate": "Priya Rao"}, name="Priya Rao")
call("POST", f"/api/verification/application/{a5}/professional-evidence", hdr("c_t5", name="Priya Rao"), {"years_teaching": 1})
assess(a5, override=clean_override(minimum_teaching_years=5))  # -> NOT_EMPANELLED
s, agg = call("GET", f"/api/verification/application/{a5}", hdr("c_t5", name="Priya Rao"))
check("adverse decision -> NOT_EMPANELLED", agg["application"]["empanelment_status"] == "NOT_EMPANELLED", agg["application"]["empanelment_status"])
s, d = call("POST", f"/api/verification/application/{a5}/appeal", hdr("c_t5", name="Priya Rao"),
            {"reason": "I have 6 years of teaching experience that was not counted.", "evidence": "studio records",
             "documents": ["https://x/letter.pdf"]})
check("teacher can appeal adverse decision", s == 200 and d.get("appeal", {}).get("status") == "PENDING", f"{s} {d}")
check("appeal captures reason/evidence/documents/date/status",
      all(k in d.get("appeal", {}) for k in ("reason", "evidence", "documents", "created_at", "status")), d.get("appeal"))
s, agg = call("GET", f"/api/verification/application/{a5}", GURU)
check("appeal moves app to APPEAL_PENDING", agg["application"]["empanelment_status"] == "APPEAL_PENDING", agg["application"]["empanelment_status"])
s, ca = call("GET", "/api/verification/council/appeals?status=PENDING", GURU)
check("council sees pending appeals", any(x["application_id"] == a5 for x in ca.get("appeals", [])), ca)
appeal_id = d["appeal"]["appeal_id"]
s, d = call("POST", f"/api/verification/council/appeal/{appeal_id}/decide", GURU, {"decision": "UPHELD", "note": "Granting re-review."})
check("council decides appeal (UPHELD)", s == 200 and d.get("decision") == "UPHELD", f"{s} {d}")
s, agg = call("GET", f"/api/verification/application/{a5}", GURU)
check("upheld appeal re-opens Council review (no auto-empanel)", agg["application"]["empanelment_status"] == "COUNCIL_REVIEW", agg["application"]["empanelment_status"])
# teacher never sees council_note on the appeal
s, ap = call("GET", f"/api/verification/application/{a5}/appeals", hdr("c_t5", name="Priya Rao"))
check("teacher appeal view hides council_note", all("council_note" not in x for x in ap.get("appeals", [])), ap)

# ── AUDIT: filters + periodic sampling (non-destructive) ─────────────────────
s, au = call("GET", "/api/verification/council/audit?decision=EMPANELLED", GURU)
check("audit filter by decision works", s == 200 and all(x["decision"] == "EMPANELLED" for x in au.get("assessments", [])), s)
s, au = call("GET", "/api/verification/council/audit?rule_version=EMPANELMENT_RULES_V1.0", GURU)
check("audit filter by rule_version works", s == 200 and len(au.get("assessments", [])) >= 1, s)
s, sm = call("GET", "/api/verification/council/audit/sample?limit=10", GURU)
check("periodic sample returns auto-empanelled teachers", s == 200 and "sample" in sm, sm)
check("sample is non-destructive (note present)", "non-destructive" in (sm.get("note") or ""), sm.get("note"))
# verify a1 (eligible, no council decision) is unchanged after sampling — still ELIGIBLE, never empanelled
s, agg = call("GET", f"/api/verification/application/{a1}", GURU)
check("sampling did not change the eligible teacher", agg["application"]["empanelment_status"] == "ELIGIBLE", agg["application"]["empanelment_status"])

# ── Exception code config ────────────────────────────────────────────────────
s, d = call("GET", "/api/verification/council/exception-codes", GURU)
check("exception codes EX-01..EX-12 configured", s == 200 and all(f"EX-{i:02d}" in d.get("exception_codes", {}) for i in range(1, 13)), d)
s, d = call("PUT", "/api/verification/council/exception-codes", hdr("c_t1"), {"exception_codes": {"EX-12": "x"}})
check("teacher cannot edit exception codes (403)", s == 403, f"{s} {d}")

print("\n==== SUMMARY ====")
passed = sum(1 for _, c in results if c)
print(f"{passed}/{len(results)} passed")

# Hygiene: reset shared config doc (exception_codes etc.) + remove the policy stand-ins
try:
    _db()["verification_rules_config"].delete_many({})
    _db().empanelment_policy_cases.delete_many({"qa_fixture": True, "teacher_user_id": {"$regex": f"_{RUN}$"}})
except Exception:
    pass
