"""Seed (or clean up) ONE local QA fixture for UI testing of live-venue edits.
Local Mongo only — never the remote business backend.

  python /app/scripts/qa_seed_live_venue.py            # (re)seed + print a fresh 45-min edit token
  python /app/scripts/qa_seed_live_venue.py --cleanup  # remove the fixture + its versions/orders
"""
import asyncio
import os
import sys
import time

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
import venues  # noqa: E402

SID = "qa_live_venue_fixture"
EMAIL = "delivered@resend.dev"
DOC = {
    "_id": SID, "name": "QA Live Fixture Ashram", "city": "Rishikesh", "state": "Uttarakhand", "country": "India",
    "address": "Near Lakshman Jhula bridge", "venue_type": "Retreat Centre", "capacity": 30, "best_for": ["retreats"],
    "amenities": ["Yoga hall"], "description": "A quiet riverside ashram with a large yoga hall and sattvic kitchen.",
    "website_or_maps_url": "", "photos": [], "status": "published", "submitter_email": EMAIL,
    "submitter_name": "QA Owner", "submitter_phone": "+919999000111", "submitter_role": "owner", "history": [], "notes": [],
    "dedupe_key": "qaLiveFixtureAshram|rishikesh",
    "created_at": "2026-06-01T00:00:00+00:00", "updated_at": "2026-06-01T00:00:00+00:00",
}


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "nostops_web")]
    await db.venue_submissions.delete_one({"_id": SID})
    await db.venue_revisions.delete_many({"venue_id": SID})
    await db.ai_onboarding_entitlements.delete_one({"_id": SID})
    await db.ai_onboarding_orders.delete_many({"submission_id": SID})
    if "--cleanup" in sys.argv:
        print("fixture removed")
        return
    await db.venue_submissions.insert_one(dict(DOC))
    tok = venues._make_edit_token(SID, EMAIL, int(time.time() * 1000) + 45 * 60 * 1000)
    print(f"submission_id={SID}")
    print(f"token={tok}")
    print(f"owner_edit_path=/venues/submit/edit?token={tok}")
    print(f"ai_onboarding_path=/venues/ai-onboarding?token={tok}")
    print(f"admin_review_path=/app/admin/venue-review/{SID}")


asyncio.run(main())
