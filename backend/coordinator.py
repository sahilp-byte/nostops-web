"""Local store for City Coordinator applications.

The City Coordinator application itself is an external Jotform embed, so the
platform can't observe the submission event directly. To still give an
applicant a warm on-platform confirmation, the eligible teacher taps
"I've submitted my application" after completing the Jotform; the BFF records
that acknowledgement here (keyed by the authenticated user), so the confirmation
persists across visits and devices.

Auth mirrors the venues-local router: a shared secret between the Next.js BFF
and this service, plus a base64 `X-Pulse-User` identity (the browser never holds
the secret).
"""
import base64
import hmac
import json
import os
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/coordinator", tags=["coordinator-local"])


def now_ms() -> int:
    return int(time.time() * 1000)


async def current_user(
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
) -> dict:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        data = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="bad user context")
    if not data.get("user_id"):
        raise HTTPException(status_code=400, detail="no user")
    return data


@router.post("/applied")
async def mark_applied(user: dict = Depends(current_user)):
    uid = str(user.get("user_id"))
    existing = await db.coordinator_applications.find_one({"_id": uid})
    applied_at = existing.get("applied_at") if existing else None
    if not applied_at:
        applied_at = now_ms()
    await db.coordinator_applications.update_one(
        {"_id": uid},
        {"$set": {"name": user.get("name") or "", "applied_at": applied_at, "updated_at": now_ms()}},
        upsert=True,
    )
    return {"ok": True, "applied": True, "applied_at": applied_at}


@router.get("/applied")
async def get_applied(user: dict = Depends(current_user)):
    d = await db.coordinator_applications.find_one({"_id": str(user.get("user_id"))})
    return {"applied": bool(d), "applied_at": (d or {}).get("applied_at")}
