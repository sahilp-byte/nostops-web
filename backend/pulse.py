"""
NOSTOPS Teacher Pulse — native discussion store (local FastAPI + local Mongo).

This is an ISOLATED feature module. It does NOT touch the remote business
backend. Teacher Pulse data lives entirely in the local `nostops_web` Mongo so
NOSTOPS owns 100% of the data (trivial export, clean 3-month archive).

Security model (defense-in-depth):
  • This router is an INTERNAL service. Every request MUST carry the shared
    secret header `X-Pulse-Secret` (constant-time compared to PULSE_SHARED_SECRET).
    The browser never has this secret, so it can never call `/api/pulse/*`
    directly — all access is proxied by the Next.js BFF, which validates the
    NOSTOPS session first and passes the authenticated identity in `X-Pulse-User`.
  • `/admin/*` endpoints additionally require the acting user's role == 'admin'
    (the Next.js admin-guard is the primary gate; this is the second layer).
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
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/pulse", tags=["teacher-pulse"])

PARTICIPANT_ROLES = {"teacher", "council", "coordinator", "admin"}
WRITE_STATUSES = {"ACTIVE", "CLOSING_SOON"}

DAY_MS = 24 * 60 * 60 * 1000

DEFAULT_CATEGORIES = [
    ("teaching-students", "Teaching & Students", "Pedagogy, student progress, class dynamics."),
    ("teacher-livelihood", "Teacher Livelihood", "Earning a living as a yoga teacher."),
    ("pricing-fees", "Pricing & Fees", "What to charge, fee models, discounting."),
    ("studios-centres", "Yoga Studios & Centres", "Working with and running studios."),
    ("online-yoga", "Online Yoga", "Teaching online, hybrid, and on-demand."),
    ("corporate-yoga", "Corporate Yoga", "Workplace and institutional programmes."),
    ("retreats", "Retreats", "Hosting and running retreats."),
    ("teacher-training", "Teacher Training", "TTCs, certifications, continuing education."),
    ("technology-ai", "Technology & AI", "Tools, apps, and AI for teachers."),
    ("professional-recognition", "Professional Recognition", "Credibility, credentials, standards."),
    ("challenges", "Challenges Facing Yoga Teachers", "What's hard right now."),
    ("opportunities", "Opportunities for Yoga Teachers", "Where the growth is."),
    ("future-of-yoga", "The Future of Yoga", "Where the profession is heading."),
    ("nostops-build", "NOSTOPS — What Should We Build?", "Tell us what would help you most."),
]


def now_ms() -> int:
    return int(time.time() * 1000)


def oid() -> str:
    return uuid.uuid4().hex


# ── Auth dependencies ────────────────────────────────────────────────────────
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


async def participant_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in PARTICIPANT_ROLES:
        raise HTTPException(status_code=403, detail="Teacher Pulse is for yoga teachers.")
    return user


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


# ── Seeding (lazy, idempotent) ───────────────────────────────────────────────
_seeded = False


async def ensure_seeded() -> None:
    global _seeded
    if _seeded:
        return
    if await db.pulse_config.find_one({"_id": "config"}) is None:
        t = now_ms()
        await db.pulse_config.insert_one({
            "_id": "config",
            "status": "ACTIVE",
            "allow_new_threads": True,
            "public_read": False,
            "launch_date": t,
            "close_date": t + 90 * DAY_MS,
            "updated_at": t,
            "updated_by": None,
        })
    if await db.pulse_categories.count_documents({}) == 0:
        docs = [{
            "_id": oid(), "slug": slug, "name": name, "description": desc,
            "order": i, "archived": False, "created_at": now_ms(),
        } for i, (slug, name, desc) in enumerate(DEFAULT_CATEGORIES)]
        await db.pulse_categories.insert_many(docs)
    _seeded = True


# ── helpers ──────────────────────────────────────────────────────────────────
async def get_config() -> dict:
    await ensure_seeded()
    cfg = await db.pulse_config.find_one({"_id": "config"})
    return cfg or {"status": "ACTIVE", "allow_new_threads": True}


async def upsert_member(user: dict, invited_by: Optional[str] = None) -> dict:
    existing = await db.pulse_members.find_one({"_id": user["user_id"]})
    t = now_ms()
    if existing is None:
        doc = {
            "_id": user["user_id"], "name": user.get("name") or "Teacher",
            "persona": user.get("persona") or "Yoga Teacher", "role": user["role"],
            "joined_at": t, "invited_by": invited_by, "status": "ACTIVE",
            "suspended_reason": None, "thread_count": 0, "post_count": 0,
            "last_active_at": t,
        }
        await db.pulse_members.insert_one(doc)
        return doc
    await db.pulse_members.update_one(
        {"_id": user["user_id"]},
        {"$set": {"name": user.get("name") or existing.get("name"),
                  "persona": user.get("persona") or existing.get("persona"),
                  "role": user["role"], "last_active_at": t}},
    )
    return existing


async def assert_not_suspended(user_id: str) -> None:
    m = await db.pulse_members.find_one({"_id": user_id})
    if m and m.get("status") == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Your Teacher Pulse access is suspended.")


def thread_public(t: dict) -> dict:
    return {
        "id": t["_id"], "category_id": t.get("category_id"),
        "category_slug": t.get("category_slug"), "category_name": t.get("category_name"),
        "title": t.get("title"), "body": t.get("body"),
        "author_id": t.get("author_id"), "author_name": t.get("author_name"),
        "author_persona": t.get("author_persona"), "status": t.get("status"),
        "author_handle": t.get("author_handle"), "author_public": bool(t.get("author_public")),
        "pinned": bool(t.get("pinned")), "reply_count": t.get("reply_count", 0),
        "participant_count": len(t.get("participant_ids", []) or []),
        "created_at": t.get("created_at"), "last_activity_at": t.get("last_activity_at"),
        "edited_at": t.get("edited_at"),
        "official": bool(t.get("official")),
        "featured": bool(t.get("featured")),
    }


def public_thread(t: dict) -> dict:
    """Teaser-only view for anonymous/public consumption (RSS + public pages).
    Never includes the full body or any replies — reading in full requires login."""
    body = (t.get("body") or "").strip()
    snippet = body[:400] + ("…" if len(body) > 400 else "")
    return {
        "id": t["_id"], "title": t.get("title"), "snippet": snippet,
        "author_name": t.get("author_name"), "author_persona": t.get("author_persona"),
        "author_handle": t.get("author_handle"), "author_public": bool(t.get("author_public")),
        "category_name": t.get("category_name"), "category_slug": t.get("category_slug"),
        "reply_count": t.get("reply_count", 0), "official": bool(t.get("official")),
        "pinned": bool(t.get("pinned")), "created_at": t.get("created_at"),
        "last_activity_at": t.get("last_activity_at"),
    }


def post_public(p: dict) -> dict:
    return {
        "id": p["_id"], "thread_id": p.get("thread_id"), "body": p.get("body"),
        "author_id": p.get("author_id"), "author_name": p.get("author_name"),
        "author_persona": p.get("author_persona"), "status": p.get("status"),
        "author_handle": p.get("author_handle"), "author_public": bool(p.get("author_public")),
        "created_at": p.get("created_at"), "edited_at": p.get("edited_at"),
    }


async def audit(actor: dict, action: str, target_type: str, target_id: str, detail: str = "") -> None:
    await db.pulse_audit.insert_one({
        "_id": oid(), "actor_id": actor.get("user_id"), "actor_name": actor.get("name"),
        "action": action, "target_type": target_type, "target_id": target_id,
        "detail": detail, "created_at": now_ms(),
    })


# ── request bodies ───────────────────────────────────────────────────────────
class ThreadIn(BaseModel):
    category_slug: str
    title: str = Field(min_length=5, max_length=140)
    body: str = Field(min_length=10, max_length=8000)


class ReplyIn(BaseModel):
    body: str = Field(min_length=2, max_length=8000)


class EditThreadIn(BaseModel):
    title: Optional[str] = Field(default=None, max_length=140)
    body: Optional[str] = Field(default=None, max_length=8000)


class EditPostIn(BaseModel):
    body: str = Field(min_length=2, max_length=8000)


class ReportIn(BaseModel):
    target_type: str
    target_id: str
    reason: str = Field(min_length=3, max_length=500)


class ConfigIn(BaseModel):
    status: Optional[str] = None
    allow_new_threads: Optional[bool] = None
    public_read: Optional[bool] = None
    launch_date: Optional[int] = None
    close_date: Optional[int] = None


class SuspendIn(BaseModel):
    reason: str = Field(default="", max_length=500)


class ResolveIn(BaseModel):
    action: str  # dismiss | hide | delete
    note: str = Field(default="", max_length=500)


# ═══════════════════════ COMMUNITY (participants) ═══════════════════════════
@router.get("/config")
async def read_config(user: dict = Depends(current_user)):
    cfg = await get_config()
    return {"status": cfg.get("status"), "allow_new_threads": cfg.get("allow_new_threads"),
            "public_read": bool(cfg.get("public_read")),
            "launch_date": cfg.get("launch_date"), "close_date": cfg.get("close_date")}


@router.get("/categories")
async def list_categories(user: dict = Depends(current_user)):
    await ensure_seeded()
    cats = await db.pulse_categories.find({"archived": False}).sort("order", 1).to_list(200)
    out = []
    for c in cats:
        count = await db.pulse_threads.count_documents(
            {"category_id": c["_id"], "status": {"$in": ["ACTIVE", "LOCKED"]}})
        out.append({"id": c["_id"], "slug": c["slug"], "name": c["name"],
                    "description": c.get("description"), "thread_count": count})
    return {"categories": out}


@router.get("/me")
async def my_membership(user: dict = Depends(participant_user)):
    m = await db.pulse_members.find_one({"_id": user["user_id"]})
    return {"member": bool(m), "status": (m or {}).get("status", "NONE"),
            "thread_count": (m or {}).get("thread_count", 0),
            "post_count": (m or {}).get("post_count", 0)}


@router.post("/me/join")
async def join(user: dict = Depends(participant_user)):
    await ensure_seeded()
    await upsert_member(user)
    return {"ok": True}


@router.get("/threads")
async def list_threads(
    user: dict = Depends(current_user),
    category: Optional[str] = None,
    sort: str = Query("active"),
    q: Optional[str] = None,
    limit: int = Query(30, le=100),
    skip: int = 0,
):
    await ensure_seeded()
    query: dict = {"status": {"$in": ["ACTIVE", "LOCKED"]}}
    if category:
        cat = await db.pulse_categories.find_one({"slug": category})
        if not cat:
            return {"threads": [], "total": 0}
        query["category_id"] = cat["_id"]
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"title": rx}, {"body": rx}]
    sort_field = "created_at" if sort == "new" else "last_activity_at"
    cursor = db.pulse_threads.find(query).sort([("pinned", -1), (sort_field, -1)]).skip(skip).limit(limit)
    threads = [thread_public(t) for t in await cursor.to_list(limit)]
    total = await db.pulse_threads.count_documents(query)
    return {"threads": threads, "total": total}


@router.get("/threads/{thread_id}")
async def get_thread(thread_id: str, user: dict = Depends(current_user)):
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t or t.get("status") in ("DELETED", "HIDDEN"):
        raise HTTPException(status_code=404, detail="Discussion not found.")
    posts = await db.pulse_posts.find(
        {"thread_id": thread_id, "status": "ACTIVE"}).sort("created_at", 1).to_list(1000)
    return {"thread": thread_public(t), "posts": [post_public(p) for p in posts]}


@router.post("/threads")
async def create_thread(payload: ThreadIn, user: dict = Depends(participant_user)):
    await ensure_seeded()
    await assert_not_suspended(user["user_id"])
    cfg = await get_config()
    if cfg.get("status") not in WRITE_STATUSES or not cfg.get("allow_new_threads"):
        raise HTTPException(status_code=403, detail="New discussions are closed right now.")
    cat = await db.pulse_categories.find_one({"slug": payload.category_slug, "archived": False})
    if not cat:
        raise HTTPException(status_code=400, detail="Unknown category.")
    await upsert_member(user)
    t = now_ms()
    doc = {
        "_id": oid(), "category_id": cat["_id"], "category_slug": cat["slug"],
        "category_name": cat["name"], "title": payload.title.strip(),
        "body": payload.body.strip(), "author_id": user["user_id"],
        "author_name": user.get("name") or "Teacher",
        "author_persona": user.get("persona") or "Yoga Teacher",
        "author_handle": user.get("handle"), "author_public": bool(user.get("public")),
        "status": "ACTIVE", "pinned": False, "reply_count": 0,
        "participant_ids": [user["user_id"]], "created_at": t,
        "last_activity_at": t, "updated_at": t, "edited_at": None, "official": False,
    }
    await db.pulse_threads.insert_one(doc)
    await db.pulse_members.update_one({"_id": user["user_id"]}, {"$inc": {"thread_count": 1}})
    return {"thread": thread_public(doc)}


@router.post("/threads/{thread_id}/replies")
async def reply(thread_id: str, payload: ReplyIn, user: dict = Depends(participant_user)):
    await assert_not_suspended(user["user_id"])
    cfg = await get_config()
    if cfg.get("status") not in WRITE_STATUSES:
        raise HTTPException(status_code=403, detail="This community is read-only right now.")
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t or t.get("status") in ("DELETED", "HIDDEN"):
        raise HTTPException(status_code=404, detail="Discussion not found.")
    if t.get("status") == "LOCKED":
        raise HTTPException(status_code=403, detail="This discussion is locked.")
    await upsert_member(user)
    ts = now_ms()
    doc = {
        "_id": oid(), "thread_id": thread_id, "body": payload.body.strip(),
        "author_id": user["user_id"], "author_name": user.get("name") or "Teacher",
        "author_persona": user.get("persona") or "Yoga Teacher", "status": "ACTIVE",
        "author_handle": user.get("handle"), "author_public": bool(user.get("public")),
        "created_at": ts, "updated_at": ts, "edited_at": None,
    }
    await db.pulse_posts.insert_one(doc)
    await db.pulse_threads.update_one(
        {"_id": thread_id},
        {"$inc": {"reply_count": 1}, "$set": {"last_activity_at": ts},
         "$addToSet": {"participant_ids": user["user_id"]}},
    )
    await db.pulse_members.update_one({"_id": user["user_id"]}, {"$inc": {"post_count": 1}})
    return {"post": post_public(doc)}


@router.patch("/threads/{thread_id}")
async def edit_thread(thread_id: str, payload: EditThreadIn, user: dict = Depends(participant_user)):
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t or t.get("status") in ("DELETED", "HIDDEN"):
        raise HTTPException(status_code=404, detail="Discussion not found.")
    if t.get("author_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own discussion.")
    upd: dict = {"edited_at": now_ms()}
    if payload.title and len(payload.title.strip()) >= 5:
        upd["title"] = payload.title.strip()
    if payload.body and len(payload.body.strip()) >= 10:
        upd["body"] = payload.body.strip()
    await db.pulse_threads.update_one({"_id": thread_id}, {"$set": upd})
    return {"ok": True}


@router.patch("/posts/{post_id}")
async def edit_post(post_id: str, payload: EditPostIn, user: dict = Depends(participant_user)):
    p = await db.pulse_posts.find_one({"_id": post_id})
    if not p or p.get("status") != "ACTIVE":
        raise HTTPException(status_code=404, detail="Reply not found.")
    if p.get("author_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own reply.")
    await db.pulse_posts.update_one(
        {"_id": post_id}, {"$set": {"body": payload.body.strip(), "edited_at": now_ms()}})
    return {"ok": True}


@router.delete("/threads/{thread_id}")
async def delete_own_thread(thread_id: str, user: dict = Depends(participant_user)):
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Discussion not found.")
    if t.get("author_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own discussion.")
    await db.pulse_threads.update_one({"_id": thread_id}, {"$set": {"status": "DELETED"}})
    return {"ok": True}


@router.delete("/posts/{post_id}")
async def delete_own_post(post_id: str, user: dict = Depends(participant_user)):
    p = await db.pulse_posts.find_one({"_id": post_id})
    if not p:
        raise HTTPException(status_code=404, detail="Reply not found.")
    if p.get("author_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own reply.")
    await db.pulse_posts.update_one({"_id": post_id}, {"$set": {"status": "DELETED"}})
    await db.pulse_threads.update_one({"_id": p["thread_id"]}, {"$inc": {"reply_count": -1}})
    return {"ok": True}


@router.post("/reports")
async def report(payload: ReportIn, user: dict = Depends(participant_user)):
    cfg = await get_config()
    if cfg.get("status") == "ARCHIVED":
        raise HTTPException(status_code=403, detail="This community is archived.")
    if payload.target_type not in ("thread", "post"):
        raise HTTPException(status_code=400, detail="Bad target.")
    coll = db.pulse_threads if payload.target_type == "thread" else db.pulse_posts
    target = await coll.find_one({"_id": payload.target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Content not found.")
    thread_id = payload.target_id if payload.target_type == "thread" else target.get("thread_id")
    await db.pulse_reports.insert_one({
        "_id": oid(), "target_type": payload.target_type, "target_id": payload.target_id,
        "thread_id": thread_id, "reason": payload.reason.strip(),
        "reporter_id": user["user_id"], "reporter_name": user.get("name") or "Teacher",
        "status": "OPEN", "created_at": now_ms(), "resolved_at": None,
        "resolved_by": None, "resolution": None,
    })
    if payload.target_type == "thread" and target.get("status") == "ACTIVE":
        await db.pulse_threads.update_one({"_id": payload.target_id}, {"$set": {"flagged": True}})
    return {"ok": True}


# ── invitations ──────────────────────────────────────────────────────────────
@router.post("/invites")
async def create_invite(user: dict = Depends(participant_user)):
    await upsert_member(user)
    token = oid()
    await db.pulse_invites.insert_one({
        "_id": token, "token": token, "inviter_id": user["user_id"],
        "inviter_name": user.get("name") or "A NOSTOPS teacher", "created_at": now_ms(),
        "accepted_by": None, "accepted_at": None, "status": "PENDING",
    })
    return {"token": token}


@router.get("/invites/mine")
async def my_invites(user: dict = Depends(participant_user)):
    inv = await db.pulse_invites.find({"inviter_id": user["user_id"]}).sort("created_at", -1).to_list(100)
    return {"invites": [{"token": i["token"], "status": i["status"],
                         "created_at": i["created_at"], "accepted_at": i.get("accepted_at")} for i in inv]}


@router.get("/invites/{token}")
async def resolve_invite(token: str, user: dict = Depends(current_user)):
    inv = await db.pulse_invites.find_one({"_id": token})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    return {"inviter_name": inv.get("inviter_name"), "status": inv.get("status")}


@router.post("/invites/{token}/accept")
async def accept_invite(token: str, user: dict = Depends(participant_user)):
    inv = await db.pulse_invites.find_one({"_id": token})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    await upsert_member(user, invited_by=inv.get("inviter_id"))
    if inv.get("status") == "PENDING":
        await db.pulse_invites.update_one(
            {"_id": token}, {"$set": {"status": "ACCEPTED", "accepted_by": user["user_id"],
                                      "accepted_at": now_ms()}})
    return {"ok": True}


# ═══════════════════════════ ADMIN / MODERATION ═════════════════════════════
@router.get("/admin/overview")
async def admin_overview(user: dict = Depends(admin_user)):
    await ensure_seeded()
    since = now_ms() - 7 * DAY_MS
    total_threads = await db.pulse_threads.count_documents({"status": {"$ne": "DELETED"}})
    total_posts = await db.pulse_posts.count_documents({"status": {"$ne": "DELETED"}})
    total_members = await db.pulse_members.count_documents({})
    active_members = await db.pulse_members.count_documents({"status": "ACTIVE"})
    suspended = await db.pulse_members.count_documents({"status": "SUSPENDED"})
    new_members = await db.pulse_members.count_documents({"joined_at": {"$gte": since}})
    threads_7d = await db.pulse_threads.count_documents({"created_at": {"$gte": since}, "status": {"$ne": "DELETED"}})
    posts_7d = await db.pulse_posts.count_documents({"created_at": {"$gte": since}, "status": {"$ne": "DELETED"}})
    open_reports = await db.pulse_reports.count_documents({"status": "OPEN"})

    cats = await db.pulse_categories.find({}).sort("order", 1).to_list(200)
    by_cat = []
    for c in cats:
        n = await db.pulse_threads.count_documents({"category_id": c["_id"], "status": {"$ne": "DELETED"}})
        if n:
            by_cat.append({"name": c["name"], "slug": c["slug"], "count": n})
    by_cat.sort(key=lambda x: x["count"], reverse=True)

    top = await db.pulse_threads.find({"status": {"$in": ["ACTIVE", "LOCKED"]}}) \
        .sort("reply_count", -1).limit(5).to_list(5)
    top_threads = [{"id": t["_id"], "title": t["title"], "reply_count": t.get("reply_count", 0),
                    "category_name": t.get("category_name")} for t in top]

    # 14-day participation trend (threads + posts per day)
    trend = []
    base = now_ms() - 13 * DAY_MS
    for d in range(14):
        start = base + d * DAY_MS
        end = start + DAY_MS
        rng = {"$gte": start, "$lt": end}
        th = await db.pulse_threads.count_documents({"created_at": rng, "status": {"$ne": "DELETED"}})
        po = await db.pulse_posts.count_documents({"created_at": rng, "status": {"$ne": "DELETED"}})
        trend.append({"day": start, "threads": th, "posts": po})

    cfg = await get_config()
    return {
        "config": {"status": cfg.get("status"), "allow_new_threads": cfg.get("allow_new_threads"),
                   "launch_date": cfg.get("launch_date"), "close_date": cfg.get("close_date")},
        "stats": {"total_threads": total_threads, "total_posts": total_posts,
                  "total_members": total_members, "active_members": active_members,
                  "suspended_members": suspended, "new_members_7d": new_members,
                  "threads_7d": threads_7d, "posts_7d": posts_7d, "open_reports": open_reports},
        "by_category": by_cat, "top_threads": top_threads, "trend": trend,
    }


@router.get("/admin/threads")
async def admin_list_threads(
    user: dict = Depends(admin_user),
    status: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=200),
    skip: int = 0,
):
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status
    else:
        query["status"] = {"$ne": "DELETED"}
    if category:
        cat = await db.pulse_categories.find_one({"slug": category})
        query["category_id"] = cat["_id"] if cat else "__none__"
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"title": rx}, {"body": rx}]
    cursor = db.pulse_threads.find(query).sort([("pinned", -1), ("last_activity_at", -1)]).skip(skip).limit(limit)
    threads = []
    for t in await cursor.to_list(limit):
        open_rep = await db.pulse_reports.count_documents({"thread_id": t["_id"], "status": "OPEN"})
        d = thread_public(t)
        d["open_reports"] = open_rep
        d["flagged"] = bool(t.get("flagged"))
        threads.append(d)
    total = await db.pulse_threads.count_documents(query)
    return {"threads": threads, "total": total}


@router.get("/admin/threads/{thread_id}")
async def admin_get_thread(thread_id: str, user: dict = Depends(admin_user)):
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Not found.")
    posts = await db.pulse_posts.find({"thread_id": thread_id}).sort("created_at", 1).to_list(2000)
    reports = await db.pulse_reports.find({"thread_id": thread_id}).sort("created_at", -1).to_list(200)
    return {"thread": thread_public(t), "posts": [post_public(p) for p in posts],
            "reports": [{"id": r["_id"], "target_type": r["target_type"], "target_id": r["target_id"],
                         "reason": r["reason"], "reporter_name": r["reporter_name"],
                         "status": r["status"], "created_at": r["created_at"]} for r in reports]}


@router.post("/admin/threads/{thread_id}/pin")
async def admin_pin(thread_id: str, user: dict = Depends(admin_user), pinned: bool = Query(True)):
    r = await db.pulse_threads.update_one({"_id": thread_id}, {"$set": {"pinned": pinned}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Not found.")
    await audit(user, "pin" if pinned else "unpin", "thread", thread_id)
    return {"ok": True}


@router.post("/admin/threads/{thread_id}/lock")
async def admin_lock(thread_id: str, user: dict = Depends(admin_user), locked: bool = Query(True)):
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Not found.")
    await db.pulse_threads.update_one(
        {"_id": thread_id}, {"$set": {"status": "LOCKED" if locked else "ACTIVE"}})
    await audit(user, "lock" if locked else "unlock", "thread", thread_id)
    return {"ok": True}


@router.post("/admin/threads/{thread_id}/hide")
async def admin_hide(thread_id: str, user: dict = Depends(admin_user), hidden: bool = Query(True)):
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Not found.")
    await db.pulse_threads.update_one(
        {"_id": thread_id}, {"$set": {"status": "HIDDEN" if hidden else "ACTIVE"}})
    await audit(user, "hide" if hidden else "unhide", "thread", thread_id)
    return {"ok": True}


@router.post("/admin/threads/{thread_id}/feature")
async def admin_feature(thread_id: str, user: dict = Depends(admin_user), featured: bool = Query(True)):
    r = await db.pulse_threads.update_one({"_id": thread_id}, {"$set": {"featured": featured}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Not found.")
    await audit(user, "feature" if featured else "unfeature", "thread", thread_id)
    return {"ok": True}


@router.delete("/admin/threads/{thread_id}")
async def admin_delete_thread(thread_id: str, user: dict = Depends(admin_user)):
    r = await db.pulse_threads.update_one({"_id": thread_id}, {"$set": {"status": "DELETED"}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Not found.")
    await audit(user, "delete", "thread", thread_id)
    return {"ok": True}


@router.post("/admin/posts/{post_id}/hide")
async def admin_hide_post(post_id: str, user: dict = Depends(admin_user), hidden: bool = Query(True)):
    p = await db.pulse_posts.find_one({"_id": post_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found.")
    await db.pulse_posts.update_one(
        {"_id": post_id}, {"$set": {"status": "HIDDEN" if hidden else "ACTIVE"}})
    await audit(user, "hide" if hidden else "unhide", "post", post_id)
    return {"ok": True}


@router.delete("/admin/posts/{post_id}")
async def admin_delete_post(post_id: str, user: dict = Depends(admin_user)):
    p = await db.pulse_posts.find_one({"_id": post_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found.")
    await db.pulse_posts.update_one({"_id": post_id}, {"$set": {"status": "DELETED"}})
    if p.get("status") == "ACTIVE":
        await db.pulse_threads.update_one({"_id": p["thread_id"]}, {"$inc": {"reply_count": -1}})
    await audit(user, "delete", "post", post_id)
    return {"ok": True}


@router.get("/admin/reports")
async def admin_reports(user: dict = Depends(admin_user), status: str = Query("OPEN")):
    query = {} if status == "ALL" else {"status": status}
    reports = await db.pulse_reports.find(query).sort("created_at", -1).limit(200).to_list(200)
    out = []
    for r in reports:
        excerpt = ""
        coll = db.pulse_threads if r["target_type"] == "thread" else db.pulse_posts
        tgt = await coll.find_one({"_id": r["target_id"]})
        if tgt:
            excerpt = (tgt.get("title") or tgt.get("body") or "")[:160]
        out.append({"id": r["_id"], "target_type": r["target_type"], "target_id": r["target_id"],
                    "thread_id": r.get("thread_id"), "reason": r["reason"],
                    "reporter_name": r["reporter_name"], "status": r["status"],
                    "created_at": r["created_at"], "excerpt": excerpt,
                    "target_status": (tgt or {}).get("status")})
    return {"reports": out}


@router.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(report_id: str, payload: ResolveIn, user: dict = Depends(admin_user)):
    r = await db.pulse_reports.find_one({"_id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Not found.")
    action = payload.action
    if action in ("hide", "delete"):
        new_status = "HIDDEN" if action == "hide" else "DELETED"
        coll = db.pulse_threads if r["target_type"] == "thread" else db.pulse_posts
        await coll.update_one({"_id": r["target_id"]}, {"$set": {"status": new_status}})
    await db.pulse_reports.update_one(
        {"_id": report_id},
        {"$set": {"status": "DISMISSED" if action == "dismiss" else "ACTIONED",
                  "resolved_at": now_ms(), "resolved_by": user.get("name"),
                  "resolution": f"{action}: {payload.note}".strip(": ")}})
    await audit(user, f"report_{action}", r["target_type"], r["target_id"], payload.note)
    return {"ok": True}


@router.get("/admin/members")
async def admin_members(user: dict = Depends(admin_user), q: Optional[str] = None,
                        status: Optional[str] = None):
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status
    if q:
        query["name"] = re.compile(re.escape(q), re.IGNORECASE)
    members = await db.pulse_members.find(query).sort("joined_at", -1).limit(500).to_list(500)
    return {"members": [{"id": m["_id"], "name": m.get("name"), "persona": m.get("persona"),
                         "role": m.get("role"), "status": m.get("status"),
                         "thread_count": m.get("thread_count", 0), "post_count": m.get("post_count", 0),
                         "joined_at": m.get("joined_at"), "last_active_at": m.get("last_active_at"),
                         "suspended_reason": m.get("suspended_reason")} for m in members]}


@router.post("/admin/members/{member_id}/suspend")
async def admin_suspend(member_id: str, payload: SuspendIn, user: dict = Depends(admin_user)):
    r = await db.pulse_members.update_one(
        {"_id": member_id}, {"$set": {"status": "SUSPENDED", "suspended_reason": payload.reason}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Not found.")
    await audit(user, "suspend", "member", member_id, payload.reason)
    return {"ok": True}


@router.post("/admin/members/{member_id}/reinstate")
async def admin_reinstate(member_id: str, user: dict = Depends(admin_user)):
    r = await db.pulse_members.update_one(
        {"_id": member_id}, {"$set": {"status": "ACTIVE", "suspended_reason": None}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Not found.")
    await audit(user, "reinstate", "member", member_id)
    return {"ok": True}


@router.get("/admin/config")
async def admin_get_config(user: dict = Depends(admin_user)):
    cfg = await get_config()
    return {"status": cfg.get("status"), "allow_new_threads": cfg.get("allow_new_threads"),
            "public_read": bool(cfg.get("public_read")),
            "launch_date": cfg.get("launch_date"), "close_date": cfg.get("close_date")}


@router.patch("/admin/config")
async def admin_set_config(payload: ConfigIn, user: dict = Depends(admin_user)):
    valid = {"PRE_LAUNCH", "ACTIVE", "CLOSING_SOON", "ARCHIVED"}
    upd: dict = {"updated_at": now_ms(), "updated_by": user.get("name")}
    if payload.status is not None:
        if payload.status not in valid:
            raise HTTPException(status_code=400, detail="Bad status.")
        upd["status"] = payload.status
    if payload.allow_new_threads is not None:
        upd["allow_new_threads"] = bool(payload.allow_new_threads)
    if payload.public_read is not None:
        upd["public_read"] = bool(payload.public_read)
    if payload.launch_date is not None:
        upd["launch_date"] = int(payload.launch_date)
    if payload.close_date is not None:
        upd["close_date"] = int(payload.close_date)
    await db.pulse_config.update_one({"_id": "config"}, {"$set": upd}, upsert=True)
    await audit(user, "config_update", "config", "config", json.dumps({k: v for k, v in upd.items() if k not in ("updated_at", "updated_by")}))
    return {"ok": True}


@router.get("/admin/export")
async def admin_export(user: dict = Depends(admin_user), type: str = Query("threads"),
                       format: str = Query("csv")):
    await audit(user, "export", "data", type, format)
    if type == "members":
        rows = await db.pulse_members.find({}).to_list(5000)
        fields = ["_id", "name", "persona", "role", "status", "thread_count", "post_count", "joined_at", "last_active_at"]
    elif type == "posts":
        rows = await db.pulse_posts.find({}).to_list(20000)
        fields = ["_id", "thread_id", "author_name", "author_persona", "status", "created_at", "body"]
    else:
        rows = await db.pulse_threads.find({}).to_list(20000)
        fields = ["_id", "category_name", "title", "author_name", "author_persona", "status",
                  "pinned", "reply_count", "created_at", "last_activity_at", "body"]

    if format == "json":
        clean = [{k: r.get(k) for k in fields} for r in rows]
        return JSONResponse(clean)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(fields)
    for r in rows:
        w.writerow([r.get(k) for k in fields])
    return PlainTextResponse(
        buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="teacher-pulse-{type}.csv"'})


# ═══════════════════════ CATEGORY MANAGER (admin) ═══════════════════════════
def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return s or "topic"


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: Optional[str] = Field(default="", max_length=200)


class CategoryPatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=60)
    description: Optional[str] = Field(default=None, max_length=200)
    archived: Optional[bool] = None


class ReorderIn(BaseModel):
    ordered_ids: list[str]


@router.get("/admin/categories")
async def admin_list_categories(user: dict = Depends(admin_user)):
    await ensure_seeded()
    cats = await db.pulse_categories.find({}).sort("order", 1).to_list(500)
    out = []
    for c in cats:
        count = await db.pulse_threads.count_documents({"category_id": c["_id"], "status": {"$ne": "DELETED"}})
        out.append({"id": c["_id"], "slug": c["slug"], "name": c["name"],
                    "description": c.get("description", ""), "order": c.get("order", 0),
                    "archived": bool(c.get("archived")), "thread_count": count})
    return {"categories": out}


@router.post("/admin/categories")
async def admin_create_category(payload: CategoryIn, user: dict = Depends(admin_user)):
    await ensure_seeded()
    base = slugify(payload.name)
    slug = base
    i = 2
    while await db.pulse_categories.find_one({"slug": slug}):
        slug = f"{base}-{i}"
        i += 1
    last = await db.pulse_categories.find({}).sort("order", -1).limit(1).to_list(1)
    order = (last[0].get("order", 0) + 1) if last else 0
    doc = {"_id": oid(), "slug": slug, "name": payload.name.strip(),
           "description": (payload.description or "").strip(), "order": order,
           "archived": False, "created_at": now_ms()}
    await db.pulse_categories.insert_one(doc)
    await audit(user, "category_create", "category", doc["_id"], payload.name.strip())
    return {"category": {"id": doc["_id"], "slug": slug, "name": doc["name"],
                         "description": doc["description"], "order": order,
                         "archived": False, "thread_count": 0}}


@router.patch("/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, payload: CategoryPatch, user: dict = Depends(admin_user)):
    c = await db.pulse_categories.find_one({"_id": cat_id})
    if not c:
        raise HTTPException(status_code=404, detail="Category not found.")
    upd: dict = {}
    if payload.name and len(payload.name.strip()) >= 2:
        upd["name"] = payload.name.strip()
    if payload.description is not None:
        upd["description"] = payload.description.strip()
    if payload.archived is not None:
        upd["archived"] = bool(payload.archived)
    if upd:
        await db.pulse_categories.update_one({"_id": cat_id}, {"$set": upd})
        # keep denormalized category_name on threads in sync when renamed
        if "name" in upd:
            await db.pulse_threads.update_many({"category_id": cat_id}, {"$set": {"category_name": upd["name"]}})
        await audit(user, "category_update", "category", cat_id, json.dumps(upd))
    return {"ok": True}


@router.post("/admin/categories/reorder")
async def admin_reorder_categories(payload: ReorderIn, user: dict = Depends(admin_user)):
    for idx, cid in enumerate(payload.ordered_ids):
        await db.pulse_categories.update_one({"_id": cid}, {"$set": {"order": idx}})
    await audit(user, "category_reorder", "category", "*", str(len(payload.ordered_ids)))
    return {"ok": True}


# ═══════════════════════ WELCOME (START HERE) POST ══════════════════════════
DEFAULT_WELCOME_TITLE = "Welcome to Teacher Pulse — start here 🙏"
DEFAULT_WELCOME_BODY = (
    "Namaste, and welcome to Teacher Pulse — a conversation among yoga teachers about the "
    "profession, the market and the future of Yoga.\n\n"
    "A few gentle notes to get started:\n"
    "• Speak as yourself — this is a space of teachers speaking with teachers.\n"
    "• Pick a topic above and start a discussion, or reply to a colleague.\n"
    "• Be respectful. Disagree with ideas, never with people.\n"
    "• Invite a fellow teacher you trust — the richer the room, the richer the learning.\n\n"
    "We're here to listen. Tell us what's on your mind: the challenges, the opportunities, "
    "and what you'd like NOSTOPS to build for you."
)


class WelcomeIn(BaseModel):
    title: Optional[str] = Field(default=None, max_length=140)
    body: Optional[str] = Field(default=None, max_length=8000)
    category_slug: Optional[str] = None


@router.get("/admin/welcome")
async def admin_get_welcome(user: dict = Depends(admin_user)):
    t = await db.pulse_threads.find_one({"official": True, "status": {"$in": ["ACTIVE", "LOCKED"]}})
    return {"thread": thread_public(t) if t else None}


@router.post("/admin/welcome")
async def admin_publish_welcome(payload: WelcomeIn, user: dict = Depends(admin_user)):
    await ensure_seeded()
    existing = await db.pulse_threads.find_one({"official": True, "status": {"$in": ["ACTIVE", "LOCKED"]}})
    if existing:
        return {"thread": thread_public(existing), "existed": True}
    cat = None
    if payload.category_slug:
        cat = await db.pulse_categories.find_one({"slug": payload.category_slug, "archived": False})
    if not cat:
        cats = await db.pulse_categories.find({"archived": False}).sort("order", 1).limit(1).to_list(1)
        cat = cats[0] if cats else None
    if not cat:
        raise HTTPException(status_code=400, detail="Create a category first.")
    t = now_ms()
    doc = {
        "_id": oid(), "category_id": cat["_id"], "category_slug": cat["slug"],
        "category_name": cat["name"],
        "title": (payload.title or DEFAULT_WELCOME_TITLE).strip(),
        "body": (payload.body or DEFAULT_WELCOME_BODY).strip(),
        "author_id": user["user_id"], "author_name": user.get("name") or "NOSTOPS",
        "author_persona": "NOSTOPS Team", "status": "ACTIVE", "pinned": True,
        "reply_count": 0, "participant_ids": [user["user_id"]], "created_at": t,
        "last_activity_at": t, "updated_at": t, "edited_at": None, "official": True,
    }
    await db.pulse_threads.insert_one(doc)
    await audit(user, "welcome_publish", "thread", doc["_id"])
    return {"thread": thread_public(doc), "existed": False}


# ═══════════════════════ THEME DIGEST (AI, on-demand) ═══════════════════════
DIGEST_SYSTEM = (
    "You are a careful market-research analyst for NOSTOPS, a teachers-first yoga cooperative. "
    "You are given real discussion posts written by yoga teachers in a community called Teacher Pulse. "
    "Summarise ONLY what is actually present. Do NOT invent, exaggerate, or generalise beyond the text. "
    "These are early signals, not conclusions. If the data is thin, say so plainly. "
    "Respond in concise Markdown with these sections and nothing else:\n"
    "## Recurring themes\n## Emerging concerns\n## Frequently requested features / what to build\n"
    "## Notable quotes (2-4 short paraphrases)\n## Confidence & caveats\n"
    "Keep the whole summary under 400 words."
)


@router.get("/admin/digest")
async def admin_get_digest(user: dict = Depends(admin_user)):
    d = await db.pulse_digest.find_one({"_id": "latest"})
    if not d:
        return {"summary": None}
    return {"summary": d.get("summary"), "generated_at": d.get("generated_at"),
            "based_on": d.get("based_on"), "model": d.get("model")}


@router.post("/admin/digest/generate")
async def admin_generate_digest(user: dict = Depends(admin_user)):
    threads = await db.pulse_threads.find(
        {"status": {"$in": ["ACTIVE", "LOCKED"]}}).sort("last_activity_at", -1).limit(60).to_list(60)
    if not threads:
        return {"summary": None, "empty": True}

    parts = []
    reply_total = 0
    for t in threads:
        block = [f"### [{t.get('category_name')}] {t.get('title')}", (t.get("body") or "")[:800]]
        posts = await db.pulse_posts.find(
            {"thread_id": t["_id"], "status": "ACTIVE"}).sort("created_at", 1).limit(6).to_list(6)
        for p in posts:
            reply_total += 1
            block.append(f"- reply: {(p.get('body') or '')[:400]}")
        parts.append("\n".join(block))
    corpus = "\n\n".join(parts)[:24000]

    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="AI is not configured.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=key, session_id=f"pulse-digest-{oid()}",
                       system_message=DIGEST_SYSTEM).with_model("anthropic", "claude-sonnet-4-6")
        prompt = (
            f"There are {len(threads)} discussions and {reply_total} replies. "
            "Analyse the posts below and produce the summary as instructed.\n\n" + corpus
        )
        summary = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI summary failed: {str(exc)[:180]}")

    doc = {"_id": "latest", "summary": summary, "generated_at": now_ms(),
           "based_on": {"threads": len(threads), "replies": reply_total},
           "model": "claude-sonnet-4-6", "generated_by": user.get("name")}
    await db.pulse_digest.replace_one({"_id": "latest"}, doc, upsert=True)
    await audit(user, "digest_generate", "digest", "latest",
                f"{len(threads)} threads / {reply_total} replies")
    return {"summary": summary, "generated_at": doc["generated_at"],
            "based_on": doc["based_on"], "model": doc["model"]}


# ═══════════════ PUBLIC (anonymous, read-only teasers) ══════════════════════
# Gated by config.public_read (admin master toggle). Only ADMIN-FEATURED threads
# are ever exposed, and only as title + short snippet (no full body, no replies).
# Still requires the shared secret server-side, so the browser cannot call these
# directly — the Next.js public pages/RSS routes fetch them with a PUBLIC actor.
@router.get("/public/config")
async def public_config(user: dict = Depends(current_user)):
    cfg = await get_config()
    return {"public_read": bool(cfg.get("public_read")), "status": cfg.get("status")}


@router.get("/public/threads")
async def public_threads(user: dict = Depends(current_user), category: Optional[str] = None,
                         limit: int = Query(40, le=100)):
    cfg = await get_config()
    if not cfg.get("public_read"):
        return {"public_read": False, "threads": []}
    query: dict = {"status": {"$in": ["ACTIVE", "LOCKED"]}, "featured": True}
    if category:
        cat = await db.pulse_categories.find_one({"slug": category})
        if not cat:
            return {"public_read": True, "threads": []}
        query["category_id"] = cat["_id"]
    cursor = db.pulse_threads.find(query).sort([("pinned", -1), ("last_activity_at", -1)]).limit(limit)
    threads = [public_thread(t) for t in await cursor.to_list(limit)]
    return {"public_read": True, "threads": threads}


@router.get("/public/threads/{thread_id}")
async def public_thread_get(thread_id: str, user: dict = Depends(current_user)):
    cfg = await get_config()
    if not cfg.get("public_read"):
        raise HTTPException(status_code=404, detail="Not found.")
    t = await db.pulse_threads.find_one({"_id": thread_id})
    if not t or t.get("status") not in ("ACTIVE", "LOCKED") or not t.get("featured"):
        raise HTTPException(status_code=404, detail="Not found.")
    return {"thread": public_thread(t)}
