"""Prompt 2 backend flow test — Council programmes, org update+logo, event
draft/publish, public visibility rules, and authorised-member enforcement.
Run: python /app/backend/test_institutional_prompt2.py
"""
import base64
import json
import os
import re

import httpx
from dotenv import load_dotenv
import sys  # noqa: E402
sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — a standalone script: its requests to this preview carry the signed test tag


load_dotenv("/app/backend/.env")
BASE = "http://localhost:8001"
SECRET = os.environ["PULSE_SHARED_SECRET"]
PASS = FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f"  ✅ {name}")
    else:
        FAIL += 1; print(f"  ❌ {name} {extra}")


def h(user=None):
    hd = {"X-Pulse-Secret": SECRET, "Content-Type": "application/json"}
    if user:
        hd["X-Pulse-User"] = base64.b64encode(json.dumps(user).encode()).decode()
    return hd


CREATOR = {"user_id": "qa_p2_creator", "name": "Anita Sharma", "role": "corporate", "email": "wellness@acme.com"}
OUTSIDER = {"user_id": "qa_p2_outsider", "name": "Mallory", "role": "corporate", "email": "m@evil.com"}
ADMIN = {"user_id": "qa_p2_admin", "name": "QA Admin", "role": "admin"}

with httpx.Client(base_url=BASE, timeout=20) as c:
    print("\n[1] programmes catalogue (secret-gated, taxonomy strict)")
    r = c.get("/api/institutional/programmes", headers=h())
    check("list 200", r.status_code == 200, r.text)
    d = r.json()
    check("10 seeded", d["count"] == 10, d["count"])
    check("4 Mind incl Focus & Attention", any(p["name"] == "Yoga for Focus & Attention" for p in d["by_taxonomy"]["MIND"]))
    check("no 'Specific Needs'", "Specific Needs" not in json.dumps(d))
    check("seed marked SEED_DEVELOPMENT", all(p["content_status"] == "SEED_DEVELOPMENT" for p in d["programmes"]))
    check("no clinical claims baked", all(p.get("council_curated") for p in d["programmes"]))
    r = c.get("/api/institutional/programmes?taxonomy=SPECIAL_NEEDS", headers=h())
    check("filter SPECIAL_NEEDS -> 3", r.json()["count"] == 3, r.json()["count"])
    r = c.get("/api/institutional/programmes?taxonomy=BOGUS", headers=h())
    check("bad taxonomy -> 400", r.status_code == 400)
    r = c.get("/api/institutional/programmes")
    check("no secret -> 401", r.status_code == 401)
    mind_prog = d["by_taxonomy"]["MIND"][0]
    mind_pid = mind_prog["programme_id"]

    print("\n[2] org create + update + logo field")
    r = c.post("/api/institutional/organisations", headers=h(CREATOR),
               json={"name": "Acme Mind Labs", "cohort_type": "COMPANY", "city": "Mumbai", "contact_email": "wellness@acme.com", "creator_role": "HR"})
    oid = r.json()["organisation"]["organisation_id"]
    champion_member_id = r.json()["member"]["member_id"]
    check("org created", bool(re.match(r"^NOSTOPS-ORG-\d{4}-\d{6}$", oid)))
    r = c.patch(f"/api/institutional/organisations/{oid}", headers=h(CREATOR),
                json={"logo_url": "/bff/media/retreats/qa/logo.png", "contact_person": "Anita Sharma", "contact_phone": "+91 98765 43210"})
    check("org logo saved on profile", r.status_code == 200 and r.json()["organisation"]["logo_url"] == "/bff/media/retreats/qa/logo.png", r.text)
    # outsider cannot patch
    r = c.patch(f"/api/institutional/organisations/{oid}", headers=h(OUTSIDER), json={"name": "Hacked"})
    check("outsider PATCH org -> 403", r.status_code == 403, r.status_code)

    print("\n[3] event create (DRAFT) — authorised creator")
    r = c.post("/api/institutional/events", headers=h(CREATOR), json={
        "organisation_id": oid, "programme_id": mind_pid, "title": "Yoga for Focus & Attention – Acme Mumbai",
        "event_date": "2026-11-18", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60,
        "city": "Mumbai", "venue": "Acme Mumbai – Conference Hall A", "capacity": 40, "language": "English",
        "registration_closing_date": "2026-11-16", "visibility": "PUBLIC",
        "programme_champion_member_id": champion_member_id,
    })
    check("event create 200", r.status_code == 200, r.text)
    ev = r.json()["event"]
    eid = ev["event_id"]
    check("event id immutable", bool(re.match(r"^NOSTOPS-EVT-\d{4}-\d{6}$", eid)), eid)
    check("lifecycle DRAFT", ev["lifecycle"] == "DRAFT")
    check("no slug before publish", ev["slug"] is None)
    check("programme snapshot frozen (Council)", ev["programme_snapshot"]["name"] == mind_prog["name"] and ev["programme_snapshot"]["council_curated"] is True)
    check("champion separate from contact", ev["programme_champion"]["member_id"] == champion_member_id)

    print("\n[4] outsider cannot create/manage this org's events")
    r = c.post("/api/institutional/events", headers=h(OUTSIDER), json={"organisation_id": oid, "programme_id": mind_pid, "title": "Rogue Event", "city": "Mumbai", "event_date": "2026-12-01"})
    check("outsider create -> 403", r.status_code == 403, r.status_code)
    r = c.patch(f"/api/institutional/events/{eid}", headers=h(OUTSIDER), json={"title": "Hijacked"})
    check("outsider patch -> 403", r.status_code == 403, r.status_code)

    print("\n[5] public read blocked while DRAFT")
    # event has no slug yet; try the (eventual) slug - should 404
    r = c.get(f"/api/institutional/public/events/nonexistent-slug", headers=h())
    check("public unknown slug -> 404", r.status_code == 404)

    print("\n[6] publish (DRAFT -> PUBLISHED) + public read (PUBLIC indexable)")
    r = c.post(f"/api/institutional/events/{eid}/publish", headers=h(CREATOR))
    check("publish 200", r.status_code == 200, r.text)
    pub = r.json()
    slug = pub["event"]["slug"]
    check("slug assigned", bool(slug))
    # §10 (Prompt 5) superseded the original "every PUBLIC event is indexable"
    # rule: only a VERIFIED organisation's PUBLIC events are search-indexable.
    # The org here is UNVERIFIED, so publish must report not-indexable; the
    # verified half of the rule is asserted after the admin verifies the org below.
    check("PUBLIC + UNVERIFIED org -> not indexable yet (§10)", pub["indexable"] is False)
    check("public_path", pub["public_path"] == f"/events/{slug}")
    r = c.get(f"/api/institutional/public/events/{slug}", headers=h())
    check("public read 200", r.status_code == 200, r.text)
    pe = r.json()["event"]
    check("public has programme + council_curated", pe["programme"]["council_curated"] is True)
    check("teacher status neutral non-final", pe["teacher_status"] == "NOSTOPS teacher matching")
    # Prompt 6 replaced the "Registration will open shortly" placeholder with the
    # real participant registration engine: a published, future, OPEN + FREE event
    # with free seats is honestly open for registration immediately.
    check("registration honest state (OPEN + FREE -> open now)",
          pe["registration_open"] is True and pe["registration_status"] == "Free · Open for registration",
          f'{pe.get("registration_open")} / {pe.get("registration_status")!r}')
    check("no champion PII in public", "programme_champion" not in pe and "created_by" not in pe)
    check("org verified flag present (unverified here)", pe["organisation"]["verified"] is False)
    r = c.patch(f"/api/institutional/admin/organisations/{oid}/trust", headers=h(ADMIN), json={"trust_state": "VERIFIED"})
    check("admin verifies org", r.status_code == 200, r.text)
    r = c.get(f"/api/institutional/public/events/{slug}", headers=h())
    check("PUBLIC + VERIFIED org -> indexable (§10)", r.json()["event"]["indexable"] is True, r.text[:200])

    print("\n[7] UNLISTED resolves by direct link; PRIVATE does NOT")
    # create + publish an UNLISTED event
    r = c.post("/api/institutional/events", headers=h(CREATOR), json={"organisation_id": oid, "programme_id": mind_pid, "title": "Unlisted Session", "city": "Pune", "event_date": "2026-11-20", "visibility": "UNLISTED"})
    ue = r.json()["event"]["event_id"]
    rs = c.post(f"/api/institutional/events/{ue}/publish", headers=h(CREATOR)).json()
    uslug = rs["event"]["slug"]
    check("unlisted NOT indexable", rs["indexable"] is False)
    check("unlisted resolves by slug", c.get(f"/api/institutional/public/events/{uslug}", headers=h()).status_code == 200)
    # PRIVATE
    r = c.post("/api/institutional/events", headers=h(CREATOR), json={"organisation_id": oid, "programme_id": mind_pid, "title": "Private Session", "city": "Delhi", "event_date": "2026-11-22", "visibility": "PRIVATE"})
    pv = r.json()["event"]["event_id"]
    rs = c.post(f"/api/institutional/events/{pv}/publish", headers=h(CREATOR)).json()
    pslug = rs["event"]["slug"]
    check("private NOT indexable", rs["indexable"] is False)
    check("private NOT publicly resolvable -> 404", c.get(f"/api/institutional/public/events/{pslug}", headers=h()).status_code == 404)

    print("\n[8] my events list (creator sees own; outsider sees none)")
    r = c.get("/api/institutional/events", headers=h(CREATOR))
    check("creator lists own events (>=3)", r.json()["count"] >= 3, r.json()["count"])
    r = c.get("/api/institutional/events", headers=h(OUTSIDER))
    check("outsider lists 0", r.json()["count"] == 0)

print(f"\n================  {PASS} passed, {FAIL} failed  ================")
exit(1 if FAIL else 0)
