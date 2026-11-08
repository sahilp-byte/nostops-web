"""Payments Prompt 2F — signed test tag: test traffic never sends a real email or a real alert.

A test run sends `X-Nostops-Test-Tag: v1.<run id>.<expires>.<signature>` (HMAC-SHA256 with a key
derived from PULSE_SHARED_SECRET). The website BFF checks it and passes it on to this backend,
which checks it again. The tag is honoured only when ALL of these hold:
  * the signature is valid and the tag has not expired (lifetime at most 24 hours);
  * this server runs in a preview: APP_URL is a preview host AND MONGO_URL is the pod's own local
    database (a deployed site has neither).
The Host / origin headers of a request are NOT used for this: whoever sends a request sets them
(the tests set production hosts on purpose to exercise production rules), while the environment
is the server's own. Otherwise the tag is ignored and the request is handled exactly as before
(production ignores it).

While a tagged request is handled, its emails go to the test outbox instead of being sent, and its
Error Monitor events go to a separate test log (no alert email, no row in the real monitor). Both
are kept in their own database, `<DB_NAME>_test_sink`. Nothing else changes.

Prompt 2G — two rules that need NO tag, decided only by this server's own environment (the same
`environment_allows()` check: a preview pod with its own local database; a deployed site never):
  * a preview never emails an Error Monitor alert: the alert is written to the test log instead
    (the error itself is still recorded and shown in the admin Error Monitor) — monitoring.py;
  * a preview never emails a recognised test / synthetic address (see `test_address_reason`): it
    goes to the test outbox — email_util.py and the website's own two email routes.
"""
import contextvars
import hashlib
import hmac
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

import payment_guard

load_dotenv()

HEADER = "X-Nostops-Test-Tag"
VERSION = "v1"
MAX_LIFETIME_S = 24 * 3600
_RUN = re.compile(r"^[A-Za-z0-9_-]{3,48}$")
_SIG = re.compile(r"^[0-9a-f]{64}$")
SINK_DB = f"{os.environ.get('DB_NAME', 'nostops_web')}_test_sink"

_current: contextvars.ContextVar = contextvars.ContextVar("nostops_test_run", default=None)
_sink = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[SINK_DB]
outbox = _sink["email_outbox"]
monitor_log = _sink["monitor_log"]


def _key() -> bytes:
    secret = os.environ.get("PULSE_SHARED_SECRET", "")
    return hmac.new(secret.encode(), b"nostops-test-tag/v1", hashlib.sha256).digest() if secret else b""


def sign(run_id: str, ttl_s: int = 6 * 3600, now: Optional[float] = None) -> str:
    """A tag for a test run (used by the test suite, which holds the same shared secret)."""
    if not _RUN.match(run_id or ""):
        raise ValueError("run id: 3-48 letters, digits, '_' or '-'")
    body = f"{VERSION}.{run_id}.{int((now or time.time()) + ttl_s)}"
    return f"{body}.{hmac.new(_key(), body.encode(), hashlib.sha256).hexdigest()}"


def verify(tag: Optional[str], now: Optional[float] = None) -> Optional[str]:
    """The run id of a valid, unexpired tag, or None."""
    key = _key()
    parts = str(tag or "").strip().split(".")
    if not key or len(parts) != 4 or parts[0] != VERSION or not _RUN.match(parts[1]):
        return None
    if not parts[2].isdigit() or len(parts[2]) > 12 or not _SIG.match(parts[3]):
        return None
    good = hmac.new(key, ".".join(parts[:3]).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(good, parts[3]):
        return None
    left = int(parts[2]) - (now or time.time())
    return parts[1] if 0 < left <= MAX_LIFETIME_S else None


def environment_allows() -> bool:
    """Server-side check: only a preview pod with its own local database honours test tags."""
    app_host = urlparse(os.environ.get("APP_URL", "")).hostname or ""
    mongo_host = (urlparse(os.environ.get("MONGO_URL", "")).hostname or "").lower()
    return payment_guard.is_preview_suffix(app_host) and mongo_host in payment_guard.LOCAL_HOSTS


def run_for(headers) -> Optional[str]:
    tag = headers.get(HEADER)
    if not tag or not environment_allows():
        return None
    return verify(tag)


def activate(headers) -> contextvars.Token:
    return _current.set(run_for(headers))


def reset(token: contextvars.Token) -> None:
    _current.reset(token)


def current() -> Optional[str]:
    """The run id of the signed test run this request belongs to, or None (normal traffic)."""
    return _current.get()


# ── Prompt 2G — recognised test / synthetic addresses (kept in the outbox on a preview) ──
# Reserved for testing by RFC 2606 / RFC 6761 — no real mailbox can exist under these.
_RESERVED_DOMAINS = ("example.com", "example.net", "example.org")
_RESERVED_TLDS = ("example", "test", "invalid", "localhost", "local")
# The email provider's own test addresses (Resend: delivered@, bounced@, complained@ … resend.dev).
_PROVIDER_TEST_DOMAINS = ("resend.dev",)
# This project's QA mail domain, used by the test suites for made-up people.
_PROJECT_TEST_DOMAINS = ("nostopsqa.com",)
# This project's seeded demo / QA accounts (teacher.demo@, hr.demo@ … qa.cf@ on nostops.com) and
# the named QA inboxes the suites sign in with.
_PROJECT_DEMO_DOMAIN = "nostops.com"
_PROJECT_DEMO_LOCAL = re.compile(r"^(?:[a-z0-9_-]+\.demo|qa[._-][a-z0-9._-]+)$")
_PROJECT_QA_INBOXES = frozenset({"nostops.web.qa.seeker@gmail.com"})
_ADDRESS = re.compile(r"^([^@\s]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$")


def _under(domain: str, parents) -> bool:
    return any(domain == p or domain.endswith("." + p) for p in parents)


def test_address_reason(address: Optional[str]) -> Optional[str]:
    """Why `address` is a test / synthetic address (a short reason), or None for anything else —
    including every address that is not well formed (those are left to the normal path)."""
    m = _ADDRESS.match(str(address or "").strip().lower())
    if not m:
        return None
    local, domain = m.group(1), m.group(2)
    if _under(domain, _RESERVED_DOMAINS) or domain.rsplit(".", 1)[-1] in _RESERVED_TLDS:
        return "reserved_domain"
    if _under(domain, _PROVIDER_TEST_DOMAINS):
        return "provider_test_address"
    if _under(domain, _PROJECT_TEST_DOMAINS):
        return "project_test_domain"
    if domain == _PROJECT_DEMO_DOMAIN and _PROJECT_DEMO_LOCAL.match(local.split("+", 1)[0]):
        return "project_demo_account"
    if f"{local}@{domain}" in _PROJECT_QA_INBOXES:
        return "project_qa_inbox"
    return None


def preview_holds_email(to: Optional[str]) -> Optional[str]:
    """The reason this server must keep an email to `to` in the test outbox instead of sending it:
    a signed test run (any address), or — on a preview, with or without a tag — a test address."""
    if current():
        return "tagged"
    reason = test_address_reason(to)
    return f"preview_{reason}" if reason and environment_allows() else None


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


async def capture_email(*, to: str, subject: str, html: str, attachments: Optional[list] = None,
                        source: str = "backend", reason: str = "tagged") -> str:
    oid = f"tob_{uuid.uuid4().hex[:16]}"
    await outbox.insert_one({
        "_id": oid, "run_id": current(), "to": str(to)[:200], "subject": str(subject)[:300], "html": str(html)[:20000],
        "attachments": [str((a or {}).get("filename") or "") for a in attachments or []], "source": source[:120],
        "reason": reason[:60], "at": _now(),
    })
    return f"test-outbox:{oid}"


async def capture_event(event: dict) -> dict:
    row = {"_id": f"tml_{uuid.uuid4().hex[:16]}", "run_id": current(), **event, "at": _now()}
    await monitor_log.insert_one(row)
    return row


async def capture_alert(doc: dict, *, subject: str, forced: bool = False) -> dict:
    """Prompt 2G — the alert a preview would have emailed, kept in the test log instead."""
    return await capture_event({"kind": "alert", "event_id": doc.get("_id"), "alert_kind": doc.get("kind"),
                                "subject": str(subject)[:300], "path": doc.get("path"), "count": doc.get("count"),
                                "forced": forced, "reason": "preview_never_emails_alerts"})


# The website's own emails (two BFF routes send directly) reach the same test outbox through here.
router = APIRouter(prefix="/api/test-sink", tags=["test-sink"])


class EmailIn(BaseModel):
    to: str = Field(min_length=3, max_length=200)
    subject: str = Field(min_length=1, max_length=300)
    html: str = Field(default="", max_length=20000)
    source: str = Field(default="bff", max_length=120)


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    secret = os.environ.get("PULSE_SHARED_SECRET", "")
    if not secret or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, secret):
        raise HTTPException(status_code=401, detail="unauthorized")


@router.post("/email")
async def sink_email(payload: EmailIn, x_pulse_secret: Optional[str] = Header(None)):
    """The website asks here before sending one of its own emails. 200 = kept in the test outbox
    (do not send); 404 = not held (a deployed site, or a real address untagged): send as usual."""
    _check_secret(x_pulse_secret)
    reason = preview_holds_email(payload.to)
    if not reason:
        raise HTTPException(status_code=404, detail="Not Found")
    return {"ok": True, "captured": True, "reason": reason,
            "id": await capture_email(to=payload.to, subject=payload.subject, html=payload.html,
                                      source=f"bff:{payload.source}", reason=reason)}


@router.get("/status")
async def sink_status(x_pulse_secret: Optional[str] = Header(None)):
    """Preview only (404 on a deployed site): which test-safety rules this server applies."""
    _check_secret(x_pulse_secret)
    if not environment_allows():
        raise HTTPException(status_code=404, detail="Not Found")
    return {"preview": True, "rules": "2g", "tagged": bool(current()),
            "alerts": "test_log", "test_addresses": "test_outbox"}
