"""NOSTOPS Daily Digest — one morning email (08:00 India time) to the team inbox.

Triggered by the Emergent webhook-cron (/app/.emergent/crons.yml →
POST /api/jobs/daily-digest, Bearer WEBHOOK_CRON_SECRET). Summarises the
previous India-time calendar day:
  · new organisation enquiries received yesterday
  · enquiries still in NEW (no reply) for more than 2 working days
  · errors seen yesterday + errors still open from earlier, grouped by type
Sends ONLY when at least one of those lists is non-empty. Idempotent per day
(`digest_runs`, _id = the India date being summarised). Scheduled calls that
arrive on the preview host are skipped so only the live site emails the team.
"""
import html
import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request

from institutional import require_cron
from monitoring import ALERT_TO, KINDS, SITE, _db, _events, record
from org_enquiries import COHORTS, PARTICIPANTS, _col as _enquiries

IST = timezone(timedelta(hours=5, minutes=30))
REPLY_WORKING_DAYS = 2
MAX_ROWS = 15
log = logging.getLogger("digest")
_runs = _db["digest_runs"]

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _working_days_between(start: date, end: date) -> int:
    """Mon–Fri days strictly after `start` and strictly before `end`."""
    n, d = 0, start + timedelta(days=1)
    while d < end:
        n += d.weekday() < 5
        d += timedelta(days=1)
    return n


def _ist_date(iso: str) -> date:
    return datetime.fromisoformat(iso).astimezone(IST).date()


def _fmt(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(IST).strftime("%d %b, %H:%M IST")


async def build_digest(today: date) -> dict:
    """Collect everything for the digest covering the India day before `today`."""
    day = today - timedelta(days=1)
    start = datetime(day.year, day.month, day.day, tzinfo=IST).astimezone(timezone.utc).isoformat()
    end = datetime(today.year, today.month, today.day, tzinfo=IST).astimezone(timezone.utc).isoformat()

    new_enq = [d async for d in _enquiries.find({"created_at": {"$gte": start, "$lt": end}}).sort("created_at", 1)]
    waiting = []
    async for d in _enquiries.find({"stage": "NEW", "created_at": {"$lt": start}}).sort("created_at", 1):
        days = _working_days_between(_ist_date(d["created_at"]), today)
        if days >= REPLY_WORKING_DAYS:  # the full reply window has passed
            waiting.append({**d, "_waiting": days})

    errors = {k: [] for k in KINDS}
    q = {"$or": [{"last_at": {"$gte": start, "$lt": end}}, {"status": "open", "last_at": {"$lt": start}}]}
    async for e in _events.find(q, {"samples": 0}).sort("last_at", -1):
        e["_new"] = start <= (e.get("first_at") or "") < end
        e["_yesterday"] = start <= (e.get("last_at") or "") < end
        errors.get(e.get("kind"), errors["server"]).append(e)

    return {"day": day, "new": new_enq, "waiting": waiting, "errors": errors}


def _table(head: list[str], rows: list[list[str]]) -> str:
    th = "".join(f"<th style='text-align:left;padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px'>{h}</th>" for h in head)
    trs = "".join(
        "<tr>" + "".join(f"<td style='padding:6px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top'>{c}</td>" for c in r) + "</tr>"
        for r in rows
    )
    return f"<table style='border-collapse:collapse;font-size:13px;width:100%'><tr>{th}</tr>{trs}</table>"


def _section(title: str, body: str) -> str:
    return f"<h3 style='margin:22px 0 8px;font-size:15px'>{html.escape(title)}</h3>{body}"


def _more(n: int) -> str:
    return f"<p style='margin:6px 0 0;color:#6b7280;font-size:12px'>…and {n} more.</p>" if n > 0 else ""


def _enq_link(d: dict) -> str:
    href = html.escape(f"{SITE}/app/admin/org-enquiries/{d['_id']}")
    return f"<a href='{href}' style='color:#0f766e;font-weight:700'>{html.escape(d['ref'])}</a>"


def render_digest(data: dict) -> tuple[str, str]:
    new, waiting, errors = data["new"], data["waiting"], data["errors"]
    n_err = sum(len(v) for v in errors.values())
    day_label = data["day"].strftime("%a %d %b %Y")

    parts = []
    if new:
        rows = [[_enq_link(d), html.escape(d["organisation_name"]), html.escape(COHORTS.get(d["cohort"], d["cohort"])),
                 html.escape(d["city"]), html.escape(PARTICIPANTS.get(d["participants"], d["participants"])), _fmt(d["created_at"])]
                for d in new[:MAX_ROWS]]
        parts.append(_section(f"New enquiries ({len(new)})", _table(["Ref", "Organisation", "Type", "City", "Participants", "Received"], rows) + _more(len(new) - MAX_ROWS)))
    if waiting:
        rows = [[_enq_link(d), html.escape(d["organisation_name"]), _fmt(d["created_at"]), f"<strong style='color:#b91c1c'>{d['_waiting']} working days</strong>"]
                for d in waiting[:MAX_ROWS]]
        parts.append(_section(f"Waiting for a reply for more than {REPLY_WORKING_DAYS} working days ({len(waiting)})",
                              _table(["Ref", "Organisation", "Received", "Waiting"], rows) + _more(len(waiting) - MAX_ROWS)))
    for kind, items in errors.items():
        if not items:
            continue
        rows = []
        for e in items[:MAX_ROWS]:
            tag = "New" if e["_new"] else ("Again yesterday" if e["_yesterday"] else "Still open")
            rows.append([html.escape(tag), html.escape(e.get("message") or "—"), f"<code>{html.escape(e.get('path') or e.get('source') or '—')}</code>",
                         f"×{int(e.get('count') or 1)}", html.escape("Resolved" if e.get("status") == "resolved" else "Open")])
        parts.append(_section(f"{KINDS[kind]}s ({len(items)})", _table(["", "What happened", "Where", "Times", "Status"], rows) + _more(len(items) - MAX_ROWS)))

    summary = " · ".join(
        s for s in (
            f"{len(new)} new enquir{'y' if len(new) == 1 else 'ies'}" if new else "",
            f"{len(waiting)} awaiting reply" if waiting else "",
            f"{n_err} error{'' if n_err == 1 else 's'}" if n_err else "",
        ) if s
    )
    links = (
        f"<p style='margin:24px 0 0'><a href='{html.escape(SITE + '/app/admin/org-enquiries')}' style='color:#0f766e;font-weight:700'>Open Org Enquiries &rarr;</a>"
        f" &nbsp;·&nbsp; <a href='{html.escape(SITE + '/app/admin/error-monitor')}' style='color:#0f766e;font-weight:700'>Open the Error Monitor &rarr;</a></p>"
    )
    body = (
        "<div style='font-family:system-ui,sans-serif;color:#111827;max-width:720px'>"
        f"<h2 style='margin:0 0 4px'>NOSTOPS daily digest</h2>"
        f"<p style='margin:0;color:#374151'>{html.escape(day_label)} (India time) · {html.escape(summary)}</p>"
        + "".join(parts) + links +
        "<p style='margin:16px 0 0;color:#9ca3af;font-size:12px'>Sent every morning at 8:00 AM India time, only when there is something to report.</p>"
        "</div>"
    )
    return f"[NOSTOPS digest] {day_label} · {summary}", body


def _is_preview(request: Request) -> bool:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").lower()
    return "preview.emergentagent.com" in host


@router.post("/daily-digest")
async def daily_digest(request: Request, _: bool = Depends(require_cron)) -> dict:
    if _is_preview(request):
        return {"ok": True, "status": "skipped_preview"}
    today = datetime.now(IST).date()
    key = (today - timedelta(days=1)).isoformat()
    prev = await _runs.find_one({"_id": key})
    if prev and prev.get("status") in ("sent", "quiet", "sending"):
        return {"ok": True, "status": "already_done", "day": key}

    data = await build_digest(today)
    if not (data["new"] or data["waiting"] or any(data["errors"].values())):
        await _runs.update_one({"_id": key}, {"$set": {"status": "quiet", "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        return {"ok": True, "status": "quiet", "day": key}

    await _runs.update_one({"_id": key}, {"$set": {"status": "sending", "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    subject, body = render_digest(data)
    try:
        from email_util import send_email

        await send_email(to=ALERT_TO, subject=subject, html=body)
        status = "sent"
    except Exception as exc:  # noqa: BLE001 — record + surface in the Error Monitor
        status = "failed"
        log.warning("daily digest send failed: %s", getattr(exc, "detail", exc))
        await record("email", "digest", f"Daily digest not sent: {str(getattr(exc, 'detail', exc))[:200]}", path="daily-digest")
    counts = {"new": len(data["new"]), "waiting": len(data["waiting"]), "errors": sum(len(v) for v in data["errors"].values())}
    await _runs.update_one({"_id": key}, {"$set": {"status": status, "counts": counts, "subject": subject}})
    return {"ok": status == "sent", "status": status, "day": key, "counts": counts}
