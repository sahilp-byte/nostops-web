"""P2 (2026-10) — the main backend's Cashfree diagnostic, behind the website gateway.

Upstream, GET /api/payments/cashfree/diag is public: it shows the environment, the last 4 of
the client id, the secret key's prefix and the API base, and pings Cashfree on every call.
Through this gateway it is:

  * admin-only — the caller's role is checked on EVERY call (admin_gate), before the cache is
    read, so a cached answer can never reach a signed-out or non-admin caller;
  * minimal — environment + three yes/no answers; never an id, prefix, URL or raw provider text;
  * cached briefly (60 s on success, 10 s on failure; one upstream call at a time), so repeated
    admin page loads don't ping Cashfree each time. The cached value holds nothing per-user.

The caller's credentials are never sent with the upstream diag call.
"""
import asyncio
import time
from datetime import datetime, timezone

import httpx
from fastapi.responses import JSONResponse

import admin_gate
import payment_guard

PATH = "payments/cashfree/diag"
TTL_OK_S = 60
TTL_FAIL_S = 10
NO_STORE = {"Cache-Control": "no-store, private", "Vary": "Authorization, Cookie"}

_cache: dict = {"body": None, "status": 0, "expires": 0.0}
_lock = asyncio.Lock()


def _key_environment(prefix) -> str:
    """Which environment the secret key was issued for — used only to compute a yes/no answer."""
    p = str(prefix or "").lower()
    if "prod" in p and "test" not in p:
        return "production"
    if "test" in p and "prod" not in p:
        return "sandbox"
    return "unknown"


def _bool(v):
    return v if isinstance(v, bool) else None


def minimal(data: dict) -> dict:
    """Reduce the upstream diag to the fields an administrator needs. Nothing else is copied."""
    env = payment_guard.cashfree_mode(data.get("api_base"))
    declared = str(data.get("env") or "").strip().lower()
    if env == "unset" or (declared and (declared == "production") != (env == "production")):
        env = "unknown"  # missing, unrecognised or contradictory configuration
    key_env = _key_environment(data.get("secret_prefix"))
    configured = (_bool(data.get("client_id_set")), _bool(data.get("secret_set")))
    return {
        "environment": env,
        "credentials_configured": None if None in configured else all(configured),
        "credential_type_matches_environment": None if "unknown" in (env, key_env) else key_env == env,
        "credentials_accepted_by_cashfree": _bool((data.get("cashfree_auth_check") or {}).get("creds_valid")
                                                  if isinstance(data.get("cashfree_auth_check"), dict) else None),
    }


async def _refresh(client: httpx.AsyncClient) -> None:
    status, body = 503, {"environment": "unknown", "credentials_configured": None,
                         "credential_type_matches_environment": None, "credentials_accepted_by_cashfree": None,
                         "upstream": "unavailable"}
    try:
        r = await client.get(f"/api/{PATH}", headers={"Accept": "application/json"}, timeout=15.0)
        data = r.json() if r.status_code == 200 else None
        if isinstance(data, dict):
            status, body = 200, minimal(data)
    except (httpx.HTTPError, ValueError):
        pass
    body["checked_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _cache.update(body=body, status=status, expires=time.monotonic() + (TTL_OK_S if status == 200 else TTL_FAIL_S))


async def handle(client: httpx.AsyncClient, method: str, headers) -> JSONResponse:
    if method.upper() != "GET":
        return JSONResponse({"detail": "Method not allowed"}, status_code=405, headers=NO_STORE)
    denied = await admin_gate.check(client, "GET", PATH, headers)
    if denied is not None:
        denied.headers.update(NO_STORE)
        return denied
    refreshed = False
    if _cache["body"] is None or time.monotonic() >= _cache["expires"]:
        async with _lock:  # one upstream call at a time; waiters reuse its answer
            if _cache["body"] is None or time.monotonic() >= _cache["expires"]:
                await _refresh(client)
                refreshed = True
    body = {**_cache["body"], "cached": not refreshed,
            "max_age_s": TTL_OK_S if _cache["status"] == 200 else TTL_FAIL_S}
    return JSONResponse(body, status_code=_cache["status"], headers=NO_STORE)
