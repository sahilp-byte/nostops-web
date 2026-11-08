"""Prompt 3 engine test — Credential Verification ladder (A->D), professional
evidence, identity reuse (India/InstaKYC), the 8-category evidence matrix, and
the 10 acceptance scenarios. Deterministic + offline: digital/institution
findings are pre-recorded and well-known institutions are used, so no live
network or AI call is needed. AI assist stays advisory and is covered separately.
"""
import base64, json, urllib.request, urllib.error, uuid
import sys  # noqa: E402
sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — a standalone script: its requests to this preview carry the signed test tag


BASE = "http://localhost:8001"
RUN = uuid.uuid4().hex[:8]  # unique per run -> fresh applications, no cross-run state pollution


def _env(key):
    for l in open("/app/backend/.env").read().splitlines():
        if l.startswith(key + "="):
            return l.split("=", 1)[1]
    return ""


SECRET = _env("PULSE_SHARED_SECRET")


def uh(uid, role="teacher", name=None):
    d = {"user_id": f"{uid}_{RUN}", "name": name or uid, "role": role}
    return base64.b64encode(json.dumps(d).encode()).decode()


def call(method, path, user_hdr=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if user_hdr is not None:
        req.add_header("X-Pulse-Secret", SECRET)
        req.add_header("X-Pulse-User", user_hdr)
    try:
        r = urllib.request.urlopen(req, timeout=35)
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


def new_app(uid, country="India", level="L2", name=None):
    s, d = call("POST", "/api/verification/application", uh(uid, name=name), {"teacher_level": level, "country": country})
    return d.get("application", {}).get("application_id"), d.get("application", {})


def add_cred(appid, uid, cred, name=None):
    return call("POST", f"/api/verification/application/{appid}/credentials", uh(uid, name=name), cred)


# ── 1. VERIFIED QUALIFICATION (Level A — digital) ─────────────────────────────
appid, app = new_app("cq_t1", name="Anand Kumar")
check("indian app uses INSTAKYC provider", app.get("verification_provider") == "INSTAKYC", app)
s, d = add_cred(appid, "cq_t1", {
    "qualification_name": "RYT-500", "institution_name": "Sivananda Yoga Vedanta",
    "certificate_number": "SYV-500-2018", "teacher_name_on_certificate": "Anand Kumar",
    "digital_result": {"verified": True, "method": "PUBLIC_REGISTRY"},
}, name="Anand Kumar")
a = d.get("assessment", {})
check("verified qualification -> CREDENTIAL_VERIFIED (Level A)",
      s == 200 and a.get("status") == "CREDENTIAL_VERIFIED" and a.get("level") == "A", f"{s} {a}")

# ── 2. UNVERIFIABLE QUALIFICATION (no digital, known institution -> Level B) ──
appid2, _ = new_app("cq_t2", name="Meera Nair")
s, d = add_cred(appid2, "cq_t2", {
    "qualification_name": "Yoga Teacher Diploma", "institution_name": "Bihar School of Yoga",
    "teacher_name_on_certificate": "Meera Nair",
}, name="Meera Nair")
a = d.get("assessment", {})
check("unverifiable qualification -> INSTITUTION_VALIDATED (Level B)",
      a.get("status") == "INSTITUTION_VALIDATED" and a.get("level") == "B", a)

# ── 3. INCOMPLETE CERTIFICATE (missing institution + cert -> Level D additional)
appid3, _ = new_app("cq_t3")
s, d = add_cred(appid3, "cq_t3", {"qualification_name": "Some Yoga Course"})
a = d.get("assessment", {})
check("incomplete certificate -> ADDITIONAL_INFORMATION_REQUIRED (Level D)",
      a.get("status") == "ADDITIONAL_INFORMATION_REQUIRED" and a.get("level") == "D", a)

# ── 4. CONFLICTING CERTIFICATE (same cert number, different qualification) ────
appid4, _ = new_app("cq_t4", name="Ravi Shah")
add_cred(appid4, "cq_t4", {"qualification_name": "RYT-200", "institution_name": "Kaivalyadhama",
                           "certificate_number": "DUP-999"}, name="Ravi Shah")
s, d = add_cred(appid4, "cq_t4", {"qualification_name": "RYT-500", "institution_name": "The Yoga Institute",
                                  "certificate_number": "DUP-999"}, name="Ravi Shah")
a = d.get("assessment", {})
check("conflicting certificate -> COUNCIL_REVIEW", a.get("status") == "COUNCIL_REVIEW", a)
check("conflicting cert escalates application to COUNCIL_REVIEW",
      d.get("application_credential_status") == "COUNCIL_REVIEW", d.get("application_credential_status"))

# ── 5. MULTIPLE QUALIFICATIONS (two distinct, both valid -> rollup verified) ──
appid5, _ = new_app("cq_t5", name="Sita Devi")
add_cred(appid5, "cq_t5", {"qualification_name": "RYT-200", "institution_name": "Sivananda Yoga Vedanta",
                           "certificate_number": "A1"}, name="Sita Devi")
s, d = add_cred(appid5, "cq_t5", {"qualification_name": "Pranayama Diploma", "institution_name": "Kaivalyadhama",
                                  "certificate_number": "A2"}, name="Sita Devi")
check("multiple qualifications -> application CREDENTIALS_VERIFIED",
      d.get("application_credential_status") == "CREDENTIALS_VERIFIED", d.get("application_credential_status"))
s, dl = call("GET", f"/api/verification/application/{appid5}/credentials", uh("cq_t5", name="Sita Devi"))
check("two credentials recorded", len(dl.get("credentials", [])) == 2, len(dl.get("credentials", [])))

# ── 6. INTERNATIONAL QUALIFICATION (intl route, known institution -> Level B) ─
appid6, app6 = new_app("cq_t6", country="United Kingdom", name="John Smith")
check("intl app uses DIDIT provider", app6.get("verification_provider") == "DIDIT", app6)
s, d = add_cred(appid6, "cq_t6", {"qualification_name": "RYT-500", "institution_name": "Himalayan Institute",
                                  "institution_country": "USA", "teacher_name_on_certificate": "John Smith"},
                name="John Smith")
a = d.get("assessment", {})
check("international qualification -> INSTITUTION_VALIDATED (Level B)",
      a.get("status") == "INSTITUTION_VALIDATED", a)

# ── 7. NAME VARIATION (initials/abbrev accepted, not a conflict) ─────────────
appid7, _ = new_app("cq_t7", name="Anand Kumar")
s, d = add_cred(appid7, "cq_t7", {"qualification_name": "RYT-200", "institution_name": "Kaivalyadhama",
                                  "teacher_name_on_certificate": "A. Kumar"}, name="Anand Kumar")
a = d.get("assessment", {})
check("name variation accepted (MATCH, not conflict)",
      a.get("checks", {}).get("name_match") == "MATCH" and a.get("status") == "INSTITUTION_VALIDATED", a)

# ── 8. INSTITUTION NOT ESTABLISHED (recorded finding -> Council) ─────────────
appid8, _ = new_app("cq_t8", name="Fake Teacher")
s, d = add_cred(appid8, "cq_t8", {"qualification_name": "RYT-900", "institution_name": "Nonexistent Yoga Academy XYZ",
                                  "institution_result": {"established": False, "source": "ops_check"}},
                name="Fake Teacher")
a = d.get("assessment", {})
check("institution not established -> COUNCIL_REVIEW", a.get("status") == "COUNCIL_REVIEW", a)

# ── 9. ADDITIONAL EVIDENCE (incomplete -> add info -> resolves) ──────────────
appid9, _ = new_app("cq_t9", name="Priya Rao")
s, d = add_cred(appid9, "cq_t9", {"qualification_name": "Yoga Cert"}, name="Priya Rao")
cid9 = d.get("credential", {}).get("credential_id")
check("stage 1 incomplete -> ADDITIONAL", d.get("assessment", {}).get("status") == "ADDITIONAL_INFORMATION_REQUIRED", d.get("assessment"))
s, d = call("PATCH", f"/api/verification/application/{appid9}/credentials/{cid9}",
            uh("cq_t9", name="Priya Rao"), {"institution_name": "The Yoga Institute", "certificate_number": "P-1"})
check("after adding evidence -> INSTITUTION_VALIDATED",
      d.get("assessment", {}).get("status") == "INSTITUTION_VALIDATED", d.get("assessment"))

# ── 10. COUNCIL ESCALATION (name conflict) ───────────────────────────────────
appid10, _ = new_app("cq_t10", name="Anand Kumar")
s, d = add_cred(appid10, "cq_t10", {"qualification_name": "RYT-200", "institution_name": "Sivananda Yoga Vedanta",
                                    "teacher_name_on_certificate": "Rajesh Singh"}, name="Anand Kumar")
a = d.get("assessment", {})
check("name conflict -> COUNCIL_REVIEW", a.get("status") == "COUNCIL_REVIEW" and a.get("checks", {}).get("name_match") == "CONFLICT", a)

# ── INDIA: identity reuse (no identity re-verification) ──────────────────────
appidI, _ = new_app("cq_india", country="India", name="Deepa K")
s, d = call("POST", f"/api/verification/application/{appidI}/reuse-identity",
            uh("cq_india", name="Deepa K"), {"instakyc_verified": True, "provider_reference": "KYC-REF-1", "pan_verified": True})
check("india reuse-identity ok", s == 200 and d.get("ok"), f"{s} {d}")
check("india identity reuse -> IDENTITY_VERIFIED + credential verification",
      d.get("application", {}).get("verification_status") == "IDENTITY_VERIFIED"
      and d.get("application", {}).get("credential_status") == "CREDENTIAL_VERIFICATION", d.get("application"))
# international teacher cannot use InstaKYC reuse
s, d = call("POST", f"/api/verification/application/{appid6}/reuse-identity", uh("cq_t6"), {"instakyc_verified": True})
check("intl reuse-identity rejected (400)", s == 400, f"{s} {d}")

# ── Professional evidence + audit ────────────────────────────────────────────
s, d = call("POST", f"/api/verification/application/{appidI}/professional-evidence", uh("cq_india", name="Deepa K"), {
    "years_teaching": 8, "corporate_teaching": "Yes", "retreat_teaching": "Yes",
    "international_teaching": "No", "online_teaching": "Yes",
    "professional_references": [{"name": "Guru X", "contact": "x@y.com"}],
    "professional_website": "https://example.com",
})
check("professional evidence stored", s == 200 and (d.get("professional_evidence", {}) or {}).get("years_teaching") == 8, f"{s} {d}")
s, au = call("GET", f"/api/verification/application/{appidI}/audit", uh("cq_india", name="Deepa K"))
evset = {e["event"] for e in au.get("events", [])}
check("audit has PROFESSIONAL_EVIDENCE_SUBMITTED", "PROFESSIONAL_EVIDENCE_SUBMITTED" in evset, evset)
check("audit has IDENTITY_VERIFIED (reused)", "IDENTITY_VERIFIED" in evset, evset)

# lineage + credential so the matrix is fully populated
call("POST", f"/api/verification/application/{appidI}/lineage", uh("cq_india", name="Deepa K"),
     {"tradition": "Hatha", "lineage": "Sivananda", "guru_teacher": "Swami X"})
add_cred(appidI, "cq_india", {"qualification_name": "RYT-500", "institution_name": "Sivananda Yoga Vedanta",
                              "certificate_number": "DK-1", "certificate_url": "https://example.com/cert.pdf",
                              "completion_date": "2016", "teacher_name_on_certificate": "Deepa K"}, name="Deepa K")

# ── Evidence matrix (8 categories) ───────────────────────────────────────────
s, d = call("GET", f"/api/verification/application/{appidI}/evidence-matrix", uh("cq_india", name="Deepa K"))
mx = d.get("evidence_matrix", {})
expected_cats = {"IDENTITY", "QUALIFICATION", "INSTITUTION", "EXPERIENCE", "LINEAGE", "PROFESSIONAL_HISTORY", "REFERENCES", "DOCUMENTS"}
check("evidence matrix has all 8 categories", set(mx.keys()) == expected_cats, set(mx.keys()))
check("matrix IDENTITY verified (InstaKYC reused)", mx.get("IDENTITY", {}).get("status") == "IDENTITY_VERIFIED", mx.get("IDENTITY"))
check("matrix QUALIFICATION verified", mx.get("QUALIFICATION", {}).get("status") == "VERIFIED", mx.get("QUALIFICATION"))
check("matrix INSTITUTION verified", mx.get("INSTITUTION", {}).get("status") == "VERIFIED", mx.get("INSTITUTION"))
check("matrix EXPERIENCE submitted", mx.get("EXPERIENCE", {}).get("status") == "SUBMITTED", mx.get("EXPERIENCE"))
check("matrix LINEAGE submitted", mx.get("LINEAGE", {}).get("status") == "SUBMITTED", mx.get("LINEAGE"))
check("matrix DOCUMENTS submitted", mx.get("DOCUMENTS", {}).get("status") == "SUBMITTED", mx.get("DOCUMENTS"))
check("every matrix cell has the 5 required keys",
      all({"status", "source", "verification_method", "date", "notes"} <= set(v.keys()) for v in mx.values()), mx)

# ── No auto-empanelment anywhere (Prompt 3 never empanels) ───────────────────
s, agg = call("GET", f"/api/verification/application/{appidI}", uh("cq_india", name="Deepa K"))
check("no auto-empanelment in Prompt 3", agg.get("application", {}).get("empanelment_status") == "NOT_STARTED",
      agg.get("application", {}).get("empanelment_status"))

print("\n==== SUMMARY ====")
passed = sum(1 for _, c in results if c)
print(f"{passed}/{len(results)} passed")
