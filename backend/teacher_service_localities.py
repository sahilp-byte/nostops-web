"""Phase 7 finalisation — teacher service localities (Preview, Spaces-owned, backward compatible).

A teacher records a primary teaching PIN code and up to four additional service PIN codes, each validated against
the India Post dataset (spaces_localities). Locality, district and state are derived from that data, never typed.
Stored ONLY in `teacher_service_localities` (keyed by the signed-in user id). The teacher directory, the production
teacher backend, empanelment, ID verification and eligibility rules are not read for writing and never changed.

Privacy: PIN codes and any location source data are private to the teacher and to Community Partner matching on the
server. Public teacher discovery receives the locality NAME only, never a PIN, address or coordinates.
Nothing is saved without the teacher's explicit confirmation (`confirm: true`).
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from spaces_localities import validate_india_location
from venues import _now_iso, current_user, db

router = APIRouter(prefix="/api/spaces/teacher-localities", tags=["teacher-localities"])
col = db.teacher_service_localities
TEACHER_ROLES = {"teacher", "guru", "council", "council_guru"}
MAX_ADDITIONAL = 4


class _M(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PinIn(_M):
    pin: str = Field(min_length=6, max_length=6)
    locality_id: str = Field(min_length=3, max_length=120)


class ServiceIn(_M):
    primary: PinIn
    additional: list[PinIn] = Field(default_factory=list, max_length=MAX_ADDITIONAL)
    source: Literal["manual", "device_suggestion"] = "manual"
    confirm: bool = False


def _uid(user: dict) -> str:
    uid = str(user.get("user_id") or "")
    if not uid or "@" in uid:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return uid


def _teacher(user: dict) -> str:
    uid = _uid(user)
    if str(user.get("role") or "") not in TEACHER_ROLES:
        raise HTTPException(status_code=403, detail="Only NOSTOPS teachers can set teaching localities.")
    return uid


async def _resolve(p: PinIn) -> dict:
    loc = await validate_india_location(p.pin, p.locality_id, "IN")
    return {k: loc.get(k) for k in ("pin", "locality_id", "locality", "district", "state")}


def _view(d: Optional[dict]) -> dict:
    if not d:
        return {"ok": True, "record": None}
    return {"ok": True, "record": {k: d.get(k) for k in ("primary", "additional", "source", "confirmed", "confirmed_at", "updated_at")}}


@router.get("/me")
async def get_mine(user: dict = Depends(current_user)):
    return _view(await col.find_one({"_id": _teacher(user)}))


@router.put("/me")
async def put_mine(body: ServiceIn, user: dict = Depends(current_user)):
    uid = _teacher(user)
    if not body.confirm:
        raise HTTPException(status_code=422, detail="Please confirm these teaching localities before saving.")
    primary = await _resolve(body.primary)
    extra, seen = [], {primary["locality_id"]}
    for p in body.additional:
        r = await _resolve(p)
        if r["locality_id"] not in seen:
            seen.add(r["locality_id"])
            extra.append(r)
    now = _now_iso()
    doc = {"primary": primary, "additional": extra, "source": body.source, "confirmed": True, "confirmed_at": now, "updated_at": now,
           "pins": sorted({primary["pin"], *(e["pin"] for e in extra)})}
    await col.update_one({"_id": uid}, {"$set": doc, "$setOnInsert": {"created_at": now}}, upsert=True)
    return _view(await col.find_one({"_id": uid}))
