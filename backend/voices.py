"""
NOSTOPS Voices — teacher publishing & syndication (local FastAPI + local Mongo).

An ISOLATED, ADDITIVE feature module (same proven pattern as knowledge.py /
audit.py). The frozen remote business backend is NEVER touched. Everything lives
in the local `nostops_web` Mongo under `voices_*` collections and is mounted
BEFORE the catch-all proxy so /api/voices/* is served locally.

Surfaces
  • Admin toggles a teacher as a "NOSTOPS Author" and controls each article
    (approve / reject / publish) + "Available for Republication".
  • Enabled teachers submit articles (≤950 words, light rich text).
  • PUBLIC read endpoints power the NOSTOPS Voices pages and the read-only
    Publisher API (no keys, no accounts) — only Published + Republication-ON
    articles are exposed to external publishers, with full attribution.

Security model (identical to audit.py / ai.py)
  • Admin/teacher write + private read endpoints require the shared secret header
    `X-Pulse-Secret` (the browser never holds it — the Next.js BFF proxies them
    after validating the httpOnly session and sets `X-Pulse-User`).
  • PUBLIC read endpoints (article page + Publisher API + embed) are OPEN and
    CORS-enabled so anonymous SSR and external websites can fetch them. They only
    ever expose published, non-private fields.
"""
import base64
import hmac
import json
import os
import re
import time
import uuid
from typing import Optional

import bleach
import markdown as md_lib
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
SITE_URL = (os.environ.get("NEXT_PUBLIC_SITE_URL") or "https://www.nostops.org").rstrip("/")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/voices", tags=["voices"])

# ── Controlled vocabularies ──────────────────────────────────────────────────
ARTICLE_TYPES = ["Article", "Opinion", "Essay", "Scholarly / Research Essay", "Teacher Perspective"]
LANGS = ["en", "hi", "mr", "bn", "ta", "te"]
LANG_NAME = {"en": "English", "hi": "Hindi", "mr": "Marathi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu"}
STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "PUBLISHED", "REJECTED"]
MAX_WORDS = 950
MAX_SUMMARY = 320

SUMMARY_SYSTEM = (
    "You are a precise editor for NOSTOPS, a teachers-first yoga cooperative. "
    "Write a crisp 2-line summary (about 25–40 words, max two sentences) of the given "
    "article, to appear on listing cards and at the top of the article. Be faithful to the "
    "article — never invent facts. Neutral, inviting, plain text: no markdown, no headings, "
    "no quotes, no emojis, no hashtags, no 'In this article' preamble. Return ONLY the summary."
)

ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "blockquote", "ul", "ol", "li", "a", "hr"]
ALLOWED_ATTRS = {"a": ["href", "title", "target", "rel"]}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
}


def now_ms() -> int:
    return int(time.time() * 1000)


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


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


# ── Content helpers ──────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9\s-]", "", (text or "").lower()).strip()
    s = re.sub(r"[\s-]+", "-", s)
    return s[:80].strip("-") or "article"


def md_to_html(source: str) -> str:
    raw = md_lib.markdown(source or "", extensions=["extra", "nl2br", "sane_lists"])
    clean = bleach.clean(raw, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, protocols=ALLOWED_PROTOCOLS, strip=True)
    # Make external links safe.
    clean = clean.replace("<a ", '<a rel="noopener noreferrer nofollow" ')
    return clean


def html_to_text(html: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", html or "")
    txt = bleach.clean(txt, tags=[], strip=True)
    return re.sub(r"\s+", " ", txt).strip()


def word_count(text: str) -> int:
    t = (text or "").strip()
    return len(t.split()) if t else 0


def reading_min(words: int) -> int:
    """Estimated reading time in minutes (~200 wpm), at least 1."""
    return max(1, round((words or 0) / 200))


def _render(source_md: str) -> dict:
    html = md_to_html(source_md)
    text = html_to_text(html)
    return {"html": html, "text": text, "words": word_count(text)}


def clean_summary(raw: str) -> str:
    """Normalise an AI/author summary to a clean, 2-line plain-text string."""
    s = re.sub(r"\s+", " ", (raw or "").strip())
    s = s.strip('"').strip("'").strip()
    s = re.sub(r"[*_#>`]", "", s)  # strip stray markdown
    return s[:MAX_SUMMARY].strip()


async def auto_summary(title: str, text: str) -> str:
    """Generate a 2-line summary from the article body with Claude. Best-effort:
    returns '' if AI is unavailable so submission is never blocked."""
    body = (text or "").strip()
    if not EMERGENT_LLM_KEY or not body:
        return ""
    prompt = f"Title: {title.strip() or '(untitled)'}\n\nArticle:\n{body[:6000]}\n\nWrite the 2-line summary now."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"voices-sum-{uuid.uuid4().hex}",
            system_message=SUMMARY_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-6")
        out = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        return ""
    return clean_summary(out or "")


# ═══════════════════════ AUTHOR ENABLEMENT (admin) ══════════════════════════
class AuthorFlagIn(BaseModel):
    teacher_id: str = Field(min_length=1, max_length=128)
    enabled: bool = False


class BulkIn(BaseModel):
    ids: list[str] = Field(default_factory=list)


@router.post("/admin/author-flag")
async def set_author_flag(payload: AuthorFlagIn, user: dict = Depends(admin_user)):
    tid = payload.teacher_id.strip()
    await db.voices_authors.update_one(
        {"_id": tid},
        {"$set": {
            "teacher_id": tid, "enabled": bool(payload.enabled), "updated_at": now_ms(),
            "updated_by": str(user.get("user_id") or ""), "updated_by_name": str(user.get("name") or "NOSTOPS Admin"),
        }},
        upsert=True,
    )
    return {"ok": True, "enabled": bool(payload.enabled)}


@router.get("/author-flag/{teacher_id}")
async def get_author_flag(teacher_id: str, x_pulse_secret: Optional[str] = Header(None)):
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    d = await db.voices_authors.find_one({"_id": teacher_id.strip()})
    return {"enabled": bool(d and d.get("enabled"))}


# ═══════════════════════ ARTICLES — TEACHER (own) ═══════════════════════════
class ArticleIn(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    teacher_id: str = Field(min_length=1, max_length=128)
    author_name: str = Field(default="", max_length=200)
    author_handle: str = Field(default="", max_length=200)
    author_bio: str = Field(default="", max_length=4000)
    author_avatar_url: str = Field(default="", max_length=300000)
    author_city: str = Field(default="", max_length=120)
    title: str = Field(default="", max_length=200)
    type: str = Field(default="Article", max_length=60)
    topic: str = Field(default="", max_length=120)
    source_language: str = Field(default="en", max_length=8)
    content_md: str = Field(default="", max_length=40000)
    summary: str = Field(default="", max_length=MAX_SUMMARY)
    consent: bool = False
    action: str = Field(default="draft", max_length=16)  # draft | submit


async def _unique_slug(base: str, exclude_id: Optional[str]) -> str:
    slug = base
    n = 1
    while True:
        clash = await db.voices_articles.find_one({"slug": slug, "_id": {"$ne": exclude_id or ""}})
        if not clash:
            return slug
        n += 1
        slug = f"{base}-{n}"


@router.post("/articles")
async def upsert_article(payload: ArticleIn, user: dict = Depends(current_user)):
    """Create/update the caller's own article as a draft, or submit for review.
    The teacher_id + author identity are resolved SERVER-SIDE by the BFF from the
    caller's native profile — a teacher can only ever write as themselves."""
    tid = payload.teacher_id.strip()
    # Author must be enabled by an admin.
    author = await db.voices_authors.find_one({"_id": tid})
    if not (author and author.get("enabled")):
        raise HTTPException(status_code=403, detail="You are not enabled as a NOSTOPS Author.")

    action = (payload.action or "draft").lower()
    title = payload.title.strip()
    a_type = payload.type if payload.type in ARTICLE_TYPES else "Article"
    lang = payload.source_language if payload.source_language in LANGS else "en"
    rendered = _render(payload.content_md)

    if action == "submit":
        if not title:
            raise HTTPException(status_code=400, detail="A title is required.")
        if rendered["words"] == 0:
            raise HTTPException(status_code=400, detail="The article cannot be empty.")
        if rendered["words"] > MAX_WORDS:
            raise HTTPException(status_code=400, detail=f"The article is {rendered['words']} words — the maximum is {MAX_WORDS}.")
        if not payload.consent:
            raise HTTPException(status_code=400, detail="Please acknowledge the syndication consent to submit.")

    t = now_ms()
    summary = clean_summary(payload.summary)
    # Auto-fill a 2-line summary on submit if the author left it blank.
    if action == "submit" and not summary:
        summary = await auto_summary(title, rendered["text"])
    doc_fields = {
        "teacher_id": tid,
        "author_name": payload.author_name.strip()[:200],
        "author_handle": payload.author_handle.strip()[:200],
        "author_bio": payload.author_bio.strip()[:4000],
        "author_avatar_url": payload.author_avatar_url.strip()[:300000],
        "author_city": payload.author_city.strip()[:120],
        "title": title,
        "type": a_type,
        "topic": payload.topic.strip()[:120],
        "source_language": lang,
        "content_md": payload.content_md,
        "content_html": rendered["html"],
        "content_text": rendered["text"],
        "word_count": rendered["words"],
        "summary": summary,
        "consent": bool(payload.consent),
        "updated_at": t,
    }

    existing = None
    if payload.id:
        existing = await db.voices_articles.find_one({"_id": payload.id, "teacher_id": tid})
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found.")
        # Editing after submission is only allowed while still a DRAFT or REJECTED.
        if existing.get("status") not in ("DRAFT", "REJECTED"):
            raise HTTPException(status_code=409, detail="This article can no longer be edited (it is in review or published).")

    status = "SUBMITTED" if action == "submit" else "DRAFT"
    if payload.consent and existing and not existing.get("consent_at"):
        doc_fields["consent_at"] = t

    if existing is None:
        base = slugify(title or "voices-draft")
        slug = await _unique_slug(base, None)
        aid = uuid.uuid4().hex
        doc = {
            "_id": aid, "slug": slug, "status": status, "views": 0,
            "available_for_republication": False, "translations": {},
            "created_at": t, **doc_fields,
        }
        if action == "submit":
            doc["submitted_at"] = t
        await db.voices_articles.insert_one(doc)
        return {"ok": True, "id": aid, "slug": slug, "status": status}

    upd = {"$set": doc_fields}
    if action == "submit":
        # Regenerate slug from the (possibly changed) title if still unpublished.
        if title:
            upd["$set"]["slug"] = await _unique_slug(slugify(title), existing["_id"])
        upd["$set"]["status"] = "SUBMITTED"
        upd["$set"]["submitted_at"] = t
        upd["$set"]["rejection_reason"] = None
    else:
        upd["$set"]["status"] = existing.get("status") if existing.get("status") in ("DRAFT", "REJECTED") else "DRAFT"
    await db.voices_articles.update_one({"_id": existing["_id"]}, upd)
    return {"ok": True, "id": existing["_id"], "slug": upd["$set"].get("slug", existing.get("slug")), "status": upd["$set"]["status"]}


def _mine_row(a: dict) -> dict:
    return {
        "id": a["_id"], "slug": a.get("slug"), "title": a.get("title") or "Untitled",
        "type": a.get("type"), "topic": a.get("topic"), "source_language": a.get("source_language"),
        "status": a.get("status"), "word_count": a.get("word_count", 0), "views": a.get("views", 0),
        "available_for_republication": bool(a.get("available_for_republication")),
        "rejection_reason": a.get("rejection_reason"),
        "created_at": a.get("created_at"), "submitted_at": a.get("submitted_at"),
        "published_at": a.get("published_at"), "updated_at": a.get("updated_at"),
    }


@router.get("/teacher/articles")
async def teacher_articles(user: dict = Depends(current_user), teacher_id: str = Query(...), limit: int = Query(200, le=500)):
    docs = await db.voices_articles.find({"teacher_id": teacher_id}).sort("updated_at", -1).limit(limit).to_list(limit)
    return {"rows": [_mine_row(d) for d in docs]}


@router.get("/teacher/articles/{article_id}")
async def teacher_article(article_id: str, user: dict = Depends(current_user), teacher_id: str = Query(...)):
    a = await db.voices_articles.find_one({"_id": article_id, "teacher_id": teacher_id})
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    row = _mine_row(a)
    row["content_md"] = a.get("content_md", "")
    row["summary"] = a.get("summary", "")
    row["consent"] = bool(a.get("consent"))
    row["author_name"] = a.get("author_name")
    return {"article": row}


# ═══════════════════════ ARTICLES — ADMIN ═══════════════════════════════════
def _admin_row(a: dict) -> dict:
    row = _mine_row(a)
    row["author_name"] = a.get("author_name")
    row["author_handle"] = a.get("author_handle")
    return row


@router.get("/admin/articles")
async def admin_articles(user: dict = Depends(admin_user), status: Optional[str] = None, limit: int = Query(300, le=1000)):
    query: dict = {}
    if status and status in STATUSES:
        query["status"] = status
    docs = await db.voices_articles.find(query).sort("updated_at", -1).limit(limit).to_list(limit)
    counts: dict = {}
    for s in STATUSES:
        counts[s] = await db.voices_articles.count_documents({"status": s})
    return {"rows": [_admin_row(d) for d in docs], "counts": counts, "statuses": STATUSES}


@router.get("/admin/articles/{article_id}")
async def admin_article(article_id: str, user: dict = Depends(admin_user)):
    a = await db.voices_articles.find_one({"_id": article_id})
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    out = _admin_row(a)
    out.update({
        "content_html": a.get("content_html", ""),
        "content_md": a.get("content_md", ""),
        "author_bio": a.get("author_bio"),
        "author_avatar_url": a.get("author_avatar_url"),
        "author_city": a.get("author_city"),
        "consent": bool(a.get("consent")),
        "consent_at": a.get("consent_at"),
        "translations": sorted(list((a.get("translations") or {}).keys())),
    })
    return {"article": out}


class ActionIn(BaseModel):
    action: str = Field(max_length=24)  # approve | reject | publish | unpublish
    reason: Optional[str] = Field(default=None, max_length=1000)


@router.post("/admin/articles/{article_id}/action")
async def admin_action(article_id: str, payload: ActionIn, user: dict = Depends(admin_user)):
    a = await db.voices_articles.find_one({"_id": article_id})
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    action = (payload.action or "").lower()
    t = now_ms()
    sets: dict = {"updated_at": t}
    if action == "approve":
        sets["status"] = "APPROVED"
    elif action == "reject":
        sets["status"] = "REJECTED"
        sets["rejection_reason"] = (payload.reason or "").strip()[:1000] or "Not accepted for publication."
    elif action == "publish":
        sets["status"] = "PUBLISHED"
        sets["published_at"] = a.get("published_at") or t
        # Fresh slug if the record was never published before.
        if not a.get("published_at"):
            sets["slug"] = await _unique_slug(slugify(a.get("title") or "article"), a["_id"])
    elif action == "unpublish":
        sets["status"] = "APPROVED"
        sets["available_for_republication"] = False
    else:
        raise HTTPException(status_code=400, detail="Unknown action.")
    await db.voices_articles.update_one({"_id": article_id}, {"$set": sets})
    return {"ok": True, "status": sets["status"]}


class RepublishIn(BaseModel):
    enabled: bool = False


@router.post("/admin/articles/{article_id}/republication")
async def admin_republication(article_id: str, payload: RepublishIn, user: dict = Depends(admin_user)):
    a = await db.voices_articles.find_one({"_id": article_id})
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    if payload.enabled and a.get("status") != "PUBLISHED":
        raise HTTPException(status_code=409, detail="Only a published article can be made available for republication.")
    await db.voices_articles.update_one(
        {"_id": article_id}, {"$set": {"available_for_republication": bool(payload.enabled), "updated_at": now_ms()}})
    return {"ok": True, "available_for_republication": bool(payload.enabled)}


# ═══════════════════════ TRANSLATION (AI, cached) ═══════════════════════════
async def _ensure_translation(a: dict, lang: str) -> Optional[dict]:
    """Return the article's {title, content_html, content_text} in `lang`,
    translating from the source language with Claude and caching on first use."""
    if lang == a.get("source_language"):
        return None  # caller uses the source fields
    if lang not in LANGS:
        return None
    cached = (a.get("translations") or {}).get(lang)
    if cached:
        return cached
    if not EMERGENT_LLM_KEY or not (a.get("content_md") or "").strip():
        return None
    target_name = LANG_NAME.get(lang, lang)
    system = (
        "You are a professional literary translator for NOSTOPS, a teachers-first yoga cooperative. "
        f"Translate the given yoga article into {target_name}. Preserve meaning, tone and every Markdown "
        "structure (headings ##/###, **bold**, *italics*, > quotes, - lists, [text](url) links) EXACTLY. "
        "Keep Sanskrit/yoga terms (e.g. asana, pranayama, parampara, guru) recognisable. Do NOT add, remove "
        "or explain anything. Return ONLY a strict JSON object: {\"title\": \"...\", \"content_md\": \"...\"}."
    )
    prompt = json.dumps({"title": a.get("title", ""), "content_md": a.get("content_md", "")}, ensure_ascii=False)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"voices-tr-{uuid.uuid4().hex}", system_message=system).with_model("anthropic", "claude-sonnet-4-6")
        out = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        return None
    raw = (out or "").strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return None
    try:
        parsed = json.loads(m.group(0))
    except Exception:
        return None
    rendered = _render(parsed.get("content_md", ""))
    entry = {
        "title": (parsed.get("title") or a.get("title") or "").strip(),
        "content_md": parsed.get("content_md", ""),
        "content_html": rendered["html"],
        "content_text": rendered["text"],
    }
    await db.voices_articles.update_one({"_id": a["_id"]}, {"$set": {f"translations.{lang}": entry}})
    return entry


# ═══════════════════════ PUBLIC (open, CORS) ════════════════════════════════
def _attr(a: dict) -> dict:
    slug = a.get("slug")
    handle = a.get("author_handle") or ""
    article_url = f"{SITE_URL}/voices/{slug}"
    profile_url = f"{SITE_URL}/teachers/{handle}" if handle else ""
    return {
        "author": a.get("author_name") or "NOSTOPS Teacher",
        "originally_published_on": "NOSTOPS",
        "original_article_url": article_url,
        "teacher_profile_url": profile_url,
        "attribution_text": (
            f"Author: {a.get('author_name') or 'NOSTOPS Teacher'}. Originally published on NOSTOPS. "
            f"Original article: {article_url}." + (f" Teacher profile: {profile_url}." if profile_url else "")
        ),
    }


def _public_article(a: dict, lang: Optional[str], tr: Optional[dict]) -> dict:
    slug = a.get("slug")
    use = tr or {}
    title = use.get("title") or a.get("title")
    html = use.get("content_html") if tr else a.get("content_html")
    text = use.get("content_text") if tr else a.get("content_text")
    langs = [a.get("source_language")] + [l for l in (a.get("translations") or {}).keys()]
    # Include a freshly-generated (not-yet-persisted-in-snapshot) translation so
    # its language chip shows in the switcher on the very first load too.
    if tr and lang and lang not in langs:
        langs.append(lang)
    return {
        "id": a["_id"],
        "slug": slug,
        "title": title,
        "type": a.get("type"),
        "topic": a.get("topic"),
        "language": lang or a.get("source_language"),
        "source_language": a.get("source_language"),
        "available_languages": [{"code": c, "name": LANG_NAME.get(c, c)} for c in langs],
        "content_html": html,
        "content_text": text,
        "summary": a.get("summary") or (text or "")[:200],
        "word_count": word_count(text or ""),
        "reading_minutes": reading_min(word_count(text or "")),
        "published_at": a.get("published_at"),
        "views": a.get("views", 0),
        "author_name": a.get("author_name"),
        "author_bio": a.get("author_bio"),
        "author_avatar_url": a.get("author_avatar_url"),
        "author_city": a.get("author_city"),
        "author_handle": a.get("author_handle"),
        "available_for_republication": bool(a.get("available_for_republication")),
        "canonical_url": f"{SITE_URL}/voices/{slug}",
        "attribution": _attr(a),
    }


@router.get("/public/articles")
async def public_list(
    lang: Optional[str] = None, topic: Optional[str] = None, type: Optional[str] = None, limit: int = Query(50, le=200),
):
    """PUBLISHER API (read-only, no keys). Only Published + Available-for-
    Republication articles are exposed, with full attribution. Also used by the
    NOSTOPS Voices hub for the republication-enabled listing."""
    query: dict = {"status": "PUBLISHED", "available_for_republication": True}
    if topic:
        query["topic"] = re.compile(re.escape(topic), re.IGNORECASE)
    if type and type in ARTICLE_TYPES:
        query["type"] = type
    docs = await db.voices_articles.find(query).sort("published_at", -1).limit(limit).to_list(limit)
    rows = []
    for a in docs:
        tr = await _ensure_translation(a, lang) if lang else None
        item = _public_article(a, lang, tr)
        item.pop("views", None)
        rows.append(item)
    return JSONResponse(
        {"count": len(rows), "articles": rows, "attribution_required": True, "license": "Republication permitted with author + NOSTOPS attribution and original-source link retained."},
        headers=CORS,
    )


@router.get("/public/hub")
async def public_hub(limit: int = Query(60, le=200)):
    """All PUBLISHED articles for the public NOSTOPS Voices hub (regardless of
    republication)."""
    docs = await db.voices_articles.find({"status": "PUBLISHED"}).sort("published_at", -1).limit(limit).to_list(limit)
    rows = [{
        "slug": a.get("slug"), "title": a.get("title"), "type": a.get("type"), "topic": a.get("topic"),
        "language": a.get("source_language"), "author_name": a.get("author_name"),
        "author_handle": a.get("author_handle"), "author_avatar_url": a.get("author_avatar_url"),
        "author_city": a.get("author_city"), "published_at": a.get("published_at"),
        "excerpt": a.get("summary") or (a.get("content_text") or "")[:200],
        "reading_minutes": reading_min(a.get("word_count", 0)),
    } for a in docs]
    return JSONResponse({"count": len(rows), "articles": rows}, headers=CORS)


@router.get("/public/by-teacher")
async def public_by_teacher(handle: Optional[str] = None, teacher_id: Optional[str] = None, limit: int = Query(12, le=50)):
    """PUBLISHED articles by one teacher — powers the Author Spotlight on the
    public teacher profile. Matched by author handle (or teacher_id)."""
    q: dict = {"status": "PUBLISHED"}
    if handle:
        q["author_handle"] = handle.strip()
    elif teacher_id:
        q["teacher_id"] = teacher_id.strip()
    else:
        return JSONResponse({"count": 0, "articles": []}, headers=CORS)
    docs = await db.voices_articles.find(q).sort("published_at", -1).limit(limit).to_list(limit)
    rows = [{
        "slug": a.get("slug"), "title": a.get("title"), "type": a.get("type"), "topic": a.get("topic"),
        "language": a.get("source_language"), "published_at": a.get("published_at"),
        "excerpt": a.get("summary") or (a.get("content_text") or "")[:160],
        "reading_minutes": reading_min(a.get("word_count", 0)),
    } for a in docs]
    return JSONResponse({"count": len(rows), "articles": rows}, headers=CORS)


@router.get("/public/articles/{slug}")
async def public_article(slug: str, lang: Optional[str] = None):
    a = await db.voices_articles.find_one({"slug": slug, "status": "PUBLISHED"})
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    tr = await _ensure_translation(a, lang) if (lang and lang != a.get("source_language")) else None
    used_lang = lang if (tr or lang == a.get("source_language")) else a.get("source_language")
    return JSONResponse({"article": _public_article(a, used_lang, tr)}, headers=CORS)


class ViewIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)


@router.post("/public/view")
async def public_view(payload: ViewIn):
    await db.voices_articles.update_one({"slug": payload.slug.strip(), "status": "PUBLISHED"}, {"$inc": {"views": 1}})
    return JSONResponse({"ok": True}, headers=CORS)


@router.options("/public/articles")
@router.options("/public/articles/{slug}")
@router.options("/public/view")
async def public_options(request: Request):
    return JSONResponse({"ok": True}, headers=CORS)
