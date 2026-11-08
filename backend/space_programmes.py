"""Phase 5B — Space-linked programmes (teacher-created) on the Institutional Programme Engine.

Authoritative sources (read directly, never duplicated):
  • `spaces`            — Space identity, approval status, current owner_id, capacity.
  • `space_enquiries`   — accepted-in-principle enquiry between this teacher and that Space.
  • `inst_teacher_directory` — empanelment / ID-verification (`_match_eligible`) and
    adaptive-practice qualification (`_adaptive_verified`).
Events live in the existing `inst_events` collection (+ `inst_event_seo`, `inst_event_sessions`,
append-only `inst_event_audit_log`). Space events are marked `host_kind = "SPACE"`, have NO
organisation, are always FREE with no fees/costs, never take registrations or payments in this
phase, and are excluded from every automatic teacher-offer path (guard in `_auto_assign_teacher`).
Every create / update / publish re-checks the live records; public reads re-check them too
(`space_public_problems`). Stored snapshots are for display only.
"""
import datetime as _dt
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

import institutional as inst
from institutional import (TAXONOMY, VENUE_EXISTING, VIS_PRIVATE, VIS_PUBLIC, EVENT_VISIBILITY, PRICING_FREE, REG_CLOSED,
                           DEFAULT_TIMEZONE, ScheduleIn, _adaptive_verified, _audit, _match_eligible, _now, current_user, db)
from space_enquiries import MONEY_KEY_RE

router = APIRouter(prefix="/api/institutional/space-programmes", tags=["space-programmes"])

HOST_SPACE = "SPACE"
FOCUS_TO_TAX = {"mind": "MIND", "body": "BODY", "special_needs": "SPECIAL_NEEDS"}
FRESH_SECONDS = 600  # create / edit / publish: the BFF must refresh the teacher's authoritative status within this window
# Public reads never call the live backend. They rely on the last authoritative status written to
# inst_teacher_directory (by this module's refresh or the existing directory sync) and only while it is
# younger than this TTL; older status fails closed and the programme drops out of public discovery.
PUBLIC_STATUS_TTL_SECONDS = 24 * 3600
FINANCIAL_FIELDS = {"pricing_type", "participant_fee", "external_venue_cost", "economics_inputs", "venue_type",
                    "registration_access", "amount", "currency"}
NO_REGISTRATION = "Registration isn't available for NOSTOPS Spaces programmes yet."
APPROVAL_NONE, APPROVAL_PENDING, APPROVAL_APPROVED, APPROVAL_REJECTED = "NOT_REQUESTED", "PENDING", "APPROVED", "REJECTED"

spaces = db["spaces"]
enquiries = db["space_enquiries"]


def _uid(user: dict) -> str:
    uid = str(user.get("user_id") or "").strip()
    if not uid or "@" in uid:  # a genuine user ID only — never an email fallback
        raise HTTPException(status_code=401, detail="A signed-in NOSTOPS account is required.")
    return uid


CREATOR_ROLES = {"teacher", "council"}  # empanelled Yoga Teachers and Council Gurus — same checks, no exemptions


def _require_teacher(user: dict) -> str:
    uid = _uid(user)
    if str(user.get("role") or "").lower() not in CREATOR_ROLES:  # admins can't use this teacher pathway
        raise HTTPException(status_code=403, detail="Only empanelled NOSTOPS teachers can create Space programmes.")
    return uid


def _require_admin(user: dict) -> str:
    uid = _uid(user)
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    return uid


def _refuse_money(raw: dict) -> None:
    bad = sorted(k for k in raw if k in FINANCIAL_FIELDS or MONEY_KEY_RE.search(str(k)))
    if bad:
        raise HTTPException(status_code=422, detail={"message": "Space programmes can't include prices, fees, costs or payment "
                                                                "settings (" + ", ".join(bad) + "). They are always free of any "
                                                                "NOSTOPS financial terms.", "rejected_fields": bad})


def _parse(model, raw: dict):
    _refuse_money(raw)
    try:
        return model(**raw)
    except ValidationError as err:
        unknown = [str(x["loc"][0]) for x in err.errors() if x.get("type") == "extra_forbidden" and x.get("loc")]
        msg = (f"These fields can't be set on a Space programme: {', '.join(unknown)}." if unknown
               else "Please check the programme details and try again.")
        raise HTTPException(status_code=422, detail={"message": msg, "errors": err.errors(include_url=False, include_context=False)})


# ── Eligibility ───────────────────────────────────────────────────────────────
class TeacherStatusIn(BaseModel):
    """Attested server-side by the BFF from the live backend's /teachers/me/native-profile."""
    model_config = ConfigDict(extra="forbid")
    empanelled: bool
    id_verified: bool
    handle: Optional[str] = Field(default=None, max_length=120)
    name: Optional[str] = Field(default=None, max_length=160)


@router.post("/teacher-status")
async def teacher_status_refresh(body: TeacherStatusIn, user: dict = Depends(current_user)) -> dict:
    """Narrow status refresh: writes ONLY empanelled / id_verified / status_source / status_synced_at
    (new records also get teacher_id, active, name, created_at). Never touches adaptive-practice
    fields, level or pathways and never runs teacher matching or offers."""
    inst._require_active()
    tid = _require_teacher(user)
    import trust_review
    withdrawn = bool(body.handle) and body.handle.strip() in await trust_review.withdrawn_handles()
    now = _now()
    await inst.teacher_directory.update_one({"teacher_id": tid}, {
        "$set": {"empanelled": bool(body.empanelled) and not withdrawn, "id_verified": bool(body.id_verified),
                 "status_source": inst.STATUS_SOURCE_MAIN, "status_synced_at": now},
        "$setOnInsert": {"teacher_id": tid, "active": True, "created_at": now,
                         "name": (body.name or user.get("name") or "Teacher")[:160]}}, upsert=True)
    d = await inst.teacher_directory.find_one({"teacher_id": tid})
    await _audit("TeacherDirectory", tid, "TEACHER_STATUS_REFRESHED", user,
                 {"empanelled": d.get("empanelled"), "id_verified": d.get("id_verified"), "source": "space_programmes"})
    return {"eligible": _match_eligible(d), "adaptive_practice_verified": _adaptive_verified(d), "status_synced_at": now}


async def _eligible_teacher(tid: str, taxonomy: Optional[str], fresh: bool) -> list:
    d = await inst.teacher_directory.find_one({"teacher_id": tid})
    if not d:
        return ["teacher_not_in_directory"]
    probs = []
    max_age = FRESH_SECONDS if fresh else PUBLIC_STATUS_TTL_SECONDS
    try:
        synced = _dt.datetime.fromisoformat(str(d.get("status_synced_at")).replace("Z", "+00:00"))
        age = (_dt.datetime.now(_dt.timezone.utc) - synced).total_seconds()
    except (TypeError, ValueError):
        age = None
    if age is None or age < -60 or age > max_age:  # a future timestamp is never treated as fresh
        probs.append("teacher_status_not_refreshed")
    if not _match_eligible(d):
        probs.append("teacher_not_empanelled_and_verified")
    if taxonomy == inst.TAX_SPECIAL_NEEDS and not _adaptive_verified(d):
        probs.append("special_needs_requires_verified_adaptive_practice")
    return probs


async def _link(space_id: str, enquiry_id: str, teacher_id: str) -> tuple[Optional[dict], Optional[dict], list]:
    """Live check of the Space ↔ enquiry ↔ teacher ↔ owner relationship."""
    s = await spaces.find_one({"_id": str(space_id or "")[:40]})
    e = await enquiries.find_one({"_id": str(enquiry_id or "")[:40]})
    probs = []
    if not s or s.get("status") != "approved":
        probs.append("space_not_approved")
    if not e or e.get("status") != "accepted_in_principle":
        probs.append("enquiry_not_accepted_in_principle")
    if e and e.get("space_id") != space_id:
        probs.append("enquiry_space_mismatch")
    if e and e.get("teacher_id") != teacher_id:
        probs.append("enquiry_teacher_mismatch")
    if e and s and e.get("owner_id") != s.get("owner_id"):
        probs.append("enquiry_owner_mismatch")
    return s, e, probs


def _approval_valid(ev: dict, space: Optional[dict]) -> bool:
    la = ev.get("listing_approval") or {}
    return bool(space and la.get("status") == APPROVAL_APPROVED and la.get("owner_id_at_approval")
                and la.get("owner_id_at_approval") == space.get("owner_id"))


async def space_public_problems(ev: dict) -> list:
    """Re-validation for public reads (listing, detail, sitemap). Uses live records only."""
    s, _e, probs = await _link(ev.get("space_id"), ev.get("space_enquiry_id"), ev.get("teacher_id"))
    probs += await _eligible_teacher(ev.get("teacher_id"), (ev.get("programme_snapshot") or {}).get("taxonomy"), fresh=False)
    if not _approval_valid(ev, s):
        probs.append("owner_listing_approval_missing_or_invalid")
    if s and ev.get("capacity") and ev["capacity"] > int(s.get("capacity") or 0):
        probs.append("capacity_exceeds_space")
    return probs


def _fail(probs: list, status: int = 409):
    if probs:
        raise HTTPException(status_code=status, detail={"message": "This Space programme can't proceed: " + ", ".join(probs) + ".",
                                                        "problems": probs})


# ── Teacher create / edit ────────────────────────────────────────────────────
class SpaceProgrammeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    space_id: str = Field(max_length=40)
    space_enquiry_id: str = Field(max_length=40)
    programme_id: str = Field(max_length=60)
    title: str = Field(min_length=3, max_length=180)
    subtitle: Optional[str] = Field(default=None, max_length=240)
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=60, ge=10, le=600)
    timezone: Optional[str] = DEFAULT_TIMEZONE
    capacity: int = Field(ge=1, le=5000)
    language: Optional[str] = Field(default="English", max_length=40)
    visibility: str = VIS_PRIVATE
    schedule: Optional[ScheduleIn] = None


class SpaceProgrammeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # space_id / space_enquiry_id can never be changed
    programme_id: Optional[str] = Field(default=None, max_length=60)
    title: Optional[str] = Field(default=None, min_length=3, max_length=180)
    subtitle: Optional[str] = Field(default=None, max_length=240)
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=10, le=600)
    timezone: Optional[str] = None
    capacity: Optional[int] = Field(default=None, ge=1, le=5000)
    language: Optional[str] = Field(default=None, max_length=40)
    visibility: Optional[str] = None
    schedule: Optional[ScheduleIn] = None


def _fixed_money() -> dict:
    return {"pricing_type": PRICING_FREE, "participant_fee": None, "external_venue_cost": None, "economics_inputs": None,
            "venue_type": VENUE_EXISTING, "community_space_contribution": True, "registration_access": REG_CLOSED}


async def _taxonomy_ok(snap: dict, enq: dict) -> None:
    allowed = {FOCUS_TO_TAX[f] for f in (enq.get("focus_areas") or []) if f in FOCUS_TO_TAX}
    tax = snap.get("taxonomy")
    if tax not in TAXONOMY or tax not in allowed:
        raise HTTPException(status_code=422, detail={"message": "Choose a programme in one of the focus areas agreed in the enquiry "
                                                                f"({', '.join(sorted(allowed)) or 'none'}).", "problems": ["taxonomy_not_in_enquiry"]})


def _vis(v: Optional[str]) -> str:
    vis = (v or VIS_PRIVATE).strip().upper()
    if vis not in EVENT_VISIBILITY:
        raise HTTPException(status_code=422, detail={"message": "Visibility must be PUBLIC, UNLISTED or PRIVATE."})
    return vis


@router.post("")
async def create_space_programme(raw: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    inst._require_active()
    await inst._ensure_seed()
    tid = _require_teacher(user)
    body = _parse(SpaceProgrammeCreate, raw)
    space, enq, probs = await _link(body.space_id, body.space_enquiry_id, tid)
    _fail(probs)
    snap = await inst._programme_snapshot(body.programme_id)
    await _taxonomy_ok(snap, enq)
    _fail(await _eligible_teacher(tid, snap.get("taxonomy"), fresh=True), 403)
    if not space.get("capacity") or body.capacity > int(space["capacity"]):
        raise HTTPException(status_code=422, detail={"message": f"Capacity can't exceed the Space's approved capacity ({space.get('capacity')}).",
                                                     "problems": ["capacity_exceeds_space"]})
    schedule, session_dates = inst._build_schedule(body.schedule, body.event_date)
    loc = space.get("location") or {}
    city_name, city_slug, is_launch = inst._event_city(loc.get("district") or loc.get("locality"))
    now = _now()
    event_id = await inst._next_id("Event")
    doc = {
        "event_id": event_id, "slug": None, "host_kind": HOST_SPACE,
        "organisation_id": None, "cohort_type": None,
        "space_id": space["_id"], "space_enquiry_id": enq["_id"], "teacher_id": tid,
        "teacher_name": str(user.get("name") or ""),
        "space_snapshot": {"name": space.get("name"), "model": space.get("model"), "capacity": space.get("capacity"),
                           "locality": loc.get("locality"), "pin": loc.get("pin"), "district": loc.get("district"),
                           "state": loc.get("state"), "snapshotted_at": now},  # display only — never used for authorisation
        "programme_id": body.programme_id, "programme_snapshot": snap,
        "title": body.title.strip(), "subtitle": (body.subtitle or "").strip() or None,
        "event_date": body.event_date or None, "start_time": body.start_time or None, "end_time": body.end_time or None,
        "duration_minutes": body.duration_minutes or 60, "timezone": (body.timezone or DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE,
        "city": city_name, "city_slug": city_slug, "is_launch_city": is_launch, "venue": space.get("name"),
        "capacity": body.capacity, "language": (body.language or "English").strip() or "English",
        "registration_closing_date": None, "schedule": schedule,
        "last_session_date": session_dates[-1] if session_dates else None,
        "visibility": _vis(body.visibility), **_fixed_money(),
        "programme_champion": None, "preferred_teacher_id": None, "source_event_id": None, "assigned_teacher": None,
        "matching_inputs": None, "listing_approval": {"status": APPROVAL_NONE},
        "lifecycle": "DRAFT", "created_by": tid, "created_at": now, "updated_at": now, "published_at": None,
    }
    await inst.events.insert_one(dict(doc))
    await inst._replace_sessions(event_id, session_dates)
    await _audit("Event", event_id, "SPACE_PROGRAMME_DRAFT_CREATED", user,
                 {"space_id": space["_id"], "space_enquiry_id": enq["_id"], "taxonomy": snap.get("taxonomy")})
    return {"programme": _view(doc)}


async def _own_event(eid: str, tid: str) -> dict:
    ev = await inst.events.find_one({"event_id": eid, "host_kind": HOST_SPACE})
    if not ev or ev.get("teacher_id") != tid:
        raise HTTPException(status_code=404, detail="Programme not found.")
    return ev


@router.patch("/{eid}")
async def update_space_programme(eid: str, raw: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    inst._require_active()
    tid = _require_teacher(user)
    ev = await _own_event(eid, tid)
    body = _parse(SpaceProgrammeUpdate, raw)
    if ev.get("lifecycle") != "DRAFT":
        raise HTTPException(status_code=409, detail={"message": "A published Space programme can't be edited."})
    space, enq, probs = await _link(ev["space_id"], ev["space_enquiry_id"], tid)
    _fail(probs)
    data = body.model_dump(exclude_unset=True)
    upd: dict = {}
    snap = ev["programme_snapshot"]
    if data.get("programme_id") and data["programme_id"] != ev.get("programme_id"):
        snap = await inst._programme_snapshot(data["programme_id"])
        upd.update(programme_id=data["programme_id"], programme_snapshot=snap)
    await _taxonomy_ok(snap, enq)
    _fail(await _eligible_teacher(tid, snap.get("taxonomy"), fresh=True), 403)
    cap = data.get("capacity", ev.get("capacity"))
    if not space.get("capacity") or (cap and cap > int(space["capacity"])):
        raise HTTPException(status_code=422, detail={"message": f"Capacity can't exceed the Space's approved capacity ({space.get('capacity')}).",
                                                     "problems": ["capacity_exceeds_space"]})
    for k in ("title", "subtitle", "event_date", "start_time", "end_time", "duration_minutes", "timezone", "capacity", "language"):
        if k in data:
            v = data[k]
            upd[k] = v.strip() if isinstance(v, str) else v
    if "visibility" in data:
        upd["visibility"] = _vis(data["visibility"])
    if "schedule" in data or "event_date" in data:
        schedule, dates = inst._build_schedule(body.schedule if "schedule" in data else (
            ScheduleIn(**ev["schedule"]) if ev.get("schedule") else None), upd.get("event_date", ev.get("event_date")))
        upd.update(schedule=schedule, last_session_date=dates[-1] if dates else None)
        await inst._replace_sessions(eid, dates)
    # Any change to the proposed listing invalidates an earlier owner decision.
    if (ev.get("listing_approval") or {}).get("status") != APPROVAL_NONE:
        upd["listing_approval"] = {"status": APPROVAL_NONE, "previous": ev.get("listing_approval")}
        await _audit("Event", eid, "SPACE_LISTING_APPROVAL_RESET_BY_EDIT", user, {})
    upd.update(_fixed_money(), updated_at=_now())
    await inst.events.update_one({"event_id": eid}, {"$set": upd})
    await _audit("Event", eid, "SPACE_PROGRAMME_UPDATED", user, {"fields": sorted(k for k in data)})
    return {"programme": _view(await inst.events.find_one({"event_id": eid}))}


@router.post("/{eid}/submit")
async def submit_for_owner_approval(eid: str, user: dict = Depends(current_user)) -> dict:
    inst._require_active()
    tid = _require_teacher(user)
    ev = await _own_event(eid, tid)
    if ev.get("lifecycle") != "DRAFT":
        raise HTTPException(status_code=409, detail={"message": "Only a draft can be sent for the owner's approval."})
    _s, _e, probs = await _link(ev["space_id"], ev["space_enquiry_id"], tid)
    _fail(probs)
    missing = [f for f in ("title", "event_date", "visibility", "capacity") if not ev.get(f)]
    _fail([f"missing_{m}" for m in missing], 422)
    la = {"status": APPROVAL_PENDING, "requested_at": _now(), "requested_by": tid}
    await inst.events.update_one({"event_id": eid}, {"$set": {"listing_approval": la, "updated_at": _now()}})
    await _audit("Event", eid, "SPACE_LISTING_APPROVAL_REQUESTED", user, {"space_id": ev["space_id"]})
    return {"programme": _view(await inst.events.find_one({"event_id": eid}))}


# ── Owner / admin decision on the proposed listing ───────────────────────────
class DecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str
    note: Optional[str] = Field(default=None, max_length=1000)


class AdminDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str
    reason: str = Field(min_length=10, max_length=1000)


def _decision(v: str) -> str:
    d = {"approve": APPROVAL_APPROVED, "reject": APPROVAL_REJECTED}.get((v or "").lower())
    if not d:
        raise HTTPException(status_code=422, detail={"message": "Decision must be approve or reject."})
    return d


async def _decide(eid: str, status: str, user: dict, kind: str, note: Optional[str], owner_check: bool) -> dict:
    inst._require_active()
    ev = await inst.events.find_one({"event_id": eid, "host_kind": HOST_SPACE})
    if not ev:
        raise HTTPException(status_code=404, detail="Programme not found.")
    space = await spaces.find_one({"_id": ev["space_id"]})
    uid = _uid(user)
    if owner_check and (not space or space.get("owner_id") != uid):
        raise HTTPException(status_code=404, detail="Programme not found.")
    if ev.get("lifecycle") != "DRAFT" or (ev.get("listing_approval") or {}).get("status") != APPROVAL_PENDING:
        raise HTTPException(status_code=409, detail={"message": "This listing isn't waiting for approval."})
    if status == APPROVAL_APPROVED:
        _s, _e, probs = await _link(ev["space_id"], ev["space_enquiry_id"], ev["teacher_id"])
        _fail(probs)
    now = _now()
    la = {"status": status, "type": kind, "approver_user_id": uid, "approver_role": str(user.get("role") or ""),
          "owner_id_at_approval": space.get("owner_id") if space else None, "at": now,
          **({"reason": note} if kind == "ADMIN_ON_BEHALF" else {"note": (note or "").strip() or None})}
    res = await inst.events.update_one({"event_id": eid, "listing_approval.status": APPROVAL_PENDING},
                                       {"$set": {"listing_approval": la, "updated_at": now}})
    if not res.modified_count:
        raise HTTPException(status_code=409, detail={"message": "This listing isn't waiting for approval."})
    await _audit("Event", eid, f"SPACE_LISTING_{status}_{kind}", user,
                 {"owner_id_at_approval": la["owner_id_at_approval"], "reason_or_note": note})
    return {"programme": _view(await inst.events.find_one({"event_id": eid}))}


@router.post("/{eid}/owner-decision")
async def owner_decision(eid: str, raw: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    body = _parse(DecisionIn, raw)
    return await _decide(eid, _decision(body.decision), user, "OWNER", body.note, owner_check=True)


@router.post("/{eid}/admin-decision")
async def admin_decision(eid: str, raw: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    _require_admin(user)
    if len(str(raw.get("reason") or "").strip()) < 10:
        raise HTTPException(status_code=422, detail={"message": "An administrator decision needs a reason of at least 10 characters."})
    body = _parse(AdminDecisionIn, raw)
    return await _decide(eid, _decision(body.decision), user, "ADMIN_ON_BEHALF", body.reason.strip(), owner_check=False)


# ── Publish ──────────────────────────────────────────────────────────────────
@router.post("/{eid}/publish")
async def publish_space_programme(eid: str, user: dict = Depends(current_user)) -> dict:
    inst._require_active()
    tid = _require_teacher(user)
    ev = await _own_event(eid, tid)
    if ev.get("lifecycle") != "DRAFT":
        raise HTTPException(status_code=409, detail={"message": "This programme is already published."})
    space, _e, probs = await _link(ev["space_id"], ev["space_enquiry_id"], tid)
    probs += await _eligible_teacher(tid, (ev.get("programme_snapshot") or {}).get("taxonomy"), fresh=True)
    if not _approval_valid(ev, space):
        probs.append("owner_listing_approval_missing_or_invalid")
    probs += [f"missing_{f}" for f in ("title", "event_date", "visibility", "capacity") if not ev.get(f)]
    if inst._is_recurring(ev) and not ev.get("last_session_date"):
        probs.append("missing_end_date")
    if space and ev.get("capacity") and ev["capacity"] > int(space.get("capacity") or 0):
        probs.append("capacity_exceeds_space")
    _fail(probs)
    slug = ev.get("slug") or inst._build_event_slug(ev["title"], ev.get("event_date"), eid)
    if await inst.events.find_one({"slug": slug, "event_id": {"$ne": eid}}):
        slug = f"{slug}-{eid[-6:].lower()}"
    now = _now()
    res = await inst.events.update_one({"event_id": eid, "lifecycle": "DRAFT"},
                                       {"$set": {"slug": slug, "lifecycle": "PUBLISHED", "published_at": now, "updated_at": now,
                                                 **_fixed_money()}})
    if not res.modified_count:  # a concurrent publish already won
        raise HTTPException(status_code=409, detail={"message": "This programme is already published."})
    seo_id = await inst._next_id("EventSEO")
    await inst.event_seo.update_one({"event_id": eid}, {"$set": {
        "event_id": eid, "slug": slug, "meta_title": f"{ev['title']} · NOSTOPS",
        "meta_description": (ev.get("subtitle") or ev["programme_snapshot"].get("essence") or "")[:300],
        # Static hint only: public reads re-validate the Space conditions every time.
        "indexable": ev.get("visibility") == VIS_PUBLIC, "host_kind": HOST_SPACE,
        "canonical_path": f"/events/{slug}", "og_image": None, "updated_at": now,
    }, "$setOnInsert": {"event_seo_id": seo_id, "created_at": now}}, upsert=True)
    await _audit("Event", eid, "SPACE_PROGRAMME_PUBLISHED", user, {"visibility": ev.get("visibility"), "slug": slug})
    return {"programme": _view(await inst.events.find_one({"event_id": eid})), "public_path": f"/events/{slug}"}


# ── Reads ────────────────────────────────────────────────────────────────────
def _view(ev: dict) -> dict:
    keep = ("event_id", "slug", "host_kind", "space_id", "space_enquiry_id", "teacher_id", "teacher_name", "space_snapshot",
            "programme_id", "title", "subtitle", "event_date", "start_time", "end_time", "duration_minutes", "timezone", "city",
            "venue", "capacity", "language", "schedule", "last_session_date", "visibility", "lifecycle", "listing_approval",
            "created_at", "updated_at", "published_at", "space_seats_used", "space_registration_closed", "space_pricing")
    out = {k: ev.get(k) for k in keep}
    snap = ev.get("programme_snapshot") or {}
    out["programme"] = {k: snap.get(k) for k in ("name", "taxonomy", "taxonomy_label", "essence")}
    out["lifecycle_effective"] = inst._effective_lifecycle(ev)
    return out


async def _with_problems(ev: dict) -> dict:
    out = _view(ev)
    out["problems"] = await space_public_problems(ev)
    return out


@router.get("/mine")
async def my_space_programmes(user: dict = Depends(current_user)) -> dict:
    tid = _require_teacher(user)
    evs = await inst.events.find({"host_kind": HOST_SPACE, "teacher_id": tid}).sort("updated_at", -1).to_list(200)
    acc = await enquiries.find({"teacher_id": tid, "status": "accepted_in_principle"},
                               {"_id": 1, "ref": 1, "space_id": 1, "space_name": 1, "focus_areas": 1, "programme_title": 1,
                                "participants": 1}).to_list(100)
    return {"items": [await _with_problems(e) for e in evs],
            "accepted_enquiries": [{"id": a["_id"], "ref": a.get("ref"), "space_id": a.get("space_id"), "space_name": a.get("space_name"),
                                    "programme_title": a.get("programme_title"), "participants": a.get("participants"),
                                    "taxonomies": [FOCUS_TO_TAX[f] for f in a.get("focus_areas") or [] if f in FOCUS_TO_TAX]} for a in acc]}


@router.get("/owner")
async def owner_space_programmes(user: dict = Depends(current_user)) -> dict:
    uid = _uid(user)
    admin = str(user.get("role") or "").lower() == "admin"
    sids = [s["_id"] async for s in spaces.find({} if admin else {"owner_id": uid}, {"_id": 1})]
    evs = await inst.events.find({"host_kind": HOST_SPACE, "space_id": {"$in": sids}}).sort("updated_at", -1).to_list(300)
    return {"items": [await _with_problems(e) for e in evs]}


@router.get("/{eid}")
async def get_space_programme(eid: str, user: dict = Depends(current_user)) -> dict:
    uid = _uid(user)
    ev = await inst.events.find_one({"event_id": eid, "host_kind": HOST_SPACE})
    if not ev:
        raise HTTPException(status_code=404, detail="Programme not found.")
    space = await spaces.find_one({"_id": ev["space_id"]}, {"owner_id": 1})
    role = ("admin" if str(user.get("role") or "").lower() == "admin" else "teacher" if ev.get("teacher_id") == uid
            else "owner" if space and space.get("owner_id") == uid else None)
    if not role:
        raise HTTPException(status_code=404, detail="Programme not found.")
    hist = await inst.event_audit_log.find({"entity_type": "Event", "entity_id": eid},
                                           {"_id": 0, "action": 1, "actor_role": 1, "created_at": 1}).sort("created_at", 1).to_list(200)
    return {"programme": await _with_problems(ev), "viewer": role, "history": hist}


# ── Hooks used by institutional.py public paths ──────────────────────────────
def is_space_event(ev: Optional[dict]) -> bool:
    return bool(ev) and ev.get("host_kind") == HOST_SPACE


async def public_space_projection(ev: dict, base: dict) -> dict:
    """Overrides for a VALID Space event's public projection: no registration, no money, Space host card,
    and the Space-specific indexability rule (never the organisation-verification rule)."""
    live = inst._effective_lifecycle(ev) in {"PUBLISHED", "LIVE", "COMPLETED", "EVERGREEN"}
    import space_registrations as sr  # Phase 6 — live registration state (never stored)
    await sr.expire_holds(ev["event_id"])
    ev = await inst.events.find_one({"event_id": ev["event_id"]}) or ev
    st = await sr.registration_state(ev, problems=[])  # the caller has already re-validated the Space conditions
    paid = st["pricing"]["mode"] == "PAID"
    s = await spaces.find_one({"_id": ev["space_id"]}, {"name": 1, "model": 1, "location": 1})
    loc = (s or {}).get("location") or {}
    base.update({
        "host_kind": HOST_SPACE, "organisation": None, "pricing_type": "PAID" if paid else PRICING_FREE, "is_free": not paid,
        "participant_fee": st["pricing"]["fee_minor"] // 100 if paid else None,
        "registration_access": REG_CLOSED, "registration_open": st["registration_open"],
        "registration_closed_reason": st["registration_closed_reason"], "registration_status": st["registration_status"],
        "seats_remaining": st["seats_remaining"], "is_full": st["is_full"], "confirmed_count": None,
        "space": {"id": ev["space_id"], "name": (s or {}).get("name"), "model": (s or {}).get("model"),
                  "locality": loc.get("locality"), "district": loc.get("district"), "state": loc.get("state"), "pin": loc.get("pin")},
        "teacher": {"name": ev.get("teacher_name"), "handle": None, "verified": True}, "teacher_confirmed": True,
        "teacher_verified": True, "teacher_status": "Led by a NOSTOPS-verified teacher",
        "discovery_eligible": ev.get("visibility") == VIS_PUBLIC and live,
        "indexable": ev.get("visibility") == VIS_PUBLIC and live and not ev.get("is_demo_seeded"),
    })
    if base.get("sessions"):
        for x in base["sessions"]:
            x["registration_open"] = False  # Space programmes register once for the whole programme, never per session
    return base


async def public_space_events() -> list:
    """Valid, PUBLIC, published Space events for the public listing / sitemap."""
    out = []
    docs = await inst.events.find({"host_kind": HOST_SPACE, "visibility": VIS_PUBLIC, "slug": {"$ne": None},
                                   "lifecycle": {"$in": ["PUBLISHED", "LIVE", "COMPLETED", "EVERGREEN"]}}).to_list(1000)
    for d in docs:
        if not await space_public_problems(d):
            out.append(d)
    return out


def refuse_space_registration(ev: Optional[dict]) -> None:
    if is_space_event(ev):
        raise HTTPException(status_code=409, detail=NO_REGISTRATION)
