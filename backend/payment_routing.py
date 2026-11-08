"""Payments Prompt 2A (2026-10) — ONE server-side payment-provider routing policy.

Founder decisions (preview only, money lock unchanged):
  * Cashfree — domestic Indian customers only (billing country IN), INR only.
  * PayPal   — eligible international customers only (billing country outside IN), USD only.
  * The billing country is chosen explicitly at every website checkout and checked HERE.
  * International is NEVER routed through Cashfree, and nothing silently falls back to the
    other provider. Missing, invalid, conflicting or unsupported input is refused (fail closed).
  * An IP country is a risk signal only (recorded, never decisive). A phone number is not used.

`decide()` is pure. The router exposes it to the website BFF (shared secret). It CAN record a
decision and link it to the order that follows (record=true, then /decisions/{id}/order), but no
website checkout calls that yet: no order can be created this phase, so nothing is recorded.
`gateway_refusal()` is used by the /api/* gateway (server.py) for upstream routes that break
the policy.
"""
import hmac
import json
import os
import re
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

import payment_guard

POLICY_VERSION = "2026-10-27.1"
DOMESTIC_COUNTRY = "IN"
CASHFREE_CURRENCIES = frozenset({"INR"})
PAYPAL_CURRENCIES = frozenset({"USD"})  # founder decision: USD only during this phase
PROVIDERS = frozenset({"cashfree", "paypal"})

# ISO 3166-1 alpha-2 (249 officially assigned codes). Same list as frontend/lib/countries.ts
# (a test checks both copies are identical).
COUNTRIES = frozenset("""
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW
BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI
FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN
IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME
MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF
PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV
SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE
YT ZA ZM ZW
""".split())

# Countries where PayPal does not offer its service (provider rule). Confirm against PayPal's
# current country list before any international checkout goes live.
PAYPAL_UNSUPPORTED_COUNTRIES = frozenset({"CU", "IR", "KP", "SY", "RU"})

# Every website checkout entry point. `international` = currency of an APPROVED international
# price for that product (None = no international price exists, so it is not offered abroad).
FLOWS = {
    "venue_ai_onboarding": {"owner": "website backend (ai_onboarding.py)", "international": "USD"},
    "event_fee": {"owner": "website engine + main-backend Cashfree", "international": None},
    "one_on_one": {"owner": "main backend", "international": None},
    "instakyc": {"owner": "main backend", "international": None},
    "wallet_topup": {"owner": "main backend", "international": None},
    "fast_track": {"owner": "main backend", "international": None},
    "retreat_seat": {"owner": "main backend", "international": None},
    "retreat_group": {"owner": "main backend (group hold, paid to the host)", "international": None},
    "group_invite": {"owner": "main backend", "international": None},
}

# Products with a direct PayPal checkout that is implemented AND tested on the website.
# Prompt 4F: the venue upgrade only (ai_onboarding.py + paypal_checkout.py, US$30).
PAYPAL_CHECKOUT_FLOWS: frozenset = frozenset({"venue_ai_onboarding"})

MESSAGES = {
    "unknown_flow": "This payment is not available. No payment has been taken.",
    "billing_country_required": "Select your billing country to continue. No payment has been taken.",
    "billing_country_invalid": "Select a valid billing country. No payment has been taken.",
    "currency_invalid": "The payment currency is not valid. Please reload the page and try again. No payment has been taken.",
    "provider_invalid": "The payment method is not valid. Please reload the page and try again. No payment has been taken.",
    "provider_conflict": ("This payment method can't be used with your billing country. No payment has been taken."),
    "country_conflict": ("Your billing country does not match the country on your account. Please check it, or "
                         "contact NOSTOPS support. No payment has been taken."),
    "domestic_currency_not_supported": "Payments with an India billing address are taken in Indian rupees (INR) only. No payment has been taken.",
    "international_currency_not_supported": "International payments are taken in US dollars (USD) only. No payment has been taken.",
    "provider_not_supported_in_country": "Online payment is not available for your billing country. No payment has been taken.",
    "international_not_offered": ("International payment for this item is not available yet. Only an India billing "
                                  "address can pay for it for now. No payment has been taken."),
    "provider_unavailable": ("International checkout temporarily unavailable. PayPal checkout is being prepared. "
                             "No payment has been taken."),
}
STATUS = {"unknown_flow": 400, "billing_country_required": 400, "billing_country_invalid": 400, "currency_invalid": 400,
          "provider_invalid": 400, "provider_unavailable": 503}  # temporarily unavailable (PayPal not ready), same as the website BFF

_INDIA_NAMES = {"in", "india", "bharat", "ind"}
_CCY = re.compile(r"^[A-Z]{3}$")


def country_code(value: Optional[str]) -> Optional[str]:
    """ISO code for a billing-country selection (code only; names are not accepted)."""
    v = str(value or "").strip().upper()
    return v if v in COUNTRIES else None


def account_region(value: Optional[str]) -> Optional[str]:
    """Region of a country already on the account (code or name). None when unknown/empty."""
    v = str(value or "").strip()
    if not v:
        return None
    if v.lower() in _INDIA_NAMES:
        return "domestic"
    code = country_code(v)
    if code:
        return "domestic" if code == DOMESTIC_COUNTRY else "international"
    return "international"  # a named country that is not India


def _refuse(reason: str, base: dict, message_key: Optional[str] = None) -> dict:
    return {**base, "allowed": False, "provider": None, "reason": reason,
            "message": MESSAGES[message_key or reason], "status": STATUS.get(reason, 422)}


def decide(flow: str, billing_country: Optional[str], currency: Optional[str] = None, *,
           provider: Optional[str] = None, account_country: Optional[str] = None, ip_country: Optional[str] = None,
           paypal_ready: bool = False, paypal_flows: frozenset = PAYPAL_CHECKOUT_FLOWS) -> dict:
    """Which provider may take this payment? Pure; never raises; never grants by default.
    `currency` / `provider`, when given, are what the request claims; they must match the answer."""
    bc = country_code(billing_country)
    cur = str(currency).strip().upper() if currency not in (None, "") else None
    prov = str(provider).strip().lower() if provider not in (None, "") else None
    base = {"flow": flow, "billing_country": bc, "currency": None, "region": None, "risk_flags": [],
            "policy_version": POLICY_VERSION}
    if flow not in FLOWS:
        return _refuse("unknown_flow", base)
    if not str(billing_country or "").strip():
        return _refuse("billing_country_required", base)
    if not bc:
        return _refuse("billing_country_invalid", base)
    if cur is not None and not _CCY.match(cur):
        return _refuse("currency_invalid", base)
    if prov is not None and prov not in PROVIDERS:
        return _refuse("provider_invalid", base)
    region = "domestic" if bc == DOMESTIC_COUNTRY else "international"
    base["region"] = region
    acc = account_region(account_country)
    if acc is not None and acc != region:
        return _refuse("country_conflict", base)
    ipc = country_code(ip_country)
    if ipc and (ipc == DOMESTIC_COUNTRY) != (region == "domestic"):
        base["risk_flags"] = ["ip_country_mismatch"]  # risk signal only — never decisive

    if region == "domestic":
        if cur is not None and cur not in CASHFREE_CURRENCIES:
            return _refuse("currency_not_supported", base, "domestic_currency_not_supported")
        if prov not in (None, "cashfree"):
            return _refuse("provider_conflict", base)
        return {**base, "allowed": True, "provider": "cashfree", "currency": "INR", "reason": "domestic",
                "message": "", "status": 200}

    # International: PayPal only, never Cashfree.
    if prov not in (None, "paypal"):
        return _refuse("provider_conflict", base)
    if bc in PAYPAL_UNSUPPORTED_COUNTRIES:
        return _refuse("provider_not_supported_in_country", base)
    if cur is not None and cur not in PAYPAL_CURRENCIES:
        return _refuse("currency_not_supported", base, "international_currency_not_supported")
    price_ccy = FLOWS[flow]["international"]
    if price_ccy is None:
        return _refuse("international_not_offered", base)
    if price_ccy not in PAYPAL_CURRENCIES:
        return _refuse("currency_not_supported", base, "international_currency_not_supported")
    if flow not in paypal_flows or not paypal_ready:
        return _refuse("provider_unavailable", base)
    return {**base, "allowed": True, "provider": "paypal", "currency": price_ccy, "reason": "international",
            "message": "", "status": 200}


def paypal_ready(origin_host: Optional[str], headers) -> bool:
    """PayPal checkout may run for this host: sandbox only on a preview host, live only on a
    production host, with credentials present. (No website PayPal checkout exists yet.)"""
    d = payment_guard.paypal_env_decision(
        origin_host, headers, api_base=os.environ.get("PAYPAL_API_BASE", ""),
        client_id=os.environ.get("PAYPAL_CLIENT_ID", ""), client_secret=os.environ.get("PAYPAL_CLIENT_SECRET", ""))
    return d["allowed"]


# ── Gateway: upstream routes that break the routing policy ───────────────────
WRITE = {"POST", "PUT", "PATCH", "DELETE"}
INTL_VIA_CASHFREE_MSG = ("International payments are not taken through Cashfree. International checkout is being "
                         "prepared. No order was created and nothing was charged.")
LEGACY_KYC_MSG = ("This payment link is retired. InstaKYC is paid through the secure checkout on the InstaKYC page. "
                  "No payment link was created and nothing was charged.")


def legacy_razorpay_kyc_allowed() -> bool:
    """Reversible switch for the retired Razorpay InstaKYC payment link (default: refused)."""
    return os.environ.get("LEGACY_RAZORPAY_KYC_CHECKOUT", "") == "allow"


# Prompt 4B — corporate-batch "request payment" actions fan out to many payers whose billing country
# and currency are not known when the request is sent, and their price ladder is UNAPPROVED: no
# approved route and currency can be established, so they are refused (independently of the lock).
_UNROUTABLE_PAYMENT_REQUEST = re.compile(
    r"^(bookings/[^/]+/(close-and-request-payment|send-payment-requests)|bookings/hr/send-all-payment-requests)(/|$)")
UNROUTABLE_MSG = ("This payment request can't be sent: no approved payment route and currency can be confirmed "
                  "for the people it would go to. Nothing was sent and nothing changed.")


def gateway_refusal(method: str, canonical: str) -> Optional[JSONResponse]:
    m = (method or "").upper()
    if m in WRITE and re.match(r"^payments/cashfree/international(/|$)", canonical):
        return JSONResponse({"detail": INTL_VIA_CASHFREE_MSG, "routing_refused": True, "rule": "cashfree-international"},
                            status_code=403)
    if m in WRITE and _UNROUTABLE_PAYMENT_REQUEST.match(canonical):
        return JSONResponse({"detail": UNROUTABLE_MSG, "routing_refused": True, "rule": "unroutable-payment-request"},
                            status_code=403)
    if m in WRITE and canonical == "kyc/sandbox/create-payment" and not legacy_razorpay_kyc_allowed():
        return JSONResponse({"detail": LEGACY_KYC_MSG, "routing_refused": True, "rule": "legacy-razorpay-kyc"},
                            status_code=410)
    return None


# ── Gateway: every order-creation route must carry the buyer's billing country (Prompt 2B) ──
# The website BFF sends it; any other /api caller must send the same header. Without it, or
# with anything but "India → Cashfree, INR", nothing is forwarded to the main backend.
BILLING_HEADER = "x-billing-country"
_ORDER_TYPE_FLOWS = {"one_on_one": "one_on_one", "instakyc": "instakyc", "wallet_topup": "wallet_topup",
                     "institutional_event": "event_fee"}
_CHECKOUT_ROUTES = (
    (re.compile(r"^retreats/[^/]+/reservations/[^/]+/cashfree-order$"), "retreat_seat"),
    (re.compile(r"^empanelment/fast-track/[^/]+/cashfree-order$"), "fast_track"),
    (re.compile(r"^bookings/invite/[^/]+/cashfree-order$"), "group_invite"),
)
# Prompt 2C — routes that create a HOLD for a purchase (a 1:1 slot, a retreat seat or group, a place
# in a group batch, a paid Fast-Track request). They need the same answer as the payment, so nothing
# is reserved for a buyer who couldn't pay (no international checkout exists yet).
_HOLD_ROUTES = (
    (re.compile(r"^one-on-one/bookings$"), "one_on_one"),
    (re.compile(r"^retreats/[^/]+/reserve$"), "retreat_seat"),
    (re.compile(r"^retreats/[^/]+/group-book$"), "retreat_group"),
    (re.compile(r"^bookings/invite/[^/]+/register$"), "group_invite"),
    (re.compile(r"^empanelment/fast-track/initiate$"), "fast_track"),
)
HOLD_SUFFIX = " Nothing has been reserved."
_PAYMENT_LINK = re.compile(r"(^|/)(create-)?payment-link$")
RETIRED_LINK_MSG = ("Payment links are retired. Please pay through the secure checkout on NOSTOPS. "
                    "No payment link was created and nothing was charged.")


def _json(body: Optional[bytes]) -> dict:
    try:
        data = json.loads(body or b"{}")
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _checkout_flow(canonical: str, body: Optional[bytes]) -> Optional[str]:
    """Routing flow of an upstream order-creation route: a FLOWS key, "unknown" for an order route
    of an unknown kind (refused), or None when the route doesn't create an order."""
    if canonical == "payments/cashfree/orders":
        return _ORDER_TYPE_FLOWS.get(str(_json(body).get("order_type") or ""), "unknown")
    # Prompt 4B — the main backend's v1 Cashfree order route names only a booking: the product,
    # currency and route can't be established here, so it is an order of unknown kind (refused).
    if re.match(r"^v1/payments/orders(/|$)", canonical):
        return "unknown"
    for rx, flow in _CHECKOUT_ROUTES:
        if rx.match(canonical):
            return flow
    # Fail closed: any other Cashfree order-like write ("v1/payments/cashfree/orders",
    # "payments/cashfree/orders;x", ".../cashfree-order;x", another order route name) is treated
    # as an order of an unknown kind and refused. Webhooks and status reads don't match this.
    if "cashfree" in canonical and "order" in canonical:
        return "unknown"
    return None


def _hold_flow(canonical: str) -> Optional[str]:
    for rx, flow in _HOLD_ROUTES:
        if rx.match(canonical):
            return flow
    return None


def gateway_checkout_refusal(method: str, canonical: str, headers, body: Optional[bytes]) -> Optional[JSONResponse]:
    if (method or "").upper() not in WRITE:
        return None
    if _PAYMENT_LINK.search(canonical):
        return JSONResponse({"detail": RETIRED_LINK_MSG, "routing_refused": True, "rule": "retired-payment-link"},
                            status_code=410)
    # No PayPal checkout is approved yet: neither starting one nor capturing one (Prompt 4B: capture
    # is refused alongside create-order, on every host).
    if re.match(r"^international/paypal/(create-order|capture)(/|$)", canonical):
        return JSONResponse({"detail": MESSAGES["provider_unavailable"], "routing_refused": True,
                             "rule": "paypal-checkout-not-enabled"}, status_code=503)
    hold = _hold_flow(canonical)
    flow = hold or _checkout_flow(canonical, body)
    if flow is None:
        return None
    suffix, extra = (HOLD_SUFFIX, {"hold_refused": True}) if hold else ("", {})
    currency = _json(body).get("currency")
    if currency not in (None, "") and not isinstance(currency, str):  # e.g. ["USD"] or 840: fail closed
        return JSONResponse({"detail": MESSAGES["currency_invalid"] + suffix, "routing_refused": True, "rule": "billing-country",
                             "reason": "currency_invalid", **extra}, status_code=400)
    d = decide(flow, headers.get(BILLING_HEADER), currency or None, provider="cashfree")
    if d["allowed"] and d["provider"] == "cashfree" and d["currency"] == "INR":
        return None
    return JSONResponse({"detail": (d["message"] or MESSAGES["provider_unavailable"]) + suffix, "routing_refused": True,
                         "rule": "billing-country", "reason": d["reason"], **extra},
                        status_code=d["status"] if not d["allowed"] else 503)


# ── Website BFF endpoints (shared secret) ─────────────────────────────────────
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
router = APIRouter(prefix="/api/payment-routing", tags=["payment-routing"])


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


class DecideIn(BaseModel):
    flow: str = Field(min_length=1, max_length=40)
    billing_country: Optional[str] = Field(default=None, max_length=8)
    currency: Optional[str] = Field(default=None, max_length=8)
    provider: Optional[str] = Field(default=None, max_length=16)
    account_country: Optional[str] = Field(default=None, max_length=60)
    ip_country: Optional[str] = Field(default=None, max_length=8)
    record: bool = False
    amount: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    reference_id: Optional[str] = Field(default=None, max_length=200)
    pricing: Optional[dict] = None


class AttachIn(BaseModel):
    order_id: str = Field(min_length=3, max_length=200)
    amount: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    currency: Optional[str] = Field(default=None, max_length=8)


def _pricing_snapshot(p: Optional[dict]) -> Optional[dict]:
    """Small, flat copy of the server-side price facts (numbers/short strings only)."""
    if not isinstance(p, dict):
        return None
    out = {}
    for k, v in list(p.items())[:12]:
        if isinstance(v, (int, float, bool)) or (isinstance(v, str) and len(v) <= 80):
            out[str(k)[:40]] = v
    return out


@router.post("/decide")
async def decide_endpoint(body: DecideIn, x_pulse_secret: Optional[str] = Header(None),
                          x_nostops_origin_host: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    d = decide(body.flow, body.billing_country, body.currency, provider=body.provider, account_country=body.account_country,
               ip_country=body.ip_country, paypal_ready=paypal_ready(x_nostops_origin_host, {}))
    d["decision_id"] = None
    if body.record and d["allowed"]:
        decision_id = f"prd_{uuid.uuid4().hex[:20]}"
        await db.payment_routing_decisions.insert_one({
            "_id": decision_id, **{k: d[k] for k in ("flow", "billing_country", "region", "provider", "currency",
                                                       "risk_flags", "policy_version", "reason")},
            "requested_currency": (body.currency or "").upper() or None,
            "account_country_present": bool(body.account_country),
            "ip_country": country_code(body.ip_country),
            "amount": body.amount, "reference_id": body.reference_id, "pricing_snapshot": _pricing_snapshot(body.pricing),
            "origin_host": payment_guard.hostname(x_nostops_origin_host)[:120],
            "status": "DECIDED", "order_id": None, "created_at": int(time.time() * 1000),
        })
        d["decision_id"] = decision_id
    return d


@router.post("/decisions/{decision_id}/order")
async def attach_order(decision_id: str, body: AttachIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Link the provider order to its routing decision (once; the same order again is a no-op).
    The order must carry the decision's currency and, when both are known, its amount."""
    _check_secret(x_pulse_secret)
    doc = await db.payment_routing_decisions.find_one({"_id": decision_id})
    if not doc:
        raise HTTPException(status_code=404, detail="decision_not_found")
    if doc.get("order_id") not in (None, body.order_id):
        raise HTTPException(status_code=409, detail="decision_already_used")
    if body.currency and doc.get("currency") and body.currency.upper() != doc["currency"]:
        raise HTTPException(status_code=409, detail="currency_mismatch")
    if body.amount is not None and doc.get("amount") is not None and abs(float(body.amount) - float(doc["amount"])) > 0.005:
        raise HTTPException(status_code=409, detail="amount_mismatch")
    ok = {"ok": True, "decision_id": decision_id, "order_id": body.order_id}
    if doc.get("order_id") == body.order_id:
        return ok  # the same order again: nothing changes
    upd = {"order_id": body.order_id, "status": "ORDER_CREATED", "updated_at": int(time.time() * 1000)}
    if body.amount is not None:
        upd["amount"] = body.amount
    res = await db.payment_routing_decisions.update_one({"_id": decision_id, "order_id": None}, {"$set": upd})
    if res.matched_count == 0:  # another order was linked at the same moment
        raise HTTPException(status_code=409, detail="decision_already_used")
    return ok
