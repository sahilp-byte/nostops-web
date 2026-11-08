"""Preview-only cleanup of leftover Special Needs QA fixtures (Phase B1.1).

Older runs of tests/test_special_needs_pathway.py (before its run-scoped cleanup
existed) left QA teachers, organisations and events in the preview database. This
script backs every matching record up to /app/memory/backups/ and then deletes
exactly those records. It aborts without deleting if any QA teacher is linked to a
non-QA event. Never run against production.

Usage: python cleanup_qa_sn_fixtures.py [--dry-run]
"""
import json
import os
import sys
from datetime import datetime, timezone

from bson import json_util
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
BACKUP_DIR = "/app/memory/backups"


def main(dry_run: bool) -> None:
    evs = [e["event_id"] for e in DB.inst_events.find({"title": {"$regex": "^QA SN pathway [0-9a-f]{6}$"}}, {"event_id": 1})]
    orgs = [o["organisation_id"] for o in DB.inst_organisations.find(
        {"contact_email": "people@qa-sn.example", "name": {"$regex": "^QA SN [A-Z_]+ [0-9a-f]{6}$"}}, {"organisation_id": 1})]
    tids = [t["teacher_id"] for t in DB.inst_teacher_directory.find(
        {"teacher_id": {"$regex": "^qa_sn_[a-z_]+_[0-9a-f]{6}$"}, "qa_fixture": True}, {"teacher_id": 1})]

    # Safety: QA teachers must not be linked to any real (non-QA) event.
    foreign = DB.inst_teacher_assignments.count_documents({"teacher_id": {"$in": tids}, "event_id": {"$nin": evs}})
    foreign += DB.inst_events.count_documents({"assigned_teacher.teacher_id": {"$in": tids}, "event_id": {"$nin": evs}})
    foreign += DB.inst_events.count_documents({"event_id": {"$in": evs}, "organisation_id": {"$nin": orgs}})
    if foreign:
        sys.exit(f"ABORT: {foreign} QA records are linked to non-QA data — nothing deleted.")

    plan = {
        "inst_teacher_assignments": {"event_id": {"$in": evs}},
        "inst_event_seo": {"event_id": {"$in": evs}},
        "inst_events": {"event_id": {"$in": evs}},
        "inst_org_members": {"organisation_id": {"$in": orgs}},
        "inst_organisations": {"organisation_id": {"$in": orgs}},
        "inst_teacher_directory": {"teacher_id": {"$in": tids}},
    }
    backup = {c: list(DB[c].find(q)) for c, q in plan.items()}
    print({c: len(v) for c, v in backup.items()})
    if dry_run:
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    path = f"{BACKUP_DIR}/b11_qa_sn_cleanup_{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json"
    with open(path, "w") as f:
        f.write(json_util.dumps(backup, indent=1))
    with open(path) as f:  # verify the backup is readable before deleting anything
        assert {c: len(v) for c, v in json_util.loads(f.read()).items()} == {c: len(v) for c, v in backup.items()}
    print("backup:", path)
    for c, q in plan.items():
        print(c, "deleted", DB[c].delete_many(q).deleted_count)


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
