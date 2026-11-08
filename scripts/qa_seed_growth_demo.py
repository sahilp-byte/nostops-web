"""Seed (or clean up) the Venue Partner Growth Engine demo fixtures. Local Mongo only.

  python /app/scripts/qa_seed_growth_demo.py            # (re)seed + print toolkit links
  python /app/scripts/qa_seed_growth_demo.py --cleanup  # remove the fixtures + their events

Three venues with FIXED public codes so the preview test page (/widgets/demo) and the Venue Partners
overview always have something to show: one published with a website (vdemopage2), one still in review
(vdemopend3) and one published 15 days ago with no website (vdemoshare → its widget reminder is due).
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
import venue_growth  # noqa: E402


def _days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


BASE = {
    "state": "Uttarakhand", "country": "India", "venue_type": "Retreat Centre", "capacity": 60,
    "best_for": ["retreats", "teacher_training"], "amenities": ["Yoga shala", "Sattvic kitchen", "Forest trails"],
    "photos": [], "submitter_email": "delivered@resend.dev", "submitter_name": "QA Growth Owner",
    "submitter_phone": "", "submitter_role": "owner", "history": [], "notes": [],
    "created_at": "2026-06-01T00:00:00+00:00", "updated_at": "2026-06-01T00:00:00+00:00",
}
FIXTURES = [
    {**BASE, "_id": "qa_growth_demo_live", "growth_code": "vdemopage2", "status": "published",
     "name": "QA Growth Demo Retreat", "city": "Rishikesh", "address": "Tapovan hills",
     "description": "QA fixture: a forest retreat with a 60-person shala, used to demo the NOSTOPS venue widgets.",
     "website_or_maps_url": "https://sattvahills.example.com", "dedupe_key": "qagrowthdemoretreat|rishikesh"},
    {**BASE, "_id": "qa_growth_demo_pending", "growth_code": "vdemopend3", "status": "submitted",
     "name": "QA Growth Pending Ashram", "city": "Dharamshala", "address": "Upper Bhagsu",
     "description": "QA fixture: a venue still in review (its widget shows the general NOSTOPS invitation).",
     "website_or_maps_url": "", "dedupe_key": "qagrowthpendingashram|dharamshala"},
    # Published 15 days ago, no website, no widget → its widget reminder is DUE ("share" version).
    {**BASE, "_id": "qa_growth_demo_nosite", "growth_code": "vdemoshare", "status": "published",
     "name": "QA Growth Village Shala", "city": "Gokarna", "address": "Kudle Beach road",
     "description": "QA fixture: a published venue with no website (reminder suggests WhatsApp + posters).",
     "website_or_maps_url": "", "dedupe_key": "qagrowthvillageshala|gokarna",
     "history": [{"action": "approve-publish", "actor": "QA", "at": _days_ago(15), "from": "submitted", "to": "published"}]},
]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "nostops_web")]
    for f in FIXTURES:
        await db.venue_submissions.delete_one({"_id": f["_id"]})
        await db.venue_growth_events.delete_many({"code": f["growth_code"]})
        await db.venue_growth_reminders.delete_one({"_id": f["_id"]})
        await db.venue_growth_monthly_sends.delete_many({"venue_id": f["_id"]})
    if "--cleanup" in sys.argv:
        print("growth demo fixtures removed")
        return
    for f in FIXTURES:
        await db.venue_submissions.insert_one(dict(f))
        print(f"{f['_id']} code={f['growth_code']} status={f['status']}")
        print(f"  toolkit=/venues/submit/thank-you?k={venue_growth.make_kit_token(f['_id'])}")
    print("test_page=/widgets/demo")


asyncio.run(main())
