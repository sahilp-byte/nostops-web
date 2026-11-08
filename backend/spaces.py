"""Phase 3 — NOSTOPS Spaces: listing, owner onboarding and admin verification (India only).

Owner decisions (June 2026):
  * Anyone with a NOSTOPS account can list a Space; every Space is checked by NOSTOPS admins before it is public.
  * Required private documents: ownership/permission proof, society/building NOC, government photo ID, address proof.
  * Models: Commercial / Subsidised / Community are the ONLY three official participation models and are
    classifications only (Phase 1b). Spaces never store, calculate, collect or distribute prices, rents, revenue
    shares, commissions or payouts: any teacher–owner arrangement is a private agreement outside NOSTOPS.
    Unknown request fields are rejected (422), so no financial field can be written.
  * Admins verify, with an optional site-visit checklist. History is kept for every action.

Location always goes through spaces_localities.validate_india_location (country = "IN" set server-side).
Global Venues (`venue_submissions`) are never read or written here.
"""
import base64
import re
import uuid
from html import escape
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from email_util import send_email
from spaces_localities import _slug as _loc_slug, lookup_pin, validate_india_location
from venues import _check_secret, _now_iso, _require_admin, current_user, db

router = APIRouter(prefix="/api/spaces", tags=["spaces"])

MODELS = {"commercial", "subsidised", "community"}
SPACE_TYPES = {"community_hall", "yoga_studio", "school_college", "society_clubhouse", "temple_ashram", "office_corporate",
               "park_open_space", "home_studio", "other"}
FACILITIES = {"mats", "props", "changing_room", "washroom", "drinking_water", "parking", "fans", "air_conditioning",
              "sound_system", "projector", "wheelchair_access", "natural_light", "outdoor_area", "storage"}
DOC_KINDS = {"ownership_proof": "Proof of ownership or permission letter", "society_noc": "Society or building NOC",
             "photo_id": "Government photo ID", "address_proof": "Address proof"}
DOC_TYPES = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_DOC_BYTES = 4 * 1024 * 1024
EDITABLE = {"draft", "changes_requested", "rejected"}
STATUSES = {"draft", "submitted", "changes_requested", "approved", "rejected", "unlisted", "withdrawn"}
DECISIONS = {"approve": "approved", "reject": "rejected", "request_changes": "changes_requested"}
# Admin listing controls for an already-approved Space: unlist hides it from public discovery (nothing is
# deleted; ownership, history and audit are kept); relist makes it public again.
LISTING_ACTIONS = {"unlist": ("approved", "unlisted"), "relist": ("unlisted", "approved")}
CHECKLIST = ("address_matches", "space_matches_photos", "capacity_confirmed", "safe_and_clean", "washroom_water",
             "documents_match_owner")
MAX_PHOTOS = 5


def _uid(user: dict) -> str:
    return str(user.get("user_id"))


def _actor(user: dict) -> str:
    return str(user.get("name") or user.get("email") or user.get("user_id"))


def _hist(user: dict, action: str, note: Optional[str] = None) -> dict:
    return {"action": action, "actor": _actor(user), "actor_role": str(user.get("role") or ""), "at": _now_iso(),
            **({"note": note} if note else {})}


def _public(s: dict) -> dict:
    """Fields safe for the public Space page: no owner identity, contact details, documents or history."""
    return {k: s.get(k) for k in ("name", "space_type", "model", "description", "capacity", "area_sqft", "facilities",
                                  "availability", "photos", "location", "landmark")} | {"id": s["_id"]}


def _owner_view(s: dict) -> dict:
    out = {k: s.get(k) for k in ("status", "name", "space_type", "model", "description", "capacity", "area_sqft", "facilities",
                                 "availability", "photos", "location", "address_line", "landmark", "contact_name",
                                 "contact_phone", "contact_email", "created_at", "updated_at", "submitted_at", "decided_at",
                                 "decision_note")}
    out["id"] = s["_id"]
    out["documents"] = [{k: d.get(k) for k in ("id", "kind", "name", "type", "uploaded_at")} for d in s.get("documents", [])]
    out["history"] = [{k: h.get(k) for k in ("action", "actor", "at", "note")} for h in s.get("history", [])]
    return out


def _admin_view(s: dict) -> dict:
    return _owner_view(s) | {k: s.get(k) for k in ("owner_id", "owner_name", "owner_email", "decided_by", "site_visit")} | {
        "history": s.get("history", [])}


def _missing(s: dict) -> list[str]:
    """What still blocks submission (shown on Review & Submit)."""
    miss = []
    if not (s.get("location") or {}).get("locality_id"):
        miss.append("PIN code and locality")
    if not (s.get("address_line") or "").strip():
        miss.append("Street address")
    if not (s.get("name") or "").strip():
        miss.append("Space name")
    if s.get("space_type") not in SPACE_TYPES:
        miss.append("Type of space")
    if not s.get("capacity"):
        miss.append("Capacity")
    if len((s.get("description") or "").strip()) < 40:
        miss.append("Description (at least 40 characters)")
    if not (s.get("contact_phone") or "").strip():
        miss.append("Contact phone")
    if s.get("model") not in MODELS:
        miss.append("Space model")
    if not s.get("photos"):
        miss.append("At least one photo")
    have = {d.get("kind") for d in s.get("documents", [])}
    miss += [label for k, label in DOC_KINDS.items() if k not in have]
    return miss


class SpaceIn(BaseModel):
    # Phase 1b: unknown fields (e.g. price, rent, revenue_share, commission, payout) are refused, never stored.
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, max_length=120)
    space_type: Optional[str] = Field(default=None, max_length=40)
    model: Optional[str] = Field(default=None, max_length=20)
    description: Optional[str] = Field(default=None, max_length=3000)
    capacity: Optional[int] = Field(default=None, ge=1, le=5000)
    area_sqft: Optional[int] = Field(default=None, ge=1, le=1_000_000)
    facilities: Optional[list[str]] = None
    availability: Optional[str] = Field(default=None, max_length=500)
    photos: Optional[list[str]] = None
    pin: Optional[str] = Field(default=None, max_length=12)
    locality_id: Optional[str] = Field(default=None, max_length=80)
    country: Optional[str] = Field(default=None, max_length=60)
    address_line: Optional[str] = Field(default=None, max_length=300)
    landmark: Optional[str] = Field(default=None, max_length=160)
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    contact_email: Optional[str] = Field(default=None, max_length=160)
    expected_updated_at: Optional[str] = Field(default=None, max_length=40)


async def _clean(body: SpaceIn, user: dict, current: Optional[dict] = None) -> dict:
    data = body.model_dump(exclude_unset=True)
    data.pop("expected_updated_at", None)
    out: dict = {}
    for k in ("name", "description", "availability", "address_line", "landmark", "contact_name", "contact_email"):
        if k in data:
            out[k] = (data[k] or "").strip()
    if "contact_phone" in data:
        phone = re.sub(r"[^\d+]", "", data["contact_phone"] or "")
        if phone and not re.match(r"^(\+91)?[6-9]\d{9}$", phone):
            raise HTTPException(status_code=422, detail="Enter a valid Indian mobile number (10 digits).")
        out["contact_phone"] = phone
    if "space_type" in data:
        if data["space_type"] not in SPACE_TYPES:
            raise HTTPException(status_code=422, detail="Choose a valid type of space.")
        out["space_type"] = data["space_type"]
    if "model" in data:
        if data["model"] not in MODELS:
            raise HTTPException(status_code=422, detail="Choose Commercial, Subsidised or Community.")
        out["model"] = data["model"]
    for k in ("capacity", "area_sqft"):
        if k in data:
            out[k] = data[k]
    if "facilities" in data:
        out["facilities"] = [f for f in dict.fromkeys(data["facilities"] or []) if f in FACILITIES]
    if "photos" in data:
        # Only this user's own NOSTOPS uploads (/bff/venue/photo) or photos already on this Space.
        safe_uid = re.sub(r"[^a-zA-Z0-9_-]", "", _uid(user))[:40] or "owner"
        own = re.compile(rf"^/bff/media/retreats/{re.escape(safe_uid)}/[0-9a-f-]{{36}}\.(jpg|png|webp)$")
        existing = (current or {}).get("photos") or []
        photos = list(dict.fromkeys(data["photos"] or []))
        if any(not (isinstance(p, str) and (own.match(p) or p in existing)) for p in photos):
            raise HTTPException(status_code=400, detail="Photos must be uploaded through NOSTOPS.")
        out["photos"] = photos[:MAX_PHOTOS]
    if "pin" in data or "locality_id" in data or "country" in data:
        out["location"] = await validate_india_location(data.get("pin") or "", data.get("locality_id") or "", data.get("country"))
        out["location"].pop("ok", None)
    return out


async def _audit(space_id: str, user: dict, action: str, **extra) -> None:
    await db.space_audit.insert_one({"_id": f"spa_{uuid.uuid4().hex[:16]}", "space_id": space_id, "actor_id": _uid(user),
                                     "actor": _actor(user), "actor_role": str(user.get("role") or ""), "action": action,
                                     "at": _now_iso(), **extra})


async def _own(sid: str, user: dict) -> dict:
    s = await db.spaces.find_one({"_id": sid})
    if not s or s.get("owner_id") != _uid(user):
        raise HTTPException(status_code=404, detail="Space not found.")
    return s


# ── Owner ─────────────────────────────────────────────────────────────────────
@router.post("/mine")
async def create_space(body: SpaceIn, user: dict = Depends(current_user)):
    data = await _clean(body, user)
    if not data.get("location"):
        raise HTTPException(status_code=422, detail="Start with the Space's PIN code and locality.")
    if await db.spaces.count_documents({"owner_id": _uid(user), "status": "draft"}) >= 5:
        raise HTTPException(status_code=429, detail="You already have 5 unfinished Spaces. Finish or submit one first.")
    now = _now_iso()
    sid = f"spc_{uuid.uuid4().hex[:16]}"
    doc = {"_id": sid, "owner_id": _uid(user), "owner_name": str(user.get("name") or ""), "owner_email": str(user.get("email") or ""),
           "status": "draft", "documents": [], "photos": [], "facilities": [], **data, "created_at": now, "updated_at": now,
           "history": [_hist(user, "created")]}
    await db.spaces.insert_one(doc)
    await _audit(sid, user, "created")
    return {"ok": True, "space": _owner_view(doc), "missing": _missing(doc)}


@router.get("/mine")
async def my_spaces(user: dict = Depends(current_user)):
    items = await db.spaces.find({"owner_id": _uid(user)}).sort("updated_at", -1).to_list(100)
    return {"ok": True, "items": [_owner_view(s) | {"missing": _missing(s)} for s in items]}


@router.get("/mine/{sid}")
async def my_space(sid: str, user: dict = Depends(current_user)):
    s = await _own(sid, user)
    return {"ok": True, "space": _owner_view(s), "missing": _missing(s)}


@router.patch("/mine/{sid}")
async def update_space(sid: str, body: SpaceIn, user: dict = Depends(current_user)):
    s = await _own(sid, user)
    if s["status"] not in EDITABLE:
        raise HTTPException(status_code=409, detail="This Space is with NOSTOPS for review or already approved, so it can't be edited now.")
    data = await _clean(body, user, s)
    if not data:
        return {"ok": True, "space": _owner_view(s), "missing": _missing(s)}
    q = {"_id": sid, "owner_id": _uid(user), "status": {"$in": list(EDITABLE)}}
    if body.expected_updated_at:
        q["updated_at"] = body.expected_updated_at
    new = await db.spaces.find_one_and_update(q, {"$set": {**data, "updated_at": _now_iso()}}, return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This Space was changed somewhere else. Reload to see the latest version.")
    return {"ok": True, "space": _owner_view(new), "missing": _missing(new)}


class DocIn(BaseModel):
    kind: str = Field(max_length=30)
    name: str = Field(max_length=160)
    type: str = Field(max_length=60)
    base64: str = Field(max_length=6_000_000)


@router.post("/mine/{sid}/documents")
async def upload_document(sid: str, body: DocIn, user: dict = Depends(current_user)):
    s = await _own(sid, user)
    if s["status"] not in EDITABLE:
        raise HTTPException(status_code=409, detail="Documents can't be changed while the Space is under review or approved.")
    if body.kind not in DOC_KINDS:
        raise HTTPException(status_code=422, detail="Unknown document type.")
    if body.type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail="Upload a PDF, JPG, PNG or WebP file.")
    try:
        raw = base64.b64decode(body.base64.split(",", 1)[-1], validate=True)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read that file.")
    if not raw or len(raw) > MAX_DOC_BYTES:
        raise HTTPException(status_code=422, detail="Each document must be 4 MB or smaller.")
    sig_ok = {"pdf": raw[:4] == b"%PDF", "jpg": raw[:3] == b"\xff\xd8\xff", "png": raw[:8] == b"\x89PNG\r\n\x1a\n",
              "webp": raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"}[DOC_TYPES[body.type]]
    if not sig_ok:
        raise HTTPException(status_code=422, detail="That file doesn't look like a real PDF or image.")
    did = f"sdoc_{uuid.uuid4().hex[:16]}"
    now = _now_iso()
    # Older file of the same kind stays stored (kept for the audit trail) but is no longer listed on the Space.
    await db.space_docs.insert_one({"_id": did, "space_id": sid, "owner_id": _uid(user), "kind": body.kind,
                                    "name": body.name.strip()[:160], "type": body.type, "data": raw, "uploaded_at": now})
    meta = {"id": did, "kind": body.kind, "name": body.name.strip()[:160], "type": body.type, "uploaded_at": now}
    docs = [d for d in s.get("documents", []) if d.get("kind") != body.kind] + [meta]
    new = await db.spaces.find_one_and_update({"_id": sid, "status": {"$in": list(EDITABLE)}},
                                              {"$set": {"documents": docs, "updated_at": now}},
                                              return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This Space is no longer editable.")
    await _audit(sid, user, "document_uploaded", kind=body.kind, doc_id=did)
    return {"ok": True, "space": _owner_view(new), "missing": _missing(new)}


@router.post("/mine/{sid}/submit")
async def submit_space(sid: str, user: dict = Depends(current_user)):
    s = await _own(sid, user)
    if s["status"] not in EDITABLE:
        raise HTTPException(status_code=409, detail="This Space has already been submitted.")
    miss = _missing(s)
    if miss:
        raise HTTPException(status_code=422, detail={"error": "incomplete", "message": "Some details are still missing.", "missing": miss})
    now = _now_iso()
    new = await db.spaces.find_one_and_update(
        {"_id": sid, "status": s["status"]},
        {"$set": {"status": "submitted", "submitted_at": now, "updated_at": now, "decision_note": ""}, "$push": {"history": _hist(user, "submitted")}},
        return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This Space was changed somewhere else. Reload and try again.")
    await _audit(sid, user, "submitted")
    return {"ok": True, "space": _owner_view(new), "missing": []}


def _norm_txt(v) -> str:
    return re.sub(r"[^a-z0-9]", "", str(v or "").lower())


@router.get("/mine/{sid}/duplicates")
async def my_space_duplicates(sid: str, user: dict = Depends(current_user)):
    """Warning only (never blocks): this owner's OTHER Spaces at the same official locality with the same
    address line or the same name. Withdrawn drafts are ignored. Nothing is changed."""
    s = await _own(sid, user)
    lid = (s.get("location") or {}).get("locality_id")
    if not lid:
        return {"ok": True, "duplicates": []}
    addr, name = _norm_txt(s.get("address_line")), _norm_txt(s.get("name"))
    others = await db.spaces.find({"owner_id": _uid(user), "_id": {"$ne": sid}, "location.locality_id": lid,
                                   "status": {"$ne": "withdrawn"}}, {"name": 1, "status": 1, "address_line": 1}).to_list(50)
    dups = [{"id": o["_id"], "name": o.get("name") or "Untitled Space", "status": o.get("status"),
             "same_address": bool(addr) and _norm_txt(o.get("address_line")) == addr, "same_name": bool(name) and _norm_txt(o.get("name")) == name}
            for o in others]
    return {"ok": True, "duplicates": [d for d in dups if d["same_address"] or d["same_name"]]}


@router.post("/mine/{sid}/withdraw")
async def withdraw_draft(sid: str, user: dict = Depends(current_user)):
    """Owner withdraws their own NEVER-submitted draft. Soft status change only — the record, documents and history
    are kept; submitted, reviewed, approved or unlisted Spaces cannot be withdrawn here."""
    s = await _own(sid, user)
    if s["status"] != "draft" or s.get("submitted_at"):
        raise HTTPException(status_code=409, detail="Only an unfinished draft that was never submitted can be withdrawn.")
    now = _now_iso()
    new = await db.spaces.find_one_and_update(
        {"_id": sid, "owner_id": _uid(user), "status": "draft", "submitted_at": {"$in": [None, ""]}},
        {"$set": {"status": "withdrawn", "withdrawn_at": now, "updated_at": now}, "$push": {"history": _hist(user, "withdrawn")}},
        return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This Space was changed somewhere else. Reload and try again.")
    await _audit(sid, user, "withdrawn")
    return {"ok": True, "space": _owner_view(new), "missing": _missing(new)}


# ── Admin ─────────────────────────────────────────────────────────────────────
@router.get("/admin")
async def admin_list(status: str = "submitted", user: dict = Depends(current_user)):
    _require_admin(user)
    q = {} if status == "all" else {"status": status if status in STATUSES else "submitted"}
    items = await db.spaces.find(q, {"history": 0}).sort("updated_at", -1).to_list(300)
    counts = {st: await db.spaces.count_documents({"status": st}) for st in STATUSES}
    return {"ok": True, "counts": counts,
            "items": [{k: s.get(k) for k in ("status", "name", "model", "space_type", "location", "owner_name", "owner_email",
                                              "submitted_at", "updated_at", "capacity")} | {"id": s["_id"], "has_site_visit": bool(s.get("site_visit"))}
                      for s in items]}


@router.get("/admin/doc/{did}")
async def admin_doc(did: str, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await db.space_docs.find_one({"_id": did})
    if not d:
        raise HTTPException(status_code=404, detail="Document not found.")
    await _audit(d["space_id"], user, "document_viewed", doc_id=did)
    return {"type": d["type"], "name": d["name"], "base64": base64.b64encode(d["data"]).decode()}


@router.get("/admin/{sid}")
async def admin_get(sid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    s = await db.spaces.find_one({"_id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Space not found.")
    return {"ok": True, "space": _admin_view(s), "missing": _missing(s), "checklist_keys": list(CHECKLIST)}


class SiteVisitIn(BaseModel):
    checklist: dict[str, bool] = {}
    visited_on: Optional[str] = Field(default=None, max_length=10)
    notes: Optional[str] = Field(default=None, max_length=2000)


@router.put("/admin/{sid}/site-visit")
async def admin_site_visit(sid: str, body: SiteVisitIn, user: dict = Depends(current_user)):
    _require_admin(user)
    if body.visited_on and not re.match(r"^\d{4}-\d{2}-\d{2}$", body.visited_on):
        raise HTTPException(status_code=422, detail="Visit date must be YYYY-MM-DD.")
    visit = {"checklist": {k: bool(body.checklist.get(k)) for k in CHECKLIST}, "visited_on": body.visited_on or "",
             "notes": (body.notes or "").strip(), "by": _actor(user), "at": _now_iso()}
    new = await db.spaces.find_one_and_update({"_id": sid}, {"$set": {"site_visit": visit}, "$push": {"history": _hist(user, "site_visit_recorded")}},
                                              return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=404, detail="Space not found.")
    await _audit(sid, user, "site_visit_recorded")
    return {"ok": True, "space": _admin_view(new)}


class DecisionIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


async def _email_owner(s: dict, status: str, note: str) -> None:
    to = s.get("owner_email")
    if not to:
        return
    name = escape(s.get("name") or "your Space")
    msg = {"approved": f"Good news: <b>{name}</b> has been approved and is now listed on NOSTOPS Spaces.",
           "rejected": f"<b>{name}</b> was not approved for NOSTOPS Spaces.",
           "changes_requested": f"NOSTOPS needs a few changes to <b>{name}</b> before it can be approved."}[status]
    extra = f"<p><b>Note from NOSTOPS:</b> {escape(note)}</p>" if note else ""
    subj = {"approved": "Your Space is live on NOSTOPS", "rejected": "Update on your NOSTOPS Space",
            "changes_requested": "Changes needed for your NOSTOPS Space"}[status]
    try:
        await send_email(to=to, subject=subj, html=f"<p>{msg}</p>{extra}<p>Open <b>My Spaces</b> in your NOSTOPS account to see the details.</p>")
    except Exception as exc:  # noqa: BLE001 — email is best-effort; the decision stands
        print("space email failed:", exc)


async def _listing_action(sid: str, action: str, note: str, user: dict) -> dict:
    if action == "unlist" and not note:
        raise HTTPException(status_code=422, detail="Add a reason for unlisting this Space.")
    frm, to = LISTING_ACTIONS[action]
    now = _now_iso()
    new = await db.spaces.find_one_and_update(
        {"_id": sid, "status": frm},
        {"$set": {"status": to, "listing_changed_at": now, "listing_changed_by": _actor(user), "listing_note": note, "updated_at": now},
         "$push": {"history": _hist(user, to, note)}},
        return_document=ReturnDocument.AFTER)
    if not new:
        if not await db.spaces.find_one({"_id": sid}, {"_id": 1}):
            raise HTTPException(status_code=404, detail="Space not found.")
        raise HTTPException(status_code=409, detail=f"Only an {'approved' if action == 'unlist' else 'unlisted'} Space can be {action}ed.")
    await _audit(sid, user, to, note=note)
    return {"ok": True, "space": _admin_view(new)}


@router.post("/admin/{sid}/{decision}")
async def admin_decide(sid: str, decision: str, body: DecisionIn, user: dict = Depends(current_user)):
    _require_admin(user)
    if decision in LISTING_ACTIONS:
        return await _listing_action(sid, decision, (body.note or "").strip(), user)
    if decision not in DECISIONS:
        raise HTTPException(status_code=404, detail="Unknown decision.")
    note = (body.note or "").strip()
    if decision in ("reject", "request_changes") and not note:
        raise HTTPException(status_code=422, detail="Add a note so the owner knows why.")
    status = DECISIONS[decision]
    now = _now_iso()
    # Compare-and-set: only a submitted Space can be decided, so two admins can't both decide it.
    new = await db.spaces.find_one_and_update(
        {"_id": sid, "status": "submitted"},
        {"$set": {"status": status, "decided_at": now, "decided_by": _actor(user), "decision_note": note, "updated_at": now},
         "$push": {"history": _hist(user, status, note)}},
        return_document=ReturnDocument.AFTER)
    if not new:
        if not await db.spaces.find_one({"_id": sid}, {"_id": 1}):
            raise HTTPException(status_code=404, detail="Space not found.")
        raise HTTPException(status_code=409, detail="This Space is not waiting for a decision (someone may have decided it already).")
    await _audit(sid, user, status, note=note)
    await _email_owner(new, status, note)
    return {"ok": True, "space": _admin_view(new)}


# ── Public (shared secret only; approved Spaces only) ────────────────────────
@router.get("/public/search")
async def public_search(pin: str, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    lk = await lookup_pin(pin)
    fields = {"history": 0, "documents": 0, "owner_email": 0, "owner_id": 0, "contact_phone": 0, "contact_email": 0}
    exact = await db.spaces.find({"status": "approved", "location.pin": lk["pin"]}, fields).sort("name", 1).to_list(60)
    nearby = await db.spaces.find({"status": "approved", "location.pin": {"$ne": lk["pin"]},
                                   "location.district": {"$in": lk["districts"]}, "location.state": lk["state"]},
                                  fields).sort("name", 1).to_list(60)
    return {"ok": True, "pin": lk["pin"], "district": lk["district"], "state": lk["state"], "districts": lk["districts"],
            "localities": [{"id": l["id"], "name": l["name"], "taluk": l["taluk"]} for l in lk["localities"]],
            "exact": [_public(s) for s in exact], "nearby": [_public(s) for s in nearby]}


@router.get("/public/sitemap")
async def public_sitemap(x_pulse_secret: Optional[str] = Header(None)):
    """Approved, publicly visible Spaces for the sitemap: id + last update only (no names, owners or locations)."""
    _check_secret(x_pulse_secret)
    rows = await db.spaces.find({"status": "approved", "_id": {"$not": re.compile(r"^(spc_qa_|TEST_)")},
                                 "name": {"$not": re.compile(r"^TEST_", re.I)}},
                                {"updated_at": 1}).sort("updated_at", -1).to_list(5000)
    return {"ok": True, "items": [{"id": r["_id"], "updated_at": r.get("updated_at")} for r in rows]}


_QA_ID = re.compile(r"^(spc_qa_|TEST_)")
_QA_NAME = re.compile(r"^TEST_", re.I)
_PUBLIC_FIELDS = {"history": 0, "documents": 0, "owner_email": 0, "owner_id": 0, "contact_phone": 0, "contact_email": 0}


def _genuine(s: dict) -> bool:
    return not _QA_ID.match(str(s.get("_id", ""))) and not _QA_NAME.match(str(s.get("name") or ""))


@router.get("/public/localities")
async def public_localities(x_pulse_secret: Optional[str] = Header(None)):
    """Sitemap feed: official localities that have at least one approved, genuine (non-QA) Space, with whether the
    locality's coverage status is ACTIVE. Ids and dates only."""
    _check_secret(x_pulse_secret)
    rows = await db.spaces.find({"status": "approved"}, {"name": 1, "location.locality_id": 1, "updated_at": 1}).to_list(5000)
    latest: dict[str, str] = {}
    for s in rows:
        lid = (s.get("location") or {}).get("locality_id")
        if lid and _genuine(s):
            latest[lid] = max(latest.get(lid, ""), str(s.get("updated_at") or ""))
    active = {c["_id"] for c in await db.spaces_locality_coverage.find({"_id": {"$in": list(latest)}, "status": "ACTIVE"}, {"_id": 1}).to_list(5000)}
    return {"ok": True, "items": [{"locality_id": k, "updated_at": v or None, "active": k in active} for k, v in sorted(latest.items())]}


@router.get("/public/locality/{lid}")
async def public_locality(lid: str, x_pulse_secret: Optional[str] = Header(None)):
    """Public locality page data: the official India Post locality + its approved Spaces (public fields only)
    + its coverage status. 404 unless the locality exists and has at least one approved Space."""
    _check_secret(x_pulse_secret)
    lid = lid[:120]
    ref = await db.in_pincodes.find_one({"_id": lid}, {"pin": 1, "locality": 1, "district": 1, "state": 1, "taluk": 1})
    if not ref:
        raise HTTPException(status_code=404, detail="Locality not found.")
    spaces = await db.spaces.find({"status": "approved", "location.locality_id": lid}, _PUBLIC_FIELDS).sort("name", 1).to_list(60)
    if not spaces:
        raise HTTPException(status_code=404, detail="No approved Spaces in this locality yet.")
    cov = await db.spaces_locality_coverage.find_one({"_id": lid}, {"status": 1})
    return {"ok": True, "locality": {"id": lid, "name": ref["locality"], "pin": ref["pin"], "district": ref.get("district"),
                                     "state": ref.get("state"), "taluk": ref.get("taluk")},
            "coverage_status": (cov or {}).get("status"), "has_genuine": any(_genuine(s) for s in spaces),
            "spaces": [_public(s) for s in spaces]}


_DISTRICTS: dict[tuple[str, str], tuple[str, str]] = {}


async def _district_names(state_slug: str, district_slug: str) -> Optional[tuple[str, str]]:
    """Resolve URL slugs to the official India Post (state, district) names. Exact slug match only."""
    if not _DISTRICTS:
        pairs = await db.in_pincodes.aggregate([{"$group": {"_id": {"s": "$state", "d": "$district"}}}]).to_list(5000)
        for p in pairs:
            s, d = p["_id"].get("s"), p["_id"].get("d")
            if s and d:
                _DISTRICTS[(_loc_slug(s), _loc_slug(d))] = (s, d)
    return _DISTRICTS.get((state_slug[:60], district_slug[:60]))


@router.get("/public/district/{state_slug}/{district_slug}")
async def public_district(state_slug: str, district_slug: str, x_pulse_secret: Optional[str] = Header(None)):
    """Public district page data: ACTIVE localities of the district, its approved Spaces (public fields only).
    404 unless the district exists and has at least one approved Space or ACTIVE locality."""
    _check_secret(x_pulse_secret)
    names = await _district_names(state_slug, district_slug)
    if not names:
        raise HTTPException(status_code=404, detail="District not found.")
    state, district = names
    spaces = await db.spaces.find({"status": "approved", "location.state": state, "location.district": district},
                                  _PUBLIC_FIELDS).sort("name", 1).to_list(120)
    lids = [r["_id"] for r in await db.in_pincodes.find({"state": state, "district": district}, {"_id": 1}).to_list(5000)]
    active_ids = [c["_id"] for c in await db.spaces_locality_coverage.find({"_id": {"$in": lids}, "status": "ACTIVE"}, {"_id": 1}).to_list(5000)]
    refs = await db.in_pincodes.find({"_id": {"$in": active_ids}}, {"locality": 1, "pin": 1}).sort("locality", 1).to_list(5000)
    if not spaces and not refs:
        raise HTTPException(status_code=404, detail="No NOSTOPS activity in this district yet.")
    with_spaces = {(s.get("location") or {}).get("locality_id") for s in spaces}
    return {"ok": True, "state": state, "district": district,
            "active_localities": [{"id": r["_id"], "name": r["locality"], "pin": r["pin"], "has_spaces": r["_id"] in with_spaces} for r in refs],
            "has_genuine": any(_genuine(s) for s in spaces), "spaces": [_public(s) for s in spaces]}


@router.get("/public/districts")
async def public_districts(x_pulse_secret: Optional[str] = Header(None)):
    """Sitemap feed: districts (slugs only) that have at least one ACTIVE locality."""
    _check_secret(x_pulse_secret)
    ids = [c["_id"] for c in await db.spaces_locality_coverage.find({"status": "ACTIVE"}, {"_id": 1}).to_list(10000)]
    pairs = await db.in_pincodes.aggregate([{"$match": {"_id": {"$in": ids}}}, {"$group": {"_id": {"s": "$state", "d": "$district"}}}]).to_list(5000)
    return {"ok": True, "items": sorted({(_loc_slug(p["_id"]["s"]), _loc_slug(p["_id"]["d"])) for p in pairs if p["_id"].get("s") and p["_id"].get("d")})}


@router.get("/public/{sid}")
async def public_space(sid: str, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    s = await db.spaces.find_one({"_id": sid[:40], "status": "approved"})
    if not s:
        raise HTTPException(status_code=404, detail="Space not found.")
    return {"ok": True, "space": _public(s)}
