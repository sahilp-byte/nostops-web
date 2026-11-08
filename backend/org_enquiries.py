"""
NOSTOPS Organisation Enquiries ("Request a proposal") — local lead store.

Public visitors (companies, educational institutions, startup & networking
groups) submit an enquiry from the organisation pages. The Next.js BFF applies
CSRF, a honeypot, a time-trap and a burst limit, then calls this module with the
shared secret. Here we enforce, server-side and independently of the BFF:
  · strict validation (Literal enums, length caps, email-or-phone rule, consent)
  · the self-hosted image CAPTCHA (signed, single-use — shared with venues)
  · content heuristics + a Mongo-backed 5 / hour / IP limit (IP stored hashed)
  · a 24h duplicate rule (same org + same email/phone returns the existing ref)

Staff work the lead in the admin "Org Enquiries" pipeline: stages
NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON / LOST, an owner,
notes and a full history. Admin routes require the shared secret AND an admin
identity in X-Pulse-User (set server-side by the BFF from the httpOnly session).

Notifications: a team alert (ORG_ENQUIRY_TEAM_EMAIL) and an acknowledgement to
the enquirer. Email failure never loses the lead — each delivery is recorded as
sent / failed / skipped and failed ones can be re-sent from the admin.
"""
import base64
import hmac
import html
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from venues import _client_ip, _ip_hash, _verify_captcha

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
TEAM_EMAIL = os.environ.get("ORG_ENQUIRY_TEAM_EMAIL") or "nostops.org@gmail.com"
SITE = "https://www.nostops.org"
REPLY_SLA = "within 2 working days"

_db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
_col = _db["org_enquiries"]

router = APIRouter(prefix="/api/org-enquiries", tags=["org-enquiries"])

COHORTS = {
    "COMPANY": "Company",
    "EDUCATIONAL_INSTITUTION": "Educational Institution",
    "STARTUP_NETWORK": "Startup & Networking Group",
}
INTERESTS = {"MIND": "Mind", "BODY": "Body", "SPECIAL_NEEDS": "Special Needs"}
DURATIONS = {"1_MONTH": "1-month starter", "3_MONTHS": "3-month pilot", "6_MONTHS": "6 months", "12_MONTHS": "12 months", "NOT_SURE": "Not sure yet"}
START_PERIODS = {
    "THIS_MONTH": "This month",
    "NEXT_MONTH": "Next month",
    "IN_2_3_MONTHS": "In 2–3 months",
    "LATER": "Later this year",
    "NOT_SURE": "Not sure yet",
}
# Bands mirror the published pricing tiers (15–28 / 29–40). Legacy keys stay
# here for DISPLAY of enquiries submitted before the bands were aligned.
PARTICIPANTS = {"UNDER_15": "Fewer than 15", "15_28": "15–28", "29_40": "29–40", "41_PLUS": "More than 40",
                "UNDER_18": "Under 18", "18_28": "18–28", "41_100": "41–100", "100_PLUS": "100+"}
STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]
OPEN_STAGES = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
_SPAM_TERMS = (
    "viagra", "cialis", "casino", "porn", "escort", "loan approved", "bitcoin doubler",
    "forex signals", "seo service", "buy backlinks", "cheap meds", "crypto pump",
    "make money fast", "weight loss pills", "adult dating", "onlyfans",
)
_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
RATE_PER_HOUR = 5


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


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


def _digits(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch.isdigit())


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def _new_ref() -> str:
    return "ENQ-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))


# ─────────────────────────────── models ────────────────────────────────────
class Utm(BaseModel):
    source: str = Field(default="", max_length=100)
    medium: str = Field(default="", max_length=100)
    campaign: str = Field(default="", max_length=100)
    term: str = Field(default="", max_length=100)
    content: str = Field(default="", max_length=100)


class EnquiryIn(BaseModel):
    organisation_name: str = Field(min_length=2, max_length=160)
    contact_name: str = Field(min_length=1, max_length=120)
    designation: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=40)
    cohort: Literal["COMPANY", "EDUCATIONAL_INSTITUTION", "STARTUP_NETWORK"]
    city: str = Field(min_length=2, max_length=80)
    participants: Literal["UNDER_15", "15_28", "29_40", "41_PLUS"]
    interests: list[Literal["MIND", "BODY", "SPECIAL_NEEDS"]] = Field(min_length=1, max_length=3)
    duration: Literal["1_MONTH", "3_MONTHS", "6_MONTHS", "12_MONTHS", "NOT_SURE"]
    start_period: Literal["THIS_MONTH", "NEXT_MONTH", "IN_2_3_MONTHS", "LATER", "NOT_SURE"]
    message: str = Field(default="", max_length=2000)
    consent: bool
    # Set ONLY when the creator explicitly asked for a customised programme (the
    # wizard's "Need something different?" link). Never derived from interests —
    # choosing SPECIAL_NEEDS alone is a normal, self-service interest.
    customisation_requested: bool = False
    source_page: str = Field(default="", max_length=200)
    referrer: str = Field(default="", max_length=300)
    landing_page: str = Field(default="", max_length=300)
    utm: Utm = Field(default_factory=Utm)
    honeypot: str = Field(default="", max_length=200)
    captcha_token: str = Field(default="", max_length=512)
    captcha_answer: str = Field(default="", max_length=16)


class EnquiryPatch(BaseModel):
    stage: Optional[Literal["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]] = None
    owner: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=4000)


class ProposalIn(BaseModel):
    template: Literal["programme", "call"]
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=20, max_length=8000)


def _validate(p: EnquiryIn) -> dict:
    """Business validation beyond the pydantic schema. Returns cleaned fields."""
    org = p.organisation_name.strip()
    contact = p.contact_name.strip()
    city = p.city.strip()
    email = p.email.strip().lower()
    phone = p.phone.strip()
    errors: dict = {}
    if len(org) < 2:
        errors["organisation_name"] = "Enter your organisation's name."
    if not contact:
        errors["contact_name"] = "Enter your name."
    if len(city) < 2:
        errors["city"] = "Enter the city."
    if not email and not phone:
        errors["email"] = "Give a work email or a phone number so we can reach you."
    if email and not _EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address."
    if phone and not (7 <= len(_digits(phone)) <= 15 and re.fullmatch(r"[\d\s()+\-.]+", phone)):
        errors["phone"] = "Enter a valid phone number."
    if not p.consent:
        errors["consent"] = "Please agree to be contacted about your enquiry."
    if errors:
        raise HTTPException(status_code=400, detail={"message": "Please check the highlighted fields.", "fields": errors})

    blob = " ".join([org, contact, p.designation, city, p.message]).lower()
    if any(t in blob for t in _SPAM_TERMS):
        raise HTTPException(status_code=422, detail="Enquiry rejected: flagged content.")
    if _URL_RE.search(" ".join([org, contact, p.designation, city])):
        raise HTTPException(status_code=422, detail="Links are not allowed in the name or city fields.")
    if len(_URL_RE.findall(p.message)) > 2:
        raise HTTPException(status_code=422, detail="Too many links in the message.")

    interests = list(dict.fromkeys(p.interests))
    return {
        "organisation_name": org[:160],
        "contact_name": contact[:120],
        "designation": p.designation.strip()[:120] or None,
        "email": email[:200] or None,
        "phone": phone[:40] or None,
        "cohort": p.cohort,
        "city": city[:80],
        "participants": p.participants,
        "interests": interests,
        "duration": p.duration,
        "start_period": p.start_period,
        "message": p.message.strip()[:2000] or None,
        "customisation_requested": bool(p.customisation_requested),
    }


def _public(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k not in ("_id", "ip_hash", "dedupe_key")}
    out["id"] = doc["_id"]
    return out


# ───────────────────────────── notifications ───────────────────────────────
def _rows_html(rows: list[tuple[str, str]]) -> str:
    return "".join(
        f"<tr><td style='padding:4px 12px 4px 0;color:#6b7280;vertical-align:top'>{html.escape(k)}</td>"
        f"<td style='padding:4px 0;font-weight:600'>{html.escape(str(v))}</td></tr>"
        for k, v in rows
    )


def _summary_rows(doc: dict) -> list[tuple[str, str]]:
    rows = [
        ("Organisation", doc["organisation_name"]),
        ("Organisation type", COHORTS.get(doc["cohort"], doc["cohort"])),
        ("City", doc["city"]),
        ("Approx. participants", PARTICIPANTS.get(doc["participants"], doc["participants"])),
        ("Programme interests", ", ".join(INTERESTS.get(i, i) for i in doc["interests"])),
        ("Preferred duration", DURATIONS.get(doc["duration"], doc["duration"])),
        ("Preferred start", START_PERIODS.get(doc["start_period"], doc["start_period"])),
    ]
    if doc.get("customisation_requested"):
        rows.append(("Customised programme", "Requested"))
    return rows


async def _send_team(doc: dict) -> None:
    from email_util import send_email

    rows = [("Reference", doc["ref"])] + _summary_rows(doc) + [
        ("Contact", doc["contact_name"] + (f" · {doc['designation']}" if doc.get("designation") else "")),
        ("Email", doc.get("email") or "—"),
        ("Phone", doc.get("phone") or "—"),
        ("Source page", doc.get("source_page") or "—"),
        ("Campaign", " / ".join(v for v in (doc.get("utm") or {}).values() if v) or "—"),
        ("Received", doc["created_at"]),
    ]
    link = html.escape(f"{SITE}/app/admin/org-enquiries/{doc['_id']}")
    out = (
        "<div style='font-family:system-ui,sans-serif;color:#111827'>"
        "<h2 style='margin:0 0 8px'>New organisation enquiry</h2>"
        f"<p style='margin:0 0 12px;color:#374151'>Please reply to the enquirer {html.escape(REPLY_SLA)}. "
        "Any message they wrote is in the admin record.</p>"
        f"<table style='border-collapse:collapse;font-size:14px'>{_rows_html(rows)}</table>"
        f"<p style='margin:16px 0 0'><a href='{link}' style='color:#0f766e;font-weight:700'>Open the enquiry &rarr;</a></p>"
        "</div>"
    )
    await send_email(
        to=TEAM_EMAIL,
        subject=f"[Org enquiry · {COHORTS.get(doc['cohort'], '')}] {doc['ref']} · {doc['organisation_name'][:60]}",
        html=out,
        reply_to=doc.get("email") or None,
    )


async def _send_ack(doc: dict) -> None:
    from email_util import send_email

    link = html.escape(f"{SITE}/for-organisations")
    out = (
        "<div style='font-family:system-ui,sans-serif;color:#111827'>"
        f"<h2 style='margin:0 0 8px'>Thank you, {html.escape(doc['contact_name'])}</h2>"
        f"<p style='margin:0 0 12px;color:#374151'>We have received your enquiry <strong>{html.escape(doc['ref'])}</strong>. "
        f"The NOSTOPS team will reply {html.escape(REPLY_SLA)}.</p>"
        "<p style='margin:0 0 8px;color:#374151'>Here is what you shared with us:</p>"
        f"<table style='border-collapse:collapse;font-size:14px'>{_rows_html(_summary_rows(doc))}</table>"
        "<p style='margin:16px 0 0;color:#374151'>If anything changes, simply reply to this email and quote your reference.</p>"
        f"<p style='margin:16px 0 0'><a href='{link}' style='color:#0f766e;font-weight:700'>NOSTOPS for Organisations &rarr;</a></p>"
        "</div>"
    )
    await send_email(
        to=doc["email"],
        subject=f"We've received your enquiry ({doc['ref']}) · NOSTOPS",
        html=out,
        reply_to=TEAM_EMAIL,
    )


async def _deliver(doc: dict, only_failed: bool = False) -> dict:
    """Send the team alert + acknowledgement and persist each delivery status."""
    notes = dict(doc.get("notifications") or {})
    jobs = [("team", _send_team, True), ("ack", _send_ack, bool(doc.get("email")))]
    for key, fn, applicable in jobs:
        cur = dict(notes.get(key) or {"status": "pending", "attempts": 0})
        if not applicable:
            notes[key] = {"status": "skipped", "attempts": 0, "reason": "no email address"}
            continue
        if only_failed and cur.get("status") != "failed":
            notes[key] = cur
            continue
        try:
            await fn(doc)
            cur.update(status="sent", error=None)
        except Exception as e:  # noqa: BLE001 — a delivery failure never loses the lead.
            cur.update(status="failed", error=str(getattr(e, "detail", e))[:200])
        cur["attempts"] = int(cur.get("attempts") or 0) + 1
        cur["at"] = _now()
        notes[key] = cur
    await _col.update_one({"_id": doc["_id"]}, {"$set": {"notifications": notes}})
    return notes


# ─────────────────────────────── routes ────────────────────────────────────
@router.post("")
async def create_enquiry(
    payload: EnquiryIn,
    x_pulse_secret: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
):
    _check_secret(x_pulse_secret)

    # 1) Honeypot — pretend success, store nothing.
    if payload.honeypot.strip():
        return {"ok": True, "ref": _new_ref(), "deduped": False}

    # 2) Validation (before the captcha so a typo doesn't burn the challenge).
    clean = _validate(payload)

    # 3) CAPTCHA — signed, time-limited, single-use.
    if not await _verify_captcha(payload.captcha_token, payload.captcha_answer):
        raise HTTPException(status_code=400, detail="The verification code was incorrect or has expired. Please try the new code.")

    # 4) Duplicate rule — same organisation + same email/phone within 24h.
    contact_key = clean["email"] or _digits(clean["phone"] or "")
    dedupe_key = f"{_norm(clean['organisation_name'])}|{contact_key}"
    day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).replace(microsecond=0).isoformat()
    existing = await _col.find_one({"dedupe_key": dedupe_key, "created_at": {"$gte": day_ago}})
    if existing:
        return {"ok": True, "ref": existing["ref"], "deduped": True}

    # 5) Rate limit — 5 new enquiries / hour / IP (hashed).
    iphash = _ip_hash(_client_ip(x_forwarded_for))
    hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).replace(microsecond=0).isoformat()
    if iphash and await _col.count_documents({"ip_hash": iphash, "created_at": {"$gte": hour_ago}}) >= RATE_PER_HOUR:
        raise HTTPException(status_code=429, detail="You've sent several enquiries recently. Please try again in an hour.")

    now = _now()
    ref = _new_ref()
    while await _col.find_one({"ref": ref}, {"_id": 1}):
        ref = _new_ref()
    doc = {
        "_id": uuid.uuid4().hex,
        "ref": ref,
        **clean,
        "consent": True,
        "consent_at": now,
        "source_page": payload.source_page.strip()[:200] or None,
        "landing_page": payload.landing_page.strip()[:300] or None,
        "referrer": payload.referrer.strip()[:300] or None,
        "utm": {k: v.strip() for k, v in payload.utm.model_dump().items() if v and v.strip()},
        "stage": "NEW",
        "owner": None,
        "notes": [],
        "history": [{"action": "created", "actor": "website", "at": now, "to": "NEW"}],
        "notifications": {},
        "dedupe_key": dedupe_key,
        "ip_hash": iphash,
        "created_at": now,
        "updated_at": now,
    }
    await _col.insert_one(doc)
    await _deliver(doc)
    return {"ok": True, "ref": ref, "deduped": False}


@router.get("")
async def list_enquiries(
    stage: Optional[str] = None,
    cohort: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = Query(default=None, max_length=80),
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    _require_admin(x_pulse_secret, x_pulse_user)
    query: dict = {}
    if stage == "open":
        query["stage"] = {"$in": list(OPEN_STAGES)}
    elif stage in STAGES:
        query["stage"] = stage
    if cohort in COHORTS:
        query["cohort"] = cohort
    if city and city.strip():
        query["city"] = {"$regex": f"^{re.escape(city.strip())}$", "$options": "i"}
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"organisation_name": rx}, {"contact_name": rx}, {"email": rx}, {"ref": rx}]
    items = [_public(d) async for d in _col.find(query).sort("created_at", -1).limit(500)]

    by_stage = {s: 0 for s in STAGES}
    async for row in _col.aggregate([{"$group": {"_id": "$stage", "n": {"$sum": 1}}}]):
        if row["_id"] in by_stage:
            by_stage[row["_id"]] = row["n"]
    cities = sorted({c for c in await _col.distinct("city") if c}, key=str.lower)
    return {"items": items, "by_stage": by_stage, "cities": cities, "total": sum(by_stage.values())}


@router.get("/summary")
async def summary(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    return {"new": await _col.count_documents({"stage": "NEW"})}


@router.get("/{eid}")
async def get_enquiry(eid: str, x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    doc = await _col.find_one({"_id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    return _public(doc)


@router.patch("/{eid}")
async def update_enquiry(
    eid: str,
    payload: EnquiryPatch,
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    user = _require_admin(x_pulse_secret, x_pulse_user)
    actor = str(user.get("name") or user.get("user_id") or "admin")[:120]
    doc = await _col.find_one({"_id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    now = _now()
    sets: dict = {}
    history: list[dict] = []
    if payload.stage and payload.stage != doc.get("stage"):
        sets["stage"] = payload.stage
        history.append({"action": "stage", "actor": actor, "at": now, "from": doc.get("stage"), "to": payload.stage})
    if payload.owner is not None:
        owner = payload.owner.strip()[:120] or None
        if owner != doc.get("owner"):
            sets["owner"] = owner
            history.append({"action": "owner", "actor": actor, "at": now, "from": doc.get("owner"), "to": owner})
    update: dict = {}
    note = (payload.note or "").strip()
    if note:
        update.setdefault("$push", {})["notes"] = {"text": note[:4000], "author": actor, "at": now}
        history.append({"action": "note", "actor": actor, "at": now})
    if not sets and not note:
        return _public(doc)
    sets["updated_at"] = now
    update["$set"] = sets
    update.setdefault("$push", {})["history"] = {"$each": history}
    await _col.update_one({"_id": eid}, update)
    return _public(await _col.find_one({"_id": eid}))


class EnquiryDelete(BaseModel):
    confirm: str = ""


@router.delete("/{eid}")
async def delete_enquiry(
    eid: str,
    payload: EnquiryDelete,
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    """Permanent delete (spam / test enquiries). No trace is kept, by owner choice."""
    _require_admin(x_pulse_secret, x_pulse_user)
    if payload.confirm != "DELETE":
        raise HTTPException(status_code=400, detail='Type DELETE to confirm.')
    res = await _col.delete_one({"_id": eid})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    return {"ok": True}


@router.post("/{eid}/notify-retry")
async def notify_retry(eid: str, x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    doc = await _col.find_one({"_id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    notes = await _deliver(doc, only_failed=True)
    return {"ok": True, "notifications": notes}


# ───────────────────────────── proposal email ──────────────────────────────
# Admins pick a ready-made template (built in the admin UI from the shared
# pricing / programme copy), edit the plain-text subject + body, preview and
# send. The body is ALWAYS treated as plain text: escaped, then laid out as
# paragraphs and bullet lists — never raw HTML. The call-to-action is fixed per
# template server-side. Replies go to the team inbox.
PROPOSAL_STAGE_BEFORE = {"NEW", "CONTACTED", "QUALIFIED"}
_BULLET_RE = re.compile(r"^\s*(?:[•\-*])\s+")


def _proposal_cta(doc: dict, template: str) -> tuple[str, str]:
    if template == "call":
        return "Book a call", f"mailto:{TEAM_EMAIL}?subject={quote('Book a call · ' + doc['ref'])}"
    return "Explore our programmes", f"{SITE}/programmes"


def _text_to_html(body: str) -> str:
    out = []
    for block in re.split(r"\n\s*\n", body.strip()):
        lines = [ln.rstrip() for ln in block.split("\n") if ln.strip()]
        has_bullets = any(_BULLET_RE.match(ln) for ln in lines)
        items: list[str] = []

        def flush():
            if items:
                lis = "".join(f"<li style='margin:2px 0'>{i}</li>" for i in items)
                out.append(f"<ul style='margin:4px 0 12px;padding-left:20px;color:#374151'>{lis}</ul>")
                items.clear()

        para: list[str] = []
        for ln in lines:
            if _BULLET_RE.match(ln):
                if para:
                    out.append(f"<p style='margin:0 0 4px;font-weight:700;color:#111827'>{'<br>'.join(para)}</p>")
                    para = []
                items.append(html.escape(_BULLET_RE.sub("", ln, count=1)))
            else:
                flush()
                para.append(html.escape(ln))
        flush()
        if para:
            style = "margin:0 0 4px;font-weight:700;color:#111827" if has_bullets else "margin:0 0 12px;color:#374151;line-height:1.55"
            out.append(f"<p style='{style}'>{'<br>'.join(para)}</p>")
    return "".join(out)


def _proposal_html(doc: dict, template: str, body: str) -> str:
    label, url = _proposal_cta(doc, template)
    return (
        "<div style='font-family:system-ui,sans-serif;color:#111827;font-size:14px;max-width:620px'>"
        "<p style='margin:0 0 16px;font-size:12px;font-weight:800;letter-spacing:.12em;color:#0f766e'>NOSTOPS · FOR ORGANISATIONS</p>"
        f"{_text_to_html(body)}"
        f"<p style='margin:20px 0'><a href='{html.escape(url)}' style='display:inline-block;background:#0f766e;color:#ffffff;"
        f"padding:10px 18px;border-radius:10px;font-weight:700;text-decoration:none'>{html.escape(label)}</a></p>"
        f"<p style='margin:16px 0 0;font-size:12px;color:#6b7280'>Your enquiry reference: {html.escape(doc['ref'])}. "
        "Simply reply to this email to reach the NOSTOPS team.</p>"
        "</div>"
    )


async def _proposal_target(eid: str, x_pulse_secret, x_pulse_user) -> tuple[dict, dict]:
    user = _require_admin(x_pulse_secret, x_pulse_user)
    doc = await _col.find_one({"_id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    if not doc.get("email"):
        raise HTTPException(status_code=400, detail="This enquiry has no email address. Contact them by phone instead.")
    return user, doc


def _gate(subject: str, out: str) -> None:
    from email_util import _assert_safe_email

    try:
        _assert_safe_email(subject, out)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"This email can't be sent as written: {e}")


@router.post("/{eid}/proposal/preview")
async def proposal_preview(
    eid: str,
    payload: ProposalIn,
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    _, doc = await _proposal_target(eid, x_pulse_secret, x_pulse_user)
    subject = payload.subject.strip()
    out = _proposal_html(doc, payload.template, payload.body)
    _gate(subject, out)
    return {"to": doc["email"], "reply_to": TEAM_EMAIL, "subject": subject, "html": out}


@router.post("/{eid}/proposal")
async def proposal_send(
    eid: str,
    payload: ProposalIn,
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    from email_util import send_email

    user, doc = await _proposal_target(eid, x_pulse_secret, x_pulse_user)
    actor = str(user.get("name") or user.get("user_id") or "admin")[:120]
    subject = payload.subject.strip()
    body = payload.body.strip()
    out = _proposal_html(doc, payload.template, body)
    _gate(subject, out)

    now = _now()
    record = {"template": payload.template, "subject": subject, "body": body, "to": doc["email"], "sent_by": actor, "at": now}
    try:
        await send_email(to=doc["email"], subject=subject, html=out, reply_to=TEAM_EMAIL)
    except Exception as e:  # noqa: BLE001 — record the failed attempt, keep the stage.
        record.update(status="failed", error=str(getattr(e, "detail", e))[:200])
        await _col.update_one({"_id": eid}, {"$push": {"proposals": record}, "$set": {"updated_at": now}})
        raise HTTPException(status_code=502, detail="The proposal email could not be sent. Please try again.")

    record["status"] = "sent"
    history = [{"action": "proposal", "actor": actor, "at": now, "template": payload.template, "subject": subject, "to": doc["email"]}]
    sets: dict = {"updated_at": now}
    if doc.get("stage") in PROPOSAL_STAGE_BEFORE:
        sets["stage"] = "PROPOSAL_SENT"
        history.append({"action": "stage", "actor": actor, "at": now, "from": doc.get("stage"), "to": "PROPOSAL_SENT"})
    await _col.update_one({"_id": eid}, {"$set": sets, "$push": {"proposals": record, "history": {"$each": history}}})
    return _public(await _col.find_one({"_id": eid}))
