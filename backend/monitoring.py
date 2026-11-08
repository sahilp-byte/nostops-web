"""
NOSTOPS Error Monitor — built-in error monitoring + email alerts (local Mongo
`monitor_events`, `monitor_alerts`). No third-party service.

What gets recorded (kind):
  · page     — browser crashes / error-boundary hits (via the BFF beacon) and
               Next.js server render errors (instrumentation onRequestError)
  · server   — any 5xx produced by this backend (middleware) + unhandled exceptions
  · payment  — gateway errors / outages, rejected (forged) webhooks, failed-payment
               notifications, and BFF payment relays that get a 5xx / no answer
  · email    — any transactional email that could not be sent (enquiry alerts,
               acknowledgements, proposals, …)

Events are grouped by a fingerprint (kind + source + normalised message + path),
so 1,000 identical crashes are ONE row with count=1000. Alert emails go to
MONITOR_ALERT_EMAIL (default nostops.org@gmail.com): the first time a group is
seen and then at most once per cooldown window, with a global hourly cap so a
storm can never flood the inbox. Alert sends never re-enter the monitor
(no loops when the email service itself is down — those still show in the admin).

Routes: POST /api/monitoring/events (shared secret; BFF / Next server only),
admin-only (secret + X-Pulse-User role=admin): GET /events, GET /summary,
PATCH /events/{id}, POST /test-alert.
"""
import asyncio
import base64
import hashlib
import hmac
import html
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

import test_tag

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
ALERT_TO = os.environ.get("MONITOR_ALERT_EMAIL") or "nostops.org@gmail.com"
SITE = "https://www.nostops.org"

_db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
_events = _db["monitor_events"]
_alerts = _db["monitor_alerts"]
log = logging.getLogger("monitor")

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

KINDS = {"page": "Page error", "server": "Server error", "payment": "Payment problem", "email": "Email delivery failure"}
# Re-alert the same group at most once per window; payments/emails matter most.
COOLDOWN = {"page": timedelta(hours=6), "server": timedelta(hours=1), "payment": timedelta(minutes=30), "email": timedelta(hours=1)}
MAX_ALERTS_PER_HOUR = 20
_PAYMENT_PATH = re.compile(r"/(ai-onboarding|payments?|cashfree|checkout|reserve|reservations|group-book|participant/payment|venue-onboarding)(/|$)", re.I)
_tasks: set = set()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _iso(d: datetime) -> str:
    return d.isoformat()


def normalise_path(path: str) -> str:
    """Collapse ids so /orders/vob_123 and /orders/vob_456 group together."""
    p = (path or "").split("?", 1)[0][:300]
    p = re.sub(r"/[0-9a-f]{16,}(?=/|$)", "/:id", p, flags=re.I)
    p = re.sub(r"/(vob|ord|enq|loc|sub|ret|res|rid|order)_[A-Za-z0-9_-]+", r"/\1_:id", p, flags=re.I)
    p = re.sub(r"/\d{3,}(?=/|$)", "/:n", p)
    return p


def is_payment_path(path: str) -> bool:
    return bool(_PAYMENT_PATH.search(path or ""))


def _fingerprint(kind: str, source: str, message: str, path: str) -> str:
    msg = re.sub(r"\d+", "#", (message or "").lower())[:200]
    raw = f"{kind}|{source.lower()}|{msg}|{normalise_path(path)}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]


def _safe_context(ctx: Optional[dict]) -> dict:
    out: dict = {}
    for k, v in list((ctx or {}).items())[:12]:
        key = str(k)[:40]
        if re.search(r"pass|token|secret|authorization|cookie|key", key, re.I):
            continue  # never store credentials
        out[key] = str(v)[:500] if not isinstance(v, (int, float, bool)) or v is None else v
    return out


async def record(
    kind: str,
    source: str,
    message: str,
    *,
    path: str = "",
    status: Optional[int] = None,
    context: Optional[dict] = None,
    alert: bool = True,
) -> Optional[dict]:
    """Group + store one occurrence, and maybe send an alert. Never raises."""
    try:
        kind = kind if kind in KINDS else "server"
        source, message, path = (source or "unknown")[:120], (message or "error")[:500], normalise_path(path)
        fp = _fingerprint(kind, source, message, path)
        now = _iso(_now())
        sample = {"at": now, "status": status, **_safe_context(context)}
        if test_tag.current():  # Prompt 2F — a signed test run: separate test log, never an alert
            return await test_tag.capture_event({"kind": kind, "source": source, "message": message, "path": path,
                                                 "status": status, "fingerprint": fp, "count": 1, "sample": sample})
        doc = await _events.find_one_and_update(
            {"_id": fp},
            {
                "$setOnInsert": {"kind": kind, "source": source, "message": message, "path": path, "first_at": now},
                "$set": {"last_at": now, "last_status": status, "status": "open"},
                "$inc": {"count": 1},
                "$push": {"samples": {"$each": [sample], "$slice": -5}},
            },
            upsert=True,
            return_document=True,
        )
        if alert and doc:
            t = asyncio.create_task(_maybe_alert(doc))
            _tasks.add(t)
            t.add_done_callback(_tasks.discard)
        return doc
    except Exception as exc:  # noqa: BLE001 — monitoring must never break the request
        log.warning("monitor record failed: %s", exc)
        return None


async def _send_alert_email(doc: dict) -> None:
    from email_util import send_email

    await send_email(to=ALERT_TO, subject=_subject(doc), html=_alert_html(doc), monitor=False)


async def _preview_alert(doc: dict, force: bool) -> str:
    """Prompt 2G — a preview never emails an alert (decided by this server's own environment, not by
    the request): the same cooldown applies, and the alert is written to the test log instead. No
    row in monitor_alerts, so the live alert log and its hourly quota stay real alerts only."""
    now = _now()
    last = doc.get("last_alert_at")
    if not force and last and now - datetime.fromisoformat(last) < COOLDOWN.get(doc["kind"], timedelta(hours=1)):
        return "cooldown"
    claimed = await _events.update_one({"_id": doc["_id"], "last_alert_at": last}, {"$set": {"last_alert_at": _iso(now)}})
    if not claimed.modified_count and not force:
        return "cooldown"
    await test_tag.capture_alert(doc, subject=_subject(doc), forced=force)
    await _events.update_one({"_id": doc["_id"]}, {"$set": {"alert_status": "preview_test_log"}})
    return "preview_test_log"


async def _maybe_alert(doc: dict, force: bool = False) -> str:
    if test_tag.current():  # Prompt 2F — a test run's alert goes to the test outbox; the real quota is untouched
        await _send_alert_email(doc)
        return "test_outbox"
    if test_tag.environment_allows():  # Prompt 2G — a preview never emails an alert
        return await _preview_alert(doc, force)
    now = _now()
    if not force:
        last = doc.get("last_alert_at")
        if last and now - datetime.fromisoformat(last) < COOLDOWN.get(doc["kind"], timedelta(hours=1)):
            return "cooldown"
        if await _alerts.count_documents({"at": {"$gte": _iso(now - timedelta(hours=1))}}) >= MAX_ALERTS_PER_HOUR:
            await _events.update_one({"_id": doc["_id"]}, {"$set": {"alert_status": "capped"}})
            return "capped"
    # Claim the alert slot first so concurrent occurrences don't double-send.
    claimed = await _events.update_one(
        {"_id": doc["_id"], "last_alert_at": doc.get("last_alert_at")}, {"$set": {"last_alert_at": _iso(now)}}
    )
    if not claimed.modified_count and not force:
        return "cooldown"
    status = "sent"
    try:
        await _send_alert_email(doc)
    except Exception as exc:  # noqa: BLE001
        status = "failed"
        log.warning("monitor alert email failed: %s", getattr(exc, "detail", exc))
    await _alerts.insert_one({"event_id": doc["_id"], "at": _iso(now), "status": status, "kind": doc["kind"]})
    await _events.update_one({"_id": doc["_id"]}, {"$set": {"alert_status": status, "alerts_sent": int(doc.get("alerts_sent") or 0) + (status == "sent")}})
    return status


def _subject(doc: dict) -> str:
    where = doc.get("path") or doc.get("source")
    return f"[NOSTOPS alert] {KINDS.get(doc['kind'], 'Error')} · {where}"[:180] + (f" (×{doc['count']})" if doc.get("count", 1) > 1 else "")


def _alert_html(doc: dict) -> str:
    rows = [
        ("Type", KINDS.get(doc["kind"], doc["kind"])),
        ("Where", doc.get("path") or "—"),
        ("Source", doc.get("source") or "—"),
        ("What happened", doc.get("message") or "—"),
        ("Last status", doc.get("last_status") or "—"),
        ("Occurrences", doc.get("count", 1)),
        ("First seen (UTC)", (doc.get("first_at") or "").replace("T", " ").replace("+00:00", "")),
        ("Last seen (UTC)", (doc.get("last_at") or "").replace("T", " ").replace("+00:00", "")),
    ]
    trs = "".join(
        f"<tr><td style='padding:4px 12px 4px 0;color:#6b7280;vertical-align:top'>{html.escape(k)}</td>"
        f"<td style='padding:4px 0;font-weight:600'>{html.escape(str(v))}</td></tr>" for k, v in rows
    )
    link = html.escape(f"{SITE}/app/admin/error-monitor")
    return (
        "<div style='font-family:system-ui,sans-serif;color:#111827'>"
        f"<h2 style='margin:0 0 8px'>{html.escape(KINDS.get(doc['kind'], 'Error'))} on NOSTOPS</h2>"
        "<p style='margin:0 0 12px;color:#374151'>Repeats of this same problem are grouped and will not email you again for a while.</p>"
        f"<table style='border-collapse:collapse;font-size:14px'>{trs}</table>"
        f"<p style='margin:16px 0 0'><a href='{link}' style='color:#0f766e;font-weight:700'>Open the Error Monitor &rarr;</a></p>"
        "</div>"
    )


# ─────────────────────────────── API ───────────────────────────────────────
def _check_secret(x_pulse_secret: Optional[str]) -> None:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


def _require_admin(x_pulse_secret: Optional[str], x_pulse_user: Optional[str]) -> dict:
    _check_secret(x_pulse_secret)
    try:
        user = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="unauthorized")
    if str(user.get("role") or "") != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


class EventIn(BaseModel):
    kind: Literal["page", "server", "payment", "email"]
    source: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=500)
    path: str = Field(default="", max_length=300)
    status: Optional[int] = Field(default=None, ge=0, le=999)
    context: dict = Field(default_factory=dict)


class EventPatch(BaseModel):
    status: Literal["open", "resolved"]


def _public(d: dict) -> dict:
    out = {k: v for k, v in d.items() if k != "_id"}
    out["id"] = d["_id"]
    return out


@router.post("/events")
async def ingest(payload: EventIn, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    if len(json.dumps(payload.context, default=str)) > 4000:
        raise HTTPException(status_code=413, detail="context too large")
    doc = await record(payload.kind, payload.source, payload.message, path=payload.path, status=payload.status, context=payload.context)
    return {"ok": bool(doc), "id": doc and doc["_id"]}


@router.get("/events")
async def list_events(
    status: str = "open",
    kind: Optional[str] = None,
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    _require_admin(x_pulse_secret, x_pulse_user)
    q: dict = {}
    if status in ("open", "resolved"):
        q["status"] = status
    if kind in KINDS:
        q["kind"] = kind
    items = [_public(d) async for d in _events.find(q).sort("last_at", -1).limit(300)]
    by_kind = {k: 0 for k in KINDS}
    async for row in _events.aggregate([{"$match": {"status": "open"}}, {"$group": {"_id": "$kind", "n": {"$sum": 1}}}]):
        if row["_id"] in by_kind:
            by_kind[row["_id"]] = row["n"]
    day_ago = _iso(_now() - timedelta(hours=24))
    return {
        "items": items,
        "open_by_kind": by_kind,
        "open_total": sum(by_kind.values()),
        "last_24h": await _events.count_documents({"last_at": {"$gte": day_ago}}),
        "alert_to": ALERT_TO,
    }


@router.get("/summary")
async def summary(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    return {"open": await _events.count_documents({"status": "open"})}


async def _admin_dep(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)) -> dict:
    """B4.7 — dependency form, so auth runs before the body is validated."""
    return _require_admin(x_pulse_secret, x_pulse_user)


@router.patch("/events/{eid}")
async def update_event(eid: str, payload: EventPatch, user: dict = Depends(_admin_dep)):
    sets = {"status": payload.status}
    if payload.status == "resolved":
        sets.update(resolved_at=_iso(_now()), resolved_by=str(user.get("name") or "admin")[:120])
    res = await _events.find_one_and_update({"_id": eid}, {"$set": sets}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Event not found.")
    return _public(res)


@router.post("/test-alert")
async def test_alert(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    user = _require_admin(x_pulse_secret, x_pulse_user)
    doc = await record("server", "monitor:test", f"Test alert requested by {str(user.get('name') or 'admin')[:60]}", path="/app/admin/error-monitor", alert=False)
    if not doc:
        raise HTTPException(status_code=500, detail="Could not record the test event.")
    status = await _maybe_alert(doc, force=True)
    return {"ok": status in ("sent", "preview_test_log"), "alert_status": status, "to": ALERT_TO, "id": doc["_id"]}
