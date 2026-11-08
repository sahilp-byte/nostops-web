"""
Remove QA / test records from the PREVIEW institutional database (B2.3).

Deletes test events, organisations and everything hanging off them — sessions,
sign-ups (registrations), teacher offers (assignments), event SEO rows,
attendance, feedback and org memberships — while KEEPING:
  • the demonstration showcase (is_demo_seeded orgs + events), and
  • the fixed records the automated tests rely on (FIXTURE_* below).

Safety: refuses to run against anything but a local MongoDB (the preview), dry
run by default, and writes every deleted document to a gzip backup first.
Re-run after a regression run to clear the records the tests create again.

    python scripts/cleanup_preview_test_data.py            # dry run (counts only)
    python scripts/cleanup_preview_test_data.py --apply    # backup + delete
"""
import datetime as dt
import gzip
import os
import sys
from urllib.parse import urlparse

from bson import json_util
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")

# Hard-coded by the automated suites (see backend/tests + backend/test_governance_flow.py).
FIXTURE_EVENTS = {"NOSTOPS-EVT-2026-000001", "NOSTOPS-EVT-2026-000002", "NOSTOPS-EVT-TEST-PAST1"}
FIXTURE_ORGS = {"NOSTOPS-ORG-2026-000001", "NOSTOPS-ORG-2026-000002"}

EVENT_CHILDREN = ["inst_event_sessions", "inst_registrations", "inst_teacher_assignments",
                  "inst_event_seo", "inst_attendance", "inst_feedback", "inst_teacher_feedback"]
BACKUP_DIR = "/app/memory/backups"


def main(apply: bool) -> None:
    url = os.environ["MONGO_URL"]
    if (urlparse(url).hostname or "") not in {"localhost", "127.0.0.1"}:
        sys.exit(f"Refusing to run: MONGO_URL is not the local preview database ({urlparse(url).hostname}).")
    db = MongoClient(url)[os.environ["DB_NAME"]]

    keep_events = {e["event_id"] for e in db.inst_events.find(
        {"$or": [{"is_demo_seeded": True}, {"event_id": {"$in": list(FIXTURE_EVENTS)}}]}, {"event_id": 1})}
    keep_orgs = {o["organisation_id"] for o in db.inst_organisations.find(
        {"$or": [{"is_demo_seeded": True}, {"organisation_id": {"$in": list(FIXTURE_ORGS)}}]},
        {"organisation_id": 1})}
    # Never orphan a kept event: keep its organisation too.
    keep_orgs |= {e["organisation_id"] for e in db.inst_events.find(
        {"event_id": {"$in": list(keep_events)}}, {"organisation_id": 1}) if e.get("organisation_id")}

    plan = {
        "inst_events": {"event_id": {"$nin": list(keep_events)}},
        "inst_organisations": {"organisation_id": {"$nin": list(keep_orgs)}},
        "inst_org_members": {"organisation_id": {"$nin": list(keep_orgs)}},
        **{c: {"event_id": {"$nin": list(keep_events)}} for c in EVENT_CHILDREN},
    }
    print(f"Keeping {len(keep_events)} events and {len(keep_orgs)} organisations (demo showcase + test fixtures).")
    counts = {c: db[c].count_documents(q) for c, q in plan.items()}
    for c, n in counts.items():
        print(f"  {c:<28} delete {n:>5} of {db[c].count_documents({}):>5}")
    if not apply:
        print("Dry run — nothing deleted. Re-run with --apply.")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    path = f"{BACKUP_DIR}/preview_cleanup_{dt.datetime.utcnow():%Y%m%dT%H%M%SZ}.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        fh.write(json_util.dumps({c: list(db[c].find(q)) for c, q in plan.items()}))
    print(f"Backup written: {path}")
    for c, q in plan.items():
        print(f"  {c:<28} deleted {db[c].delete_many(q).deleted_count}")


if __name__ == "__main__":
    main("--apply" in sys.argv)
