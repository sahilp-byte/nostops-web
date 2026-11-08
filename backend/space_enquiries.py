"""Phase 4 (screen 1) — Teacher → Space enquiries: draft, review & send (no money, no booking).

  * Only approved Spaces can receive enquiries; only signed-in teachers / Council Gurus (and admins) can send them.
  * Draft → sent is a compare-and-set, and a per-draft unique reference is minted once, so double clicks or retries
    never create two enquiries. A second open enquiry with the same title and start date for the same Space is refused.
  * Private: an enquiry and its documents are visible only to the teacher, the Space owner (once sent) and admins.
  * The owner is notified by email. Any financial arrangement is private between teacher and owner, outside NOSTOPS:
    no price, fee, revenue share or payout fields exist (unknown fields are rejected).
"""
import base64
import re
import secrets
import uuid
from datetime import date
from html import escape
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo import ReturnDocument

from email_util import send_email
from spaces import DOC_TYPES, FACILITIES, MAX_DOC_BYTES, _public
from venues import _now_iso, current_user, db

router = APIRouter(prefix="/api/spaces/enquiries", tags=["space-enquiries"])

TEACHER_ROLES = {"teacher", "council", "admin"}
GROUP_TYPES = {"corporate", "residential_society", "school_college", "ngo_community", "general_public", "institution", "other"}
PROFILES = {"adults_general", "seniors", "children_youth", "women", "mixed_general", "special_needs", "other"}
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
OPEN = {"sent", "in_discussion", "accepted_in_principle"}
RESPONDABLE = OPEN  # declined is final
FOCUS = ["mind", "body", "special_needs"]
RESPONSES = {"accept": "accepted_in_principle", "discuss": "in_discussion", "propose_dates": "in_discussion", "decline": "declined"}
STATUS_LABEL = {"sent": "New", "in_discussion": "In discussion", "accepted_in_principle": "Accepted in principle", "declined": "Declined"}
MAX_DOCS = 3
NOT_TEACHER = "Only NOSTOPS teachers and Council Gurus can send a Space enquiry."


def _uid(u: dict) -> str:
    return str(u.get("user_id"))


def _require_teacher(u: dict) -> None:
    if str(u.get("role") or "") not in TEACHER_ROLES:
        raise HTTPException(status_code=403, detail=NOT_TEACHER)


def _view(e: dict, space: Optional[dict] = None) -> dict:
    out = {k: e.get(k) for k in ("ref", "status", "space_id", "space_name", "programme_title", "duration", "participants",
                                 "group_type", "participant_profile", "start_date", "end_date", "days", "time_from", "time_to",
                                 "facilities", "access_needs", "additional_info", "teacher_name", "created_at", "updated_at",
                                 "sent_at", "owner_notified", "focus_areas", "teacher_email", "venue_terms", "decided_at",
                                 "decline_reason", "proposal")}
    out["messages"] = e.get("messages", [])
    out["history"] = [{k: h.get(k) for k in ("action", "at", "by", "note")} for h in e.get("history", [])]
    out["id"] = e["_id"]
    out["documents"] = [{k: d.get(k) for k in ("id", "name", "type", "size")} for d in e.get("documents", [])]
    if space:
        out["space"] = _public(space)
    return out


def _missing(e: dict) -> list[str]:
    m = []
    if not (e.get("programme_title") or "").strip():
        m.append("Programme title")
    if not (e.get("duration") or "").strip():
        m.append("Duration")
    if not e.get("participants"):
        m.append("Expected participants")
    if e.get("group_type") not in GROUP_TYPES:
        m.append("Group type")
    if e.get("participant_profile") not in PROFILES:
        m.append("Participant profile")
    if not e.get("start_date"):
        m.append("Preferred start date")
    if not e.get("days") or not e.get("time_from") or not e.get("time_to"):
        m.append("Preferred days and timings")
    return m


class EnquiryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    space_id: Optional[str] = Field(default=None, max_length=40)
    programme_title: Optional[str] = Field(default=None, max_length=140)
    duration: Optional[str] = Field(default=None, max_length=80)
    participants: Optional[int] = Field(default=None, ge=1, le=5000)
    group_type: Optional[str] = Field(default=None, max_length=40)
    participant_profile: Optional[str] = Field(default=None, max_length=40)
    start_date: Optional[str] = Field(default=None, max_length=10)
    end_date: Optional[str] = Field(default=None, max_length=10)
    days: Optional[list[str]] = None
    time_from: Optional[str] = Field(default=None, max_length=5)
    time_to: Optional[str] = Field(default=None, max_length=5)
    facilities: Optional[list[str]] = None
    focus_areas: Optional[list[str]] = None
    access_needs: Optional[str] = Field(default=None, max_length=1000)
    additional_info: Optional[str] = Field(default=None, max_length=2000)


def _clean(body: EnquiryIn) -> dict:
    d = body.model_dump(exclude_unset=True)
    d.pop("space_id", None)
    out: dict = {}
    for k in ("programme_title", "duration", "access_needs", "additional_info"):
        if k in d:
            out[k] = (d[k] or "").strip()
    if "participants" in d:
        out["participants"] = d["participants"]
    for k, allowed in (("group_type", GROUP_TYPES), ("participant_profile", PROFILES)):
        if k in d:
            if d[k] not in allowed:
                raise HTTPException(status_code=422, detail=f"Choose a valid {k.replace('_', ' ')}.")
            out[k] = d[k]
    for k in ("start_date", "end_date"):
        if k in d:
            v = d[k] or ""
            if v:
                try:
                    date.fromisoformat(v)
                except ValueError:
                    raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD.")
            out[k] = v
    for k in ("time_from", "time_to"):
        if k in d:
            v = d[k] or ""
            if v and not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
                raise HTTPException(status_code=422, detail="Times must be HH:MM.")
            out[k] = v
    if "days" in d:
        out["days"] = [x for x in DAYS if x in (d["days"] or [])]
    if "facilities" in d:
        out["facilities"] = [f for f in dict.fromkeys(d["facilities"] or []) if f in FACILITIES]
    if "focus_areas" in d:
        out["focus_areas"] = [x for x in FOCUS if x in (d["focus_areas"] or [])]
    return out


def _check_dates(e: dict) -> None:
    s, t = e.get("start_date") or "", e.get("end_date") or ""
    if s and s < date.today().isoformat():
        raise HTTPException(status_code=422, detail="The preferred start date can't be in the past.")
    if s and t and t < s:
        raise HTTPException(status_code=422, detail="The end date must be on or after the start date.")
    if e.get("time_from") and e.get("time_to") and e["time_to"] <= e["time_from"]:
        raise HTTPException(status_code=422, detail="The end time must be after the start time.")


async def _approved_space(sid: str) -> dict:
    s = await db.spaces.find_one({"_id": (sid or "")[:40], "status": "approved"})
    if not s:
        raise HTTPException(status_code=404, detail="This Space isn't open for enquiries (it must be approved and live).")
    return s


async def _own_draft(eid: str, user: dict) -> dict:
    e = await db.space_enquiries.find_one({"_id": eid, "teacher_id": _uid(user)})
    if not e:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    return e


@router.post("")
async def create(body: EnquiryIn, user: dict = Depends(current_user)):
    _require_teacher(user)
    space = await _approved_space(body.space_id or "")
    if space.get("owner_id") == _uid(user):
        raise HTTPException(status_code=422, detail="You can't send an enquiry to your own Space.")
    data = _clean(body)
    _check_dates(data)
    now = _now_iso()
    e = {"_id": f"enq_{uuid.uuid4().hex[:16]}", "status": "draft", "space_id": space["_id"], "space_name": space.get("name"),
         "owner_id": space.get("owner_id"), "teacher_id": _uid(user), "teacher_name": str(user.get("name") or ""),
         "teacher_email": str(user.get("email") or ""), "documents": [], "facilities": [], "days": [], **data,
         "created_at": now, "updated_at": now, "history": [{"action": "draft_created", "at": now}]}
    await db.space_enquiries.insert_one(e)
    return {"ok": True, "enquiry": _view(e, space), "missing": _missing(e)}


@router.get("/mine")
async def mine(user: dict = Depends(current_user)):
    items = await db.space_enquiries.find({"teacher_id": _uid(user)}, {"history": 0}).sort("updated_at", -1).to_list(200)
    return {"ok": True, "items": [_view(e) for e in items]}


@router.get("/doc/{did}")
async def doc(did: str, user: dict = Depends(current_user)):
    d = await db.space_enquiry_docs.find_one({"_id": did})
    if not d:
        raise HTTPException(status_code=404, detail="Document not found.")
    e = await db.space_enquiries.find_one({"_id": d["enquiry_id"]})
    if not e or not (await _access(e, user))[0]:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"type": d["type"], "name": d["name"], "base64": base64.b64encode(d["data"]).decode()}


async def _access(e: dict, user: dict) -> tuple[Optional[str], Optional[dict]]:
    """Who is asking: 'teacher' (own enquiry), 'owner' (current owner of the APPROVED Space, sent enquiries only),
    'admin', or None. Owners never see drafts."""
    space = await db.spaces.find_one({"_id": e["space_id"]})
    uid = _uid(user)
    if str(user.get("role") or "") == "admin":
        return "admin", space
    if e.get("teacher_id") == uid:
        return "teacher", space
    if e.get("status") != "draft" and space and space.get("status") == "approved" and space.get("owner_id") == uid:
        return "owner", space
    return None, space


GROUPS = {"new": ["sent"], "in_discussion": ["in_discussion", "accepted_in_principle"], "accepted": ["accepted_in_principle"],
          "closed": ["declined"]}


@router.get("/incoming")
async def incoming(space_id: str = "", status: str = "all", date_from: str = "", date_to: str = "",
                   user: dict = Depends(current_user)):
    """Owner dashboard: sent (never draft) enquiries for the caller's approved Spaces. Admins see all."""
    admin = str(user.get("role") or "") == "admin"
    sq = {"status": "approved"} if admin else {"status": "approved", "owner_id": _uid(user)}
    spaces = await db.spaces.find(sq, {"name": 1, "location": 1}).sort("name", 1).to_list(500)
    ids = [s["_id"] for s in spaces]
    base: dict = {"status": {"$ne": "draft"}, "space_id": {"$in": [space_id] if space_id in ids else ids}}
    rng = {op: v for op, v in (("$gte", date_from), ("$lte", date_to)) if re.match(r"^\d{4}-\d{2}-\d{2}$", v or "")}
    if rng:
        base["start_date"] = rng
    counts = {"total": await db.space_enquiries.count_documents(base)}
    for g, sts in GROUPS.items():
        counts[g] = await db.space_enquiries.count_documents({**base, "status": {"$in": sts}})
    # Stat cards must add up to the total: "discussing" excludes accepted-in-principle (shown on its own card).
    counts["discussing"] = await db.space_enquiries.count_documents({**base, "status": "in_discussion"})
    q = {**base, "status": {"$in": GROUPS[status]}} if status in GROUPS else base
    items = await db.space_enquiries.find(q, {"history": 0, "messages": 0}).sort("sent_at", -1).to_list(300)
    return {"ok": True, "counts": counts,
            "spaces": [{"id": s["_id"], "name": s.get("name"), "locality": (s.get("location") or {}).get("locality")} for s in spaces],
            "items": [_view(e) for e in items]}


@router.get("/{eid}")
async def get_one(eid: str, user: dict = Depends(current_user)):
    e = await db.space_enquiries.find_one({"_id": eid})
    who, space = (await _access(e, user)) if e else (None, None)
    if not who:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    return {"ok": True, "viewer": who, "enquiry": _view(e, space), "missing": _missing(e)}


@router.patch("/{eid}")
async def update(eid: str, body: EnquiryIn, user: dict = Depends(current_user)):
    _require_teacher(user)
    e = await _own_draft(eid, user)
    if e["status"] != "draft":
        raise HTTPException(status_code=409, detail="This enquiry has already been sent and can't be edited.")
    data = _clean(body)
    _check_dates({**e, **data})
    new = await db.space_enquiries.find_one_and_update({"_id": eid, "status": "draft"}, {"$set": {**data, "updated_at": _now_iso()}},
                                                       return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This enquiry has already been sent and can't be edited.")
    space = await db.spaces.find_one({"_id": new["space_id"]})
    return {"ok": True, "enquiry": _view(new, space), "missing": _missing(new)}


class DocIn(BaseModel):
    name: str = Field(max_length=160)
    type: str = Field(max_length=60)
    base64: str = Field(max_length=6_000_000)


@router.post("/{eid}/documents")
async def add_document(eid: str, body: DocIn, user: dict = Depends(current_user)):
    _require_teacher(user)
    e = await _own_draft(eid, user)
    if e["status"] != "draft":
        raise HTTPException(status_code=409, detail="Documents can't be changed after the enquiry is sent.")
    if len(e.get("documents", [])) >= MAX_DOCS:
        raise HTTPException(status_code=422, detail=f"You can attach up to {MAX_DOCS} documents.")
    if body.type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail="Upload a PDF, JPG, PNG or WebP file.")
    try:
        raw = base64.b64decode(body.base64.split(",", 1)[-1], validate=True)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read that file.")
    if not raw or len(raw) > MAX_DOC_BYTES:
        raise HTTPException(status_code=422, detail="Each document must be 4 MB or smaller.")
    ok = {"pdf": raw[:4] == b"%PDF", "jpg": raw[:3] == b"\xff\xd8\xff", "png": raw[:8] == b"\x89PNG\r\n\x1a\n",
          "webp": raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"}[DOC_TYPES[body.type]]
    if not ok:
        raise HTTPException(status_code=422, detail="That file doesn't look like a real PDF or image.")
    did = f"edoc_{uuid.uuid4().hex[:16]}"
    await db.space_enquiry_docs.insert_one({"_id": did, "enquiry_id": eid, "teacher_id": _uid(user), "name": body.name.strip()[:160],
                                            "type": body.type, "data": raw, "uploaded_at": _now_iso()})
    meta = {"id": did, "name": body.name.strip()[:160], "type": body.type, "size": len(raw)}
    new = await db.space_enquiries.find_one_and_update({"_id": eid, "status": "draft"},
                                                       {"$push": {"documents": meta}, "$set": {"updated_at": _now_iso()}},
                                                       return_document=ReturnDocument.AFTER)
    space = await db.spaces.find_one({"_id": new["space_id"]})
    return {"ok": True, "enquiry": _view(new, space), "missing": _missing(new)}


@router.delete("/{eid}/documents/{did}")
async def remove_document(eid: str, did: str, user: dict = Depends(current_user)):
    """Detaches the file from the draft (the stored file is kept for the record, never shown again)."""
    _require_teacher(user)
    e = await _own_draft(eid, user)
    if e["status"] != "draft":
        raise HTTPException(status_code=409, detail="Documents can't be changed after the enquiry is sent.")
    new = await db.space_enquiries.find_one_and_update({"_id": eid, "status": "draft"}, {"$pull": {"documents": {"id": did}}},
                                                       return_document=ReturnDocument.AFTER)
    space = await db.spaces.find_one({"_id": new["space_id"]})
    return {"ok": True, "enquiry": _view(new, space), "missing": _missing(new)}


async def _notify_owner(e: dict, space: dict) -> bool:
    to = space.get("owner_email")
    if not to:
        return False
    when = f"{e.get('start_date')}{' – ' + e['end_date'] if e.get('end_date') else ''}"
    html = (f"<p>You have a new enquiry for <b>{escape(space.get('name') or 'your Space')}</b> on NOSTOPS Spaces.</p>"
            f"<p><b>Reference:</b> {escape(e['ref'])}<br><b>Programme:</b> {escape(e.get('programme_title') or '')}<br>"
            f"<b>Teacher:</b> {escape(e.get('teacher_name') or '')}<br><b>Participants:</b> {e.get('participants')}<br>"
            f"<b>Preferred dates:</b> {escape(when)}</p>"
            "<p>An enquiry is not a booking. Please review it and discuss availability or terms with the teacher. "
            "The programme goes ahead only if you both agree. Any financial arrangement is private between you and the "
            "teacher, outside NOSTOPS.</p><p>Open <b>My Spaces</b> in your NOSTOPS account to view the enquiry.</p>")
    try:
        await send_email(to=to, subject=f"New NOSTOPS Space enquiry {e['ref']}", html=html)
        return True
    except Exception as exc:  # noqa: BLE001 — the enquiry stands; the failure is recorded
        print("enquiry email failed:", exc)
        return False


@router.post("/{eid}/send")
async def send(eid: str, user: dict = Depends(current_user)):
    _require_teacher(user)
    e = await _own_draft(eid, user)
    space = await db.spaces.find_one({"_id": e["space_id"]})
    if e["status"] != "draft":
        # Idempotent: a repeat click / retry returns the already-sent enquiry, never a second one.
        return {"ok": True, "already_sent": True, "enquiry": _view(e, space)}
    if not space or space.get("status") != "approved":
        raise HTTPException(status_code=409, detail="This Space is no longer open for enquiries.")
    miss = _missing(e)
    if miss:
        raise HTTPException(status_code=422, detail={"error": "incomplete", "message": "Some details are still missing.", "missing": miss})
    _check_dates(e)
    dup = await db.space_enquiries.find_one({"_id": {"$ne": eid}, "teacher_id": _uid(user), "space_id": e["space_id"],
                                             "status": {"$in": list(OPEN)}, "start_date": e.get("start_date"),
                                             "programme_title_lc": (e.get("programme_title") or "").strip().lower()})
    if dup:
        raise HTTPException(status_code=409, detail={"error": "duplicate", "ref": dup.get("ref"),
                                                     "message": f"You already sent this enquiry to this Space (reference {dup.get('ref')})."})
    now = _now_iso()
    ref = f"NSE-{now[:4]}-{secrets.token_hex(3).upper()}"
    new = await db.space_enquiries.find_one_and_update(
        {"_id": eid, "status": "draft"},
        {"$set": {"status": "sent", "ref": ref, "sent_at": now, "updated_at": now,
                  "programme_title_lc": (e.get("programme_title") or "").strip().lower()},
         "$push": {"history": {"action": "sent", "at": now}}},
        return_document=ReturnDocument.AFTER)
    if not new:  # a parallel request won the race
        cur = await db.space_enquiries.find_one({"_id": eid})
        return {"ok": True, "already_sent": True, "enquiry": _view(cur, space)}
    notified = await _notify_owner(new, space)
    new = await db.space_enquiries.find_one_and_update(
        {"_id": eid}, {"$set": {"owner_notified": notified}, "$push": {"history": {"action": "owner_notified" if notified else "owner_notify_failed", "at": _now_iso()}}},
        return_document=ReturnDocument.AFTER)
    return {"ok": True, "already_sent": False, "enquiry": _view(new, space)}


# ── Owner responses, private conversation and non-financial venue terms (Phase 4 · screen 2) ──────────────────
class RespondIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(max_length=20)
    message: Optional[str] = Field(default=None, max_length=2000)
    proposed_start: Optional[str] = Field(default=None, max_length=10)
    proposed_end: Optional[str] = Field(default=None, max_length=10)
    proposed_time_from: Optional[str] = Field(default=None, max_length=5)
    proposed_time_to: Optional[str] = Field(default=None, max_length=5)


class MessageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=2000)


class TermsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    availability: Optional[str] = Field(default=None, max_length=500)
    facilities: Optional[list[str]] = None
    access: Optional[str] = Field(default=None, max_length=1000)
    conditions: Optional[str] = Field(default=None, max_length=1500)


RESPONSE_LABEL = {"accept": "Accepted in principle", "discuss": "Asked a question", "propose_dates": "Proposed alternative dates",
                  "decline": "Declined"}
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


async def _notify(to: str, subject: str, body_html: str) -> bool:
    if not to:
        return False
    try:
        await send_email(to=to, subject=subject, html=body_html)
        return True
    except Exception as exc:  # noqa: BLE001 — the response stands; the failure is recorded in history
        print("enquiry email failed:", exc)
        return False


def _msg(user: dict, side: str, text: str, kind: str = "message", proposal: Optional[dict] = None) -> dict:
    m = {"id": f"m_{uuid.uuid4().hex[:10]}", "from": side, "name": str(user.get("name") or user.get("email") or ""),
         "text": text, "kind": kind, "at": _now_iso()}
    if proposal:
        m["proposal"] = proposal
    return m


async def _load(eid: str, user: dict, roles: set) -> tuple[dict, str, Optional[dict]]:
    e = await db.space_enquiries.find_one({"_id": eid})
    who, space = (await _access(e, user)) if e else (None, None)
    if who not in roles or e["status"] == "draft":
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    if e["status"] not in RESPONDABLE:
        raise HTTPException(status_code=409, detail="This enquiry is closed and can't be changed.")
    return e, who, space


def _proposal(body: RespondIn) -> dict:
    ps, pe, tf, tt = body.proposed_start or "", body.proposed_end or "", body.proposed_time_from or "", body.proposed_time_to or ""
    try:
        date.fromisoformat(ps)
        if pe:
            date.fromisoformat(pe)
    except ValueError:
        raise HTTPException(status_code=422, detail="Choose the alternative start date (end date optional).")
    if ps < date.today().isoformat() or (pe and pe < ps):
        raise HTTPException(status_code=422, detail="Alternative dates must be in the future and end on or after the start.")
    if any(t and not TIME_RE.match(t) for t in (tf, tt)):
        raise HTTPException(status_code=422, detail="Times must be HH:MM.")
    if tf and tt and tt <= tf:
        raise HTTPException(status_code=422, detail="The end time must be after the start time.")
    return {"start_date": ps, "end_date": pe, "time_from": tf, "time_to": tt, "at": _now_iso()}


@router.post("/{eid}/respond")
async def respond(eid: str, body: RespondIn, user: dict = Depends(current_user)):
    e, who, space = await _load(eid, user, {"owner", "admin"})
    if body.action not in RESPONSES:
        raise HTTPException(status_code=422, detail="Choose a valid response.")
    text = (body.message or "").strip()
    if body.action == "decline" and not text:
        raise HTTPException(status_code=422, detail="Add a reason for declining.")
    if body.action == "discuss" and not text:
        raise HTTPException(status_code=422, detail="Write your question or message.")
    proposal = _proposal(body) if body.action == "propose_dates" else None
    status, label, now = RESPONSES[body.action], RESPONSE_LABEL[body.action], _now_iso()
    upd: dict = {"$set": {"status": status, "updated_at": now, "decided_at": now},
                 "$push": {"messages": _msg(user, "owner", text or label, body.action, proposal),
                           "history": {"action": "alternative_dates_proposed" if proposal else status, "at": now, "by": who, "note": text}}}
    if proposal:
        upd["$set"]["proposal"] = proposal
    if body.action == "decline":
        upd["$set"]["decline_reason"] = text
    # Compare-and-set: a closed (declined) enquiry can never be re-opened or answered twice in a race.
    new = await db.space_enquiries.find_one_and_update({"_id": eid, "status": {"$in": list(RESPONDABLE)}}, upd,
                                                       return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This enquiry is closed and can't be changed.")
    prop = ""
    if proposal:
        prop = f"<p><b>Proposed dates:</b> {escape(proposal['start_date'])}{' – ' + escape(proposal['end_date']) if proposal['end_date'] else ''}"
        prop += f" · {escape(proposal['time_from'])}–{escape(proposal['time_to'])}</p>" if proposal["time_from"] and proposal["time_to"] else "</p>"
    extra = {"accept": "<p><b>Accepted in principle is not a confirmed booking.</b> The programme proceeds only after you both agree on all details.</p>",
             "decline": f"<p><b>Reason:</b> {escape(text)}</p>"}.get(body.action, "")
    ok = await _notify(new.get("teacher_email", ""), f"Update on your Space enquiry {new.get('ref')}: {label}",
                       f"<p>The owner of <b>{escape(new.get('space_name') or 'the Space')}</b> responded to your enquiry "
                       f"<b>{escape(new.get('ref') or '')}</b>: <b>{label}</b>.</p>"
                       f"{'<p>' + escape(text) + '</p>' if text and body.action != 'decline' else ''}{prop}{extra}"
                       "<p>Any financial arrangement is private between you and the owner, outside NOSTOPS.</p>"
                       "<p>Open <b>My Enquiries</b> in NOSTOPS to reply.</p>")
    new = await db.space_enquiries.find_one_and_update(
        {"_id": eid}, {"$push": {"history": {"action": "teacher_notified" if ok else "teacher_notify_failed", "at": _now_iso()}}},
        return_document=ReturnDocument.AFTER)
    return {"ok": True, "teacher_notified": ok, "enquiry": _view(new, space)}


@router.post("/{eid}/messages")
async def post_message(eid: str, body: MessageIn, user: dict = Depends(current_user)):
    e, who, space = await _load(eid, user, {"teacher", "owner", "admin"})
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Write a message.")
    side = "teacher" if who == "teacher" else "owner"
    upd: dict = {"$push": {"messages": _msg(user, side, text)}, "$set": {"updated_at": _now_iso()}}
    if side == "owner" and e["status"] == "sent":
        upd["$set"]["status"] = "in_discussion"
        upd["$push"]["history"] = {"action": "in_discussion", "at": _now_iso(), "by": who}
    new = await db.space_enquiries.find_one_and_update({"_id": eid, "status": {"$in": list(RESPONDABLE)}}, upd,
                                                       return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This enquiry is closed, so no new messages can be added.")
    to = new.get("teacher_email") if side == "owner" else (space or {}).get("owner_email", "")
    await _notify(to or "", f"New message on Space enquiry {new.get('ref')}",
                  f"<p>New message from the {'Space owner' if side == 'owner' else 'teacher'} on enquiry "
                  f"<b>{escape(new.get('ref') or '')}</b>:</p><p>{escape(text)}</p><p>Open NOSTOPS to reply.</p>")
    return {"ok": True, "enquiry": _view(new, space)}


MONEY_KEY_RE = re.compile(r"price|fee|rent|percent|commission|payout|revenue|share|amount|cost|charge|rate|deposit|payment|money",
                          re.I)
# Financial wording inside venue-term free text (availability / access / conditions). Conversation messages are NOT scanned.
# ── Financial wording in venue-term free text (availability / access / conditions) ──────────────────────────────
# Contextual, not isolated keywords: ambiguous words (deposit, charge, pay, cost, advance, split, share, %, "per day")
# only count when they appear in a financial context (an amount, currency, or money object). Conversation messages
# are NOT scanned.
_N = r"\d[\d,]*(?:\.\d+)?"
_CUR = r"(?:[₹$€£]|\b(?:rs|inr|usd)\b\.?|\brupees?\b)"
_AMT = rf"(?:{_CUR}\s*{_N}|{_N}\s*(?:/-|{_CUR})|\b(?:rs|inr|usd)\.?\s*\d)"
_PERIOD = r"(?:monthly|weekly|daily|yearly|annually|per\s+(?:month|hour|hr|day|week|year|session|class|participant|person|head|student|batch)|" \
          r"an?\s+(?:month|week|year|session|class|hour)|/\s*(?:month|mo|hr|hour|day|week|session|class))\b"
_CAPACITY = r"(?:max|maximum|up\s*to|upto|limit(?:ed)?(?:\s+to)?|at\s+most|only|capacity(?:\s+of)?|no\s+more\s+than|not\s+more\s+than)"
MONEY_TEXT_OK = re.compile(
    r"\b(?:free\s+of\s+(?:any\s+)?charges?|without\s+(?:any\s+)?charges?|no\s+(?:extra\s+|additional\s+)?(?:charges?|costs?|fees?|rent)|"
    r"at\s+no\s+(?:extra\s+|additional\s+)?cost|paid\s+parking|charging\s+(?:points?|stations?|sockets?|ports?))\b", re.I)
MONEY_TEXT_PATTERNS = [re.compile(p, re.I) for p in (
    rf"{_CUR}|\b(?:rs|inr|usd)\.?\s*\d",                                                       # ₹ / Rs / INR / rupees / Rs5000
    r"\b(?:rent|rents|rental|rented|fees?|tariffs?|commissions?|honorari(?:um|a)|royalt(?:y|ies)|payouts?|payments?|payable|"
    r"remuneration|stipend|prices?|pricing|priced|revenue|profits?|earnings|percentages?|refund(?:s|able)?|lakhs?|lacs?|crores?|"
    r"invoices?|gst|billing|billed)\b",                                                        # always financial
    rf"{_N}\s*(?:k|thousand|lakh|lac|crore)\b",                                                # 5k, 2 lakh
    rf"{_PERIOD}\W{{0,3}}\d{{3,}}",                                                            # per session 5000
    r"\b\d{1,3}\s*[:/]\s*\d{1,3}\b(?:\s+\w+){0,2}?\s+(?:share|sharing|split|ratio|basis|division|arrangement|deal)\b",  # 60:40 share
    r"\b(?:share|split|ratio)\s+(?:of\s+)?\d{1,3}\s*[:/]\s*\d{1,3}\b",                          # split 70/30
    r"\d+\s*(?:%|percent)(?:\s+\w+){0,3}?\s+(?:share|cut|commission|of\s+(?:the\s+)?(?:fees?|revenue|income|earnings|profits?|"
    r"takings|collections?|sales|tickets?)|to\s+(?:the\s+)?(?:owner|venue|nostops|space))\b",  # 10% share / 20% of fees
    r"\b(?:owner|venue|space)\s+(?:takes|gets|keeps|receives)\s+(?:a\s+)?\d+\s*(?:%|percent)",
    r"\b(?:security|refundable|caution|advance|cash)\s+deposits?\b|\bdeposits?\s+(?:of|amount|money|is|are|required|payable|"
    r"needed|mandatory|applies|refunded|\d)\b|\d\s*deposits?\b",                               # deposit (money), not "deposit bags"
    r"\bcharges\b|\b(?:service|extra|additional|usage|hall|venue|room|cleaning|maintenance|electricity|hourly|daily|monthly|"
    r"nominal|small|flat|fixed|one-time)\s+charges?\b|\bcharged?\s+(?:of|at|per|extra|separately)\s*(?:\d|\w*\s*\d)?|"
    r"\bcharge(?:s|d)?\s+(?:is|will|applies|apply)\b|\bcharged?\s+\d",                        # charges, not "charge your phone"
    r"\bcosts?\s+(?:of|per|is|are|will|extra|shared|sharing|\d)|\bcost[- ]shar|\bat\s+cost\b|\d\s*cost",
    r"\bpay(?:s|ing)?\s+(?:\d|the\s+(?:owner|venue|rent|fee|amount|hall|space)|for\s+(?:the\s+)?(?:hall|space|venue|use|usage|"
    r"session|room)|monthly|weekly|upfront|up\s+front|in\s+advance|in\s+cash|online|per|extra|separately)|\bpaid\s+(?:to|upfront|"
    r"in\s+advance|in\s+cash|monthly|weekly|by|separately|directly|per|\d)",                     # pay 500, not "pay attention"
    r"\badvance\s+(?:of|payment|amount|money|deposit|\d)|\d\s*(?:k|lakh|lac|thousand|crore)?\s*advance\b|\ban\s+advance\s+of\b",
    r"\b(?:donations?|contributions?|offerings?)\W+(?:of\W+)?\d|\d[\d,]*\s*(?:as\s+)?(?:an?\s+)?(?:donation|contribution)|"
    r"\b(?:suggested|voluntary|minimum|monthly|fixed)\s+(?:donation|contribution)s?\b",
    r"\b(?:revenue|profit|income|earnings?|fees?|collections?|takings|ticket)\s+(?:share|sharing|split)|"
    r"\b(?:share|split)\s+(?:of\s+)?(?:the\s+)?(?:revenue|profits?|income|earnings|fees?|collections?|takings)",
    r"\b(?:hourly|daily|monthly|session|hall|venue|usage)\s+rates?\b|\brates?\s*(?:of|:|is)\s*\d",
    r"\bamount\s+(?:of\s+)?\d|\b(?:total|fixed|agreed|advance|token)\s+amount\b",
)]
PER_PERIOD_RE = re.compile(rf"(?<![\w.]){_N}\s*(?:/-\s*)?{_PERIOD}", re.I)  # 5000 monthly, 500 per class
_CAPACITY_BEFORE = re.compile(rf"\b{_CAPACITY}\s*$", re.I)


def money_in_text(text: str) -> bool:
    """True if the text describes a financial arrangement or amount (in context, not by isolated keywords)."""
    t = MONEY_TEXT_OK.sub(" ", text or "")
    if any(p.search(t) for p in MONEY_TEXT_PATTERNS):
        return True
    # "<number> per <period>" is money unless it follows a capacity word ("Max 2 per day").
    return any(not _CAPACITY_BEFORE.search(t[:m.start()]) for m in PER_PERIOD_RE.finditer(t))


@router.put("/{eid}/venue-terms")
async def venue_terms(eid: str, raw: dict = Body(...), user: dict = Depends(current_user)):
    """Non-financial venue terms for this enquiry: availability, facilities, access arrangements, conditions. No fees.
    Partial update: only the fields sent are changed; omitted fields keep their saved values."""
    money = sorted(k for k in raw if MONEY_KEY_RE.search(str(k)))
    if money:
        raise HTTPException(status_code=422, detail={"message": (
            "Venue terms can't include financial fields (" + ", ".join(money) + "). NOSTOPS Spaces has no prices, fees, "
            "rent, percentages, commissions or payouts. Only availability, facilities, access and conditions can be saved."),
            "rejected_fields": money})
    try:
        body = TermsIn(**raw)
    except ValidationError as err:
        unknown = [str(x["loc"][0]) for x in err.errors() if x.get("type") == "extra_forbidden" and x.get("loc")]
        msg = (f"Unknown field(s): {', '.join(unknown)}. Only availability, facilities, access and conditions can be saved."
               if unknown else "Please check the venue terms and try again.")
        raise HTTPException(status_code=422, detail={"message": msg, "errors": err.errors(include_url=False, include_context=False)})
    money_text = sorted(k for k in ("availability", "access", "conditions") if money_in_text(getattr(body, k) or ""))
    if money_text:
        raise HTTPException(status_code=422, detail={"message": (
            "Venue terms can't mention money (" + ", ".join(money_text) + "): no rent, fees, charges, deposits, commissions, "
            "percentages or amounts. Describe only availability, facilities, access and conditions. Nothing was saved."),
            "rejected_fields": money_text})
    e, who, space = await _load(eid, user, {"owner", "admin"})
    terms = {"availability": "", "access": "", "conditions": "", "facilities": [], **(e.get("venue_terms") or {})}
    for k in body.model_fields_set:
        v = getattr(body, k)
        terms[k] = [f for f in dict.fromkeys(v or []) if f in FACILITIES] if k == "facilities" else (v or "").strip()
    terms["updated_at"] = _now_iso()
    new = await db.space_enquiries.find_one_and_update(
        {"_id": eid, "status": {"$in": list(RESPONDABLE)}},
        {"$set": {"venue_terms": terms, "updated_at": _now_iso()},
         "$push": {"history": {"action": "venue_terms_updated", "at": _now_iso(), "by": who}}},
        return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This enquiry is closed and can't be changed.")
    return {"ok": True, "enquiry": _view(new, space)}

