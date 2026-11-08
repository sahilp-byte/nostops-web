"""
NOSTOPS "Ask AI Guru" — Support Request system (human escalation).

AI Guru is the first line of support; when it cannot resolve an issue the user
creates a Support Request that captures the AI conversation + page context, so a
NOSTOPS human can help WITHOUT the user repeating themselves. Stored locally
(Mongo, same cluster as the Institutional Engine); a gate-safe notification email
alerts the support team and links them to the admin queue for the full context.

Also keeps lightweight, PII-free chat counters so the admin can see support
analytics (volume, escalation rate, category/priority/page breakdowns).
"""
import datetime
import html
import logging
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
logger = logging.getLogger("guru.support")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
NOSTOPS_SUPPORT_EMAIL = os.environ.get("NOSTOPS_SUPPORT_EMAIL") or "care@nostops.org"
ADMIN_QUEUE_URL = "https://www.nostops.org/app/admin/support"

_client = AsyncIOMotorClient(MONGO_URL)
_db = _client[DB_NAME]
_requests = _db["guru_support_requests"]
_stats = _db["guru_chat_stats"]

CATEGORIES = [
    "Account & Login",
    "Teacher Profile",
    "Verification / KYC",
    "Empanelment",
    "Venue",
    "Retreat",
    "Organisation",
    "Programme",
    "Event",
    "Participant",
    "Payment",
    "Technical Problem",
    "Other",
]
STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"]
OPEN_STATUSES = {"OPEN", "IN_PROGRESS", "WAITING_FOR_USER"}
HIGH_PRIORITY_CATEGORIES = {"Payment", "Account & Login", "Verification / KYC", "Event"}


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _iso(dt: datetime.datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def _priority_for(category: str, override: Optional[str]) -> str:
    if override in ("high", "normal", "low"):
        return override  # AI/user may raise or lower (e.g. a booking failure)
    return "high" if category in HIGH_PRIORITY_CATEGORIES else "normal"


def _clean(v: Optional[str], cap: int) -> Optional[str]:
    if not isinstance(v, str):
        return None
    s = v.strip()
    return s[:cap] if s else None


def _project(doc: dict) -> dict:
    return {
        "id": doc.get("_id"),
        "ref": doc.get("ref"),
        "name": doc.get("name"),
        "email": doc.get("email"),
        "role": doc.get("role"),
        "category": doc.get("category"),
        "issue": doc.get("issue"),
        "summary": doc.get("summary"),
        "conversation": doc.get("conversation") or [],
        "page_type": doc.get("page_type"),
        "route": doc.get("route"),
        "reference": doc.get("reference"),
        "priority": doc.get("priority"),
        "status": doc.get("status"),
        "assignee": doc.get("assignee"),
        "notes": doc.get("notes") or [],
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


async def create_request(
    *,
    email: str,
    category: str,
    issue: str,
    name: Optional[str] = None,
    role: Optional[str] = None,
    summary: Optional[str] = None,
    conversation: Optional[list] = None,
    page_type: Optional[str] = None,
    route: Optional[str] = None,
    reference: Optional[str] = None,
    priority: Optional[str] = None,
) -> dict:
    cat = category if category in CATEGORIES else "Other"
    conv = [
        {"role": t.get("role"), "content": str(t.get("content", ""))[:4000]}
        for t in (conversation or [])[-20:]
        if isinstance(t, dict) and t.get("role") in ("user", "assistant") and t.get("content")
    ]
    now = _now()
    doc = {
        "_id": uuid.uuid4().hex,
        "ref": "SR-" + uuid.uuid4().hex[:8].upper(),
        "name": _clean(name, 120),
        "email": _clean(email, 200) or "",
        "role": _clean(role, 40),
        "category": cat,
        "issue": _clean(issue, 4000) or "",
        "summary": _clean(summary, 500),
        "conversation": conv,
        "page_type": _clean(page_type, 60),
        "route": _clean(route, 200),
        "reference": _clean(reference, 200),
        "priority": _priority_for(cat, priority),
        "status": "OPEN",
        "assignee": None,
        "notes": [],
        "created_at": _iso(now),
        "updated_at": _iso(now),
    }
    await _requests.insert_one(doc)
    try:
        await _notify(doc)
    except Exception as e:  # noqa: BLE001 — email must never fail the request.
        logger.error(f"support notify failed for {doc['ref']}: {e}")
    return {
        "id": doc["_id"],
        "ref": doc["ref"],
        "status": doc["status"],
        "priority": doc["priority"],
        "next_step": "A NOSTOPS team member will review your request and reply to the email you provided.",
    }


async def _notify(doc: dict) -> None:
    """Gate-safe alert to the support team. No raw user free-text is embedded
    (it could trip the email credential/markup gate); the full issue +
    conversation live in the admin Support Queue, which this email links to."""
    from email_util import send_email

    rows = [
        ("Reference", doc["ref"]),
        ("Priority", doc["priority"].upper()),
        ("Category", doc["category"]),
        ("From", doc.get("email") or "—"),
        ("Role", doc.get("role") or "unknown"),
        ("Page", doc.get("page_type") or "—"),
        ("Route", doc.get("route") or "—"),
        ("Created", doc["created_at"]),
    ]
    body = "".join(
        f"<tr><td style='padding:4px 12px 4px 0;color:#6b7280'>{html.escape(k)}</td>"
        f"<td style='padding:4px 0;font-weight:600'>{html.escape(str(v))}</td></tr>"
        for k, v in rows
    )
    link = html.escape(ADMIN_QUEUE_URL)
    out_html = (
        "<div style='font-family:system-ui,sans-serif;color:#111827'>"
        "<h2 style='margin:0 0 8px'>New NOSTOPS support request</h2>"
        "<p style='margin:0 0 12px;color:#374151'>Open the Support Queue to read the full issue and the AI Guru conversation.</p>"
        f"<table style='border-collapse:collapse;font-size:14px'>{body}</table>"
        f"<p style='margin:16px 0 0'><a href='{link}' style='color:#0f766e;font-weight:700'>Open Support Queue &rarr;</a></p>"
        "</div>"
    )
    await send_email(
        to=NOSTOPS_SUPPORT_EMAIL,
        subject=f"[Support · {doc['priority'].upper()} · {doc['category']}] {doc['ref']}",
        html=out_html,
        reply_to=doc.get("email") or None,
    )


async def list_requests(status: Optional[str] = None, category: Optional[str] = None, limit: int = 200) -> list[dict]:
    q: dict = {}
    if status == "open":
        q["status"] = {"$in": list(OPEN_STATUSES)}
    elif status in STATUSES:
        q["status"] = status
    if category in CATEGORIES:
        q["category"] = category
    cur = _requests.find(q).sort("created_at", -1).limit(max(1, min(limit, 500)))
    return [_project(d) async for d in cur]


async def get_request(rid: str) -> Optional[dict]:
    doc = await _requests.find_one({"_id": rid})
    return _project(doc) if doc else None


async def update_request(
    rid: str,
    *,
    status: Optional[str] = None,
    assignee: Optional[str] = None,
    note: Optional[str] = None,
    note_author: Optional[str] = None,
) -> Optional[dict]:
    doc = await _requests.find_one({"_id": rid})
    if not doc:
        return None
    changes: dict = {"updated_at": _iso(_now())}
    if status in STATUSES:
        changes["status"] = status
    if assignee is not None:
        changes["assignee"] = _clean(assignee, 120)
    update: dict = {"$set": changes}
    n = _clean(note, 4000)
    if n:
        update["$push"] = {
            "notes": {"text": n, "author": _clean(note_author, 120) or "support", "at": _iso(_now())}
        }
    await _requests.update_one({"_id": rid}, update)
    return await get_request(rid)


async def record_chat(page_type: Optional[str], role: Optional[str]) -> None:
    """Fire-and-forget, PII-free chat counter for support analytics."""
    try:
        day = _now().strftime("%Y-%m-%d")
        pt = (page_type or "unknown").strip()[:60] or "unknown"
        await _stats.update_one(
            {"_id": day},
            {"$inc": {"total": 1, f"page.{pt}": 1}},
            upsert=True,
        )
    except Exception:  # noqa: BLE001 — analytics must never affect the chat.
        pass


async def analytics() -> dict:
    total = await _requests.count_documents({})
    open_count = await _requests.count_documents({"status": {"$in": list(OPEN_STATUSES)}})

    async def _group(field: str) -> dict:
        out: dict = {}
        async for row in _requests.aggregate([{"$group": {"_id": f"${field}", "n": {"$sum": 1}}}]):
            out[row["_id"] or "unknown"] = row["n"]
        return out

    by_category = await _group("category")
    by_status = await _group("status")
    by_priority = await _group("priority")
    by_page = await _group("page_type")

    chats = 0
    async for s in _stats.find({}):
        chats += int(s.get("total", 0))

    escalation_rate = round(total / chats, 4) if chats else None
    return {
        "total_requests": total,
        "open_requests": open_count,
        "total_chats": chats,
        "escalation_rate": escalation_rate,
        "by_category": by_category,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_page": by_page,
        "categories": CATEGORIES,
        "statuses": STATUSES,
    }
