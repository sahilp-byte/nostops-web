"""Finish-your-profile reminders for teachers who CLAIMED a provisional listing but are not live yet.

Up to three emails per claim — 2, 7 and 21 days after claiming, always in order and at least 3 days
apart. They stop as soon as the profile is finished (the claimer completes onboarding in the web app,
an admin records a later stage, or the listing graduates to a live profile), when the teacher turns
them off from the email, or after the third. Each step is claimed in Mongo before sending, so replicas
and double clicks never double-send; only a FAILED send (or one stuck mid-send for over an hour) is
retried. Automatic runs: every 30 minutes in Indian daytime, never on a preview pod — there, manual
runs only email test addresses (held in the test outbox).
"""
import asyncio
import base64
import hashlib
import hmac
import logging
import uuid
from datetime import datetime
from html import escape
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import discovery
import test_tag
import venues
import venue_growth as vg
from email_util import send_email

router = APIRouter(prefix="/api/claim-reminders", tags=["claim-reminders"])
db = venues.db
candidates = discovery.candidates
sends = db.claim_finish_reminders
runs = db.claim_finish_reminder_runs
log = logging.getLogger("claim_reminders")

IST = ZoneInfo("Asia/Kolkata")
DAY_MS = 86_400_000
STEP_DAYS = {1: 2, 2: 7, 3: 21}
MIN_GAP_MS = 3 * DAY_MS
STUCK_MS = 60 * 60 * 1000
HOURS_IST = range(9, 20)  # automatic sends only in Indian daytime
PROD_BASE = "https://www.nostops.org"
ONBOARD_PATH = "/app/teacher/onboarding"
PARALLEL_SENDS = 4

CLAIM_FILTER = {
    "claim_state": "CLAIMED",
    "status": "accepted",
    "admin_status": {"$nin": discovery.EXCLUDED_ADMIN},
    "$or": [{"verified_handle": {"$exists": False}}, {"verified_handle": None}, {"verified_handle": ""}],
}


def _now_ms() -> int:
    return int(datetime.now(IST).timestamp() * 1000)


# ── Stop link (signed, no account needed) ──────────────────────────────────
def _key() -> bytes:
    return hashlib.sha256(f"{venues.SECRET}|claim-finish-reminders-stop".encode()).digest()


def make_stop_token(cand_id: str) -> str:
    b = base64.urlsafe_b64encode(f"stop|{cand_id}".encode()).decode().rstrip("=")
    return f"{b}.{hmac.new(_key(), b.encode(), hashlib.sha256).hexdigest()[:32]}"


def verify_stop_token(token: str) -> Optional[str]:
    if not venues.SECRET or not token or "." not in token or len(token) > 400:
        return None
    b, _, sig = token.partition(".")
    if not hmac.compare_digest(sig, hmac.new(_key(), b.encode(), hashlib.sha256).hexdigest()[:32]):
        return None
    try:
        kind, cid = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)).decode().split("|", 1)
        return cid if kind == "stop" else None
    except Exception:  # noqa: BLE001
        return None


# ── State ──────────────────────────────────────────────────────────────────
def _email(c: dict) -> str:
    e = str(c.get("claimed_by_email") or "").strip().lower()
    return e if discovery._EMAIL_RE.match(e) else ""


def _finished(c: dict) -> bool:
    return bool(c.get("profile_completed_at") or c.get("verified_handle")
                or c.get("onboarding_stage") in discovery.ONBOARDING_STAGES)


def state_of(c: dict, sent: list, now: int) -> dict:
    """state ∈ finished | stopped | complete | no_email | waiting | due (+ next_step, due_at)."""
    ok = [s for s in sent if s.get("status") == "sent"]
    last_step = max((int(s["step"]) for s in ok), default=0)
    last_at = max((int(s.get("at_ms") or 0) for s in ok), default=0)
    out = {"sent": len(ok), "last_sent_at": last_at or None, "next_step": None, "due_at": None}
    if _finished(c):
        return {**out, "state": "finished"}
    if c.get("finish_reminders_optout"):
        return {**out, "state": "stopped"}
    if last_step >= 3:
        return {**out, "state": "complete"}
    if not _email(c):
        return {**out, "state": "no_email"}
    step = last_step + 1
    due = max(int(c.get("claimed_at") or 0) + STEP_DAYS[step] * DAY_MS, last_at + MIN_GAP_MS if last_at else 0)
    return {**out, "state": "due" if now >= due else "waiting", "next_step": step, "due_at": due}


async def _sent_map() -> dict:
    out: dict = {}
    async for s in sends.find({}):
        out.setdefault(s.get("cand_id"), []).append(s)
    return out


# ── Email ──────────────────────────────────────────────────────────────────
def build_email(c: dict, step: int, base: str) -> tuple[str, str]:
    raw_listing = str(c.get("name") or "your listing")[:120]
    listing = escape(raw_listing)
    place = ", ".join(x for x in (c.get("locality"), c.get("city")) if x)
    at = f" in {escape(place)}" if place else ""
    who = escape(str(c.get("claimed_by_name") or "").strip()[:80] or "there")
    b = vg._allowed_base(base or "")
    link = escape(f"{b}{ONBOARD_PATH}")
    stop = escape(f"{b}/claim/reminders?t={make_stop_token(str(c.get('_id') or 'sample'))}")
    subject = {
        1: f"Finish your NOSTOPS teacher profile — {raw_listing}",
        2: f"{raw_listing} is waiting for your teacher profile",
        3: f"Last reminder: finish your NOSTOPS profile for {raw_listing}",
    }[step]
    intro = {
        1: f"Thank you for claiming <strong>{listing}</strong>{at} on NOSTOPS. Your listing is reserved for you — "
           "the last step is your full teacher profile.",
        2: f"<strong>{listing}</strong>{at} is claimed in your name, but your teacher profile is not live yet. "
           "Learners and organisations can book you once it is.",
        3: f"This is our last reminder about <strong>{listing}</strong>{at}. Your claim stays safe — finish your "
           "profile whenever you are ready.",
    }[step]
    li = 'style="margin:0 0 6px"'
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.6">'
        f'<p style="font-size:16px">Namaste {who},</p>'
        f'<p>{intro}</p>'
        '<p style="margin:16px 0 6px;font-weight:bold">It is free and takes a few minutes. You will add:</p>'
        f'<ul style="padding-left:20px;margin:0 0 12px"><li {li}>Your parampara (lineage) and guru</li>'
        f'<li {li}>The yoga styles you teach</li><li {li}>A short bio in your own voice</li>'
        f'<li {li}>Your public teacher page</li></ul>'
        f'<p style="margin:24px 0"><a href="{link}" style="background:#0f766e;color:#ffffff;padding:12px 22px;'
        'border-radius:10px;text-decoration:none;font-weight:bold">Finish my profile</a></p>'
        f'<p style="font-size:13px;color:#6b7280">Reminder {step} of 3. We stop as soon as your profile is live.</p>'
        f'<p style="font-size:12px;color:#9ca3af;margin-top:24px">Prefer no more reminders? <a href="{stop}" style="color:#9ca3af">Stop them</a>. '
        'We never ask for your password or payment details by email.</p>'
        '</td></tr></table>'
    )
    return subject, html


SAMPLE = {"_id": "sample", "name": "Shanti Yoga Classes", "locality": "Kothrud", "city": "Pune",
          "claimed_by_name": "Asha"}


# ── Sending ────────────────────────────────────────────────────────────────
async def _send_step(c: dict, step: int, base: str, trigger: str) -> str:
    cid, now = str(c["_id"]), _now_ms()
    key = f"{cid}|{step}"
    try:
        await sends.insert_one({"_id": key, "cand_id": cid, "step": step, "status": "sending", "trigger": trigger, "at_ms": now})
    except DuplicateKeyError:  # each step once, ever — only a failed / stuck one is retried
        r = await sends.update_one(
            {"_id": key, "$or": [{"status": "failed"}, {"status": "sending", "at_ms": {"$lt": now - STUCK_MS}}]},
            {"$set": {"status": "sending", "trigger": trigger, "at_ms": now}})
        if not r.modified_count:
            return "already"
    subject, html = build_email(c, step, base)
    try:
        await send_email(to=_email(c), subject=subject, html=html)
        status = "sent"
    except Exception:  # noqa: BLE001 — recorded; a later run retries it
        status = "failed"
    await sends.update_one({"_id": key}, {"$set": {"status": status, "at_ms": _now_ms()}})
    return status


async def run_due(base: str, trigger: str) -> dict:
    started, now = _now_ms(), _now_ms()
    tally = {"sent": 0, "failed": 0, "already": 0, "not_due": 0, "preview_skipped": 0}
    sent = await _sent_map()
    todo = []
    async for c in candidates.find(CLAIM_FILTER):
        st = state_of(c, sent.get(str(c["_id"]), []), now)
        if st["state"] != "due":
            tally["not_due"] += 1
            continue
        # On a preview pod only TEST addresses are emailed (held in the test outbox) — never a real teacher.
        if test_tag.environment_allows() and not test_tag.test_address_reason(_email(c)):
            tally["preview_skipped"] += 1
            continue
        todo.append((c, st["next_step"]))
    gate = asyncio.Semaphore(PARALLEL_SENDS)

    async def one(c: dict, step: int) -> str:
        async with gate:
            return await _send_step(c, step, base, trigger)

    for status in await asyncio.gather(*(one(c, s) for c, s in todo)):
        tally[status] += 1
    run = {"trigger": trigger, "started_at": started, "finished_at": _now_ms(), **tally}
    if tally["sent"] or tally["failed"] or trigger != "auto":
        await runs.insert_one({"_id": f"run|{started}|{uuid.uuid4().hex[:6]}", **run})
    if tally["sent"] or tally["failed"]:
        log.info("claim finish reminders (%s): %s", trigger, tally)
    return run


async def maybe_auto_run(now: Optional[datetime] = None) -> str:
    if test_tag.environment_allows():
        return "preview"
    now = now or datetime.now(IST)
    if now.hour not in HOURS_IST:
        return "night"
    await run_due(PROD_BASE, "auto")
    return "ran"


async def auto_loop() -> None:
    try:
        await sends.create_index("cand_id")
        await runs.create_index([("started_at", -1)])
    except Exception:  # noqa: BLE001
        log.exception("claim reminder indexes")
    await asyncio.sleep(120)
    while True:
        try:
            await maybe_auto_run()
        except Exception:  # noqa: BLE001
            log.exception("claim reminder loop")
        await asyncio.sleep(1800)


# ── Admin ──────────────────────────────────────────────────────────────────
@router.get("/admin/overview")
async def admin_overview(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    now, sent = _now_ms(), await _sent_map()
    rows = []
    async for c in candidates.find(CLAIM_FILTER).sort("claimed_at", -1).limit(2000):
        st = state_of(c, sent.get(str(c["_id"]), []), now)
        rows.append({"id": str(c["_id"]), "name": c.get("name") or "", "locality": c.get("locality") or "",
                     "city": c.get("city") or "", "city_slug": c.get("city_slug"), "teacher_slug": c.get("teacher_slug"),
                     "claimed_at": c.get("claimed_at"), "claimer": c.get("claimed_by_name") or "",
                     "email": _email(c) or None, **st})
    recent = [r async for r in runs.find({}, {"_id": 0}).sort("started_at", -1).limit(5)]
    return {"rows": rows, "runs": recent, "preview": test_tag.environment_allows(),
            "auto_enabled": not test_tag.environment_allows(), "schedule_days": list(STEP_DAYS.values())}


async def _candidate(cand_id: str) -> dict:
    if not cand_id:
        return SAMPLE
    c = await candidates.find_one({"_id": cand_id, **CLAIM_FILTER})
    if not c:
        raise HTTPException(status_code=404, detail="Claimed listing not found.")
    return c


@router.get("/admin/preview")
async def admin_preview(step: int = Query(1, ge=1, le=3), candidate_id: str = Query("", max_length=80),
                        base: str = Query("", max_length=200), x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    subject, html = build_email(await _candidate(candidate_id), step, base)
    return {"subject": subject, "html": html}


class TestIn(BaseModel):
    to: str = Field(min_length=3, max_length=200)
    step: int = Field(default=1, ge=1, le=3)
    candidate_id: str = Field(default="", max_length=80)
    base: str = Field(default="", max_length=200)


@router.post("/admin/test")
async def admin_test(payload: TestIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    subject, html = build_email(await _candidate(payload.candidate_id), payload.step, payload.base)
    try:
        await send_email(to=payload.to, subject=f"[Test] {subject}", html=html)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not send the test email.")
    return {"status": "sent", "to": payload.to}


class RunIn(BaseModel):
    base: str = Field(default="", max_length=200)


@router.post("/admin/run")
async def admin_run(payload: RunIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    return await run_due(payload.base, "manual")


# ── Teacher: stop link ─────────────────────────────────────────────────────
@router.get("/stop-info")
async def stop_info(token: str = Query(..., max_length=400), x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    cid = verify_stop_token(token)
    c = await candidates.find_one({"_id": cid}) if cid else None
    if not c:
        raise HTTPException(status_code=404, detail="This link is invalid or has expired.")
    return {"name": c.get("name") or "", "stopped": bool(c.get("finish_reminders_optout"))}


class StopIn(BaseModel):
    token: str = Field(min_length=10, max_length=400)


@router.post("/stop")
async def stop(payload: StopIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    cid = verify_stop_token(payload.token)
    c = await candidates.find_one({"_id": cid}) if cid else None
    if not c:
        raise HTTPException(status_code=404, detail="This link is invalid or has expired.")
    await candidates.update_one({"_id": cid}, {"$set": {"finish_reminders_optout": True,
                                                         "finish_reminders_optout_at": _now_ms()}})
    return {"stopped": True, "name": c.get("name") or ""}
