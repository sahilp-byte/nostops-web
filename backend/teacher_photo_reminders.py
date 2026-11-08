"""One-time "add your profile photo" email for publicly listed teachers who have no photo yet.

The website's admin BFF builds the recipient list from the main backend (publicly listed teachers with no
photo, plus their email from the admin teacher roster — only an admin session can read those). This
service sends each teacher the email ONCE, ever: the send is claimed in Mongo first, so a double click or
two admins never double-send, and only a FAILED send (or one stuck mid-send for over an hour) is retried.
On a preview pod real teachers are skipped — only test addresses reach the test outbox.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import test_tag
import venues
import venue_growth as vg
from email_util import send_email

router = APIRouter(prefix="/api/teacher-photo-reminder", tags=["teacher-photo-reminder"])
db = venues.db
log = logging.getLogger("teacher_photo_reminders")
MEDIA_PATH = "/app/teacher/profile/media"
PARALLEL_SENDS = 4


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def build_email(name: str, base: str) -> tuple[str, str]:
    who = escape(str(name or "").strip()[:80] or "there")
    link = escape(f"{vg._allowed_base(base or '')}{MEDIA_PATH}")
    li = 'style="margin:0 0 8px"'
    subject = "Add a profile photo to your NOSTOPS teacher profile"
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.6">'
        f'<p style="font-size:16px">Namaste {who},</p>'
        '<p>Your teacher profile is listed on NOSTOPS — thank you for being part of the cooperative.</p>'
        '<p>It does not have a photo yet. A warm, friendly photo is the first thing learners and organisations look for, '
        'and teachers with a photo are shown first on the NOSTOPS homepage.</p>'
        '<p style="margin:16px 0 6px;font-weight:bold">It takes about a minute:</p>'
        f'<ol style="padding-left:20px;margin:0 0 12px"><li {li}>Sign in to NOSTOPS.</li>'
        f'<li {li}>Open “Photo &amp; video” in your profile.</li>'
        f'<li {li}>Upload a clear, friendly photo of yourself.</li></ol>'
        f'<p style="margin:24px 0"><a href="{link}" style="background:#0f766e;color:#ffffff;padding:12px 22px;'
        'border-radius:10px;text-decoration:none;font-weight:bold">Add your photo</a></p>'
        '<p style="font-size:13px;color:#6b7280">This is the only photo reminder we will send.</p>'
        '<p style="font-size:12px;color:#9ca3af;margin-top:24px">We never ask for your password or payment details by email.</p>'
        '</td></tr></table>'
    )
    return subject, html


def _retryable() -> dict:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).replace(microsecond=0).isoformat()
    return {"$or": [{"status": "failed"}, {"status": "sending", "at": {"$lt": cutoff}}]}


class StatusIn(BaseModel):
    teacher_ids: list[str] = Field(default_factory=list, max_length=5000)


class Recipient(BaseModel):
    teacher_id: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=160)
    email: str = Field(min_length=3, max_length=200)


class RunIn(BaseModel):
    recipients: list[Recipient] = Field(default_factory=list, max_length=5000)
    base: str = Field(default="", max_length=200)


class TestIn(BaseModel):
    to: str = Field(min_length=3, max_length=200)
    name: str = Field(default="", max_length=160)
    base: str = Field(default="", max_length=200)


async def _send_one(r: Recipient, base: str) -> str:
    now = _now()
    try:
        await db.teacher_photo_reminders.insert_one({"_id": r.teacher_id, "status": "sending", "at": now})
    except DuplicateKeyError:  # one email per teacher, ever — only a failed/stuck one may be retried
        res = await db.teacher_photo_reminders.update_one({"_id": r.teacher_id, **_retryable()},
                                                          {"$set": {"status": "sending", "at": now}})
        if not res.modified_count:
            return "already"
    subject, html = build_email(r.name, base)
    try:
        await send_email(to=r.email, subject=subject, html=html)
        status = "sent"
    except Exception:  # noqa: BLE001 — recorded; a later run retries it
        status = "failed"
    await db.teacher_photo_reminders.update_one({"_id": r.teacher_id}, {"$set": {"status": status, "at": _now()}})
    return status


@router.post("/admin/status")
async def admin_status(payload: StatusIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    ids = list(dict.fromkeys(str(i)[:80] for i in payload.teacher_ids))
    states = {d["_id"]: {"status": d.get("status"), "at": d.get("at")}
              async for d in db.teacher_photo_reminders.find({"_id": {"$in": ids}})}
    runs = [r async for r in db.teacher_photo_reminder_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(5)]
    return {"states": states, "runs": runs, "preview": test_tag.environment_allows()}


@router.get("/admin/preview")
async def admin_preview(name: str = Query(default="", max_length=160), base: str = Query(default="", max_length=200),
                        x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    subject, html = build_email(name, base)
    return {"subject": subject, "html": html}


@router.post("/admin/test")
async def admin_test(payload: TestIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    subject, html = build_email(payload.name, payload.base)
    try:
        await send_email(to=payload.to, subject=f"[Test] {subject}", html=html)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not send the test email.")
    return {"status": "sent", "to": payload.to}


@router.post("/admin/run")
async def admin_run(payload: RunIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    vg._check_secret(x_pulse_secret)
    started = _now()
    tally = {"sent": 0, "failed": 0, "already": 0, "preview_skipped": 0}
    todo, seen = [], set()
    for r in payload.recipients:
        if r.teacher_id in seen:
            continue
        seen.add(r.teacher_id)
        # On a preview pod only TEST addresses are emailed (held in the test outbox) — never a real teacher.
        if test_tag.environment_allows() and not test_tag.test_address_reason(r.email):
            tally["preview_skipped"] += 1
            continue
        todo.append(r)
    gate = asyncio.Semaphore(PARALLEL_SENDS)

    async def one(r: Recipient) -> str:
        async with gate:
            return await _send_one(r, payload.base)

    for status in await asyncio.gather(*(one(r) for r in todo)):
        tally[status] += 1
    run = {"started_at": started, "finished_at": _now(), **tally}
    await db.teacher_photo_reminder_runs.insert_one({"_id": f"run|{started}|{uuid.uuid4().hex[:6]}", **run})
    if tally["sent"] or tally["failed"]:
        log.info("teacher photo reminders: %s", tally)
    return run
