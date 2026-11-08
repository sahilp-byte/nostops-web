"""Venue Partner Growth — admin overview, printable A4 posters and the monthly activity email.

  * Overview (admin only, via the website BFF): every venue with a toolkit, its widget status, partner
    badge, invitation counts and monthly-email status. Anonymous counts only.
  * Posters: four A4 PDFs per venue — "for yoga teachers" and "for guests", each in English or Hindi
    (Hind font, HarfBuzz-shaped) — with the venue's stable QR code (/v/{code}). Styled by the central
    widget configuration (brand + colours). Until the venue is published the posters never claim a listing.
  * Monthly email: on the 1st of each month (09:00 IST) the previous month's activity goes to owners
    whose NOSTOPS widget is live on THEIR OWN website (domain of the listed website). One email per
    venue per month (claimed in Mongo before sending, so restarts/replicas never double-send). One-click
    opt-out link; opted-out venues are skipped. The automatic run is OFF on a preview pod — admins can
    still preview, test-send to themselves, or trigger the run by hand.
  * Widget install reminder: ONE gentle email per venue, ever, 14 days after it is published if its widget
    still isn't live (venues already listed longer get theirs on the first run). Owners with a website get
    the widget version; owners without one get a "share on WhatsApp / print your posters" version. Same
    opt-out as the monthly email; automatic sends only 09:00–20:00 IST and never on a preview pod.
"""
import asyncio
import base64
import hashlib
import hmac
import io
import logging
import re
from datetime import datetime, timedelta
from html import escape
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import test_tag
import venues
import venue_growth as vg
from email_util import send_email

router = APIRouter(prefix="/api/venue-growth", tags=["venue-growth"])
db = venues.db
log = logging.getLogger("venue_growth_partners")

IST = ZoneInfo("Asia/Kolkata")
COUNT_KINDS = tuple(k for k in vg.EVENT_KINDS if k != "widget_load")
COUNT_LABELS = {
    "invite_visit": "Invitation visits",
    "profile_view": "Profile views",
    "register_start": "Teachers who opened sign-up",
    "register_complete": "New teachers who joined",
    "existing_signin": "Existing NOSTOPS teachers",
    "profile_complete": "Teacher profiles completed",
}
AUDIENCES = ("teachers", "guests")
SEND_HOUR_IST = 9
PROD_BASE = "https://www.nostops.org"


# ── Months (IST) ────────────────────────────────────────────────────────────
def _month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def _prev_month_key(now: Optional[datetime] = None) -> str:
    now = now or datetime.now(IST)
    return _month_key(now.replace(day=1) - timedelta(days=1))


def _month_bounds(key: str) -> tuple[int, int]:
    y, m = (int(x) for x in key.split("-"))
    start = datetime(y, m, 1, tzinfo=IST)
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=IST)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def _month_label(key: str) -> str:
    y, m = (int(x) for x in key.split("-"))
    return datetime(y, m, 1).strftime("%B %Y")


def _valid_month(key: str) -> str:
    try:
        y, m = (int(x) for x in key.split("-"))
        if 2024 <= y <= 2100 and 1 <= m <= 12:
            return f"{y:04d}-{m:02d}"
    except (ValueError, AttributeError):
        pass
    raise HTTPException(status_code=422, detail="month: YYYY-MM")


def _next_auto_run(now: Optional[datetime] = None) -> str:
    now = now or datetime.now(IST)
    first = now.replace(day=1, hour=SEND_HOUR_IST, minute=0, second=0, microsecond=0)
    if now >= first:
        first = (first + timedelta(days=32)).replace(day=1)
    return first.isoformat()


# ── Counts ──────────────────────────────────────────────────────────────────
async def _counts_by_code(codes: list, since_ms: Optional[int] = None, until_ms: Optional[int] = None) -> dict:
    out = {c: {k: 0 for k in COUNT_KINDS} for c in codes}
    if not codes:
        return out
    match: dict = {"code": {"$in": codes}, "kind": {"$in": list(COUNT_KINDS)}}
    if since_ms is not None:
        match["at"] = {"$gte": since_ms, "$lt": until_ms}
    async for r in db.venue_growth_events.aggregate([{"$match": match},
                                                     {"$group": {"_id": {"c": "$code", "k": "$kind"}, "n": {"$sum": 1}}}]):
        out[r["_id"]["c"]][r["_id"]["k"]] = r["n"]
    return out


# ── Email preference token (no expiry; its own key) ─────────────────────────
def _pref_key() -> bytes:
    return hashlib.sha256(f"{venues.SECRET}|venue-growth-monthly-pref-v1".encode()).digest()


def make_pref_token(sid: str) -> str:
    b = base64.urlsafe_b64encode(f"pref|{sid}".encode()).decode().rstrip("=")
    return f"{b}.{hmac.new(_pref_key(), b.encode(), hashlib.sha256).hexdigest()[:32]}"


def verify_pref_token(token: str) -> Optional[str]:
    if not venues.SECRET or not token or "." not in token or len(token) > 400:
        return None
    b, _, sig = token.partition(".")
    if not hmac.compare_digest(sig, hmac.new(_pref_key(), b.encode(), hashlib.sha256).hexdigest()[:32]):
        return None
    try:
        kind, sid = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)).decode().split("|", 1)
        return sid if kind == "pref" else None
    except Exception:
        return None


def _retryable() -> dict:
    """A send that FAILED, or one stuck at 'sending' for over an hour (server died mid-send), may be retried."""
    cutoff = (datetime.now(IST) - timedelta(hours=1)).astimezone(ZoneInfo("UTC")).isoformat()
    return {"$or": [{"status": "failed"}, {"status": "sending", "at": {"$lt": cutoff}}]}


def _preview_real_address(doc: dict) -> bool:
    """On a preview pod, bulk runs only email TEST addresses (held in the test outbox) — never a real owner."""
    return test_tag.environment_allows() and not test_tag.test_address_reason(doc.get("submitter_email"))


def _not_eligible(doc: dict) -> Optional[str]:
    """Why this venue does NOT get the monthly email (None = it does)."""
    if doc.get("status") not in vg._STATUS:
        return "closed"
    if not doc.get("submitter_email"):
        return "no_email"
    if doc.get("growth_monthly_optout"):
        return "opted_out"
    if not vg.widget_on_own_site(doc):
        return "no_widget"
    return None


def _email_base(base: str = "") -> str:
    if base:
        return vg._allowed_base(base)
    if test_tag.environment_allows():
        import os
        return vg._allowed_base(os.environ.get("APP_URL", "") or os.environ.get("WEB_APP_BASE_URL", ""))
    return PROD_BASE


def build_monthly_email(doc: dict, month: str, month_counts: dict, total_counts: dict, base: str) -> tuple[str, str]:
    name = escape(str(doc.get("name") or "your venue")[:120])
    label = _month_label(month)
    b = base.rstrip("/")
    kit = f"{b}/venues/submit/thank-you?k={vg.make_kit_token(doc['_id'])}"
    pref = f"{b}/venues/submit/email-preferences?t={make_pref_token(doc['_id'])}"
    host = escape(str(doc.get("growth_widget_host") or "your website"))
    rows = "".join(
        f'<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">{COUNT_LABELS[k]}</td>'
        f'<td style="padding:8px 0;border-bottom:1px solid #eee;font-size:16px;font-weight:bold;text-align:right;color:#0f766e">{int(month_counts.get(k, 0))}</td></tr>'
        for k in COUNT_KINDS)
    quiet = sum(int(month_counts.get(k, 0)) for k in COUNT_KINDS) == 0

    def n(k: str, one: str, many: str) -> str:
        v = int(total_counts.get(k, 0))
        return f"{v} {one if v == 1 else many}"

    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937">'
        '<p style="font-size:16px">Namaste,</p>'
        f'<p>Here is what your NOSTOPS invitations did for <strong>{name}</strong> in {label}.</p>'
        f'<table role="presentation" width="100%" style="max-width:480px;border-collapse:collapse;margin:12px 0">{rows}</table>'
        f'<p style="font-size:13px;color:#6b7280;margin:0 0 16px">Since you started: {n("invite_visit", "invitation visit", "invitation visits")} · '
        f'{n("register_complete", "new teacher", "new teachers")} · {n("existing_signin", "existing teacher", "existing teachers")}.</p>'
        + ('<p style="font-size:14px">A quiet month. Sharing your invitation on WhatsApp or placing your printable poster at reception '
           'helps more yoga teachers find you.</p>' if quiet else '')
        + f'<p style="font-size:14px">Your NOSTOPS widget is live on {host}. Thank you for being a NOSTOPS Partner.</p>'
        f'<p style="margin:24px 0"><a href="{escape(kit)}" style="background:#0f766e;color:#ffffff;padding:12px 22px;'
        'border-radius:10px;text-decoration:none;font-weight:bold">Open your venue toolkit</a></p>'
        '<p style="font-size:13px;color:#6b7280">Your toolkit has your invitation note, WhatsApp message, QR code and printable posters '
        'for teachers and guests.</p>'
        '<p style="font-size:12px;color:#9ca3af;margin-top:24px">You receive this monthly summary because the NOSTOPS widget is on your '
        f'website. <a href="{escape(pref)}" style="color:#9ca3af">Stop NOSTOPS partner emails</a>. Counts are anonymous. '
        'We never ask for your password or payment details by email.</p>'
        '</td></tr></table>'
    )
    return f"Your NOSTOPS invitation activity — {label}", html


async def _email_parts(doc: dict, month: str, base: str) -> tuple[str, str]:
    code = doc.get("growth_code") or ""
    s, e = _month_bounds(month)
    m = (await _counts_by_code([code], s, e))[code] if code else {k: 0 for k in COUNT_KINDS}
    t = (await _counts_by_code([code]))[code] if code else {k: 0 for k in COUNT_KINDS}
    return build_monthly_email(doc, month, m, t, base)


async def _send_one(doc: dict, month: str, base: str, trigger: str) -> str:
    key = f"{month}|{doc['_id']}"
    now = venues._now_iso()
    try:
        await db.venue_growth_monthly_sends.insert_one({"_id": key, "month": month, "venue_id": doc["_id"],
                                                        "status": "sending", "trigger": trigger, "at": now})
    except DuplicateKeyError:  # already sent (or in flight) — only a FAILED send may be retried
        r = await db.venue_growth_monthly_sends.update_one({"_id": key, **_retryable()},
                                                           {"$set": {"status": "sending", "trigger": trigger, "at": now}})
        if not r.modified_count:
            return "already"
    subject, html = await _email_parts(doc, month, base)
    try:
        await send_email(to=doc["submitter_email"], subject=subject, html=html)
        status = "sent"
    except Exception:  # noqa: BLE001 — recorded; a later manual run retries it
        status = "failed"
    await db.venue_growth_monthly_sends.update_one({"_id": key}, {"$set": {"status": status, "at": venues._now_iso()}})
    return status


async def run_monthly(month: str, base: str, trigger: str) -> dict:
    started = venues._now_iso()
    tally = {"sent": 0, "failed": 0, "already": 0, "skipped": 0, "preview_skipped": 0}
    cursor = db.venue_submissions.find({"status": {"$in": list(vg._STATUS)}, "growth_widget_host": {"$exists": True}})
    async for doc in cursor:
        if _not_eligible(doc):
            tally["skipped"] += 1
            continue
        if _preview_real_address(doc):
            tally["preview_skipped"] += 1
            continue
        tally[await _send_one(doc, month, base, trigger)] += 1
    total_sent = await db.venue_growth_monthly_sends.count_documents({"month": month, "status": "sent"})
    run = {"month": month, "trigger": trigger, "started_at": started, "finished_at": venues._now_iso(), **tally,
           "total_sent": total_sent}
    await db.venue_growth_monthly_runs.insert_one({"_id": f"run|{month}|{started}", "kind": "run", **run})
    log.info("venue monthly email %s (%s): %s", month, trigger, tally)
    return run


async def maybe_auto_run(now: Optional[datetime] = None) -> str:
    """Called every 30 minutes. From the 1st at 09:00 IST (catching up until the 7th) send last month's
    summaries. The month is claimed in Mongo first (so replicas never double-send); a run that crashed or
    had failed sends is picked up again after 2 hours (per-venue sends are idempotent). Never on a
    preview pod (manual runs only there)."""
    if test_tag.environment_allows():
        return "preview"
    now = now or datetime.now(IST)
    if now.day > 7 or (now.day == 1 and now.hour < SEND_HOUR_IST):
        return "not_due"
    month, ts = _prev_month_key(now), int(now.timestamp() * 1000)
    cid = f"auto|{month}"
    try:
        await db.venue_growth_monthly_runs.insert_one({"_id": cid, "kind": "claim", "status": "running", "at_ms": ts})
    except DuplicateKeyError:
        claim = await db.venue_growth_monthly_runs.find_one({"_id": cid}) or {}
        if claim.get("status") == "done" or ts - int(claim.get("at_ms") or 0) < 2 * 60 * 60 * 1000:
            return "done" if claim.get("status") == "done" else "in_progress"
        took = await db.venue_growth_monthly_runs.update_one({"_id": cid, "at_ms": claim.get("at_ms")},
                                                             {"$set": {"status": "running", "at_ms": ts}})
        if not took.modified_count:
            return "in_progress"
    run = await run_monthly(month, PROD_BASE, "auto")
    await db.venue_growth_monthly_runs.update_one({"_id": cid}, {"$set": {"status": "partial" if run["failed"] else "done"}})
    return "ran"


# ── Widget install reminder (one per venue, ever) ───────────────────────────
REMINDER_AFTER_MS = 14 * 24 * 60 * 60 * 1000
REMINDER_HOURS_IST = range(9, 20)  # automatic sends only in Indian daytime


def _iso_ms(v) -> Optional[int]:
    try:
        return int(datetime.fromisoformat(str(v).replace("Z", "+00:00")).timestamp() * 1000)
    except (TypeError, ValueError):
        return None


def _published_at_ms(doc: dict) -> Optional[int]:
    """When the venue last went live (from its history; legacy records fall back to updated/created)."""
    for ev in reversed(doc.get("history") or []):
        if ev.get("to") == "published":
            return _iso_ms(ev.get("at"))
    return _iso_ms(doc.get("updated_at")) or _iso_ms(doc.get("created_at"))


def reminder_state(doc: dict, sent: Optional[dict], now_ms: Optional[int] = None) -> dict:
    """{state, due_at, variant}: state ∈ sent | due | waiting | widget_live | not_published | opted_out | no_email."""
    variant = "widget" if vg._host_of(vg._website(doc) or "") else "share"
    pub = _published_at_ms(doc)
    due = pub + REMINDER_AFTER_MS if pub else None
    if sent and sent.get("status") == "sent":
        state = "sent"
    elif doc.get("status") != "published":
        state = "not_published"
    elif vg.badge_eligible(doc):
        state = "widget_live"
    elif doc.get("growth_monthly_optout"):
        state = "opted_out"
    elif not doc.get("submitter_email"):
        state = "no_email"
    elif due and (now_ms or vg._now_ms()) < due:
        state = "waiting"
    else:
        state = "due"
    return {"state": state, "due_at": due, "variant": variant, "sent_at": (sent or {}).get("at") if state == "sent" else None}


def build_reminder_email(doc: dict, base: str, variant: str, now_ms: Optional[int] = None) -> tuple[str, str]:
    raw_name = str(doc.get("name") or "your venue")[:120]
    name = escape(raw_name)
    b = base.rstrip("/")
    kit = escape(f"{b}/venues/submit/thank-you?k={vg.make_kit_token(doc['_id'])}")
    pref = escape(f"{b}/venues/submit/email-preferences?t={make_pref_token(doc['_id'])}")
    pub = _published_at_ms(doc)
    fresh = pub and (now_ms or vg._now_ms()) - pub < 21 * 24 * 60 * 60 * 1000
    live = f"{name} has been live on NOSTOPS for two weeks" if fresh else f"{name} is live on NOSTOPS"
    li = 'style="margin:0 0 8px"'
    if variant == "widget":
        host = escape(vg._host_of(vg._website(doc) or "") or "your website")
        subject = f"A gentle idea for {raw_name}: add NOSTOPS to your website"
        body = (
            f'<p>{live} — thank you for being part of the cooperative.</p>'
            f'<p>Many yoga teachers look at a venue’s own website first. A small NOSTOPS widget on {host} invites them '
            'to explore your venue and create a free teacher profile.</p>'
            '<p style="margin:16px 0 6px;font-weight:bold">It takes two minutes:</p>'
            f'<ol style="padding-left:20px;margin:0 0 12px"><li {li}>Open your venue toolkit.</li>'
            f'<li {li}>Choose “Yoga Teacher Collaboration” and copy the embed code.</li>'
            f'<li {li}>Paste it into an “HTML” or “Embed” block on your website.</li></ol>'
            '<p>Once it is live, your listing gets the NOSTOPS Partner badge and you receive a short monthly summary of the '
            'teachers your invitations bring in.</p>'
        )
    else:
        subject = f"Help yoga teachers find {raw_name} on NOSTOPS"
        body = (
            f'<p>{live} — thank you for being part of the cooperative.</p>'
            '<p style="margin:16px 0 6px;font-weight:bold">A few free ways to invite yoga teachers:</p>'
            f'<ul style="padding-left:20px;margin:0 0 12px"><li {li}>Share your ready-made WhatsApp message with teachers and groups you know.</li>'
            f'<li {li}>Print your A4 posters for teachers and guests — in English or Hindi — for reception or your shala.</li>'
            f'<li {li}>Send your personalised invitation note as a PDF.</li></ul>'
            '<p>Have a website later? Your toolkit also has a small widget you can add to it.</p>'
        )
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.6">'
        '<p style="font-size:16px">Namaste,</p>' + body +
        f'<p style="margin:24px 0"><a href="{kit}" style="background:#0f766e;color:#ffffff;padding:12px 22px;'
        'border-radius:10px;text-decoration:none;font-weight:bold">Open your venue toolkit</a></p>'
        '<p style="font-size:13px;color:#6b7280">It is optional and free, and this is the only reminder we will send.</p>'
        f'<p style="font-size:12px;color:#9ca3af;margin-top:24px">Prefer no NOSTOPS partner emails? <a href="{pref}" style="color:#9ca3af">Turn them off</a>. '
        'We never ask for your password or payment details by email.</p>'
        '</td></tr></table>'
    )
    return subject, html


async def _send_reminder(doc: dict, base: str, variant: str, trigger: str) -> str:
    now = venues._now_iso()
    try:
        await db.venue_growth_reminders.insert_one({"_id": doc["_id"], "status": "sending", "variant": variant,
                                                    "trigger": trigger, "at": now})
    except DuplicateKeyError:  # one reminder per venue, ever — only a FAILED one may be retried
        r = await db.venue_growth_reminders.update_one({"_id": doc["_id"], **_retryable()},
                                                       {"$set": {"status": "sending", "trigger": trigger, "at": now}})
        if not r.modified_count:
            return "already"
    subject, html = build_reminder_email(doc, base, variant)
    try:
        await send_email(to=doc["submitter_email"], subject=subject, html=html)
        status = "sent"
    except Exception:  # noqa: BLE001 — recorded; a later run retries it
        status = "failed"
    await db.venue_growth_reminders.update_one({"_id": doc["_id"]}, {"$set": {"status": status, "at": venues._now_iso()}})
    return status


async def run_reminders(base: str, trigger: str) -> dict:
    """Send every DUE reminder (published ≥ 14 days, widget not live, not opted out, never reminded)."""
    started = venues._now_iso()
    sent_map = {s["_id"]: s async for s in db.venue_growth_reminders.find({})}
    tally = {"sent": 0, "failed": 0, "already": 0, "not_due": 0, "preview_skipped": 0}
    async for doc in db.venue_submissions.find({"status": "published"}):
        st = reminder_state(doc, sent_map.get(doc["_id"]))
        if st["state"] != "due":
            tally["not_due"] += 1
            continue
        if _preview_real_address(doc):
            tally["preview_skipped"] += 1
            continue
        tally[await _send_reminder(doc, base, st["variant"], trigger)] += 1
    run = {"trigger": trigger, "started_at": started, "finished_at": venues._now_iso(), **tally}
    if tally["sent"] or tally["failed"] or trigger != "auto":
        await db.venue_growth_monthly_runs.insert_one({"_id": f"reminder|{started}", "kind": "reminder_run", **run})
    if tally["sent"] or tally["failed"]:
        log.info("venue widget reminders (%s): %s", trigger, tally)
    return run


async def maybe_auto_reminders(now: Optional[datetime] = None) -> str:
    if test_tag.environment_allows():
        return "preview"
    now = now or datetime.now(IST)
    if now.hour not in REMINDER_HOURS_IST:
        return "night"
    await run_reminders(PROD_BASE, "auto")
    return "ran"


async def ensure_indexes() -> None:
    await db.venue_growth_events.create_index([("code", 1), ("kind", 1), ("at", 1)])
    await db.venue_growth_monthly_sends.create_index([("month", 1), ("status", 1)])
    await db.venue_growth_monthly_sends.create_index([("venue_id", 1), ("status", 1)])
    await db.venue_growth_monthly_runs.create_index([("kind", 1), ("started_at", -1)])
    await db.venue_submissions.create_index([("growth_code", 1)], sparse=True)
    await db.venue_submissions.create_index([("status", 1)])


async def auto_loop() -> None:
    try:
        await ensure_indexes()
    except Exception:  # noqa: BLE001
        log.exception("venue growth indexes")
    await asyncio.sleep(90)
    while True:
        try:
            await maybe_auto_run()
        except Exception:  # noqa: BLE001
            log.exception("venue monthly email loop")
        try:
            await maybe_auto_reminders()
        except Exception:  # noqa: BLE001
            log.exception("venue widget reminder loop")
        await asyncio.sleep(1800)


# ── Posters (A4 PDF, English or Hindi) ──────────────────────────────────────
LANGS = ("en", "hi")
_FONT_DIR = Path(__file__).parent / "fonts"
_HINDI_FONTS: dict = {}


def _hindi_fonts() -> tuple[str, str]:
    """Hind (OFL) covers Devanagari AND Latin, so venue names/URLs render in the same font.
    Text is shaped with HarfBuzz (uharfbuzz) so conjuncts and matras are correct."""
    if not _HINDI_FONTS:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        for key, file in (("regular", "Hind-Regular.ttf"), ("bold", "Hind-Bold.ttf")):
            name = f"Hind-{key}"
            pdfmetrics.registerFont(TTFont(name, str(_FONT_DIR / file)))
            _HINDI_FONTS[key] = name
    return _HINDI_FONTS["regular"], _HINDI_FONTS["bold"]


_DEVA = re.compile(r"[\u0900-\u097F]")


def _shaped(text: str, font: str, size: float):
    """Shape one line for a TTF font → (ShapedStr, true width), drawn with drawString (no bidi package).
    HarfBuzz guesses the script from a run's first letter, so each word containing Devanagari is shaped
    on its own (Devanagari never shapes across words) and Latin words (NOSTOPS, venue names, URLs) are
    left as plain text in the same font."""
    from reportlab.lib.abag import ABag
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfbase.ttfonts import shapeFragWord
    out, width = "", 0.0
    for part in re.split(r"(\s+)", text):
        if not part:
            continue
        if _DEVA.search(part):
            w = shapeFragWord([stringWidth(part, font, size), (ABag(fontName=font, fontSize=size), part)])
            out, width = out + w[1][1], width + w[0]
        else:
            out, width = out + part, width + stringWidth(part, font, size)
    return out, width


def poster_copy(name: str, published: bool, audience: str, brand: str, lang: str = "en") -> dict:
    if lang == "hi":
        tagline = "शिक्षक-प्रथम योग सहकारी संस्था"
        footer = (f"{brand} | www.nostops.org | {tagline}। "
                  "NOSTOPS पर सूचीबद्ध होना स्थल का सत्यापन या समर्थन नहीं है।")
        if audience == "teachers":
            return {"eyebrow": "योग शिक्षकों के लिए", "headline": "योग शिक्षक, अपना रिट्रीट यहाँ आयोजित करें",
                    "sub": f"{name} रिट्रीट, प्रशिक्षण और सहयोग के लिए योग शिक्षकों का स्वागत करता है।",
                    "scan": "NOSTOPS पर हमारा स्थल देखने के लिए स्कैन करें" if published
                    else "NOSTOPS पर स्थल खोजने के लिए स्कैन करें",
                    "extra": "अभी NOSTOPS पर नहीं हैं? अपनी निःशुल्क शिक्षक प्रोफ़ाइल बनाएँ:",
                    "tagline": tagline, "footer": footer}
        if published:
            return {"eyebrow": "NOSTOPS पर सूचीबद्ध", "headline": "हमें NOSTOPS पर खोजें",
                    "sub": f"{name} NOSTOPS पर सूचीबद्ध है, जो {tagline} है।",
                    "scan": "हमारी NOSTOPS स्थल प्रोफ़ाइल देखने के लिए स्कैन करें", "extra": None,
                    "tagline": tagline, "footer": footer}
        return {"eyebrow": brand, "headline": "हम NOSTOPS से जुड़ रहे हैं",
                "sub": f"{name} NOSTOPS से जुड़ रहा है, जो {tagline} है।",
                "scan": "NOSTOPS के बारे में जानने के लिए स्कैन करें", "extra": None,
                "tagline": tagline, "footer": footer}
    footer = ("NOSTOPS · www.nostops.org · A teacher-first yoga cooperative. "
              "Listing on NOSTOPS is not a verification or endorsement of the venue.")
    if audience == "teachers":
        return {"eyebrow": "FOR YOGA TEACHERS", "headline": "Yoga teachers, host your retreat here",
                "sub": f"{name} welcomes yoga teachers for retreats, trainings and collaborations.",
                "scan": "Scan to explore our venue on NOSTOPS" if published else "Scan to discover venues on NOSTOPS",
                "extra": "Not on NOSTOPS yet? Create your free teacher profile:", "tagline": None, "footer": footer}
    if published:
        return {"eyebrow": f"LISTED ON {brand.upper()}", "headline": f"Find us on {brand}",
                "sub": f"{name} is listed on NOSTOPS, a teacher-first yoga cooperative.",
                "scan": "Scan to see our NOSTOPS venue profile", "extra": None, "tagline": None, "footer": footer}
    return {"eyebrow": brand.upper(), "headline": f"We're joining {brand}",
            "sub": f"{name} is joining NOSTOPS, a teacher-first yoga cooperative.",
            "scan": "Scan to discover NOSTOPS", "extra": None, "tagline": None, "footer": footer}


def build_poster_pdf(name: str, published: bool, audience: str, listing_url: str, join_url: str, cfg: dict,
                     lang: str = "en") -> bytes:
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import simpleSplit
    from reportlab.pdfgen import canvas

    W, H = A4
    hi = lang == "hi"
    regular, bold = _hindi_fonts() if hi else ("Helvetica", "Helvetica-Bold")
    col, brand = cfg["colors"], cfg["brand"]
    accent, ink, muted, bg = (colors.HexColor(col[k]) for k in ("accent", "text", "muted", "background"))
    copy = poster_copy(name, published, audience, brand["name"], lang)
    head_size, head_gap = (34, 50) if hi else (38, 44)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"{name} — NOSTOPS poster ({'yoga teachers' if audience == 'teachers' else 'guests'}, {lang})")
    c.setAuthor("NOSTOPS")

    def centred(y: float, text: str, font: str, size: float, color, **kw) -> None:
        c.setFillColor(color)
        c.setFont(font, size)
        if hi:
            s, w = _shaped(text, font, size)
            c.drawString(W / 2 - w / 2, y, s)
        else:
            c.drawCentredString(W / 2, y, text, **kw)

    c.setFillColor(bg)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(accent)
    c.rect(0, H - 64, W, 64, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, H - 40, brand["name"])
    c.setFont(regular, 10.5)
    if hi:
        s, w = _shaped(copy["tagline"], regular, 10.5)
        c.drawString(W - 40 - w, H - 38, s)
    else:
        c.drawRightString(W - 40, H - 38, brand["tagline"])

    y = H - 120
    centred(y, copy["eyebrow"], bold, 12, accent, **({} if hi else {"charSpace": 2}))
    y -= 46
    for ln in simpleSplit(copy["headline"], bold, head_size, W - 100)[:3]:
        centred(y, ln, bold, head_size, ink)
        y -= head_gap
    for ln in simpleSplit(copy["sub"], regular, 14, W - 140)[:3]:
        centred(y, ln, regular, 14, muted)
        y -= 22 if hi else 20

    qs, pad = 240, 18
    box = qs + pad * 2
    bx, by = (W - box) / 2, y - 16 - box
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.roundRect(bx, by, box, box, 16, stroke=1, fill=1)
    qr = QrCodeWidget(listing_url, barLevel="M")
    qr.barFillColor = colors.HexColor("#111827")
    x0, y0, x1, y1 = qr.getBounds()
    d = Drawing(qs, qs, transform=[qs / (x1 - x0), 0, 0, qs / (y1 - y0), 0, 0])
    d.add(qr)
    renderPDF.draw(d, c, bx + pad, by + pad)
    c.linkURL(listing_url, (bx, by, bx + box, by + box), relative=0)

    y = by - 30
    centred(y, copy["scan"], bold, 16, ink)
    y -= 20
    centred(y, listing_url.replace("https://", ""), regular, 11, accent)
    if copy["extra"]:
        y -= 44
        c.setFillColor(colors.white)
        c.roundRect(60, y - 22, W - 120, 52, 12, stroke=1, fill=1)
        centred(y + 10, copy["extra"], bold, 12.5, ink)
        centred(y - 8, join_url.replace("https://", ""), regular, 11, accent)
        c.linkURL(join_url, (60, y - 22, W - 60, y + 30), relative=0)
    centred(30, copy["footer"], regular, 8.5, muted)
    c.showPage()
    c.save()
    return buf.getvalue()


async def _poster_response(doc: dict, audience: str, base: str, inline: bool, lang: str = "en") -> Response:
    if audience not in AUDIENCES:
        raise HTTPException(status_code=422, detail="audience: teachers or guests")
    if lang not in LANGS:
        raise HTTPException(status_code=422, detail="lang: en or hi")
    code = await vg.ensure_code(doc["_id"])
    b = vg._allowed_base(base)
    name = str(doc.get("name") or ("हमारा स्थल" if lang == "hi" else "Our venue"))[:120]
    cfg = (await vg.current_config())["config"]
    pdf = build_poster_pdf(name, doc.get("status") == "published", audience, f"{b}/v/{code}", f"{b}/v/{code}/join", cfg, lang)
    slug = vg.re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "venue"
    disp = "inline" if inline else "attachment"
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disp}; filename="nostops-poster-{audience}-{lang}-{slug}.pdf"',
                             "Cache-Control": "no-store"})


@router.get("/poster.pdf")
async def owner_poster(token: str = Query(..., max_length=400), audience: str = Query("teachers", max_length=10),
                       lang: str = Query("en", max_length=2), base: str = Query(default="", max_length=200),
                       inline: bool = Query(default=False), x_pulse_secret: Optional[str] = Header(None)) -> Response:
    vg._check_secret(x_pulse_secret)
    return await _poster_response(await vg._kit_doc(token), audience, base, inline, lang)


async def _admin_doc(venue_id: str) -> dict:
    doc = await db.venue_submissions.find_one({"_id": venue_id})
    if not doc or doc.get("status") not in vg._STATUS:
        raise HTTPException(status_code=404, detail="Venue not found or closed.")
    return doc


@router.get("/admin/poster.pdf")
async def admin_poster(venue_id: str = Query(..., max_length=80), audience: str = Query("teachers", max_length=10),
                       lang: str = Query("en", max_length=2), base: str = Query(default="", max_length=200),
                       inline: bool = Query(default=False), x_pulse_secret: Optional[str] = Header(None)) -> Response:
    vg._check_secret(x_pulse_secret)
    return await _poster_response(await _admin_doc(venue_id), audience, base, inline, lang)


# ── Admin overview ──────────────────────────────────────────────────────────
_OVERVIEW_FIELDS = {"name": 1, "city": 1, "country": 1, "status": 1, "growth_code": 1, "growth_widget_host": 1,
                    "growth_widget_seen_at": 1, "growth_monthly_optout": 1, "website_or_maps_url": 1,
                    "submitter_email": 1, "updated_at": 1, "created_at": 1, "history": 1}


async def _monthly_status() -> dict:
    runs = await db.venue_growth_monthly_runs.find({"kind": "run"}, {"_id": 0, "kind": 0}).sort("started_at", -1).to_list(5)
    rruns = await db.venue_growth_monthly_runs.find({"kind": "reminder_run"}, {"_id": 0, "kind": 0}) \
        .sort("started_at", -1).to_list(5)
    return {"auto_enabled": not test_tag.environment_allows(), "next_auto_run": _next_auto_run(),
            "default_month": _prev_month_key(), "default_month_label": _month_label(_prev_month_key()), "runs": runs,
            "reminder_runs": rruns}


@router.get("/admin/overview")
async def admin_overview(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    docs = await db.venue_submissions.find({"status": {"$in": list(vg._STATUS)}}, _OVERVIEW_FIELDS) \
        .sort("updated_at", -1).to_list(1000)
    codes = [d["growth_code"] for d in docs if d.get("growth_code")]
    now = datetime.now(IST)
    ms, _ = _month_bounds(_month_key(now))
    total, month = await _counts_by_code(codes), await _counts_by_code(codes, ms, int(now.timestamp() * 1000) + 1)
    last_sent: dict = {}
    async for s in db.venue_growth_monthly_sends.find({"status": "sent"}, {"venue_id": 1, "month": 1}):
        last_sent[s["venue_id"]] = max(last_sent.get(s["venue_id"], ""), s["month"])
    reminders = {r["_id"]: r async for r in db.venue_growth_reminders.find({})}
    rows = []
    for d in docs:
        code = d.get("growth_code")
        key, label = vg._STATUS[d["status"]]
        seen = d.get("growth_widget_seen_at")
        site = vg._host_of(vg._website(d) or "")
        rows.append({
            "id": d["_id"], "name": d.get("name") or "Untitled venue", "city": d.get("city") or None,
            "country": d.get("country") or None, "status": key, "status_label": label, "code": code or None,
            "website_host": site or None,
            "widget": {"host": d.get("growth_widget_host") or None, "seen_at": int(seen) if seen else None,
                       "live": bool(seen) and vg._now_ms() - int(seen) <= vg.BADGE_WINDOW_MS,
                       "on_own_site": vg.widget_on_own_site(d)},
            "badge": vg.badge_eligible(d),
            "counts": total.get(code) if code else None,
            "month_counts": month.get(code) if code else None,
            "email": {"not_eligible": _not_eligible(d), "opted_out": bool(d.get("growth_monthly_optout")),
                      "last_sent": last_sent.get(d["_id"])},
            "reminder": reminder_state(d, reminders.get(d["_id"])),
        })
    return {"rows": rows, "month_label": _month_label(_month_key(now)), "monthly": await _monthly_status()}


@router.get("/admin/monthly/preview")
async def admin_monthly_preview(venue_id: str = Query(..., max_length=80), month: str = Query(default="", max_length=7),
                                base: str = Query(default="", max_length=200),
                                x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    doc = await _admin_doc(venue_id)
    m = _valid_month(month) if month else _prev_month_key()
    subject, html = await _email_parts(doc, m, _email_base(base))
    return {"subject": subject, "html": html, "month": m, "not_eligible": _not_eligible(doc)}


class TestSendIn(BaseModel):
    venue_id: str = Field(max_length=80)
    to: str = Field(max_length=200)  # the signed-in ADMIN's own address (set by the BFF, never the browser)
    base: str = Field(default="", max_length=200)


@router.post("/admin/monthly/test")
async def admin_monthly_test(payload: TestSendIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    doc = await _admin_doc(payload.venue_id)
    subject, html = await _email_parts(doc, _prev_month_key(), _email_base(payload.base))
    await send_email(to=payload.to, subject=f"[Test] {subject}", html=html)
    return {"ok": True, "to": payload.to}


class RunIn(BaseModel):
    month: str = Field(default="", max_length=7)
    base: str = Field(default="", max_length=200)

@router.get("/admin/reminder/preview")
async def admin_reminder_preview(venue_id: str = Query(..., max_length=80), base: str = Query(default="", max_length=200),
                                 x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    doc = await _admin_doc(venue_id)
    st = reminder_state(doc, await db.venue_growth_reminders.find_one({"_id": doc["_id"]}))
    subject, html = build_reminder_email(doc, _email_base(base), st["variant"])
    return {"subject": subject, "html": html, **st}


@router.post("/admin/reminder/test")
async def admin_reminder_test(payload: TestSendIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    doc = await _admin_doc(payload.venue_id)
    st = reminder_state(doc, None)
    subject, html = build_reminder_email(doc, _email_base(payload.base), st["variant"])
    await send_email(to=payload.to, subject=f"[Test] {subject}", html=html)
    return {"ok": True, "to": payload.to}


@router.post("/admin/reminder/run")
async def admin_reminder_run(payload: RunIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Send every due widget-install reminder now. Idempotent — each venue is reminded once, ever."""
    vg._check_secret(x_pulse_secret)
    return await run_reminders(_email_base(payload.base), "manual")




@router.post("/admin/monthly/run")
async def admin_monthly_run(payload: RunIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Send the month's summaries now (default: last month). Idempotent — venues already sent are skipped."""
    vg._check_secret(x_pulse_secret)
    m = _valid_month(payload.month) if payload.month else _prev_month_key()
    return await run_monthly(m, _email_base(payload.base), "manual")


# ── Owner email preference (opt-out link in the email, or the toolkit) ──────
async def _pref_doc(token: str, kind: str) -> dict:
    sid = verify_pref_token(token) if kind == "pref" else vg.verify_kit_token(token)
    doc = await db.venue_submissions.find_one({"_id": sid}) if sid else None
    if not doc:
        raise HTTPException(status_code=403, detail="This link is invalid or has expired.")
    return doc


@router.get("/monthly/preference")
async def get_preference(token: str = Query(..., max_length=400), kind: str = Query("pref", max_length=4),
                         x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    doc = await _pref_doc(token, kind)
    return {"name": str(doc.get("name") or "Your venue")[:120], "enabled": not doc.get("growth_monthly_optout"),
            "widget_on_own_site": vg.widget_on_own_site(doc)}


class PrefIn(BaseModel):
    token: str = Field(max_length=400)
    kind: str = Field(default="pref", max_length=4)
    enabled: bool


@router.post("/monthly/preference")
async def set_preference(payload: PrefIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    doc = await _pref_doc(payload.token, payload.kind)
    await db.venue_submissions.update_one({"_id": doc["_id"]}, {"$set": {"growth_monthly_optout": not payload.enabled,
                                                                       "growth_monthly_pref_at": venues._now_iso()}})
    return {"enabled": payload.enabled}
