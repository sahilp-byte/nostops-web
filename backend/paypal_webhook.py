"""Payments Prompt 2A (2026-10) — PayPal webhook verification at the website gateway.

Upstream (main backend) `POST /api/international/paypal/webhook` accepts events WITHOUT a
signature check when its PAYPAL_WEBHOOK_ID is unset (its own API docs). That code lives
outside this workspace, so this gateway verifies every PayPal notification that reaches
/api/* BEFORE anything is forwarded, and fails closed:

  1. Configuration: PAYPAL_API_BASE (exact sandbox/live host), client id + secret,
     PAYPAL_WEBHOOK_ID and PAYPAL_MERCHANT_ID must all be set, and the environment must
     match the host (sandbox only on a preview host, live only on a production host).
     Missing → 503, nothing forwarded (PayPal retries non-2xx deliveries).
  2. Transmission headers present; cert URL is https on *.paypal.com of the SAME
     environment; algorithm SHA256withRSA; transmission time fresh (≤ 3 days, ≤ 5 min ahead).
  3. Signature: PayPal's documented verify-webhook-signature API (OAuth client credentials),
     with the RAW event body embedded byte-for-byte. Anything but "SUCCESS" → refused;
     PayPal unreachable → 503.
  4. After verification: the event must be for OUR merchant (resource.payee.merchant_id)
     and carry its capture id + order id. Only PAYMENT.CAPTURE.COMPLETED / DENIED are
     forwarded. REFUNDED / REVERSED (money going out) are HELD while the money lock is on:
     recorded, acknowledged, not forwarded. Other types are acknowledged and ignored.
  5. Idempotency: one record per PayPal event id. A delivered event is never forwarded
     twice; an older event that arrives after a newer one for the same capture (a refund or
     reversal is matched to its capture through its "up" link) is STALE and not forwarded.
     A REJECTED event is checked again on PayPal's retry, so a corrected setting still
     delivers it. Nothing here marks an order paid or edits a historical record.
"""
import json
import os
import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi.responses import JSONResponse, Response
from motor.motor_asyncio import AsyncIOMotorClient

import payment_guard

PATH = "international/paypal/webhook"
FORWARD_EVENTS = frozenset({"PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.DENIED"})
HOLD_EVENTS = frozenset({"PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"})
REQUIRED_HEADERS = ("paypal-transmission-id", "paypal-transmission-time", "paypal-transmission-sig",
                    "paypal-cert-url", "paypal-auth-algo")
FINAL_STATES = ("FORWARDED", "HELD", "IGNORED", "STALE")  # REJECTED is re-checked on PayPal's retry
MAX_AGE_S = 3 * 24 * 3600 + 3600
MAX_SKEW_S = 300
CLAIM_TTL_MS = 120_000
_EVENT_ID = re.compile(r"^WH-[A-Za-z0-9-]{6,120}$")
_CAPTURE_LINK = re.compile(r"/captures/([A-Za-z0-9-]{1,120})(/|$)")

NOT_CONFIGURED = "PayPal notifications are not accepted: signature verification is not configured. Nothing was recorded."

db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
# Tests inject a mock PayPal here; None = the real network (never used by the tests).
transport: Optional[httpx.AsyncBaseTransport] = None


def _config() -> dict:
    return {
        "api_base": os.environ.get("PAYPAL_API_BASE", "").strip().rstrip("/"),
        "client_id": os.environ.get("PAYPAL_CLIENT_ID", ""),
        "client_secret": os.environ.get("PAYPAL_CLIENT_SECRET", ""),
        "webhook_id": os.environ.get("PAYPAL_WEBHOOK_ID", "").strip(),
        "merchant_id": os.environ.get("PAYPAL_MERCHANT_ID", "").strip(),
    }


def _no(status: int, reason: str, detail: str) -> JSONResponse:
    return JSONResponse({"detail": detail, "paypal_webhook": reason}, status_code=status)


def _ingress_host(headers) -> str:
    return headers.get("x-forwarded-host") or headers.get("host") or ""


def _epoch(value: Optional[str]) -> Optional[float]:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


async def _verify(cfg: dict, h: dict, raw: bytes) -> str:
    """PayPal's verification answer ("SUCCESS" / "FAILURE"). Raises when it can't be obtained."""
    async with httpx.AsyncClient(base_url=cfg["api_base"], timeout=15.0, transport=transport) as hx:
        t = await hx.post("/v1/oauth2/token", data={"grant_type": "client_credentials"},
                          auth=(cfg["client_id"], cfg["client_secret"]), headers={"Accept": "application/json"})
        token = t.json().get("access_token") if t.status_code == 200 else None
        if not token:
            raise ValueError("oauth")
        envelope = json.dumps({
            "auth_algo": h["paypal-auth-algo"], "cert_url": h["paypal-cert-url"],
            "transmission_id": h["paypal-transmission-id"], "transmission_sig": h["paypal-transmission-sig"],
            "transmission_time": h["paypal-transmission-time"], "webhook_id": cfg["webhook_id"],
        })
        # The event goes in exactly as PayPal sent it (re-serialising can break verification).
        content = envelope[:-1] + ',"webhook_event":' + raw.decode("utf-8") + "}"
        v = await hx.post("/v1/notifications/verify-webhook-signature", content=content,
                          headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        if v.status_code != 200:
            raise ValueError("verify")
        return str(v.json().get("verification_status") or "")


def _capture_id(etype: str, res: dict) -> str:
    """The capture an event is about: the resource itself for a capture event; for a refund or
    reversal (the resource is the refund) the capture its "up" link points to."""
    if etype not in HOLD_EVENTS:
        return str(res.get("id") or "")[:120]
    for link in res.get("links") or []:
        if isinstance(link, dict) and link.get("rel") == "up":
            m = _CAPTURE_LINK.search(str(link.get("href") or ""))
            if m:
                return m.group(1)
    return ""


async def _set(eid: str, **fields) -> None:
    await db.paypal_webhook_events.update_one({"_id": eid}, {"$set": {**fields, "updated_at": int(time.time() * 1000)}})


async def handle(upstream: httpx.AsyncClient, request, body: bytes) -> Response:
    if request.method.upper() != "POST":
        return _no(405, "method", "Method not allowed")
    cfg = _config()
    env = payment_guard.paypal_env_decision(_ingress_host(request.headers), request.headers, api_base=cfg["api_base"],
                                            client_id=cfg["client_id"], client_secret=cfg["client_secret"])
    if not env["allowed"] or not cfg["webhook_id"] or not cfg["merchant_id"]:
        return _no(503, "not_configured", NOT_CONFIGURED)

    h = {k: (request.headers.get(k) or "").strip() for k in REQUIRED_HEADERS}
    if not all(h.values()):
        return _no(400, "unsigned", "PayPal signature headers are missing. Nothing was recorded.")
    cert = urlparse(h["paypal-cert-url"])
    cert_host = (cert.hostname or "").lower()
    if (cert.scheme != "https" or not cert_host.endswith(".paypal.com")
            or ("sandbox" in cert_host) != (env["mode"] == "sandbox")):
        return _no(400, "bad_cert_url", "PayPal certificate address is not valid for this environment.")
    if h["paypal-auth-algo"] != "SHA256withRSA":
        return _no(400, "bad_algorithm", "Unsupported PayPal signature algorithm.")
    sent_at = _epoch(h["paypal-transmission-time"])
    now = time.time()
    if sent_at is None or now - sent_at > MAX_AGE_S or sent_at - now > MAX_SKEW_S:
        return _no(400, "stale_transmission", "PayPal notification time is outside the accepted window.")
    try:
        event = json.loads(body)
        body.decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return _no(400, "malformed", "PayPal notification body is not valid JSON.")
    if (not isinstance(event, dict) or not isinstance(event.get("id"), str) or not _EVENT_ID.match(event["id"])
            or not isinstance(event.get("event_type"), str) or not isinstance(event.get("resource"), dict)):
        return _no(400, "malformed", "PayPal notification is missing its id, type or resource.")

    try:
        status = await _verify(cfg, h, body)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return _no(503, "verification_unavailable", "PayPal signature could not be verified right now. Nothing was recorded.")
    if status != "SUCCESS":
        return _no(400, "signature_invalid", "PayPal signature verification failed. Nothing was recorded.")

    # ── Verified. One record per PayPal event id from here on. ──
    eid, etype, res = event["id"], event["event_type"], event["resource"]
    resource_id = str(res.get("id") or "")[:120]
    capture_id = _capture_id(etype, res)
    related = (res.get("supplementary_data") or {}).get("related_ids") or {}
    order_id = str(related.get("order_id") or "")[:120] if isinstance(related, dict) else ""
    payee = res.get("payee") if isinstance(res.get("payee"), dict) else {}
    event_time = _epoch(event.get("create_time")) or sent_at
    now_ms = int(now * 1000)
    await db.paypal_webhook_events.update_one({"_id": eid}, {"$setOnInsert": {
        "state": "VERIFIED", "event_type": etype, "resource_id": resource_id, "capture_id": capture_id, "order_id": order_id,
        "transmission_id": h["paypal-transmission-id"][:120], "mode": env["mode"], "event_time": event_time,
        "attempts": 0, "received_at": now_ms,
    }}, upsert=True)
    doc = await db.paypal_webhook_events.find_one({"_id": eid}) or {}
    if doc.get("state") in FINAL_STATES:
        return JSONResponse({"ok": True, "duplicate": True, "state": doc["state"]})

    if etype in HOLD_EVENTS:  # money going out — held while the money lock is on
        await _set(eid, state="HELD", note="refund/reversal notice held for review (financial lock)")
        return JSONResponse({"ok": True, "held": True})
    if etype not in FORWARD_EVENTS:
        await _set(eid, state="IGNORED")
        return JSONResponse({"ok": True, "ignored": True})
    if str(payee.get("merchant_id") or "") != cfg["merchant_id"]:
        await _set(eid, state="REJECTED", reason="merchant_mismatch")
        return _no(422, "merchant_mismatch", "PayPal notification is not for the NOSTOPS merchant account.")
    if not resource_id or not order_id:
        await _set(eid, state="REJECTED", reason="missing_reference")
        return _no(422, "missing_reference", "PayPal notification has no capture or order reference.")
    newer = await db.paypal_webhook_events.find_one({
        "_id": {"$ne": eid}, "capture_id": capture_id, "state": {"$in": ["FORWARDED", "HELD"]},
        "event_time": {"$gt": event_time}})
    if newer:
        await _set(eid, state="STALE", superseded_by=newer["_id"])
        return JSONResponse({"ok": True, "stale": True})

    claimed = await db.paypal_webhook_events.find_one_and_update(
        {"_id": eid, "$or": [{"state": {"$in": ["VERIFIED", "FORWARD_FAILED", "REJECTED"]}},
                             {"state": "FORWARDING", "claimed_at": {"$lt": now_ms - CLAIM_TTL_MS}}]},
        {"$set": {"state": "FORWARDING", "claimed_at": now_ms}, "$inc": {"attempts": 1}})
    if not claimed:
        return _no(409, "in_progress", "This PayPal notification is already being processed.")
    fwd = {k: request.headers[k] for k in REQUIRED_HEADERS}
    fwd["content-type"] = request.headers.get("content-type") or "application/json"
    try:
        up = await upstream.post(f"/api/{PATH}", content=body, headers=fwd)
    except httpx.RequestError:
        await _set(eid, state="FORWARD_FAILED", upstream_status=None)
        return _no(502, "upstream_unreachable", "Could not deliver the notification. PayPal will retry.")
    if 200 <= up.status_code < 300:
        await _set(eid, state="FORWARDED", upstream_status=up.status_code)
        return Response(content=up.content, status_code=up.status_code, media_type=up.headers.get("content-type"))
    await _set(eid, state="FORWARD_FAILED", upstream_status=up.status_code)
    return _no(502, "upstream_error", "Could not deliver the notification. PayPal will retry.")
