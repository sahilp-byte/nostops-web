"""Guru Nominations (Phase 1): the website's own pipeline for nominating a living Guru to the
Council of Yoga Gurus.

Owner decisions (June 2026):
  * Only signed-in members (any role) can nominate. Public page: /council/nominate.
  * Admin review only. The Council decides OUTSIDE the website; admins record each step here.
  * The Guru's email / phone are optional and seen by admins only (never by the nominator view,
    never on a public page).
  * A Guru reaches the public Council page and Google only after they ACCEPT (consent recorded)
    and an admin PUBLISHES. Any Council profile handle linked to a nomination stays hidden from
    every public surface until that nomination is published (GET /public/gate).
  * Nothing is hard-deleted: archive / restore, and every step is kept in the record's history.

Nominations made in the mobile app live on the main backend (/admin/council/nominations). The
website only keeps their archive flag here (collection guru_nomination_app_archive).

Every route needs X-Pulse-Secret (only the website BFF has it). Identity comes from X-Pulse-User,
built by the BFF from the httpOnly session, never from the browser.
"""
import asyncio
import html
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import venues
from institutional import SITE_URL, current_user
from org_enquiries import _check_secret

logger = logging.getLogger("guru_nominations")
router = APIRouter(prefix="/api/guru-nominations", tags=["guru-nominations"])
col = venues.db["guru_nominations"]
app_archive = venues.db["guru_nomination_app_archive"]

STATUS_LABELS = {
    "pending_review": "Waiting for admin review",
    "info_requested": "Waiting for the nominator's answer",
    "with_council": "With the Council of Gurus",
    "council_approved": "Approved by the Council",
    "accepted": "The Guru has accepted",
    "published": "Published on the Council page",
    "declined": "Declined by NOSTOPS",
    "council_declined": "Not approved by the Council",
    "guru_declined": "The Guru declined",
    "withdrawn": "Withdrawn by the nominator",
}
# What the nominator sees: no internal detail, no reviewer notes.
NOMINATOR_LABELS = {
    "pending_review": "Received. The NOSTOPS team is reviewing it.",
    "info_requested": "We have a question for you",
    "with_council": "With the Council of Yoga Gurus",
    "council_approved": "Approved. We are inviting the Guru.",
    "accepted": "The Guru has accepted. Their profile is being prepared.",
    "published": "Published on the Council page",
    "declined": "Not taken forward this time",
    "council_declined": "Not taken forward this time",
    "guru_declined": "Not taken forward this time",
    "withdrawn": "You withdrew this nomination",
}
OPEN = {"pending_review", "info_requested"}
FINAL = {"declined", "council_declined", "guru_declined", "withdrawn"}
FILTERS = {
    "open": {"status": {"$in": sorted(OPEN)}},
    "council": {"status": "with_council"},
    "approved": {"status": {"$in": ["council_approved", "accepted"]}},
    "published": {"status": "published"},
    "closed": {"status": {"$in": sorted(FINAL)}},
}
CHANNELS = {"email": "Email", "whatsapp": "WhatsApp", "phone": "Phone call", "in_person": "In person",
            "letter": "Letter", "other": "Other"}

MAX_OPEN_PER_USER = 3
MAX_PER_DAY = 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,99}$")
APP_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d) -> Optional[str]:
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat() if isinstance(d, datetime) else None


def _clean(s: Optional[str], limit: int) -> str:
    return re.sub(r"[ \t]+", " ", str(s or "")).strip()[:limit]


def _by(user: dict) -> dict:
    return {"user_id": str(user.get("user_id") or ""), "name": str(user.get("name") or "")[:120]}


def _require_admin(user: dict) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


def _fire_email(to: str, subject: str, body_html: str) -> None:
    """Best effort, never blocks or fails the action."""
    if not to or not EMAIL_RE.match(to):
        return

    async def _send():
        try:
            from email_util import send_email
            await send_email(to=to, subject=subject, html=body_html)
        except Exception as exc:  # noqa: BLE001
            logger.warning("nomination email not sent: %s", exc)

    asyncio.create_task(_send())


def _email_shell(name: str, paragraphs: list[str]) -> str:
    link = f"{SITE_URL}/app/nominations"
    body = "".join(f"<p style='margin:0 0 14px'>{p}</p>" for p in paragraphs)
    return (f"<div style='font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937'>"
            f"<p style='margin:0 0 14px'>Namaste {html.escape(name or 'there')},</p>{body}"
            f"<p style='margin:0 0 14px'><a href='{link}'>See your nominations</a></p>"
            f"<p style='margin:0;color:#6b7280'>NOSTOPS · Council of Yoga Gurus</p></div>")


# ── Projections ─────────────────────────────────────────────────────────────────────────────────
def _admin_view(d: dict) -> dict:
    consent = d.get("consent") or None
    return {
        "id": d["_id"], "status": d["status"], "status_label": STATUS_LABELS.get(d["status"], d["status"]),
        "archived": bool(d.get("archived")), "archive_reason": d.get("archive_reason", ""),
        "nominee": d.get("nominee") or {}, "nominator": d.get("nominator") or {},
        "relationship": d.get("relationship", ""), "citation": d.get("citation", ""),
        "references": d.get("references", ""), "council_handle": d.get("council_handle") or None,
        "consent": ({**consent, "recorded_at": _iso(consent.get("recorded_at"))} if consent else None),
        "messages": [{**m, "at": _iso(m.get("at"))} for m in d.get("messages", [])],
        "history": [{**h, "at": _iso(h.get("at"))} for h in d.get("history", [])][::-1],
        "created_at": _iso(d.get("created_at")), "updated_at": _iso(d.get("updated_at")),
        "published_at": _iso(d.get("published_at")),
    }


def _nominator_view(d: dict) -> dict:
    nominee = d.get("nominee") or {}
    msgs = [{"from": m.get("from"), "text": m.get("text", ""), "at": _iso(m.get("at"))} for m in d.get("messages", [])]
    question = next((m["text"] for m in reversed(msgs) if m["from"] == "nostops"), None) \
        if d["status"] == "info_requested" else None
    handle = d.get("council_handle") if d["status"] == "published" else None
    return {
        "id": d["_id"], "status": d["status"], "status_label": NOMINATOR_LABELS.get(d["status"], d["status"]),
        "nominee_name": nominee.get("name", ""), "nominee_lineage": nominee.get("lineage", ""),
        "nominee_city": nominee.get("city", ""), "nominee_decades": nominee.get("decades"),
        "relationship": d.get("relationship", ""), "citation": d.get("citation", ""),
        "references": d.get("references", ""), "messages": msgs, "open_question": question,
        "council_url": f"/council/{handle}" if handle else None,
        "can_reply": d["status"] == "info_requested", "can_withdraw": d["status"] in OPEN,
        "created_at": _iso(d.get("created_at")), "updated_at": _iso(d.get("updated_at")),
    }


# ── Nominator ───────────────────────────────────────────────────────────────────────────────────
class NominationIn(BaseModel):
    nominee_name: str = Field(..., max_length=200)
    nominee_lineage: str = Field("", max_length=400)
    nominee_city: str = Field("", max_length=200)
    nominee_decades: Optional[int] = Field(None, ge=1, le=10)
    nominee_email: str = Field("", max_length=300)
    nominee_phone: str = Field("", max_length=60)
    relationship: str = Field("", max_length=300)
    citation: str = Field(..., max_length=2400)
    references: str = Field("", max_length=1200)
    nominator_phone: str = Field("", max_length=60)
    confirm: bool = False


def _phone(value: str, label: str) -> str:
    p = _clean(value, 20)
    if p and not (re.fullmatch(r"\+?[\d\s\-().]{7,20}", p) and 7 <= len(re.sub(r"\D", "", p)) <= 15):
        raise HTTPException(status_code=422, detail=f"Please enter a valid {label} (7 to 15 digits).")
    return p


def _norm_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


@router.post("/submit")
async def submit(payload: NominationIn, user: dict = Depends(current_user)):
    name = _clean(payload.nominee_name, 120)
    citation = re.sub(r"\n{3,}", "\n\n", str(payload.citation or "").strip())[:1200]
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Please enter the Guru's name.")
    if len(citation) < 30:
        raise HTTPException(status_code=422, detail="Please tell us, in at least 30 characters, why this Guru belongs on the Council.")
    email = _clean(payload.nominee_email, 160).lower()
    if email and not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address for the Guru, or leave it empty.")
    if not payload.confirm:
        raise HTTPException(status_code=422, detail="Please confirm the details are true to the best of your knowledge.")
    uid = str(user.get("user_id") or "")
    now = _now()
    mine = {"nominator.user_id": uid, "archived": {"$ne": True}}
    if await col.count_documents({**mine, "status": {"$in": sorted(OPEN)}}) >= MAX_OPEN_PER_USER:
        raise HTTPException(status_code=429, detail=f"You already have {MAX_OPEN_PER_USER} nominations waiting for review. Please wait for a decision before adding more.")
    if await col.count_documents({"nominator.user_id": uid, "created_at": {"$gte": now - timedelta(days=1)}}) >= MAX_PER_DAY:
        raise HTTPException(status_code=429, detail="You've sent several nominations today. Please try again tomorrow.")
    key = _norm_name(name)
    if await col.find_one({**mine, "nominee_key": key, "status": {"$nin": sorted(FINAL)}}, {"_id": 1}):
        raise HTTPException(status_code=409, detail=f"You have already nominated {name}. You can follow it under My Guru Nominations.")
    by = _by(user)
    doc = {
        "_id": f"gnm_{uuid.uuid4().hex[:12]}", "status": "pending_review", "archived": False,
        "nominee_key": key,
        "nominee": {"name": name, "lineage": _clean(payload.nominee_lineage, 200), "city": _clean(payload.nominee_city, 100),
                    "decades": payload.nominee_decades, "email": email, "phone": _phone(payload.nominee_phone, "phone number for the Guru")},
        "nominator": {**by, "email": _clean(user.get("email"), 160).lower(), "role": str(user.get("role") or ""),
                      "phone": _phone(payload.nominator_phone, "phone number")},
        "relationship": _clean(payload.relationship, 140), "citation": citation,
        "references": str(payload.references or "").strip()[:600],
        "confirmed_at": now, "messages": [], "created_at": now, "updated_at": now,
        "history": [{"action": "submitted", "at": now, "by": by, "note": ""}],
    }
    await col.insert_one(doc)
    _fire_email(doc["nominator"]["email"], "We've received your Guru nomination", _email_shell(by["name"], [
        f"Thank you for nominating <strong>{html.escape(name)}</strong> to the Council of Yoga Gurus.",
        "The NOSTOPS team will review it first. If it goes ahead, the Council decides, and we only invite the "
        "Guru after that. Nothing about the Guru is published unless they agree.",
    ]))
    return {"ok": True, "nomination": _nominator_view(doc)}


@router.get("/mine")
async def mine(user: dict = Depends(current_user)):
    rows = await col.find({"nominator.user_id": str(user.get("user_id") or ""), "archived": {"$ne": True}}) \
        .sort("created_at", -1).to_list(100)
    return {"items": [_nominator_view(d) for d in rows]}


class ReplyIn(BaseModel):
    action: Literal["reply", "withdraw"]
    text: str = Field("", max_length=2400)


@router.post("/{nid}/mine")
async def nominator_action(nid: str, payload: ReplyIn, user: dict = Depends(current_user)):
    d = await col.find_one({"_id": nid, "nominator.user_id": str(user.get("user_id") or ""), "archived": {"$ne": True}})
    if not d:
        raise HTTPException(status_code=404, detail="Nomination not found.")
    now, by = _now(), _by(user)
    if payload.action == "reply":
        text = str(payload.text or "").strip()[:1200]
        if d["status"] != "info_requested":
            raise HTTPException(status_code=409, detail="There is no open question on this nomination.")
        if len(text) < 2:
            raise HTTPException(status_code=422, detail="Please type your answer.")
        update = {"$set": {"status": "pending_review", "updated_at": now},
                  "$push": {"messages": {"from": "nominator", "text": text, "at": now},
                            "history": {"action": "answered", "at": now, "by": by, "note": ""}}}
    else:
        if d["status"] not in OPEN:
            raise HTTPException(status_code=409, detail="This nomination can no longer be withdrawn.")
        update = {"$set": {"status": "withdrawn", "updated_at": now},
                  "$push": {"history": {"action": "withdrawn", "at": now, "by": by, "note": ""}}}
    d = await col.find_one_and_update({"_id": nid}, update, return_document=ReturnDocument.AFTER)
    return {"ok": True, "nomination": _nominator_view(d)}


# ── Public gate (BFF / server components only) ──────────────────────────────────────────────────
@router.get("/public/gate")
async def public_gate(x_pulse_secret: Optional[str] = Header(None)):
    """Council profile handles that must stay off every public surface (linked, not published)."""
    _check_secret(x_pulse_secret)
    handles = await col.distinct("council_handle", {"council_handle": {"$nin": [None, ""]}, "status": {"$ne": "published"}})
    return {"gated_handles": sorted(handles)}


# ── Admin ───────────────────────────────────────────────────────────────────────────────────────
@router.get("/admin/list")
async def admin_list(filter: str = Query("open", max_length=20), user: dict = Depends(current_user)):
    _require_admin(user)
    live = {"archived": {"$ne": True}}
    if filter == "archived":
        query = {"archived": True}
    elif filter == "all":
        query = {}
    else:
        query = {**live, **FILTERS.get(filter, FILTERS["open"])}
    rows = await col.find(query).sort("created_at", -1).to_list(500)
    counts = {k: await col.count_documents({**live, **q}) for k, q in FILTERS.items()}
    counts["archived"] = await col.count_documents({"archived": True})
    counts["all"] = await col.count_documents({})
    return {"items": [_admin_view(d) for d in rows], "counts": counts, "channels": CHANNELS}


@router.get("/admin/summary")
async def admin_summary(user: dict = Depends(current_user)):
    _require_admin(user)
    return {"open": await col.count_documents({"archived": {"$ne": True}, "status": {"$in": sorted(OPEN)}})}


@router.get("/admin/item/{nid}")
async def admin_item(nid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await col.find_one({"_id": nid})
    if not d:
        raise HTTPException(status_code=404, detail="Nomination not found.")
    return {"nomination": _admin_view(d)}


# action -> (statuses it may start from, status it moves to; None = unchanged)
TRANSITIONS: dict[str, tuple[set, Optional[str]]] = {
    "request_info": (OPEN, "info_requested"),
    "advance": (OPEN, "with_council"),
    "decline": (OPEN | {"with_council"}, "declined"),
    "council_approved": ({"with_council"}, "council_approved"),
    "council_declined": ({"with_council"}, "council_declined"),
    "record_acceptance": ({"council_approved"}, "accepted"),
    "guru_declined": ({"council_approved", "accepted"}, "guru_declined"),
    "link_profile": ({"council_approved", "accepted"}, None),
    "publish": ({"accepted"}, "published"),
    "unpublish": ({"published"}, "accepted"),
    "reopen": ({"declined", "council_declined", "guru_declined"}, "pending_review"),
}


class ConsentIn(BaseModel):
    accepted_on: str = Field(..., max_length=10)
    channel: str = Field(..., max_length=20)
    photo_ok: bool = False
    note: str = Field("", max_length=1200)


class AdminActionIn(BaseModel):
    action: Literal["request_info", "advance", "decline", "council_approved", "council_declined", "record_acceptance",
                    "guru_declined", "link_profile", "publish", "unpublish", "reopen", "archive", "restore"]
    note: str = Field("", max_length=1200)
    question: str = Field("", max_length=2400)
    handle: str = Field("", max_length=120)
    consent: Optional[ConsentIn] = None


@router.post("/admin/item/{nid}")
async def admin_action(nid: str, payload: AdminActionIn, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await col.find_one({"_id": nid})
    if not d:
        raise HTTPException(status_code=404, detail="Nomination not found.")
    now, by, act = _now(), _by(user), payload.action
    note = str(payload.note or "").strip()[:600]
    sets: dict = {"updated_at": now}
    push: dict = {}

    if act in ("archive", "restore"):
        if act == "archive":
            if d.get("archived"):
                raise HTTPException(status_code=409, detail="This nomination is already archived.")
            if d["status"] == "published":
                raise HTTPException(status_code=409, detail="Unpublish the Guru first, then archive the nomination.")
            sets.update({"archived": True, "archive_reason": note})
        else:
            if not d.get("archived"):
                raise HTTPException(status_code=409, detail="This nomination is not archived.")
            sets.update({"archived": False, "archive_reason": ""})
    else:
        if d.get("archived"):
            raise HTTPException(status_code=409, detail="Restore this nomination before changing it.")
        allowed, to = TRANSITIONS[act]
        if d["status"] not in allowed:
            raise HTTPException(status_code=409, detail=f"That step isn't available while the nomination is “{STATUS_LABELS.get(d['status'], d['status'])}”.")
        if to:
            sets["status"] = to
        if act == "request_info":
            q = str(payload.question or "").strip()[:1200]
            if len(q) < 5:
                raise HTTPException(status_code=422, detail="Please type your question (at least 5 characters).")
            push["messages"] = {"from": "nostops", "text": q, "at": now}
            note = q
        elif act == "record_acceptance":
            c = payload.consent
            if not c:
                raise HTTPException(status_code=422, detail="Please record how and when the Guru accepted.")
            try:
                day = datetime.strptime(c.accepted_on, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=422, detail="Please enter the date the Guru accepted.")
            if day > _now().date() or day < (d["created_at"].date() if isinstance(d.get("created_at"), datetime) else day):
                raise HTTPException(status_code=422, detail="The acceptance date must be between the nomination date and today.")
            if c.channel not in CHANNELS:
                raise HTTPException(status_code=422, detail="Please choose how the Guru accepted.")
            sets["consent"] = {"accepted_on": day.isoformat(), "channel": c.channel, "channel_label": CHANNELS[c.channel],
                               "photo_ok": bool(c.photo_ok), "note": str(c.note or "").strip()[:600],
                               "recorded_at": now, "recorded_by": by}
        elif act == "link_profile":
            h = _clean(payload.handle, 100).lower().strip("/")
            h = h.rsplit("/council/", 1)[-1] if "/council/" in h else h
            if h and not HANDLE_RE.match(h):
                raise HTTPException(status_code=422, detail="Enter the Council profile handle, e.g. acharya-jane-doe.")
            if h and await col.find_one({"_id": {"$ne": nid}, "council_handle": h}, {"_id": 1}):
                raise HTTPException(status_code=409, detail="That Council profile is already linked to another nomination.")
            sets["council_handle"] = h or None
            note = f"Linked /council/{h}" if h else "Unlinked the Council profile"
        elif act == "publish":
            if not d.get("consent"):
                raise HTTPException(status_code=409, detail="Record the Guru's acceptance before publishing.")
            if not d.get("council_handle"):
                raise HTTPException(status_code=409, detail="Link the Guru's Council profile before publishing.")
            sets["published_at"] = now
        elif act == "reopen" and d["status"] == "guru_declined":
            sets["consent"] = None
    push["history"] = {"action": act, "at": now, "by": by, "note": note}
    d = await col.find_one_and_update({"_id": nid}, {"$set": sets, "$push": push}, return_document=ReturnDocument.AFTER)
    if act == "request_info":
        nominator = d.get("nominator") or {}
        _fire_email(nominator.get("email", ""), "A question about your Guru nomination", _email_shell(nominator.get("name", ""), [
            f"Thank you for nominating <strong>{html.escape((d.get('nominee') or {}).get('name', ''))}</strong>. "
            "Before we go further, the NOSTOPS team has a question:",
            f"<em>{html.escape(note)}</em>",
            "Please sign in and answer it under My Guru Nominations.",
        ]))
    return {"ok": True, "nomination": _admin_view(d)}


# ── Mobile-app nominations (main backend): website-side archive only ────────────────────────────
@router.get("/admin/app-archive")
async def app_archive_list(user: dict = Depends(current_user)):
    _require_admin(user)
    rows = await app_archive.find({"archived": True}).to_list(1000)
    return {"archived": {r["_id"]: {"reason": r.get("reason", ""), "at": _iso(r.get("archived_at")),
                                    "by": (r.get("archived_by") or {}).get("name", "")} for r in rows}}


class AppArchiveIn(BaseModel):
    nomination_id: str = Field(..., max_length=64)
    action: Literal["archive", "restore"]
    reason: str = Field("", max_length=1200)


@router.post("/admin/app-archive")
async def app_archive_set(payload: AppArchiveIn, user: dict = Depends(current_user)):
    _require_admin(user)
    if not APP_ID_RE.match(payload.nomination_id):
        raise HTTPException(status_code=422, detail="Unknown nomination.")
    now, by = _now(), _by(user)
    if payload.action == "archive":
        update = {"$set": {"archived": True, "reason": str(payload.reason or "").strip()[:600], "archived_at": now, "archived_by": by},
                  "$push": {"history": {"action": "archive", "at": now, "by": by}}}
    else:
        update = {"$set": {"archived": False, "restored_at": now},
                  "$push": {"history": {"action": "restore", "at": now, "by": by}}}
    await app_archive.update_one({"_id": payload.nomination_id}, update, upsert=True)
    return {"ok": True}
