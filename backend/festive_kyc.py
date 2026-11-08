"""NOSTOPS Festive Season Complimentary InstaKYC (campaign NOSTOPS_FESTIVE_INSTA_KYC_2026).

The website's own backend runs the campaign engine (owner decision, June 2026):
  * one central campaign config (Mongo `promo_campaigns`, seeded from CAMPAIGN_DEFAULTS),
  * eligibility evaluated on the SERVER clock (IST-aware), revalidated on every claim,
  * one atomic, idempotent claim per account (unique indexes, no read-then-write race),
  * audit trail (`promo_claim_audit`) + KYC status history on the claim record.

Teacher facts (role, verified +91 mobile, profile completeness, KYC paid/verified, level) are read
by the website BFF from the main NOSTOPS app with the teacher's own session and sent here with
X-Pulse-Secret; the account comes ONLY from X-Pulse-User (built from the httpOnly session), so a
claim can never be applied to another account. Profile completeness is the website's existing
score (computeProfileCompleteness) — not recalculated here.

Fee waiver ≠ verification waiver: a claim never marks anyone verified. The main NOSTOPS app keeps
every verification step and admin approve/reject. NOTE: the main app currently refuses
verification until its own `kyc_paid` flag is true — see /app/BACKEND_REQUEST_festive_instakyc.md.
No payment gateway is called anywhere in this module.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import venues
from institutional import admin_only_user, current_user
from org_enquiries import _check_secret

router = APIRouter(prefix="/api/festive-kyc", tags=["festive-kyc"])
db = venues.db
campaigns = db["promo_campaigns"]
claims = db["promo_claims"]
audit = db["promo_claim_audit"]

IST = timezone(timedelta(hours=5, minutes=30))
CAMPAIGN_ID = "NOSTOPS_FESTIVE_INSTA_KYC_2026"
CAMPAIGN_DEFAULTS = {
    "_id": CAMPAIGN_ID,
    "name": "NOSTOPS Festive Season Complimentary InstaKYC",
    "starts_at": datetime(2026, 11, 1, 0, 0, 0, tzinfo=IST),
    "ends_at": datetime(2026, 12, 31, 23, 59, 59, 999999, tzinfo=IST),
    "min_profile_percent": 80,
    "persona": "teacher",
    "geography": "IN",  # India = verified +91 mobile on the account (owner decision)
    "levels": ["L1", "L2", "L3"],
    "promo_fee_inr": 0,
    "enabled": True,
}
LEVEL_LABELS = {"L1": "Yoga Shikshak", "L2": "Yoga Pracharak", "L3": "Yoga Guru"}

REASONS = {
    "campaign_disabled": "This campaign is not running.",
    "campaign_not_started": "The festive offer starts on 1 November 2026.",
    "campaign_ended": "The festive offer ended on 31 December 2026.",
    "not_teacher": "This offer is only for Yoga Teacher accounts.",
    "not_india": "This offer is for teachers with a verified Indian (+91) mobile number.",
    "profile_incomplete": "Complete at least 80% of your profile to qualify.",
    "kyc_completed": "Your InstaKYC fee is already paid or your KYC is already approved.",
    "already_claimed": "You have already claimed this offer.",
    "facts_unavailable": "We could not read your teacher profile right now. Please try again.",
}

_indexes_ready = False


async def _ensure() -> dict:
    global _indexes_ready
    if not _indexes_ready:
        await claims.create_index([("campaign_id", 1), ("user_id", 1)], unique=True, name="uniq_campaign_user")
        await claims.create_index(
            [("campaign_id", 1), ("teacher_id", 1)], unique=True, name="uniq_campaign_teacher",
            partialFilterExpression={"teacher_id": {"$type": "string"}},
        )
        await audit.create_index([("campaign_id", 1), ("at", -1)])
        _indexes_ready = True
    await campaigns.update_one({"_id": CAMPAIGN_ID}, {"$setOnInsert": CAMPAIGN_DEFAULTS}, upsert=True)
    return await campaigns.find_one({"_id": CAMPAIGN_ID})


def _aware(v: datetime) -> datetime:
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


def _iso(v) -> Optional[str]:
    return _aware(v).astimezone(IST).isoformat() if isinstance(v, datetime) else None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Teacher facts (sent by the BFF, read from the main app with the teacher's session) ──
class Facts(BaseModel):
    available: bool = True
    role: str = ""
    teacher_id: Optional[str] = None
    level: Optional[str] = None  # L1 | L2 | L3
    phone_verified: bool = False
    phone_is_indian: bool = False  # +91 — the number itself is never stored here
    profile_percent: float = Field(0, ge=0, le=100)
    missing_sections: List[str] = []
    kyc_paid: bool = False
    kyc_verified: bool = False
    aadhaar_verified: bool = False
    pan_verified: bool = False
    bank_verified: bool = False
    verification_rejected: bool = False
    standard_fee_inr: Optional[float] = None  # main app GET /kyc/pricing


def kyc_stage(f: Facts) -> str:
    """eligibility/claim are separate; this is only the KYC verification stage."""
    if f.kyc_verified:
        return "approved"
    if f.verification_rejected:
        return "rejected"
    if f.aadhaar_verified and (f.pan_verified or f.bank_verified):
        return "under_review"
    if f.aadhaar_verified or f.pan_verified or f.bank_verified:
        return "submitted"
    return "not_started"


def campaign_window(cfg: dict, now: datetime) -> Optional[str]:
    if not cfg.get("enabled", True):
        return "campaign_disabled"
    if now < _aware(cfg["starts_at"]):
        return "campaign_not_started"
    if now > _aware(cfg["ends_at"]):
        return "campaign_ended"
    return None


def evaluate(cfg: dict, f: Facts, claim: Optional[dict], now: datetime) -> dict:
    """Pure eligibility check (unit-tested with any `now`). Every failing reason is returned."""
    reasons: List[str] = []
    w = campaign_window(cfg, now)
    if w:
        reasons.append(w)
    if not f.available:
        reasons.append("facts_unavailable")
    else:
        if f.role != "teacher" or not f.teacher_id:
            reasons.append("not_teacher")
        if not (f.phone_verified and f.phone_is_indian):
            reasons.append("not_india")
        if f.profile_percent < cfg["min_profile_percent"]:
            reasons.append("profile_incomplete")
        if (f.kyc_paid or f.kyc_verified) and not claim:
            reasons.append("kyc_completed")
    if claim:
        reasons.append("already_claimed")
    return {"eligible": not reasons, "reasons": reasons}


def _fee(cfg: dict, f: Facts, eligible: bool, claim: Optional[dict]) -> dict:
    standard = f.standard_fee_inr
    if claim and claim.get("waiver_status") == "applied":
        # A waiver applied before expiry is honoured after the campaign ends.
        return {"applicable_fee_inr": 0, "standard_fee_inr": standard, "fee_waived": True, "payment_required": False}
    if eligible:
        return {"applicable_fee_inr": cfg["promo_fee_inr"], "standard_fee_inr": standard, "fee_waived": False, "payment_required": False}
    return {"applicable_fee_inr": standard, "standard_fee_inr": standard, "fee_waived": False,
            "payment_required": not (f.kyc_paid or f.kyc_verified)}


def _next_action(eligible: bool, claim: Optional[dict], stage: str, reasons: List[str]) -> str:
    if claim:
        return {"approved": "none", "rejected": "correct_kyc", "under_review": "await_review"}.get(stage, "complete_kyc_verification")
    if eligible:
        return "claim_offer"
    if "profile_incomplete" in reasons and len([r for r in reasons if r != "profile_incomplete"]) == 0:
        return "complete_profile"
    return "standard_kyc"


def _public_claim(c: Optional[dict]) -> Optional[dict]:
    if not c:
        return None
    return {
        "claim_id": c["claim_id"], "kyc_reference_id": c["kyc_reference_id"], "claimed_at": _iso(c["claimed_at"]),
        "teacher_level": c.get("teacher_level"), "promotional_fee_inr": c["promotional_fee_inr"],
        "original_fee_inr": c.get("original_fee_inr"), "waiver_status": c["waiver_status"],
        "outcome": c["outcome"], "kyc_stage": c.get("kyc_stage"),
        "main_app_fee_settled": bool(c.get("main_app_fee_settled")),
    }


async def _status(cfg: dict, user_id: str, f: Facts, now: datetime) -> dict:
    claim = await claims.find_one({"campaign_id": CAMPAIGN_ID, "user_id": user_id})
    ev = evaluate(cfg, f, claim, now)
    stage = kyc_stage(f)
    w = campaign_window(cfg, now)
    return {
        "campaign_id": CAMPAIGN_ID,
        "campaign_name": cfg["name"],
        "campaign_active": w is None,
        "campaign_state": {"campaign_not_started": "upcoming", "campaign_ended": "ended", "campaign_disabled": "disabled"}.get(w or "", "active"),
        "starts_at": _iso(cfg["starts_at"]), "ends_at": _iso(cfg["ends_at"]),
        "server_time": _iso(now),
        "eligible": ev["eligible"],
        "reasons": ev["reasons"],
        "reason_messages": [REASONS[r] for r in ev["reasons"]],
        "profile_percent": round(f.profile_percent, 1),
        "min_profile_percent": cfg["min_profile_percent"],
        "missing_sections": f.missing_sections,
        "teacher_level": f.level, "teacher_level_label": LEVEL_LABELS.get(f.level or ""),
        "india_eligible": bool(f.phone_verified and f.phone_is_indian),
        "kyc_completed": bool(f.kyc_paid or f.kyc_verified),
        "kyc_stage": stage,
        "claim_status": "claimed" if claim else "not_claimed",
        "claim": _public_claim(claim),
        **_fee(cfg, f, ev["eligible"], claim),
        "next_action": _next_action(ev["eligible"], claim, stage, ev["reasons"]),
    }


async def _audit(event: str, user_id: str, f: Optional[Facts], now: datetime, **extra) -> None:
    doc = {"campaign_id": CAMPAIGN_ID, "event": event, "user_id": user_id, "at": now, **extra}
    if f is not None:
        doc.update({"teacher_id": f.teacher_id, "teacher_level": f.level, "profile_percent": round(f.profile_percent, 1),
                    "india_eligible": bool(f.phone_verified and f.phone_is_indian), "kyc_stage": kyc_stage(f)})
    await audit.insert_one(doc)


async def _sync_stage(user_id: str, f: Facts, now: datetime, source: str) -> None:
    """Record a KYC stage change on the claim (+ audit). No-op without a claim or a change."""
    stage = kyc_stage(f)
    res = await claims.update_one(
        {"campaign_id": CAMPAIGN_ID, "user_id": user_id, "kyc_stage": {"$ne": stage}},
        {"$set": {"kyc_stage": stage, "updated_at": now}, "$push": {"status_history": {"stage": stage, "at": now, "source": source}}},
    )
    if res.modified_count:
        await _audit("kyc_status_changed", user_id, f, now, to_stage=stage, source=source)


# ── Routes ──
class FactsIn(BaseModel):
    facts: Facts


@router.get("/public")
async def get_public(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Public campaign window + state for the campaign page (no account data, no eligibility)."""
    _check_secret(x_pulse_secret)
    cfg = await _ensure()
    now = now_utc()
    w = campaign_window(cfg, now)
    return {"campaign_id": CAMPAIGN_ID, "name": cfg["name"], "starts_at": _iso(cfg["starts_at"]), "ends_at": _iso(cfg["ends_at"]),
            "state": {"campaign_not_started": "upcoming", "campaign_ended": "ended", "campaign_disabled": "disabled"}.get(w or "", "active"),
            "min_profile_percent": cfg["min_profile_percent"], "promo_fee_inr": cfg["promo_fee_inr"], "server_time": _iso(now)}


@router.get("/config")
async def get_config(user: dict = Depends(current_user)) -> dict:
    cfg = await _ensure()
    now = now_utc()
    return {"campaign_id": CAMPAIGN_ID, "name": cfg["name"], "starts_at": _iso(cfg["starts_at"]), "ends_at": _iso(cfg["ends_at"]),
            "min_profile_percent": cfg["min_profile_percent"], "persona": cfg["persona"], "geography": cfg["geography"],
            "levels": cfg["levels"], "promo_fee_inr": cfg["promo_fee_inr"], "active": campaign_window(cfg, now) is None,
            "server_time": _iso(now)}


@router.post("/status")
async def status(body: FactsIn, user: dict = Depends(current_user)) -> dict:
    cfg = await _ensure()
    now = now_utc()
    if body.facts.available:
        await _sync_stage(str(user["user_id"]), body.facts, now, "status_read")
    return await _status(cfg, str(user["user_id"]), body.facts, now)


async def claim_offer(user_id: str, f: Facts, now: datetime) -> dict:
    """Atomic + idempotent. Eligibility is re-checked here with the server clock."""
    cfg = await _ensure()
    existing = await claims.find_one({"campaign_id": CAMPAIGN_ID, "user_id": user_id})
    if existing:
        await _audit("claim_duplicate", user_id, f, now, outcome="already_claimed", claim_id=existing["claim_id"])
        return {"ok": True, "duplicate": True, **(await _status(cfg, user_id, f, now))}
    ev = evaluate(cfg, f, None, now)
    if not ev["eligible"]:
        await _audit("claim_rejected", user_id, f, now, outcome="rejected", reasons=ev["reasons"],
                     original_fee_inr=f.standard_fee_inr)
        raise HTTPException(status_code=409, detail={"code": "not_eligible", "reasons": ev["reasons"],
                                                     "message": " ".join(REASONS[r] for r in ev["reasons"])})
    claim_id = "KYCW-" + secrets.token_hex(6).upper()
    stage = kyc_stage(f)
    doc = {
        "campaign_id": CAMPAIGN_ID, "claim_id": claim_id, "kyc_reference_id": claim_id,
        "user_id": user_id, "teacher_id": f.teacher_id, "teacher_level": f.level,
        "claimed_at": now, "profile_percent_at_claim": round(f.profile_percent, 1),
        "india_eligible": True, "original_fee_inr": f.standard_fee_inr, "promotional_fee_inr": cfg["promo_fee_inr"],
        "waiver_status": "applied", "outcome": "claim_applied", "kyc_stage": stage,
        "status_history": [{"stage": stage, "at": now, "source": "claim"}],
        "payment_gateway_invoked": False, "main_app_fee_settled": False,
    }
    try:
        await claims.insert_one(doc)  # unique (campaign,user) + (campaign,teacher): concurrent requests → one wins
    except DuplicateKeyError:
        await _audit("claim_duplicate", user_id, f, now, outcome="already_claimed_concurrent")
        return {"ok": True, "duplicate": True, **(await _status(cfg, user_id, f, now))}
    await _audit("claim_applied", user_id, f, now, outcome="claim_applied", claim_id=claim_id,
                 original_fee_inr=f.standard_fee_inr, promotional_fee_inr=cfg["promo_fee_inr"], waiver_status="applied")
    return {"ok": True, "duplicate": False, **(await _status(cfg, user_id, f, now))}


@router.post("/claim")
async def claim(body: FactsIn, user: dict = Depends(current_user)) -> dict:
    if str(user.get("role")) != "teacher":
        await _audit("claim_rejected", str(user["user_id"]), body.facts, now_utc(), outcome="rejected", reasons=["not_teacher"])
        raise HTTPException(status_code=409, detail={"code": "not_eligible", "reasons": ["not_teacher"], "message": REASONS["not_teacher"]})
    return await claim_offer(str(user["user_id"]), body.facts, now_utc())


class PaymentCheckIn(BaseModel):
    facts: Facts


@router.post("/payment-check")
async def payment_check(body: PaymentCheckIn, user: dict = Depends(current_user)) -> dict:
    """Asked by the BFF before ANY InstaKYC Cashfree order: complimentary → no order may be created."""
    cfg = await _ensure()
    now = now_utc()
    c = await claims.find_one({"campaign_id": CAMPAIGN_ID, "user_id": str(user["user_id"])})
    ev = evaluate(cfg, body.facts, c, now)
    complimentary = bool(c and c.get("waiver_status") == "applied") or ev["eligible"]
    # Qualifies on everything except the start date → don't take ₹279 the day before it is free.
    opens_soon = ev["reasons"] == ["campaign_not_started"]
    if complimentary or opens_soon:
        await _audit("payment_blocked", str(user["user_id"]), body.facts, now, outcome="no_gateway_call",
                     claimed=bool(c), opens_soon=opens_soon)
    return {"complimentary": complimentary or opens_soon, "claimed": bool(c), "eligible": ev["eligible"], "opens_soon": opens_soon}


class AdminKycEvent(BaseModel):
    teacher_id: str = Field(..., min_length=1, max_length=128)
    action: str = Field(..., pattern="^(approve|reject)$")


@router.post("/admin/kyc-event")
async def admin_kyc_event(body: AdminKycEvent, admin: dict = Depends(admin_only_user)) -> dict:
    """Admin approve/reject (done in the main app) recorded against a campaign claim, if any."""
    await _ensure()
    now = now_utc()
    stage = "approved" if body.action == "approve" else "rejected"
    c = await claims.find_one({"campaign_id": CAMPAIGN_ID, "teacher_id": body.teacher_id})
    if not c:
        return {"ok": True, "claim": False}
    await claims.update_one({"_id": c["_id"]}, {"$set": {"kyc_stage": stage, "updated_at": now},
                                                "$push": {"status_history": {"stage": stage, "at": now, "source": "admin"}}})
    await audit.insert_one({"campaign_id": CAMPAIGN_ID, "event": "kyc_status_changed", "user_id": c["user_id"],
                            "teacher_id": body.teacher_id, "to_stage": stage, "source": "admin",
                            "by": str(admin.get("user_id")), "at": now})
    return {"ok": True, "claim": True, "kyc_stage": stage}


@router.get("/admin/claims")
async def admin_claims(admin: dict = Depends(admin_only_user)) -> dict:
    cfg = await _ensure()
    rows = await claims.find({"campaign_id": CAMPAIGN_ID}).sort("claimed_at", -1).limit(500).to_list(500)
    events = await audit.find({"campaign_id": CAMPAIGN_ID}, {"_id": 0}).sort("at", -1).limit(200).to_list(200)
    by_event: dict = {}
    for e in await audit.aggregate([{"$match": {"campaign_id": CAMPAIGN_ID}}, {"$group": {"_id": "$event", "n": {"$sum": 1}}}]).to_list(50):
        by_event[e["_id"]] = e["n"]
    return {
        "campaign_id": CAMPAIGN_ID, "name": cfg["name"], "starts_at": _iso(cfg["starts_at"]), "ends_at": _iso(cfg["ends_at"]),
        "active": campaign_window(cfg, now_utc()) is None,
        "claims": [{**_public_claim(r), "user_id": r["user_id"], "teacher_id": r.get("teacher_id"),
                    "profile_percent_at_claim": r.get("profile_percent_at_claim"),
                    "status_history": [{**h, "at": _iso(h["at"])} for h in r.get("status_history", [])]} for r in rows],
        "events": [{**e, "at": _iso(e["at"])} for e in events],
        "counts": by_event,
    }
