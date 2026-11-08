"""Payments Prompt 2D — preview is VIEW-ONLY for the real main backend (pro-learn-connect-1).

Founder decision: "preview can view, not save". Any request that arrives through a preview /
local / unknown host and would write upstream (POST, PUT, PATCH, DELETE) is refused at the
gateway before anything is sent. Reads and signing in / out are allowed. Production hosts are
untouched (same host rule as the preview payment guard, payment_guard.ingress_blocked). Nothing
is ever redirected anywhere else.
"""
from typing import Optional

from fastapi.responses import JSONResponse

import admin_gate
import payment_guard

MESSAGE = (
    "Preview mode: saving is turned off in this preview, so nothing was sent to the live NOSTOPS "
    "system. This works on the live site."
)
HEADER = "X-Nostops-Preview-Read-Only"
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
# The only upstream writes allowed from preview — exact paths, no variants.
SIGN_IN_PATHS = frozenset({
    "auth/login", "auth/logout", "auth/session", "auth/otp/start", "auth/otp/verify", "admin/totp/verify",
})


def is_sign_in(path: str) -> bool:
    raw = str(path or "")
    return raw in SIGN_IN_PATHS and admin_gate._canonical(raw) == raw


def blocks(method: str, path: str, headers) -> bool:
    if str(method or "").upper() in READ_METHODS or is_sign_in(path):
        return False
    return payment_guard.ingress_blocked(headers)


def refusal(method: str, path: str, headers) -> Optional[JSONResponse]:
    if not blocks(method, path, headers):
        return None
    return JSONResponse(
        {"detail": MESSAGE, "error": MESSAGE, "preview_read_only": True},
        status_code=423,
        headers={HEADER: "1", "Cache-Control": "no-store"},
    )
