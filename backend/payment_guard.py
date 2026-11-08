"""B4.7 Workstream D — preview payment isolation (shared by the gateway proxy and
the local payment module).

Preview (*.preview.emergentagent.com, localhost) must never reach the LIVE
Cashfree gateway. Production hosts (www.nostops.org, *.emergent.host) are
unaffected. A request with no host information is refused (fail closed).
Cashfree SANDBOX checkouts are allowed on a preview host only — see
checkout_decision() — and only for the local venue-upgrade module; main-backend
checkouts stay off in preview (that backend holds live keys).
"""
from typing import Iterable, Optional
from urllib.parse import urlparse

PREVIEW_SUFFIXES = (".preview.emergentagent.com", ".preview.emergentcf.cloud")
LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

DISABLED_DETAIL = (
    "Test mode: payments are turned off in this preview. "
    "No order was created and nothing was charged."
)


def hostname(value: Optional[str]) -> str:
    """Bare lowercase hostname from a Host / X-Forwarded-Host value."""
    h = str(value or "").split(",")[0].strip().lower()
    if h.startswith("["):  # [::1]:8001
        return h[1:].split("]")[0]
    return h.rsplit(":", 1)[0] if h.count(":") == 1 else h


def is_preview_suffix(value: Optional[str]) -> bool:
    return hostname(value).endswith(PREVIEW_SUFFIXES)


def is_test_host(value: Optional[str]) -> bool:
    """Preview, local or unknown host — never allowed to start a payment."""
    h = hostname(value)
    return not h or h in LOCAL_HOSTS or h.endswith(".local") or h.endswith(PREVIEW_SUFFIXES)


def ingress_blocked(headers) -> bool:
    """For requests that arrive through the ingress (browser → /api/*): refuse when
    the routed host is a preview/local host, or when no host is present."""
    hosts = [headers.get("host"), headers.get("x-forwarded-host")]
    present = [h for h in hosts if h]
    if not present:
        return True
    return any(is_test_host(h) for h in present)


def internal_call_blocked(origin_host: Optional[str], headers) -> bool:
    """For BFF → local-backend calls (Host is localhost there). The BFF, which is
    authenticated by the shared secret, states the public host the browser used
    (X-Nostops-Origin-Host). Refuse when that host is preview/local/missing, or
    when the request itself was routed through a preview ingress."""
    if is_test_host(origin_host):
        return True
    return any(is_preview_suffix(h) for h in _values(headers, ("host", "x-forwarded-host")))


def _values(headers, names: Iterable[str]) -> list:
    return [headers.get(n) for n in names if headers.get(n)]


# ── Cashfree sandbox completion (preview) ─────────────────────────────────────
# Which Cashfree environment the configured API base points at. Exact host match
# only; anything else (unset, http, typo, look-alike) is "unset" → fail closed.
SANDBOX_API_HOST = "sandbox.cashfree.com"
PRODUCTION_API_HOST = "api.cashfree.com"


def cashfree_mode(api_base: Optional[str]) -> str:
    u = urlparse(str(api_base or "").strip())
    host = (u.hostname or "").lower()
    if u.scheme != "https":
        return "unset"
    if host == SANDBOX_API_HOST:
        return "sandbox"
    if host == PRODUCTION_API_HOST:
        return "production"
    return "unset"


def url_host(value: Optional[str]) -> str:
    """Hostname of an https origin/URL, else ''."""
    u = urlparse(str(value or "").strip())
    return (u.hostname or "").lower() if u.scheme == "https" else ""


def checkout_decision(origin_host: Optional[str], headers, *, api_base: str, client_id: str, client_secret: str,
                      web_app_base_url: str, checkout_origin: str) -> dict:
    """May a Cashfree checkout start for a browser on `origin_host`?

    * SANDBOX keys run ONLY on a preview host, and only when WEB_APP_BASE_URL and
      CASHFREE_CHECKOUT_ORIGIN both name that exact host. A production, local or
      unknown host never runs on sandbox, so production can't be shown as a test.
    * PRODUCTION keys run ONLY on a production host; a preview/local/unknown host —
      or a request routed through a preview ingress — is refused, so preview can
      never reach the live gateway.
    * Missing/unknown configuration → refused. Nothing is ever granted here.
    """
    mode = cashfree_mode(api_base)
    host = hostname(origin_host)
    if mode == "unset":
        return {"allowed": False, "mode": mode, "reason": "not_configured"}
    if not client_id or not client_secret:
        return {"allowed": False, "mode": mode, "reason": "missing_credentials"}
    if mode == "sandbox":
        if not host.endswith(PREVIEW_SUFFIXES):
            return {"allowed": False, "mode": mode, "reason": "sandbox_outside_preview"}
        if url_host(web_app_base_url) != host or url_host(checkout_origin) != host:
            return {"allowed": False, "mode": mode, "reason": "origin_not_configured"}
        return {"allowed": True, "mode": mode, "reason": "sandbox"}
    if internal_call_blocked(origin_host, headers):
        return {"allowed": False, "mode": mode, "reason": "preview_live_keys"}
    return {"allowed": True, "mode": mode, "reason": "production"}


# ── PayPal environment binding (Payments Prompt 2A) ───────────────────────────
# Same rule as Cashfree: SANDBOX only on a preview host, LIVE only on a production host,
# exact API host match, https only; anything else is "unset" → refused.
PAYPAL_SANDBOX_API_HOST = "api-m.sandbox.paypal.com"
PAYPAL_LIVE_API_HOST = "api-m.paypal.com"


def paypal_mode(api_base: Optional[str]) -> str:
    u = urlparse(str(api_base or "").strip())
    host = (u.hostname or "").lower()
    if u.scheme != "https":
        return "unset"
    if host == PAYPAL_SANDBOX_API_HOST:
        return "sandbox"
    if host == PAYPAL_LIVE_API_HOST:
        return "live"
    return "unset"


def paypal_env_decision(origin_host: Optional[str], headers, *, api_base: str, client_id: str,
                        client_secret: str) -> dict:
    """May PayPal be called for a request from `origin_host`? Nothing is ever granted by default."""
    mode = paypal_mode(api_base)
    host = hostname(origin_host)
    if mode == "unset":
        return {"allowed": False, "mode": mode, "reason": "not_configured"}
    if not client_id or not client_secret:
        return {"allowed": False, "mode": mode, "reason": "missing_credentials"}
    if mode == "sandbox":
        if not host.endswith(PREVIEW_SUFFIXES):
            return {"allowed": False, "mode": mode, "reason": "sandbox_outside_preview"}
        return {"allowed": True, "mode": mode, "reason": "sandbox"}
    if is_test_host(origin_host) or any(is_preview_suffix(h) for h in _values(headers, ("host", "x-forwarded-host"))):
        return {"allowed": False, "mode": mode, "reason": "preview_live_keys"}
    return {"allowed": True, "mode": mode, "reason": "live"}
