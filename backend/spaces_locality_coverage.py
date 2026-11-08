"""Phase 8B.1.7 — NOSTOPS Spaces locality coverage (admin-only backend foundation).

Design: /app/memory/PHASE_8B_1_6_COVERAGE_PLAN.md (revision 3).
  • Geography is read live from the India Post reference collection `in_pincodes` (never written here).
    PIN code is the grouping; every locality keeps its own canonical id (`<pin>-<slug>`) and its OWN coverage
    record. There is no PIN-wide status.
  • `spaces_locality_coverage`: one record per locality (`_id` = locality_id → duplicates impossible), created
    only by an explicit admin action. Status ∈ NOT_STARTED | ONBOARDING | ACTIVE | PAUSED; any → any with a
    mandatory reason; optimistic `version`; `history[]` and `notes[]` are append-only; no delete route.
  • `spaces_locality_coverage_audit`: insert-only audit entries.
  • Counts are live, read-only and deduplicated per entity (Space `_id`, partner `_id`, teacher `teacher_id`).
    Teachers come only from CONFIRMED service localities (`teacher_service_localities`) joined to the
    authoritative directory mirror `inst_teacher_directory` — never from free-text city or addresses.
  • "Covered" = coverage status ACTIVE. No money fields exist anywhere in this module.
"""
import datetime as _dt
import re
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError

from institutional import STATUS_SOURCE_MAIN, _adaptive_verified, _match_eligible
from spaces_localities import DATASET_VERSION, _require_ready, validate_india_location
from venues import _now_iso, _require_admin, current_user, db

router = APIRouter(prefix="/api/spaces/coverage", tags=["spaces-coverage"])

cov = db["spaces_locality_coverage"]
cov_audit = db["spaces_locality_coverage_audit"]
ref = db["in_pincodes"]

STATUSES = ("NOT_STARTED", "ONBOARDING", "ACTIVE", "PAUSED")
COVERED = "ACTIVE"
STALE_SECONDS = 24 * 3600
# Exclusions — only patterns already identified in this codebase / approved in 8B.1.7 (no new ones):
#   people (teachers, partner users, Space owners): community_partners._NOT_GENUINE ^(user_TEST_|qa_|sp_|spn_)
#   Space ids: ^(spc_qa_|TEST_)
PEOPLE_EXCLUDED = re.compile(r"^(user_TEST_|qa_|sp_|spn_)")
SPACE_ID_EXCLUDED = re.compile(r"^(spc_qa_|TEST_)")
_NOT_PERSON = {"$not": PEOPLE_EXCLUDED}
_GENUINE_SPACE = {"_id": {"$not": SPACE_ID_EXCLUDED}, "owner_id": _NOT_PERSON}
MODELS = ("commercial", "subsidised", "community")
BUCKETS = ("VERIFIED_ELIGIBLE", "REGISTERED_NOT_VERIFIED", "INELIGIBLE")

_indexed = False


async def _ensure() -> None:
    """Additive indexes only. Existing indexes are inspected first and never dropped or changed."""
    global _indexed
    if _indexed:
        return
    have = await ref.index_information()
    if not any(v.get("key") == [("locality_lc", 1)] for v in have.values()):
        await ref.create_index([("locality_lc", 1)], name="locality_lc_1")  # index only — no document is written
    await cov.create_index([("status", 1), ("updated_at", -1)], name="status_1_updated_at_-1")
    await cov.create_index([("pin", 1)], name="pin_1")
    await cov_audit.create_index([("locality_id", 1), ("at", -1)], name="locality_id_1_at_-1")
    _indexed = True


def _admin(user: dict) -> dict:
    _require_admin(user)
    if not str(user.get("user_id") or "").strip():
        raise HTTPException(status_code=401, detail="A signed-in NOSTOPS account is required.")
    return user


def _actor(user: dict) -> dict:
    return {"by_id": str(user.get("user_id")), "by_name": str(user.get("name") or user.get("email") or "admin")[:160]}


async def _audit(lid: str, user: dict, action: str, **extra) -> None:
    await cov_audit.insert_one({"_id": f"cva_{uuid.uuid4().hex[:16]}", "locality_id": lid, "action": action,
                                "actor_id": str(user.get("user_id")), "actor": _actor(user)["by_name"],
                                "actor_role": str(user.get("role") or ""), "at": _now_iso(), **extra})


def _ref_view(d: dict) -> dict:
    return {"locality_id": d["_id"], "pin": d["pin"], "locality": d["locality"], "office_type": d.get("office_type", ""),
            "taluk": d.get("taluk", ""), "district": d.get("district", ""), "state": d.get("state", "")}


def _record_view(r: Optional[dict]) -> Optional[dict]:
    if not r:
        return None
    return {"locality_id": r["_id"], "pin": r["pin"], "status": r["status"], "covered": r["status"] == COVERED,
            "version": r["version"], "dataset_version": r.get("dataset_version"), "notes": r.get("notes") or [],
            "created_at": r.get("created_at"), "created_by": r.get("created_by"),
            "updated_at": r.get("updated_at"), "updated_by": r.get("updated_by")}


def _pin_or_422(pin: str) -> str:
    pin = str(pin or "").strip()
    if not re.fullmatch(r"[1-9][0-9]{5}", pin):
        raise HTTPException(status_code=422, detail="Enter a valid 6-digit Indian PIN code.")
    return pin


# ── Teachers (read-only) ─────────────────────────────────────────────────────
def _stale(synced) -> bool:
    try:
        t = _dt.datetime.fromisoformat(str(synced).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return True
    age = (_dt.datetime.now(_dt.timezone.utc) - t).total_seconds()
    return age < -60 or age > STALE_SECONDS


def _bucket(d: Optional[dict]) -> str:
    if d and _match_eligible(d):
        return "VERIFIED_ELIGIBLE"
    if d and d.get("active") is True and d.get("status_source") == STATUS_SOURCE_MAIN:
        return "REGISTERED_NOT_VERIFIED"
    return "INELIGIBLE"


def _teacher_view(tid: str, d: Optional[dict]) -> dict:
    d = d or {}
    stale = _stale(d.get("status_synced_at"))
    bucket = _bucket(d or None)
    return {"teacher_id": tid, "name": d.get("name") or None, "in_local_directory": bool(d),
            "admin_path": f"/app/admin/teachers/{tid}", "public_path": f"/teachers/{d['handle']}" if d.get("handle") else None,
            "empanelled": d.get("empanelled") is True, "id_verified": d.get("id_verified") is True,
            "active": d.get("active") is True, "status_source_main": d.get("status_source") == STATUS_SOURCE_MAIN,
            "bucket": bucket, "recorded_eligible": bucket == "VERIFIED_ELIGIBLE",
            "eligible_and_recently_refreshed": bucket == "VERIFIED_ELIGIBLE" and not stale,
            "special_needs_qualified": _adaptive_verified(d) if d else False,
            "status_synced_at": d.get("status_synced_at"), "status_stale": stale,
            "stale_warning": "Not refreshed in 24 h" if stale else None}


async def _teachers_by_locality(lids: list) -> dict:
    """{locality_id: {teacher_id: teacher_view}} from CONFIRMED service localities only; QA/test/demo excluded."""
    out = {lid: {} for lid in lids}
    if not lids:
        return out
    q = {"confirmed": True, "_id": _NOT_PERSON,
         "$or": [{"primary.locality_id": {"$in": lids}}, {"additional.locality_id": {"$in": lids}}]}
    recs = [r async for r in db.teacher_service_localities.find(q, {"primary": 1, "additional": 1})]
    ids = [r["_id"] for r in recs]
    dirs = {d["teacher_id"]: d async for d in db.inst_teacher_directory.find({"teacher_id": {"$in": ids}}, {"_id": 0, "email": 0})}
    for r in recs:
        d = dirs.get(r["_id"])
        if d and d.get("is_demo_seeded"):
            continue
        view = _teacher_view(r["_id"], d)
        for loc in [r.get("primary") or {}] + list(r.get("additional") or []):
            if loc.get("locality_id") in out:
                out[loc["locality_id"]][r["_id"]] = view
    return out


def _bucket_counts(views) -> dict:
    views = list(views)
    c = {b.lower(): sum(1 for v in views if v["bucket"] == b) for b in BUCKETS}
    c["stale"] = sum(1 for v in views if v["status_stale"])
    c["eligible_and_recently_refreshed"] = sum(1 for v in views if v["eligible_and_recently_refreshed"])
    # 8B.3: Special Needs-qualified = verified & eligible AND reviewed adaptive-practice competence (_adaptive_verified).
    c["special_needs_qualified"] = sum(1 for v in views if v["bucket"] == "VERIFIED_ELIGIBLE" and v["special_needs_qualified"])
    c["total"] = len(views)
    return c


# ── Counts (live, deduplicated) ──────────────────────────────────────────────
async def _counts(lids: list) -> tuple[dict, dict]:
    """Per-locality counts, plus the union (deduplicated) across all given localities."""
    per = {lid: {"spaces": {"approved": 0, **{m: 0 for m in MODELS}}, "partners": 0} for lid in lids}
    u_spaces, u_partners, u_teachers = {}, set(), {}
    if lids:
        async for s in db.spaces.find({"status": "approved", "location.locality_id": {"$in": lids}, **_GENUINE_SPACE},
                                      {"model": 1, "location.locality_id": 1}):
            lid = s["location"]["locality_id"]
            per[lid]["spaces"]["approved"] += 1
            if s.get("model") in MODELS:
                per[lid]["spaces"][s["model"]] += 1
            u_spaces[s["_id"]] = s.get("model")
        async for p in db.community_partners.find({"status": "approved", "partner_status": "active", "user_id": _NOT_PERSON,
                                                   "assigned_localities.locality_id": {"$in": lids}},
                                                  {"assigned_localities": 1}):
            for lid in {l.get("locality_id") for l in p.get("assigned_localities") or []} & set(lids):
                per[lid]["partners"] += 1
            u_partners.add(p["_id"])
    tmap = await _teachers_by_locality(lids)
    for lid in lids:
        per[lid]["teachers"] = _bucket_counts(tmap[lid].values())
        u_teachers.update(tmap[lid])
    union = {"spaces": {"approved": len(u_spaces), **{m: sum(1 for v in u_spaces.values() if v == m) for m in MODELS}},
             "partners": len(u_partners), "teachers": _bucket_counts(u_teachers.values())}
    return per, union


async def _platform_totals() -> dict:
    """Platform-wide unique totals (each entity once, however many localities it has)."""
    spaces = {"approved": 0, **{m: 0 for m in MODELS}}
    async for s in db.spaces.find({"status": "approved", **_GENUINE_SPACE}, {"model": 1}):
        spaces["approved"] += 1
        if s.get("model") in MODELS:
            spaces[s["model"]] += 1
    partners = await db.community_partners.count_documents({"status": "approved", "partner_status": "active", "user_id": _NOT_PERSON})
    recs = [r["_id"] async for r in db.teacher_service_localities.find({"confirmed": True, "_id": _NOT_PERSON,
                                                                        "pins.0": {"$exists": True}}, {"_id": 1})]
    dirs = {d["teacher_id"]: d async for d in db.inst_teacher_directory.find({"teacher_id": {"$in": recs}}, {"_id": 0, "email": 0})}
    views = [_teacher_view(t, dirs.get(t)) for t in recs if not (dirs.get(t) or {}).get("is_demo_seeded")]
    return {"spaces": spaces, "partners": partners, "teachers": _bucket_counts(views)}


# ── Reads ────────────────────────────────────────────────────────────────────
@router.get("/summary")
async def summary(user: dict = Depends(current_user)) -> dict:
    _admin(user)
    await _ensure()
    by = {s: 0 for s in STATUSES}
    async for g in cov.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        if g["_id"] in by:
            by[g["_id"]] = g["n"]
    return {"total_records": sum(by.values()), "by_status": by, "covered_localities": by[COVERED],
            "platform_totals": await _platform_totals(), "dataset_version": DATASET_VERSION}


@router.get("/search")
async def search(q: str = Query(..., min_length=3, max_length=80), state: Optional[str] = Query(None, max_length=80),
                 district: Optional[str] = Query(None, max_length=80), limit: int = Query(25, ge=1, le=50),
                 user: dict = Depends(current_user)) -> dict:
    """6-digit PIN → that PIN's localities; otherwise a locality-name prefix (case-insensitive). Grouped by PIN."""
    _admin(user)
    _require_ready()
    await _ensure()
    q = q.strip()
    filt: dict = {"dataset_version": DATASET_VERSION}
    if re.fullmatch(r"[0-9]{6}", q):
        filt["pin"] = q
    else:
        filt["locality_lc"] = {"$regex": "^" + re.escape(q.lower())}
    if state:
        filt["state"] = state.strip()
    if district:
        filt["district"] = district.strip()
    rows = await ref.find(filt).sort([("locality_lc", 1), ("pin", 1)]).limit(limit).to_list(limit)
    recs = {r["_id"]: r async for r in cov.find({"_id": {"$in": [d["_id"] for d in rows]}}, {"status": 1})}
    groups: dict = {}
    for d in rows:
        g = groups.setdefault(d["pin"], {"pin": d["pin"], "district": d.get("district"), "state": d.get("state"), "localities": []})
        g["localities"].append({**_ref_view(d), "coverage_status": (recs.get(d["_id"]) or {}).get("status")})
    for g in groups.values():
        g["locality_count_in_pin"] = await ref.count_documents({"pin": g["pin"], "dataset_version": DATASET_VERSION})
    return {"query": q, "kind": "pin" if "pin" in filt else "locality_name", "pins": list(groups.values()),
            "truncated": len(rows) == limit}


@router.get("/pin/{pin}")
async def pin_view(pin: str, user: dict = Depends(current_user)) -> dict:
    """All officially mapped localities of a PIN, each with its OWN coverage status and counts."""
    _admin(user)
    _require_ready()
    await _ensure()
    pin = _pin_or_422(pin)
    rows = await ref.find({"pin": pin, "dataset_version": DATASET_VERSION}).sort("locality_lc", 1).to_list(500)
    if not rows:
        raise HTTPException(status_code=404, detail="This PIN code isn't in the India Post directory.")
    lids = [d["_id"] for d in rows]
    recs = {r["_id"]: r async for r in cov.find({"_id": {"$in": lids}})}
    per, union = await _counts(lids)
    summ = {s: 0 for s in STATUSES} | {"NO_RECORD": 0}
    locs = []
    for d in rows:
        r = recs.get(d["_id"])
        summ[r["status"] if r else "NO_RECORD"] += 1
        locs.append({**_ref_view(d), "coverage": _record_view(r), "coverage_status": r["status"] if r else None,
                     "coverage_label": r["status"] if r else "No record", "counts": per[d["_id"]]})
    return {"pin": pin, "district": rows[0].get("district"), "state": rows[0].get("state"), "localities": locs,
            "status_summary": summ, "pin_unique_counts": union}


@router.get("/locality/{lid}/teachers")
async def locality_teachers(lid: str, user: dict = Depends(current_user)) -> dict:
    _admin(user)
    _require_ready()
    d = await ref.find_one({"_id": lid[:120], "dataset_version": DATASET_VERSION})
    if not d:
        raise HTTPException(status_code=404, detail="Locality not found in the India Post directory.")
    views = sorted((await _teachers_by_locality([d["_id"]]))[d["_id"]].values(),
                   key=lambda v: (BUCKETS.index(v["bucket"]), (v["name"] or "").lower()))
    return {"locality": _ref_view(d), "teachers": views, "counts": _bucket_counts(views)}


@router.get("/locality/{lid}")
async def locality_get(lid: str, user: dict = Depends(current_user)) -> dict:
    _admin(user)
    _require_ready()
    await _ensure()
    r = await cov.find_one({"_id": lid[:120]})
    d = await ref.find_one({"_id": lid[:120], "dataset_version": DATASET_VERSION})
    if not d and not r:
        raise HTTPException(status_code=404, detail="Locality not found.")
    per, _u = await _counts([lid[:120]]) if d else ({}, {})
    return {"reference": _ref_view(d) if d else None, "reference_status": "ok" if d else "stale",
            "coverage": _record_view(r), "coverage_label": r["status"] if r else "No record", "counts": per.get(lid[:120])}


@router.get("/locality/{lid}/history")
async def locality_history(lid: str, user: dict = Depends(current_user)) -> dict:
    _admin(user)
    r = await cov.find_one({"_id": lid[:120]}, {"history": 1})
    if not r:
        raise HTTPException(status_code=404, detail="This locality has no coverage record.")
    audit = await cov_audit.find({"locality_id": r["_id"]}, {"_id": 0}).sort("at", -1).to_list(500)
    return {"locality_id": r["_id"], "history": list(reversed(r.get("history") or [])), "audit": audit}


@router.get("")
async def list_records(pin: Optional[str] = None, q: Optional[str] = Query(None, max_length=80),
                       state: Optional[str] = Query(None, max_length=80), district: Optional[str] = Query(None, max_length=80),
                       status: Optional[str] = None, page: int = Query(1, ge=1, le=10000),
                       page_size: int = Query(25, ge=1, le=50), user: dict = Depends(current_user)) -> dict:
    """Tracked coverage records only (localities without a record are shown via /pin and /search as "No record")."""
    _admin(user)
    _require_ready()
    await _ensure()
    filt: dict = {}
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=422, detail="Unknown coverage status.")
        filt["status"] = status
    if pin:
        filt["pin"] = _pin_or_422(pin)
    if q or state or district:
        rq: dict = {"dataset_version": DATASET_VERSION}
        if q:
            rq["locality_lc"] = {"$regex": "^" + re.escape(q.strip().lower())}
        if state:
            rq["state"] = state.strip()
        if district:
            rq["district"] = district.strip()
        tracked = [r["_id"] async for r in cov.find(filt, {"_id": 1})]
        filt["_id"] = {"$in": [d["_id"] async for d in ref.find({**rq, "_id": {"$in": tracked}}, {"_id": 1})]}
    total = await cov.count_documents(filt)
    recs = await cov.find(filt).sort([("pin", 1), ("_id", 1)]).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    refs = {d["_id"]: d async for d in ref.find({"_id": {"$in": [r["_id"] for r in recs]}, "dataset_version": DATASET_VERSION})}
    per, _u = await _counts([r["_id"] for r in recs if r["_id"] in refs])
    items = [{**(_ref_view(refs[r["_id"]]) if r["_id"] in refs else {"locality_id": r["_id"], "pin": r["pin"]}),
              "reference_status": "ok" if r["_id"] in refs else "stale", "coverage": _record_view(r),
              "coverage_status": r["status"], "counts": per.get(r["_id"])} for r in recs]
    groups: dict = {}
    for i in items:
        groups.setdefault(i["pin"], {"pin": i["pin"], "district": i.get("district"), "state": i.get("state"), "localities": []})["localities"].append(i)
    return {"items": items, "groups": list(groups.values()), "total": total, "page": page, "page_size": page_size}


# ── Writes (explicit admin actions only) ─────────────────────────────────────
class _M(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CreateIn(_M):
    pin: str = Field(min_length=6, max_length=6)
    locality_id: str = Field(min_length=8, max_length=120)
    status: Literal["NOT_STARTED", "ONBOARDING", "ACTIVE", "PAUSED"] = "NOT_STARTED"
    reason: str = Field(min_length=10, max_length=1000)
    note: Optional[str] = Field(default=None, max_length=2000)


class StatusIn(_M):
    status: Literal["NOT_STARTED", "ONBOARDING", "ACTIVE", "PAUSED"]
    reason: str = Field(min_length=10, max_length=1000)
    expected_version: int = Field(ge=1)


class NoteIn(_M):
    text: str = Field(min_length=3, max_length=2000)


@router.post("", status_code=201)
async def create_record(body: CreateIn, user: dict = Depends(current_user)) -> dict:
    _admin(user)
    _require_ready()
    await _ensure()
    loc = await validate_india_location(body.pin, body.locality_id, "IN")  # canonical id must exist AND belong to the PIN
    now, who = _now_iso(), _actor(user)
    doc = {"_id": loc["locality_id"], "pin": loc["pin"], "dataset_version": DATASET_VERSION, "status": body.status,
           "version": 1, "notes": [], "created_at": now, "created_by": who, "updated_at": now, "updated_by": who,
           "history": [{"from": None, "to": body.status, "reason": body.reason, "at": now, **who}]}
    if body.note:
        doc["notes"].append({"id": f"cvn_{uuid.uuid4().hex[:12]}", "text": body.note, "at": now, **who})
    try:
        await cov.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail={"message": "This locality already has a coverage record.",
                                                     "locality_id": loc["locality_id"]}) from None
    await _audit(doc["_id"], user, "coverage_created", to=body.status, reason=body.reason)
    return {"coverage": _record_view(doc)}


@router.post("/locality/{lid}/status")
async def change_status(lid: str, body: StatusIn, user: dict = Depends(current_user)) -> dict:
    _admin(user)
    r = await cov.find_one({"_id": lid[:120]})
    if not r:
        raise HTTPException(status_code=404, detail="This locality has no coverage record.")
    if r["status"] == body.status:
        raise HTTPException(status_code=409, detail="The locality already has this status.")
    now, who = _now_iso(), _actor(user)
    res = await cov.update_one({"_id": r["_id"], "version": body.expected_version, "status": r["status"]},
                               {"$set": {"status": body.status, "updated_at": now, "updated_by": who}, "$inc": {"version": 1},
                                "$push": {"history": {"from": r["status"], "to": body.status, "reason": body.reason, "at": now, **who}}})
    if not res.modified_count:
        raise HTTPException(status_code=409, detail="This record was changed by someone else. Please refresh and try again.")
    await _audit(r["_id"], user, "status_changed", **{"from": r["status"], "to": body.status, "reason": body.reason})
    return {"coverage": _record_view(await cov.find_one({"_id": r["_id"]}))}


@router.post("/locality/{lid}/notes")
async def add_note(lid: str, body: NoteIn, user: dict = Depends(current_user)) -> dict:
    _admin(user)
    now, who = _now_iso(), _actor(user)
    note = {"id": f"cvn_{uuid.uuid4().hex[:12]}", "text": body.text, "at": now, **who}
    res = await cov.update_one({"_id": lid[:120]}, {"$push": {"notes": note}, "$set": {"updated_at": now, "updated_by": who}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="This locality has no coverage record.")
    await _audit(lid[:120], user, "note_added", note_id=note["id"])
    return {"coverage": _record_view(await cov.find_one({"_id": lid[:120]}))}
