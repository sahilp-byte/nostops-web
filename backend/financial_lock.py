"""FINANCIAL SAFETY AUDIT (2026-06) — gateway copy of frontend/lib/financial-lock-rules.ts.

The catch-all proxy in server.py forwards /api/* to the main backend. Every call is
checked here FIRST (before the admin gate makes any upstream call):

  * ALWAYS rules — mock-payment and policy-bypass routes: refused, lock or no lock.
  * LOCK rules   — money actions and reads that change payout state: refused while
    FINANCIAL_ACTIONS_UNLOCKED is not "true" (founder approval required to change it).

A refused call returns 423 and is never forwarded. A test checks this file and the
website copy give the same answer for every case.

P0 REMEDIATION (2026-10) — fail closed:
  * five more money routes found in the deployed route list (paid-state change, split
    reassignment, credit issue / referral commission) are LOCK rules;
  * a catch-all LOCK rule refuses any OTHER write whose path names a money action
    (withdraw, payout, refund, wallet, escrow, ledger, settle, commission, credit, ...),
    so a new main-backend money route is refused until it is reviewed;
  * the two body-dependent checks refuse when the body cannot be read as a JSON object.
Inbound payment notifications are NOT refused (founder decision: record a verified incoming
payment, release nothing) — see INBOUND_PAYMENT_ROUTES. They must carry a provider signature.

Founder decision 4 (2026-10): the retired Razorpay GET callback is refused (ALWAYS, any method),
lock or no lock — Razorpay is decommissioned, so nothing may mark a booking paid through it.
"""
import json
import os
import re
from typing import Optional
from urllib.parse import parse_qs

from fastapi.responses import JSONResponse

from admin_gate import _canonical

FINANCIAL_LOCK_MESSAGE = ("Money actions are paused while NOSTOPS completes a financial safety audit. "
                          "Nothing was sent and nothing changed. Balances and history stay visible.")
BLOCKED_ROUTE_MESSAGE = "This action is not available. Nothing was sent and nothing changed."
WRITE = {"POST", "PUT", "PATCH", "DELETE"}

# (id, kind, methods, pattern) — same order and patterns as the website copy.
RULES = [
    ("mock-checkout", "ALWAYS", "ANY", r"^payments/cashfree/mock-checkout(/|$)"),
    ("mock-card", "ALWAYS", "WRITE", r"^(empanelment/fast-track/[^/]+/pay|premium-sessions/book|bookings/[^/]+/pay)$"),
    ("self-empanel", "ALWAYS", "WRITE", r"^teachers/me/apply-free-empanelment$"),
    ("razorpay", "ALWAYS", "WRITE", r"^(payments/razorpay(/|$)|empanelment/fast-track/[^/]+/razorpay-(create|verify)$)"),
    ("razorpay-callback", "ALWAYS", "ANY", r"^payments/razorpay/callback(/|$)"),
    # Prompt 4B (founder decision): payout / settlement INITIATION is refused permanently, lock or no
    # lock (no payout capability is approved; the Cashfree account does not support payouts).
    # Read-only payout and wallet history (GETs) stays open.
    ("payout-initiation", "ALWAYS", "WRITE",
     r"^(v1/payouts/withdraw|teacher-wallet/withdraw|teachers/me/payout-request|teacher-referrals/withdraw"
     r"|admin/payouts/approve)(/|$)"),
    ("payout-sweep", "ALWAYS", "ANY", r"^admin/payouts/sweep(/|$)"),
    ("payout-sweep-read", "LOCK", "ANY", r"^admin/payouts/list(/|$)"),
    ("wallet-heal", "LOCK", "ANY", r"^admin/wallet/reconcile(/|$)"),
    ("withdraw", "LOCK", "WRITE",
     r"^(teacher-wallet/(withdraw|setup-pin|change-pin|payout-details)(/|$)|teachers/me/payout-request$|teacher-referrals/withdraw$)"),
    ("v1-money", "LOCK", "WRITE",
     r"^v1/(payouts(/|$)|payments/admin(/|$)|referrals/(credit|trigger)$|kyc/bank-verify$|teachers/[^/]+/wallet(/|$)"
     r"|bookings/[^/]+/(complete|cancel|self-cancel)$)"),
    ("payout-decision", "LOCK", "WRITE", r"^admin/payouts(/|$)"),
    ("refund", "LOCK", "WRITE",
     r"^(payments/cashfree/orders/[^/]+/refunds$|retreats/[^/]+/reservations/[^/]+/cancel-with-refund$"
     r"|one-on-one/booking/[^/]+/student-cancel$|one-on-one/auto-expire-unresponsive$|bookings/[^/]+/cancel$)"),
    ("mark-paid", "LOCK", "WRITE", r"^(retreats/[^/]+/reservations/[^/]+/mark-paid|bookings/[^/]+/employees/[^/]+/mark-paid)$"),
    ("release", "LOCK", "WRITE",
     r"^(one-on-one/booking/[^/]+/(complete|reassign)$|bookings/[^/]+/complete-pilot$|bookings/check-expired-pilots$"
     r"|bookings/[^/]+/split-agreement(/|$)|empanelment/claims/sweep-fallback$)"),
    ("fast-track-split", "LOCK", "WRITE", r"^empanelment/fast-track/[^/]+/decide$"),
    # P0 (2026-10) — found unprotected in the deployed route list.
    ("paid-state-change", "LOCK", "WRITE",
     r"^(retreats/[^/]+/reservations/[^/]+/cancel|empanelment/fast-track/[^/]+/cancel)$"),
    ("split-reassign", "LOCK", "WRITE", r"^group-booking-agreements/[^/]+/decline$"),
    ("credit-issue", "LOCK", "WRITE", r"^(gurukul/issue-credit|referrals/[^/]+/status)$"),
    # Prompt 4B — payment actions found forwarded with no billing-country check (Stage A audit).
    # Refused while locked; payment_routing also refuses them when unlocked (no approved route).
    ("payment-request", "LOCK", "WRITE",
     r"^(v1/payments/orders|bookings/[^/]+/(close-and-request-payment|send-payment-requests)"
     r"|bookings/hr/send-all-payment-requests|international/paypal/capture/[^/]+)(/|$)"),
    # Prompt 4B (founder decision) — the legacy Razorpay InstaKYC confirmation: no confirmation of
    # any Razorpay payment while locked (code and history kept; manual reconciliation is separate).
    ("legacy-kyc-confirm", "LOCK", "WRITE", r"^kyc/sandbox/verify-payment(/|$)"),
    # Fail-closed catch-all: any other write whose path names a money action.
    ("money-keyword", "LOCK", "WRITE",
     r"(^|[/_-])(withdraw[a-z0-9_]*|payouts?|refunds?|wallets?|escrow|ledgers?|settle[a-z0-9_]*|commissions?"
     r"|earnings?|bonus(es)?|cashback|chargebacks?|reversals?|disburse[a-z0-9_]*|beneficiar[a-z0-9_]*"
     r"|bank-account|bank-verify|mark-paid|credits?|release[a-z0-9_]*|reconcile[a-z0-9_]*)([/_-]|$)"),
]
_COMPILED = [(i, k, m, re.compile(p)) for i, k, m, p in RULES]

# Inbound payment notifications: forwarded even while locked (verified incoming payments are
# recorded; nothing is released). The gateway cannot check the HMAC (the main backend holds the
# key) but refuses a call that carries no Cashfree signature at all.
INBOUND_PAYMENT_ROUTES = ("payments/cashfree/webhook", "v1/payments/webhook")


def unsigned_webhook(method: str, canonical_path: str, headers) -> bool:
    return ((method or "").upper() in WRITE and canonical_path in INBOUND_PAYMENT_ROUTES
            and not (headers.get("x-webhook-signature") and headers.get("x-webhook-timestamp")))


def locked() -> bool:
    return os.environ.get("FINANCIAL_ACTIONS_UNLOCKED", "") != "true"


# Prompt 4F — per-checkout unlock (audit P1-3). FINANCIAL_UNLOCKED_FLOWS (comma-separated) opens the
# money lock for the named checkouts ONLY; every LOCK rule above stays on for everything else.
# Only the checkouts pinned here can be opened this way (each one needs its own founder approval).
UNLOCKABLE_FLOWS = frozenset({"venue_ai_onboarding"})


def flow_unlocked(flow: str) -> bool:
    if not locked():
        return True
    named = {f.strip() for f in os.environ.get("FINANCIAL_UNLOCKED_FLOWS", "").split(",")}
    return flow in UNLOCKABLE_FLOWS and flow in named


def _json_object(body: Optional[bytes]) -> Optional[dict]:
    """The body as a JSON object, or None when it can't be read as one (→ refused)."""
    try:
        v = json.loads(body or b"")
    except (ValueError, TypeError):
        return None
    return v if isinstance(v, dict) else None


def _is_wallet_topup(obj: Optional[dict]) -> bool:
    if obj is None:
        return True
    return any(obj.get(k) is not None and "wallet" in json.dumps(obj.get(k)).lower() for k in ("order_type", "orderType"))


def rule_for(method: str, path: str, query: str = "", body: Optional[bytes] = None,
             is_locked: Optional[bool] = None) -> Optional[str]:
    """Id of the rule this call breaks, or None. `path` is the part after /api/."""
    lock = locked() if is_locked is None else is_locked
    m = (method or "GET").upper()
    p = _canonical(path)
    if p.startswith("api/"):
        p = p[4:]
    # A decoded "?" / "#" or a control character would be re-read as a delimiter further on,
    # so the route checked here would not be the route reached. Always refused.
    if any(c in p for c in "?#") or any(ord(c) < 32 for c in p):
        return "bad-path"
    is_write = m in WRITE
    for rid, kind, methods, rx in _COMPILED:
        if kind == "LOCK" and not lock:
            continue
        if methods == "WRITE" and not is_write:
            continue
        if not rx.search(p):
            continue
        if rid == "wallet-heal" and parse_qs(query or "").get("heal_direction") == ["report_only"]:
            continue
        return rid
    if lock and is_write:
        # Wallet top-up credits a wallet: refused unless the body is readable and names no wallet order.
        if p == "payments/cashfree/orders" and _is_wallet_topup(_json_object(body)):
            return "wallet-topup"
        # Anything but an exact "accept" may decline (and refund) the booking.
        if re.search(r"^one-on-one/booking/[^/]+/teacher-action$", p):
            obj = _json_object(body)
            if obj is None or obj.get("action") != "accept":
                return "decline-refund"
    return None


def refuse(rule_id: str) -> JSONResponse:
    always = rule_id == "bad-path" or any(r[0] == rule_id and r[1] == "ALWAYS" for r in RULES)
    return JSONResponse({"detail": BLOCKED_ROUTE_MESSAGE if always else FINANCIAL_LOCK_MESSAGE,
                         "financial_lock": True, "rule": rule_id}, status_code=423)
