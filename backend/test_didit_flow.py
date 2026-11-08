"""Prompt 2 engine test — session gating, signed webhook pipeline, idempotency,
no auto-empanelment. Uses the LIVE Didit key for session create + self-signed
webhooks (real webhook secret) for deterministic result scenarios."""
import base64, hashlib, hmac, json, time, urllib.request, urllib.error
import sys  # noqa: E402
sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — a standalone script: its requests to this preview carry the signed test tag


BASE = "http://localhost:8001"


def _env(key):
    for l in open("/app/backend/.env").read().splitlines():
        if l.startswith(key + "="):
            return l.split("=", 1)[1]
    return ""


SECRET = _env("PULSE_SHARED_SECRET")
WH_SECRET = _env("DIDIT_WEBHOOK_SECRET")


def uh(uid, role="teacher", **extra):
    d = {"user_id": uid, "name": uid, "role": role}
    d.update(extra)
    return base64.b64encode(json.dumps(d).encode()).decode()


def call(method, path, user_hdr=None, body=None, extra_headers=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if user_hdr is not None:
        req.add_header("X-Pulse-Secret", SECRET)
        req.add_header("X-Pulse-User", user_hdr)
    for k, v in (extra_headers or {}).items():
        req.add_header(k, v)
    try:
        r = urllib.request.urlopen(req, timeout=35)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def canonical(obj):
    def norm(x):
        if isinstance(x, bool):
            return x
        if isinstance(x, float) and x.is_integer():
            return int(x)
        if isinstance(x, list):
            return [norm(i) for i in x]
        if isinstance(x, dict):
            return {k: norm(v) for k, v in x.items()}
        return x
    return json.dumps(norm(obj), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def post_webhook(payload, ts=None, bad_sig=False):
    ts = ts or int(time.time())
    sig = hmac.new(WH_SECRET.encode(), canonical(payload).encode(), hashlib.sha256).hexdigest()
    if bad_sig:
        sig = "deadbeef"
    raw = json.dumps(payload).encode()
    req = urllib.request.Request(BASE + "/api/verification/didit/webhook", data=raw, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Signature-V2", sig)
    req.add_header("X-Timestamp", str(ts))
    try:
        r = urllib.request.urlopen(req, timeout=35)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, (json.loads(e.read().decode() or "{}") if e.headers.get("content-type", "").startswith("application/json") else {})


def approved_decision():
    return {
        "id_verifications": [{"status": "Approved", "document_type": "PASSPORT", "issuing_state": "GBR", "date_of_expiry": "2030-01-01", "warnings": []}],
        "liveness_checks": [{"status": "Approved"}],
        "face_matches": [{"status": "Approved", "score": 0.98}],
        "ip_analysis": [{"status": "Approved"}],
        "questionnaire_responses": [{"status": "Approved", "sections": [{"items": [
            {"label": "Highest yoga qualification", "answer": "RYT-500"},
            {"label": "Qualification institution", "answer": "Sivananda Yoga Vedanta"},
            {"label": "Qualification country", "answer": "India"},
            {"label": "Completion year", "answer": "2018"},
            {"label": "Years teaching", "answer": "7"},
            {"label": "Teaching formats", "answer": "Group, Online"},
            {"label": "Corporate experience", "answer": "Yes"},
            {"label": "Yoga tradition", "answer": "Hatha"},
            {"label": "Lineage", "answer": "Sivananda"},
            {"label": "Guru/teacher", "answer": "Swami X"},
            {"label": "Specialisation", "answer": "Hatha, Pranayama"},
            {"label": "Professional website", "answer": "https://example.com"},
        ]}]}],
    }


results = []


def check(name, cond, info=""):
    results.append((name, cond, info))
    print(("PASS" if cond else "FAIL"), "-", name, ("" if cond else f"<< {info}"))


# ── 1. Create an international application ─────────────────────────────────────
t1 = "qa_didit_t1"
s, d = call("POST", "/api/verification/application", uh(t1), {"teacher_level": "L2", "country": "United Kingdom", "nationality": "British"})
app1 = d.get("application", {})
check("intl application created", s == 200 and app1.get("verification_route") == "INTERNATIONAL" and app1.get("verification_provider") == "DIDIT", f"{s} {d}")
appid1 = app1.get("application_id")

# ── 2. Session create blocked before payment ──────────────────────────────────
s, d = call("POST", "/api/verification/didit/session", uh(t1))
check("session blocked before payment (402)", s == 402, f"{s} {d}")

# ── 3. Mark paid (teacher cannot; admin can) ──────────────────────────────────
s, d = call("POST", f"/api/verification/application/{appid1}/mark-paid", uh(t1), {"payment_reference": "x"})
check("teacher cannot mark paid (403)", s == 403, f"{s} {d}")
s, d = call("POST", f"/api/verification/application/{appid1}/mark-paid", uh("qa_admin", "admin"), {"payment_reference": "PAY123", "payment_amount": 49.0, "payment_currency": "USD"})
check("admin marks paid", s == 200 and d.get("ok"), f"{s} {d}")

# ── 4. Create Didit session (real, live key) ──────────────────────────────────
s, d = call("POST", "/api/verification/didit/session", uh(t1))
sid1 = d.get("session_id")
check("didit session created (live)", s == 200 and bool(sid1) and bool(d.get("url")), f"{s} {d}")
if not sid1:
    sid1 = "sess_qa_1"  # fallback so webhook tests still run via vendor_data

# ── 5. Approved webhook → IDENTITY_VERIFIED + evidence + credential pending ────
payload = {"session_id": sid1, "status": "Approved", "vendor_data": appid1, "workflow_id": app1.get("didit_workflow_id"), "event_id": "evt_app1_approved", "decision": approved_decision()}
s, d = post_webhook(payload)
check("approved webhook accepted", s == 200 and d.get("ok"), f"{s} {d}")
s, agg = call("GET", f"/api/verification/application/{appid1}", uh(t1))
a = agg.get("application", {})
check("app -> IDENTITY_VERIFIED", a.get("verification_status") == "IDENTITY_VERIFIED", a.get("verification_status"))
check("credential_status -> CREDENTIAL_VERIFICATION", a.get("credential_status") == "CREDENTIAL_VERIFICATION", a.get("credential_status"))
check("NO auto-empanelment", a.get("empanelment_status") == "NOT_STARTED", a.get("empanelment_status"))
check("identity verified recorded", (agg.get("identity_verification") or {}).get("verification_status") == "IDENTITY_VERIFIED", agg.get("identity_verification"))
check("evidence ingested from questionnaire", (agg.get("professional_evidence") or {}).get("years_teaching") == "7", agg.get("professional_evidence"))
check("lineage ingested", any((l or {}).get("lineage") == "Sivananda" for l in agg.get("lineage") or []), agg.get("lineage"))
check("credential ingested", any((c or {}).get("qualification_name") == "RYT-500" for c in agg.get("credentials") or []), agg.get("credentials"))
s, au = call("GET", f"/api/verification/application/{appid1}/audit", uh(t1))
evset = {e["event"] for e in au.get("events", [])}
check("audit has IDENTITY_VERIFIED", "IDENTITY_VERIFIED" in evset, evset)
check("audit has PROFESSIONAL_EVIDENCE_SUBMITTED", "PROFESSIONAL_EVIDENCE_SUBMITTED" in evset, evset)
check("audit has CREDENTIAL_SUBMITTED", "CREDENTIAL_SUBMITTED" in evset, evset)

# ── 6. Idempotency — duplicate webhook (same event_id) ────────────────────────
before = len(au.get("events", []))
s, d = post_webhook(payload)
check("duplicate webhook is no-op", s == 200 and d.get("duplicate") is True, f"{s} {d}")
s, au2 = call("GET", f"/api/verification/application/{appid1}/audit", uh(t1))
check("no duplicate audit events", len(au2.get("events", [])) == before, f"{before} -> {len(au2.get('events', []))}")
# no duplicate credential/lineage
s, agg2 = call("GET", f"/api/verification/application/{appid1}", uh(t1))
didit_creds = [c for c in agg2.get("credentials", []) if c.get("source") == "didit_questionnaire"]
check("no duplicate credential on retry", len(didit_creds) == 1, len(didit_creds))

# ── 7. Bad signature rejected ─────────────────────────────────────────────────
s, d = post_webhook({"session_id": sid1, "status": "Approved", "vendor_data": appid1, "event_id": "evt_bad"}, bad_sig=True)
check("bad signature -> 401", s == 401, f"{s} {d}")

# ── 8. Stale timestamp rejected ───────────────────────────────────────────────
s, d = post_webhook({"session_id": sid1, "status": "Approved", "vendor_data": appid1, "event_id": "evt_stale"}, ts=int(time.time()) - 1000)
check("stale timestamp -> 401", s == 401, f"{s} {d}")

# ── 9. Declined (failed identity) on a 2nd application ────────────────────────
t2 = "qa_didit_t2"
s, d = call("POST", "/api/verification/application", uh(t2), {"teacher_level": "L2", "country": "Germany"})
appid2 = d["application"]["application_id"]
call("POST", f"/api/verification/application/{appid2}/mark-paid", uh("qa_admin", "admin"), {"payment_reference": "P2"})
dec = {"session_id": "sess_qa_2", "status": "Declined", "vendor_data": appid2, "event_id": "evt_declined", "decision": {"id_verifications": [{"status": "Declined", "warnings": ["document_expired"]}]}}
s, d = post_webhook(dec)
s, agg = call("GET", f"/api/verification/application/{appid2}", uh(t2))
check("declined -> IDENTITY_FAILED", agg["application"]["verification_status"] == "IDENTITY_FAILED", agg["application"]["verification_status"])
check("declined does not empanel", agg["application"]["empanelment_status"] == "NOT_STARTED", agg["application"]["empanelment_status"])

# ── 10. In Review on a 3rd application → stays pending ────────────────────────
t3 = "qa_didit_t3"
s, d = call("POST", "/api/verification/application", uh(t3), {"country": "France"})
appid3 = d["application"]["application_id"]
call("POST", f"/api/verification/application/{appid3}/mark-paid", uh("qa_admin", "admin"), {})
s, d = post_webhook({"session_id": "sess_qa_3", "status": "In Review", "vendor_data": appid3, "event_id": "evt_review", "decision": {}})
s, agg = call("GET", f"/api/verification/application/{appid3}", uh(t3))
check("in-review -> stays VERIFICATION_PENDING", agg["application"]["verification_status"] == "VERIFICATION_PENDING", agg["application"]["verification_status"])

print("\n==== SUMMARY ====")
passed = sum(1 for _, c, _ in results if c)
print(f"{passed}/{len(results)} passed")
print("TEST_IDS", json.dumps([t1, t2, t3]))
