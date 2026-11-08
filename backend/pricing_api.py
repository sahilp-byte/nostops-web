"""Prompt 3 (2026-10) — quote-only pricing API (website backend).

POST /api/pricing/quote — the canonical server-side quote (pricing_engine.quote).
GET  /api/pricing/rules — the current rule set (version, rounding, tax, allocation rules).

Both need the website's shared secret (X-Pulse-Secret), like the other local modules; the
browser never calls them directly. This module NEVER writes: no order, hold, registration,
payment attempt or financial record is created. The only read is the institutional event (fee,
status, visibility). Unknown fields — a client "discount", "total" or "currency override" — are
refused. Each quote is logged as one structured line (rule version, product, currency, quantity,
outcome, correlation id); no personal data, tokens or payment details are logged.
"""
import hmac
import json
import logging
import os
import re
import time
import uuid
from typing import Optional, Union

from fastapi import APIRouter, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field

import pricing_engine
import pricing_rules

SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
_db = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "nostops_web")]
events = _db["inst_events"]  # read-only here (find_one with a projection)
_EVENT_FIELDS = {"_id": 0, "event_id": 1, "status": 1, "visibility": 1, "pricing_type": 1, "participant_fee": 1}
_CORRELATION = re.compile(r"^[A-Za-z0-9_.:-]{8,64}$")

logger = logging.getLogger("nostops.pricing")
router = APIRouter(prefix="/api/pricing", tags=["pricing"])

Amount = Union[int, str]


class QuoteIn(BaseModel):
    # extra="forbid": a client "discount_pct" or "total" is refused (422). strict=True: no type coercion
    # (true, "5" or 12.5 is refused where a whole number is expected).
    model_config = ConfigDict(extra="forbid", strict=True)

    product: str = Field(min_length=1, max_length=40)
    billing_country: Optional[str] = Field(default=None, max_length=8)
    currency: Optional[str] = Field(default=None, max_length=8)
    quantity: Optional[int] = None
    participants: Optional[int] = None
    months: Optional[int] = None
    cohort: Optional[str] = Field(default=None, max_length=40)
    event_id: Optional[str] = Field(default=None, max_length=64)
    contract_term_months: Optional[int] = None
    contract_revenue_base: Optional[Amount] = None
    remote_amount: Optional[Amount] = None   # an amount read from the main backend, for comparison only
    client_total: Optional[Amount] = None    # what the browser showed: compared, never used
    rule_version: Optional[str] = Field(default=None, max_length=64)


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


def _log(entry: dict) -> None:
    logger.info(json.dumps({"event": "pricing_quote", **entry}, sort_keys=True))


@router.get("/rules")
async def rules(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    return pricing_engine.public_rules()


@router.post("/quote")
async def quote(body: QuoteIn, x_pulse_secret: Optional[str] = Header(None),
                x_request_id: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    cid = x_request_id if x_request_id and _CORRELATION.match(x_request_id) else f"pq_{uuid.uuid4().hex[:20]}"
    inputs = body.model_dump()
    base_log = {"correlation_id": cid, "rule_version": pricing_rules.RULESET_VERSION, "product": body.product,
                "quantity": body.quantity, "participants": body.participants, "at": int(time.time() * 1000)}
    event = None
    if body.product == "institutional_event_fee" and body.event_id:
        event = await events.find_one({"event_id": body.event_id}, _EVENT_FIELDS)
    try:
        q = pricing_engine.quote(inputs, event=event)
    except pricing_engine.PricingError as e:
        _log({**base_log, "outcome": "refused", "code": e.code})
        raise HTTPException(status_code=e.status, detail={"error": e.code, "message": e.message,
                                                          "rule_version": pricing_rules.RULESET_VERSION}) from None
    _log({**base_log, "outcome": q["price_status"], "currency": q["currency"], "quote_id": q["quote_id"],
          "discount_rules": [d["rule"] for d in q["discounts"]], "unavailable_reason": q["unavailable_reason"]})
    return {"quote": q, "correlation_id": cid}
