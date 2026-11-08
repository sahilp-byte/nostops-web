"""B4.8 — Council / admin TRUST REVIEW queue + the free-empanelment policy config.

Exception cases are teachers whom the MAIN backend lists as empanelled while their
identity check has NOT passed (B4.7 found eight). The empanelment record lives on
the main backend and is never changed from here. This module only:

  * opens one review case per exception (observation, never a change);
  * lets an authorised reviewer (admin or Council guru) record an explicit,
    reasoned decision — CONFIRM, SUSPEND or REVOKE — with reviewer, timestamp,
    reason and resulting status in an append-only audit trail;
  * tells the website which handles have empanelment WITHDRAWN (suspended or
    revoked) so our pages and matching stop showing / using "Empanelled"
    (owner decision: "Record it and update our website").

Nothing is auto-confirmed, auto-revoked or deleted. Cases stay PENDING_REVIEW
until a reviewer decides. Only minimum review information is stored: no identity
documents, contact details, PAN/Aadhaar/bank data.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from institutional import current_user, require_secret

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
REMOTE = (os.environ.get("BACKEND_ORIGIN") or "https://pro-learn-connect-1.emergent.host").rstrip("/")

_db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
cases = _db.trust_review_cases
audit = _db.trust_review_audit

router = APIRouter(prefix="/api/trust", tags=["trust-review"])

REVIEWER_ROLES = {"admin", "council", "guru"}
PENDING, CONFIRMED, SUSPENDED, REVOKED = "PENDING_REVIEW", "CONFIRMED", "SUSPENDED", "REVOKED"
ACTION_TO_STATUS = {"CONFIRM": CONFIRMED, "SUSPEND": SUSPENDED, "REVOKE": REVOKED}
WITHDRAWN = {SUSPENDED, REVOKED}
STATUS_LABELS = {
    PENDING: "Pending Council review",
    CONFIRMED: "Empanelment confirmed by review (identity check still required for ✓ Verified)",
    SUSPENDED: "Empanelment suspended pending review",
    REVOKED: "Empanelment revoked after review",
}
EXCEPTION_REASON = "EMPANELLED_WITHOUT_PASSED_ID_CHECK"

# ── Free-empanelment policy — ONE configurable source (B4.8) ──────────────────
# The PROPOSED rule is recorded here but NOT enforced and NOT used for eligibility
# until the product owner explicitly approves it. Frontend reads this; it never
# hard-codes its own thresholds.
FREE_EMPANELMENT_POLICY = {
    "status": "AWAITING_OWNER_APPROVAL",
    "enforced": False,
    "council_application_enabled": False,
    "proposed": {"min_one_on_one_sessions": 5, "min_avg_rating": 4.5, "min_genuine_reviews": 10,
                 "then": "APPLICATION_TO_COUNCIL_OF_YOGA_GURUS"},
    "conflicting_sources": [
        {"where": "main backend /teachers/me/empanelment-progress", "rule": "5 paid sessions + 4.0★ average"},
        {"where": "main backend /teachers/me/onboarding-state", "rule": "free_track_min_sessions 5 + free_track_min_rating 4.0"},
        {"where": "main backend /empanelment/fast-track/offer alt_path", "rule": "5 successful 1:1 sessions + majority positive reviews"},
        {"where": "website /app/teacher/empanelment steps", "rule": "5 classes or 1:1 sessions with genuine positive feedback, then Council interaction"},
        {"where": "website LevelUpGuide", "rule": "student ratings ≥ 4.5★"},
        {"where": "local verification engine (empanelment rules)", "rule": "thresholds unset — treated as PASS"},
    ],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def reviewer_user(user: dict = Depends(current_user)) -> dict:
    """Role check as a dependency, so a non-reviewer gets 403 before body validation."""
    if user.get("role") not in REVIEWER_ROLES:
        raise HTTPException(status_code=403, detail="admin_or_council_only")
    return user


def _snapshot(t: dict) -> dict:
    """Minimum review information — status flags only, never documents or contacts."""
    cert = t.get("empanelment_cert") or {}
    return {
        "id_check": "PASSED" if t.get("kyc_verified") is True else "NOT_PASSED",
        "empanelled_on_main_backend": t.get("is_empanelled") is True,
        "empanelment_path": t.get("empanelment_path"),
        "empanelment_updated_at": t.get("empanelment_updated_at"),
        "empanelment_certificate_on_record": bool(cert),
        "level_badge": t.get("badge_primary"),
        "tier": t.get("tier"),
        "observed_at": _now(),
    }


async def _live_directory() -> list:
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{REMOTE}/api/teachers/directory", params={"limit": 1000})
        r.raise_for_status()
        return (r.json() or {}).get("teachers") or []


async def sync_cases() -> int:
    """Open a PENDING case for every live exception (idempotent). Existing cases only
    get a fresh observation snapshot — their status / decisions are never touched."""
    try:
        teachers = await _live_directory()
    except Exception:
        return 0  # read failed — keep the stored queue as it is
    opened = 0
    known = {c["teacher_id"] for c in await cases.find({}, {"teacher_id": 1}).to_list(5000)}
    for t in teachers:
        tid = t.get("teacher_id")
        is_exception = t.get("is_empanelled") is True and t.get("kyc_verified") is not True
        # New exceptions open a case; teachers with a case always get a fresh
        # snapshot (e.g. an ID check passed later), never a status change.
        if not tid or (not is_exception and tid not in known):
            continue
        now = _now()
        res = await cases.update_one(
            {"teacher_id": tid},
            {"$set": {"snapshot": _snapshot(t), "handle": t.get("handle"), "name": t.get("name"), "city": t.get("city"),
                      "country": t.get("country")},
             "$setOnInsert": {"case_id": f"trc_{uuid.uuid4().hex[:12]}", "teacher_id": tid, "status": PENDING,
                              "exception": EXCEPTION_REASON, "created_at": now, "decisions": []}},
            upsert=True)
        if res.upserted_id is not None:
            opened += 1
            doc = await cases.find_one({"teacher_id": tid}, {"case_id": 1})
            await audit.insert_one({"case_id": doc["case_id"], "event": "CASE_OPENED", "at": now,
                                    "actor": "system", "detail": "Empanelled on the main backend without a passed ID check."})
    return opened


def _public_case(c: dict, trail: list) -> dict:
    return {
        "case_id": c["case_id"], "teacher_id": c["teacher_id"], "handle": c.get("handle"), "name": c.get("name"),
        "city": c.get("city"), "country": c.get("country"), "exception": c.get("exception"),
        "status": c["status"], "status_label": STATUS_LABELS.get(c["status"], c["status"]),
        "snapshot": c.get("snapshot") or {}, "decisions": c.get("decisions") or [],
        "created_at": c.get("created_at"),
        "audit": [{k: a.get(k) for k in ("event", "at", "actor", "actor_role", "detail")} for a in trail],
    }


@router.get("/review/cases")
async def list_cases(user: dict = Depends(reviewer_user)) -> dict:
    await sync_cases()
    out = []
    async for c in cases.find({}, {"_id": 0}).sort("created_at", 1):
        trail = await audit.find({"case_id": c["case_id"]}, {"_id": 0}).sort("at", 1).to_list(200)
        out.append(_public_case(c, trail))
    pending = sum(1 for c in out if c["status"] == PENDING)
    return {"cases": out, "count": len(out), "pending_count": pending,
            "note": "Identity documents are never shown here. Decisions change the website only; "
                    "the main backend record is updated by its own team."}


class DecisionIn(BaseModel):
    action: Literal["CONFIRM", "SUSPEND", "REVOKE"]
    reason: str = Field(min_length=15, max_length=1000)
    confirm: bool


@router.post("/review/cases/{case_id}/decision")
async def decide(case_id: str, body: DecisionIn, user: dict = Depends(reviewer_user)) -> dict:
    if body.confirm is not True:
        raise HTTPException(status_code=400, detail="explicit_confirmation_required")
    c = await cases.find_one({"case_id": case_id})
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")
    status = ACTION_TO_STATUS[body.action]
    now = _now()
    decision = {"decision_id": f"trd_{uuid.uuid4().hex[:12]}", "action": body.action, "resulting_status": status,
                "previous_status": c["status"], "reason": body.reason.strip(), "decided_at": now,
                "reviewer_id": str(user.get("user_id")), "reviewer_name": str(user.get("name") or "")[:120],
                "reviewer_role": user.get("role")}
    await cases.update_one({"case_id": case_id}, {"$set": {"status": status, "updated_at": now},
                                                   "$push": {"decisions": decision}})
    await audit.insert_one({"case_id": case_id, "event": f"DECISION_{body.action}", "at": now,
                            "actor": decision["reviewer_name"] or decision["reviewer_id"],
                            "actor_id": decision["reviewer_id"], "actor_role": user.get("role"),
                            "detail": f"{c['status']} → {status}: {decision['reason']}"})
    return {"ok": True, "case_id": case_id, "status": status, "decision": decision}


@router.get("/public/withdrawn")
async def withdrawn(_: bool = Depends(require_secret)) -> dict:
    """Server-to-server only: handles whose empanelment a reviewer suspended/revoked."""
    rows = await cases.find({"status": {"$in": list(WITHDRAWN)}}, {"handle": 1, "status": 1}).to_list(1000)
    return {"handles": [r["handle"] for r in rows if r.get("handle")]}


async def withdrawn_handles() -> set:
    rows = await cases.find({"status": {"$in": list(WITHDRAWN)}}, {"handle": 1}).to_list(1000)
    return {r["handle"] for r in rows if r.get("handle")}


REVIEWER_LABELS = {"admin": "NOSTOPS admin", "council": "Council of Yoga Gurus", "guru": "Council of Yoga Gurus"}


@router.get("/me")
async def my_case(handle: Optional[str] = Query(None, max_length=120), user: dict = Depends(current_user)) -> dict:
    """The teacher's OWN case (handle is supplied by the server from the teacher's own
    record, never by the browser). Owner decision (B4.8): the teacher sees the status
    plus the reviewer's own note — never the reviewer's name or id."""
    if not handle:
        return {"case": None}
    c = await cases.find_one({"handle": handle}, {"status": 1, "decisions": 1, "created_at": 1})
    if not c:
        return {"case": None}
    last = (c.get("decisions") or [None])[-1]
    return {"case": {
        "status": c["status"], "status_label": STATUS_LABELS.get(c["status"], c["status"]),
        "opened_at": c.get("created_at"),
        "note": last.get("reason") if last else None,
        "decided_at": last.get("decided_at") if last else None,
        "decided_by": REVIEWER_LABELS.get(str(last.get("reviewer_role") or ""), "NOSTOPS") if last else None,
    }}


@router.get("/policy")
async def policy(_: bool = Depends(require_secret)) -> dict:
    from empanelment_policy import POLICY  # founder-approved Policy V2 supersedes the B4.8 proposal
    return {"free_empanelment": {**FREE_EMPANELMENT_POLICY, "status": "SUPERSEDED_BY_POLICY_V2",
                                 "enforced": False, "approved_policy": POLICY}}
