"""NOSTOPS Empanelment Policy V2 — founder-approved (B4.8 policy finalisation, 2026-06).

ONE source of truth for empanelment eligibility in this workspace. Nothing here
changes the main backend's teacher record by itself; it decides who MAY be
empanelled and records the people who decided and activated.

FREE / MERIT PATH — every item is required:
  1. >= 5 SUCCESSFUL 1:1 sessions through NOSTOPS (status `session_completed` /
     `completed`). B4.8 final alignment: the founder approved "five successful
     sessions" but has NOT approved a paid-only rule, so free sessions count
     (REQUIRE_PAID_SESSIONS = False, awaiting a founder decision). A session that
     involved a payment counts only once the MAIN BACKEND recorded that payment;
     refunded sessions, mock-card payments and sessions with yourself never count.
  2. >= 10 genuine NOSTOPS reviews: at most ONE per learner (their latest), only
     from a learner with a successful NOSTOPS session with this teacher, never the
     teacher's own, never unpublished, never from outside NOSTOPS.
  3. average of the counted reviews >= 3.5★
  4. MORE THAN HALF of the counted reviews positive (positive = 3★ or more)
  5. a completed Council interaction, recorded by a Council guru or admin
  6. an explicit final decision by a Council guru or NOSTOPS admin
  7. (B4.8 final alignment) a separate ACTIVATION by a NOSTOPS admin who checked
     the recorded approval. Activation never replaces or changes the decision.

FAST-TRACK — ₹4,999 buys a PRIORITY 30–45 min peer-review interview only. The
interview is the Council interaction; a Council guru / admin then decides on
merit; an admin activates. Payment never approves anything, never grants a badge.

"Not approved" before the Council interaction needs a documented reason from a
fixed list (never "incomplete progress") and is always a person's decision.

No review is fabricated, imported, duplicated or generated here: reviews are only
READ from the main backend and counted.
"""
import os
import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from institutional import current_user, require_secret

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
_db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
evidence_col = _db.empanelment_policy_evidence  # latest evidence snapshot per teacher
cases = _db.empanelment_policy_cases
audit = _db.empanelment_policy_audit

router = APIRouter(prefix="/api/empanelment-policy", tags=["empanelment-policy"])

POLICY_VERSION = "EMPANELMENT_POLICY_V2_2026_06"
DECISION_ROLES = {"admin", "council", "guru"}
ACTIVATION_ROLES = {"admin"}
COMPLETED_STATUSES = {"session_completed", "completed"}
IST = timezone(timedelta(hours=5, minutes=30))

MIN_SUCCESSFUL_SESSIONS = 5
MIN_GENUINE_REVIEWS = 10
MIN_AVG_RATING = 3.5
POSITIVE_MIN_STARS = 3
# Founder has NOT approved a paid-only rule. Keep False until an explicit decision.
REQUIRE_PAID_SESSIONS = False
PAID_ONLY_STATUS = "AWAITING_FOUNDER_DECISION"

FREE, FAST_TRACK = "FREE", "FAST_TRACK"
AWAITING_INTERACTION, AWAITING_DECISION = "AWAITING_COUNCIL_INTERACTION", "AWAITING_DECISION"
APPROVED, NOT_APPROVED, ACTIVATED = "APPROVED", "NOT_APPROVED", "ACTIVATED"
OPEN = {AWAITING_INTERACTION, AWAITING_DECISION}
APPROVAL_STATES = {APPROVED, ACTIVATED}
STATUS_LABELS = {
    AWAITING_INTERACTION: "Waiting for your Council interaction",
    AWAITING_DECISION: "Council interaction done, waiting for the final decision",
    APPROVED: "Approved by the Council · waiting for admin activation",
    ACTIVATED: "Empanelled · activated by an admin",
    NOT_APPROVED: "Not approved this time",
}
REVIEWER_LABELS = {"admin": "NOSTOPS admin", "council": "Council of Yoga Gurus", "guru": "Council of Yoga Gurus"}

# Documented reasons that allow "Not approved" BEFORE the Council interaction.
# Incomplete progress is deliberately NOT a reason: the teacher simply keeps going.
DECLINE_REASONS = {
    "FALSE_EVIDENCE": "False or copied evidence or credentials",
    "SAFETY_CONDUCT": "Safety or conduct concern",
    "TEACHER_WITHDREW": "Teacher asked to withdraw",
    "DUPLICATE_ACCOUNT": "Duplicate or wrong account",
}
MERIT_DECISION = "MERIT_DECISION"  # "Not approved" after the interaction = a merit decision

POLICY = {
    "version": POLICY_VERSION,
    "status": "FOUNDER_APPROVED",
    "free_path": {
        "min_successful_one_on_one_sessions": MIN_SUCCESSFUL_SESSIONS,
        "paid_only": {"enforced": REQUIRE_PAID_SESSIONS, "status": PAID_ONLY_STATUS},
        "paid_session_counts_only_after_main_backend_verified_payment": True,
        "refunded_sessions_count": False,
        "min_genuine_reviews": MIN_GENUINE_REVIEWS,
        "reviews_per_learner": 1,
        "review_counts_only_if_learner_completed_a_session": True,
        "min_avg_rating": MIN_AVG_RATING,
        "positive_review_min_stars": POSITIVE_MIN_STARS,
        "majority_positive": "MORE_THAN_HALF",
        "council_interaction_required": True,
        "final_decision_by": sorted(DECISION_ROLES),
        "activation_by": sorted(ACTIVATION_ROLES),
    },
    "fast_track": {
        "fee_inr": 4999,
        "interview_minutes": "30–45",
        "payment_buys": "PRIORITY_REVIEW_ONLY",
        "payment_guarantees_approval": False,
        "payment_grants_badge": False,
        "council_interaction": "THE_PRIORITY_INTERVIEW",
        "merit_thresholds_apply": False,
        "final_decision_by": sorted(DECISION_ROLES),
        "activation_by": sorted(ACTIVATION_ROLES),
    },
    "not_approved_before_interaction": {"reason_required": True, "allowed_reasons": DECLINE_REASONS,
                                        "incomplete_progress_is_a_reason": False},
    "never_grants_empanelment_automatically": ["KYC", "session completion", "payment", "institutional booking", "rating"],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Pure evaluators (unit-tested) ─────────────────────────────────────────────
def _session_counts(s: dict) -> Optional[str]:
    """None when the (completed, non-duplicate, not-self) session counts, else the reason key."""
    if s.get("refunded") is True:
        return "refunded_sessions"
    if float(s.get("amount_inr") or 0) > 0 and s.get("payment_verified") is not True:
        return "payment_not_verified"
    return None


def evaluate_free_path(teacher_user_id: str, sessions: list, reviews: list) -> dict:
    """Score the free path from main-backend facts. Deterministic, no I/O."""
    me = str(teacher_user_id or "")
    excluded: Counter = Counter()
    seen: set = set()
    counted = free_counted = 0
    learners_with_completed_session: set = set()

    for s in sessions:
        ref = str(s.get("ref") or "")
        if not ref or ref in seen:
            excluded["duplicate_session_records"] += 1
            continue
        seen.add(ref)
        learner = str(s.get("learner_user_id") or "")
        if learner and learner == me:
            excluded["sessions_with_yourself"] += 1
            continue
        if str(s.get("status") or "").lower() not in COMPLETED_STATUSES:
            excluded["sessions_not_completed"] += 1
            continue
        why = _session_counts(s)
        if why:
            excluded[why] += 1
            continue
        if learner:
            learners_with_completed_session.add(learner)
        if s.get("kind") != "one_on_one":
            excluded["not_one_on_one_sessions"] += 1
            continue
        is_free = float(s.get("amount_inr") or 0) <= 0
        if is_free and REQUIRE_PAID_SESSIONS:
            excluded["free_sessions"] += 1
            continue
        counted += 1
        free_counted += 1 if is_free else 0

    latest: dict = {}
    for r in sorted(reviews, key=lambda x: str(x.get("created_at") or "")):
        uid = str(r.get("reviewer_user_id") or "")
        rating = r.get("rating")
        if str(r.get("status") or "").lower() != "published":
            excluded["reviews_not_published"] += 1
        elif isinstance(rating, bool) or not isinstance(rating, (int, float)) or not 1 <= rating <= 5:
            excluded["reviews_without_valid_rating"] += 1
        elif not uid:
            excluded["reviews_without_learner_account"] += 1
        elif uid == me:
            excluded["reviews_by_yourself"] += 1
        elif uid not in learners_with_completed_session:
            excluded["reviews_without_completed_session"] += 1
        else:
            if uid in latest:
                excluded["extra_reviews_from_same_learner"] += 1
            latest[uid] = float(rating)

    ratings = list(latest.values())
    n = len(ratings)
    positive = sum(1 for x in ratings if x >= POSITIVE_MIN_STARS)
    avg = sum(ratings) / n if n else 0.0
    requirements = [
        {"key": "successful_sessions", "label": "Successful (completed) 1:1 sessions", "value": counted,
         "target": MIN_SUCCESSFUL_SESSIONS, "met": counted >= MIN_SUCCESSFUL_SESSIONS},
        {"key": "genuine_reviews", "label": "Genuine reviews from different learners", "value": n,
         "target": MIN_GENUINE_REVIEWS, "met": n >= MIN_GENUINE_REVIEWS},
        {"key": "avg_rating", "label": "Average rating", "value": round(avg, 2), "target": MIN_AVG_RATING,
         "met": n > 0 and avg >= MIN_AVG_RATING},
        {"key": "majority_positive", "label": "Positive reviews (3★ or more)", "value": positive, "of": n,
         "target": "more than half", "met": n > 0 and positive * 2 > n},
    ]
    return {
        "policy_version": POLICY_VERSION,
        "path": FREE,
        "requirements": requirements,
        "merit_met": all(r["met"] for r in requirements),
        "excluded": dict(excluded),
        "free_sessions_counted": free_counted,
        "paid_only_enforced": REQUIRE_PAID_SESSIONS,
        "learners_with_completed_session": len(learners_with_completed_session),
    }


def transition(case: dict, event: str) -> str:
    """The ONLY allowed decision moves. Raises 409 on anything else."""
    status = case.get("status")
    if status not in OPEN:
        raise HTTPException(status_code=409, detail="case_closed")
    if event == "INTERACTION":
        if status != AWAITING_INTERACTION:
            raise HTTPException(status_code=409, detail="interaction_already_recorded")
        return AWAITING_DECISION
    if event == "APPROVE":
        if status != AWAITING_DECISION or not case.get("interactions"):
            raise HTTPException(status_code=409, detail="council_interaction_required")
        return APPROVED
    if event == "DECLINE":
        return NOT_APPROVED
    raise HTTPException(status_code=400, detail="unknown_event")


def decline_reason(interaction_done: bool, reason: Optional[str]) -> str:
    """'Not approved' before the interaction needs a documented reason from the list;
    afterwards it is a merit decision (a listed reason may still be given)."""
    if reason is not None and reason not in DECLINE_REASONS and reason != MERIT_DECISION:
        raise HTTPException(status_code=422, detail="unknown_reason")
    if not interaction_done:
        if reason not in DECLINE_REASONS:
            raise HTTPException(status_code=422, detail="documented_reason_required")
        return reason
    return reason or MERIT_DECISION


def approval_on_record(case: dict) -> dict:
    """The recorded approval an admin must check before activating (409 if missing)."""
    last = (case.get("decisions") or [None])[-1]
    if (case.get("status") not in APPROVAL_STATES or not last or last.get("outcome") != "APPROVE"
            or last.get("reviewer_role") not in DECISION_ROLES or not last.get("reviewer_id")
            or not case.get("interactions")):
        raise HTTPException(status_code=409, detail="approval_required")
    return last


def classify_existing(teacher_user_id: Optional[str], reviews: Optional[list], sessions: Optional[list],
                      v2_status: Optional[str]) -> dict:
    """READ-ONLY compliance view of an already-empanelled teacher. Never changes
    anything. `sessions is None` = the main backend does not expose them to us."""
    if v2_status in APPROVAL_STATES:
        return {"category": "POLICY_V2", "approval": "POLICY_V2", "items": None,
                "note": "Approved under Policy V2 (Council interaction + explicit decision on record)."}
    items: dict = {}
    if reviews is None:
        return {"category": "INSUFFICIENT_EVIDENCE", "approval": "LEGACY", "items": None,
                "note": "No public review record could be read for this teacher."}
    if sessions is not None:
        ev = evaluate_free_path(teacher_user_id or "", sessions, reviews)
        items = {r["key"]: r for r in ev["requirements"]}
        if ev["merit_met"]:
            return {"category": "MEETS_CRITERIA", "approval": "LEGACY", "items": items,
                    "note": "Every numeric item is met. No V2 Council interaction is on record (legacy approval)."}
    # Without session data, completed-session checks cannot be made: count published
    # reviews from distinct NOSTOPS accounts as an UPPER bound.
    me = str(teacher_user_id or "")
    latest: dict = {}
    for r in sorted(reviews, key=lambda x: str(x.get("created_at") or "")):
        uid, rating = str(r.get("reviewer_user_id") or ""), r.get("rating")
        if (str(r.get("status") or "").lower() == "published" and uid and uid != me
                and not isinstance(rating, bool) and isinstance(rating, (int, float)) and 1 <= rating <= 5):
            latest[uid] = float(rating)
    vals = list(latest.values())
    n = len(vals)
    avg = round(sum(vals) / n, 2) if n else 0.0
    positive = sum(1 for x in vals if x >= POSITIVE_MIN_STARS)
    if not items:
        items = {
            "successful_sessions": {"value": None, "target": MIN_SUCCESSFUL_SESSIONS, "met": None},
            "genuine_reviews": {"value": n, "target": MIN_GENUINE_REVIEWS, "met": None if n >= MIN_GENUINE_REVIEWS else False},
            "avg_rating": {"value": avg, "target": MIN_AVG_RATING, "met": n > 0 and avg >= MIN_AVG_RATING},
            "majority_positive": {"value": positive, "of": n, "met": n > 0 and positive * 2 > n},
        }
    if n > 0 and (avg < MIN_AVG_RATING or positive * 2 <= n):
        return {"category": "COUNCIL_REVIEW", "approval": "LEGACY", "items": items,
                "note": "The reviews on record fall below the rating items. Needs an individual Council review."}
    return {"category": "INSUFFICIENT_EVIDENCE", "approval": "LEGACY", "items": items,
            "note": ("Session records are not available to the website" if sessions is None else "Not every item is met")
                    + "; the evidence on record cannot show the criteria are met."}


# ── Models ────────────────────────────────────────────────────────────────────
class SessionIn(BaseModel):
    ref: str = Field(max_length=120)
    kind: Literal["one_on_one", "group"] = "one_on_one"
    status: str = Field(default="", max_length=60)
    payment_verified: bool = False  # the MAIN BACKEND recorded the payment (never a browser claim)
    refunded: bool = False
    amount_inr: float = 0
    learner_user_id: Optional[str] = Field(default=None, max_length=120)


class ReviewIn(BaseModel):
    ref: str = Field(max_length=120)
    reviewer_user_id: Optional[str] = Field(default=None, max_length=120)
    rating: Optional[float] = None
    status: str = Field(default="", max_length=40)
    created_at: Optional[str] = Field(default=None, max_length=60)


class EvidenceIn(BaseModel):
    teacher_id: Optional[str] = Field(default=None, max_length=120)
    handle: Optional[str] = Field(default=None, max_length=120)
    name: Optional[str] = Field(default=None, max_length=160)
    sessions: List[SessionIn] = Field(default_factory=list, max_length=2000)
    reviews: List[ReviewIn] = Field(default_factory=list, max_length=2000)


class InteractionIn(BaseModel):
    held_on: date
    format: Literal["video_call", "phone", "in_person"]
    summary: str = Field(min_length=15, max_length=1000)
    confirm: bool


class DecisionIn(BaseModel):
    outcome: Literal["APPROVE", "DECLINE"]
    note: str = Field(min_length=15, max_length=1000)
    confirm: bool
    reason: Optional[str] = Field(default=None, max_length=40)


class FastTrackDecisionIn(BaseModel):
    outcome: Literal["APPROVE", "DECLINE"]
    note: str = Field(min_length=15, max_length=1000)
    confirm: bool
    reason: Optional[str] = Field(default=None, max_length=40)
    interview_completed: bool = False
    interaction_summary: Optional[str] = Field(default=None, max_length=1000)
    # Facts the website server read from the main backend (never from the browser).
    request_status: Optional[str] = Field(default=None, max_length=60)
    interview_scheduled_at: Optional[str] = Field(default=None, max_length=60)
    teacher_id: Optional[str] = Field(default=None, max_length=120)
    teacher_name: Optional[str] = Field(default=None, max_length=160)


class ActivateIn(BaseModel):
    confirm_checked_approval: bool
    note: Optional[str] = Field(default=None, max_length=500)


class MainBackendResultIn(BaseModel):
    applied: bool
    detail: Optional[str] = Field(default=None, max_length=300)


class ComplianceTeacherIn(BaseModel):
    teacher_id: str = Field(max_length=120)
    teacher_user_id: Optional[str] = Field(default=None, max_length=120)
    reviews: Optional[List[ReviewIn]] = Field(default=None, max_length=2000)
    sessions: Optional[List[SessionIn]] = Field(default=None, max_length=2000)


class ComplianceIn(BaseModel):
    teachers: List[ComplianceTeacherIn] = Field(default_factory=list, max_length=1000)


# ── Dependencies / helpers ────────────────────────────────────────────────────
async def teacher_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="teachers_only")
    return user


async def decision_user(user: dict = Depends(current_user)) -> dict:
    """Founder decision: Council gurus AND NOSTOPS admins may decide."""
    if user.get("role") not in DECISION_ROLES:
        raise HTTPException(status_code=403, detail="council_or_admin_only")
    return user


async def admin_user(user: dict = Depends(current_user)) -> dict:
    """Only a NOSTOPS admin may ACTIVATE Empanelled status (or read compliance)."""
    if user.get("role") not in ACTIVATION_ROLES:
        raise HTTPException(status_code=403, detail="admin_only")
    return user


def _actor(user: dict) -> dict:
    return {"reviewer_id": str(user.get("user_id")), "reviewer_name": str(user.get("name") or "")[:120],
            "reviewer_role": user.get("role")}


async def _audit(case_id: str, event: str, user: dict, detail: str = "") -> None:
    await audit.insert_one({"case_id": case_id, "event": event, "at": _now(), "actor_id": str(user.get("user_id")),
                            "actor": str(user.get("name") or "")[:120], "actor_role": user.get("role"),
                            "policy_version": POLICY_VERSION, "detail": detail[:600]})


def _teacher_view(c: Optional[dict]) -> Optional[dict]:
    """What the TEACHER sees: status, interaction date, decision + the reviewer's
    own note — never reviewer names / ids, reasons or internal summaries."""
    if not c:
        return None
    last = (c.get("decisions") or [None])[-1]
    inter = (c.get("interactions") or [None])[-1]
    return {
        "case_id": c["case_id"], "path": c["path"], "status": c["status"],
        "status_label": STATUS_LABELS.get(c["status"], c["status"]), "opened_at": c.get("created_at"),
        "interaction_held_on": inter.get("held_on") if inter else None,
        "outcome": last.get("outcome") if last else None,
        "note": last.get("note") if last else None,
        "decided_at": last.get("decided_at") if last else None,
        "decided_by": REVIEWER_LABELS.get(str(last.get("reviewer_role") or ""), "NOSTOPS") if last else None,
        "activated_at": (c.get("activation") or {}).get("activated_at"),
    }


def _reviewer_view(c: dict) -> dict:
    out = {k: v for k, v in c.items() if k not in {"_id"}}
    out["status_label"] = STATUS_LABELS.get(c["status"], c["status"])
    return out


async def _latest_case(teacher_user_id: str) -> Optional[dict]:
    return await cases.find_one({"teacher_user_id": teacher_user_id, "path": FREE}, sort=[("created_at", -1)])


async def has_approved_case(*, teacher_user_id: Optional[str] = None, teacher_id: Optional[str] = None) -> Optional[str]:
    """case_id of an APPROVED (or ACTIVATED) decision for this teacher, else None."""
    c = await _approval_case(teacher_user_id=teacher_user_id, teacher_id=teacher_id)
    return c["case_id"] if c else None


async def _approval_case(*, teacher_user_id: Optional[str] = None, teacher_id: Optional[str] = None) -> Optional[dict]:
    ors = [{k: v} for k, v in (("teacher_user_id", teacher_user_id), ("teacher_id", teacher_id)) if v]
    if not ors:
        return None
    return await cases.find_one({"status": {"$in": sorted(APPROVAL_STATES)}, "$or": ors}, sort=[("updated_at", -1)])


_SENDABLE = ["PENDING", "FAILED"]  # an activation / decline that still has to reach the main backend


async def gateway_policy_check(method: str, canonical_path: str, body: Optional[bytes]) -> Optional[str]:
    """FINANCIAL SAFETY AUDIT / MB-03, MB-05 at OUR gateway. A direct /api call may only
    grant empanelment or decide a Fast-Track request when a recorded Policy V2 case says
    so. Returns a refusal code, or None to let the call through.
    (The website's own server calls the main backend directly and already follows the
    same flow; this closes the gateway route. Direct calls to the main backend host are
    the main-backend team's MB items.)"""
    import json as _json
    import re as _re
    if (method or "").upper() != "POST":
        return None
    try:
        data = _json.loads(body or b"{}")
    except ValueError:
        data = {}
    m = _re.fullmatch(r"admin/empanelment/([^/]+)", canonical_path)
    if m and isinstance(data, dict) and data.get("is_empanelled") is True:
        ok = await cases.find_one({"teacher_id": m.group(1), "status": ACTIVATED, "main_backend_update": {"$in": _SENDABLE}})
        return None if ok else "approval_required"
    m = _re.fullmatch(r"empanelment/fast-track/([^/]+)/decide", canonical_path)
    if m:
        outcome = str((data or {}).get("outcome") or "") if isinstance(data, dict) else ""
        need = ACTIVATED if outcome == "approved" else NOT_APPROVED if outcome == "rejected" else None
        if not need:
            return "approval_required"
        ok = await cases.find_one({"path": FAST_TRACK, "request_id": m.group(1), "status": need,
                                   "main_backend_update": {"$in": _SENDABLE}})
        return None if ok else "approval_required"
    return None



# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/policy")
async def get_policy(_: bool = Depends(require_secret)) -> dict:
    return {"policy": POLICY}


@router.post("/me/evidence")
async def my_evidence(body: EvidenceIn, user: dict = Depends(teacher_user)) -> dict:
    """The website server sends the teacher's own main-backend facts (read with the
    teacher's session, never typed in the browser). Returns the evaluation + case."""
    me = str(user["user_id"])
    sessions = [s.model_dump() for s in body.sessions]
    reviews = [r.model_dump() for r in body.reviews]
    ev = evaluate_free_path(me, sessions, reviews)
    now = _now()
    await evidence_col.update_one({"teacher_user_id": me}, {"$set": {
        "teacher_user_id": me, "teacher_id": body.teacher_id, "handle": body.handle, "name": body.name,
        "sessions": sessions, "reviews": reviews, "evaluation": ev, "observed_at": now}}, upsert=True)
    return {"evaluation": ev, "observed_at": now, "case": _teacher_view(await _latest_case(me))}


@router.post("/me/apply")
async def apply_free_path(user: dict = Depends(teacher_user)) -> dict:
    """Ask for the Council interaction. Allowed only when ALL merit items are met;
    it never grants anything — it opens a case for a person to handle."""
    me = str(user["user_id"])
    snap = await evidence_col.find_one({"teacher_user_id": me})
    if not snap:
        raise HTTPException(status_code=409, detail="evidence_missing")
    ev = evaluate_free_path(me, snap.get("sessions") or [], snap.get("reviews") or [])
    if not ev["merit_met"]:
        raise HTTPException(status_code=409, detail="merit_requirements_not_met")
    latest = await _latest_case(me)
    if latest and latest["status"] in OPEN:
        return {"ok": True, "case": _teacher_view(latest)}
    if latest and latest["status"] in APPROVAL_STATES:
        raise HTTPException(status_code=409, detail="already_approved")
    now = _now()
    doc = {"case_id": f"epc_{uuid.uuid4().hex[:12]}", "path": FREE, "policy_version": POLICY_VERSION,
           "teacher_user_id": me, "teacher_id": snap.get("teacher_id"), "handle": snap.get("handle"),
           "name": snap.get("name") or user.get("name"), "status": AWAITING_INTERACTION,
           "evidence_at_application": {"evaluation": ev, "observed_at": snap.get("observed_at")},
           "interactions": [], "decisions": [], "created_at": now, "updated_at": now}
    await cases.insert_one(doc)
    await _audit(doc["case_id"], "CASE_OPENED", user, "Teacher asked for the Council interaction; merit items met.")
    return {"ok": True, "case": _teacher_view(doc)}


@router.get("/cases")
async def list_cases(_: dict = Depends(decision_user), status: Optional[str] = Query(None, max_length=40)) -> dict:
    q = {"status": status} if status else {}
    rows = await cases.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for c in rows:
        v = _reviewer_view(c)
        if c["path"] == FREE:
            snap = await evidence_col.find_one({"teacher_user_id": c["teacher_user_id"]}, {"evaluation": 1, "observed_at": 1})
            v["current_evidence"] = {"evaluation": (snap or {}).get("evaluation"), "observed_at": (snap or {}).get("observed_at")}
        v["audit"] = await audit.find({"case_id": c["case_id"]}, {"_id": 0}).sort("at", 1).to_list(100)
        out.append(v)
    return {"cases": out, "count": len(out), "open_count": sum(1 for c in out if c["status"] in OPEN)}


@router.post("/cases/{case_id}/interaction")
async def record_interaction(case_id: str, body: InteractionIn, user: dict = Depends(decision_user)) -> dict:
    if body.confirm is not True:
        raise HTTPException(status_code=400, detail="explicit_confirmation_required")
    if body.held_on > datetime.now(IST).date():  # the Council records dates on India time
        raise HTTPException(status_code=422, detail="interaction_date_in_future")
    c = await cases.find_one({"case_id": case_id})
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")
    new_status = transition(c, "INTERACTION")
    now = _now()
    entry = {"held_on": body.held_on.isoformat(), "format": body.format, "summary": body.summary.strip(),
             "recorded_at": now, **_actor(user)}
    await cases.update_one({"case_id": case_id}, {"$set": {"status": new_status, "updated_at": now},
                                                   "$push": {"interactions": entry}})
    await _audit(case_id, "COUNCIL_INTERACTION_RECORDED", user, f"{body.format} on {entry['held_on']}")
    return {"ok": True, "case_id": case_id, "status": new_status}


@router.post("/cases/{case_id}/decision")
async def record_decision(case_id: str, body: DecisionIn, user: dict = Depends(decision_user)) -> dict:
    if body.confirm is not True:
        raise HTTPException(status_code=400, detail="explicit_confirmation_required")
    c = await cases.find_one({"case_id": case_id})
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")
    new_status = transition(c, body.outcome)
    reason = decline_reason(bool(c.get("interactions")), body.reason) if body.outcome == "DECLINE" else None
    merit = None
    if body.outcome == "APPROVE" and c["path"] == FREE:
        snap = await evidence_col.find_one({"teacher_user_id": c["teacher_user_id"]}) or {}
        merit = evaluate_free_path(c["teacher_user_id"], snap.get("sessions") or [], snap.get("reviews") or [])
        if not merit["merit_met"]:
            raise HTTPException(status_code=409, detail="merit_requirements_not_met")
    now = _now()
    entry = {"outcome": body.outcome, "resulting_status": new_status, "previous_status": c["status"],
             "note": body.note.strip(), "decided_at": now, **_actor(user),
             "reason": reason, "reason_label": DECLINE_REASONS.get(reason or "", "Merit decision after the interaction" if reason else None),
             "merit_at_decision": merit["requirements"] if merit else None}
    await cases.update_one({"case_id": case_id}, {"$set": {"status": new_status, "updated_at": now},
                                                   "$push": {"decisions": entry}})
    await _audit(case_id, f"DECISION_{body.outcome}", user,
                 f"{c['status']} → {new_status}{f' [{reason}]' if reason else ''}: {entry['note']}")
    return {"ok": True, "case_id": case_id, "status": new_status,
            "main_backend": "unchanged — an admin activates an approval after checking it"}


@router.post("/fast-track/{request_id}/decision")
async def fast_track_decision(request_id: str, body: FastTrackDecisionIn, user: dict = Depends(decision_user)) -> dict:
    """Policy gate for a Fast-Track decision. Payment alone can never pass: approval
    needs the priority interview (the Council interaction) to have happened and an
    explicit decision. An APPROVAL is NOT forwarded: an admin activates it later."""
    if body.confirm is not True:
        raise HTTPException(status_code=400, detail="explicit_confirmation_required")
    reason = None
    if body.outcome == "APPROVE":
        if body.interview_completed is not True or len((body.interaction_summary or "").strip()) < 15:
            raise HTTPException(status_code=409, detail="council_interaction_required")
        if (body.request_status or "") != "interview_scheduled":
            raise HTTPException(status_code=409, detail="interview_not_scheduled")
        try:
            held = datetime.fromisoformat(str(body.interview_scheduled_at or "").replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=409, detail="interview_not_held_yet")
        if held.tzinfo is None:
            held = held.replace(tzinfo=timezone.utc)
        if held > datetime.now(timezone.utc):
            raise HTTPException(status_code=409, detail="interview_not_held_yet")
    else:
        reason = decline_reason(body.interview_completed is True, body.reason)
    done = await cases.find_one({"path": FAST_TRACK, "request_id": request_id,
                                 "$or": [{"status": {"$in": sorted(APPROVAL_STATES)}}, {"main_backend_update": "APPLIED"}]})
    if done:
        raise HTTPException(status_code=409, detail="already_decided")
    now = _now()
    approve = body.outcome == "APPROVE"
    new_status = APPROVED if approve else NOT_APPROVED
    interactions = ([{"held_on": body.interview_scheduled_at, "format": "priority_interview",
                      "summary": (body.interaction_summary or "").strip(), "recorded_at": now, **_actor(user)}]
                    if body.interview_completed else [])
    doc = {"case_id": f"epc_{uuid.uuid4().hex[:12]}", "path": FAST_TRACK, "policy_version": POLICY_VERSION,
           "request_id": request_id, "teacher_id": body.teacher_id, "teacher_user_id": None,
           "name": body.teacher_name, "status": new_status, "interactions": interactions,
           "decisions": [{"outcome": body.outcome, "resulting_status": new_status, "previous_status": AWAITING_DECISION,
                          "note": body.note.strip(), "decided_at": now, **_actor(user), "reason": reason,
                          "reason_label": DECLINE_REASONS.get(reason or "", "Merit decision after the interview" if reason else None)}],
           # Approvals wait for an admin; a "not approved" is forwarded to close the paid request.
           "main_backend_update": "AWAITING_ACTIVATION" if approve else "PENDING",
           "created_at": now, "updated_at": now}
    await cases.insert_one(doc)
    await _audit(doc["case_id"], f"FAST_TRACK_DECISION_{body.outcome}", user,
                 f"request {request_id}{f' [{reason}]' if reason else ''}: {doc['decisions'][0]['note']}")
    return {"ok": True, "case_id": doc["case_id"], "status": new_status, "forward_to_main_backend": not approve}


@router.post("/cases/{case_id}/activate")
async def activate(case_id: str, body: ActivateIn, user: dict = Depends(admin_user)) -> dict:
    """ADMIN-ONLY activation after checking the recorded approval. It never changes
    the merit decision: a case that is not approved cannot be activated."""
    if body.confirm_checked_approval is not True:
        raise HTTPException(status_code=400, detail="explicit_confirmation_required")
    c = await cases.find_one({"case_id": case_id})
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")
    approval = approval_on_record(c)
    base = {"ok": True, "case_id": case_id, "path": c["path"], "teacher_id": c.get("teacher_id"),
            "request_id": c.get("request_id"), "approval_note": approval.get("note")}
    if c["status"] == ACTIVATED:
        if c.get("main_backend_update") == "APPLIED":
            raise HTTPException(status_code=409, detail="already_activated")
        await _audit(case_id, "ACTIVATION_RETRY", user, "Re-sending a recorded activation to the main backend.")
        return {**base, "retry": True}
    now = _now()
    entry = {"activated_at": now, "note": (body.note or "").strip() or None, "checked_approval_by": approval.get("reviewer_id"),
             "checked_approval_at": approval.get("decided_at"), **_actor(user)}
    await cases.update_one({"case_id": case_id, "status": APPROVED},
                           {"$set": {"status": ACTIVATED, "activation": entry, "main_backend_update": "PENDING", "updated_at": now}})
    await _audit(case_id, "ACTIVATED", user, f"Admin checked the approval by {approval.get('reviewer_role')} on {approval.get('decided_at')}.")
    return {**base, "retry": False}


@router.post("/cases/{case_id}/main-backend-result")
async def main_backend_result(case_id: str, body: MainBackendResultIn, user: dict = Depends(decision_user)) -> dict:
    c = await cases.find_one({"case_id": case_id})
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")
    if c["status"] == APPROVED or (c["status"] == ACTIVATED and user.get("role") not in ACTIVATION_ROLES):
        raise HTTPException(status_code=409, detail="activation_required")
    state = "APPLIED" if body.applied else "FAILED"
    await cases.update_one({"case_id": case_id}, {"$set": {"main_backend_update": state, "updated_at": _now()}})
    await _audit(case_id, f"MAIN_BACKEND_{state}", user, body.detail or "")
    return {"ok": True, "main_backend_update": state}


@router.get("/approved")
async def approved_for(teacher_id: str = Query(..., min_length=1, max_length=120), _: dict = Depends(decision_user)) -> dict:
    """Used by the admin Empanel switch: a grant needs an approval, then activation."""
    c = await _approval_case(teacher_id=teacher_id)
    return {"approved": bool(c), "case_id": c["case_id"] if c else None, "status": c["status"] if c else None,
            "main_backend_update": c.get("main_backend_update") if c else None}


@router.post("/compliance/evaluate")
async def compliance(body: ComplianceIn, _: dict = Depends(admin_user)) -> dict:
    """READ-ONLY: classify already-empanelled teachers against Policy V2. Stores and
    changes nothing — no suspension, revocation, downgrade or re-empanelment."""
    out = []
    for t in body.teachers:
        v2 = await _approval_case(teacher_id=t.teacher_id)
        res = classify_existing(t.teacher_user_id, None if t.reviews is None else [r.model_dump() for r in t.reviews],
                                None if t.sessions is None else [s.model_dump() for s in t.sessions],
                                v2["status"] if v2 else None)
        out.append({"teacher_id": t.teacher_id, "v2_case_id": v2["case_id"] if v2 else None, **res})
    totals = Counter(r["category"] for r in out)
    return {"policy_version": POLICY_VERSION, "read_only": True, "teachers": out, "totals": dict(totals)}
