"""Gateway admin guard (B5.1 / TVR-01).

The catch-all proxy in server.py forwards /api/* to the main NOSTOPS backend.
That backend currently returns several admin-only lists (KYC, empanelment,
refunds, disputes, admin stats, ...) to ANY signed-in user. Until its own team
fixes it, this guard enforces administrator access HERE, server-side, before
an admin request is forwarded:

  * no credentials / invalid session   -> 401 {"detail": "Not authenticated"}
  * signed in but not an administrator -> 403 {"detail": "Admin access required"}
  * administrator                      -> forwarded unchanged (same contract)

The caller's role is resolved with the backend's own GET /api/auth/me using the
caller's own credentials (bearer header or session cookie) — the existing
auth model and role field, nothing new. It fails CLOSED if that check cannot
run. Credentials are never logged.
"""
import logging
import posixpath
from typing import Optional
from urllib.parse import unquote

import httpx
from fastapi.responses import JSONResponse

log = logging.getLogger("admin_gate")

ADMIN_ROLES = {"admin"}
# Only these caller headers are needed to resolve who is calling.
_CREDENTIAL_HEADERS = {"authorization", "cookie"}


def _canonical(path: str) -> str:
    """Normalise a proxied path the way an upstream router could see it, so
    encoded slashes, dot-segments, doubled slashes, backslashes or letter case
    can't be used to slip past the check."""
    p = path
    for _ in range(3):
        q = unquote(p)
        if q == p:
            break
        p = q
    p = posixpath.normpath("/" + p.replace("\\", "/")).lstrip("/")
    return p.lower()


def is_admin_path(path: str) -> bool:
    """`path` is the part after /api/ (as received by the catch-all proxy).
    B4.7 remediation: per-account stats (earnings, wallet balance, withdrawals) are
    served by the main backend to anyone by id, so the gateway treats them as admin-only
    (the website never reads them)."""
    p = _canonical(path)
    return (p == "admin" or p.startswith("admin/") or p.startswith("dashboards/admin-stats")
            or p.startswith(("v1/stats/teacher/", "v1/stats/student/", "v1/stats/org/")))


def without_credentials(headers: dict) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in _CREDENTIAL_HEADERS}


def _deny(status: int, detail: str) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status)


async def check(client: httpx.AsyncClient, method: str, path: str, headers) -> Optional[JSONResponse]:
    """Return a ready error response when the caller may not reach this admin
    path, or None when the request may be forwarded."""
    if method.upper() == "OPTIONS":  # CORS preflight carries no credentials or data
        return None
    creds = {k: v for k, v in headers.items() if k.lower() in _CREDENTIAL_HEADERS}
    if not creds:
        return _deny(401, "Not authenticated")
    try:
        me = await client.get("/api/auth/me", headers=creds)
    except httpx.RequestError:
        log.warning("admin gate: auth check unreachable for %s /api/%s", method, _canonical(path))
        return JSONResponse({"error": "upstream_unreachable", "detail": "Could not verify access."}, status_code=502)
    if me.status_code in (401, 403):
        return _deny(401, "Not authenticated")
    if me.status_code != 200:
        log.warning("admin gate: auth check returned %s for %s /api/%s", me.status_code, method, _canonical(path))
        return JSONResponse({"error": "upstream_unreachable", "detail": "Could not verify access."}, status_code=502)
    try:
        data = me.json()
    except ValueError:
        return JSONResponse({"error": "upstream_unreachable", "detail": "Could not verify access."}, status_code=502)
    user = data.get("user", data) if isinstance(data, dict) else {}
    role = str((user or {}).get("role") or "").strip().lower()
    if role not in ADMIN_ROLES:
        log.info("admin gate: denied %s /api/%s (role=%s)", method, _canonical(path), role or "none")
        return _deny(403, "Admin access required")
    return None
