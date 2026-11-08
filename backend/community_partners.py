"""Phase 7 — NOSTOPS Spaces Community Partner Network (Preview).

Community Partners are locality-based facilitators. They apply (save & resume), NOSTOPS admins assess them, assign up
to two India-Post localities and activate them. Active partners discover PUBLIC Spaces / verified teachers in their
localities and record referrals of prospective teachers, Spaces and Space owners.

Boundaries (enforced server-side):
  • Identity = the signed-in NOSTOPS user id (X-Pulse-User from the BFF); never an email fallback.
  • Partners never edit teachers, own/claim/approve Spaces, decide enquiries or publish programmes; they read only the
    public projections of existing records (spaces / inst_teacher_directory / inst_events / space_registrations counts).
  • Partner access is re-checked on every request: suspension/deactivation takes effect immediately.
  • NO money: no commissions, earnings, revenue shares, settlements, payouts or partner fees. Unknown request fields
    are rejected (extra="forbid"), so no financial field can be written. Impact = verified non-financial counts only.
Collections: community_partners (application + partner state), cp_docs (private documents), cp_referrals, cp_audit.
"""
import base64
import re
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from institutional import STATUS_SOURCE_MAIN
from spaces import DOC_TYPES, MAX_DOC_BYTES, _public as space_public
from spaces_localities import validate_india_location
from venues import _now_iso, _require_admin, current_user, db

router = APIRouter(prefix="/api/spaces/partners", tags=["community-partners"])
apps, docs, refs, audit = db.community_partners, db.cp_docs, db.cp_referrals, db.cp_audit

FOCUS = {"mind", "body", "special_needs"}
DOC_KINDS = {"identity_proof": "Identity proof (Aadhaar / PAN / Voter ID)", "address_proof": "Address proof", "profile_photo": "Profile photo"}
EDITABLE = {"draft", "info_requested"}
STATUSES = ("draft", "submitted", "info_requested", "approved", "rejected")
PARTNER_STATES = ("active", "suspended", "deactivated")
TIMELINES = {"1_month", "3_months", "6_months", "12_months"}
REF_KINDS = {"teacher": "Yoga teacher", "space": "Potential Space", "space_owner": "Space owner"}
REF_STATUSES = ("submitted", "contacted", "onboarding", "onboarded", "closed")
MONEY = re.compile(r"(fee|price|rent|revenue|share|commission|earning|payout|settle|payment|amount|salary|stipend|franchise|wallet|bank|upi|ifsc)", re.I)
_indexed = False


async def _ensure() -> None:
    global _indexed
    if not _indexed:
        await apps.create_index("user_id", unique=True)
        await apps.create_index("ref", unique=True)
        await refs.create_index([("partner_id", 1), ("created_at", -1)])
        _indexed = True


def _uid(user: dict) -> str:
    uid = str(user.get("user_id") or "")
    if not uid or "@" in uid:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return uid


def _hist(user: dict, action: str, note: Optional[str] = None) -> dict:
    return {"action": action, "by": str(user.get("name") or "NOSTOPS"), "by_id": str(user.get("user_id")),
            "role": str(user.get("role") or ""), "at": _now_iso(), **({"note": note} if note else {})}


async def _audit(aid: str, user: dict, action: str, **extra) -> None:
    await audit.insert_one({"_id": f"cpa_{uuid.uuid4().hex[:16]}", "application_id": aid, "actor_id": str(user.get("user_id")),
                            "actor": str(user.get("name") or ""), "actor_role": str(user.get("role") or ""), "action": action,
                            "at": _now_iso(), **extra})


def _refuse_money(raw: dict, path: str = "") -> None:
    for k, v in (raw or {}).items():
        if MONEY.search(str(k)):
            raise HTTPException(status_code=422, detail="Community Partners have no fees, earnings, commissions or payouts on NOSTOPS.")
        if isinstance(v, dict):
            _refuse_money(v)
        if isinstance(v, list):
            for x in v:
                if isinstance(x, dict):
                    _refuse_money(x)


# ── Application models ───────────────────────────────────────────────────────
class _M(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Applicant(_M):
    full_name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=20)
    city: str = Field(default="", max_length=80)
    occupation: str = Field(default="", max_length=120)
    languages: str = Field(default="", max_length=160)
    background: str = Field(default="", max_length=2000)
    community_experience: str = Field(default="", max_length=2000)


class LocIn(_M):
    pin: str = Field(max_length=6)
    locality_id: str = Field(max_length=120)


class Member(_M):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(default="", max_length=120)
    relation: str = Field(default="", max_length=120)


class Plan(_M):
    activation_plan: str = Field(default="", max_length=3000)
    timeline: str = Field(default="", max_length=20)
    weekly_hours: int = Field(default=0, ge=0, le=80)


class Declarations(_M):
    truthful: bool = False
    guidelines: bool = False


class AppIn(_M):
    applicant: Optional[Applicant] = None
    localities: Optional[list[LocIn]] = Field(default=None, max_length=2)
    role_acknowledged: Optional[bool] = None
    team: Optional[list[Member]] = Field(default=None, max_length=5)
    focus_areas: Optional[list[str]] = Field(default=None, max_length=3)
    plan: Optional[Plan] = None
    declarations: Optional[Declarations] = None
    expected_updated_at: Optional[str] = Field(default=None, max_length=40)


def _parse(model, raw: dict):
    _refuse_money(raw)
    try:
        return model(**raw)
    except ValidationError as e:
        loc = ".".join(str(x) for x in (e.errors()[0].get("loc") or []))
        raise HTTPException(status_code=422, detail=f"Please check this field: {loc or 'form'}.") from None


def _missing(a: dict) -> list[str]:
    ap, plan, dec = a.get("applicant") or {}, a.get("plan") or {}, a.get("declarations") or {}
    miss = []
    if not a.get("localities"):
        miss.append("locality")
    if not all(ap.get(k) for k in ("full_name", "phone", "city", "background")):
        miss.append("applicant")
    if not a.get("role_acknowledged"):
        miss.append("role")
    if not a.get("focus_areas"):
        miss.append("focus_areas")
    if not plan.get("activation_plan") or plan.get("timeline") not in TIMELINES:
        miss.append("plan")
    have = {d["kind"] for d in a.get("documents") or []}
    miss += [f"document:{k}" for k in DOC_KINDS if k not in have]
    if not (dec.get("truthful") and dec.get("guidelines")):
        miss.append("declarations")
    return miss


def _view(a: dict, admin: bool = False) -> dict:
    keep = ("ref", "status", "partner_status", "applicant", "localities", "role_acknowledged", "team", "focus_areas", "plan",
            "declarations", "documents", "assigned_localities", "decision_note", "info_request", "created_at", "updated_at",
            "submitted_at", "decided_at", "activated_at")
    out = {"id": a["_id"], **{k: a.get(k) for k in keep}, "missing": _missing(a)}
    out["history"] = [{k: h.get(k) for k in ("action", "at", "note", "by")} for h in a.get("history") or []]
    if admin:
        out.update({"user_id": a.get("user_id"), "account_name": a.get("account_name"), "account_email": a.get("account_email")})
    return out


async def _mine(user: dict) -> Optional[dict]:
    return await apps.find_one({"user_id": _uid(user)})


# ── Applicant ────────────────────────────────────────────────────────────────
@router.get("/mine")
async def get_mine(user: dict = Depends(current_user)):
    a = await _mine(user)
    return {"ok": True, "application": _view(a) if a else None}


@router.post("/mine")
async def start(user: dict = Depends(current_user)):
    await _ensure()
    uid = _uid(user)
    if (a := await apps.find_one({"user_id": uid})):
        return {"ok": True, "application": _view(a)}
    now = _now_iso()
    doc = {"_id": f"cp_{uuid.uuid4().hex[:16]}", "ref": f"CP-{now[:4]}-{uuid.uuid4().hex[:6].upper()}", "user_id": uid,
           "account_name": str(user.get("name") or ""), "account_email": str(user.get("email") or ""), "status": "draft",
           "partner_status": None, "applicant": {}, "localities": [], "team": [], "focus_areas": [], "plan": {},
           "declarations": {}, "documents": [], "assigned_localities": [], "created_at": now, "updated_at": now,
           "history": [_hist(user, "started")]}
    try:
        await apps.insert_one(doc)
    except DuplicateKeyError:  # a simultaneous second start from the same account
        doc = await apps.find_one({"user_id": uid})
    await _audit(doc["_id"], user, "started")
    return {"ok": True, "application": _view(doc)}


@router.patch("/mine")
async def save(raw: dict, user: dict = Depends(current_user)):
    body = _parse(AppIn, raw)
    a = await _mine(user)
    if not a:
        raise HTTPException(status_code=404, detail="Start an application first.")
    if a["status"] not in EDITABLE:
        raise HTTPException(status_code=409, detail="This application is with NOSTOPS and can't be edited now.")
    data: dict = {}
    if body.applicant is not None:
        data["applicant"] = body.applicant.model_dump()
    if body.localities is not None:
        locs, seen = [], set()
        for l in body.localities:
            v = await validate_india_location(l.pin, l.locality_id, "IN")
            if v["locality_id"] not in seen:
                seen.add(v["locality_id"])
                locs.append({k: v.get(k) for k in ("pin", "locality_id", "locality", "district", "state")})
        data["localities"] = locs
    if body.role_acknowledged is not None:
        data["role_acknowledged"] = body.role_acknowledged
    if body.team is not None:
        data["team"] = [m.model_dump() for m in body.team]
    if body.focus_areas is not None:
        if not set(body.focus_areas) <= FOCUS:
            raise HTTPException(status_code=422, detail="Focus areas are MIND, BODY and SPECIAL NEEDS.")
        data["focus_areas"] = sorted(set(body.focus_areas))
    if body.plan is not None:
        if body.plan.timeline and body.plan.timeline not in TIMELINES:
            raise HTTPException(status_code=422, detail="Choose an indicative timeline.")
        data["plan"] = body.plan.model_dump()
    if body.declarations is not None:
        data["declarations"] = body.declarations.model_dump()
    q = {"_id": a["_id"], "status": {"$in": list(EDITABLE)}}
    if body.expected_updated_at:
        q["updated_at"] = body.expected_updated_at
    new = await apps.find_one_and_update(q, {"$set": {**data, "updated_at": _now_iso()}}, return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="Your application changed somewhere else. Reload to continue.")
    return {"ok": True, "application": _view(new)}


class DocIn(_M):
    kind: str = Field(max_length=30)
    name: str = Field(max_length=160)
    type: str = Field(max_length=60)
    base64: str = Field(max_length=7_200_000)


@router.post("/mine/documents")
async def upload(body: DocIn, user: dict = Depends(current_user)):
    a = await _mine(user)
    if not a or a["status"] not in EDITABLE:
        raise HTTPException(status_code=409, detail="Documents can't be changed now.")
    if body.kind not in DOC_KINDS or body.type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail="Upload a PDF, JPG, PNG or WebP file for a listed document.")
    try:
        data = base64.b64decode(body.base64.split(",", 1)[-1], validate=True)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read that file.") from None
    if not data or len(data) > MAX_DOC_BYTES:
        raise HTTPException(status_code=422, detail="Each document must be 4 MB or smaller.")
    ok = {"pdf": data[:4] == b"%PDF", "jpg": data[:3] == b"\xff\xd8\xff", "png": data[:8] == b"\x89PNG\r\n\x1a\n",
          "webp": data[:4] == b"RIFF" and data[8:12] == b"WEBP"}[DOC_TYPES[body.type]]
    if not ok:
        raise HTTPException(status_code=422, detail="That file doesn't look like a real PDF or image.")
    did, now = f"cpd_{uuid.uuid4().hex[:16]}", _now_iso()
    await docs.insert_one({"_id": did, "application_id": a["_id"], "user_id": a["user_id"], "kind": body.kind,
                           "name": body.name[:160], "type": body.type, "data": data, "uploaded_at": now})
    meta = [d for d in a.get("documents") or [] if d["kind"] != body.kind] + [
        {"id": did, "kind": body.kind, "name": body.name[:160], "type": body.type, "uploaded_at": now}]
    new = await apps.find_one_and_update({"_id": a["_id"], "status": {"$in": list(EDITABLE)}},
                                         {"$set": {"documents": meta, "updated_at": now}}, return_document=ReturnDocument.AFTER)
    await _audit(a["_id"], user, "document_uploaded", kind=body.kind, doc_id=did)
    return {"ok": True, "application": _view(new)}


@router.post("/mine/submit")
async def submit(user: dict = Depends(current_user)):
    a = await _mine(user)
    if not a or a["status"] not in EDITABLE:
        raise HTTPException(status_code=409, detail="This application has already been submitted.")
    miss = _missing(a)
    if miss:
        raise HTTPException(status_code=422, detail={"message": "Some details are still missing.", "missing": miss})
    now = _now_iso()
    new = await apps.find_one_and_update({"_id": a["_id"], "status": a["status"]},
                                         {"$set": {"status": "submitted", "submitted_at": now, "updated_at": now},
                                          "$push": {"history": _hist(user, "resubmitted" if a["status"] == "info_requested" else "submitted")}},
                                         return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="Your application changed somewhere else. Reload and try again.")
    await _audit(a["_id"], user, "submitted")
    return {"ok": True, "application": _view(new)}


# ── Admin ────────────────────────────────────────────────────────────────────
@router.get("/admin")
async def admin_list(status: str = "submitted", partner: str = "", q: str = "", user: dict = Depends(current_user)):
    _require_admin(user)
    flt: dict = {} if status == "all" else {"status": status if status in STATUSES else "submitted"}
    if partner in PARTNER_STATES:
        flt["partner_status"] = partner
    if q:
        rx = {"$regex": re.escape(q[:60]), "$options": "i"}
        flt["$or"] = [{"ref": rx}, {"applicant.full_name": rx}, {"localities.locality": rx}, {"localities.pin": rx}]
    items = await apps.find(flt, {"history": 0}).sort("updated_at", -1).to_list(300)
    counts = {s: await apps.count_documents({"status": s}) for s in STATUSES}
    return {"ok": True, "counts": counts, "items": [_view(a, admin=True) for a in items]}


async def _app(aid: str) -> dict:
    a = await apps.find_one({"_id": str(aid)[:40]})
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    return a


@router.get("/admin/doc/{did}")
async def admin_doc(did: str, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await docs.find_one({"_id": str(did)[:40]})
    if not d:
        raise HTTPException(status_code=404, detail="Document not found.")
    await _audit(d["application_id"], user, "document_viewed", doc_id=did)
    return {"type": d["type"], "name": d["name"], "base64": base64.b64encode(d["data"]).decode()}


@router.get("/admin/referrals")
async def admin_referrals(user: dict = Depends(current_user)):
    _require_admin(user)
    rows = await refs.find({}).sort("created_at", -1).to_list(500)
    return {"ok": True, "items": [_ref_view(r) | {"partner_ref": r.get("partner_ref")} for r in rows]}


@router.get("/admin/{aid}")
async def admin_get(aid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    a = await _app(aid)
    rows = await refs.find({"partner_id": a["_id"]}).sort("created_at", -1).to_list(200)
    trail = await audit.find({"application_id": a["_id"]}, {"_id": 0}).sort("at", -1).to_list(200)
    return {"ok": True, "application": _view(a, admin=True), "referrals": [_ref_view(r) for r in rows], "audit": trail,
            "doc_kinds": DOC_KINDS}


class DecisionIn(_M):
    reason: str = Field(min_length=10, max_length=2000)


@router.post("/admin/{aid}/decision/{decision}")
async def admin_decide(aid: str, decision: Literal["approve", "reject", "request_info"], body: DecisionIn, user: dict = Depends(current_user)):
    _require_admin(user)
    a = await _app(aid)
    to = {"approve": "approved", "reject": "rejected", "request_info": "info_requested"}[decision]
    if a["status"] != "submitted":
        raise HTTPException(status_code=409, detail="Only a submitted application can be decided.")
    now = _now_iso()
    sets: dict = {"status": to, "decided_at": now, "updated_at": now, "decided_by": str(user.get("user_id")),
                  "decision_note": body.reason if decision != "request_info" else a.get("decision_note")}
    if decision == "request_info":
        sets["info_request"] = {"message": body.reason, "at": now}
    if decision == "approve":  # approval assigns the applied-for localities; activation is a separate admin step
        sets["assigned_localities"] = a.get("localities") or []
        sets["partner_status"] = None
    new = await apps.find_one_and_update({"_id": a["_id"], "status": "submitted"},
                                         {"$set": sets, "$push": {"history": _hist(user, to, body.reason)}}, return_document=ReturnDocument.AFTER)
    if not new:
        raise HTTPException(status_code=409, detail="This application changed. Reload and try again.")
    await _audit(a["_id"], user, f"decision_{to}", reason=body.reason)
    return {"ok": True, "application": _view(new, admin=True)}


class AssignIn(_M):
    localities: list[LocIn] = Field(min_length=1, max_length=2)
    reason: str = Field(min_length=10, max_length=1000)


@router.put("/admin/{aid}/localities")
async def admin_assign(aid: str, raw: dict, user: dict = Depends(current_user)):
    _require_admin(user)
    body = _parse(AssignIn, raw)
    a = await _app(aid)
    if a["status"] != "approved":
        raise HTTPException(status_code=409, detail="Localities can be assigned only to an approved partner.")
    locs = []
    for l in body.localities:
        v = await validate_india_location(l.pin, l.locality_id, "IN")
        locs.append({k: v.get(k) for k in ("pin", "locality_id", "locality", "district", "state")})
    new = await apps.find_one_and_update({"_id": a["_id"]}, {"$set": {"assigned_localities": locs, "updated_at": _now_iso()},
                                                             "$push": {"history": _hist(user, "localities_assigned", body.reason)}},
                                         return_document=ReturnDocument.AFTER)
    await _audit(a["_id"], user, "localities_assigned", localities=[l["locality_id"] for l in locs], reason=body.reason)
    return {"ok": True, "application": _view(new, admin=True)}


@router.post("/admin/{aid}/partner/{action}")
async def admin_partner(aid: str, action: Literal["activate", "suspend", "deactivate"], body: DecisionIn, user: dict = Depends(current_user)):
    _require_admin(user)
    a = await _app(aid)
    if a["status"] != "approved" or not a.get("assigned_localities"):
        raise HTTPException(status_code=409, detail="Approve the application and assign localities first.")
    to = {"activate": "active", "suspend": "suspended", "deactivate": "deactivated"}[action]
    if a.get("partner_status") == "deactivated" and action != "activate":
        raise HTTPException(status_code=409, detail="This partner is already deactivated.")
    now = _now_iso()
    sets = {"partner_status": to, "updated_at": now, **({"activated_at": a.get("activated_at") or now} if to == "active" else {})}
    new = await apps.find_one_and_update({"_id": a["_id"]}, {"$set": sets, "$push": {"history": _hist(user, f"partner_{to}", body.reason)}},
                                         return_document=ReturnDocument.AFTER)
    await _audit(a["_id"], user, f"partner_{to}", reason=body.reason)
    return {"ok": True, "application": _view(new, admin=True)}


class RefStatusIn(_M):
    status: str = Field(max_length=20)
    note: str = Field(default="", max_length=1000)


@router.post("/admin/referrals/{rid}/status")
async def admin_ref_status(rid: str, body: RefStatusIn, user: dict = Depends(current_user)):
    _require_admin(user)
    if body.status not in REF_STATUSES:
        raise HTTPException(status_code=422, detail="Unknown referral status.")
    r = await refs.find_one_and_update({"_id": str(rid)[:40]}, {"$set": {"status": body.status, "updated_at": _now_iso()},
                                                                "$push": {"history": _hist(user, body.status, body.note or None)}},
                                       return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Referral not found.")
    await _audit(r["partner_id"], user, "referral_status", referral_id=r["_id"], status=body.status)
    return {"ok": True, "referral": _ref_view(r)}


# ── Active partner: dashboard, discovery, referrals ──────────────────────────
async def _partner(user: dict) -> dict:
    a = await _mine(user)
    if not a or a.get("status") != "approved" or a.get("partner_status") != "active":
        raise HTTPException(status_code=403, detail="Your Community Partner access isn't active.")
    return a


def _loc_filter(a: dict, field: str = "location.locality_id") -> dict:
    return {field: {"$in": [l["locality_id"] for l in a.get("assigned_localities") or []]}}


def _districts(a: dict) -> list[str]:
    return sorted({l["district"] for l in a.get("assigned_localities") or [] if l.get("district")})


_TEACHER_PUBLIC = {"_id": 0, "teacher_id": 1, "name": 1, "city": 1, "specializations": 1, "experience_years": 1, "languages": 1}
# "Verified teacher" = the same server-side rule as institutional._match_eligible: active, not demo-seeded, status from the
# main backend, empanelled AND ID-verified. Empanelment alone never counts as verification.
# Non-genuine directory ids (test fixtures, QA records, seeded/sample profiles) are never shown or counted.
_NOT_GENUINE = {"$not": {"$regex": "^(user_TEST_|qa_|sp_|spn_)"}}
_DIR_BASE = {"active": True, "is_demo_seeded": {"$ne": True}, "status_source": STATUS_SOURCE_MAIN, "empanelled": True,
             "id_verified": True, "teacher_id": _NOT_GENUINE}


async def _public_teachers(a: dict) -> list[dict]:
    """Exact matching first: confirmed teacher service PIN codes (teacher_service_localities) that equal one of the
    partner's assigned locality PINs. Legacy fallback: city/district text match, ONLY for teachers with no PIN record.
    Output carries public directory fields + the matched locality NAME; never PINs, addresses or coordinates."""
    pins = sorted({l.get("pin") for l in a.get("assigned_localities") or [] if l.get("pin")})
    out: list[dict] = []
    if pins:
        svc = {d["_id"]: d async for d in db.teacher_service_localities.find({"confirmed": True, "pins": {"$in": pins}})}
        if svc:
            for t in await db.inst_teacher_directory.find({**_DIR_BASE, "teacher_id": {"$in": list(svc), **_NOT_GENUINE}},
                                                          _TEACHER_PUBLIC).to_list(50):
                s = svc[t["teacher_id"]]
                names = [x["locality"] for x in [s["primary"], *s.get("additional", [])] if x.get("pin") in pins]
                out.append({k: v for k, v in t.items() if k != "teacher_id"} | {"service_locality": ", ".join(dict.fromkeys(names)), "match": "pin"})
    names = _districts(a) + sorted({(a.get("applicant") or {}).get("city", "")} - {""})
    if names:
        # Legacy = no confirmed, validated service PIN on record. Only those teachers fall back to city/district text.
        with_pins = [d["_id"] async for d in db.teacher_service_localities.find({"confirmed": True, "pins.0": {"$exists": True}}, {"_id": 1})]
        rx = "|".join(re.escape(n) for n in names)
        legacy = await db.inst_teacher_directory.find({**_DIR_BASE, "city": {"$regex": rx, "$options": "i"},
                                                       "teacher_id": {"$nin": with_pins, **_NOT_GENUINE}},
                                                      _TEACHER_PUBLIC).to_list(50)
        out += [{k: v for k, v in t.items() if k != "teacher_id"} | {"match": "city"} for t in legacy]
    return out  # public directory fields only: no email, phone, documents, verification data or PINs


@router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    a = await _partner(user)
    lids = [l["locality_id"] for l in a["assigned_localities"]]
    spaces = await db.spaces.find({"status": "approved", **_loc_filter(a)}).to_list(200)
    sids = [s["_id"] for s in spaces]
    evs = await db.inst_events.find({"host_kind": "SPACE", "space_id": {"$in": sids}, "visibility": "PUBLIC",
                                     "lifecycle": {"$in": ["PUBLISHED", "LIVE", "COMPLETED"]}},
                                    {"event_id": 1, "title": 1, "slug": 1, "event_date": 1, "lifecycle": 1, "space_id": 1}).to_list(200)
    confirmed = await db.space_registrations.count_documents({"event_id": {"$in": [e["event_id"] for e in evs]}, "status": "CONFIRMED"})
    teachers = await _public_teachers(a)
    my_refs = await refs.find({"partner_id": a["_id"]}).sort("created_at", -1).to_list(200)
    by = {s: sum(1 for r in my_refs if r["status"] == s) for s in REF_STATUSES}
    return {"ok": True, "partner": _view(a), "localities": a["assigned_localities"],
            "stats": {"active_spaces": len(spaces), "verified_teachers": len(teachers), "programmes": len(evs),
                      "confirmed_participants": confirmed, "referrals": len(my_refs), "referrals_by_status": by,
                      "spaces_by_model": {m: sum(1 for s in spaces if s.get("model") == m) for m in ("commercial", "subsidised", "community")}},
            "programmes": [{k: e.get(k) for k in ("title", "slug", "event_date", "lifecycle")} for e in evs[:20]],
            "recent_referrals": [_ref_view(r) for r in my_refs[:8]], "locality_ids": lids}


@router.get("/discover/spaces")
async def discover_spaces(user: dict = Depends(current_user)):
    a = await _partner(user)
    rows = await db.spaces.find({"status": "approved", **_loc_filter(a)}).to_list(200)
    out = []
    for s in rows:
        n = await db.inst_events.count_documents({"host_kind": "SPACE", "space_id": s["_id"], "visibility": "PUBLIC",
                                                  "lifecycle": {"$in": ["PUBLISHED", "LIVE"]}})
        out.append(space_public(s) | {"live_programmes": n})
    return {"ok": True, "items": out}


@router.get("/discover/teachers")
async def discover_teachers(user: dict = Depends(current_user)):
    a = await _partner(user)
    return {"ok": True, "items": await _public_teachers(a), "districts": _districts(a)}


class RefIn(_M):
    kind: str = Field(max_length=20)
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(default="", max_length=160)  # given by the referred person to the partner, with their consent
    locality_id: str = Field(max_length=120)
    note: str = Field(default="", max_length=1500)
    consent: bool = False


def _ref_view(r: dict) -> dict:
    return {"id": r["_id"], **{k: r.get(k) for k in ("kind", "name", "contact", "locality", "locality_id", "note", "status", "created_at", "updated_at")},
            "history": [{k: h.get(k) for k in ("action", "at", "note")} for h in r.get("history") or []]}


@router.post("/referrals")
async def create_referral(raw: dict, user: dict = Depends(current_user)):
    body = _parse(RefIn, raw)
    a = await _partner(user)
    if body.kind not in REF_KINDS:
        raise HTTPException(status_code=422, detail="Refer a yoga teacher, a potential Space or a Space owner.")
    loc = next((l for l in a["assigned_localities"] if l["locality_id"] == body.locality_id), None)
    if not loc:
        raise HTTPException(status_code=403, detail="Referrals are limited to your assigned localities.")
    if not body.consent:
        raise HTTPException(status_code=422, detail="Please confirm the person agreed to be contacted by NOSTOPS.")
    now = _now_iso()
    r = {"_id": f"cpr_{uuid.uuid4().hex[:16]}", "partner_id": a["_id"], "partner_user_id": a["user_id"], "partner_ref": a["ref"],
         "kind": body.kind, "name": body.name, "contact": body.contact, "locality_id": loc["locality_id"], "locality": loc["locality"],
         "note": body.note, "status": "submitted", "created_at": now, "updated_at": now, "history": [_hist(user, "submitted")]}
    await refs.insert_one(r)
    await _audit(a["_id"], user, "referral_created", referral_id=r["_id"], kind=body.kind)
    return {"ok": True, "referral": _ref_view(r)}


@router.get("/referrals")
async def my_referrals(user: dict = Depends(current_user)):
    a = await _partner(user)
    rows = await refs.find({"partner_id": a["_id"]}).sort("created_at", -1).to_list(300)
    return {"ok": True, "items": [_ref_view(r) for r in rows]}
