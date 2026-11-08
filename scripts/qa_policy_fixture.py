"""B4.8 Policy V2 QA fixture — ONE throwaway free-path empanelment case (LOCAL DB only).

Creates a case for a made-up teacher whose stored evidence meets every free-path item
(10 successful 1:1 sessions — 5 paid + verified, 5 free — 10 genuine reviews from 10 learners, 4.6★ average,
all 3★+). The case starts at "Waiting for the Council interaction", so a UI test can
record the interaction and then the final decision on /app/council/empanelment-decisions
or /app/admin/empanelment/decisions. No real teacher and no main-backend record is involved.

    python /app/scripts/qa_policy_fixture.py            # create (idempotent), prints case_id
    python /app/scripts/qa_policy_fixture.py --cleanup  # delete the case, evidence + audit rows
"""
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
from empanelment_policy import POLICY_VERSION, evaluate_free_path  # noqa: E402

DB = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "nostops_web")]
UID = "qa_fixture_policy_teacher"
TEACHER_ID = "tn_qa_fixture_policy"
NAME = "QA Policy Teacher (test case)"


def _evidence():
    sessions = [{"ref": f"oob:qa{i}", "kind": "one_on_one", "status": "session_completed", "payment_verified": i < 5,
                 "refunded": False, "amount_inr": 999 if i < 5 else 0, "learner_user_id": f"qa_learner_{i}"} for i in range(10)]
    ratings = [5, 5, 5, 4, 5, 4, 5, 4, 5, 4]
    reviews = [{"ref": f"qa_rev_{i}", "reviewer_user_id": f"qa_learner_{i}", "rating": r, "status": "published",
                "created_at": "2026-06-01T00:00:00+00:00"} for i, r in enumerate(ratings)]
    return sessions, reviews


def create() -> str:
    found = DB.empanelment_policy_cases.find_one({"teacher_user_id": UID}, {"case_id": 1})
    if found:
        return found["case_id"]
    now = datetime.now(timezone.utc).isoformat()
    sessions, reviews = _evidence()
    ev = evaluate_free_path(UID, sessions, reviews)
    assert ev["merit_met"], ev
    DB.empanelment_policy_evidence.update_one({"teacher_user_id": UID}, {"$set": {
        "teacher_user_id": UID, "teacher_id": TEACHER_ID, "handle": "qa-policy-teacher", "name": NAME,
        "sessions": sessions, "reviews": reviews, "evaluation": ev, "observed_at": now}}, upsert=True)
    cid = f"epc_{uuid.uuid4().hex[:12]}"
    DB.empanelment_policy_cases.insert_one({
        "case_id": cid, "path": "FREE", "policy_version": POLICY_VERSION, "teacher_user_id": UID,
        "teacher_id": TEACHER_ID, "handle": "qa-policy-teacher", "name": NAME, "status": "AWAITING_COUNCIL_INTERACTION",
        "evidence_at_application": {"evaluation": ev, "observed_at": now}, "interactions": [], "decisions": [],
        "created_at": now, "updated_at": now, "qa_fixture": True})
    DB.empanelment_policy_audit.insert_one({"case_id": cid, "event": "CASE_OPENED", "at": now, "actor_id": UID,
                                            "actor": NAME, "actor_role": "teacher", "policy_version": POLICY_VERSION,
                                            "detail": "QA fixture for Policy V2 UI testing."})
    return cid


def cleanup() -> int:
    ids = [c["case_id"] for c in DB.empanelment_policy_cases.find({"teacher_user_id": UID}, {"case_id": 1})]
    DB.empanelment_policy_audit.delete_many({"case_id": {"$in": ids}})
    DB.empanelment_policy_cases.delete_many({"case_id": {"$in": ids}})
    DB.empanelment_policy_evidence.delete_many({"teacher_user_id": UID})
    return len(ids)


if __name__ == "__main__":
    if "--cleanup" in sys.argv:
        print(f"removed {cleanup()} QA policy case(s)")
    else:
        print(create())
