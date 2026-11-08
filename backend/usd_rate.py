"""US-dollar reference prices (June 2026, owner decision).

Event fees and 1:1 session rates are set in rupees. Visitors also see an approximate US-dollar
price worked out from ONE exchange rate that an admin sets (default ₹85 = US$1), rounded to the
nearest cent. Display only: no checkout uses this number (international checkout for events and
1:1 sessions stays off), so it never changes what anyone pays.

Every route needs X-Pulse-Secret (only the website BFF has it). Admin identity comes from
X-Pulse-User, built by the BFF from the httpOnly session.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

import venues
from institutional import admin_only_user
from org_enquiries import _check_secret

router = APIRouter(prefix="/api/usd-rate", tags=["usd-rate"])
col = venues.db["site_settings"]
history = venues.db["usd_rate_history"]

DOC_ID = "usd_rate"
DEFAULT_INR_PER_USD = 85.0
MIN_RATE, MAX_RATE = 10.0, 500.0


def _iso(v) -> Optional[str]:
    return v.isoformat() if isinstance(v, datetime) else None


async def _current() -> dict:
    d = await col.find_one({"_id": DOC_ID}) or {}
    return {
        "inr_per_usd": float(d.get("inr_per_usd") or DEFAULT_INR_PER_USD),
        "is_default": not d,
        "updated_at": _iso(d.get("updated_at")),
        "updated_by": d.get("updated_by_name") or None,
    }


@router.get("")
async def get_rate(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    c = await _current()
    return {"inr_per_usd": c["inr_per_usd"], "updated_at": c["updated_at"]}


@router.get("/admin")
async def admin_get(user: dict = Depends(admin_only_user)) -> dict:
    rows = await history.find({}, {"_id": 0}).sort("at", -1).limit(20).to_list(20)
    return {**(await _current()), "default": DEFAULT_INR_PER_USD, "min": MIN_RATE, "max": MAX_RATE,
            "history": [{**r, "at": _iso(r.get("at"))} for r in rows]}


class RateIn(BaseModel):
    inr_per_usd: float = Field(..., ge=MIN_RATE, le=MAX_RATE)


@router.put("/admin")
async def admin_set(body: RateIn, user: dict = Depends(admin_only_user)) -> dict:
    rate = round(float(body.inr_per_usd), 2)
    before = await _current()
    now = datetime.now(timezone.utc)
    who = str(user.get("name") or user.get("email") or user.get("user_id"))
    await col.update_one({"_id": DOC_ID}, {"$set": {"inr_per_usd": rate, "updated_at": now,
                                                     "updated_by": str(user.get("user_id")),
                                                     "updated_by_name": who}}, upsert=True)
    await history.insert_one({"from": before["inr_per_usd"], "to": rate, "at": now, "by": who})
    return {"ok": True, **(await _current())}
