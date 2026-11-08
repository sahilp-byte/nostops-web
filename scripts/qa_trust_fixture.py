"""B4.8 QA fixture — ONE throwaway trust-review case for UI testing (LOCAL DB only).

The eight REAL exception cases must only be decided by people, so UI tests record
decisions on this fixture instead. It belongs to the QA teacher
qa.shikshak.l1@nostopsqa.com (handle drishti-ladies-yoga-classes-pune), so signing in
as that teacher shows the decision + reviewer note on their Trust checklist.

    python /app/scripts/qa_trust_fixture.py            # create (idempotent), prints case_id
    python /app/scripts/qa_trust_fixture.py --cleanup  # delete the case + its audit rows
"""
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
DB = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "nostops_web")]
HANDLE = "drishti-ladies-yoga-classes-pune"
TEACHER_ID = "qa_fixture_drishti"


def create() -> str:
    found = DB.trust_review_cases.find_one({"teacher_id": TEACHER_ID}, {"case_id": 1})
    if found:
        return found["case_id"]
    cid = f"trc_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    DB.trust_review_cases.insert_one({
        "case_id": cid, "teacher_id": TEACHER_ID, "handle": HANDLE, "name": "QA Drishti (test case)",
        "city": "Pune", "country": "India", "status": "PENDING_REVIEW", "exception": "QA_FIXTURE",
        "created_at": now, "decisions": [],
        "snapshot": {"id_check": "NOT_PASSED", "empanelled_on_main_backend": True, "empanelment_path": "qa",
                     "empanelment_certificate_on_record": False, "level_badge": "Yoga Pracharak", "observed_at": now},
    })
    DB.trust_review_audit.insert_one({"case_id": cid, "event": "CASE_OPENED", "at": now, "actor": "qa_fixture",
                                      "detail": "QA fixture for B4.8 UI testing."})
    return cid


def cleanup() -> int:
    ids = [c["case_id"] for c in DB.trust_review_cases.find({"teacher_id": TEACHER_ID}, {"case_id": 1})]
    DB.trust_review_audit.delete_many({"case_id": {"$in": ids}})
    DB.trust_review_cases.delete_many({"case_id": {"$in": ids}})
    return len(ids)


if __name__ == "__main__":
    if "--cleanup" in sys.argv:
        print(f"removed {cleanup()} QA trust case(s)")
    else:
        print(create())
