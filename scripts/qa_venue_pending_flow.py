"""Local QA for: live-venue pending changes, minor auto-approve, version history,
restore, and per-venue AI-onboarding gating. Seeds ONE local fixture
(qa_live_venue_fixture, local Mongo only — never the remote business backend)."""
import asyncio
import base64
import json
import os
import sys
import time

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
import venues  # noqa: E402

sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — its httpx requests to the local backend carry the signed test tag

API = "http://localhost:8001/api"
SECRET = os.environ["PULSE_SHARED_SECRET"]
SID = "qa_live_venue_fixture"
EMAIL = "delivered@resend.dev"
ADMIN = base64.b64encode(json.dumps({"user_id": "qa_admin", "role": "admin", "name": "QA Admin"}).encode()).decode()
H = {"X-Pulse-Secret": SECRET}
HA = {**H, "X-Pulse-User": ADMIN}
BASE_DOC = {
    "_id": SID, "name": "QA Live Fixture Ashram", "city": "Rishikesh", "state": "Uttarakhand", "country": "India",
    "address": "Near Lakshman Jhula bridge", "venue_type": "Retreat Centre", "capacity": 30, "best_for": ["retreats"],
    "amenities": ["Yoga hall"], "description": "A quiet riverside ashram with a large yoga hall and sattvic kitchen.",
    "website_or_maps_url": "", "photos": [], "status": "published", "submitter_email": EMAIL,
    "submitter_name": "QA Owner", "submitter_phone": "+919999000111", "history": [], "notes": [],
    "created_at": "2026-06-01T00:00:00+00:00", "updated_at": "2026-06-01T00:00:00+00:00",
}
ok = True


def check(label, cond, extra=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + label + (f"  [{extra}]" if extra else ""))


def form(doc, **over):
    p = {"venue_name": doc["name"], "city": doc["city"], "state": doc["state"], "country": doc["country"],
         "address": doc["address"], "venue_type": doc["venue_type"], "capacity": doc["capacity"],
         "best_for": doc["best_for"], "amenities": doc["amenities"], "description": doc["description"],
         "website_or_maps_url": doc["website_or_maps_url"], "submitter_name": "QA Owner", "submitter_phone": "+919999000111"}
    p.update(over)
    return p


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "nostops_web")]
    await db.venue_submissions.delete_one({"_id": SID})
    await db.venue_revisions.delete_many({"venue_id": SID})
    await db.ai_onboarding_entitlements.delete_one({"_id": SID})
    await db.ai_onboarding_orders.delete_many({"submission_id": SID})
    await db.venue_submissions.insert_one(dict(BASE_DOC))
    tok = venues._make_edit_token(SID, EMAIL, int(time.time() * 1000) + 30 * 60 * 1000)
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{API}/venues/public-submissions/by-token", params={"token": tok}, headers=H)
        check("by-token live=true", r.status_code == 200 and r.json()["submission"].get("live") is True, r.text[:120])

        # 1) minor typo fix in description → live immediately
        r = await c.post(f"{API}/venues/public-submissions/edit", headers=H, json={"token": tok, **form(BASE_DOC, description=BASE_DOC["description"].replace("quiet", "quite"))})
        check("minor edit → minor_applied", r.status_code == 200 and r.json().get("mode") == "minor_applied", r.text[:160])
        d = await db.venue_submissions.find_one({"_id": SID})
        check("minor edit applied to live doc", "quite riverside" in d["description"] and not d.get("pending_changes"))

        # 2) major change (capacity + name) → pending, live untouched
        live_before = await db.venue_submissions.find_one({"_id": SID})
        r = await c.post(f"{API}/venues/public-submissions/edit", headers=H, json={"token": tok, **form(live_before, capacity=80, venue_name="QA Live Fixture Ashram & Spa")})
        check("major edit → pending", r.status_code == 200 and r.json().get("mode") == "pending", r.text[:160])
        d = await db.venue_submissions.find_one({"_id": SID})
        check("live capacity unchanged (30)", d["capacity"] == 30 and d["name"] == "QA Live Fixture Ashram", f"cap={d['capacity']}")
        check("pending_changes stored", (d.get("pending_changes") or {}).get("fields", {}).get("capacity") == 80)
        check("status stays published", d["status"] == "published")
        r = await c.get(f"{API}/venues/public-submissions/by-token", params={"token": tok}, headers=H)
        sub = r.json()["submission"]
        check("by-token shows pending version", sub.get("capacity") == 80 and bool(sub.get("pending")))
        pub = await c.get(f"{API}/venues/published", headers=H)
        if pub.status_code == 200:
            row = next((v for v in pub.json().get("venues", []) if v.get("venue_id") == SID), None)
            check("public published feed keeps live capacity 30", row is not None and row.get("capacity") == 30, str(row)[:120] if row else "not found")

        # 3) admin sees pending + revisions, rejects then re-proposes and approves
        r = await c.get(f"{API}/venues/submissions/{SID}/revisions", headers=HA)
        revs = r.json().get("revisions", [])
        check("revisions listed (baseline+minor+proposed)", r.status_code == 200 and len(revs) >= 3, f"n={len(revs)}")
        r = await c.post(f"{API}/venues/submissions/{SID}/pending/reject", headers=HA, json={"note": "Capacity looks too high"})
        d = await db.venue_submissions.find_one({"_id": SID})
        check("reject clears pending, live unchanged", r.status_code == 200 and not d.get("pending_changes") and d["capacity"] == 30, r.text[:120])
        r = await c.post(f"{API}/venues/public-submissions/edit", headers=H, json={"token": tok, **form(d, capacity=45)})
        check("re-propose → pending", r.json().get("mode") == "pending")
        r = await c.post(f"{API}/venues/submissions/{SID}/pending/approve", headers=HA, json={"note": ""})
        d = await db.venue_submissions.find_one({"_id": SID})
        check("approve applies capacity 45", r.status_code == 200 and d["capacity"] == 45 and not d.get("pending_changes"), r.text[:120])
        r = await c.post(f"{API}/venues/submissions/{SID}/pending/approve", headers=HA, json={"note": ""})
        check("approve with nothing pending → 409", r.status_code == 409)

        # 4) restore baseline
        revs = (await c.get(f"{API}/venues/submissions/{SID}/revisions", headers=HA)).json()["revisions"]
        base = next(x for x in revs if x["action"] == "baseline")
        r = await c.post(f"{API}/venues/submissions/{SID}/revisions/{base['id']}/restore", headers=HA)
        d = await db.venue_submissions.find_one({"_id": SID})
        check("restore baseline → capacity 30 + original description", r.status_code == 200 and d["capacity"] == 30 and "quiet riverside" in d["description"], r.text[:120])
        proposed = next((x for x in revs if x["kind"] == "proposed"), None)
        if proposed:
            r = await c.post(f"{API}/venues/submissions/{SID}/revisions/{proposed['id']}/restore", headers=HA)
            check("restore proposed version refused (400)", r.status_code == 400)
        r = await c.get(f"{API}/venues/submissions/{SID}/revisions", headers={**H, "X-Pulse-User": base64.b64encode(json.dumps({"user_id": "u1", "role": "teacher"}).encode()).decode()})
        check("revisions admin-only (403 for teacher)", r.status_code == 403)

        # 5) AI onboarding gating
        r = await c.get(f"{API}/ai-onboarding/for-venue", params={"token": tok}, headers=H)
        check("for-venue resolves listing", r.status_code == 200 and r.json().get("submission_id") == SID and r.json().get("active") is False, r.text[:160])
        r = await c.get(f"{API}/ai-onboarding/for-venue", params={"token": "bad.token"}, headers=H)
        check("for-venue bad token → 400", r.status_code == 400)
        r = await c.post(f"{API}/venues/public-submissions/import-draft", headers=H, json={"token": tok})
        check("AI import blocked for unpaid venue (402)", r.status_code == 402, r.text[:120])
        r = await c.put(f"{API}/ai-onboarding/admin/{SID}/place", headers=HA, json={"place_id": "ChIJabcdefghijk"})
        check("admin cannot set Google place on unpaid venue (409)", r.status_code == 409)
        # SAFETY: creating an order hits the REAL gateway unless CASHFREE_API_BASE is the sandbox.
        # (This environment is configured with LIVE Cashfree — so this block is skipped here.)
        if "sandbox" not in os.environ.get("CASHFREE_API_BASE", ""):
            print("SKIP create-order checks — Cashfree is not the sandbox in this environment")
            r = None
        else:
            r = await c.post(f"{API}/ai-onboarding/create-order", headers=H, json={"token": tok, "region": "IN"})
            check("create-order (sandbox) for this venue", r.status_code in (200, 503, 502), f"{r.status_code} {r.text[:160]}")
        if r is not None and r.status_code == 200:
            first = r.json()
            r2 = await c.post(f"{API}/ai-onboarding/create-order", headers=H, json={"token": tok, "region": "IN"})
            check("second click re-uses the same checkout (no 2nd order)", r2.status_code == 200 and r2.json().get("order_id") == first.get("order_id") and r2.json().get("reused") is True, r2.text[:160])
        # Simulate a paid entitlement (local) → AI unlocked, double-pay refused, place settable
        await db.ai_onboarding_entitlements.update_one({"_id": SID}, {"$set": {"submission_id": SID, "active": True, "source": "qa", "order_ids": []}}, upsert=True)
        r = await c.post(f"{API}/ai-onboarding/create-order", headers=H, json={"token": tok, "region": "IN"})
        check("already-paid venue → 409 (no double pay)", r.status_code == 409, r.text[:120])
        r = await c.get(f"{API}/ai-onboarding/for-venue", params={"token": tok}, headers=H)
        check("for-venue active=true after payment", r.json().get("active") is True)
        r = await c.put(f"{API}/ai-onboarding/admin/{SID}/place", headers=HA, json={"place_id": "not a place!"})
        check("bad place id → 422", r.status_code == 422)
        r = await c.put(f"{API}/ai-onboarding/admin/{SID}/place", headers=HA, json={"place_id": "ChIJ2-NtfmwRpxQR23HBNr_vDPw"})
        check("admin confirms place on paid venue", r.status_code == 200)
        r = await c.get(f"{API}/ai-onboarding/entitlements", headers=H)
        check("entitlements list includes paid venue + place", any(v["submission_id"] == SID and v["place_id"] for v in r.json().get("venues", [])))
        r = await c.get(f"{API}/ai-onboarding/admin/{SID}", headers=HA)
        check("admin entitlement view", r.status_code == 200 and r.json().get("active") is True, r.text[:120])

    # cleanup the local QA fixture (local Mongo only)
    if "--keep" not in sys.argv:
        await db.venue_submissions.delete_one({"_id": SID})
        await db.venue_revisions.delete_many({"venue_id": SID})
        await db.ai_onboarding_entitlements.delete_one({"_id": SID})
        await db.ai_onboarding_orders.delete_many({"submission_id": SID})
    print("ALL PASS" if ok else "SOME FAILED")


asyncio.run(main())
