"""
NOSTOPS Web — 1:1 Session Audit Ledger (local FastAPI + local Mongo).

The remote business backend is FROZEN and exposes NO admin endpoint for 1:1
sessions. To give NOSTOPS admins visibility into 1:1 booking + payment activity,
the Next.js BFF records each 1:1 booking / payment event into a LOCAL Mongo
collection (`audit_ledger`) via this router. This is an isolated, read-mostly
audit trail — it never becomes the system of record (the remote backend is).

Security model (identical to Teacher Pulse):
  • Every request MUST carry the shared secret header `X-Pulse-Secret`
    (constant-time compared to PULSE_SHARED_SECRET). The browser never has this
    secret, so it can never call `/api/audit/*` directly — all access is proxied
    by the Next.js BFF, which validates the NOSTOPS session first and passes the
    authenticated identity in `X-Pulse-User`.
  • `/admin/*` endpoints additionally require the acting user's role == 'admin'.
Identity is NEVER trusted from the browser — it is set server-side by the BFF
after validating the httpOnly session against the remote /auth/me.
"""
import base64
import csv
import hmac
import io
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import PlainTextResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

import pricing_engine
import pricing_rules

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/audit", tags=["audit-ledger"])

STATUS_ORDER = ["PENDING_PAYMENT", "PAYMENT_INITIATED", "PAID"]
PENDING_STATUSES = ["PENDING_PAYMENT", "PAYMENT_INITIATED"]
# Platform keeps 15%; the teacher's net share is 85% (product decision, confirmed). Prompt 3: the
# split lives in pricing_rules.ONE_ON_ONE_DISPLAY_SPLIT and is computed exactly to the paisa
# (85% of ₹1,250 = ₹1,062.50) by the pricing engine — the same figure everywhere it is shown.
FEE_PCT = pricing_rules.ONE_ON_ONE_DISPLAY_SPLIT["platform_bp"] // 100
TEACHER_ROLES = {"teacher", "admin"}


def now_ms() -> int:
    return int(time.time() * 1000)


# ── Auth dependencies (shared-secret + server-set identity) ──────────────────
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
    data["role"] = str(data.get("role") or "learner").lower()
    return data


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


async def teacher_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in TEACHER_ROLES:
        raise HTTPException(status_code=403, detail="Teachers only.")
    return user


# ── request bodies ───────────────────────────────────────────────────────────
class LedgerIn(BaseModel):
    booking_id: str = Field(min_length=1, max_length=128)
    event: str = Field(default="reserve", max_length=32)  # reserve | order_created
    teacher_id: Optional[str] = Field(default=None, max_length=128)
    teacher_handle: Optional[str] = Field(default=None, max_length=200)
    teacher_name: Optional[str] = Field(default=None, max_length=200)
    seeker_email: Optional[str] = Field(default=None, max_length=200)
    seeker_phone: Optional[str] = Field(default=None, max_length=40)
    amount_inr: Optional[float] = None
    currency: Optional[str] = Field(default="INR", max_length=8)
    gateway: Optional[str] = Field(default=None, max_length=32)
    order_id: Optional[str] = Field(default=None, max_length=200)
    status: Optional[str] = Field(default=None, max_length=40)
    session_mode: Optional[str] = Field(default=None, max_length=40)
    matrix_reason: Optional[str] = Field(default=None, max_length=500)
    note: Optional[str] = Field(default=None, max_length=1000)
    slot_iso: Optional[str] = Field(default=None, max_length=64)


class MarkPaidIn(BaseModel):
    order_id: str = Field(min_length=3, max_length=200)
    amount_inr: Optional[float] = None


# ═══════════════════════ RECORD (any signed-in seeker) ══════════════════════
@router.post("/one-on-one")
async def record_one_on_one(payload: LedgerIn, user: dict = Depends(current_user)):
    """Upsert a 1:1 booking into the local audit ledger, keyed by booking_id.
    Called (best-effort) by the BFF after a successful reserve / order-create."""
    t = now_ms()
    booking_id = payload.booking_id.strip()

    event = {
        "event": payload.event,
        "at": t,
        "status": payload.status,
        "gateway": payload.gateway,
        "order_id": payload.order_id,
        "amount_inr": payload.amount_inr,
        "actor_id": user.get("user_id"),
        "actor_role": user.get("role"),
    }

    # Only overwrite fields we actually have (None → keep the existing value).
    candidates = {
        "teacher_id": payload.teacher_id,
        "teacher_handle": payload.teacher_handle,
        "teacher_name": payload.teacher_name,
        "seeker_email": payload.seeker_email,
        "seeker_phone": payload.seeker_phone,
        "amount_inr": payload.amount_inr,
        "session_mode": payload.session_mode,
        "matrix_reason": payload.matrix_reason,
        "note": payload.note,
        "slot_iso": payload.slot_iso,
        "gateway": payload.gateway,
        "order_id": payload.order_id,
        "status": payload.status,
    }
    set_fields = {k: v for k, v in candidates.items() if v is not None}
    set_fields["currency"] = payload.currency or "INR"
    set_fields["updated_at"] = t
    # Seeker identity always comes from the server-set actor, never the client body.
    set_fields["seeker_user_id"] = user.get("user_id")
    set_fields["seeker_name"] = user.get("name")

    existing = await db.audit_ledger.find_one({"_id": booking_id})
    if existing is None:
        doc = {
            "_id": booking_id,
            "booking_id": booking_id,
            "created_at": t,
            "events": [event],
            **set_fields,
        }
        doc.setdefault("status", payload.status or "PENDING_PAYMENT")
        await db.audit_ledger.insert_one(doc)
    else:
        await db.audit_ledger.update_one(
            {"_id": booking_id},
            {"$set": set_fields, "$push": {"events": event}},
        )
    return {"ok": True, "booking_id": booking_id}


@router.post("/one-on-one/mark-paid")
async def mark_one_on_one_paid(payload: MarkPaidIn, user: dict = Depends(current_user)):
    """Mark the caller's ledger entry PAID once the payment is confirmed. Matched
    by Cashfree order_id AND the seeker who owns it (never cross-user). The BFF
    calls this only AFTER re-verifying the order status with the remote gateway,
    so a client can never forge a 'paid' state. Idempotent."""
    order_id = payload.order_id.strip()
    doc = await db.audit_ledger.find_one({"order_id": order_id, "seeker_user_id": user.get("user_id")})
    if not doc:
        # Not found for this seeker — nothing to update (no error surfaced to the poll loop).
        return {"ok": False, "updated": False}
    t = now_ms()
    already = doc.get("status") == "PAID"
    set_fields = {"status": "PAID", "updated_at": t}
    if payload.amount_inr is not None:
        set_fields["amount_inr"] = payload.amount_inr
    update: dict = {"$set": set_fields}
    if not already:
        update["$push"] = {"events": {
            "event": "payment_confirmed", "at": t, "status": "PAID",
            "gateway": doc.get("gateway"), "order_id": order_id,
            "amount_inr": payload.amount_inr if payload.amount_inr is not None else doc.get("amount_inr"),
            "actor_id": user.get("user_id"), "actor_role": user.get("role"),
        }}
    await db.audit_ledger.update_one({"_id": doc["_id"]}, update)
    return {"ok": True, "updated": not already, "booking_id": doc["_id"]}


# ═══════════════════════ TEACHER (own 1:1 sessions) ═════════════════════════
@router.get("/teacher/one-on-one")
async def teacher_list_one_on_one(
    user: dict = Depends(teacher_user),
    teacher_id: Optional[str] = None,
    limit: int = Query(200, le=500),
):
    """A teacher's OWN 1:1 sessions + expected earnings snapshot. The teacher_id
    is resolved SERVER-SIDE by the BFF from the caller's own native profile and
    passed here — a teacher only ever sees the bookings made with THEM (their own
    students; anti-poaching safe). Earnings = 85% net of the booked fee."""
    if not teacher_id:
        return {"rows": [], "stats": _empty_teacher_stats(), "monthly": [], "fee_pct": FEE_PCT}
    query = {"teacher_id": teacher_id}
    docs = await db.audit_ledger.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    rows = [{**_row(r), "teacher_net_inr": pricing_engine.minor_to_number(_net_minor(r))} for r in docs]
    stats, monthly_list = teacher_earnings(docs)
    stats["count"] = len(rows)
    return {"rows": rows, "stats": stats, "monthly": monthly_list, "fee_pct": FEE_PCT}


def _gross_minor(r: dict) -> int:
    try:
        return pricing_engine.to_minor(r.get("amount_inr") or 0, field="amount_inr", strict=False)
    except pricing_engine.PricingError:
        return 0


def _net_minor(r: dict) -> int:
    return pricing_engine.one_on_one_teacher_net_minor(r.get("amount_inr"))


def teacher_earnings(docs: list) -> tuple[dict, list]:
    """Earnings snapshot in exact paise: each booking's net is 85% to the paisa (rule R2) and the
    totals are sums of those same per-booking nets, so every figure shown agrees."""
    sums = {"paid_gross": 0, "pending_gross": 0, "paid_net": 0, "pending_net": 0}
    paid_count = pending_count = 0
    monthly: dict[str, dict] = {}
    for r in docs:
        status = r.get("status")
        if status == "PAID":
            kind, mk_at = "paid", _paid_at(r)
            paid_count += 1
        elif status in PENDING_STATUSES:
            kind, mk_at = "pending", r.get("created_at") or now_ms()
            pending_count += 1
        else:
            continue
        net = _net_minor(r)
        sums[f"{kind}_gross"] += _gross_minor(r)
        sums[f"{kind}_net"] += net
        mk, ml = _month_key(mk_at)
        m = monthly.setdefault(mk, {"month": mk, "label": ml, "earned": 0, "pending": 0, "count": 0})
        m["earned" if kind == "paid" else "pending"] += net
        m["count"] += 1
    num = pricing_engine.minor_to_number
    monthly_list = [{"month": m["month"], "label": m["label"], "earned_net_inr": num(m["earned"]),
                     "pending_net_inr": num(m["pending"]), "count": m["count"]}
                    for m in sorted(monthly.values(), key=lambda x: x["month"], reverse=True)[:6]]
    stats = {
        "count": paid_count + pending_count,
        "paid_count": paid_count,
        "pending_count": pending_count,
        "paid_gross_inr": num(sums["paid_gross"]),
        "pending_gross_inr": num(sums["pending_gross"]),
        "paid_net_inr": num(sums["paid_net"]),
        "pending_net_inr": num(sums["pending_net"]),
    }
    return stats, monthly_list


def _empty_teacher_stats() -> dict:
    return {
        "count": 0, "paid_count": 0, "pending_count": 0,
        "paid_gross_inr": 0, "pending_gross_inr": 0,
        "paid_net_inr": 0, "pending_net_inr": 0,
    }


def _month_key(ms) -> tuple[str, str]:
    dt = datetime.fromtimestamp(int(ms or now_ms()) / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m"), dt.strftime("%b %Y")


def _paid_at(r: dict):
    """When the payment was confirmed (for monthly earned bucketing)."""
    for e in reversed(r.get("events", []) or []):
        if e.get("event") == "payment_confirmed":
            return e.get("at")
    return r.get("updated_at") or r.get("created_at")


# ═══════════════════════ SEEKER (own unpaid reservations) ═══════════════════
@router.get("/seeker/one-on-one")
async def seeker_pending_one_on_one(user: dict = Depends(current_user), limit: int = Query(20, le=50)):
    """The caller's OWN reservations that were never paid — used to gently nudge
    the seeker to complete checkout (Missed Payment Recovery). Scoped to the
    authenticated seeker; includes the seeker's own phone so the resume-checkout
    button can rebuild the Cashfree order."""
    query = {"seeker_user_id": user.get("user_id"), "status": {"$in": PENDING_STATUSES}}
    docs = await db.audit_ledger.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    rows = [{
        "booking_id": r.get("_id"),
        "teacher_name": r.get("teacher_name"),
        "teacher_handle": r.get("teacher_handle"),
        "amount_inr": r.get("amount_inr"),
        "currency": r.get("currency") or "INR",
        "status": r.get("status"),
        "session_mode": r.get("session_mode"),
        "matrix_reason": r.get("matrix_reason"),
        "slot_iso": r.get("slot_iso"),
        "seeker_phone": r.get("seeker_phone"),
        "created_at": r.get("created_at"),
    } for r in docs]
    return {"rows": rows}

def _row(r: dict) -> dict:
    return {
        "booking_id": r.get("_id"),
        "teacher_id": r.get("teacher_id"),
        "teacher_handle": r.get("teacher_handle"),
        "teacher_name": r.get("teacher_name"),
        "seeker_user_id": r.get("seeker_user_id"),
        "seeker_name": r.get("seeker_name"),
        "seeker_email": r.get("seeker_email"),
        "amount_inr": r.get("amount_inr"),
        "currency": r.get("currency") or "INR",
        "gateway": r.get("gateway"),
        "order_id": r.get("order_id"),
        "status": r.get("status"),
        "session_mode": r.get("session_mode"),
        "matrix_reason": r.get("matrix_reason"),
        "note": r.get("note"),
        "slot_iso": r.get("slot_iso"),
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at"),
        "event_count": len(r.get("events", []) or []),
    }


async def _build_query(status: Optional[str], q: Optional[str]) -> dict:
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status
    if q:
        rx = re.compile(re.escape(q.strip()), re.IGNORECASE)
        query["$or"] = [
            {"teacher_name": rx}, {"teacher_handle": rx},
            {"seeker_name": rx}, {"seeker_email": rx},
            {"booking_id": rx}, {"matrix_reason": rx},
        ]
    return query


@router.get("/admin/one-on-one")
async def admin_list_one_on_one(
    user: dict = Depends(admin_user),
    status: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(200, le=500),
):
    query = await _build_query(status, q)
    cursor = db.audit_ledger.find(query).sort("created_at", -1).limit(limit)
    rows = [_row(r) for r in await cursor.to_list(limit)]

    total = await db.audit_ledger.count_documents({})
    pending = await db.audit_ledger.count_documents({"status": "PENDING_PAYMENT"})
    initiated = await db.audit_ledger.count_documents({"status": "PAYMENT_INITIATED"})
    paid = await db.audit_ledger.count_documents({"status": "PAID"})

    gross = 0.0
    async for d in db.audit_ledger.find({}, {"amount_inr": 1}):
        gross += float(d.get("amount_inr") or 0)

    return {
        "rows": rows,
        "stats": {
            "total": total, "pending": pending, "initiated": initiated,
            "paid": paid, "gross_inr": round(gross),
        },
        "statuses": STATUS_ORDER,
    }


@router.get("/admin/one-on-one/{booking_id}")
async def admin_get_one_on_one(booking_id: str, user: dict = Depends(admin_user)):
    r = await db.audit_ledger.find_one({"_id": booking_id})
    if not r:
        raise HTTPException(status_code=404, detail="Not found.")
    out = _row(r)
    out["events"] = r.get("events", []) or []
    return {"session": out}


@router.get("/admin/one-on-one-export")
async def admin_export_one_on_one(
    user: dict = Depends(admin_user),
    status: Optional[str] = None,
    q: Optional[str] = None,
):
    query = await _build_query(status, q)
    rows = await db.audit_ledger.find(query).sort("created_at", -1).to_list(5000)
    fields = [
        "booking_id", "created_at", "status", "teacher_name", "teacher_handle",
        "seeker_name", "seeker_email", "amount_inr", "currency", "gateway",
        "order_id", "session_mode", "matrix_reason", "slot_iso",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(fields)
    for r in rows:
        row = _row(r)
        w.writerow([row.get(k) for k in fields])
    return PlainTextResponse(
        buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="nostops-1on1-sessions.csv"'})



# ═══════════════ ADMIN: teacher status-change audit log ═════════════════════
# Records WHO verified / disabled (or changed empanelment / level of) each
# teacher and WHEN. The remote backend is frozen and keeps no such trail, so the
# BFF writes each admin change here (local Mongo) and the admin teacher-detail
# page reads it back. Admin-only on both write and read.
def _iso(ms) -> Optional[str]:
    if not ms:
        return None
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).isoformat()


class TeacherStatusLogIn(BaseModel):
    teacher_id: str = Field(min_length=1, max_length=128)
    field: str = Field(default="verification", max_length=32)  # verification | empanelment | level
    from_value: Optional[str] = Field(default=None, max_length=64)
    to_value: Optional[str] = Field(default=None, max_length=64)
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/admin/teacher-status")
async def record_teacher_status(payload: TeacherStatusLogIn, user: dict = Depends(admin_user)):
    """Append one admin status change to the local teacher_status_log. Identity
    (admin_id / admin_name) is taken from the server-set actor, never the body."""
    t = now_ms()
    doc = {
        "_id": uuid.uuid4().hex,
        "teacher_id": payload.teacher_id.strip(),
        "field": (payload.field or "verification").strip().lower(),
        "from": payload.from_value,
        "to": payload.to_value,
        "reason": (payload.reason or None),
        "admin_id": str(user.get("user_id") or ""),
        "admin_name": str(user.get("name") or "NOSTOPS Admin"),
        "at": t,
    }
    await db.teacher_status_log.insert_one(doc)
    return {"ok": True}


# ═══════════ ADMIN: teacher status OVERRIDE (verification / level) ═══════════
# The frozen remote backend has NO setter for is_verified / tier, so NOSTOPS
# stores the admin's Verification & Level decisions HERE (local Mongo) and every
# NOSTOPS surface (admin panel, public profile, directory) merges this override
# on read. Authority for NOSTOPS display only — it never writes to the remote
# record. WRITE is admin-only; READ needs only the shared secret (so anonymous
# public pages, rendered server-side by the BFF, can merge it).
TIER_BADGE = {1: ("shikshak", "Yoga Shikshak"), 2: ("pracharak", "Yoga Pracharak"), 3: ("guru", "Yoga Guru")}


async def _secret_only(x_pulse_secret: Optional[str] = Header(None)) -> bool:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    return True


def _clean_ov(d: Optional[dict]) -> Optional[dict]:
    if not d:
        return None
    d.pop("_id", None)
    return d


class StatusOverrideIn(BaseModel):
    teacher_id: str = Field(min_length=1, max_length=128)
    verification: Optional[str] = Field(default=None, max_length=16)  # verified|pending|not_verified
    verification_reason: Optional[str] = Field(default=None, max_length=500)
    level: Optional[int] = Field(default=None, ge=0, le=3)


class BulkOverrideIn(BaseModel):
    ids: list[str] = Field(default_factory=list)


@router.post("/admin/teacher-status-override")
async def set_status_override(payload: StatusOverrideIn, user: dict = Depends(admin_user)):
    """Persist the admin's Verification and/or Level decision for a teacher."""
    tid = payload.teacher_id.strip()
    sets: dict = {
        "teacher_id": tid, "updated_at": now_ms(),
        "updated_by": str(user.get("user_id") or ""), "updated_by_name": str(user.get("name") or "NOSTOPS Admin"),
    }
    if payload.verification in ("verified", "pending", "not_verified"):
        sets["verification_status"] = payload.verification
        sets["is_verified"] = payload.verification == "verified"
        if payload.verification_reason:
            sets["verification_reason"] = payload.verification_reason.strip()[:500]
    if payload.level is not None:
        tb = TIER_BADGE.get(payload.level)
        sets["level"] = payload.level
        sets["tier"] = tb[0] if tb else None
        sets["badge_primary"] = tb[1] if tb else None
    if len(sets) <= 4:  # only bookkeeping keys → nothing meaningful supplied
        raise HTTPException(status_code=400, detail="no override fields supplied")
    await db.teacher_status_override.update_one({"_id": tid}, {"$set": sets}, upsert=True)
    return {"ok": True, "override": _clean_ov(await db.teacher_status_override.find_one({"_id": tid}))}


@router.get("/teacher-status-override/{teacher_id}")
async def get_status_override(teacher_id: str, _ok: bool = Depends(_secret_only)):
    return {"override": _clean_ov(await db.teacher_status_override.find_one({"_id": teacher_id.strip()}))}


@router.post("/teacher-status-override-bulk")
async def bulk_status_override(payload: BulkOverrideIn, _ok: bool = Depends(_secret_only)):
    ids = [str(x).strip() for x in (payload.ids or []) if x][:1000]
    if not ids:
        return {"overrides": {}}
    out: dict = {}
    async for d in db.teacher_status_override.find({"_id": {"$in": ids}}):
        tid = d["_id"]
        out[tid] = _clean_ov(d)
    return {"overrides": out}


@router.get("/admin/teacher-status/{teacher_id}")
async def list_teacher_status(
    teacher_id: str,
    user: dict = Depends(admin_user),
    limit: int = Query(100, le=500),
):
    """Full status-change history for one teacher, newest first (IST rendered by
    the web layer). Returns {available, entries[]}."""
    docs = await db.teacher_status_log.find({"teacher_id": teacher_id}).sort("at", -1).limit(limit).to_list(limit)
    entries = [{
        "field": d.get("field"),
        "from": d.get("from"),
        "to": d.get("to"),
        "reason": d.get("reason"),
        "admin_id": d.get("admin_id"),
        "admin_name": d.get("admin_name"),
        "at": _iso(d.get("at")),
    } for d in docs]
    return {"available": True, "entries": entries}
