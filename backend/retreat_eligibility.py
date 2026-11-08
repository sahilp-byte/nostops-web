"""Payments Prompt 2D — no seat or group hold once a retreat has started (gateway side).

The start is read from the retreat's own record (GET /retreats/{id} upstream), never from the
request. It is judged in the retreat's configured time zone (IANA `timezone` / `time_zone`);
NOSTOPS retreats are in India, so Asia/Kolkata when none is set. A date-only start means
midnight local time on that day. Missing / unreadable dates or zones → refused (fail closed).
"""
import posixpath
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, unquote
from zoneinfo import ZoneInfo

import httpx
from fastapi.responses import JSONResponse

DEFAULT_TZ = "Asia/Kolkata"
STARTED = "This retreat has already started, so seats can no longer be reserved. Nothing has been reserved."
DATES = "This retreat's dates couldn't be confirmed, so it can't be reserved right now. Nothing has been reserved."
NOT_FOUND = "This retreat could not be found. Nothing has been reserved."

_HOLD = re.compile(r"^retreats/([^/]+)/(reserve|group-book)$", re.IGNORECASE)
_DATE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?(Z|[+-]\d{2}:?\d{2})?$"
)


def now() -> datetime:  # patched in tests
    return datetime.now(timezone.utc)


def starts_at(retreat) -> Optional[datetime]:
    """The instant the retreat starts, or None when its date or zone can't be read."""
    if not isinstance(retreat, dict):
        return None
    tz_name = retreat.get("timezone") or retreat.get("time_zone") or DEFAULT_TZ
    if not isinstance(tz_name, str):
        return None
    try:
        tz = ZoneInfo(tz_name)
    except Exception:  # noqa: BLE001 — unknown / malformed zone → unreadable
        return None
    raw = retreat.get("start_date")
    if not isinstance(raw, str):
        return None
    raw = raw.strip()
    m = _DATE.match(raw)
    if not m:
        return None
    y, mo, d, hh, mi, ss, off = m.groups()
    if off and not hh:  # an offset needs a time
        return None
    try:
        if off:
            return datetime.fromisoformat(raw.replace(" ", "T").replace("Z", "+00:00"))
        return datetime(int(y), int(mo), int(d), int(hh or 0), int(mi or 0), int(ss or 0), tzinfo=tz)
    except ValueError:
        return None


def _refuse(status: int, reason: str, message: str) -> JSONResponse:
    return JSONResponse({"detail": message, "error": message, "reason": reason, "hold_refused": True},
                        status_code=status)


def refusal_for(retreat, at: Optional[datetime] = None) -> Optional[JSONResponse]:
    start = starts_at(retreat)
    if start is None:
        return _refuse(409, "retreat_dates_unavailable", DATES)
    if (at or now()) >= start:
        return _refuse(409, "retreat_started", STARTED)
    return None


def _norm(path: str) -> str:
    p = str(path or "")
    for _ in range(3):
        q = unquote(p)
        if q == p:
            break
        p = q
    return posixpath.normpath("/" + p.replace("\\", "/")).lstrip("/")


async def gateway_check(client: httpx.AsyncClient, method: str, path: str, headers) -> Optional[JSONResponse]:
    """For POST retreats/{id}/reserve and /group-book: read the retreat, refuse once it has started."""
    if str(method or "").upper() != "POST":
        return None
    m = _HOLD.match(_norm(path))
    if not m:
        return None
    read_headers = {"Accept": "application/json"}
    if headers.get("authorization"):
        read_headers["Authorization"] = headers.get("authorization")  # same visibility as the caller
    try:
        r = await client.get(f"/api/retreats/{quote(m.group(1), safe='')}", headers=read_headers, timeout=10.0)
    except httpx.HTTPError:
        return _refuse(503, "retreat_dates_unavailable", DATES)
    if r.status_code == 404:
        return _refuse(404, "retreat_not_found", NOT_FOUND)
    if r.status_code != 200:
        return _refuse(503, "retreat_dates_unavailable", DATES)
    try:
        data = r.json()
    except ValueError:
        return _refuse(503, "retreat_dates_unavailable", DATES)
    retreat = data.get("retreat", data) if isinstance(data, dict) else None
    return refusal_for(retreat)
