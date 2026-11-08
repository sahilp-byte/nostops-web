"""Prompt 4F — PayPal Orders v2 client for the website's OWN venue-onboarding checkout.

Server-side REST calls with httpx (no SDK, no PayPal script in the browser):
  * an OAuth client-credentials token per call;
  * create an order (intent CAPTURE) whose amount is set by the server, idempotent through
    PayPal-Request-Id; the buyer is sent to PayPal's own approval page ("payer-action" link);
  * capture it once the buyer is back (idempotent through PayPal-Request-Id);
  * re-read it (authoritative status) before anything is granted.
Which environment may run where (sandbox only on a preview host, live only on a production host)
is decided by payment_guard.paypal_env_decision; this module only talks to the configured API.
"""
import os
from typing import Optional

import httpx

# Tests inject a mock PayPal here; None = the real network.
transport: Optional[httpx.AsyncBaseTransport] = None


class PayPalError(Exception):
    """PayPal answered with an error. `name` is PayPal's issue code (e.g. ORDER_ALREADY_CAPTURED)."""

    def __init__(self, status: int, name: str = "", message: str = ""):
        super().__init__(f"PayPal {status} {name}".strip())
        self.status, self.name, self.message = status, name, message


def config() -> dict:
    return {
        "api_base": os.environ.get("PAYPAL_API_BASE", "").strip().rstrip("/"),
        "client_id": os.environ.get("PAYPAL_CLIENT_ID", ""),
        "client_secret": os.environ.get("PAYPAL_CLIENT_SECRET", ""),
    }


async def _call(method: str, path: str, *, body: Optional[dict] = None, request_id: Optional[str] = None) -> dict:
    cfg = config()
    async with httpx.AsyncClient(base_url=cfg["api_base"], timeout=30.0, transport=transport) as hx:
        t = await hx.post("/v1/oauth2/token", data={"grant_type": "client_credentials"},
                          auth=(cfg["client_id"], cfg["client_secret"]), headers={"Accept": "application/json"})
        token = t.json().get("access_token") if t.status_code == 200 and t.content else None
        if not token:
            raise PayPalError(502, "AUTHENTICATION_FAILURE")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                   "Accept": "application/json", "Prefer": "return=representation"}
        if request_id:
            headers["PayPal-Request-Id"] = request_id
        r = await hx.request(method, path, json=body, headers=headers)
    try:
        data = r.json() if r.content else {}
    except ValueError:
        data = {}
    if r.status_code >= 400:
        details = data.get("details") if isinstance(data.get("details"), list) else []
        issue = (details[0] or {}).get("issue") if details and isinstance(details[0], dict) else None
        raise PayPalError(r.status_code, str(issue or data.get("name") or ""), str(data.get("message") or ""))
    return data


async def create_order(order_id: str, *, value: str, currency: str, description: str,
                       return_url: str, cancel_url: str) -> dict:
    return await _call("POST", "/v2/checkout/orders", request_id=order_id, body={
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": order_id, "custom_id": order_id, "invoice_id": order_id,
            "description": description[:127],
            "amount": {"currency_code": currency, "value": value},
        }],
        "payment_source": {"paypal": {"experience_context": {
            "brand_name": "NOSTOPS", "shipping_preference": "NO_SHIPPING", "user_action": "PAY_NOW",
            "return_url": return_url, "cancel_url": cancel_url,
        }}},
    })


async def capture(paypal_order_id: str, *, request_id: str) -> dict:
    return await _call("POST", f"/v2/checkout/orders/{paypal_order_id}/capture", request_id=request_id)


async def get_order(paypal_order_id: str) -> dict:
    return await _call("GET", f"/v2/checkout/orders/{paypal_order_id}")


def approve_url(order: dict) -> str:
    """PayPal's approval page for the buyer ("payer-action", or "approve" on older answers)."""
    for rel in ("payer-action", "approve"):
        for link in order.get("links") or []:
            if isinstance(link, dict) and link.get("rel") == rel and link.get("href"):
                return str(link["href"])
    return ""


def capture_of(order: dict) -> dict:
    """The first capture of the first purchase unit, or {}."""
    units = order.get("purchase_units") or [{}]
    caps = ((units[0] or {}).get("payments") or {}).get("captures") or [{}]
    return caps[0] if isinstance(caps[0], dict) else {}


def matches(order: dict, cap: dict, local: dict) -> bool:
    """PayPal's order is the one this module created and the capture took exactly its price."""
    unit = (order.get("purchase_units") or [{}])[0] or {}
    amt = cap.get("amount") or {}
    try:
        amount_ok = abs(float(amt.get("value")) - float(local.get("amount"))) <= 0.01
    except (TypeError, ValueError):
        return False
    return (amount_ok and str(amt.get("currency_code") or "").upper() == str(local.get("currency") or "").upper()
            and str(unit.get("reference_id") or "") == str(local.get("_id"))
            and str(order.get("id") or "") == str(local.get("paypal_order_id") or ""))
