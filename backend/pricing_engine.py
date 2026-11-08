"""Prompt 3 (2026-10) — the canonical server-side pricing engine for this website workspace.

Pure: no network, no database, no clock. The same validated inputs and rule version always give
the same quote (`quote_id` is a hash of it). Money is whole minor units (paise / cents) with
Decimal percentages; the rounding rules are pricing_rules.ROUNDING_RULES (R1–R5).

A quote is never an order. Every quote says checkout is not available, and nothing here can
reserve, register, charge, refund, settle or pay out. Client-sent totals are compared, never used.
Prices owned by the main backend (pro-learn-connect-1) come back as REMOTE_REFERENCE: a caller
may pass the amount it read there for a read-only comparison; this engine never sets it.
"""
import hashlib
import json
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Optional

import payment_routing
import pricing_rules as R

CONFIRMED = "CONFIRMED"              # a price this server computed from an approved / recorded rule
ESTIMATE = "ESTIMATE"                # a figure from an unapproved rule (planning / rate card); never payable
UNAVAILABLE = "UNAVAILABLE"          # no rule allows a price here; no amount is returned (never ₹0)
REMOTE_REFERENCE = "REMOTE_REFERENCE"  # the main backend owns this price; read-only comparison only
ALLOCATION_ONLY = "ALLOCATION_ONLY"  # a proposed revenue split for review, not a price
UNAPPROVED_REFERENCE = "UNAPPROVED_REFERENCE"  # a legacy figure shown for reference only; no total, never bookable

CHECKOUT = {"available": False, "reason": "checkout_disabled",
            "message": "Checkout is off. This is a price quote only: nothing was reserved, created or charged."}
MAX_MAJOR = 100_000_000  # input bound for any amount (₹10 crore / US$100M)
_CCY = re.compile(r"^[A-Z]{3}$")
_AMOUNT_TEXT = re.compile(r"^[0-9]+(\.[0-9]+)?$")  # plain ASCII digits only: no sign, exponent, NaN or other scripts
_ONE = Decimal(1)


class PricingError(Exception):
    """Invalid input. `status` is the HTTP status the API answers with."""

    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


# ── Arithmetic (R1–R5) ───────────────────────────────────────────────────────
def pct_minor(minor: int, bp: int) -> int:
    """`bp` basis points of `minor`, to the nearest minor unit, half up (R2)."""
    return int((Decimal(minor) * bp / Decimal(10_000)).quantize(_ONE, rounding=ROUND_HALF_UP))


def tax_inclusive_split(total_minor: int, rate_bp: int) -> tuple[int, int]:
    """(base, tax) of a tax-inclusive total (R3)."""
    base = int((Decimal(total_minor) * 10_000 / Decimal(10_000 + rate_bp)).quantize(_ONE, rounding=ROUND_HALF_UP))
    return base, total_minor - base


def round_whole(minor: int, per_major: int = 100) -> int:
    """To a whole major unit, half up (R4). Used only where a whole-rupee amount is required."""
    return int((Decimal(minor) / per_major).quantize(_ONE, rounding=ROUND_HALF_UP)) * per_major


def allocate(base_minor: int, teacher_bp: int) -> dict:
    """Teacher and NOSTOPS shares of a base; they always add up to the base (R5)."""
    teacher = pct_minor(base_minor, teacher_bp)
    return {"teacher_minor": teacher, "nostops_minor": base_minor - teacher}


def money(minor: int, currency: str) -> dict:
    per = R.MINOR_PER_MAJOR[currency]
    return {"minor": int(minor), "value": str((Decimal(minor) / per).quantize(Decimal("0.01"))), "currency": currency}


def minor_to_number(minor: int, per_major: int = 100):
    """A JSON number in major units: an int when whole (2125), else exact to the paisa (1062.5)."""
    return int(minor // per_major) if minor % per_major == 0 else float(Decimal(minor) / per_major)


def to_minor(value, *, field: str, currency: str = "INR", strict: bool = True) -> int:
    """Major units (int, or a decimal string / number with at most 2 places) → minor units.
    strict=False rounds a stored value to the nearest minor unit (half up) instead of refusing."""
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise PricingError(f"{field}_invalid", f"{field} must be an amount.")
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("-") and _AMOUNT_TEXT.match(text[1:]):
            raise PricingError(f"{field}_negative", f"{field} cannot be negative.")
        if not _AMOUNT_TEXT.match(text):
            raise PricingError(f"{field}_invalid", f"{field} must be an amount.")
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        raise PricingError(f"{field}_invalid", f"{field} must be an amount.") from None
    if not d.is_finite():
        raise PricingError(f"{field}_invalid", f"{field} must be an amount.")
    if d < 0:
        raise PricingError(f"{field}_negative", f"{field} cannot be negative.")
    if d > MAX_MAJOR:
        raise PricingError(f"{field}_too_large", f"{field} is too large.")
    scaled = d * R.MINOR_PER_MAJOR[currency]
    if strict and scaled != scaled.to_integral_value():
        raise PricingError(f"{field}_precision", f"{field} can have at most 2 decimal places.")
    return int(scaled.quantize(_ONE, rounding=ROUND_HALF_UP))


def _int(inputs: dict, name: str, lo: int, hi: int, *, required: bool = False, default: Optional[int] = None) -> Optional[int]:
    v = inputs.get(name)
    if v is None:
        if required:
            raise PricingError(f"{name}_required", f"{name} is required.")
        return default
    if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
        raise PricingError(f"{name}_invalid", f"{name} must be a whole number from {lo} to {hi}.")
    return v


# ── Country and currency (server-side; a browser choice alone is never proof) ─
def resolve_region(billing_country, currency) -> tuple[str, str, Optional[str]]:
    if not str(billing_country or "").strip():
        raise PricingError("billing_country_required", payment_routing.MESSAGES["billing_country_required"], 400)
    bc = payment_routing.country_code(billing_country)
    if not bc:
        raise PricingError("billing_country_invalid", payment_routing.MESSAGES["billing_country_invalid"], 400)
    region = R.DOMESTIC if bc == payment_routing.DOMESTIC_COUNTRY else R.INTL
    claimed = None
    if currency not in (None, ""):
        claimed = str(currency).strip().upper()
        if not _CCY.match(claimed):
            raise PricingError("currency_invalid", payment_routing.MESSAGES["currency_invalid"], 400)
        if claimed not in R.MINOR_PER_MAJOR:
            raise PricingError("currency_not_supported", "Prices are quoted in INR (India) or USD (outside India) only.")
        expected = "INR" if region == R.DOMESTIC else "USD"
        if claimed != expected:  # the client can never pick the currency; it can only claim the server's
            key = "domestic_currency_not_supported" if region == R.DOMESTIC else "international_currency_not_supported"
            raise PricingError("currency_not_allowed_for_country", payment_routing.MESSAGES[key])
    return bc, region, claimed


# ── Quote ────────────────────────────────────────────────────────────────────
def _skeleton(product: str, spec: dict, bc: str, region: str) -> dict:
    return {
        "rule_version": R.RULESET_VERSION, "product": product, "price_status": None, "approval": None,
        "owner": spec.get("owner"), "billing_country": bc, "region": region,
        "currency": "INR" if region == R.DOMESTIC else "USD", "quantity": 1,
        "line_items": [], "discounts": [], "tax": None, "rounding": None, "subtotal": None, "total": None,
        "allocation": None, "remote_comparison": None, "client_reference": None, "unavailable_reason": None,
        "notes": [], "checkout": dict(CHECKOUT),
    }


def _unavailable(q: dict, reason: str, message: str) -> dict:
    q.update(price_status=UNAVAILABLE, unavailable_reason=reason, total=None, subtotal=None)
    q["notes"].append(message)
    return q


def _intl_unavailable(q: dict) -> dict:
    return _unavailable(q, "international_price_not_approved",
                        "No approved international (USD) price exists for this item. Nothing is converted from INR.")


def _tax_block(product: str, region: str, currency: str, taxable_minor: Optional[int], tax_minor: Optional[int]) -> dict:
    rule = R.TAX_RULES.get((product, region))
    if not rule:
        return {"treatment": R.NOT_CONFIGURED, "jurisdiction": region, "amount": None, "note": R.TAX_NOT_CONFIGURED_NOTE}
    return {"treatment": rule["treatment"], "rate_bp": rule["rate_bp"], "jurisdiction": region, "approval": rule["approval"],
            "included_in_list_price": rule["treatment"] == "GST_INCLUSIVE",
            "taxable_base": money(taxable_minor, currency), "amount": money(tax_minor, currency), "source": rule["source"]}


def _no_allocation(reason: str, message: str) -> dict:
    return {"status": "UNAVAILABLE", "reason": reason, "note": message, "executable": False}


def _fixed(q: dict, product: str, spec: dict, inputs: dict) -> dict:
    _int(inputs, "quantity", 1, 1, default=1)
    region, bc = q["region"], q["billing_country"]
    price = spec["prices"].get(region)
    if not price:
        return _intl_unavailable(q) if region == R.INTL else _unavailable(q, "price_not_configured", "No price is configured.")
    if region == R.INTL and bc in payment_routing.PAYPAL_UNSUPPORTED_COUNTRIES:
        return _unavailable(q, "provider_not_supported_in_country",
                            payment_routing.MESSAGES["provider_not_supported_in_country"])
    cur, list_minor = price["currency"], price["list_minor"]
    q.update(currency=cur, approval=price["approval"])
    rule = R.TAX_RULES.get((product, region))
    if rule and rule["treatment"] == "GST_INCLUSIVE":
        base, tax = tax_inclusive_split(list_minor, rule["rate_bp"])
    elif rule and rule["treatment"] == "GST_EXCLUSIVE":
        base, tax = list_minor, pct_minor(list_minor, rule["rate_bp"])
    else:
        base, tax = list_minor, None
    q["line_items"].append({"code": "base", "label": "Price before tax" if rule else "Price", "amount": money(base, cur)})
    q["tax"] = _tax_block(product, region, cur, base if rule else None, tax)
    subtotal = base + (tax or 0)
    total = round_whole(subtotal, R.MINOR_PER_MAJOR[cur]) if spec.get("payable_whole_units") else subtotal
    if total != subtotal:
        q["rounding"] = {"rule": "R4", "label": "Rounded to a whole rupee" if cur == "INR" else "Rounded to a whole unit",
                         "amount": money(total - subtotal, cur)}
    q.update(subtotal=money(subtotal, cur), total=money(total, cur), price_status=CONFIRMED)
    if price.get("note"):
        q["notes"].append(price["note"])
    return q


def _event_fee(q: dict, spec: dict, inputs: dict, event: Optional[dict]) -> dict:
    _int(inputs, "quantity", 1, 1, default=1)  # one registration per participant; no group price exists
    if not inputs.get("event_id"):
        raise PricingError("event_id_required", "event_id is required.")
    if not event or str(event.get("visibility") or "").upper() == "PRIVATE":
        raise PricingError("event_not_found", "Event not found.", 404)
    q["event_id"] = event.get("event_id")
    if q["region"] == R.INTL:
        return _intl_unavailable(q)
    if event.get("status") not in spec["open_statuses"]:
        return _unavailable(q, "event_not_open", "This event is not open for registration.")
    q["approval"] = R.ORGANISER_SET
    q["tax"] = _tax_block("institutional_event_fee", q["region"], "INR", None, None)
    q["allocation"] = _no_allocation("no_contract_revenue_base",
                                     "No approved contract defines the revenue base for participant-paid event fees.")
    if str(event.get("pricing_type") or "FREE").upper() != "PAID":
        q["line_items"].append({"code": "free", "label": "Free event: no payment", "amount": money(0, "INR")})
        q.update(subtotal=money(0, "INR"), total=money(0, "INR"), price_status=CONFIRMED, pricing_type="FREE")
        return q
    try:
        fee = event_fee_minor(event.get("participant_fee"))
    except PricingError:
        return _unavailable(q, "fee_not_configured", "This event's fee is not configured. No amount is quoted.")
    q["line_items"].append({"code": "participant_fee", "label": "Participant fee (per participant, per session)",
                            "amount": money(fee, "INR")})
    q.update(subtotal=money(fee, "INR"), total=money(fee, "INR"), price_status=CONFIRMED, pricing_type="PAID")
    return q


def _rate_card(q: dict, spec: dict, inputs: dict) -> dict:
    rc = R.RATE_CARD
    cohort = str(inputs.get("cohort") or "").strip().upper()
    if cohort not in rc["cohorts"]:
        raise PricingError("cohort_invalid", f"cohort must be one of {sorted(rc['cohorts'])}.")
    months = inputs.get("months")
    if isinstance(months, bool) or months not in rc["months"]:
        raise PricingError("months_invalid", "months must be 1, 3, 6 or 12.")
    people = _int(inputs, "participants", 1, rc["participants_input_max"], required=True)
    if q["region"] == R.INTL:
        return _intl_unavailable(q)
    c = rc["cohorts"][cohort]
    # Prompt 3C (founder option A): the group-size discounts are suspended, so the list rate applies at
    # every size and length. The bands are reported only with the UNAPPROVED banner, never applied.
    rate = c["rate_minor"]
    sessions = rc["sessions_per_month"] * months
    total = rate * sessions * people
    q["quantity"] = people
    q["line_items"].append({"code": "sessions", "label": f"{sessions} sessions × {people} participants at the list rate",
                            "unit_amount": money(rate, "INR"), "units": sessions * people,
                            "amount": money(total, "INR")})
    q["rate_card"] = {"cohort": cohort, "list_rate_only": True, "discounts_suspended": rc["discounts_suspended"],
                      "rate_per_session": money(rate, "INR"), "per_participant": money(rate * sessions, "INR"),
                      "suggested_whole_rupee_fee": money(round_whole(rate), "INR"), "suggested_fee_rule": "R4",
                      "unapproved_bands": [{"band": f"{b['min']}–{b['max']}", "label": R.UNAPPROVED_BANNER,
                                            "applied": False} for b in rc["bands"]] if c["unapproved_bands"] else []}
    q["tax"] = _tax_block("org_programme_rate_card", q["region"], "INR", None, None)
    q["allocation"] = _no_allocation("no_contract_revenue_base", "An estimate has no contract, so no revenue split applies.")
    q.update(subtotal=money(total, "INR"), total=money(total, "INR"), price_status=ESTIMATE, approval=R.UNAPPROVED)
    q["notes"] += [spec["note"], "A second (legacy batch) ladder also exists; it is not chosen here.",
                   R.PLANNING_ASSUMPTIONS[0]["text"]]
    return q


def _contract_allocation(q: dict, inputs: dict) -> dict:
    term = _int(inputs, "contract_term_months", 1, 120, required=True)
    if q["region"] == R.INTL:
        return _intl_unavailable(q)
    base = to_minor(inputs.get("contract_revenue_base"), field="contract_revenue_base")
    if base <= 0:
        raise PricingError("contract_revenue_base_invalid", "contract_revenue_base must be more than zero.")
    split = R.CONTRACT_REVENUE_SHARE["terms"].get(term)
    q["price_status"] = ALLOCATION_ONLY
    if not split:
        q["allocation"] = _no_allocation("no_approved_split_for_term",
                                         f"No approved revenue split exists for a {term}-month programme (only 3, 6 or 12).")
        return q
    a = allocate(base, split["teacher_bp"])
    q["approval"] = R.CONTRACT_REVENUE_SHARE["approval"]
    q["allocation"] = {"status": "FOR_REVIEW_ONLY", "executable": False, "rule": f"contract_term_{term}_months",
                       "scope": R.CONTRACT_REVENUE_SHARE["scope"],
                       "basis": "the contract revenue base sent by the caller (not verified by this server)",
                       "revenue_base": money(base, "INR"), "teacher_bp": split["teacher_bp"], "nostops_bp": split["nostops_bp"],
                       "teacher_share": money(a["teacher_minor"], "INR"), "nostops_share": money(a["nostops_minor"], "INR"),
                       "reconciles": a["teacher_minor"] + a["nostops_minor"] == base}
    return q


def _retreat_allocation(remote: Optional[int]) -> dict:
    """The 30% NOSTOPS / 70% teacher retreat split, applied only where it is approved, and then only
    as a for-review split of the amount read from the main backend. Never a 15% or 0% default."""
    fee = R.RETREAT_PLATFORM_FEE
    rule = {"approval": fee["approval"], "nostops_bp": fee["nostops_bp"], "teacher_bp": fee["teacher_bp"], "applied": False}
    if fee["approval"] != R.APPROVED:
        return {**_no_allocation("no_approved_retreat_rule",
                                 "No approved retreat-specific rule confirms a split, so none is applied (no 15% or 0% default)."),
                "discussed_rule": rule}
    if remote is None:
        return {**_no_allocation("no_amount", "Send the amount read from the main backend to see the split."),
                "discussed_rule": rule}
    a = allocate(remote, fee["teacher_bp"])
    return {"status": "FOR_REVIEW_ONLY", "executable": False, "approval": fee["approval"], "rule": "retreat_platform_fee",
            "basis": "the amount read from the main backend (not verified by this server)",
            "revenue_base": money(remote, "INR"), "teacher_bp": fee["teacher_bp"], "nostops_bp": fee["nostops_bp"],
            "teacher_share": money(a["teacher_minor"], "INR"), "nostops_share": money(a["nostops_minor"], "INR"),
            "reconciles": a["teacher_minor"] + a["nostops_minor"] == remote}


def _legacy_group_reference(q: dict, inputs: dict) -> dict:
    """Founder option A: the ₹5,000 baseline and the legacy group ladder as an UNAPPROVED, indicative
    reference. There is no total, nothing is payable or bookable, and the ladder is not approved."""
    ref = R.LEGACY_GROUP_REFERENCE
    people = _int(inputs, "participants", 1, ref["participants_max"], required=True)
    months = inputs.get("months")
    if months is not None and (isinstance(months, bool) or months not in R.RATE_CARD["months"]):
        raise PricingError("months_invalid", "months must be 1, 3, 6 or 12.")
    q.update(quantity=people, banner=ref["banner"],
             booking={"available": False, "reason": "unapproved_price", "message": ref["banner"]})
    if q["region"] == R.INTL:
        return _intl_unavailable(q)
    tier = next((t for t in ref["tiers"] if people >= t["min"]), None)
    pct = tier["pct_bp"] if tier else 0
    base = ref["baseline_minor"]
    rate = base - pct_minor(base, pct)
    q.update(price_status=UNAPPROVED_REFERENCE, approval=R.UNAPPROVED, unavailable_reason="unapproved_price_booking_unavailable")
    q["indicative_reference"] = {
        "label": ref["banner"], "approval": R.UNAPPROVED, "confirmed": False, "payable": False, "bookable": False,
        "baseline": money(base, "INR"), "baseline_unit": ref["baseline_unit"],
        "legacy_tiers": [dict(t) for t in ref["tiers"]], "tiers_commercially_approved": False,
        "tier_pct_bp_for_headcount": pct,
        "indicative_rate_per_participant": money(rate, "INR"),
        "indicative_group_amount": money(rate * people, "INR"),
        "indicative_group_amount_basis": f"indicative rate × {people} participants, for one period of the baseline unit",
        "term_total": None if months is None else {"status": UNAVAILABLE, "months": months,
                                                     "reason": "legacy_term_total_inconsistent", "note": ref["term_total_note"]},
        "source": ref["source"],
    }
    q["tax"] = _tax_block("org_group_booking_legacy", q["region"], "INR", None, None)
    q["allocation"] = _no_allocation("no_contract_revenue_base", "An unapproved reference has no contract, so no revenue split applies.")
    q["notes"] += [ref["banner"], "The legacy discount tiers have not been commercially approved.",
                   "This is not a payable amount. No order, booking or registration can be created from it."]
    return q


def _remote(q: dict, product: str, spec: dict, inputs: dict) -> dict:
    people = None
    if product == "retreat_group":
        people = _int(inputs, "participants", 2, 500, required=True)
    elif product == "org_legacy_batch":
        people = _int(inputs, "participants", 1, R.RATE_CARD["participants_input_max"])
    else:
        _int(inputs, "quantity", 1, 1, default=1)
    if q["region"] == R.INTL:
        return _intl_unavailable(q)
    q["price_status"] = REMOTE_REFERENCE
    q["notes"].append("The main backend (pro-learn-connect-1) owns this price. This server does not set or enforce it.")
    q["tax"] = _tax_block(product, q["region"], "INR", None, None)
    ref = (spec.get("reference") or {}).get(q["region"])
    q["website_reference"] = money(ref["minor"], "INR") if ref else None
    remote = None
    if inputs.get("remote_amount") is not None:
        remote = to_minor(inputs["remote_amount"], field="remote_amount")
        q["remote_comparison"] = {"remote_amount": money(remote, "INR"), "website_reference": q["website_reference"],
                                  "matches": (remote == ref["minor"]) if ref else None, "enforced": False}
    if people is not None:
        q["quantity"] = people
    if product == "one_on_one":
        split = R.ONE_ON_ONE_DISPLAY_SPLIT
        if remote is None:
            q["allocation"] = _no_allocation("no_amount", "Send the booking amount read from the main backend to see the split.")
        else:
            a = allocate(remote, split["teacher_bp"])
            q["allocation"] = {"status": "FOR_REVIEW_ONLY", "executable": False, "approval": split["approval"],
                               "rule": "one_on_one_display_split", "note": "The main backend does the real split.",
                               "revenue_base": money(remote, "INR"), "teacher_bp": split["teacher_bp"],
                               "nostops_bp": split["platform_bp"], "teacher_share": money(a["teacher_minor"], "INR"),
                               "nostops_share": money(a["nostops_minor"], "INR"), "reconciles": True}
    elif product in ("retreat_seat", "retreat_group"):
        q["allocation"] = _retreat_allocation(remote)
        q["notes"].append("Early-bird, limited-time and teacher-cohort offers written in a retreat's description are "
                          "UNVERIFIED and not shown: the listed price is the one shown, and the amount payable is the "
                          "one the main backend confirms at booking.")
        if product == "retreat_group":
            lad = R.PUBLIC_RETREAT_GROUP_LADDER
            q["public_group_ladder"] = {"approval": lad["approval"], "reference_only": True, "label": lad["banner"],
                                        "tiers": [dict(t) for t in lad["tiers"]], "applied": False,
                                        "note": "Reference tiers only: never a discounted total, saving or payable price."}
    elif product == "org_legacy_batch":
        tier = next((t for t in R.LEGACY_BATCH_TIERS if people is not None and people >= t["min"]), None)
        q["legacy_batch_copy"] = {"approval": R.UNAPPROVED, "tiers": [dict(t) for t in R.LEGACY_BATCH_TIERS],
                                  "pct_bp_for_headcount": tier["pct_bp"] if tier else 0 if people is not None else None,
                                  "applied": False, "note": "The main backend locks the final rate when enrollment closes."}
    return q


def quote(inputs: dict, *, event: Optional[dict] = None) -> dict:
    """The quote for validated `inputs` (see pricing_api.QuoteIn). `event` is the institutional event
    record (read by the API layer) for product institutional_event_fee."""
    product = str(inputs.get("product") or "").strip()
    if not product:
        raise PricingError("product_required", "product is required.")
    spec = R.PRODUCTS.get(product)
    if spec is None:
        raise PricingError("unknown_product", "This product has no pricing rule.", 400)
    version = inputs.get("rule_version")
    if version not in (None, "") and version != R.RULESET_VERSION:
        raise PricingError("unknown_rule_version", f"Unknown pricing rule version. Current: {R.RULESET_VERSION}.", 409)
    bc, region, _claimed = resolve_region(inputs.get("billing_country"), inputs.get("currency"))
    q = _skeleton(product, spec, bc, region)
    kind = spec["kind"]
    if kind == "FIXED":
        _fixed(q, product, spec, inputs)
    elif kind == "EVENT_FEE":
        _event_fee(q, spec, inputs, event)
    elif kind == "RATE_CARD":
        _rate_card(q, spec, inputs)
    elif kind == "ALLOCATION":
        _contract_allocation(q, inputs)
    elif kind == "REMOTE":
        _remote(q, product, spec, inputs)
    elif kind == "LEGACY_REFERENCE":
        _legacy_group_reference(q, inputs)
    else:  # NOT_QUOTABLE
        _int(inputs, "quantity", 1, 1, default=1)
        _unavailable(q, spec["reason"], spec["message"])
    if inputs.get("client_total") is not None:  # compared only; never used
        sent = to_minor(inputs["client_total"], field="client_total", currency=q["currency"])
        q["client_reference"] = {"sent": money(sent, q["currency"]), "used": False,
                                 "matches": (sent == q["total"]["minor"]) if q["total"] else None}
    q["quote_id"] = "q_" + hashlib.sha256(json.dumps(q, sort_keys=True).encode()).hexdigest()[:24]
    return q


# ── Helpers used by existing routes (same results as before) ────────────────
def event_fee_minor(fee) -> int:
    """An organiser's per-event fee (whole rupees, 1 – 10,00,000) in paise; anything else is refused."""
    spec = R.PRODUCTS["institutional_event_fee"]
    if isinstance(fee, bool) or not isinstance(fee, (int, float)) or (isinstance(fee, float) and not fee.is_integer()):
        raise PricingError("fee_not_configured", "The event fee is not configured.", 400)
    if not spec["fee_min_major"] <= int(fee) <= spec["fee_max_major"]:
        raise PricingError("fee_not_configured", "The event fee is not configured.", 400)
    return int(fee) * 100


def one_on_one_teacher_net_minor(amount) -> int:
    """The teacher's display share (85%) of a stored 1:1 amount, exact to the paisa (R2)."""
    if amount in (None, "") or isinstance(amount, bool):
        return 0
    try:
        minor = to_minor(amount, field="amount_inr", strict=False)
    except PricingError:
        return 0
    return allocate(minor, R.ONE_ON_ONE_DISPLAY_SPLIT["teacher_bp"])["teacher_minor"]


def ai_onboarding_table() -> dict:
    """The venue AI onboarding price table in its existing shape {currency, base, gst_pct, total}."""
    out = {}
    for region in (R.DOMESTIC, R.INTL):
        q = quote({"product": "venue_ai_onboarding", "billing_country": "IN" if region == R.DOMESTIC else "US"})
        per = R.MINOR_PER_MAJOR[q["currency"]]
        rule = R.TAX_RULES.get(("venue_ai_onboarding", region))
        out[region] = {"currency": q["currency"],
                       "base": minor_to_number(R.PRODUCTS["venue_ai_onboarding"]["prices"][region]["list_minor"], per),
                       "gst_pct": rule["rate_bp"] // 100 if rule else 0,
                       "total": minor_to_number(q["total"]["minor"], per)}
    return out


def public_rules() -> dict:
    """The rule set in a readable form (no secrets, no records)."""
    return {
        "rule_version": R.RULESET_VERSION, "rounding_rules": R.ROUNDING_RULES,
        "products": {k: {"kind": v["kind"], "owner": v.get("owner")} for k, v in R.PRODUCTS.items()},
        "tax_rules": [{"product": p, "jurisdiction": j, **{k: v for k, v in r.items()}} for (p, j), r in R.TAX_RULES.items()],
        "contract_revenue_share": R.CONTRACT_REVENUE_SHARE, "retreat_platform_fee": R.RETREAT_PLATFORM_FEE,
        "one_on_one_display_split": R.ONE_ON_ONE_DISPLAY_SPLIT, "public_retreat_group_ladder": R.PUBLIC_RETREAT_GROUP_LADDER,
        "legacy_group_reference": R.LEGACY_GROUP_REFERENCE, "retreat_host_offers": R.RETREAT_HOST_OFFERS,
        "rate_card": {"discounts_suspended": R.RATE_CARD["discounts_suspended"], "unapproved_banner": R.UNAPPROVED_BANNER,
                      "list_rates": {k: v["rate_minor"] for k, v in R.RATE_CARD["cohorts"].items()}},
        "planning_assumptions": list(R.PLANNING_ASSUMPTIONS), "unresolved": list(R.UNRESOLVED),
        "checkout": dict(CHECKOUT),
    }
