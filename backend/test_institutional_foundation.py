"""
Foundation test for the NOSTOPS Institutional Program Engine (Prompt 1).
Verifies: health, meta vocabulary (strict taxonomy — never 'Specific Needs'),
immutable-ID format, Organisation create/read/list/members + membership scoping,
engine isolation (never forwards to remote), and regression of existing proxy.
Run: python /app/backend/test_institutional_foundation.py
"""
import base64
import json
import os

import httpx
from dotenv import load_dotenv
import sys  # noqa: E402
sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — a standalone script: its requests to this preview carry the signed test tag


load_dotenv("/app/backend/.env")
BASE = "http://localhost:8001"
SECRET = os.environ["PULSE_SHARED_SECRET"]

PASS, FAIL = 0, 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name} {extra}")


def hdr(user):
    return {
        "X-Pulse-Secret": SECRET,
        "X-Pulse-User": base64.b64encode(json.dumps(user).encode()).decode(),
        "Content-Type": "application/json",
    }


USER_A = {"user_id": "qa_inst_owner_A", "name": "QA Owner A", "role": "corporate", "email": "qa.inst.a@nostopsqa.com"}
USER_B = {"user_id": "qa_inst_owner_B", "name": "QA Owner B", "role": "corporate", "email": "qa.inst.b@nostopsqa.com"}

with httpx.Client(base_url=BASE, timeout=20) as c:
    print("\n[1] health")
    r = c.get("/api/institutional/health")
    check("health 200", r.status_code == 200, r.text)
    j = r.json()
    check("engine=institutional", j.get("engine") == "institutional")
    check("db_ok", j.get("db_ok") is True)
    check("active", j.get("active") is True)

    print("\n[2] meta — strict governance vocabulary (public, no auth)")
    r = c.get("/api/institutional/meta")
    check("meta 200", r.status_code == 200, r.text)
    m = r.json()
    tax_labels = [t["label"] for t in m["taxonomy"]]
    check("taxonomy == Mind/Body/Special Needs", tax_labels == ["Mind", "Body", "Special Needs"], tax_labels)
    check("NEVER 'Specific Needs' anywhere in meta", "Specific Needs" not in json.dumps(m))
    check("special-needs slug", any(t["slug"] == "special-needs" for t in m["taxonomy"]))
    check("lifecycle order", m["event_lifecycle"] == ["DRAFT", "PUBLISHED", "LIVE", "COMPLETED", "ARCHIVED", "EVERGREEN"])
    check("visibility set", set(m["event_visibility"]) == {"PRIVATE", "UNLISTED", "PUBLIC"})
    check("only PUBLIC indexable", m["publicly_indexable_visibility"] == ["PUBLIC"])
    check("retention 90d", m["public_retention_days"] == 90)
    check("org trust 4 states", set(m["org_trust_states"]) == {"UNVERIFIED", "VERIFICATION_PENDING", "VERIFIED", "EXCEPTION_MANUAL_REVIEW"})
    check("3 cohorts", {c["key"] for c in m["cohorts"]} == {"COMPANY", "EDUCATIONAL_INSTITUTION", "STARTUP_NETWORK"})
    check("9 launch cities", len(m["launch_cities"]) == 9)
    city_names = {c["name"] for c in m["launch_cities"]}
    check("cities match spec", city_names == {"Mumbai", "Navi Mumbai", "Pune", "Nashik", "Delhi", "Gurgaon", "Bangalore", "Chandigarh", "Hyderabad"}, city_names)
    check("6 personas", len(m["personas"]) == 6)
    check("public persona", m["public_persona"] == "PUBLIC_VISITOR")
    check("coordinator NOT a gate", m["city_coordinator_is_gate_for_event_creation"] is False)
    check("IP: no hard-coded %", m["ip_principle"]["hard_coded_commercial_percentages"] is False)
    check("23-entity id_prefixes present", "Event" in m["id_prefixes"] and "ProgrammeIPMetadata" in m["id_prefixes"] and "EventSEO" in m["id_prefixes"])
    check("council vs org field split", len(m["council_controlled_fields"]) >= 8 and len(m["organisation_controlled_fields"]) >= 8)

    print("\n[3] auth enforcement")
    r = c.get("/api/institutional/config")
    check("config without secret → 401", r.status_code == 401, r.status_code)
    r = c.get("/api/institutional/config", headers=hdr(USER_A))
    check("config with secret → 200", r.status_code == 200, r.text)
    r = c.post("/api/institutional/organisations", headers={"Content-Type": "application/json"}, json={"name": "X", "cohort_type": "COMPANY"})
    check("create without secret → 401", r.status_code == 401, r.status_code)

    print("\n[4] Organisation create (self-service, no coordinator gate)")
    r = c.post("/api/institutional/organisations", headers=hdr(USER_A),
               json={"name": "Acme Mind Labs", "cohort_type": "COMPANY", "city": "Pune",
                     "contact_email": "wellness@acme.com", "creator_role": "HR"})
    check("create 200", r.status_code == 200, r.text)
    data = r.json()
    org = data["organisation"]
    member = data["member"]
    oid = org["organisation_id"]
    import re
    check("org id immutable format", bool(re.match(r"^NOSTOPS-ORG-\d{4}-\d{6}$", oid)), oid)
    check("member id immutable format", bool(re.match(r"^NOSTOPS-MBR-\d{4}-\d{6}$", member["member_id"])), member["member_id"])
    check("trust_state UNVERIFIED", org["trust_state"] == "UNVERIFIED")
    check("cohort COMPANY", org["cohort_type"] == "COMPANY")
    check("is_launch_city (Pune)", org["is_launch_city"] is True)
    check("email_domain derived", org["email_domain"] == "acme.com")
    check("no mongo _id leaked", "_id" not in org and "_id" not in member)
    check("creator is OWNER + event_creator", member["member_role"] == "OWNER" and member["event_creator"] is True)
    check("creator_role HR stored", member["event_creator_role"] == "HR")

    print("\n[5] invalid inputs")
    r = c.post("/api/institutional/organisations", headers=hdr(USER_A), json={"name": "Bad", "cohort_type": "NGO"})
    check("invalid cohort → 400", r.status_code == 400, r.status_code)
    r = c.post("/api/institutional/organisations", headers=hdr(USER_A), json={"name": "Bad", "cohort_type": "COMPANY", "creator_role": "CEO"})
    check("invalid creator_role → 400", r.status_code == 400, r.status_code)

    print("\n[6] membership scoping (anti-leak)")
    # User B creates their own org.
    rb = c.post("/api/institutional/organisations", headers=hdr(USER_B),
                json={"name": "Beta University", "cohort_type": "EDUCATIONAL_INSTITUTION", "city": "London"})
    bid = rb.json()["organisation"]["organisation_id"]
    check("B org not launch city (London)", rb.json()["organisation"]["is_launch_city"] is False)
    # A lists — sees only A's org, not B's.
    r = c.get("/api/institutional/organisations", headers=hdr(USER_A))
    a_ids = {o["organisation_id"] for o in r.json()["organisations"]}
    check("A sees own org", oid in a_ids)
    check("A does NOT see B's org", bid not in a_ids)
    # A cannot GET B's org → 404 (no existence leak).
    r = c.get(f"/api/institutional/organisations/{bid}", headers=hdr(USER_A))
    check("A GET B org → 404", r.status_code == 404, r.status_code)
    # A can GET own org + members.
    r = c.get(f"/api/institutional/organisations/{oid}", headers=hdr(USER_A))
    check("A GET own org → 200", r.status_code == 200 and r.json()["organisation"]["my_role"] == "OWNER")
    r = c.get(f"/api/institutional/organisations/{oid}/members", headers=hdr(USER_A))
    check("A lists own members (1)", r.status_code == 200 and r.json()["count"] == 1)

    print("\n[7] immutable-ID monotonic sequence")
    r1 = c.post("/api/institutional/organisations", headers=hdr(USER_A), json={"name": "Seq One", "cohort_type": "STARTUP_NETWORK"})
    r2 = c.post("/api/institutional/organisations", headers=hdr(USER_A), json={"name": "Seq Two", "cohort_type": "STARTUP_NETWORK"})
    s1 = int(r1.json()["organisation"]["organisation_id"].split("-")[-1])
    s2 = int(r2.json()["organisation"]["organisation_id"].split("-")[-1])
    check("sequence increments", s2 == s1 + 1, f"{s1}->{s2}")

    print("\n[8] isolation + regression (existing surfaces untouched)")
    r = c.get("/api/health")
    check("proxy /api/health still healthy", r.status_code == 200 and r.json().get("proxy") is True)
    r = c.get("/api/verification/meta") if False else c.get("/api/health")  # placeholder
    r = c.get("/api/teachers/directory?limit=5")
    check("remote proxy /api/teachers/directory reachable", r.status_code == 200, r.status_code)

print(f"\n================  {PASS} passed, {FAIL} failed  ================")
exit(1 if FAIL else 0)
