"""
Venue AI-Assisted Onboarding — PAID service (ISOLATED local feature).

A self-contained Cashfree purchase flow for the public "/venues/ai-onboarding"
service. It is COMPLETELY isolated from the remote business payment flows
(1:1 bookings, InstaKYC, wallet top-ups) which live on the live backend with
their own Cashfree account. This module uses its OWN Cashfree credentials
(CASHFREE_* env) and its OWN local Mongo collections (ai_onboarding_*), so it
never touches teacher revenue, commissions, settlements or institutional pricing.

Pricing (authoritative, server-side; never trusted from the client):
  India         : INR 1999 + 18% GST = INR 2359 (one-time)
  International : USD 30 (one-time)

Payment uses Cashfree hosted checkout (the JS SDK with a payment session), with
server-side pricing. Environments (payment_guard.checkout_decision): SANDBOX keys
run only on the configured preview origin (WEB_APP_BASE_URL + CASHFREE_CHECKOUT_ORIGIN),
LIVE keys only on a production host; anything else fails closed. Security mirrors the
other local modules: a shared-secret header
(X-Pulse-Secret, constant-time compared) guards the BFF-initiated endpoints. The
Cashfree webhook is public but HMAC-signature verified, replay-windowed and
de-duplicated, then re-reads the order authoritatively before granting anything.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

# The purchase is tied to ONE venue listing, proven by the owner's signed edit
# link (same token the free edit flow uses) — never by a typed email.
from venues import _verify_edit_token, current_user, _require_admin, _EDITABLE_STATUSES, _CLOSED_MSG
import financial_lock
import payment_guard
import payment_routing
import paypal_checkout
import pricing_engine
import pricing_rules

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

CF_CLIENT_ID = os.environ.get("CASHFREE_CLIENT_ID", "")
CF_CLIENT_SECRET = os.environ.get("CASHFREE_CLIENT_SECRET", "")
# No default host: an unset base is "not configured" (fail closed) — never a silent
# fallback to the live gateway.
CF_API_BASE = os.environ.get("CASHFREE_API_BASE", "").rstrip("/")
CF_API_VERSION = os.environ.get("CASHFREE_API_VERSION", "2025-01-01")
# Per-environment public origin of the website (return / notify URLs) and the
# origin the browser opens checkout from (the one whitelisted in Cashfree).
WEB_APP_BASE_URL = os.environ.get("WEB_APP_BASE_URL", "").strip().rstrip("/")
CHECKOUT_ORIGIN = os.environ.get("CASHFREE_CHECKOUT_ORIGIN", "").strip().rstrip("/")
# Webhook replay window (Cashfree retries deliver within hours; older is refused).
WEBHOOK_MAX_AGE_S = 24 * 3600
WEBHOOK_MAX_SKEW_S = 5 * 60

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/ai-onboarding", tags=["ai-onboarding-local"])

# Authoritative pricing — the client can only choose a region, never an amount. Prompt 3: the
# table now comes from the canonical pricing engine (pricing_rules.py), same values as before:
#   IN {INR, base 1999, gst_pct 18, total 2359}  (₹1,999 + ₹359.82 GST = ₹2,358.82, rounded to ₹2,359 by rule R4)
#   INTL {USD, base 30, gst_pct 0, total 30}     (Prompt 4F, founder-approved: paid through PayPal)
PRICING = pricing_engine.ai_onboarding_table()
FLOW = "venue_ai_onboarding"


def now_ms() -> int:
    return int(time.time() * 1000)


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


def _cf_headers() -> dict:
    return {
        "x-client-id": CF_CLIENT_ID,
        "x-client-secret": CF_CLIENT_SECRET,
        "x-api-version": CF_API_VERSION,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _clean_phone(p: str) -> str:
    return "".join(ch for ch in (p or "") if ch.isdigit() or ch == "+")


def _mask_email(e: str) -> str:
    local, _, dom = (e or "").partition("@")
    if not dom:
        return ""
    return f"{local[:2]}{'*' * max(1, len(local) - 2)}@{dom}"


def _active(ent: Optional[dict]) -> bool:
    return bool(ent and ent.get("active"))


_ALREADY = "This venue already has AI-assisted onboarding — there is nothing more to pay."
_REGION_CONFLICT = ("The price you chose does not match your billing country. Please reload the page and try again. "
                    "No payment has been taken.")
_REUSE_WINDOW_MS = 30 * 60 * 1000  # re-use an unfinished checkout for 30 min


async def _venue_for_token(token: str) -> dict:
    v = _verify_edit_token(token or "")
    if not v:
        raise HTTPException(status_code=400, detail="Your secure venue link is invalid or has expired. Please request a fresh one.")
    doc = await db.venue_submissions.find_one({"_id": v["sid"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Venue listing not found.")
    tok_email = (v.get("email") or "").strip().lower()
    own_email = str(doc.get("submitter_email") or "").strip().lower()
    if tok_email and own_email and tok_email != own_email:
        raise HTTPException(status_code=403, detail="This link does not match this venue.")
    if doc.get("status") not in _EDITABLE_STATUSES:
        # Rejected / hidden / archived / duplicate listings can't be sold the upgrade.
        raise HTTPException(status_code=409, detail=_CLOSED_MSG)
    return doc


class CheckoutIn(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    phone: str = ""
    name: Optional[str] = None
    region: str = "IN"  # 'IN' | 'INTL'
    billing_country: Optional[str] = None  # Prompt 2A — required ISO country, checked by payment_routing
    return_url: Optional[str] = None
    notify_url: Optional[str] = None


@router.get("/pricing")
async def pricing() -> dict:
    return {"pricing": PRICING}


@router.get("/for-venue")
async def for_venue(token: str, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Which venue a signed link points at + whether it is already upgraded."""
    _check_secret(x_pulse_secret)
    doc = await _venue_for_token(token)
    ent = await db.ai_onboarding_entitlements.find_one({"_id": doc["_id"]})
    return {
        "submission_id": doc["_id"],
        "venue_name": doc.get("name") or "",
        "city": doc.get("city") or "",
        "email_hint": _mask_email(str(doc.get("submitter_email") or "")),
        "has_phone": bool(_clean_phone(str(doc.get("submitter_phone") or ""))),
        "active": _active(ent),
    }


_GATEWAY_DOWN = "The payment service is unavailable right now. Please try again in a few minutes. You have not been charged."

# Prompt 4E — dual lock for NEW venue checkouts, enforced here independently of the website.
# Both must allow it: the money lock for THIS checkout (Prompt 4F: financial_lock.flow_unlocked —
# FINANCIAL_UNLOCKED_FLOWS names it, so every other money action stays locked) AND the dedicated
# VENUE_CHECKOUT_ENABLED gate, open only for exactly "true". Read on every call; any error fails
# closed. Status reads and verified notifications for EXISTING orders are not gated; a PayPal
# capture (money taken) is.
VENUE_CHECKOUT_UNAVAILABLE = "Checkout isn't available right now. Your free listing isn't affected."


def _new_checkout_closed() -> Optional[str]:
    try:
        if not financial_lock.flow_unlocked(FLOW):
            return "financial_lock"
        if os.environ.get("VENUE_CHECKOUT_ENABLED") != "true":
            return "checkout_gate_closed"
    except Exception:  # noqa: BLE001 — fail closed
        return "checkout_gate_closed"
    return None


# TVR-24 — one checkout start per venue at a time (double click, two tabs, two devices).
_CHECKOUT_LOCK_MS = 90_000
_CHECKOUT_BUSY = "A checkout for this venue is already starting. Please try again in a moment."


async def _take_checkout_lock(sid: str) -> Optional[str]:
    """Take the per-venue checkout lock, or None if another start holds it. A lock older than
    _CHECKOUT_LOCK_MS (an attempt that crashed) is taken over atomically."""
    token, now = uuid.uuid4().hex, now_ms()
    try:
        await db.ai_onboarding_checkout_locks.insert_one({"_id": sid, "token": token, "expires_at": now + _CHECKOUT_LOCK_MS})
        return token
    except DuplicateKeyError:
        took = await db.ai_onboarding_checkout_locks.find_one_and_update(
            {"_id": sid, "expires_at": {"$lt": now}}, {"$set": {"token": token, "expires_at": now + _CHECKOUT_LOCK_MS}})
        return token if took else None


async def _release_checkout_lock(sid: str, token: str) -> None:
    try:
        await db.ai_onboarding_checkout_locks.delete_one({"_id": sid, "token": token})
    except Exception:  # noqa: BLE001 — an unreleased lock simply expires
        pass


def _decision(origin_host: Optional[str], headers) -> dict:
    return payment_guard.checkout_decision(
        origin_host, headers, api_base=CF_API_BASE, client_id=CF_CLIENT_ID, client_secret=CF_CLIENT_SECRET,
        web_app_base_url=WEB_APP_BASE_URL, checkout_origin=CHECKOUT_ORIGIN,
    )


def _stored_mode(mode: str) -> str:
    """One name per environment on the order: 'sandbox' or 'production' (PayPal calls it 'live')."""
    return "sandbox" if mode == "sandbox" else "production"


def _paypal_decision(origin_host: Optional[str], headers) -> dict:
    """Prompt 4F — PayPal environment binding (payment_guard): sandbox only on a preview host, and
    only when WEB_APP_BASE_URL names that host (the buyer returns there); live only on production."""
    cfg = paypal_checkout.config()
    d = payment_guard.paypal_env_decision(origin_host, headers, api_base=cfg["api_base"],
                                          client_id=cfg["client_id"], client_secret=cfg["client_secret"])
    if d["allowed"] and d["mode"] == "sandbox" and payment_guard.url_host(WEB_APP_BASE_URL) != payment_guard.hostname(origin_host):
        return {"allowed": False, "mode": d["mode"], "reason": "origin_not_configured"}
    return d


def _mode_answer(d: dict) -> dict:
    return {"enabled": d["allowed"], "mode": _stored_mode(d["mode"]) if d["allowed"] else "disabled",
            "reason": d["reason"], "sandbox": d["allowed"] and d["mode"] == "sandbox"}


@router.get("/checkout-mode")
async def checkout_mode(request: Request, x_pulse_secret: Optional[str] = Header(None),
                        x_nostops_origin_host: Optional[str] = Header(None)) -> dict:
    """Server-side answer for the website: may checkout start for this host, and is it a
    SANDBOX (drives the 'Sandbox Test Payment' banner)? Top level = Cashfree (India);
    `paypal` = PayPal (international). No secrets."""
    _check_secret(x_pulse_secret)
    closed = _new_checkout_closed()
    if closed:  # Prompt 4E — say why, without consulting the provider configuration
        off = {"enabled": False, "mode": "disabled", "reason": closed, "sandbox": False}
        return {**off, "paypal": dict(off)}
    return {**_mode_answer(_decision(x_nostops_origin_host, request.headers)),
            "paypal": _mode_answer(_paypal_decision(x_nostops_origin_host, request.headers))}


def _production_url_ok(url: Optional[str]) -> bool:
    return not url or not payment_guard.is_test_host(payment_guard.url_host(url) or "")


@router.post("/create-order")
async def create_order(
    payload: CheckoutIn,
    request: Request,
    x_pulse_secret: Optional[str] = Header(None),
    x_nostops_origin_host: Optional[str] = Header(None),
) -> dict:
    _check_secret(x_pulse_secret)
    # Prompt 4E — both controls before routing, any database access or any Cashfree call.
    closed = _new_checkout_closed()
    if closed == "financial_lock":
        return JSONResponse({"detail": financial_lock.FINANCIAL_LOCK_MESSAGE, "financial_lock": True}, status_code=423)
    if closed:
        return JSONResponse({"detail": VENUE_CHECKOUT_UNAVAILABLE, "checkout_unavailable": True, "reason": closed},
                            status_code=503)
    # Payments Prompt 2A — the routing policy runs next: India → Cashfree (INR) only;
    # international → PayPal (USD) only (Prompt 4F). Nothing ever falls back to the other provider.
    region = "INTL" if str(payload.region).upper().startswith("INT") else "IN"
    price = PRICING[region]
    # The price region must be the billing country's (India price ⇔ India billing address).
    bc = payment_routing.country_code(payload.billing_country)
    if bc and (bc == payment_routing.DOMESTIC_COUNTRY) != (region == "IN"):
        raise HTTPException(status_code=422, detail=_REGION_CONFLICT)
    paypal = _paypal_decision(x_nostops_origin_host, request.headers)
    route = payment_routing.decide(FLOW, payload.billing_country, price["currency"], paypal_ready=paypal["allowed"])
    if not route["allowed"]:
        raise HTTPException(status_code=route["status"], detail=route["message"])
    if route["provider"] == "paypal":
        # Prompt 4F — same environment rule as Cashfree: sandbox only on the configured preview
        # origin, live only on a production host (routing above already required it).
        mode = _stored_mode(paypal["mode"])
        if mode == "production" and not (payload.return_url and _production_url_ok(payload.return_url)):
            raise HTTPException(status_code=400, detail="Invalid return address.")
    elif route["provider"] == "cashfree":
        # B4.7 / sandbox completion — one decision for every environment: sandbox keys
        # only on the configured preview origin, live keys only on a production host.
        decision = _decision(x_nostops_origin_host, request.headers)
        if not decision["allowed"]:
            if decision["reason"] in ("not_configured", "missing_credentials") and not payment_guard.is_test_host(x_nostops_origin_host):
                raise HTTPException(status_code=503, detail="Payments are not configured yet.")
            raise HTTPException(status_code=503, detail=payment_guard.DISABLED_DETAIL)
        mode = decision["mode"]
        if mode == "production" and not (_production_url_ok(payload.return_url) and _production_url_ok(payload.notify_url)):
            raise HTTPException(status_code=400, detail="Invalid return address.")
    else:
        raise HTTPException(status_code=503, detail=payment_routing.MESSAGES["provider_unavailable"])

    doc = await _venue_for_token(payload.token)
    sid = doc["_id"]
    if _active(await db.ai_onboarding_entitlements.find_one({"_id": sid})):
        raise HTTPException(status_code=409, detail=_ALREADY)

    email = str(doc.get("submitter_email") or "").strip()
    phone = _clean_phone(payload.phone) or _clean_phone(str(doc.get("submitter_phone") or ""))
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="This listing has no contact email on record. Please contact us to upgrade it.")
    if route["provider"] == "cashfree" and len(phone) < 7:  # Cashfree needs a customer phone; PayPal does not
        raise HTTPException(status_code=400, detail="A valid phone number is required.")

    # TVR-24 — the reuse check, the provider order and the local record run under a short
    # per-venue lock, so two simultaneous starts can never create two orders.
    lock_token = await _take_checkout_lock(sid)
    if not lock_token:
        return JSONResponse({"detail": _CHECKOUT_BUSY, "checkout_busy": True}, status_code=409)
    try:
        if route["provider"] == "paypal":
            return await _start_paypal_checkout(payload, doc, sid, email, region, price, route, mode)
        return await _start_checkout(payload, doc, sid, email, phone, region, price, route, mode)
    finally:
        await _release_checkout_lock(sid, lock_token)


async def _start_checkout(payload: CheckoutIn, doc: dict, sid: str, email: str, phone: str,
                          region: str, price: dict, route: dict, mode: str) -> dict:
    """The checkout start itself; runs only under the per-venue lock taken by create_order."""
    # An unfinished checkout for this venue? Re-check it with Cashfree first, so a
    # second click / second tab never creates a second charge.
    recent = await db.ai_onboarding_orders.find(
        {"submission_id": sid, "paid": False, "mode": mode, "provider": {"$ne": "paypal"},
         "created_at": {"$gte": now_ms() - _REUSE_WINDOW_MS}}
    ).sort("created_at", -1).to_list(5)
    for o in recent:
        try:
            st = await _refresh_status(o["_id"])
        except HTTPException:
            continue
        if st["paid"]:
            raise HTTPException(status_code=409, detail=_ALREADY)
        if st["status"] == "ACTIVE" and o.get("payment_session_id") and o.get("region") == region:
            return {
                "order_id": o["_id"],
                "provider": "cashfree",
                "payment_session_id": o["payment_session_id"],
                "mode": mode,
                "amount": o.get("amount"),
                "currency": o.get("currency"),
                "region": region,
                "reused": True,
            }

    order_id = f"vob_{uuid.uuid4().hex[:20]}"
    if mode == "sandbox":
        # Never the canonical (production) site: return + notify go to THIS preview origin.
        return_url = f"{WEB_APP_BASE_URL}/venues/ai-onboarding/result"
        notify_url = f"{WEB_APP_BASE_URL}/api/ai-onboarding/webhook"
    else:
        return_url = payload.return_url or ""
        notify_url = payload.notify_url or ""
    if return_url:
        sep = "&" if "?" in return_url else "?"
        return_url = f"{return_url}{sep}order_id={order_id}"

    body: dict = {
        "order_id": order_id,
        "order_amount": float(price["total"]),
        "order_currency": price["currency"],
        "order_note": f"NOSTOPS AI-Assisted Venue Onboarding (one-time) — {str(doc.get('name') or '')[:60]}",
        "customer_details": {
            "customer_id": order_id,
            "customer_name": (payload.name or doc.get("submitter_name") or "Venue Owner")[:100],
            "customer_email": email[:100],
            "customer_phone": phone[:20],
        },
        "order_meta": {},
    }
    if return_url:
        body["order_meta"]["return_url"] = return_url
    if notify_url:
        body["order_meta"]["notify_url"] = notify_url

    try:
        async with httpx.AsyncClient(timeout=30.0) as hx:
            r = await hx.post(f"{CF_API_BASE}/orders", headers=_cf_headers(), json=body)
    except httpx.HTTPError:  # TVR-23: network failure / timeout → friendly 502, nothing stored
        raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
    data = r.json() if r.content else {}
    if r.status_code >= 400:
        msg = data.get("message") or data.get("detail") or "Could not start the payment."
        low = str(msg).lower()
        if "currency" in low and "enabl" in low:
            msg = (
                "International (USD) payments aren't enabled on this account yet. "
                "Please choose India (₹) for now, or contact us to pay internationally."
            )
        raise HTTPException(status_code=r.status_code, detail=str(msg))

    session_id = data.get("payment_session_id")
    if not session_id:
        raise HTTPException(status_code=502, detail="Payment gateway did not return a session.")

    doc = {
        "_id": order_id,
        "cf_order_id": data.get("cf_order_id") or data.get("order_id"),
        "status": data.get("order_status") or "ACTIVE",
        "paid": False,
        "submission_id": sid,
        "venue_name": str(doc.get("name") or "")[:120],
        "payment_session_id": session_id,
        "region": region,
        "currency": price["currency"],
        "amount": price["total"],
        "email": email,
        "phone": phone,
        "name": payload.name or "",
        "mode": mode,
        # Prompt 2A — the routing decision this order was created under.
        "billing_country": route["billing_country"],
        "provider": route["provider"],
        "routing": {k: route[k] for k in ("policy_version", "region", "reason", "risk_flags")},
        "pricing_snapshot": dict(price),
        "pricing_rule_version": pricing_rules.RULESET_VERSION,
        "created_at": now_ms(),
        "updated_at": now_ms(),
    }
    await db.ai_onboarding_orders.insert_one(doc)
    return {
        "order_id": order_id,
        "provider": "cashfree",
        "payment_session_id": session_id,
        "mode": mode,
        "amount": price["total"],
        "currency": price["currency"],
        "region": region,
    }


# ── Prompt 4F — PayPal (international, USD) ─────────────────────────────────
PAYPAL_CHECKOUT_HOSTS = {"sandbox": "www.sandbox.paypal.com", "production": "www.paypal.com"}
_PAYPAL_START_FAILED = "Could not start the PayPal payment. Please try again. You have not been charged."
_PAYPAL_OPEN = ("CREATED", "PAYER_ACTION_REQUIRED")


async def _start_paypal_checkout(payload: CheckoutIn, doc: dict, sid: str, email: str, region: str, price: dict,
                                 route: dict, mode: str) -> dict:
    """The PayPal checkout start; runs only under the per-venue lock taken by create_order. The buyer
    approves on PayPal's own page; money is taken only by capture_paypal() once they are back."""
    recent = await db.ai_onboarding_orders.find(
        {"submission_id": sid, "paid": False, "mode": mode, "provider": "paypal",
         "created_at": {"$gte": now_ms() - _REUSE_WINDOW_MS}}
    ).sort("created_at", -1).to_list(5)
    for o in recent:
        try:
            st = await _refresh_status(o["_id"])
        except HTTPException:
            continue
        if st["paid"]:
            raise HTTPException(status_code=409, detail=_ALREADY)
        if st["status"] in _PAYPAL_OPEN and o.get("approve_url"):
            return {"order_id": o["_id"], "provider": "paypal", "approve_url": o["approve_url"], "mode": mode,
                    "amount": o.get("amount"), "currency": o.get("currency"), "region": region, "reused": True}

    order_id = f"vob_{uuid.uuid4().hex[:20]}"
    # Sandbox: never the canonical (production) site — the buyer returns to THIS preview origin.
    base = f"{WEB_APP_BASE_URL}/venues/ai-onboarding/result" if mode == "sandbox" else str(payload.return_url)
    return_url = f"{base}{'&' if '?' in base else '?'}order_id={order_id}&provider=paypal"
    try:
        data = await paypal_checkout.create_order(
            order_id, value=f"{float(price['total']):.2f}", currency=price["currency"],
            description=f"NOSTOPS AI-Assisted Venue Onboarding (one-time) — {str(doc.get('name') or '')[:60]}",
            return_url=return_url, cancel_url=f"{return_url}&cancelled=1")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
    except paypal_checkout.PayPalError:
        raise HTTPException(status_code=502, detail=_PAYPAL_START_FAILED)
    approve = paypal_checkout.approve_url(data)
    if not data.get("id") or payment_guard.url_host(approve) != PAYPAL_CHECKOUT_HOSTS[mode]:
        raise HTTPException(status_code=502, detail=_PAYPAL_START_FAILED)

    await db.ai_onboarding_orders.insert_one({
        "_id": order_id,
        "provider": "paypal",
        "paypal_order_id": str(data["id"])[:64],
        "approve_url": approve,
        "status": str(data.get("status") or "CREATED").upper(),
        "paid": False,
        "submission_id": sid,
        "venue_name": str(doc.get("name") or "")[:120],
        "region": region,
        "currency": price["currency"],
        "amount": price["total"],
        "email": email,
        "phone": _clean_phone(payload.phone),
        "name": payload.name or "",
        "mode": mode,
        "billing_country": route["billing_country"],
        "routing": {k: route[k] for k in ("policy_version", "region", "reason", "risk_flags")},
        "pricing_snapshot": dict(price),
        "pricing_rule_version": pricing_rules.RULESET_VERSION,
        "created_at": now_ms(),
        "updated_at": now_ms(),
    })
    return {"order_id": order_id, "provider": "paypal", "approve_url": approve, "mode": mode,
            "amount": price["total"], "currency": price["currency"], "region": region}


async def _paypal_state(order: dict) -> tuple:
    """(status, paid, mismatch, last_payment) from PayPal's own record of the order."""
    try:
        data = await paypal_checkout.get_order(str(order.get("paypal_order_id") or ""))
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
    except paypal_checkout.PayPalError as e:
        if e.status == 404:
            raise HTTPException(status_code=404, detail="Order not found.")
        raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
    status = str(data.get("status") or "UNKNOWN").upper()
    cap = paypal_checkout.capture_of(data)
    cap_status = str(cap.get("status") or "").upper()
    done = status == "COMPLETED" and cap_status == "COMPLETED"
    mismatch = done and not paypal_checkout.matches(data, cap, order)
    paid = done and not mismatch
    last = "" if paid else ("VOID" if status == "VOIDED" else ("FAILED" if cap_status in ("DECLINED", "FAILED") else cap_status))
    return status, paid, mismatch, last


def _matches_order(cf: dict, local: dict) -> bool:
    """Cashfree's order is the one this module created: same id, amount and currency."""
    try:
        amount_ok = abs(float(cf.get("order_amount")) - float(local.get("amount"))) <= 0.01
    except (TypeError, ValueError):
        return False
    return (amount_ok and str(cf.get("order_currency") or "").upper() == str(local.get("currency") or "").upper()
            and str(cf.get("order_id") or local.get("_id")) == str(local.get("_id")))


async def _event_done(key: str, status: str, note: str = "") -> None:
    await db.ai_onboarding_webhook_events.update_one(
        {"_id": key}, {"$set": {"status": status, "note": note[:80], "updated_at": now_ms()}})


async def _refresh_status(order_id: str) -> dict:
    """Authoritative: re-read the order from its provider and upsert entitlement when PAID."""
    order = await db.ai_onboarding_orders.find_one({"_id": order_id}) or {}
    if order.get("provider") == "paypal":
        status, paid, mismatch, last_payment = await _paypal_state(order)
    else:
        status, paid, mismatch, last_payment = await _cashfree_state(order_id, order)
    await db.ai_onboarding_orders.update_one(
        {"_id": order_id},
        {"$set": {"status": status, "paid": paid, "amount_mismatch": mismatch or None,
                  "last_payment_status": last_payment or None, "updated_at": now_ms()}},
    )
    if mismatch:
        from monitoring import record

        await record("payment", "ai-onboarding:verify", "Paid order does not match the expected amount/currency — nothing granted",
                     path="/api/ai-onboarding/webhook", context={"order": order_id[:60]})
    order = await db.ai_onboarding_orders.find_one({"_id": order_id}) or {}
    sid = order.get("submission_id")
    if paid and sid:
        existing = await db.ai_onboarding_entitlements.find_one({"_id": sid})
        if _active(existing) and order_id not in (existing.get("order_ids") or []):
            # A second payment for an already-upgraded venue — flag it for refund.
            await db.ai_onboarding_orders.update_one({"_id": order_id}, {"$set": {"duplicate_payment": True}})
        await db.ai_onboarding_entitlements.update_one(
            {"_id": sid},
            {
                "$set": {"submission_id": sid, "email": (order.get("email") or "").lower(), "active": True,
                         "source": "payment", "updated_at": now_ms()},
                "$setOnInsert": {"created_at": now_ms(), "place_id": None},
                "$addToSet": {"order_ids": order_id},
            },
            upsert=True,
        )
    return {"order_id": order_id, "status": status, "paid": paid, "venue_name": order.get("venue_name") or "",
            "last_payment_status": last_payment or None, "mode": order.get("mode") or None}


async def _cashfree_state(order_id: str, order: dict) -> tuple:
    """(status, paid, mismatch, last_payment) from Cashfree's own record of the order."""
    try:
        async with httpx.AsyncClient(timeout=20.0) as hx:
            r = await hx.get(f"{CF_API_BASE}/orders/{order_id}", headers=_cf_headers())
    except httpx.HTTPError:  # TVR-23
        raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
    data = r.json() if r.content else {}
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=str(data.get("message") or "Order not found."))

    status = str(data.get("order_status") or "UNKNOWN").upper()
    # P0 Decision 2 — a PAID order counts only when Cashfree's amount + currency equal what
    # this order was created for; otherwise nothing is granted and the order is flagged.
    mismatch = status == "PAID" and bool(order) and not _matches_order(data, order)
    paid = status == "PAID" and not mismatch
    last_payment = ""
    if not paid:
        # Why isn't it paid? The latest payment attempt (FAILED / USER_DROPPED / PENDING),
        # so a cancelled or failed checkout is shown as such — never as "processing".
        try:
            async with httpx.AsyncClient(timeout=20.0) as hx:
                pr = await hx.get(f"{CF_API_BASE}/orders/{order_id}/payments", headers=_cf_headers())
            attempts = pr.json() if pr.status_code == 200 and pr.content else []
            if isinstance(attempts, list) and attempts:
                latest = max(attempts, key=lambda p: str(p.get("payment_time") or p.get("payment_completion_time") or ""))
                last_payment = str(latest.get("payment_status") or "").upper()
        except (httpx.HTTPError, ValueError):
            last_payment = ""
    return status, paid, mismatch, last_payment


@router.get("/status")
async def status(order_id: str, request: Request, x_pulse_secret: Optional[str] = Header(None),
                 x_nostops_origin_host: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    if not order_id or not order_id.startswith("vob_"):
        raise HTTPException(status_code=400, detail="invalid order id")
    # Same environment rule as checkout: a preview never reads from a live gateway. Checked before
    # the order is looked up (neither provider allowed here → refused without touching anything),
    # then again for the provider that actually holds this order.
    cashfree_ok = _decision(x_nostops_origin_host, request.headers)["allowed"]
    paypal_ok = _paypal_decision(x_nostops_origin_host, request.headers)["allowed"]
    if not (cashfree_ok or paypal_ok):
        raise HTTPException(status_code=503, detail=payment_guard.DISABLED_DETAIL)
    order = await db.ai_onboarding_orders.find_one({"_id": order_id}, {"provider": 1})
    if not (paypal_ok if (order or {}).get("provider") == "paypal" else cashfree_ok):
        raise HTTPException(status_code=503, detail=payment_guard.DISABLED_DETAIL)
    return await _refresh_status(order_id)


class CaptureIn(BaseModel):
    order_id: str = Field(min_length=8, max_length=64)


@router.post("/paypal/capture")
async def capture_paypal(payload: CaptureIn, request: Request, x_pulse_secret: Optional[str] = Header(None),
                         x_nostops_origin_host: Optional[str] = Header(None)):
    """Prompt 4F — the buyer is back from PayPal: take the payment they approved (this is when money
    moves), then re-read PayPal's record before anything is granted. Behind the same dual lock as a
    new checkout; idempotent (PayPal-Request-Id + a paid order is never captured again)."""
    _check_secret(x_pulse_secret)
    closed = _new_checkout_closed()
    if closed == "financial_lock":
        return JSONResponse({"detail": financial_lock.FINANCIAL_LOCK_MESSAGE, "financial_lock": True}, status_code=423)
    if closed:
        return JSONResponse({"detail": VENUE_CHECKOUT_UNAVAILABLE, "checkout_unavailable": True, "reason": closed},
                            status_code=503)
    if not payload.order_id.startswith("vob_"):
        raise HTTPException(status_code=400, detail="invalid order id")
    d = _paypal_decision(x_nostops_origin_host, request.headers)
    if not d["allowed"]:
        raise HTTPException(status_code=503, detail=payment_guard.DISABLED_DETAIL)
    order = await db.ai_onboarding_orders.find_one({"_id": payload.order_id})
    if not order or order.get("provider") != "paypal":
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.get("mode") != _stored_mode(d["mode"]):  # a sandbox order is never captured live, or the reverse
        raise HTTPException(status_code=503, detail=payment_guard.DISABLED_DETAIL)
    declined = False
    if not order.get("paid"):
        try:
            await paypal_checkout.capture(str(order.get("paypal_order_id") or ""), request_id=f"{payload.order_id}-capture")
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
        except paypal_checkout.PayPalError as e:
            # Already captured / not approved yet: PayPal's record (re-read below) is the answer.
            declined = e.name == "INSTRUMENT_DECLINED"
            if e.name not in ("ORDER_ALREADY_CAPTURED", "ORDER_NOT_APPROVED", "INSTRUMENT_DECLINED"):
                raise HTTPException(status_code=502, detail=_GATEWAY_DOWN)
    st = await _refresh_status(payload.order_id)
    if declined and not st["paid"]:
        st["last_payment_status"] = "FAILED"
    return st


@router.post("/webhook")
async def webhook(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None),
    x_webhook_timestamp: Optional[str] = Header(None),
    x_idempotency_key: Optional[str] = Header(None),
) -> dict:
    raw = await request.body()
    if not CF_CLIENT_SECRET or not x_webhook_signature or not x_webhook_timestamp:
        raise HTTPException(status_code=400, detail="bad webhook")
    try:
        signed = (x_webhook_timestamp + raw.decode("utf-8")).encode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="bad webhook")
    expected = base64.b64encode(
        hmac.new(CF_CLIENT_SECRET.encode("utf-8"), signed, hashlib.sha256).digest()
    ).decode("utf-8")
    if not hmac.compare_digest(expected, x_webhook_signature):
        from monitoring import record

        await record("payment", "ai-onboarding:webhook", "Webhook signature rejected (possible forged payment notification)",
                     path="/api/ai-onboarding/webhook", status=401)
        raise HTTPException(status_code=401, detail="bad signature")
    # Replay window (TVR-17): Cashfree timestamps are epoch milliseconds; seconds accepted too.
    try:
        ts = int(x_webhook_timestamp)
    except ValueError:
        raise HTTPException(status_code=400, detail="bad webhook")
    age = time.time() - (ts / 1000 if ts > 10**12 else ts)
    if age > WEBHOOK_MAX_AGE_S or age < -WEBHOOK_MAX_SKEW_S:
        raise HTTPException(status_code=400, detail="stale webhook")

    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:  # noqa: BLE001
        payload = {}
    data = payload.get("data") or {}
    order = data.get("order") or {}
    order_id = str(order.get("order_id") or data.get("order_id") or "")

    # B4.7 — a notification reaching a PREVIEW host is applied only when this
    # preview runs on the Cashfree SANDBOX and the order is one of its own sandbox
    # orders. Live notifications are acknowledged and ignored, so live and test
    # transactions can never mix.
    if payment_guard.ingress_blocked(request.headers):
        local = await db.ai_onboarding_orders.find_one({"_id": order_id}, {"mode": 1}) if order_id else None
        if payment_guard.cashfree_mode(CF_API_BASE) != "sandbox" or not local or local.get("mode") != "sandbox":
            return {"ok": True, "ignored": "preview"}

    # Duplicate delivery (Cashfree is at-least-once): acknowledge, never re-apply. P0 Decision 2:
    # an event counts as handled only once it was PROCESSED (or safely ignored); a failed or
    # interrupted attempt is retried on the provider's next delivery, never acknowledged as done.
    # Prompt 4E — a notification is identified by its SIGNED body (a provider retry resends the same
    # body). The unsigned x-idempotency-key header is stored only as a label and is never the key, so
    # a replay with a changed header is still recognised as the same notification.
    key = hashlib.sha256(raw).hexdigest()
    pay_status = str((data.get("payment") or {}).get("payment_status") or "").upper()
    now = now_ms()
    try:
        await db.ai_onboarding_webhook_events.insert_one({
            "_id": key, "idempotency_label": str(x_idempotency_key or "")[:80],
            "order_id": order_id[:60], "type": str(payload.get("type") or "")[:60],
            "payment_status": pay_status[:30], "status": "processing", "attempts": 1,
            "received_at": now, "updated_at": now,
        })
    except DuplicateKeyError:
        prev = await db.ai_onboarding_webhook_events.find_one({"_id": key}) or {}
        if prev.get("status", "processed") in ("processed", "ignored"):  # legacy rows had no status
            return {"ok": True, "duplicate": True}
        if prev.get("status") == "processing" and now - int(prev.get("updated_at") or 0) < 60_000:
            raise HTTPException(status_code=503, detail="already being processed; retry later")
        took = await db.ai_onboarding_webhook_events.update_one(
            {"_id": key, "status": prev.get("status"), "updated_at": prev.get("updated_at")},
            {"$set": {"status": "processing", "updated_at": now}, "$inc": {"attempts": 1}})
        if not took.modified_count:
            raise HTTPException(status_code=503, detail="already being processed; retry later")

    from monitoring import record

    if pay_status in ("FAILED", "USER_DROPPED", "CANCELLED"):
        await record("payment", "ai-onboarding:webhook", f"Customer payment {pay_status.lower()}",
                     path="/api/ai-onboarding/webhook", context={"order": order_id[:60]})
    if not order_id.startswith("vob_") or not await db.ai_onboarding_orders.find_one({"_id": order_id}, {"_id": 1}):
        # Not an order this module created: acknowledged (no retry loop), nothing applied.
        await _event_done(key, "ignored", "unknown_order")
        await record("payment", "ai-onboarding:webhook", "Signed notification for an unknown order — ignored",
                     path="/api/ai-onboarding/webhook", context={"order": order_id[:60]}, alert=False)
        return {"ok": True, "ignored": "unknown_order"}
    try:
        st = await _refresh_status(order_id)  # re-reads the order from Cashfree; never trusts the payload
    except Exception as exc:  # noqa: BLE001 — not processed: say so, so the provider retries
        await _event_done(key, "failed", type(exc).__name__)
        await record("payment", "ai-onboarding:webhook", "Payment notification not processed yet — provider will retry",
                     path="/api/ai-onboarding/webhook", status=503, context={"order": order_id[:60]})
        raise HTTPException(status_code=503, detail="not processed; retry later")
    await _event_done(key, "processed", str(st.get("status") or ""))
    return {"ok": True}


# ── Who may show Google photos / reviews: paid venues only ───────────────────
@router.get("/entitlements")
async def list_entitlements(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Server-only read used by the website to decide which venue listings may
    show Google photos & reviews (paid, per-venue upgrades)."""
    _check_secret(x_pulse_secret)
    docs = await db.ai_onboarding_entitlements.find({"active": True}).to_list(2000)
    return {"venues": [
        {"submission_id": d.get("submission_id") or d["_id"], "place_id": d.get("place_id") or None}
        for d in docs if d.get("submission_id")
    ]}


@router.get("/admin/{sid}")
async def admin_entitlement(sid: str, user: dict = Depends(current_user)) -> dict:
    _require_admin(user)
    ent = await db.ai_onboarding_entitlements.find_one({"_id": sid})
    orders = await db.ai_onboarding_orders.find({"submission_id": sid}).sort("created_at", -1).to_list(20)
    return {
        "active": _active(ent),
        "place_id": (ent or {}).get("place_id") or None,
        "place_confirmed_by": (ent or {}).get("place_confirmed_by"),
        "purchased_at": (ent or {}).get("created_at"),
        "orders": [{"order_id": o["_id"], "provider": o.get("provider") or "cashfree", "status": o.get("status"),
                    "paid": bool(o.get("paid")), "amount": o.get("amount"),
                    "currency": o.get("currency"), "created_at": o.get("created_at"), "duplicate_payment": bool(o.get("duplicate_payment"))}
                   for o in orders],
    }


class PlaceIn(BaseModel):
    place_id: str = Field(default="", max_length=300)


@router.put("/admin/{sid}/place")
async def set_place(sid: str, payload: PlaceIn, user: dict = Depends(current_user)) -> dict:
    """Admin confirms the exact Google place for a PAID venue (or clears it)."""
    _require_admin(user)
    ent = await db.ai_onboarding_entitlements.find_one({"_id": sid})
    if not _active(ent):
        raise HTTPException(status_code=409, detail="This venue hasn't purchased AI-assisted onboarding, so it can't show Google content.")
    pid = (payload.place_id or "").strip()
    if pid and not re.fullmatch(r"[A-Za-z0-9_-]{10,300}", pid):
        raise HTTPException(status_code=422, detail="That doesn't look like a Google Place ID (e.g. ChIJ…).")
    await db.ai_onboarding_entitlements.update_one(
        {"_id": sid},
        {"$set": {"place_id": pid or None, "place_confirmed_by": str(user.get("name") or "admin"), "place_confirmed_at": now_ms(), "updated_at": now_ms()}},
    )
    return {"ok": True, "place_id": pid or None}
