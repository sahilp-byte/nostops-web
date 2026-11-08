"""Phase 6 — participant registration (and sandbox-only checkout) for NOSTOPS Space programmes.

Scope and isolation:
  • Only PARTICIPANT programme fees are handled. No venue rent, revenue share, commission, teacher or
    venue payouts and no settlements — the Space owner is never a payment beneficiary.
  • Separate from the organisation-programme engine: records live in `space_registrations`, and the
    existing `inst_registrations` / `participant/payment/*` paths still refuse Space events.
  • Eligibility re-uses Phase 5B's live checks (`space_public_problems`) on every registration.
  • Identity comes only from the signed-in NOSTOPS session (X-Pulse-User built server-side by the BFF).
  • Capacity: one atomic counter on the event (`space_seats_used`) counts CONFIRMED places and
    unexpired PENDING_PAYMENT holds; a seat is taken with a conditional $inc and released exactly once
    by a conditional status transition.
  • Payments: Cashfree Payment Gateway (orders, status, refunds — never payouts), server-side only.
    New checkouts need SPACE_CHECKOUT_ENABLED=true AND payment_guard.checkout_decision, and run on the
    SANDBOX only (live is refused unless SPACE_LIVE_PAYMENTS=true, which is not authorised).
"""
import base64
import datetime as _dt
import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Literal, Optional
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo.errors import DuplicateKeyError

import institutional as inst
import payment_guard
import pricing_engine
import space_programmes as sp
from institutional import _audit, _now, current_user, db

router = APIRouter(prefix="/api/institutional/space-registrations", tags=["space-registrations"])

regs = db["space_registrations"]
webhook_events = db["space_registration_webhooks"]

PENDING, CONFIRMED, CANCELLED, EXPIRED, FAILED = "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED", "PAYMENT_FAILED"
NOT_PLACED = "NOT_PLACED"  # lost the race for the last seat; kept for the audit trail, never shown as a registration
ACTIVE = (PENDING, CONFIRMED)
HOLD_SECONDS = 20 * 60          # a PAID checkout holds the seat this long (also the Cashfree order expiry)
PAID_CANCEL_DAYS = 2            # a paid place can be cancelled (full refund) up to 2 days before the start date
OPEN_LIFECYCLES = {"PUBLISHED", "LIVE"}
IST = ZoneInfo("Asia/Kolkata")
WEBHOOK_MAX_AGE_S, WEBHOOK_MAX_SKEW_S = 24 * 3600, 5 * 60
GATEWAY_DOWN = "The payment service is unavailable right now. Please try again in a few minutes. You have not been charged."
CHECKOUT_OFF = "Online payment for NOSTOPS Spaces programmes isn't open yet. No payment has been taken."

transport: Optional[httpx.AsyncBaseTransport] = None  # tests inject a mock Cashfree here; None = the real network
_indexed = False


async def _ensure() -> None:
    global _indexed
    if _indexed:
        return
    await regs.create_index([("event_id", 1), ("participant_id", 1)], unique=True,
                            partialFilterExpression={"active": True}, name="one_active_per_participant")
    await regs.create_index("payment.order_id", sparse=True)
    await regs.create_index([("status", 1), ("hold_expires_at", 1)])
    _indexed = True


def _iso(t: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


def _today() -> _dt.date:
    return _dt.datetime.now(IST).date()


def _start_date(ev: dict) -> Optional[_dt.date]:
    try:
        return _dt.date.fromisoformat(str(ev.get("event_date") or ""))
    except ValueError:
        return None


# ── Gateway (Cashfree PG: orders / status / refunds only) ─────────────────────
def _cfg() -> dict:
    return {"api_base": os.environ.get("CASHFREE_API_BASE", "").strip().rstrip("/"),
            "client_id": os.environ.get("CASHFREE_CLIENT_ID", ""), "client_secret": os.environ.get("CASHFREE_CLIENT_SECRET", ""),
            "version": os.environ.get("CASHFREE_API_VERSION", "2025-01-01"),
            "web": os.environ.get("WEB_APP_BASE_URL", "").strip().rstrip("/"),
            "origin": os.environ.get("CASHFREE_CHECKOUT_ORIGIN", "").strip().rstrip("/")}


def checkout_enabled() -> bool:
    return os.environ.get("SPACE_CHECKOUT_ENABLED") == "true"


def gateway_decision(origin_host: Optional[str], headers) -> dict:
    if not checkout_enabled():
        return {"allowed": False, "mode": "disabled", "reason": "checkout_gate_closed"}
    c = _cfg()
    d = payment_guard.checkout_decision(origin_host, headers, api_base=c["api_base"], client_id=c["client_id"],
                                        client_secret=c["client_secret"], web_app_base_url=c["web"], checkout_origin=c["origin"])
    if d["allowed"] and d["mode"] != "sandbox" and os.environ.get("SPACE_LIVE_PAYMENTS") != "true":
        return {"allowed": False, "mode": d["mode"], "reason": "live_payments_not_authorised"}
    return d


def _mode_now() -> str:
    return payment_guard.cashfree_mode(_cfg()["api_base"])


async def _cf(method: str, path: str, body: Optional[dict] = None, idem: Optional[str] = None) -> tuple[int, dict]:
    c = _cfg()
    h = {"x-client-id": c["client_id"], "x-client-secret": c["client_secret"], "x-api-version": c["version"],
         "Content-Type": "application/json", "Accept": "application/json"}
    if idem:
        h["x-idempotency-key"] = idem
    try:
        async with httpx.AsyncClient(timeout=20.0, transport=transport) as hx:
            r = await hx.request(method, f"{c['api_base']}{path}", headers=h, json=body)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail=GATEWAY_DOWN) from None
    try:
        data = r.json() if r.content else {}
    except ValueError:
        data = {}
    return r.status_code, data if isinstance(data, dict) else {"items": data}


# ── Seats ────────────────────────────────────────────────────────────────────
async def _take_seat(eid: str) -> bool:
    res = await inst.events.update_one(
        {"event_id": eid, "$expr": {"$lt": [{"$ifNull": ["$space_seats_used", 0]}, {"$ifNull": ["$capacity", 0]}]}},
        {"$inc": {"space_seats_used": 1}})
    return res.modified_count == 1


async def _transition(rid: str, frm: tuple, to: str, extra: Optional[dict] = None, actor: Optional[dict] = None,
                      action: Optional[str] = None) -> Optional[dict]:
    """Move a registration from an ACTIVE state to an inactive one exactly once; releases its seat."""
    now = _now()
    doc = await regs.find_one_and_update({"_id": rid, "status": {"$in": list(frm)}, "active": True},
                                         {"$set": {"status": to, "active": False, "updated_at": now, **(extra or {})},
                                          "$push": {"history": {"status": to, "at": now}}})
    if not doc:
        return None
    await inst.events.update_one({"event_id": doc["event_id"], "space_seats_used": {"$gt": 0}}, {"$inc": {"space_seats_used": -1}})
    await _audit("SpaceRegistration", rid, action or f"SPACE_REGISTRATION_{to}", actor or {"user_id": "system", "role": "engine"},
                 {"event_id": doc["event_id"], "from": doc["status"]})
    return await regs.find_one({"_id": rid})


async def expire_holds(eid: Optional[str] = None) -> int:
    q = {"status": PENDING, "active": True, "hold_expires_at": {"$lt": _now()}}
    if eid:
        q["event_id"] = eid
    n = 0
    async for r in regs.find(q, {"_id": 1}):
        if await _transition(r["_id"], (PENDING,), EXPIRED, {"payment.status": "EXPIRED"}):
            n += 1
    return n


# ── Eligibility ──────────────────────────────────────────────────────────────
def pricing_of(ev: dict) -> dict:
    p = ev.get("space_pricing") or {}
    if p.get("mode") == "PAID" and p.get("fee_minor"):
        return {"mode": "PAID", "fee_minor": int(p["fee_minor"]), "currency": "INR"}
    return {"mode": "FREE", "fee_minor": 0, "currency": "INR"}


async def registration_state(ev: dict, problems: Optional[list] = None) -> dict:
    """Why (not) a participant may register right now. Every condition is re-read live."""
    probs = await sp.space_public_problems(ev) if problems is None else problems
    cap = int(ev.get("capacity") or 0)
    used = int(ev.get("space_seats_used") or 0)
    left = max(cap - used, 0)
    start = _start_date(ev)
    pricing = pricing_of(ev)
    reason = None
    if probs:
        reason = "PROGRAMME_UNAVAILABLE"
    elif ev.get("visibility") != inst.VIS_PUBLIC:
        reason = "NOT_PUBLIC"
    elif inst._effective_lifecycle(ev) not in OPEN_LIFECYCLES:
        reason = "NOT_OPEN"
    elif ev.get("space_registration_closed"):
        reason = "CLOSED_BY_ORGANISER"
    elif not start or start < _today():
        reason = "STARTED"
    elif cap <= 0 or left <= 0:
        reason = "FULL"
    elif pricing["mode"] == "PAID" and not checkout_enabled():
        reason = "CHECKOUT_UNAVAILABLE"
    text = {None: "Registration is open", "PROGRAMME_UNAVAILABLE": "This programme isn't available for registration.",
            "NOT_PUBLIC": "Registration is only available for public programmes.", "NOT_OPEN": "Registration is closed.",
            "CLOSED_BY_ORGANISER": "Registration has been closed by the organiser.", "STARTED": "This programme has already started.",
            "FULL": "This programme is full.", "CHECKOUT_UNAVAILABLE": CHECKOUT_OFF}[reason]
    return {"registration_open": reason is None, "registration_closed_reason": reason, "registration_status": text,
            "seats_remaining": left, "is_full": left <= 0, "capacity": cap, "pricing": pricing}


async def _space_event(eid: str) -> dict:
    ev = await inst.events.find_one({"event_id": str(eid or "")[:64], "host_kind": sp.HOST_SPACE})
    if not ev:
        raise HTTPException(status_code=404, detail="Programme not found.")
    return ev


# ── Views ────────────────────────────────────────────────────────────────────
def _event_brief(ev: Optional[dict]) -> dict:
    ev = ev or {}
    snap = ev.get("space_snapshot") or {}
    return {"event_id": ev.get("event_id"), "slug": ev.get("slug"), "title": ev.get("title"), "event_date": ev.get("event_date"),
            "start_time": ev.get("start_time"), "end_time": ev.get("end_time"), "schedule": ev.get("schedule"),
            "last_session_date": ev.get("last_session_date"), "teacher_name": ev.get("teacher_name"),
            "space": {"id": ev.get("space_id"), "name": snap.get("name"), "model": snap.get("model"),
                      "locality": snap.get("locality"), "district": snap.get("district"), "state": snap.get("state")},
            "programme": {k: (ev.get("programme_snapshot") or {}).get(k) for k in ("name", "taxonomy", "taxonomy_label")}}


def _reg_view(r: dict, ev: Optional[dict] = None, full: bool = False) -> dict:
    pay = r.get("payment") or {}
    out = {"registration_id": r["_id"], "event_id": r["event_id"], "status": r["status"], "pricing_mode": r.get("pricing_mode"),
           "amount": (r.get("amount_minor") or 0) / 100, "currency": r.get("currency") or "INR",
           "payment_status": pay.get("status"), "payment_reference": pay.get("payment_id") or pay.get("order_id"),
           "refund_status": (r.get("refund") or {}).get("status"), "hold_expires_at": r.get("hold_expires_at"),
           "created_at": r.get("created_at"), "confirmed_at": r.get("confirmed_at"), "cancelled_at": r.get("cancelled_at"),
           "participant_name": r.get("participant_name")}
    if ev is not None:
        out["event"] = _event_brief(ev)
        out["can_cancel"], out["cancel_rule"] = _cancel_rule(r, ev)
    if full:
        out.update({"participant_id": r.get("participant_id"), "participant_email": r.get("participant_email"),
                    "payment": pay, "refund": r.get("refund"), "history": r.get("history") or []})
    return out


def _cancel_rule(r: dict, ev: dict) -> tuple[bool, str]:
    start = _start_date(ev)
    if r["status"] == PENDING:
        return True, "You can cancel this unpaid reservation at any time; the place is released."
    if r["status"] != CONFIRMED:
        return False, ""
    if not start or start < _today():
        return False, "This programme has started, so the registration can no longer be cancelled online."
    if r.get("pricing_mode") == "PAID":
        if (start - _today()).days < PAID_CANCEL_DAYS:
            return False, f"Paid places can be cancelled with a full refund up to {PAID_CANCEL_DAYS} days before the start date. Please contact NOSTOPS support."
        return True, f"Cancel up to {PAID_CANCEL_DAYS} days before the start date for a full refund to your original payment method."
    return True, "You can cancel this free registration until the programme starts."


# ── Participant: register ────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # identity, amount and currency are never accepted from the browser
    event_id: str = Field(min_length=3, max_length=64)
    phone: Optional[str] = Field(default=None, max_length=20)  # contact for the payment gateway only (PAID)
    accept_terms: bool = False
    origin_host: Optional[str] = Field(default=None, max_length=200)  # set server-side by the BFF


def _parse_register(raw: dict) -> RegisterIn:
    sp._refuse_money({k: v for k, v in raw.items() if k not in ("event_id",)})
    try:
        return RegisterIn(**raw)
    except ValidationError:
        raise HTTPException(status_code=422, detail="Please check your registration details and try again.") from None


@router.post("/register")
async def register(request: Request, raw: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    inst._require_active()
    await _ensure()
    body = _parse_register(raw)
    uid = sp._uid(user)
    if not body.accept_terms:
        raise HTTPException(status_code=422, detail="Please accept the registration terms to continue.")
    ev = await _space_event(body.event_id)
    if ev.get("teacher_id") == uid:
        raise HTTPException(status_code=409, detail="You lead this programme, so you can't register for it.")
    await expire_holds(ev["event_id"])
    existing = await regs.find_one({"event_id": ev["event_id"], "participant_id": uid, "active": True})
    if existing:
        out = {"ok": True, "already_registered": True, "registration": _reg_view(existing, ev)}
        if existing["status"] == PENDING and (existing.get("payment") or {}).get("payment_session_id"):
            out["checkout"] = {"payment_session_id": existing["payment"]["payment_session_id"], "mode": existing["payment"].get("mode")}
        return out
    ev = await inst.events.find_one({"event_id": ev["event_id"]})
    st = await registration_state(ev)
    if not st["registration_open"]:
        raise HTTPException(status_code=409, detail={"message": st["registration_status"], "reason": st["registration_closed_reason"]})
    pricing = st["pricing"]
    phone = "".join(ch for ch in (body.phone or "") if ch.isdigit() or ch == "+")
    decision = None
    if pricing["mode"] == "PAID":
        decision = gateway_decision(body.origin_host, request.headers)
        if not decision["allowed"]:  # refused BEFORE any seat or record is created
            raise HTTPException(status_code=503, detail={"message": CHECKOUT_OFF, "reason": decision["reason"]})
        if len(phone) < 10:
            raise HTTPException(status_code=422, detail="A mobile number is needed for the payment gateway.")
    now, rid = _now(), "SPR-" + uuid.uuid4().hex[:12].upper()
    paid = pricing["mode"] == "PAID"
    doc = {"_id": rid, "event_id": ev["event_id"], "space_id": ev.get("space_id"), "teacher_id": ev.get("teacher_id"),
           "participant_id": uid, "participant_name": str(user.get("name") or "Participant")[:160],
           "participant_email": (str(user.get("email") or "").strip().lower() or None) if "@" in str(user.get("email") or "") else None,
           "contact_phone": phone or None, "status": PENDING if paid else CONFIRMED, "active": True,
           "pricing_mode": pricing["mode"], "amount_minor": pricing["fee_minor"], "currency": "INR",
           "payment": ({"provider": "cashfree", "mode": decision["mode"], "status": "CREATED", "order_id": f"spr_{rid}"} if paid
                       else {"provider": None, "status": "NOT_REQUIRED"}),
           "refund": None, "hold_expires_at": _iso(time.time() + HOLD_SECONDS) if paid else None,
           "created_at": now, "updated_at": now, "confirmed_at": None if paid else now, "cancelled_at": None,
           "history": [{"status": PENDING if paid else CONFIRMED, "at": now}]}
    # The unique (event, participant, active) index is claimed FIRST, so simultaneous requests from the same
    # participant can never take more than one seat; only the winner then takes a seat atomically.
    try:
        await regs.insert_one(doc)
    except DuplicateKeyError:
        again = await regs.find_one({"event_id": ev["event_id"], "participant_id": uid, "active": True})
        return {"ok": True, "already_registered": True, "registration": _reg_view(again or doc, ev)}
    if not await _take_seat(ev["event_id"]):
        await regs.update_one({"_id": rid}, {"$set": {"status": NOT_PLACED, "active": False, "updated_at": _now()},
                                             "$push": {"history": {"status": NOT_PLACED, "at": _now()}}})
        raise HTTPException(status_code=409, detail={"message": "This programme is full.", "reason": "FULL"})
    actor = {"user_id": uid, "role": user.get("role") or "learner"}
    await _audit("SpaceRegistration", rid, "SPACE_REGISTRATION_CREATED", actor, {"event_id": ev["event_id"], "status": doc["status"]})
    if not paid:
        return {"ok": True, "registration": _reg_view(doc, ev)}
    return await _create_order(doc, ev, actor)


async def _create_order(doc: dict, ev: dict, actor: dict) -> dict:
    c, rid, oid = _cfg(), doc["_id"], doc["payment"]["order_id"]
    body = {"order_id": oid, "order_amount": doc["amount_minor"] / 100, "order_currency": "INR",
            "customer_details": {"customer_id": doc["participant_id"].replace("@", "_")[:50], "customer_phone": doc["contact_phone"],
                                 "customer_name": doc["participant_name"][:100], **({"customer_email": doc["participant_email"]} if doc["participant_email"] else {})},
            "order_meta": {"return_url": f"{c['web']}/app/spaces/registrations/{rid}?order_id={oid}",
                           "notify_url": f"{c['web']}/api/institutional/space-registrations/webhook"},
            "order_expiry_time": _dt.datetime.fromisoformat(doc["hold_expires_at"].replace("Z", "+00:00")).isoformat(),
            "order_note": f"NOSTOPS Spaces programme {ev['event_id']}"[:200],
            "order_tags": {"registration_id": rid, "event_id": ev["event_id"]}}
    try:
        code, data = await _cf("POST", "/orders", body, idem=oid)
    except HTTPException:
        code, data = 502, {}
    session_id = data.get("payment_session_id") if code < 300 else None
    if not session_id:
        await _transition(rid, (PENDING,), FAILED, {"payment.status": "ORDER_FAILED"}, action="SPACE_REGISTRATION_ORDER_FAILED")
        raise HTTPException(status_code=502, detail=GATEWAY_DOWN)
    await regs.update_one({"_id": rid}, {"$set": {"payment.status": "PENDING", "payment.payment_session_id": session_id,
                                                  "payment.cf_order_id": data.get("cf_order_id"), "updated_at": _now()}})
    await _audit("SpaceRegistration", rid, "SPACE_PAYMENT_ORDER_CREATED", actor, {"order_id": oid, "amount_minor": doc["amount_minor"]})
    fresh = await regs.find_one({"_id": rid})
    return {"ok": True, "registration": _reg_view(fresh, ev), "checkout": {"payment_session_id": session_id, "mode": doc["payment"]["mode"]}}


# ── Payment verification (server-side, never the browser) ────────────────────
async def reconcile(order_id: str) -> Optional[dict]:
    r = await regs.find_one({"payment.order_id": order_id})
    if not r:
        return None
    pay = r.get("payment") or {}
    if pay.get("mode") != _mode_now():  # never read a different environment's gateway
        return r
    code, data = await _cf("GET", f"/orders/{order_id}")
    if code >= 400:
        return r
    status = str(data.get("order_status") or "").upper()
    amount_ok = abs(float(data.get("order_amount") or 0) - r["amount_minor"] / 100) < 0.005 \
        and str(data.get("order_currency") or "").upper() == "INR"
    rid = r["_id"]
    if status == "PAID" and not amount_ok:
        await regs.update_one({"_id": rid}, {"$set": {"payment.status": "AMOUNT_MISMATCH", "updated_at": _now()}})
        await _audit("SpaceRegistration", rid, "SPACE_PAYMENT_MISMATCH", {"user_id": "system", "role": "engine"},
                     {"order_id": order_id, "order_amount": data.get("order_amount"), "order_currency": data.get("order_currency")})
        return await regs.find_one({"_id": rid})
    if status == "PAID":
        pid = await _latest_payment_id(order_id)
        now = _now()
        done = await regs.find_one_and_update(
            {"_id": rid, "status": PENDING, "active": True},
            {"$set": {"status": CONFIRMED, "confirmed_at": now, "updated_at": now, "payment.status": "PAID",
                      "payment.payment_id": pid, "payment.paid_at": now}, "$push": {"history": {"status": CONFIRMED, "at": now}}})
        if done:
            await _audit("SpaceRegistration", rid, "SPACE_PAYMENT_CONFIRMED", {"user_id": "system", "role": "engine"}, {"order_id": order_id})
        elif r["status"] != CONFIRMED and pay.get("status") != "PAID_NOT_CONFIRMED":
            # Paid after the place was released (expired / cancelled): recorded and refunded in full.
            await regs.update_one({"_id": rid}, {"$set": {"payment.status": "PAID_NOT_CONFIRMED", "payment.payment_id": pid, "updated_at": now}})
            await _audit("SpaceRegistration", rid, "SPACE_PAYMENT_RECEIVED_NOT_PENDING", {"user_id": "system", "role": "engine"},
                         {"order_id": order_id, "status": r["status"]})
            await refund(await regs.find_one({"_id": rid}), "Payment received after the reservation ended")
    elif status in ("EXPIRED", "TERMINATED"):
        await _transition(rid, (PENDING,), FAILED, {"payment.status": status})
    return await regs.find_one({"_id": rid})


async def _latest_payment_id(order_id: str) -> Optional[str]:
    try:
        code, data = await _cf("GET", f"/orders/{order_id}/payments")
    except HTTPException:
        return None
    items = data.get("items") if isinstance(data.get("items"), list) else []
    ok = [p for p in items if str(p.get("payment_status") or "").upper() == "SUCCESS"]
    return str(ok[0].get("cf_payment_id")) if ok else None


async def refund(r: dict, note: str) -> dict:
    """Full refund of a captured participant fee (Cashfree PG refund API — never a payout). Idempotent."""
    rid, pay = r["_id"], r.get("payment") or {}
    if r.get("pricing_mode") != "PAID" or pay.get("status") not in ("PAID", "PAID_NOT_CONFIRMED"):
        return r
    took = await regs.find_one_and_update({"_id": rid, "refund": None},
                                          {"$set": {"refund": {"status": "REQUESTING", "refund_id": f"rf_{rid}",
                                                               "amount_minor": r["amount_minor"], "requested_at": _now()}}})
    if not took:
        return await regs.find_one({"_id": rid})
    status = "MANUAL_REVIEW"
    if pay.get("mode") == _mode_now() and _cfg()["client_id"]:
        try:
            code, data = await _cf("POST", f"/orders/{pay['order_id']}/refunds",
                                   {"refund_amount": r["amount_minor"] / 100, "refund_id": f"rf_{rid}", "refund_note": note[:100]},
                                   idem=f"rf_{rid}")
            if code < 300:
                status = str(data.get("refund_status") or "PENDING").upper()
        except HTTPException:
            status = "MANUAL_REVIEW"
    await regs.update_one({"_id": rid}, {"$set": {"refund.status": status, "updated_at": _now()}})
    await _audit("SpaceRegistration", rid, "SPACE_REFUND_REQUESTED", {"user_id": "system", "role": "engine"},
                 {"order_id": pay.get("order_id"), "status": status})
    return await regs.find_one({"_id": rid})


@router.post("/webhook")
async def webhook(request: Request, x_webhook_signature: Optional[str] = Header(None),
                  x_webhook_timestamp: Optional[str] = Header(None)) -> dict:
    raw = await request.body()
    secret = _cfg()["client_secret"]
    if not secret or not x_webhook_signature or not x_webhook_timestamp:
        raise HTTPException(status_code=400, detail="bad webhook")
    try:
        signed = (x_webhook_timestamp + raw.decode("utf-8")).encode("utf-8")
        ts = int(x_webhook_timestamp)
    except (UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="bad webhook") from None
    expected = base64.b64encode(hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest()).decode("utf-8")
    if not hmac.compare_digest(expected, x_webhook_signature):
        raise HTTPException(status_code=401, detail="bad signature")
    age = time.time() - (ts / 1000 if ts > 10**12 else ts)
    if age > WEBHOOK_MAX_AGE_S or age < -WEBHOOK_MAX_SKEW_S:
        raise HTTPException(status_code=400, detail="stale webhook")
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except ValueError:
        payload = {}
    data = payload.get("data") or {}
    order_id = str((data.get("order") or {}).get("order_id") or (data.get("refund") or {}).get("order_id") or "")
    if not order_id.startswith("spr_"):
        return {"ok": True, "ignored": "not_a_space_registration"}
    r = await regs.find_one({"payment.order_id": order_id}, {"payment.mode": 1})
    if not r or (r.get("payment") or {}).get("mode") != _mode_now():  # live and test transactions never mix
        return {"ok": True, "ignored": "environment"}
    key = hashlib.sha256(raw).hexdigest()
    try:
        await webhook_events.insert_one({"_id": key, "order_id": order_id[:60], "type": str(payload.get("type") or "")[:60],
                                         "status": "processing", "received_at": _now()})
    except DuplicateKeyError:
        prev = await webhook_events.find_one({"_id": key}) or {}
        if prev.get("status") == "processed":
            return {"ok": True, "duplicate": True}
    if str(payload.get("type") or "").upper().startswith("REFUND"):
        ref = data.get("refund") or {}
        await regs.update_one({"payment.order_id": order_id, "refund.refund_id": ref.get("refund_id")},
                              {"$set": {"refund.status": str(ref.get("refund_status") or "PENDING").upper(), "updated_at": _now()}})
    else:
        await reconcile(order_id)  # the notification only triggers a re-read of the gateway's own record
    await webhook_events.update_one({"_id": key}, {"$set": {"status": "processed"}})
    return {"ok": True}


# ── Participant reads / verify / cancel ──────────────────────────────────────
async def _own(rid: str, uid: str) -> dict:
    r = await regs.find_one({"_id": str(rid or "")[:40]})
    if not r or r.get("participant_id") != uid:
        raise HTTPException(status_code=404, detail="Registration not found.")
    return r


@router.get("/mine")
async def mine(user: dict = Depends(current_user)) -> dict:
    await _ensure()
    uid = sp._uid(user)
    await expire_holds()
    rows = await regs.find({"participant_id": uid, "status": {"$ne": NOT_PLACED}}).sort("created_at", -1).to_list(200)
    evs = {e["event_id"]: e async for e in inst.events.find({"event_id": {"$in": [r["event_id"] for r in rows]}})}
    return {"items": [_reg_view(r, evs.get(r["event_id"])) for r in rows]}


@router.get("/admin/overview")
async def admin_overview(status: Optional[str] = None, user: dict = Depends(current_user)) -> dict:
    sp._require_admin(user)
    await _ensure()
    await expire_holds()
    q = {"status": status} if status in (PENDING, CONFIRMED, CANCELLED, EXPIRED, FAILED) else {"status": {"$ne": NOT_PLACED}}
    rows = await regs.find(q).sort("created_at", -1).to_list(500)
    evs = {e["event_id"]: e async for e in inst.events.find({"event_id": {"$in": list({r["event_id"] for r in rows})}})}
    totals = {}
    async for t in regs.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        totals[t["_id"]] = t["n"]
    paid = [r for r in await regs.find({"payment.status": "PAID"}, {"amount_minor": 1, "refund": 1}).to_list(5000)]
    return {"items": [{**_reg_view(r, full=True), "event": _event_brief(evs.get(r["event_id"]))} for r in rows], "totals": totals,
            "collected_minor": sum(r["amount_minor"] for r in paid if not r.get("refund")),
            "checkout": {"enabled": checkout_enabled(), "gateway_mode": _mode_now()}}


@router.get("/{rid}")
async def get_registration(rid: str, user: dict = Depends(current_user)) -> dict:
    uid = sp._uid(user)
    r = await regs.find_one({"_id": str(rid)[:40]})
    admin = str(user.get("role") or "").lower() == "admin"
    if not r or (r.get("participant_id") != uid and not admin):
        raise HTTPException(status_code=404, detail="Registration not found.")
    await expire_holds(r["event_id"])
    r = await regs.find_one({"_id": r["_id"]})
    return {"registration": _reg_view(r, await inst.events.find_one({"event_id": r["event_id"]}), full=admin)}


@router.post("/{rid}/verify")
async def verify(rid: str, user: dict = Depends(current_user)) -> dict:
    """The return page asks the SERVER to re-read the gateway; the browser's word is never used."""
    r = await _own(rid, sp._uid(user))
    if r.get("pricing_mode") == "PAID" and (r.get("payment") or {}).get("order_id"):
        await reconcile(r["payment"]["order_id"])
    await expire_holds(r["event_id"])
    r = await regs.find_one({"_id": r["_id"]})
    return {"registration": _reg_view(r, await inst.events.find_one({"event_id": r["event_id"]}))}


@router.post("/{rid}/cancel")
async def cancel(rid: str, user: dict = Depends(current_user)) -> dict:
    uid = sp._uid(user)
    r = await _own(rid, uid)
    ev = await inst.events.find_one({"event_id": r["event_id"]}) or {}
    ok, rule = _cancel_rule(r, ev)
    if not ok:
        raise HTTPException(status_code=409, detail=rule or "This registration can't be cancelled.")
    done = await _transition(r["_id"], (r["status"],), CANCELLED, {"cancelled_at": _now(), "cancelled_by": "participant"},
                             {"user_id": uid, "role": user.get("role") or "learner"}, "SPACE_REGISTRATION_CANCELLED")
    if not done:
        raise HTTPException(status_code=409, detail="This registration has already changed. Please refresh.")
    if done.get("pricing_mode") == "PAID":
        if (done.get("payment") or {}).get("status") == "PENDING":
            await reconcile(done["payment"]["order_id"])  # paid in the meantime → refunded in full
        done = await refund(await regs.find_one({"_id": done["_id"]}), "Cancelled by participant")
    return {"registration": _reg_view(done, ev)}


class AdminCancelIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str = Field(min_length=10, max_length=1000)


@router.post("/{rid}/admin-cancel")
async def admin_cancel(rid: str, body: AdminCancelIn, user: dict = Depends(current_user)) -> dict:
    aid = sp._require_admin(user)
    r = await regs.find_one({"_id": str(rid)[:40]})
    if not r:
        raise HTTPException(status_code=404, detail="Registration not found.")
    done = await _transition(r["_id"], ACTIVE, CANCELLED, {"cancelled_at": _now(), "cancelled_by": "admin", "cancel_reason": body.reason},
                             {"user_id": aid, "role": "admin"}, "SPACE_REGISTRATION_CANCELLED_BY_ADMIN")
    if not done:
        raise HTTPException(status_code=409, detail="Only an active registration can be cancelled.")
    if done.get("pricing_mode") == "PAID":
        done = await refund(done, "Cancelled by NOSTOPS")
    return {"registration": _reg_view(done, full=True)}


# ── Teacher (programme creator) / admin: pricing, closure, participants ──────
class PricingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # participant fee only — no venue, teacher or platform money fields
    mode: Literal["FREE", "PAID"]
    fee_inr: Optional[int] = None


@router.post("/programmes/{eid}/pricing")
async def set_pricing(eid: str, raw: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    tid = sp._require_teacher(user)
    try:
        body = PricingIn(**raw)
    except ValidationError:
        raise HTTPException(status_code=422, detail="Only a participant fee (free, or a whole-rupee amount) can be set.") from None
    ev = await _space_event(eid)
    if ev.get("teacher_id") != tid:
        raise HTTPException(status_code=404, detail="Programme not found.")
    if inst._effective_lifecycle(ev) in {"COMPLETED", "ARCHIVED"}:
        raise HTTPException(status_code=409, detail="This programme has ended.")
    await expire_holds(eid)
    if await regs.count_documents({"event_id": eid, "active": True}):
        raise HTTPException(status_code=409, detail="The participant fee can't change once people have registered.")
    fee_minor = 0
    if body.mode == "PAID":
        try:
            fee_minor = pricing_engine.event_fee_minor(body.fee_inr)
        except pricing_engine.PricingError:
            raise HTTPException(status_code=422, detail="Enter a fee in whole rupees between ₹1 and ₹10,00,000.") from None
    pricing = {"mode": body.mode, "fee_minor": fee_minor, "currency": "INR", "updated_at": _now(), "updated_by": tid}
    await inst.events.update_one({"event_id": eid}, {"$set": {"space_pricing": pricing, "updated_at": _now()}})
    await _audit("Event", eid, "SPACE_PARTICIPANT_PRICING_SET", user, {"mode": body.mode, "fee_minor": fee_minor})
    return {"pricing": pricing_of({"space_pricing": pricing})}


class ClosureIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    open: bool
    reason: Optional[str] = Field(default=None, max_length=1000)


async def _creator_or_admin(eid: str, user: dict) -> tuple[dict, str]:
    uid = sp._uid(user)
    ev = await _space_event(eid)
    role = "admin" if str(user.get("role") or "").lower() == "admin" else "teacher" if ev.get("teacher_id") == uid else None
    if not role:
        raise HTTPException(status_code=404, detail="Programme not found.")
    return ev, role


@router.post("/programmes/{eid}/registration")
async def set_registration_open(eid: str, body: ClosureIn, user: dict = Depends(current_user)) -> dict:
    ev, role = await _creator_or_admin(eid, user)
    if role == "admin" and len((body.reason or "").strip()) < 10:
        raise HTTPException(status_code=422, detail="Please give a reason (at least 10 characters).")
    await inst.events.update_one({"event_id": eid}, {"$set": {"space_registration_closed": not body.open, "updated_at": _now()}})
    await _audit("Event", eid, "SPACE_REGISTRATION_OPENED" if body.open else "SPACE_REGISTRATION_CLOSED", user, {"reason": body.reason})
    return {"registration_closed": not body.open}


@router.get("/programmes/{eid}/participants")
async def participants(eid: str, user: dict = Depends(current_user)) -> dict:
    """Teacher: names + status only (no contact details). Admin: + email and payment detail. Owners: no access."""
    ev, role = await _creator_or_admin(eid, user)
    await expire_holds(eid)
    ev = await inst.events.find_one({"event_id": eid})
    rows = await regs.find({"event_id": eid, "status": {"$ne": NOT_PLACED}}).sort("created_at", 1).to_list(1000)
    items = [_reg_view(r, full=role == "admin") for r in rows]
    if role != "admin":  # teachers: names + status only — no registration IDs, contact details or payment references
        items = [{k: v for k, v in i.items() if k not in ("payment_reference", "registration_id")} for i in items]
    st = await registration_state(ev)
    return {"items": items, "viewer": role, "capacity": st["capacity"], "seats_remaining": st["seats_remaining"],
            "confirmed": sum(1 for r in rows if r["status"] == CONFIRMED), "pending": sum(1 for r in rows if r["status"] == PENDING),
            "registration_closed": bool(ev.get("space_registration_closed")), "state": st}


@router.post("/sweep")
async def sweep(_: bool = Depends(inst.require_cron)) -> dict:
    """Scheduled: expire unpaid holds (seats released) and re-check pending orders with the gateway."""
    await _ensure()
    checked = 0
    async for r in regs.find({"status": PENDING, "active": True, "payment.order_id": {"$exists": True}}, {"payment.order_id": 1}):
        try:
            await reconcile(r["payment"]["order_id"])
            checked += 1
        except HTTPException:
            pass
    return {"expired": await expire_holds(), "checked": checked}
