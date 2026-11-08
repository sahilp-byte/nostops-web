"""Homepage featured-teacher picker + website removals ("Delete" in the admin dashboard).

Owner decisions (30 Oct 2026):
  * Admins choose up to 6 featured teachers for the homepage "Meet Our Teachers" strip, in order.
    Empty spots are filled automatically. A "never on the homepage" list keeps chosen teachers off
    the strip (seeded with Rajiv Dabhadkar, who the owner asked to hide).
  * "Delete" a yoga teacher or venue = remove it from every public page of the website. The main
    business backend has no delete, so the account / venue record itself is untouched, the teacher
    can still sign in, and an admin can Restore it. Nothing is hard-deleted here either: every
    remove / restore is kept in the record's history.

Every route needs the internal X-Pulse-Secret (only the website BFF has it); writes also need an
admin X-Pulse-User (built by the BFF from the httpOnly session). Collections: `site_curation`
(one doc, _id "homepage"), `site_removals` (_id "<kind>:<ref>").
"""
import re
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import venues
from org_enquiries import _check_secret, _require_admin

router = APIRouter(prefix="/api/site-curation", tags=["site-curation"])
cur = venues.db["site_curation"]
rem = venues.db["site_removals"]

MAX_FEATURED = 6
MAX_HIDDEN = 200
DEFAULT_HOME_HIDDEN = ["rajiv-dabhadkar-n"]
HANDLE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
VENUE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,149}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d) -> Optional[str]:
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat() if isinstance(d, datetime) else None


def _handles(values, limit: int, field: str) -> list[str]:
    out: list[str] = []
    for v in values or []:
        h = str(v or "").strip().lower()
        if not HANDLE_RE.match(h):
            raise HTTPException(status_code=422, detail=f"{field}: “{str(v)[:40]}” is not a teacher handle.")
        if h not in out:
            out.append(h)
    if len(out) > limit:
        raise HTTPException(status_code=422, detail=f"{field}: at most {limit} teachers.")
    return out


def _ref(kind: str, ref: str) -> str:
    r = str(ref or "").strip()
    if kind == "teacher":
        r = r.lower()
        ok = HANDLE_RE.match(r)
    else:
        ok = VENUE_ID_RE.match(r)
    if not ok:
        raise HTTPException(status_code=422, detail="That listing can't be found.")
    return r


async def _homepage() -> dict:
    d = await cur.find_one({"_id": "homepage"}) or {}
    return {"featured": d.get("featured", []), "home_hidden": d.get("home_hidden", DEFAULT_HOME_HIDDEN),
            "updated_at": _iso(d.get("updated_at")), "updated_by": (d.get("updated_by") or {}).get("name", "")}


# ── Read for public pages (BFF / server components only) ───────────────────────────────────────
@router.get("/public")
async def public_state(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    home = await _homepage()
    removed = {"teacher": [], "venue": []}
    async for d in rem.find({"removed": True}, {"kind": 1, "ref": 1}):
        if d.get("kind") in removed:
            removed[d["kind"]].append(d["ref"])
    return {"featured": home["featured"], "home_hidden": home["home_hidden"],
            "removed_teachers": removed["teacher"], "removed_venues": removed["venue"]}


# ── Admin ───────────────────────────────────────────────────────────────────────────────────────
def _removal(d: dict) -> dict:
    return {"kind": d.get("kind"), "ref": d.get("ref"), "name": d.get("name", ""), "removed": bool(d.get("removed")),
            "reason": d.get("reason", ""), "removed_at": _iso(d.get("removed_at")),
            "removed_by": (d.get("removed_by") or {}).get("name", ""), "restored_at": _iso(d.get("restored_at"))}


@router.get("/admin/state")
async def admin_state(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    rows = await rem.find({}).sort("updated_at", -1).to_list(1000)
    return {**(await _homepage()), "max_featured": MAX_FEATURED, "removals": [_removal(d) for d in rows]}


class FeaturedIn(BaseModel):
    featured: list[str] = Field(default_factory=list, max_length=50)
    home_hidden: list[str] = Field(default_factory=list, max_length=MAX_HIDDEN + 50)


@router.put("/admin/featured")
async def admin_featured(payload: FeaturedIn, x_pulse_secret: Optional[str] = Header(None),
                         x_pulse_user: Optional[str] = Header(None)):
    admin = _require_admin(x_pulse_secret, x_pulse_user)
    featured = _handles(payload.featured, MAX_FEATURED, "Featured")
    hidden = [h for h in _handles(payload.home_hidden, MAX_HIDDEN, "Never on the homepage") if h not in featured]
    by = {"user_id": str(admin.get("user_id") or ""), "name": str(admin.get("name") or "")[:120]}
    await cur.update_one({"_id": "homepage"}, {
        "$set": {"featured": featured, "home_hidden": hidden, "updated_at": _now(), "updated_by": by},
        "$push": {"history": {"$each": [{"at": _now(), "by": by, "featured": featured, "home_hidden": hidden}], "$slice": -50}},
    }, upsert=True)
    return {"ok": True, **(await _homepage())}


class RemovalIn(BaseModel):
    kind: Literal["teacher", "venue"]
    ref: str = Field(..., max_length=160)
    action: Literal["remove", "restore"]
    name: str = Field("", max_length=200)
    reason: str = Field("", max_length=500)


@router.post("/admin/removals")
async def admin_removal(payload: RemovalIn, x_pulse_secret: Optional[str] = Header(None),
                        x_pulse_user: Optional[str] = Header(None)):
    admin = _require_admin(x_pulse_secret, x_pulse_user)
    ref = _ref(payload.kind, payload.ref)
    by = {"user_id": str(admin.get("user_id") or ""), "name": str(admin.get("name") or "")[:120]}
    now = _now()
    name = re.sub(r"\s+", " ", payload.name).strip()[:200]
    reason = re.sub(r"\s+", " ", payload.reason).strip()[:500]
    if payload.action == "remove":
        update = {"$set": {"kind": payload.kind, "ref": ref, "removed": True, "removed_at": now, "removed_by": by,
                           "reason": reason, "updated_at": now, **({"name": name} if name else {})},
                  "$push": {"history": {"action": "remove", "at": now, "by": by, "reason": reason}}}
        d = await rem.find_one_and_update({"_id": f"{payload.kind}:{ref}"}, update, upsert=True,
                                          return_document=ReturnDocument.AFTER)
        if payload.kind == "teacher":  # a deleted teacher can't stay featured on the homepage
            await cur.update_one({"_id": "homepage"}, {"$pull": {"featured": ref}})
    else:
        d = await rem.find_one_and_update(
            {"_id": f"{payload.kind}:{ref}", "removed": True},
            {"$set": {"removed": False, "restored_at": now, "restored_by": by, "updated_at": now},
             "$push": {"history": {"action": "restore", "at": now, "by": by}}},
            return_document=ReturnDocument.AFTER)
        if not d:
            raise HTTPException(status_code=404, detail="That listing is not deleted.")
    return {"ok": True, "removal": _removal(d)}
