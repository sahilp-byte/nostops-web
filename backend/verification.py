"""
NOSTOPS Verification + Empanelment Engine — ISOLATED local feature (local FastAPI
+ local Mongo `nostops_web`, `verification_*` collections). Mounted BEFORE the
catch-all proxy so /api/verification/* is served locally and is NEVER forwarded
to the frozen remote business backend.

PROMPT 1 scope = FOUNDATION, DATA MODEL & SAFE MIGRATION ONLY.

Safety guarantees (Prompt 1):
  • Purely additive. This module touches ONLY new `verification_*` collections.
  • It NEVER reads/writes/deletes any existing teacher, payment, InstaKYC,
    Empanelment or Council record — those live on the remote backend and remain
    authoritative and untouched.
  • The existing teacher-facing flow and the "Complete InstaKYC" / "Become an
    Empanelled Teacher" CTAs are NOT changed here.
  • For INDIAN teachers the existing InstaKYC result stays the authoritative
    identity check; for INTERNATIONAL teachers Didit becomes authoritative
    (wired in a later prompt). This foundation only records the chosen route.
  • Empanelment decisions are immutable and permanently stamped with the rule
    version; the audit log is append-only.

Security: same defense-in-depth as pulse.py / discovery.py — every request
carries the shared secret `X-Pulse-Secret`; identity is injected server-side by
the Next.js BFF via `X-Pulse-User` (never trusted from the browser).
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from typing import Any, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()
logger = logging.getLogger("verification")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ── Didit (international identity + structured evidence) — SERVER-SIDE ONLY. ───
# Secrets live in backend/.env and are NEVER exposed to the frontend.
DIDIT_BASE = os.environ.get("DIDIT_BASE", "https://verification.didit.me").rstrip("/")
DIDIT_API_KEY = os.environ.get("DIDIT_API_KEY", "")
DIDIT_WORKFLOW_ID = os.environ.get("DIDIT_WORKFLOW_ID", "")
DIDIT_WEBHOOK_SECRET = os.environ.get("DIDIT_WEBHOOK_SECRET", "")
DIDIT_CALLBACK_URL = os.environ.get("DIDIT_CALLBACK_URL", "")
DIDIT_WEBHOOK_MAX_SKEW_S = 300  # reject webhook timestamps older than 5 minutes

# ── Rule version — every empanelment decision permanently retains this. ───────
RULE_VERSION = "EMPANELMENT_RULES_V1.0"

# ── Teacher levels (unchanged from the existing system). ──────────────────────
LEVEL_SHIKSHAK = "LEVEL_1"   # Yoga Shikshak
LEVEL_PRACHARAK = "LEVEL_2"  # Yoga Pracharak — automated verification + empanelment primarily applies here
LEVEL_GURU = "LEVEL_3"       # Yoga Guru — ALWAYS requires Council recognition
TEACHER_LEVELS = {LEVEL_SHIKSHAK, LEVEL_PRACHARAK, LEVEL_GURU}

# ── Verification routes & providers. ──────────────────────────────────────────
ROUTE_INDIA = "INDIA"
ROUTE_INTERNATIONAL = "INTERNATIONAL"
# B4.8 — identity verification for teachers outside India is NOT YET AVAILABLE.
# No Didit session can start and no price is shown; teachers see a plain
# "not yet available" message instead. Flip only after owner approval.
INTERNATIONAL_VERIFICATION_AVAILABLE = False
INTERNATIONAL_NOT_AVAILABLE_DETAIL = ("Identity verification for teachers outside India is not yet available. "
                                      "No payment is taken for it.")
PROVIDER_INSTAKYC = "INSTAKYC"   # existing Indian provider — stays authoritative
PROVIDER_DIDIT = "DIDIT"         # international identity provider — wired later

# ── Status models (exactly as specified in Prompt 1). ─────────────────────────
VERIFICATION_STATUSES = {
    "NOT_STARTED", "PAYMENT_PENDING", "PAYMENT_SUCCESS", "VERIFICATION_PENDING",
    "IDENTITY_VERIFIED", "IDENTITY_FAILED", "CREDENTIAL_VERIFICATION",
    "CREDENTIALS_VERIFIED", "PROFESSIONAL_EVIDENCE_PENDING", "EMPANELMENT_ASSESSMENT",
    "VERIFIED", "NOT_VERIFIED",
}
EMPANELMENT_STATUSES = {
    "NOT_STARTED", "ASSESSMENT_PENDING", "ELIGIBLE", "EMPANELLED",
    "ADDITIONAL_INFORMATION_REQUIRED", "COUNCIL_REVIEW", "NOT_EMPANELLED",
    "APPEAL_PENDING",
}
# Sub-record statuses (lightweight; detailed flows arrive in later prompts).
SUBRECORD_STATUSES = {"PENDING", "SUBMITTED", "VERIFIED", "FAILED", "NOT_REQUIRED"}

# ── Immutable audit event names (exactly as specified in Prompt 1). ───────────
AUDIT_EVENTS = {
    "APPLICATION_CREATED", "PAYMENT_SUCCESS", "IDENTITY_VERIFICATION_STARTED",
    "IDENTITY_VERIFIED", "IDENTITY_FAILED", "CREDENTIAL_SUBMITTED",
    "CREDENTIAL_VERIFIED", "PROFESSIONAL_EVIDENCE_SUBMITTED",
    "EMPANELMENT_ASSESSMENT_STARTED", "EMPANELMENT_APPROVED", "EMPANELMENT_REJECTED",
    "EMPANELMENT_PREREQUISITES_MET", "ADDITIONAL_INFORMATION_REQUESTED", "COUNCIL_REVIEW_REQUESTED",
    "COUNCIL_APPROVED", "COUNCIL_REJECTED", "APPEAL_SUBMITTED",
}

# Terminal application states — a teacher starting again gets a fresh application.
_TERMINAL_VERIFICATION = {"VERIFIED", "NOT_VERIFIED"}

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]
applications = db["verification_applications"]
identity = db["verification_identity"]
credentials = db["verification_credentials"]
evidence = db["verification_professional_evidence"]
lineage = db["verification_lineage"]
assessments = db["verification_empanelment_assessments"]
audit = db["verification_audit_log"]  # append-only / immutable
provider_events = db["verification_provider_events"]  # webhook idempotency (event_id unique)
provider_costs = db["verification_provider_costs"]     # internal cost ledger (never shown to teachers)
council_decisions = db["verification_council_decisions"]  # Prompt 5 — immutable council rulings
appeals = db["verification_appeals"]                       # Prompt 5 — teacher appeals
platform_config = db["verification_platform_config"]       # Prompt 6 — pricing / feature flag / migration
entitlements = db["verification_entitlements"]             # Prompt 6 — one package per application
payments = db["verification_payments"]                     # Prompt 6 — unified payment ledger (dedupe)

router = APIRouter(prefix="/api/verification", tags=["verification"])

_ensured = False


def _now() -> str:
    # ISO-8601 UTC, matching the rest of the app's timestamps.
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _oid() -> str:
    return uuid.uuid4().hex


async def _ensure_indexes():
    global _ensured
    if _ensured:
        return
    await applications.create_index("application_id", unique=True)
    await applications.create_index([("teacher_id", 1), ("created_at", -1)])
    await identity.create_index("application_id")
    await credentials.create_index([("application_id", 1), ("created_at", -1)])
    await credentials.create_index("teacher_id")
    await credentials.create_index("credential_id")
    await evidence.create_index("application_id")
    await lineage.create_index([("application_id", 1), ("created_at", -1)])
    await assessments.create_index([("application_id", 1), ("assessed_at", -1)])
    await audit.create_index([("application_id", 1), ("created_at", 1)])
    await provider_events.create_index("event_id", unique=True)
    await provider_events.create_index("application_id")
    await provider_costs.create_index([("application_id", 1), ("created_at", 1)])
    await council_decisions.create_index([("application_id", 1), ("created_at", 1)])
    await council_decisions.create_index("reviewer")
    await appeals.create_index("appeal_id", unique=True)
    await appeals.create_index([("application_id", 1), ("created_at", -1)])
    await payments.create_index("payment_reference", unique=True)
    await payments.create_index("application_id")
    await entitlements.create_index("application_id", unique=True)
    await entitlements.create_index("teacher_id")
    _ensured = True


# ── Auth (mirror of pulse.py / discovery.py) ──────────────────────────────────
async def current_user(
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
) -> dict:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        data = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="bad user context")
    if not data.get("user_id"):
        raise HTTPException(status_code=400, detail="no user")
    data["role"] = str(data.get("role") or "learner").lower()
    return data


def _route_for(country: Optional[str]) -> str:
    c = (country or "").strip().lower()
    return ROUTE_INDIA if c in {"india", "in", "bharat", "ind"} else ROUTE_INTERNATIONAL


def _provider_for(route: str) -> str:
    return PROVIDER_INSTAKYC if route == ROUTE_INDIA else PROVIDER_DIDIT


def _norm_level(level: Optional[str]) -> Optional[str]:
    if not level:
        return None
    s = str(level).strip().upper().replace(" ", "_")
    aliases = {
        "L1": LEVEL_SHIKSHAK, "LEVEL_1": LEVEL_SHIKSHAK, "YOGA_SHIKSHAK": LEVEL_SHIKSHAK, "SHIKSHAK": LEVEL_SHIKSHAK,
        "L2": LEVEL_PRACHARAK, "LEVEL_2": LEVEL_PRACHARAK, "YOGA_PRACHARAK": LEVEL_PRACHARAK, "PRACHARAK": LEVEL_PRACHARAK,
        "L3": LEVEL_GURU, "LEVEL_3": LEVEL_GURU, "YOGA_GURU": LEVEL_GURU, "GURU": LEVEL_GURU,
    }
    return aliases.get(s, s if s in TEACHER_LEVELS else None)


async def _audit(application_id: str, teacher_id: str, event: str, actor: str, detail: Optional[dict] = None):
    """Append an immutable audit event. Never updates/deletes."""
    if event not in AUDIT_EVENTS:
        # Defensive: unknown event names are rejected so the log stays canonical.
        raise HTTPException(status_code=500, detail=f"unknown audit event {event!r}")
    await audit.insert_one({
        "event_id": _oid(),
        "application_id": application_id,
        "teacher_id": teacher_id,
        "event": event,
        "actor": actor,
        "detail": detail or {},
        "created_at": _now(),
    })


def _public_app(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ── Request models ────────────────────────────────────────────────────────────
class ApplicationCreateIn(BaseModel):
    teacher_level: Optional[str] = None
    country: Optional[str] = None
    nationality: Optional[str] = None
    teacher_handle: Optional[str] = None
    # Optional: reuse an existing Indian InstaKYC result as the authoritative
    # identity check (the BFF passes the remote kyc status; never trusted blindly
    # for the final decision — that happens in a later prompt).
    instakyc_verified: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/config")
async def config(_: dict = Depends(current_user)):
    """Non-secret foundation config for the eventual unified UI."""
    return {
        "rule_version": RULE_VERSION,
        "levels": sorted(TEACHER_LEVELS),
        "routes": [ROUTE_INDIA, ROUTE_INTERNATIONAL],
        "providers": {ROUTE_INDIA: PROVIDER_INSTAKYC, ROUTE_INTERNATIONAL: PROVIDER_DIDIT},
        "verification_statuses": sorted(VERIFICATION_STATUSES),
        "empanelment_statuses": sorted(EMPANELMENT_STATUSES),
        "audit_events": sorted(AUDIT_EVENTS),
    }


@router.post("/application")
async def create_application(body: ApplicationCreateIn, user: dict = Depends(current_user)):
    """Create (or return the current open) verification application for the
    signed-in teacher. Idempotent: an existing non-terminal application is
    returned rather than duplicated. Purely additive — no existing record is
    touched."""
    await _ensure_indexes()
    teacher_id = str(user["user_id"])

    existing = await applications.find_one(
        {"teacher_id": teacher_id, "verification_status": {"$nin": list(_TERMINAL_VERIFICATION)}},
        sort=[("created_at", -1)],
    )
    if existing:
        return {"created": False, "application": _public_app(existing)}

    route = _route_for(body.country)
    provider = _provider_for(route)
    level = _norm_level(body.teacher_level)
    # L3 (Guru) always requires Council recognition — flag it from the start.
    council_required = level == LEVEL_GURU
    doc = {
        "application_id": _oid(),
        "teacher_id": teacher_id,
        "teacher_handle": (body.teacher_handle or user.get("teacher_handle") or None),
        "teacher_level": level,
        "country": (body.country or None),
        "nationality": (body.nationality or None),
        "verification_route": route,
        "verification_provider": provider,
        "verification_status": "NOT_STARTED",
        "credential_status": "NOT_STARTED",
        "professional_evidence_status": "NOT_STARTED",
        "empanelment_status": "NOT_STARTED",
        "council_review_required": council_required,
        "council_review_reason": ("LEVEL_3_GURU_REQUIRES_COUNCIL" if council_required else None),
        "payment_status": "NOT_STARTED",
        "payment_reference": None,
        "payment_amount": None,
        "payment_currency": None,
        # India reuses the existing InstaKYC result as the authoritative identity
        # check — recorded here for traceability; not acted upon in Prompt 1.
        "existing_instakyc_reused": bool(body.instakyc_verified) if route == ROUTE_INDIA else False,
        "rule_version": RULE_VERSION,
        "created_at": _now(),
        "updated_at": _now(),
        "completed_at": None,
    }
    await applications.insert_one(doc)
    await _audit(doc["application_id"], teacher_id, "APPLICATION_CREATED", teacher_id, {
        "route": route, "provider": provider, "level": level,
    })
    return {"created": True, "application": _public_app(doc)}


async def _load_app(application_id: str, user: dict) -> dict:
    doc = await applications.find_one({"application_id": application_id})
    if not doc:
        raise HTTPException(status_code=404, detail="application not found")
    # Owner OR a privileged Council/Admin reviewer may load it (redaction applied downstream).
    if not _is_privileged(user) and str(doc.get("teacher_id")) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="not your application")
    return doc


@router.get("/application/me")
async def my_application(user: dict = Depends(current_user)):
    await _ensure_indexes()
    doc = await applications.find_one(
        {"teacher_id": str(user["user_id"])}, sort=[("created_at", -1)]
    )
    return {"application": _public_app(doc) if doc else None}


@router.get("/application/{application_id}")
async def get_application(application_id: str, user: dict = Depends(current_user)):
    """Full aggregate: application + all nested sub-records. Council/Admin see the
    complete evidence; the teacher (owner) gets a redacted view — raw identity
    data, internal fraud/verification signals and provider internals are hidden
    (Prompt 5 §9)."""
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    priv = _is_privileged(user)
    ident = await identity.find_one({"application_id": application_id})
    creds = await credentials.find({"application_id": application_id}).sort("created_at", 1).to_list(100)
    ev = await evidence.find_one({"application_id": application_id})
    lins = await lineage.find({"application_id": application_id}).sort("created_at", 1).to_list(50)
    asmts = await assessments.find({"application_id": application_id}).sort("assessed_at", 1).to_list(50)
    return {
        "application": _public_app(app),
        "identity_verification": _redact_identity(ident, priv),
        "credentials": [_redact_credential(c, priv) for c in creds],
        "professional_evidence": _strip(ev),
        "lineage": [_strip(l) for l in lins],
        "empanelment_assessments": [_redact_assessment(a, priv) for a in asmts],
    }


@router.get("/application/{application_id}/audit")
async def get_audit(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    events = await audit.find({"application_id": application_id}).sort("created_at", 1).to_list(500)
    return {"events": [{k: v for k, v in e.items() if k != "_id"} for e in events]}


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT 2 — Didit international identity verification + structured evidence.
# Didit does IDENTITY + evidence COLLECTION. NOSTOPS does credential verification,
# evidence assessment and the empanelment DECISION (NOT Didit). No auto-empanel.
# ══════════════════════════════════════════════════════════════════════════════
from pymongo.errors import DuplicateKeyError  # noqa: E402

# Didit session statuses (exact, case-sensitive — Didit docs).
_DIDIT_APPROVED = "Approved"
_DIDIT_FAILED = {"Declined", "Kyc Expired"}
_DIDIT_SOFT = {"Expired", "Abandoned"}            # retryable — not a hard identity failure
_DIDIT_REVIEW = {"In Review", "Resubmitted"}
_DIDIT_INPROGRESS = {"Not Started", "In Progress", "Awaiting User"}


def _canonical(obj) -> str:
    """Didit X-Signature-V2 canonical JSON: recursively sorted keys, compact
    separators, unescaped Unicode, integer-valued floats normalised to int."""
    def norm(x):
        if isinstance(x, bool):
            return x
        if isinstance(x, float) and x.is_integer():
            return int(x)
        if isinstance(x, list):
            return [norm(i) for i in x]
        if isinstance(x, dict):
            return {k: norm(v) for k, v in x.items()}
        return x
    return json.dumps(norm(obj), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _valid_didit_signature(parsed: dict, signature: Optional[str], timestamp: Optional[str]) -> bool:
    if not DIDIT_WEBHOOK_SECRET or not signature or not timestamp:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(int(time.time()) - ts) > DIDIT_WEBHOOK_MAX_SKEW_S:
        return False
    expected = hmac.new(
        DIDIT_WEBHOOK_SECRET.encode("utf-8"), _canonical(parsed).encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _didit_post(path: str, body: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30.0) as c:
        return await c.post(
            f"{DIDIT_BASE}{path}",
            headers={"x-api-key": DIDIT_API_KEY, "Content-Type": "application/json"},
            json=body,
        )


async def _didit_get(path: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30.0) as c:
        return await c.get(f"{DIDIT_BASE}{path}", headers={"x-api-key": DIDIT_API_KEY})


async def _record_cost(application_id: str, event: str, status: Optional[str], extra: Optional[dict] = None):
    """Internal-only provider cost/usage ledger. NEVER returned to teachers."""
    doc = {
        "application_id": application_id,
        "provider": PROVIDER_DIDIT,
        "event": event,
        "status": status,
        "estimated_cost": (extra or {}).get("estimated_cost"),
        "currency": (extra or {}).get("currency"),
        "created_at": _now(),
    }
    if extra:
        doc.update({k: v for k, v in extra.items() if k not in doc})
    await provider_costs.insert_one(doc)


def _first(arr) -> dict:
    return arr[0] if isinstance(arr, list) and arr else {}


def _flatten_questionnaire(quest):
    """Best-effort flatten of Didit questionnaire_responses into {label:answer}.
    The exact shape depends on the console questionnaire config, so this walks
    the tree defensively and also keeps the raw payload for traceability."""
    flat: dict = {}

    def walk(node):
        if isinstance(node, list):
            for x in node:
                walk(x)
        elif isinstance(node, dict):
            label = node.get("label") or node.get("title") or node.get("name") or node.get("question")
            ans = node.get("answer")
            if ans is None:
                ans = node.get("value")
            if ans is None:
                ans = node.get("response")
            if label and ans is not None and not isinstance(ans, (list, dict)):
                flat[str(label).strip().lower()] = ans
            for v in node.values():
                walk(v)

    walk(quest)
    return flat, quest


def _pick(flat: dict, *subs: str):
    for k, v in flat.items():
        for s in subs:
            if s in k:
                return v
    return None


async def _ingest_questionnaire(application_id: str, teacher_id: str, quest) -> bool:
    """Persist Didit-collected structured evidence into NOSTOPS models
    (credentials / professional evidence / lineage). Idempotent: one evidence +
    one didit-sourced lineage + one didit-sourced credential per application."""
    if not quest:
        return False
    flat, raw = _flatten_questionnaire(quest)
    if not flat and not raw:
        return False
    now = _now()
    await evidence.update_one(
        {"application_id": application_id},
        {"$set": {
            "evidence_id": None, "application_id": application_id, "teacher_id": teacher_id,
            "years_teaching": _pick(flat, "years teaching", "years of teaching", "years_teaching"),
            "teaching_formats": _pick(flat, "teaching format", "formats"),
            "corporate_teaching": _pick(flat, "corporate"),
            "educational_institution_teaching": _pick(flat, "educational"),
            "retreat_teaching": _pick(flat, "retreat"),
            "international_teaching": _pick(flat, "international"),
            "professional_website": _pick(flat, "website"),
            "professional_profile": _pick(flat, "profile", "linkedin"),
            "references": _pick(flat, "reference"),
            "evidence_status": "SUBMITTED", "source": "didit_questionnaire",
            "questionnaire_flat": flat, "questionnaire_raw": raw, "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await lineage.update_one(
        {"application_id": application_id, "source": "didit_questionnaire"},
        {"$set": {
            "application_id": application_id, "teacher_id": teacher_id,
            "tradition": _pick(flat, "tradition"), "lineage": _pick(flat, "lineage"),
            "guru_teacher": _pick(flat, "guru", "teacher name"),
            "specialisation": _pick(flat, "special"),
            "verification_status": "PENDING", "source": "didit_questionnaire", "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await credentials.update_one(
        {"application_id": application_id, "source": "didit_questionnaire"},
        {"$set": {
            "application_id": application_id, "teacher_id": teacher_id,
            "qualification_name": _pick(flat, "highest yoga", "qualification name", "qualification"),
            "institution_name": _pick(flat, "institution"),
            "institution_country": _pick(flat, "qualification country", "institution country"),
            "completion_date": _pick(flat, "completion", "completion year"),
            "specialisation": _pick(flat, "special"),
            "verification_method": "NOSTOPS_PENDING", "verification_status": "PENDING",
            "source": "didit_questionnaire", "updated_at": now,
        }, "$setOnInsert": {"created_at": now, "credential_id": _oid()}},
        upsert=True,
    )
    return True


async def _apply_decision(app_doc: dict, status: str, decision: dict, actor: str):
    """Map a Didit result onto NOSTOPS models. Identity + evidence only — this
    NEVER empanels. On success it moves the app to credential verification."""
    application_id = app_doc["application_id"]
    teacher_id = str(app_doc["teacher_id"])
    session_id = app_doc.get("didit_session_id")
    decision = decision or {}
    idv = _first(decision.get("id_verifications"))
    live = _first(decision.get("liveness_checks") or decision.get("liveness"))
    face = _first(decision.get("face_matches"))
    ipan = _first(decision.get("ip_analysis") or decision.get("ip_analyses"))
    quest = decision.get("questionnaire_responses") or []
    now = _now()

    if status == _DIDIT_APPROVED:
        our_identity = "IDENTITY_VERIFIED"
        app_verif = "IDENTITY_VERIFIED"
        failure = None
    elif status in _DIDIT_FAILED:
        our_identity = "IDENTITY_FAILED"
        app_verif = "IDENTITY_FAILED"
        failure = idv.get("warnings") or status
    elif status in _DIDIT_REVIEW:
        our_identity = "IN_REVIEW"
        app_verif = "VERIFICATION_PENDING"
        failure = None
    else:  # soft (expired/abandoned) or in-progress → stay pending, let them retry
        our_identity = status.upper().replace(" ", "_")
        app_verif = "VERIFICATION_PENDING"
        failure = status if status in _DIDIT_SOFT else None

    await identity.update_one(
        {"application_id": application_id},
        {"$set": {
            "application_id": application_id, "provider": PROVIDER_DIDIT,
            "provider_reference": session_id, "didit_status": status,
            "document_type": idv.get("document_type"),
            "issuing_country": idv.get("issuing_state") or idv.get("issuing_country"),
            "document_expiry": idv.get("date_of_expiry"),
            "verification_status": our_identity,
            "liveness_status": (live.get("status") if live else None),
            "face_match_status": (face.get("status") if face else None),
            "risk_status": (ipan.get("status") if ipan else ("REVIEW" if status in _DIDIT_REVIEW else None)),
            "verification_timestamp": now, "failure_reason": failure, "updated_at": now,
        }, "$setOnInsert": {"identity_verification_id": _oid(), "created_at": now}},
        upsert=True,
    )

    update = {"verification_status": app_verif, "updated_at": now}
    events_to_log = []

    if status == _DIDIT_APPROVED:
        await _audit(application_id, teacher_id, "IDENTITY_VERIFIED", actor, {"session_id": session_id})
        # Structured evidence collected by Didit → NOSTOPS models.
        got_quest = await _ingest_questionnaire(application_id, teacher_id, quest)
        # Hand off to NOSTOPS credential verification (pending). NO empanelment.
        update["credential_status"] = "CREDENTIAL_VERIFICATION"
        update["professional_evidence_status"] = "SUBMITTED" if got_quest else "PENDING"
        if got_quest:
            events_to_log += ["PROFESSIONAL_EVIDENCE_SUBMITTED", "CREDENTIAL_SUBMITTED"]
    elif status in _DIDIT_FAILED:
        await _audit(application_id, teacher_id, "IDENTITY_FAILED", actor, {"session_id": session_id, "reason": failure})

    await applications.update_one({"application_id": application_id}, {"$set": update})
    for ev in events_to_log:
        await _audit(application_id, teacher_id, ev, actor, {"session_id": session_id, "source": "didit"})


# ── Payment gate (called by the existing international payment-success flow) ───
class MarkPaidIn(BaseModel):
    payment_reference: Optional[str] = None
    payment_amount: Optional[float] = None
    payment_currency: Optional[str] = None


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


@router.post("/application/{application_id}/mark-paid")
async def mark_paid(application_id: str, body: MarkPaidIn, user: dict = Depends(admin_user)):
    """Record a confirmed payment on the application. Admin/service only — the
    existing payment-success handler (server-side) calls this; a teacher can
    never self-confirm payment. Idempotent."""
    await _ensure_indexes()
    app = await applications.find_one({"application_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="application not found")
    if app.get("payment_status") == "PAYMENT_SUCCESS":
        return {"ok": True, "already": True}
    await applications.update_one({"application_id": application_id}, {"$set": {
        "payment_status": "PAYMENT_SUCCESS",
        "verification_status": "PAYMENT_SUCCESS",
        "payment_reference": body.payment_reference,
        "payment_amount": body.payment_amount,
        "payment_currency": body.payment_currency,
        "updated_at": _now(),
    }})
    await _audit(application_id, str(app["teacher_id"]), "PAYMENT_SUCCESS", user["user_id"], {
        "reference": body.payment_reference, "amount": body.payment_amount, "currency": body.payment_currency,
    })
    return {"ok": True}


# ── Didit session creation (gated on PAYMENT_SUCCESS; international only) ──────
@router.post("/didit/session")
async def create_didit_session(user: dict = Depends(current_user)):
    if not INTERNATIONAL_VERIFICATION_AVAILABLE:
        raise HTTPException(status_code=409, detail=INTERNATIONAL_NOT_AVAILABLE_DETAIL)
    await _ensure_indexes()
    teacher_id = str(user["user_id"])
    app = await applications.find_one(
        {"teacher_id": teacher_id, "verification_status": {"$nin": list(_TERMINAL_VERIFICATION)}},
        sort=[("created_at", -1)],
    )
    if not app:
        raise HTTPException(status_code=400, detail="No open verification application. Create one first.")
    if app.get("verification_route") != ROUTE_INTERNATIONAL:
        raise HTTPException(status_code=400, detail="Didit is used for international teachers only.")
    if app.get("payment_status") != "PAYMENT_SUCCESS":
        raise HTTPException(status_code=402, detail="Payment must be confirmed before identity verification.")
    # Idempotent: reuse an in-flight session instead of creating duplicates.
    if app.get("didit_session_id") and app.get("verification_status") not in {"IDENTITY_VERIFIED", "IDENTITY_FAILED"}:
        return {"created": False, "session_id": app["didit_session_id"], "url": app.get("didit_session_url")}
    if not DIDIT_API_KEY or not DIDIT_WORKFLOW_ID:
        raise HTTPException(status_code=503, detail="Didit is not configured.")

    payload = {
        "workflow_id": DIDIT_WORKFLOW_ID,
        "vendor_data": app["application_id"],  # stable internal id → correlation + dedupe
        "metadata": {"teacher_id": teacher_id, "application_id": app["application_id"]},
    }
    if DIDIT_CALLBACK_URL:
        payload["callback"] = DIDIT_CALLBACK_URL
        payload["callback_method"] = "both"
    r = await _didit_post("/v3/session/", payload)
    data = r.json() if r.content else {}
    if r.status_code >= 400 or not data.get("session_id"):
        detail = str(data.get("detail") or data)
        logger.error("Didit session create failed: %s %s", r.status_code, detail[:300])
        # Surface actionable reasons without leaking provider internals to teachers.
        if "credit" in detail.lower():
            raise HTTPException(status_code=503, detail="Identity verification is temporarily unavailable. Please try again shortly.")
        raise HTTPException(status_code=502, detail="Could not start identity verification.")

    session_id = data["session_id"]
    await applications.update_one({"application_id": app["application_id"]}, {"$set": {
        "didit_session_id": session_id,
        "didit_workflow_id": DIDIT_WORKFLOW_ID,
        "didit_session_url": data.get("url"),
        "verification_status": "VERIFICATION_PENDING",
        "updated_at": _now(),
    }})
    await identity.update_one(
        {"application_id": app["application_id"]},
        {"$set": {
            "application_id": app["application_id"], "provider": PROVIDER_DIDIT,
            "provider_reference": session_id, "verification_status": "VERIFICATION_PENDING",
            "didit_status": data.get("status", "Not Started"), "updated_at": _now(),
        }, "$setOnInsert": {"identity_verification_id": _oid(), "created_at": _now()}},
        upsert=True,
    )
    await _audit(app["application_id"], teacher_id, "IDENTITY_VERIFICATION_STARTED", teacher_id, {
        "session_id": session_id, "workflow_id": DIDIT_WORKFLOW_ID,
    })
    await _record_cost(app["application_id"], "session_created", data.get("status"), {
        "session_id": session_id, "workflow_id": DIDIT_WORKFLOW_ID,
    })
    return {"created": True, "session_id": session_id, "url": data.get("url")}


@router.get("/didit/session/{session_id}/decision")
async def didit_decision(session_id: str, user: dict = Depends(current_user)):
    """Server-side reconcile of the authoritative Didit decision (owner/admin)."""
    app = await applications.find_one({"didit_session_id": session_id})
    if not app:
        raise HTTPException(status_code=404, detail="session not found")
    if user["role"] != "admin" and str(app["teacher_id"]) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="not your session")
    r = await _didit_get(f"/v3/session/{session_id}/decision/")
    return {"status_code": r.status_code, "decision": (r.json() if r.content else None)}


# ── Didit webhook (PUBLIC endpoint — authenticated by X-Signature-V2 only) ────
@router.post("/didit/webhook")
async def didit_webhook(
    request: Request,
    x_signature_v2: Optional[str] = Header(None, alias="X-Signature-V2"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
):
    await _ensure_indexes()
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="invalid payload")
    if not _valid_didit_signature(payload, x_signature_v2, x_timestamp):
        raise HTTPException(status_code=401, detail="invalid signature")

    session_id = payload.get("session_id") or payload.get("session") or ""
    status = payload.get("status") or ""
    vendor_data = payload.get("vendor_data")
    # Dedupe: Didit reuses event_id on retries; synthesise a stable key if absent.
    event_id = payload.get("event_id") or payload.get("id") or f"{session_id}:{status}"
    try:
        await provider_events.insert_one({
            "event_id": str(event_id), "session_id": session_id, "status": status,
            "created_at": _now(),
        })
    except DuplicateKeyError:
        return {"ok": True, "duplicate": True}  # already processed — safe no-op

    # Locate the application (by stored session id, else vendor_data == application_id).
    app = await applications.find_one({"didit_session_id": session_id})
    if not app and vendor_data:
        app = await applications.find_one({"application_id": vendor_data})
    if not app:
        # Unknown session — acknowledge so Didit stops retrying; nothing to update.
        return {"ok": True, "unmatched": True}

    # Ensure the session id is recorded (e.g. first webhook before our create row updates).
    if not app.get("didit_session_id") and session_id:
        await applications.update_one({"application_id": app["application_id"]},
                                      {"$set": {"didit_session_id": session_id}})
        app["didit_session_id"] = session_id

    decision = payload.get("decision") or payload.get("data") or {}
    # Enrich from the authoritative decision endpoint on terminal states if the
    # webhook didn't inline the detail (best-effort; never blocks the ack).
    if status == _DIDIT_APPROVED and not decision.get("questionnaire_responses") and DIDIT_API_KEY and session_id:
        try:
            dr = await _didit_get(f"/v3/session/{session_id}/decision/")
            if dr.status_code < 400 and dr.content:
                decision = dr.json() or decision
        except Exception:
            pass

    await _apply_decision(app, status, decision, actor="didit_webhook")
    await _record_cost(app["application_id"], "webhook_status", status, {"session_id": session_id})
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT 3 — CREDENTIAL VERIFICATION + PROFESSIONAL EVIDENCE
#
# The NOSTOPS Credential Verification Engine decides whether a teacher's claimed
# qualifications + professional evidence are sufficiently SUPPORTED for the
# empanelment assessment (Prompt 4). It NEVER empanels and NEVER touches Indian
# InstaKYC or the existing remote Empanelment flow.
#
# Verification ladder (cascades until resolved):
#   LEVEL A — DIGITAL      certificate lookup / QR / digital credential / public
#                          registry / verification API  -> CREDENTIAL_VERIFIED
#   LEVEL B — INSTITUTION  institution existence/country/website/authority/contact
#                          -> INSTITUTION_VALIDATED
#   LEVEL C — DOCUMENT     certificate + number + name + qualification + dates
#                          -> DOCUMENT_REVIEWED
#   LEVEL D — EXCEPTION    insufficient -> ADDITIONAL_INFORMATION_REQUIRED
#                          conflict/anomaly/not-established -> COUNCIL_REVIEW
#
# AI (reusing the proven Claude integration via EMERGENT_LLM_KEY) MAY ASSIST with
# OCR/extraction, institution matching, classification, duplicate & anomaly
# detection — ADVISORY ONLY. The empanelment decision belongs to NOSTOPS rules.
# ══════════════════════════════════════════════════════════════════════════════
import re as _re  # noqa: E402

# Per-credential outcome statuses (which ladder level resolved it).
CRED_PENDING = "PENDING"
CRED_VERIFIED = "CREDENTIAL_VERIFIED"           # Level A — digital
CRED_INSTITUTION = "INSTITUTION_VALIDATED"      # Level B — institution
CRED_DOCUMENT = "DOCUMENT_REVIEWED"             # Level C — document/evidence
CRED_ADDITIONAL = "ADDITIONAL_INFORMATION_REQUIRED"  # Level D — incomplete
CRED_COUNCIL = "COUNCIL_REVIEW"                 # Level D — conflict/anomaly/not-established
CREDENTIAL_OUTCOMES = {CRED_PENDING, CRED_VERIFIED, CRED_INSTITUTION, CRED_DOCUMENT, CRED_ADDITIONAL, CRED_COUNCIL}
_CRED_SUFFICIENT = {CRED_VERIFIED, CRED_INSTITUTION, CRED_DOCUMENT}

# Verification methods (provenance recorded on each credential).
M_DIGITAL = "DIGITAL_LOOKUP"
M_QR = "QR_VALIDATION"
M_REGISTRY = "PUBLIC_REGISTRY"
M_API = "VERIFICATION_API"
M_INSTITUTION = "INSTITUTION_VALIDATION"
M_DOCUMENT = "DOCUMENT_REVIEW"
M_COUNCIL = "COUNCIL_REVIEW"
M_NONE = "NONE"

# Application-level credential rollup statuses (extends Prompt 1/2 values).
APP_CRED_IN_PROGRESS = "CREDENTIAL_VERIFICATION"
APP_CRED_VERIFIED = "CREDENTIALS_VERIFIED"
APP_CRED_ADDITIONAL = "ADDITIONAL_INFORMATION_REQUIRED"
APP_CRED_COUNCIL = "COUNCIL_REVIEW"

# Curated set of well-known yoga teacher-training institutions for deterministic
# Level B recognition (used ALONGSIDE live website reachability + AI assist).
KNOWN_INSTITUTIONS = {
    "sivananda", "bihar school of yoga", "kaivalyadhama", "the yoga institute",
    "krishnamacharya", "isha", "art of living", "ramamani iyengar", "rimyi",
    "yoga alliance", "sri sri", "parmarth niketan", "morarji desai", "mdniy",
    "svyasa", "patanjali", "ashtanga yoga research institute", "kpjayi",
    "himalayan", "yogavidya", "kripalu",
}

_HONORIFICS = {
    "dr", "shri", "sri", "smt", "mr", "mrs", "ms", "guru", "swami", "pandit",
    "acharya", "yogi", "yogini", "prof",
}


def _live_checks_on() -> bool:
    """Network + AI assist are ON in production; the acceptance suite turns them
    off by pre-recording digital_result / institution_result so results are
    deterministic and offline."""
    return os.environ.get("VERIFICATION_LIVE_CHECKS", "1") not in {"0", "false", "False"}


def _norm_name_tokens(s: Optional[str]) -> list:
    s = _re.sub(r"[^a-z\s]", " ", (s or "").lower())
    return [t for t in s.split() if t and t not in _HONORIFICS]


def _name_match(a: Optional[str], b: Optional[str]):
    """True = same person (allowing variation/abbreviation/initials),
    False = clear conflict, None = cannot tell (one side empty)."""
    ta, tb = _norm_name_tokens(a), _norm_name_tokens(b)
    if not ta or not tb:
        return None
    short, long = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    long_set = set(long)

    def covered(short_toks):
        for t in short_toks:
            if t in long_set:
                continue
            if len(t) == 1 and any(w.startswith(t) for w in long):
                continue  # initial matches a full token
            return False
        return True

    if covered(short):
        return True
    inter = set(ta) & set(tb)
    if inter and len(inter) / max(1, min(len(set(ta)), len(set(tb)))) >= 0.5:
        return True
    return False


def _inst_known_builtin(name: Optional[str]) -> bool:
    n = (name or "").lower()
    return bool(n) and any(k in n for k in KNOWN_INSTITUTIONS)


async def _http_reachable(url: Optional[str]):
    """(ok, body_text) if checked, else None (not checked / disabled)."""
    if not url or not _live_checks_on():
        return None
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as c:
            r = await c.get(url)
            return (r.status_code < 400, (r.text[:5000] if r.content else ""))
    except Exception:
        return (False, "")


async def _ai_institution_known(name: Optional[str], country: Optional[str]):
    """Advisory: does this named institution plausibly exist? Returns
    (known: bool, confidence: float, canonical: str) or None. NEVER decides
    empanelment — only one signal in Level B institution validation."""
    if not name or not _live_checks_on() or not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"inst-{uuid.uuid4().hex}",
            system_message=(
                "You assess whether a named yoga teacher-training institution plausibly exists as a "
                "real, established organisation. Reply with STRICT JSON only: "
                '{"known": true|false, "confidence": 0.0-1.0, "canonical_name": "..."}. No prose.'
            ),
        ).with_model("anthropic", "claude-sonnet-4-6")
        out = await chat.send_message(UserMessage(text=f"Institution: {name}\nCountry: {country or 'unknown'}"))
        m = _re.search(r"\{.*\}", out or "", _re.S)
        if m:
            data = json.loads(m.group(0))
            return (bool(data.get("known")), float(data.get("confidence") or 0), data.get("canonical_name"))
    except Exception:  # noqa: BLE001
        return None
    return None


def _strip(d):
    return {k: v for k, v in d.items() if k != "_id"} if d else None


async def _assess_credential(cred: dict, expected_name: Optional[str], siblings: Optional[list] = None) -> dict:
    """Run the A->D ladder over one credential. Pure assessment — returns
    {status, level, method, checks, notes}. Does NOT write or empanel."""
    siblings = siblings or []
    checks: dict = {}
    notes: list = []

    qual = (cred.get("qualification_name") or "").strip()
    inst = (cred.get("institution_name") or "").strip()
    country = (cred.get("institution_country") or "").strip()
    website = (cred.get("institution_website") or "").strip()
    cert_no = (cred.get("certificate_number") or "").strip()
    cert_url = (cred.get("certificate_url") or "").strip()
    cert_name = (cred.get("teacher_name_on_certificate") or "").strip()
    completion = (cred.get("completion_date") or "").strip()
    vurl = (cred.get("verification_url") or "").strip()
    qr = (cred.get("qr_data") or "").strip()
    dcid = (cred.get("digital_credential_id") or "").strip()
    dresult = cred.get("digital_result") or {}      # service/ops-recorded registry/API outcome
    iresult = cred.get("institution_result") or {}  # service/ops-recorded institution finding

    # ── Duplicate / conflicting certificate detection (AI-assistable; rules decide) ──
    if cert_no:
        for s in siblings:
            if s.get("credential_id") and s.get("credential_id") == cred.get("credential_id"):
                continue
            if (s.get("certificate_number") or "").strip().lower() == cert_no.lower():
                same_inst = (s.get("institution_name") or "").strip().lower() == inst.lower()
                same_qual = (s.get("qualification_name") or "").strip().lower() == qual.lower()
                if same_inst and same_qual:
                    checks["duplicate"] = "DUPLICATE"
                    return {"status": CRED_ADDITIONAL, "level": "D", "method": M_NONE, "checks": checks,
                            "notes": ["This certificate duplicates another submitted credential."]}
                checks["conflict"] = "CERT_NUMBER_CONFLICT"
                return {"status": CRED_COUNCIL, "level": "D", "method": M_COUNCIL, "checks": checks,
                        "notes": ["Escalated to Council: the same certificate number is used for a different qualification/institution (conflicting certificate)."]}

    # ── Name on certificate vs the teacher's identity (name variation handling) ──
    name_cmp = _name_match(cert_name, expected_name) if (cert_name and expected_name) else None
    if name_cmp is True:
        checks["name_match"] = "MATCH"
    elif name_cmp is False:
        checks["name_match"] = "CONFLICT"
    else:
        checks["name_match"] = "UNKNOWN"

    # ── LEVEL A — DIGITAL VERIFICATION ──
    digital_ok = False
    digital_method = None
    if dresult.get("verified") is True:
        digital_ok = True
        digital_method = dresult.get("method") or M_REGISTRY
        checks["digital"] = "VERIFIED_RECORDED"
    elif vurl:
        reach = await _http_reachable(vurl)
        if reach is None:
            checks["digital"] = "UNCHECKED"
        elif reach[0]:
            body = (reach[1] or "").lower()
            if (not cert_no) or (cert_no.lower() in body):
                digital_ok = True
                digital_method = M_DIGITAL
                checks["digital"] = "URL_VERIFIED"
            else:
                checks["digital"] = "URL_REACHABLE_NO_MATCH"
                notes.append("Verification page reachable but the certificate number was not found on it.")
        else:
            checks["digital"] = "URL_UNREACHABLE"
    elif qr or dcid:
        # Framework hook — no live yoga credential registry/API is configured yet.
        checks["digital"] = "ATTEMPTED_NO_REGISTRY"
        notes.append("Digital credential provided but no live registry/API is configured to validate it yet.")

    if digital_ok and name_cmp is not False:
        return {"status": CRED_VERIFIED, "level": "A", "method": digital_method or M_DIGITAL,
                "checks": checks, "notes": notes + ["Digitally verified against the issuing source."]}

    # A hard name conflict is an anomaly → Council, regardless of level.
    if name_cmp is False:
        return {"status": CRED_COUNCIL, "level": "D", "method": M_COUNCIL, "checks": checks,
                "notes": notes + [f"Escalated to Council: name on certificate ('{cert_name}') conflicts with the teacher's identity."]}

    # ── LEVEL B — INSTITUTION VALIDATION ──
    inst_exists = None
    if "established" in iresult:
        inst_exists = bool(iresult.get("established"))
        checks["institution"] = "RECORDED_ESTABLISHED" if inst_exists else "RECORDED_NOT_ESTABLISHED"
    elif inst:
        if _inst_known_builtin(inst):
            inst_exists = True
            checks["institution"] = "RECOGNISED"
        else:
            reach = await _http_reachable(website) if website else None
            if reach and reach[0]:
                inst_exists = True
                checks["institution"] = "WEBSITE_REACHABLE"
            else:
                ai = await _ai_institution_known(inst, country)
                if ai and ai[0] and ai[1] >= 0.6:
                    inst_exists = True
                    checks["institution"] = "AI_RECOGNISED"
                elif ai and (ai[0] is False) and ai[1] >= 0.6:
                    inst_exists = False
                    checks["institution"] = "AI_NOT_ESTABLISHED"
                else:
                    checks["institution"] = "WEBSITE_UNREACHABLE" if website else "UNVERIFIED"
    else:
        checks["institution"] = "MISSING"

    if inst_exists is False:
        return {"status": CRED_COUNCIL, "level": "D", "method": M_COUNCIL, "checks": checks,
                "notes": notes + [f"Escalated to Council: institution '{inst}' could not be established as a real organisation."]}

    if inst_exists and qual:
        checks["qualification"] = "DECLARED"
        return {"status": CRED_INSTITUTION, "level": "B", "method": M_INSTITUTION, "checks": checks,
                "notes": notes + ["Institution validated; qualification accepted at institution level."]}

    # ── LEVEL C — DOCUMENT / EVIDENCE ──
    doc_fields = {
        "certificate": bool(cert_url),
        "certificate_number": bool(cert_no),
        "qualification": bool(qual),
        "institution": bool(inst),
        "completion_date": bool(completion),
        "name": (name_cmp is True) or (not cert_name) or (name_cmp is None and bool(cert_name)),
    }
    checks["document"] = {k: ("OK" if v else "MISSING") for k, v in doc_fields.items()}
    core_present = (
        doc_fields["certificate"] and doc_fields["qualification"] and doc_fields["institution"]
        and (doc_fields["certificate_number"] or doc_fields["completion_date"])
    )
    if core_present:
        return {"status": CRED_DOCUMENT, "level": "C", "method": M_DOCUMENT, "checks": checks,
                "notes": notes + ["Document evidence reviewed: core certificate fields present and consistent."]}

    # ── LEVEL D — EXCEPTION (insufficient evidence) ──
    missing = [k for k, v in doc_fields.items() if not v]
    return {"status": CRED_ADDITIONAL, "level": "D", "method": M_NONE, "checks": checks,
            "notes": notes + [f"Insufficient evidence. Please provide: {', '.join(missing) or 'additional supporting documents'}."]}


async def _store_cred_result(cred_doc: dict, result: dict, actor: str):
    now = _now()
    flt = {"credential_id": cred_doc["credential_id"]} if cred_doc.get("credential_id") else {"_id": cred_doc["_id"]}
    await credentials.update_one(flt, {"$set": {
        "verification_status": result["status"],
        "verification_level": result["level"],
        "verification_method": result["method"],
        "evidence_notes": result["notes"],
        "checks": result["checks"],
        "verified_at": (now if result["status"] in _CRED_SUFFICIENT else None),
        "updated_at": now,
    }})
    appid = cred_doc["application_id"]
    tid = str(cred_doc["teacher_id"])
    cid = cred_doc.get("credential_id")
    if result["status"] in _CRED_SUFFICIENT:
        await _audit(appid, tid, "CREDENTIAL_VERIFIED", actor, {"credential_id": cid, "level": result["level"], "method": result["method"]})
    elif result["status"] == CRED_COUNCIL:
        await _audit(appid, tid, "COUNCIL_REVIEW_REQUESTED", actor, {"credential_id": cid, "reason": "CREDENTIAL_ANOMALY"})
    elif result["status"] == CRED_ADDITIONAL:
        await _audit(appid, tid, "ADDITIONAL_INFORMATION_REQUESTED", actor, {"credential_id": cid})


async def _rollup_credentials(application_id: str, actor: str) -> str:
    """Roll per-credential outcomes up to the application. Sets credential_status
    only — NEVER empanels (that is Prompt 4)."""
    creds = await credentials.find({"application_id": application_id}).to_list(200)
    statuses = [c.get("verification_status") for c in creds if c.get("verification_status")]
    app = await applications.find_one({"application_id": application_id}) or {}
    prev = app.get("credential_status")
    update = {"updated_at": _now()}

    if not statuses:
        new = APP_CRED_IN_PROGRESS
    elif any(s == CRED_COUNCIL for s in statuses):
        new = APP_CRED_COUNCIL
        update["council_review_required"] = True
        update["council_review_reason"] = app.get("council_review_reason") or "CREDENTIAL_REQUIRES_COUNCIL"
    elif any(s == CRED_ADDITIONAL for s in statuses):
        new = APP_CRED_ADDITIONAL
    elif any(s == CRED_PENDING for s in statuses):
        new = APP_CRED_IN_PROGRESS
    elif all(s in _CRED_SUFFICIENT for s in statuses):
        new = APP_CRED_VERIFIED
    else:
        new = APP_CRED_IN_PROGRESS

    update["credential_status"] = new
    await applications.update_one({"application_id": application_id}, {"$set": update})
    if new == APP_CRED_VERIFIED and prev != APP_CRED_VERIFIED:
        await _audit(application_id, str(app.get("teacher_id")), "CREDENTIAL_VERIFIED", actor, {"scope": "application", "count": len(statuses)})
    elif new == APP_CRED_COUNCIL and prev != APP_CRED_COUNCIL:
        await _audit(application_id, str(app.get("teacher_id")), "COUNCIL_REVIEW_REQUESTED", actor, {"scope": "application"})
    return new


def _agg_cred_status(creds: list) -> str:
    statuses = [c.get("verification_status") for c in creds if c.get("verification_status")]
    if not statuses:
        return "NOT_PROVIDED"
    if any(s == CRED_COUNCIL for s in statuses):
        return "COUNCIL_REVIEW"
    if any(s == CRED_ADDITIONAL for s in statuses):
        return "ADDITIONAL_INFORMATION_REQUIRED"
    if any(s == CRED_PENDING for s in statuses):
        return "PENDING"
    if all(s in _CRED_SUFFICIENT for s in statuses):
        return "VERIFIED"
    return "PENDING"


async def _build_evidence_matrix(application_id: str) -> dict:
    """The 8-category evidence matrix. Each cell: status / source /
    verification_method / date / notes."""
    app = await applications.find_one({"application_id": application_id}) or {}
    ident = await identity.find_one({"application_id": application_id}) or {}
    creds = await credentials.find({"application_id": application_id}).sort("created_at", 1).to_list(200)
    ev = await evidence.find_one({"application_id": application_id}) or {}
    lins = await lineage.find({"application_id": application_id}).to_list(50)

    def cell(status, source, method, date, notes):
        return {"status": status or "NOT_PROVIDED", "source": source, "verification_method": method, "date": date, "notes": notes}

    # IDENTITY — reused InstaKYC (India) or Didit (international); never repeated.
    id_provider = ident.get("provider") or app.get("verification_provider")
    identity_cell = cell(
        ident.get("verification_status") or (app.get("verification_status") if app else None) or "NOT_STARTED",
        ident.get("source") or id_provider, id_provider,
        ident.get("verification_timestamp"), ident.get("failure_reason"),
    )

    # QUALIFICATION — rollup across all credentials.
    qmethods = sorted({c.get("verification_method") for c in creds if c.get("verification_method")})
    qcell = cell(
        _agg_cred_status(creds), "teacher_submission / didit_questionnaire",
        (", ".join(qmethods) if qmethods else None),
        max([c.get("verified_at") for c in creds if c.get("verified_at")], default=None),
        (f"{len(creds)} qualification(s) submitted" if creds else "No qualifications submitted yet"),
    )

    # INSTITUTION — from the credential institution checks.
    inst_names = [c.get("institution_name") for c in creds if c.get("institution_name")]
    inst_checks = [(c.get("checks") or {}).get("institution") for c in creds]
    if any(x in {"RECOGNISED", "WEBSITE_REACHABLE", "AI_RECOGNISED", "RECORDED_ESTABLISHED"} for x in inst_checks):
        inst_status = "VERIFIED"
    elif any(x in {"AI_NOT_ESTABLISHED", "RECORDED_NOT_ESTABLISHED"} for x in inst_checks):
        inst_status = "COUNCIL_REVIEW"
    elif inst_names:
        inst_status = "PENDING"
    else:
        inst_status = "NOT_PROVIDED"
    inst_cell = cell(inst_status, "credential", (M_INSTITUTION if inst_names else None), None,
                     ("; ".join(sorted(set(inst_names))) if inst_names else None))

    # EXPERIENCE — years teaching / teaching history.
    yt = ev.get("years_teaching")
    exp_status = "SUBMITTED" if (yt is not None or ev.get("teaching_history")) else "NOT_PROVIDED"
    exp_cell = cell(exp_status, ev.get("source"), "SELF_DECLARED", ev.get("updated_at"),
                    (f"{yt} years teaching" if yt is not None else None))

    # LINEAGE — tradition / lineage / guru / school.
    lin_status = "SUBMITTED" if lins else "NOT_PROVIDED"
    lin_notes = "; ".join([(l.get("lineage") or l.get("tradition")) for l in lins if (l.get("lineage") or l.get("tradition"))]) if lins else None
    lin_cell = cell(lin_status, (lins[0].get("source") if lins else None), "SELF_DECLARED",
                    (lins[0].get("updated_at") if lins else None), (lin_notes or None))

    # PROFESSIONAL HISTORY — contexts taught in.
    ph_keys = ("corporate_teaching", "educational_institution_teaching", "retreat_teaching",
               "international_teaching", "online_teaching", "offline_teaching")
    ph_bits = [k for k in ph_keys if ev.get(k)]
    ph_cell = cell(("SUBMITTED" if ph_bits else "NOT_PROVIDED"), ev.get("source"), "SELF_DECLARED",
                   ev.get("updated_at"), (", ".join(ph_bits) or None))

    # REFERENCES — professional references / profiles.
    refs = ev.get("professional_references") or ev.get("references") or ev.get("professional_profiles")
    refs_cell = cell(("SUBMITTED" if refs else "NOT_PROVIDED"), ev.get("source"), "SELF_DECLARED",
                     ev.get("updated_at"), (f"{len(refs)} reference(s)/profile(s)" if isinstance(refs, list) else None))

    # DOCUMENTS — certificate documents on file.
    docs = [c for c in creds if c.get("certificate_url")]
    docs_cell = cell(("SUBMITTED" if docs else "NOT_PROVIDED"), "credential", (M_DOCUMENT if docs else None),
                     None, (f"{len(docs)} certificate document(s)" if docs else None))

    return {
        "IDENTITY": identity_cell, "QUALIFICATION": qcell, "INSTITUTION": inst_cell,
        "EXPERIENCE": exp_cell, "LINEAGE": lin_cell, "PROFESSIONAL_HISTORY": ph_cell,
        "REFERENCES": refs_cell, "DOCUMENTS": docs_cell,
    }


# ── Request models ────────────────────────────────────────────────────────────
class CredentialIn(BaseModel):
    qualification_name: Optional[str] = None
    qualification_type: Optional[str] = None
    institution_name: Optional[str] = None
    institution_country: Optional[str] = None
    institution_website: Optional[str] = None
    certificate_number: Optional[str] = None
    certificate_url: Optional[str] = None
    issuing_authority: Optional[str] = None
    verification_contact: Optional[str] = None
    teacher_name_on_certificate: Optional[str] = None
    completion_date: Optional[str] = None
    specialisation: Optional[str] = None
    # Digital proofs (Level A).
    verification_url: Optional[str] = None
    qr_data: Optional[str] = None
    digital_credential_id: Optional[str] = None
    # Service/ops-recorded findings (set by an integration or admin, not the teacher
    # in the browser). digital_result={"verified":bool,"method":str};
    # institution_result={"established":bool,"source":str}.
    digital_result: Optional[dict] = None
    institution_result: Optional[dict] = None


class EvidenceIn(BaseModel):
    years_teaching: Optional[Any] = None
    teaching_history: Optional[str] = None
    corporate_teaching: Optional[Any] = None
    educational_institution_teaching: Optional[Any] = None
    retreat_teaching: Optional[Any] = None
    international_teaching: Optional[Any] = None
    online_teaching: Optional[Any] = None
    offline_teaching: Optional[Any] = None
    professional_references: Optional[List[Any]] = None
    professional_profiles: Optional[List[Any]] = None
    professional_website: Optional[str] = None
    teaching_formats: Optional[Any] = None
    notes: Optional[str] = None


class LineageIn(BaseModel):
    tradition: Optional[str] = None
    lineage: Optional[str] = None
    guru_teacher: Optional[str] = None
    school: Optional[str] = None
    philosophy: Optional[str] = None
    specialisation: Optional[str] = None


class ReuseIdentityIn(BaseModel):
    instakyc_verified: Optional[bool] = None
    provider_reference: Optional[str] = None
    pan_verified: Optional[bool] = None
    bank_verified: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/application/{application_id}/credentials")
async def add_credential(application_id: str, body: CredentialIn, user: dict = Depends(current_user)):
    """Submit a qualification and run the credential verification ladder."""
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    now = _now()
    cred_doc = {
        "credential_id": _oid(),
        "application_id": application_id,
        "teacher_id": str(app["teacher_id"]),
        "expected_teacher_name": user.get("name"),
        **body.model_dump(),
        "source": "teacher_submission",
        "verification_status": CRED_PENDING,
        "created_at": now,
        "updated_at": now,
    }
    await credentials.insert_one(cred_doc)
    await _audit(application_id, str(app["teacher_id"]), "CREDENTIAL_SUBMITTED", str(user["user_id"]),
                 {"credential_id": cred_doc["credential_id"], "qualification": body.qualification_name})
    siblings = await credentials.find({"application_id": application_id}).to_list(200)
    result = await _assess_credential(cred_doc, cred_doc.get("expected_teacher_name"), siblings)
    await _store_cred_result(cred_doc, result, str(user["user_id"]))
    app_status = await _rollup_credentials(application_id, str(user["user_id"]))
    doc = await credentials.find_one({"credential_id": cred_doc["credential_id"]})
    return {"credential": _strip(doc), "assessment": result, "application_credential_status": app_status}


@router.get("/application/{application_id}/credentials")
async def list_credentials(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    creds = await credentials.find({"application_id": application_id}).sort("created_at", 1).to_list(200)
    return {"credentials": [_strip(c) for c in creds]}


@router.patch("/application/{application_id}/credentials/{credential_id}")
async def update_credential(application_id: str, credential_id: str, body: CredentialIn, user: dict = Depends(current_user)):
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    cred = await credentials.find_one({"credential_id": credential_id, "application_id": application_id})
    if not cred:
        raise HTTPException(status_code=404, detail="credential not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    await credentials.update_one({"credential_id": credential_id}, {"$set": updates})
    cred = await credentials.find_one({"credential_id": credential_id})
    siblings = await credentials.find({"application_id": application_id}).to_list(200)
    result = await _assess_credential(cred, cred.get("expected_teacher_name"), siblings)
    await _store_cred_result(cred, result, str(user["user_id"]))
    app_status = await _rollup_credentials(application_id, str(user["user_id"]))
    return {"credential": _strip(await credentials.find_one({"credential_id": credential_id})),
            "assessment": result, "application_credential_status": app_status}


@router.post("/application/{application_id}/credentials/{credential_id}/reverify")
async def reverify_credential(application_id: str, credential_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    cred = await credentials.find_one({"credential_id": credential_id, "application_id": application_id})
    if not cred:
        raise HTTPException(status_code=404, detail="credential not found")
    siblings = await credentials.find({"application_id": application_id}).to_list(200)
    result = await _assess_credential(cred, cred.get("expected_teacher_name"), siblings)
    await _store_cred_result(cred, result, str(user["user_id"]))
    app_status = await _rollup_credentials(application_id, str(user["user_id"]))
    return {"credential": _strip(await credentials.find_one({"credential_id": credential_id})),
            "assessment": result, "application_credential_status": app_status}


@router.post("/application/{application_id}/credentials/verify-all")
async def verify_all_credentials(application_id: str, user: dict = Depends(current_user)):
    """Re-assess every credential and roll up to the application. Returns the
    evidence matrix. Prepares (does NOT perform) the empanelment assessment."""
    await _ensure_indexes()
    await _load_app(application_id, user)
    creds = await credentials.find({"application_id": application_id}).to_list(200)
    for c in creds:
        result = await _assess_credential(c, c.get("expected_teacher_name"), creds)
        await _store_cred_result(c, result, str(user["user_id"]))
    app_status = await _rollup_credentials(application_id, str(user["user_id"]))
    return {"application_credential_status": app_status, "evidence_matrix": await _build_evidence_matrix(application_id)}


@router.post("/application/{application_id}/professional-evidence")
async def upsert_professional_evidence(application_id: str, body: EvidenceIn, user: dict = Depends(current_user)):
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    now = _now()
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    await evidence.update_one(
        {"application_id": application_id},
        {"$set": {**data, "application_id": application_id, "teacher_id": str(app["teacher_id"]),
                  "evidence_status": "SUBMITTED", "source": "teacher_submission", "updated_at": now},
         "$setOnInsert": {"evidence_id": _oid(), "created_at": now}},
        upsert=True,
    )
    await applications.update_one({"application_id": application_id},
                                  {"$set": {"professional_evidence_status": "SUBMITTED", "updated_at": now}})
    await _audit(application_id, str(app["teacher_id"]), "PROFESSIONAL_EVIDENCE_SUBMITTED", str(user["user_id"]),
                 {"fields": list(data.keys())})
    return {"professional_evidence": _strip(await evidence.find_one({"application_id": application_id}))}


@router.get("/application/{application_id}/professional-evidence")
async def get_professional_evidence(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    return {"professional_evidence": _strip(await evidence.find_one({"application_id": application_id}))}


@router.post("/application/{application_id}/lineage")
async def add_lineage(application_id: str, body: LineageIn, user: dict = Depends(current_user)):
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    now = _now()
    doc = {
        "lineage_id": _oid(), "application_id": application_id, "teacher_id": str(app["teacher_id"]),
        **{k: v for k, v in body.model_dump().items() if v is not None},
        "verification_status": "PENDING", "source": "teacher_submission",
        "created_at": now, "updated_at": now,
    }
    await lineage.insert_one(doc)
    return {"lineage": _strip(doc)}


@router.post("/application/{application_id}/reuse-identity")
async def reuse_identity(application_id: str, body: ReuseIdentityIn, user: dict = Depends(current_user)):
    """INDIA only: reuse the existing verified InstaKYC identity result instead of
    re-verifying identity. The BFF supplies the remote InstaKYC status server-side.
    On success the application continues straight to credential verification."""
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    if app.get("verification_route") != ROUTE_INDIA:
        raise HTTPException(status_code=400, detail="Identity reuse applies to Indian InstaKYC only.")
    if not body.instakyc_verified:
        raise HTTPException(status_code=400, detail="InstaKYC identity is not verified yet.")
    now = _now()
    await identity.update_one(
        {"application_id": application_id},
        {"$set": {
            "application_id": application_id, "provider": PROVIDER_INSTAKYC,
            "provider_reference": body.provider_reference, "verification_status": "IDENTITY_VERIFIED",
            "source": "instakyc_reused", "pan_verified": body.pan_verified, "bank_verified": body.bank_verified,
            "verification_timestamp": now, "updated_at": now,
        }, "$setOnInsert": {"identity_verification_id": _oid(), "created_at": now}},
        upsert=True,
    )
    update = {"updated_at": now, "existing_instakyc_reused": True}
    if app.get("verification_status") not in _TERMINAL_VERIFICATION:
        update["verification_status"] = "IDENTITY_VERIFIED"
        update["credential_status"] = APP_CRED_IN_PROGRESS
    await applications.update_one({"application_id": application_id}, {"$set": update})
    await _audit(application_id, str(app["teacher_id"]), "IDENTITY_VERIFIED", str(user["user_id"]),
                 {"provider": "INSTAKYC", "reused": True})
    return {"ok": True, "application": _public_app(await applications.find_one({"application_id": application_id}))}


@router.get("/application/{application_id}/evidence-matrix")
async def get_evidence_matrix(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    return {"evidence_matrix": await _build_evidence_matrix(application_id)}


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT 4 — RULES-BASED EMPANELMENT ENGINE (transparent / auditable / versioned)
#
# NOT an AI score. Eight mandatory, configurable rules are evaluated; every rule
# records PASS / FAIL / REVIEW / ADDITIONAL / NOT_CONFIGURED with a plain-language
# reason and the evidence it used. The decision + full rule trace is written as an
# IMMUTABLE record stamped with the rule version.
#
# PARALLEL / SHADOW operation: this engine does NOT touch the existing (remote)
# Empanelment workflow or the teacher's authoritative `is_empanelled`. It runs in
# `engine_mode="parallel"` by default (feature flag) so NOSTOPS can test it safely
# alongside production. Thresholds are NOT invented — admins populate them.
# ══════════════════════════════════════════════════════════════════════════════
rules_config = db["verification_rules_config"]  # admin-populated, per rule_version

# Decision outcomes. Policy V2 (founder-approved): the engine NEVER empanels — when
# every verification rule passes the outcome is ELIGIBLE, and empanelment needs a
# Council interaction + an explicit Council / admin decision (empanelment_policy.py).
D_EMPANELLED = "EMPANELLED"
D_ELIGIBLE = "ELIGIBLE"
D_ADDITIONAL = "ADDITIONAL_INFORMATION_REQUIRED"
D_COUNCIL = "COUNCIL_REVIEW"
D_NOT = "NOT_EMPANELLED"

# Per-rule statuses.
R_PASS = "PASS"
R_FAIL = "FAIL"            # definitive mandatory failure  -> NOT_EMPANELLED
R_REVIEW = "REVIEW"        # interpretation/exception       -> COUNCIL_REVIEW
R_ADDITIONAL = "ADDITIONAL"  # evidence incomplete          -> ADDITIONAL_INFORMATION_REQUIRED
R_NOT_CONFIGURED = "NOT_CONFIGURED"  # threshold unset — treated as PASS, flagged
_R_OK = {R_PASS, R_NOT_CONFIGURED}

ENGINE_MODE_PARALLEL = "parallel"
ENGINE_MODE_ACTIVE = "active"

# Defaults invent NO numerical thresholds — NOSTOPS populates these via the admin
# config endpoint. Empty/None means "not enforced".
DEFAULT_EMPANELMENT_CONFIG = {
    "rule_version": RULE_VERSION,
    "engine_mode": ENGINE_MODE_PARALLEL,
    "minimum_teaching_years": None,
    "minimum_teaching_hours": None,
    "required_qualification_level": None,
    "required_documents": [],
    "required_evidence": [],
    "accepted_verification_methods": [],  # empty = accept all NOSTOPS methods
    "review_triggers": [],
}

_QUAL_RANKS = (800, 500, 300, 200, 100)


def _to_int(v):
    if v is None:
        return None
    try:
        m = _re.search(r"\d+", str(v))
        return int(m.group(0)) if m else None
    except Exception:  # noqa: BLE001
        return None


def _qual_rank(name: Optional[str]):
    """Best-effort numeric rank for common hour-based qualifications (RYT-200/500,
    etc). Returns an int or None (None = cannot interpret -> needs Council)."""
    if not name:
        return None
    s = str(name).upper().replace(" ", "").replace("_", "")
    for r in _QUAL_RANKS:
        if str(r) in s:
            return r
    return None


def _qual_meets(cred: dict, required: Optional[str]):
    """True / False / None(cannot interpret) for a credential vs required level."""
    rc = _qual_rank(cred.get("qualification_name") or cred.get("qualification_type"))
    rr = _qual_rank(required)
    if rr is None or rc is None:
        return None
    return rc >= rr


async def _get_empanelment_config() -> dict:
    stored = await rules_config.find_one({"rule_version": RULE_VERSION})
    cfg = dict(DEFAULT_EMPANELMENT_CONFIG)
    if stored:
        cfg.update({k: v for k, v in stored.items() if k != "_id"})
    return cfg


def _rule(rule_id, name, status, reason, evidence=None):
    return {"rule": rule_id, "name": name, "status": status, "reason": reason, "evidence": evidence or {}}


def _evaluate_rules(app, ident, creds, ev, lins, cfg, ctx):
    """Evaluate RULE-01..RULE-08. Returns (rules, evidence_used, exceptions).
    Pure + deterministic — no AI, no network."""
    ident = ident or {}
    ev = ev or {}
    creds = creds or []
    rules = []
    exceptions = []

    suff = [c for c in creds if c.get("verification_status") in _CRED_SUFFICIENT]
    council_creds = [c for c in creds if c.get("verification_status") == CRED_COUNCIL]
    addl_creds = [c for c in creds if c.get("verification_status") == CRED_ADDITIONAL]

    # RULE-01 — Identity verified.
    istatus = ident.get("verification_status")
    if istatus == "IDENTITY_VERIFIED":
        rules.append(_rule("RULE-01", "Identity verified", R_PASS, "Identity is verified.",
                           {"provider": ident.get("provider"), "status": istatus}))
    elif istatus == "IDENTITY_FAILED":
        rules.append(_rule("RULE-01", "Identity verified", R_FAIL, "Identity verification failed.",
                           {"status": istatus, "reason": ident.get("failure_reason")}))
    else:
        rules.append(_rule("RULE-01", "Identity verified", R_ADDITIONAL,
                           "Identity has not been verified yet.", {"status": istatus}))

    # RULE-02 — Primary yoga qualification satisfies NOSTOPS requirement.
    req_level = cfg.get("required_qualification_level")
    if not creds:
        rules.append(_rule("RULE-02", "Primary qualification", R_ADDITIONAL, "No qualification submitted."))
    elif suff:
        if not req_level:
            rules.append(_rule("RULE-02", "Primary qualification", R_PASS,
                               "A verified qualification is on file (no specific level is configured).",
                               {"qualifications": [c.get("qualification_name") for c in suff]}))
        else:
            meets = [_qual_meets(c, req_level) for c in suff]
            if any(m is True for m in meets):
                rules.append(_rule("RULE-02", "Primary qualification", R_PASS,
                                   f"A qualification meets the required level ({req_level}).",
                                   {"required": req_level}))
            elif any(m is None for m in meets):
                rules.append(_rule("RULE-02", "Primary qualification", R_REVIEW,
                                   f"Qualification cannot be automatically mapped to the required level ({req_level}); Council interpretation needed.",
                                   {"required": req_level, "qualifications": [c.get("qualification_name") for c in suff]}))
            else:
                rules.append(_rule("RULE-02", "Primary qualification", R_FAIL,
                                   f"Qualification is below the required level ({req_level}).",
                                   {"required": req_level}))
    elif council_creds:
        rules.append(_rule("RULE-02", "Primary qualification", R_REVIEW,
                           "Submitted qualification requires Council review."))
    else:
        rules.append(_rule("RULE-02", "Primary qualification", R_ADDITIONAL,
                           "Qualification is not yet sufficiently supported."))

    # RULE-03 — Teaching experience satisfies configured requirement.
    min_years = _to_int(cfg.get("minimum_teaching_years"))
    min_hours = _to_int(cfg.get("minimum_teaching_hours"))
    years = _to_int(ev.get("years_teaching"))
    hours = _to_int(ctx.get("teaching_hours") if ctx.get("teaching_hours") is not None else ev.get("teaching_hours"))
    if not min_years and not min_hours:
        rules.append(_rule("RULE-03", "Teaching experience", R_NOT_CONFIGURED,
                           "No minimum teaching experience is configured.", {"years": years, "hours": hours}))
    else:
        r3_status, r3_reason = R_PASS, "Teaching experience meets the configured minimum."
        if min_years:
            if years is None:
                r3_status, r3_reason = R_ADDITIONAL, "Years of teaching experience not provided."
            elif years < min_years:
                r3_status, r3_reason = R_FAIL, f"Teaching years ({years}) are below the minimum ({min_years})."
        if r3_status == R_PASS and min_hours:
            if hours is None:
                r3_status, r3_reason = R_ADDITIONAL, "Teaching hours not provided."
            elif hours < min_hours:
                r3_status, r3_reason = R_FAIL, f"Teaching hours ({hours}) are below the minimum ({min_hours})."
        rules.append(_rule("RULE-03", "Teaching experience", r3_status, r3_reason,
                           {"years": years, "min_years": min_years, "hours": hours, "min_hours": min_hours}))

    # RULE-04 — Teacher profile complete.
    pc = ctx.get("profile_complete")
    pcp = ctx.get("profile_completeness")
    if pc is True:
        rules.append(_rule("RULE-04", "Profile complete", R_PASS, "Teacher profile is complete.",
                           {"completeness": pcp}))
    elif pc is False:
        rules.append(_rule("RULE-04", "Profile complete", R_ADDITIONAL, "Teacher profile is incomplete.",
                           {"completeness": pcp}))
    else:
        rules.append(_rule("RULE-04", "Profile complete", R_ADDITIONAL,
                           "Profile completeness was not supplied for this assessment.", {"completeness": pcp}))

    # RULE-05 — Required evidence / documents available.
    missing = []
    for key in (cfg.get("required_evidence") or []):
        if not ev.get(key):
            missing.append(f"evidence:{key}")
    for doc in (cfg.get("required_documents") or []):
        d = str(doc).lower()
        if d in ("certificate", "certificates"):
            if not any(c.get("certificate_url") for c in creds):
                missing.append("document:certificate")
        elif not ev.get(doc):
            missing.append(f"document:{doc}")
    if not (cfg.get("required_evidence") or cfg.get("required_documents")):
        rules.append(_rule("RULE-05", "Required evidence available", R_NOT_CONFIGURED,
                           "No mandatory evidence/documents are configured."))
    elif missing:
        rules.append(_rule("RULE-05", "Required evidence available", R_ADDITIONAL,
                           f"Required items missing: {', '.join(missing)}.", {"missing": missing}))
    else:
        rules.append(_rule("RULE-05", "Required evidence available", R_PASS,
                           "All required evidence/documents are on file."))

    # RULE-06 — No unresolved material identity discrepancy.
    disc = []
    if (ident.get("face_match_status") or "").lower() in {"declined", "failed", "no_match"}:
        disc.append("face_match")
    if (ident.get("risk_status") or "").lower() in {"review", "high", "high risk", "declined", "rejected"}:
        disc.append("risk")
    if istatus == "IN_REVIEW":
        disc.append("identity_in_review")
    if disc:
        exceptions.append({"rule": "RULE-06", "type": "IDENTITY_DISCREPANCY", "reason": ", ".join(disc)})
        rules.append(_rule("RULE-06", "No identity discrepancy", R_REVIEW,
                           f"Identity signals need review: {', '.join(disc)}.", {"discrepancies": disc}))
    else:
        rules.append(_rule("RULE-06", "No identity discrepancy", R_PASS, "No material identity discrepancy."))

    # RULE-07 — No unresolved credential contradiction.
    if council_creds:
        ids = [c.get("credential_id") for c in council_creds]
        exceptions.append({"rule": "RULE-07", "type": "CREDENTIAL_CONTRADICTION", "reason": f"{len(ids)} credential(s) flagged"})
        rules.append(_rule("RULE-07", "No credential contradiction", R_REVIEW,
                           "One or more credentials have an unresolved conflict/anomaly.", {"credential_ids": ids}))
    else:
        rules.append(_rule("RULE-07", "No credential contradiction", R_PASS, "No unresolved credential contradiction."))

    # RULE-08 — No unresolved mandatory exception.
    exc08 = []
    if app.get("council_review_required"):
        exc08.append(app.get("council_review_reason") or "COUNCIL_REQUIRED")
    for trig in (cfg.get("review_triggers") or []):
        t = str(trig).lower()
        fired = False
        if t in {"international", "international_teacher"} and app.get("verification_route") == ROUTE_INTERNATIONAL:
            fired = True
        elif t in {"credential_council", "credential_contradiction"} and council_creds:
            fired = True
        elif t in {"identity_discrepancy"} and disc:
            fired = True
        if fired:
            exc08.append(str(trig))
    if exc08:
        for e in exc08:
            exceptions.append({"rule": "RULE-08", "type": "MANDATORY_EXCEPTION", "reason": e})
        rules.append(_rule("RULE-08", "No unresolved mandatory exception", R_REVIEW,
                           f"Mandatory exception(s) require Council: {', '.join(exc08)}.", {"exceptions": exc08}))
    else:
        rules.append(_rule("RULE-08", "No unresolved mandatory exception", R_PASS, "No unresolved mandatory exception."))

    evidence_used = {
        "identity": {"status": istatus, "provider": ident.get("provider")},
        "credentials": [{"credential_id": c.get("credential_id"), "qualification_name": c.get("qualification_name"),
                         "verification_status": c.get("verification_status"),
                         "verification_method": c.get("verification_method")} for c in creds],
        "years_teaching": years, "teaching_hours": hours,
        "documents": [c.get("credential_id") for c in creds if c.get("certificate_url")],
        "profile_complete": pc, "profile_completeness": pcp,
        "lineage_count": len(lins or []),
    }
    return rules, evidence_used, exceptions


def _decide(rules, level):
    statuses = [r["status"] for r in rules]
    if R_FAIL in statuses:
        decision = D_NOT
    elif R_REVIEW in statuses:
        decision = D_COUNCIL
    elif R_ADDITIONAL in statuses:
        decision = D_ADDITIONAL
    else:
        decision = D_ELIGIBLE  # never auto-empanel (Policy V2)

    council_recognition_required = False
    if level == LEVEL_GURU and decision != D_NOT:
        # L3 Yoga Guru is NEVER auto-granted — Council recognition is mandatory.
        decision = D_COUNCIL
        council_recognition_required = True
    return decision, council_recognition_required


def _decision_reason(decision, rules, council_recognition_required):
    if council_recognition_required:
        return "COUNCIL_RECOGNITION_REQUIRED"
    if decision == D_ELIGIBLE:
        return ("All verification rules passed. Empanelment still needs a Council interaction and an "
                "explicit Council or admin decision (Empanelment Policy V2).")
    not_ok = [r for r in rules if r["status"] not in _R_OK]
    if decision == D_NOT:
        fails = [f"{r['rule']}: {r['reason']}" for r in not_ok if r["status"] == R_FAIL]
        return "Not empanelled — " + "; ".join(fails)
    if decision == D_COUNCIL:
        revs = [f"{r['rule']}: {r['reason']}" for r in not_ok if r["status"] == R_REVIEW]
        return "Council review required — " + "; ".join(revs)
    adds = [f"{r['rule']}: {r['reason']}" for r in not_ok if r["status"] == R_ADDITIONAL]
    return "Additional information required — " + "; ".join(adds)


_DECISION_TO_EMPANELMENT = {
    D_EMPANELLED: "EMPANELLED", D_ELIGIBLE: "ELIGIBLE", D_ADDITIONAL: "ADDITIONAL_INFORMATION_REQUIRED",
    D_COUNCIL: "COUNCIL_REVIEW", D_NOT: "NOT_EMPANELLED",
}


# ── Config models/endpoints (admin populates thresholds) ──────────────────────
class EmpanelmentConfigIn(BaseModel):
    engine_mode: Optional[str] = None
    minimum_teaching_years: Optional[Any] = None
    minimum_teaching_hours: Optional[Any] = None
    required_qualification_level: Optional[str] = None
    required_documents: Optional[List[Any]] = None
    required_evidence: Optional[List[Any]] = None
    accepted_verification_methods: Optional[List[Any]] = None
    review_triggers: Optional[List[Any]] = None


@router.get("/empanelment/config")
async def get_empanelment_config(_: dict = Depends(current_user)):
    await _ensure_indexes()
    return {"config": await _get_empanelment_config()}


@router.put("/empanelment/config")
async def set_empanelment_config(body: EmpanelmentConfigIn, user: dict = Depends(admin_user)):
    await _ensure_indexes()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "engine_mode" in updates and updates["engine_mode"] not in {ENGINE_MODE_PARALLEL, ENGINE_MODE_ACTIVE}:
        raise HTTPException(status_code=400, detail="engine_mode must be 'parallel' or 'active'.")
    updates["rule_version"] = RULE_VERSION
    updates["updated_at"] = _now()
    updates["updated_by"] = str(user["user_id"])
    await rules_config.update_one({"rule_version": RULE_VERSION}, {"$set": updates}, upsert=True)
    return {"ok": True, "config": await _get_empanelment_config()}


# ── Assessment ────────────────────────────────────────────────────────────────
class EmpanelAssessIn(BaseModel):
    profile_complete: Optional[bool] = None
    profile_completeness: Optional[int] = None
    teaching_hours: Optional[Any] = None
    config_override: Optional[dict] = None   # admin-only (safe test of a rule set)
    mode_override: Optional[str] = None        # admin-only


@router.post("/application/{application_id}/empanelment/assess")
async def assess_empanelment(application_id: str, body: EmpanelAssessIn, user: dict = Depends(current_user)):
    """Run the rules-based empanelment engine and record an IMMUTABLE decision.
    Runs in parallel/shadow mode by default — never touches the existing
    (remote) Empanelment workflow or the teacher's authoritative is_empanelled."""
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    is_admin = user.get("role") == "admin"

    cfg = await _get_empanelment_config()
    if is_admin and body.config_override:
        cfg = {**cfg, **body.config_override}
    mode = cfg.get("engine_mode") or ENGINE_MODE_PARALLEL
    if is_admin and body.mode_override in {ENGINE_MODE_PARALLEL, ENGINE_MODE_ACTIVE}:
        mode = body.mode_override

    ident = await identity.find_one({"application_id": application_id})
    creds = await credentials.find({"application_id": application_id}).sort("created_at", 1).to_list(200)
    ev = await evidence.find_one({"application_id": application_id})
    lins = await lineage.find({"application_id": application_id}).to_list(50)

    ctx = {
        "profile_complete": body.profile_complete,
        "profile_completeness": body.profile_completeness,
        "teaching_hours": body.teaching_hours,
    }
    level = app.get("teacher_level")

    await applications.update_one({"application_id": application_id},
                                  {"$set": {"empanelment_status": "ASSESSMENT_PENDING", "updated_at": _now()}})
    await _audit(application_id, str(app["teacher_id"]), "EMPANELMENT_ASSESSMENT_STARTED", str(user["user_id"]),
                 {"mode": mode, "rule_version": RULE_VERSION})

    rules, evidence_used, exceptions = _evaluate_rules(app, ident, creds, ev, lins, cfg, ctx)
    decision, council_recognition_required = _decide(rules, level)
    reason = _decision_reason(decision, rules, council_recognition_required)
    rules_passed = [r["rule"] for r in rules if r["status"] in _R_OK]
    rules_failed = [r["rule"] for r in rules if r["status"] not in _R_OK]

    now = _now()
    record = {
        "assessment_id": _oid(),
        "application_id": application_id,
        "teacher_id": str(app["teacher_id"]),
        "teacher_level": level,
        "rule_version": RULE_VERSION,
        "mode": mode,
        "rules_evaluated": rules,
        "rules_passed": rules_passed,
        "rules_failed": rules_failed,
        "evidence_used": evidence_used,
        "exceptions": exceptions,
        "decision": decision,
        "decision_reason": reason,
        "council_recognition_required": council_recognition_required,
        "config_snapshot": {k: cfg.get(k) for k in DEFAULT_EMPANELMENT_CONFIG if k != "engine_mode"},
        "assessed_at": now,
        "assessed_by": str(user["user_id"]),
    }
    await assessments.insert_one(record)  # IMMUTABLE — never updated

    # Reflect the decision on the LOCAL application only (shadow). Remote
    # Empanelment + authoritative is_empanelled are never touched here.
    app_update = {"empanelment_status": _DECISION_TO_EMPANELMENT[decision], "updated_at": now}
    if decision == D_NOT:
        app_update["verification_status"] = "NOT_VERIFIED"
        app_update["completed_at"] = now
    if council_recognition_required:
        app_update["council_review_required"] = True
        app_update["council_review_reason"] = "LEVEL_3_GURU_REQUIRES_COUNCIL"
    await applications.update_one({"application_id": application_id}, {"$set": app_update})

    # Policy V2: an assessment never grants an entitlement or badge.
    event = {
        D_ELIGIBLE: "EMPANELMENT_PREREQUISITES_MET", D_NOT: "EMPANELMENT_REJECTED",
        D_COUNCIL: "COUNCIL_REVIEW_REQUESTED", D_ADDITIONAL: "ADDITIONAL_INFORMATION_REQUESTED",
    }[decision]
    await _audit(application_id, str(app["teacher_id"]), event, str(user["user_id"]),
                 {"decision": decision, "reason": reason, "mode": mode, "assessment_id": record["assessment_id"]})

    return {"assessment": _strip(record), "mode": mode}


@router.get("/application/{application_id}/empanelment/assessments")
async def list_assessments(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    docs = await assessments.find({"application_id": application_id}).sort("assessed_at", 1).to_list(100)
    return {"assessments": [_strip(d) for d in docs]}


@router.get("/application/{application_id}/empanelment/latest")
async def latest_assessment(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    doc = await assessments.find_one({"application_id": application_id}, sort=[("assessed_at", -1)])
    return {"assessment": _strip(doc) if doc else None}

# ══════════════════════════════════════════════════════════════════════════════
# PROMPT 5 — COUNCIL GOVERNANCE, EXCEPTIONS, APPEALS & AUDIT
#
# The Council of Yoga Gurus is the STANDARDS / EXCEPTION / APPEAL / LEVEL-3 /
# AUDIT authority — it does NOT interview normal automated Level-2 applications.
# Only COUNCIL_REVIEW, Level-3, appeals and audit-flagged items reach the queue.
# Enhances (does NOT remove) the existing Council/Empanelment functionality.
#
# §9 Security: only Council/Admin may read sensitive verification evidence. Raw
# identity data, internal fraud/verification signals, provider secrets and
# Council internal notes are NEVER exposed to the teacher.
# ══════════════════════════════════════════════════════════════════════════════
COUNCIL_ROLES = {"admin", "council", "guru"}


def _is_privileged(user: dict) -> bool:
    return str(user.get("role") or "").lower() in COUNCIL_ROLES


async def council_user(user: dict = Depends(current_user)) -> dict:
    if not _is_privileged(user):
        raise HTTPException(status_code=403, detail="Council or Administrator access required.")
    return user


# ── Redaction (§9) — teacher-safe views ───────────────────────────────────────
_IDENTITY_SAFE_KEYS = {
    "application_id", "provider", "verification_status", "source",
    "verification_timestamp", "pan_verified", "bank_verified",
    "created_at", "updated_at", "identity_verification_id",
}
_CRED_SENSITIVE_KEYS = {"checks", "digital_result", "institution_result", "expected_teacher_name", "_id"}


def _redact_identity(ident, privileged: bool):
    if not ident:
        return None
    if privileged:
        return _strip(ident)
    return {k: v for k, v in ident.items() if k in _IDENTITY_SAFE_KEYS}


def _redact_credential(cred, privileged: bool):
    if not cred:
        return None
    if privileged:
        return _strip(cred)
    return {k: v for k, v in cred.items() if k not in _CRED_SENSITIVE_KEYS}


def _safe_rule(r: dict):
    reason = r.get("reason")
    if r.get("rule") == "RULE-06" and r.get("status") != R_PASS:
        reason = "Identity verification requires a manual Council review."
    return {"rule": r.get("rule"), "name": r.get("name"), "status": r.get("status"), "reason": reason}


def _redact_assessment(a, privileged: bool):
    if not a:
        return None
    if privileged:
        return _strip(a)
    a = _strip(a)
    decision = a.get("decision")
    if decision == D_COUNCIL:
        safe_reason = ("Council recognition is required for Yoga Guru."
                       if a.get("council_recognition_required") else "Your application is under Council review.")
    else:
        safe_reason = a.get("decision_reason")
    return {
        "assessment_id": a.get("assessment_id"),
        "application_id": a.get("application_id"),
        "rule_version": a.get("rule_version"),
        "decision": decision,
        "decision_reason": safe_reason,
        "council_recognition_required": a.get("council_recognition_required"),
        "rules_evaluated": [_safe_rule(r) for r in (a.get("rules_evaluated") or [])],
        "rules_passed": a.get("rules_passed"),
        "rules_failed": a.get("rules_failed"),
        "assessed_at": a.get("assessed_at"),
    }


# ── Exception codes (configurable) — EX-01..EX-12 ─────────────────────────────
DEFAULT_EXCEPTION_CODES = {
    "EX-01": "Identity mismatch",
    "EX-02": "Expired document",
    "EX-03": "Liveness/face mismatch",
    "EX-04": "Qualification cannot be verified",
    "EX-05": "Institution cannot be established",
    "EX-06": "Conflicting credentials",
    "EX-07": "Insufficient experience",
    "EX-08": "Unusual international qualification",
    "EX-09": "Name variation",
    "EX-10": "Teacher appeal",
    "EX-11": "Potential document manipulation",
    "EX-12": "Council discretion",
}


async def _get_exception_codes() -> dict:
    stored = await rules_config.find_one({"rule_version": RULE_VERSION})
    codes = dict(DEFAULT_EXCEPTION_CODES)
    if stored and isinstance(stored.get("exception_codes"), dict):
        codes.update(stored["exception_codes"])
    return codes


def _in_past(date_str) -> bool:
    if not date_str:
        return False
    try:
        import datetime as _dt
        s = str(date_str).replace("Z", "")
        d = _dt.datetime.fromisoformat(s[:19]) if "T" in s else _dt.datetime.fromisoformat(s[:10])
        return d < _dt.datetime.utcnow()
    except Exception:  # noqa: BLE001
        return False


async def _derive_exception_codes(app, ident, creds, ev, assessment) -> list:
    """Map the engine's findings onto the standard EX-xx codes. Internal signals
    are summarised, not exposed verbatim to teachers."""
    ident = ident or {}
    creds = creds or []
    codes = []

    def add(code, detail=None):
        codes.append({"code": code, "detail": detail})

    # Identity-level
    if (ident.get("face_match_status") or "").lower() in {"declined", "failed", "no_match"}:
        add("EX-03", "Face/liveness check needs review")
    if (ident.get("risk_status") or "").lower() in {"review", "high", "high risk", "declined", "rejected"}:
        add("EX-01", "Identity risk signal")
    if ident.get("document_expiry") and _in_past(ident.get("document_expiry")):
        add("EX-02", "Identity document expired")
    if (ident.get("didit_status") or "") == "Kyc Expired":
        add("EX-02", "Identity verification expired")

    # Credential-level
    for c in creds:
        chk = c.get("checks") or {}
        if chk.get("institution") in {"AI_NOT_ESTABLISHED", "RECORDED_NOT_ESTABLISHED"}:
            add("EX-05", "Institution could not be established")
        if chk.get("conflict") == "CERT_NUMBER_CONFLICT":
            add("EX-06", "Conflicting certificate")
        if chk.get("name_match") == "CONFLICT":
            add("EX-09", "Name on certificate differs")
        if c.get("verification_status") == CRED_ADDITIONAL:
            add("EX-04", "Qualification not yet verified")

    # Assessment / rules-level
    if assessment:
        rf = assessment.get("rules_failed") or []
        rules = {r.get("rule"): r for r in (assessment.get("rules_evaluated") or [])}
        if "RULE-03" in rf and (rules.get("RULE-03") or {}).get("status") == R_FAIL:
            add("EX-07", "Teaching experience below configured minimum")
        r2 = rules.get("RULE-02") or {}
        if r2.get("status") == R_REVIEW and app.get("verification_route") == ROUTE_INTERNATIONAL:
            add("EX-08", "Unusual international qualification")

    # Appeal
    if await appeals.find_one({"application_id": app.get("application_id"), "status": "PENDING"}):
        add("EX-10", "Teacher appeal pending")

    # De-dup preserving order
    seen = set()
    out = []
    for c in codes:
        if c["code"] in seen:
            continue
        seen.add(c["code"])
        out.append(c)
    return out


async def _latest_assessment(application_id: str):
    return await assessments.find_one({"application_id": application_id}, sort=[("assessed_at", -1)])


async def _council_decision_record(app, user, action, decision, note, exception_code, requested_information):
    """Immutable council ruling. `note` is an INTERNAL Council note (never shown
    to the teacher)."""
    rec = {
        "decision_id": _oid(),
        "application_id": app["application_id"],
        "teacher_id": str(app["teacher_id"]),
        "teacher_level": app.get("teacher_level"),
        "reviewer": str(user["user_id"]),
        "action": action,
        "decision": decision,
        "exception_code": exception_code,
        "internal_note": note,            # council/admin only
        "requested_information": requested_information,
        "rule_version": RULE_VERSION,
        "created_at": _now(),
    }
    await council_decisions.insert_one(rec)
    return rec


# ── Config: exception codes ───────────────────────────────────────────────────
@router.get("/council/exception-codes")
async def get_exception_codes(_: dict = Depends(council_user)):
    return {"exception_codes": await _get_exception_codes()}


class ExceptionCodesIn(BaseModel):
    exception_codes: dict


@router.put("/council/exception-codes")
async def set_exception_codes(body: ExceptionCodesIn, user: dict = Depends(admin_user)):
    await _ensure_indexes()
    await rules_config.update_one(
        {"rule_version": RULE_VERSION},
        {"$set": {"rule_version": RULE_VERSION, "exception_codes": body.exception_codes,
                  "updated_at": _now(), "updated_by": str(user["user_id"])}},
        upsert=True,
    )
    return {"ok": True, "exception_codes": await _get_exception_codes()}


# ── Council queue ─────────────────────────────────────────────────────────────
@router.get("/council/queue")
async def council_queue(
    user: dict = Depends(council_user),
    country: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    """Applications that genuinely need the Council: COUNCIL_REVIEW, Level-3 and
    appeal-pending. Normal automated Level-2 applications NEVER appear here."""
    await _ensure_indexes()
    q = {"$or": [
        {"empanelment_status": {"$in": ["COUNCIL_REVIEW", "APPEAL_PENDING"]}},
        {"council_review_required": True, "empanelment_status": {"$nin": ["EMPANELLED", "NOT_EMPANELLED"]}},
    ]}
    if country:
        q["country"] = {"$regex": f"^{_re.escape(country)}$", "$options": "i"}
    if level:
        q["teacher_level"] = _norm_level(level)
    apps = await applications.find(q).sort("updated_at", -1).to_list(limit)
    codes_cfg = await _get_exception_codes()
    items = []
    for app in apps:
        aid = app["application_id"]
        ident = await identity.find_one({"application_id": aid})
        creds = await credentials.find({"application_id": aid}).sort("created_at", 1).to_list(100)
        ev = await evidence.find_one({"application_id": aid})
        asm = await _latest_assessment(aid)
        exc = await _derive_exception_codes(app, ident, creds, ev, asm)
        for e in exc:
            e["label"] = codes_cfg.get(e["code"], e["code"])
        items.append({
            "application_id": aid,
            "teacher_id": str(app.get("teacher_id")),
            "teacher_handle": app.get("teacher_handle"),
            "country": app.get("country"),
            "teacher_level": app.get("teacher_level"),
            "identity_status": (ident or {}).get("verification_status") or app.get("verification_status"),
            "credential_status": app.get("credential_status"),
            "professional_evidence_status": app.get("professional_evidence_status"),
            "exception_codes": exc,
            "reason": app.get("council_review_reason") or (asm or {}).get("decision_reason"),
            "evidence_summary": await _build_evidence_matrix(aid),  # Council sees the full matrix
            "automated_assessment": (_strip(asm) if asm else None),
            "rule_version": (asm or {}).get("rule_version") or RULE_VERSION,
            "council_recognition_required": (asm or {}).get("council_recognition_required", False),
            "updated_at": app.get("updated_at"),
        })
    return {"queue": items, "count": len(items)}


# ── Council actions ───────────────────────────────────────────────────────────
_COUNCIL_ACTIONS = {"APPROVE", "REQUEST_INFORMATION", "REJECT", "ESCALATE",
                    "RECOGNISE_AS_YOGA_GURU", "REQUEST_FURTHER_REVIEW"}


class CouncilActionIn(BaseModel):
    action: str
    note: Optional[str] = None                      # internal council note (not shown to teacher)
    exception_code: Optional[str] = None
    requested_information: Optional[List[Any]] = None  # for REQUEST_INFORMATION
    decision_detail: Optional[str] = None


@router.post("/application/{application_id}/council/action")
async def council_action(application_id: str, body: CouncilActionIn, user: dict = Depends(council_user)):
    await _ensure_indexes()
    app = await applications.find_one({"application_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="application not found")
    action = (body.action or "").strip().upper()
    if action not in _COUNCIL_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action. Allowed: {sorted(_COUNCIL_ACTIONS)}")
    is_l3 = app.get("teacher_level") == LEVEL_GURU
    if action in {"RECOGNISE_AS_YOGA_GURU", "REQUEST_FURTHER_REVIEW"} and not is_l3:
        raise HTTPException(status_code=400, detail="Guru recognition actions apply to Level 3 only.")

    now = _now()
    tid = str(app["teacher_id"])
    update = {"updated_at": now}
    decision = None
    audit_event = "COUNCIL_REVIEW_REQUESTED"

    if action in {"APPROVE", "RECOGNISE_AS_YOGA_GURU"}:
        # Policy V2: empanelment needs a recorded Council interaction + an explicit
        # decision in the empanelment-policy queue first; this only mirrors it.
        import empanelment_policy  # local import avoids a circular import at load
        if not await empanelment_policy.has_approved_case(teacher_user_id=tid):
            raise HTTPException(status_code=409, detail="empanelment_policy_decision_required")
        decision = "EMPANELLED"
        update.update({"empanelment_status": "EMPANELLED", "verification_status": "VERIFIED",
                       "council_review_required": False, "council_recognition": (action == "RECOGNISE_AS_YOGA_GURU"),
                       "completed_at": now, "information_requested": None})
        audit_event = "COUNCIL_APPROVED"
    elif action == "REJECT":
        decision = "NOT_EMPANELLED"
        update.update({"empanelment_status": "NOT_EMPANELLED", "verification_status": "NOT_VERIFIED",
                       "completed_at": now})
        audit_event = "COUNCIL_REJECTED"
    elif action == "REQUEST_INFORMATION":
        decision = "ADDITIONAL_INFORMATION_REQUIRED"
        update.update({"empanelment_status": "ADDITIONAL_INFORMATION_REQUIRED",
                       "information_requested": body.requested_information or []})
        audit_event = "ADDITIONAL_INFORMATION_REQUESTED"
    else:  # ESCALATE / REQUEST_FURTHER_REVIEW
        decision = "COUNCIL_REVIEW"
        update.update({"empanelment_status": "COUNCIL_REVIEW", "council_review_required": True})
        if body.exception_code:
            update["council_review_reason"] = body.exception_code
        audit_event = "COUNCIL_REVIEW_REQUESTED"

    await applications.update_one({"application_id": application_id}, {"$set": update})
    if decision == "EMPANELLED":
        await _grant_entitlement({**app, **update})
    rec = await _council_decision_record(app, user, action, decision, body.note, body.exception_code, body.requested_information)
    await _audit(application_id, tid, audit_event, str(user["user_id"]),
                 {"action": action, "decision": decision, "exception_code": body.exception_code})
    return {"ok": True, "decision": decision, "council_decision_id": rec["decision_id"]}


@router.get("/application/{application_id}/council/decisions")
async def list_council_decisions(application_id: str, user: dict = Depends(council_user)):
    await _ensure_indexes()
    docs = await council_decisions.find({"application_id": application_id}).sort("created_at", 1).to_list(100)
    return {"council_decisions": [_strip(d) for d in docs]}


# ── Information request (teacher-facing, no restart) ──────────────────────────
@router.get("/application/{application_id}/information-request")
async def get_information_request(application_id: str, user: dict = Depends(current_user)):
    """What the Council has asked the teacher to provide. No restart required —
    the teacher simply adds the listed items via the normal submit endpoints."""
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    return {
        "status": app.get("empanelment_status"),
        "information_requested": app.get("information_requested") or [],
    }


# ── Appeals ───────────────────────────────────────────────────────────────────
class AppealIn(BaseModel):
    reason: str
    evidence: Optional[str] = None
    documents: Optional[List[Any]] = None


@router.post("/application/{application_id}/appeal")
async def submit_appeal(application_id: str, body: AppealIn, user: dict = Depends(current_user)):
    """A teacher may appeal an adverse empanelment decision (NOT_EMPANELLED).
    Does not delete the application or its history."""
    await _ensure_indexes()
    app = await _load_app(application_id, user)
    if app.get("empanelment_status") not in {"NOT_EMPANELLED"}:
        raise HTTPException(status_code=400, detail="Appeals apply only to a NOT_EMPANELLED decision.")
    if not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="An appeal reason is required.")
    rec = {
        "appeal_id": _oid(),
        "application_id": application_id,
        "teacher_id": str(app["teacher_id"]),
        "reason": body.reason.strip(),
        "evidence": body.evidence,
        "documents": body.documents or [],
        "status": "PENDING",
        "council_decision": None,
        "council_note": None,
        "reviewer": None,
        "created_at": _now(),
        "decided_at": None,
    }
    await appeals.insert_one(rec)
    await applications.update_one({"application_id": application_id},
                                  {"$set": {"empanelment_status": "APPEAL_PENDING", "council_review_required": True,
                                            "updated_at": _now()}})
    await _audit(application_id, str(app["teacher_id"]), "APPEAL_SUBMITTED", str(user["user_id"]),
                 {"appeal_id": rec["appeal_id"]})
    return {"ok": True, "appeal": {k: v for k, v in rec.items() if k not in {"_id", "council_note"}}}


@router.get("/application/{application_id}/appeals")
async def my_appeals(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    priv = _is_privileged(user)
    docs = await appeals.find({"application_id": application_id}).sort("created_at", 1).to_list(50)
    drop = {"_id"} if priv else {"_id", "council_note"}
    return {"appeals": [{k: v for k, v in d.items() if k not in drop} for d in docs]}


@router.get("/council/appeals")
async def council_appeals(user: dict = Depends(council_user), status: Optional[str] = Query(None)):
    await _ensure_indexes()
    q = {}
    if status:
        q["status"] = status.upper()
    docs = await appeals.find(q).sort("created_at", -1).to_list(200)
    return {"appeals": [_strip(d) for d in docs]}


class AppealDecisionIn(BaseModel):
    decision: str            # UPHELD | DENIED
    note: Optional[str] = None


@router.post("/council/appeal/{appeal_id}/decide")
async def decide_appeal(appeal_id: str, body: AppealDecisionIn, user: dict = Depends(council_user)):
    await _ensure_indexes()
    ap = await appeals.find_one({"appeal_id": appeal_id})
    if not ap:
        raise HTTPException(status_code=404, detail="appeal not found")
    dec = (body.decision or "").strip().upper()
    if dec not in {"UPHELD", "DENIED"}:
        raise HTTPException(status_code=400, detail="decision must be UPHELD or DENIED.")
    now = _now()
    await appeals.update_one({"appeal_id": appeal_id}, {"$set": {
        "status": "DECIDED", "council_decision": dec, "council_note": body.note,
        "reviewer": str(user["user_id"]), "decided_at": now,
    }})
    app = await applications.find_one({"application_id": ap["application_id"]})
    if app:
        if dec == "UPHELD":
            # Re-open for Council review (does not auto-empanel).
            await applications.update_one({"application_id": app["application_id"]},
                                          {"$set": {"empanelment_status": "COUNCIL_REVIEW", "council_review_required": True,
                                                    "verification_status": "EMPANELMENT_ASSESSMENT", "updated_at": now}})
            await _audit(app["application_id"], str(app["teacher_id"]), "COUNCIL_APPROVED", str(user["user_id"]),
                         {"appeal_id": appeal_id, "appeal_decision": dec})
        else:
            await applications.update_one({"application_id": app["application_id"]},
                                          {"$set": {"empanelment_status": "NOT_EMPANELLED", "updated_at": now}})
            await _audit(app["application_id"], str(app["teacher_id"]), "COUNCIL_REJECTED", str(user["user_id"]),
                         {"appeal_id": appeal_id, "appeal_decision": dec})
    await _council_decision_record(app or {"application_id": ap["application_id"], "teacher_id": ap["teacher_id"], "teacher_level": None},
                                   user, "APPEAL_DECISION", dec, body.note, "EX-10", None)
    return {"ok": True, "decision": dec}


# ── Audit (filterable) + periodic sampling ────────────────────────────────────
@router.get("/council/audit")
async def council_audit(
    user: dict = Depends(council_user),
    country: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    exception: Optional[str] = Query(None),
    reviewer: Optional[str] = Query(None),
    qualification: Optional[str] = Query(None),
    rule_version: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
):
    """Filterable decision audit across automated assessments + council rulings."""
    await _ensure_indexes()
    aq = {}
    if rule_version:
        aq["rule_version"] = rule_version
    if decision:
        aq["decision"] = decision.upper()
    if date_from:
        aq.setdefault("assessed_at", {})["$gte"] = date_from
    if date_to:
        aq.setdefault("assessed_at", {})["$lte"] = date_to
    rows = await assessments.find(aq).sort("assessed_at", -1).to_list(2000)

    # Join application fields for country/level/qualification filters.
    out = []
    app_cache: dict = {}
    for r in rows:
        aid = r["application_id"]
        app = app_cache.get(aid)
        if app is None:
            app = await applications.find_one({"application_id": aid}) or {}
            app_cache[aid] = app
        if country and (app.get("country") or "").lower() != country.lower():
            continue
        if level and app.get("teacher_level") != _norm_level(level):
            continue
        if exception and not any((e.get("type") == exception or e.get("reason") == exception)
                                 for e in (r.get("exceptions") or [])):
            continue
        if qualification:
            quals = [c.get("qualification_name") for c in (r.get("evidence_used", {}).get("credentials") or [])]
            if not any(qualification.lower() in (q or "").lower() for q in quals):
                continue
        out.append({
            "assessment_id": r.get("assessment_id"), "application_id": aid,
            "teacher_id": r.get("teacher_id"), "country": app.get("country"),
            "teacher_level": r.get("teacher_level"), "decision": r.get("decision"),
            "decision_reason": r.get("decision_reason"), "rule_version": r.get("rule_version"),
            "mode": r.get("mode"), "exceptions": r.get("exceptions"),
            "assessed_at": r.get("assessed_at"), "assessed_by": r.get("assessed_by"),
        })
        if len(out) >= limit:
            break

    # Council rulings (reviewer filter applies here).
    cq = {}
    if reviewer:
        cq["reviewer"] = reviewer
    if date_from:
        cq.setdefault("created_at", {})["$gte"] = date_from
    if date_to:
        cq.setdefault("created_at", {})["$lte"] = date_to
    crows = await council_decisions.find(cq).sort("created_at", -1).to_list(limit)
    rulings = [_strip(c) for c in crows]
    if reviewer:
        out = [o for o in out if o.get("assessed_by") == reviewer]
    return {"assessments": out, "council_decisions": rulings, "count": len(out)}


@router.get("/council/audit/sample")
async def council_audit_sample(user: dict = Depends(council_user), limit: int = Query(20, le=200)):
    """Periodic audit: sample AUTOMATICALLY empanelled teachers. This NEVER
    revokes empanelment — the Council must explicitly act (REJECT) if warranted."""
    await _ensure_indexes()
    # Auto-empanelled = decision EMPANELLED with NO council override on that app.
    auto = await assessments.find({"decision": "EMPANELLED"}).sort("assessed_at", -1).to_list(1000)
    overridden = set()
    for c in await council_decisions.find({}).to_list(2000):
        overridden.add(c["application_id"])
    seen = set()
    sample = []
    for r in auto:
        aid = r["application_id"]
        if aid in seen or aid in overridden:
            continue
        seen.add(aid)
        app = await applications.find_one({"application_id": aid}) or {}
        if app.get("empanelment_status") != "EMPANELLED":
            continue
        sample.append({
            "application_id": aid, "teacher_id": r.get("teacher_id"),
            "country": app.get("country"), "teacher_level": r.get("teacher_level"),
            "rule_version": r.get("rule_version"), "decision": r.get("decision"),
            "assessed_at": r.get("assessed_at"),
        })
        if len(sample) >= limit:
            break
    return {"sample": sample, "count": len(sample),
            "note": "Sampling is non-destructive. Empanelment is only changed by an explicit Council action."}


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT 6 — PAYMENT, DASHBOARD, CTA CONSOLIDATION & FINAL QA
#
# The unified teacher product: ONE application · ONE payment · ONE journey · ONE
# outcome · ONE entitlement. Gated behind a feature flag so the existing CTAs and
# records stay fully intact until cutover. Prices are configurable (never hard-
# coded). Payment is confirmed server-side (webhook → verify → DB → workflow).
# ══════════════════════════════════════════════════════════════════════════════
FLAG_FALSE = "FALSE"
FLAG_TEST_ONLY = "TEST_ONLY"
FLAG_TRUE = "TRUE"
_VALID_FLAGS = {FLAG_FALSE, FLAG_TEST_ONLY, FLAG_TRUE}

DEFAULT_PLATFORM_CONFIG = {
    "config_id": "platform",
    # Feature flag — starts conservative; cutover flips this to TRUE.
    "unified_flag": FLAG_TEST_ONLY,
    # Existing VERIFIED/EMPANELLED teachers are grandfathered (never force-migrated).
    "migration_policy": "grandfather",
    # Configurable pricing (NOT hard-coded). amount is the headline price.
    "pricing": {
        "INDIA": {"LEVEL_2": {"amount": 2499, "currency": "INR", "tax_note": "+ applicable taxes"}},
        "INTERNATIONAL": {"LEVEL_2": {"amount": 99, "currency": "USD", "tax_note": "US$99 equivalent"}},
    },
}


async def _get_platform_config() -> dict:
    stored = await platform_config.find_one({"config_id": "platform"})
    cfg = json.loads(json.dumps(DEFAULT_PLATFORM_CONFIG))  # deep copy
    if stored:
        for k, v in stored.items():
            if k == "_id":
                continue
            cfg[k] = v
    return cfg


# B4.8 — the combined ₹2,499 + tax / US$99 offer is PAUSED until its scope and
# pricing are formally approved: no new purchase, no CTA, no displayed price,
# whatever the stored feature flag says. Already-paid applications are untouched.
UNIFIED_OFFER_PURCHASABLE = False
UNIFIED_OFFER_PAUSED_DETAIL = ("The combined verification + empanelment offer is paused until its scope and "
                               "pricing are approved. No payment can be taken for it.")


def _price_for(cfg: dict, route: str, level: Optional[str]) -> dict:
    if not UNIFIED_OFFER_PURCHASABLE:
        return {}
    lvl = level or LEVEL_PRACHARAK
    key = "INDIA" if route == ROUTE_INDIA else "INTERNATIONAL"
    table = (cfg.get("pricing") or {}).get(key, {})
    return table.get(lvl) or table.get(LEVEL_PRACHARAK) or {}


async def _grant_entitlement(app: dict) -> dict:
    """ONE entitlement package per application. Idempotent — duplicate badge /
    entitlement are impossible (unique application_id)."""
    aid = app["application_id"]
    existing = await entitlements.find_one({"application_id": aid})
    if existing:
        return _strip(existing)
    now = _now()
    doc = {
        "entitlement_id": _oid(),
        "application_id": aid,
        "teacher_id": str(app.get("teacher_id")),
        "package": "NOSTOPS_EMPANELLED",
        "badges": ["NOSTOPS_VERIFIED", "NOSTOPS_EMPANELLED"],
        "teacher_level": app.get("teacher_level"),
        "rule_version": RULE_VERSION,
        "granted_at": now,
    }
    try:
        await entitlements.insert_one(doc)
    except DuplicateKeyError:
        return _strip(await entitlements.find_one({"application_id": aid}))
    return _strip(doc)


# ── Platform config (pricing / flag / migration) ──────────────────────────────
@router.get("/platform/config")
async def get_platform_config(_: dict = Depends(current_user)):
    """Non-secret: pricing, feature flag, migration policy. Safe for the BFF."""
    cfg = await _get_platform_config()
    return {"config": {k: v for k, v in cfg.items() if k != "_id"}}


class PlatformConfigIn(BaseModel):
    unified_flag: Optional[str] = None
    migration_policy: Optional[str] = None
    pricing: Optional[dict] = None


@router.put("/platform/config")
async def set_platform_config(body: PlatformConfigIn, user: dict = Depends(admin_user)):
    await _ensure_indexes()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "unified_flag" in updates and updates["unified_flag"] not in _VALID_FLAGS:
        raise HTTPException(status_code=400, detail=f"unified_flag must be one of {sorted(_VALID_FLAGS)}")
    updates["config_id"] = "platform"
    updates["updated_at"] = _now()
    updates["updated_by"] = str(user["user_id"])
    await platform_config.update_one({"config_id": "platform"}, {"$set": updates}, upsert=True)
    cfg = await _get_platform_config()
    return {"ok": True, "config": {k: v for k, v in cfg.items() if k != "_id"}}


@router.get("/pricing")
async def get_pricing(country: Optional[str] = Query(None), level: Optional[str] = Query(None),
                      _: dict = Depends(current_user)):
    cfg = await _get_platform_config()
    route = _route_for(country)
    if not UNIFIED_OFFER_PURCHASABLE:
        return {"route": route, "price": {}, "pricing": None, "purchasable": False, "detail": UNIFIED_OFFER_PAUSED_DETAIL}
    return {"route": route, "price": _price_for(cfg, route, _norm_level(level)), "pricing": cfg.get("pricing"),
            "purchasable": True}


# ── Unified payment — ONE payment creates ONE application/journey ─────────────
class PaymentConfirmIn(BaseModel):
    payment_reference: str
    payment_amount: Optional[float] = None
    payment_currency: Optional[str] = None
    teacher_id: Optional[str] = None
    teacher_handle: Optional[str] = None
    country: Optional[str] = None
    nationality: Optional[str] = None
    teacher_level: Optional[str] = None
    instakyc_verified: Optional[bool] = None


@router.post("/payment/confirm")
async def confirm_payment(body: PaymentConfirmIn, user: dict = Depends(current_user)):
    """Server-side confirmation of a SUCCESSFUL payment for the unified product.
    Called by the BFF only AFTER verifying the payment with the existing gateway
    (webhook → verify). Browser redirect is never authoritative. Idempotent on
    payment_reference — a duplicate webhook/payment is a safe no-op (§16)."""
    await _ensure_indexes()
    ref = (body.payment_reference or "").strip()
    if not ref:
        raise HTTPException(status_code=400, detail="payment_reference is required.")
    # TVR-14: the payment always belongs to the AUTHENTICATED teacher. Only an
    # admin may record a confirmation on behalf of another teacher.
    teacher_id = str(user["user_id"])
    if body.teacher_id and str(body.teacher_id) != teacher_id:
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="You can only confirm your own payment.")
        teacher_id = str(body.teacher_id)

    existing_pay = await payments.find_one({"payment_reference": ref})
    if existing_pay:
        app = await applications.find_one({"application_id": existing_pay["application_id"]})
        return {"ok": True, "duplicate": True, "application": _public_app(app) if app else None}
    if not UNIFIED_OFFER_PURCHASABLE:
        raise HTTPException(status_code=409, detail=UNIFIED_OFFER_PAUSED_DETAIL)

    # ONE application per teacher (idempotent create — reuse the open one).
    app = await applications.find_one(
        {"teacher_id": teacher_id, "verification_status": {"$nin": list(_TERMINAL_VERIFICATION)}},
        sort=[("created_at", -1)],
    )
    if not app:
        route = _route_for(body.country)
        provider = _provider_for(route)
        level = _norm_level(body.teacher_level)
        council_required = level == LEVEL_GURU
        now = _now()
        app = {
            "application_id": _oid(), "teacher_id": teacher_id,
            "teacher_handle": body.teacher_handle or user.get("teacher_handle"),
            "teacher_level": level, "country": body.country, "nationality": body.nationality,
            "verification_route": route, "verification_provider": provider,
            "verification_status": "NOT_STARTED", "credential_status": "NOT_STARTED",
            "professional_evidence_status": "NOT_STARTED", "empanelment_status": "NOT_STARTED",
            "council_review_required": council_required,
            "council_review_reason": ("LEVEL_3_GURU_REQUIRES_COUNCIL" if council_required else None),
            "payment_status": "NOT_STARTED", "payment_reference": None, "payment_amount": None, "payment_currency": None,
            "existing_instakyc_reused": bool(body.instakyc_verified) if route == ROUTE_INDIA else False,
            "rule_version": RULE_VERSION, "unified_product": True,
            "created_at": now, "updated_at": now, "completed_at": None,
        }
        await applications.insert_one(app)
        await _audit(app["application_id"], teacher_id, "APPLICATION_CREATED", teacher_id,
                     {"route": route, "provider": provider, "level": level, "unified": True})

    aid = app["application_id"]
    # Dedupe guard: unique payment_reference prevents duplicate payment rows.
    try:
        await payments.insert_one({
            "payment_id": _oid(), "payment_reference": ref, "application_id": aid, "teacher_id": teacher_id,
            "amount": body.payment_amount, "currency": body.payment_currency,
            "product": "UNIFIED_VERIFICATION_EMPANELMENT", "created_at": _now(),
        })
    except DuplicateKeyError:
        app = await applications.find_one({"application_id": aid})
        return {"ok": True, "duplicate": True, "application": _public_app(app)}

    if app.get("payment_status") != "PAYMENT_SUCCESS":
        await applications.update_one({"application_id": aid}, {"$set": {
            "payment_status": "PAYMENT_SUCCESS", "verification_status": "PAYMENT_SUCCESS",
            "payment_reference": ref, "payment_amount": body.payment_amount,
            "payment_currency": body.payment_currency, "updated_at": _now(),
        }})
        await _audit(aid, teacher_id, "PAYMENT_SUCCESS", str(user["user_id"]),
                     {"reference": ref, "amount": body.payment_amount, "currency": body.payment_currency, "unified": True})
    await _record_cost(aid, "payment_confirmed", "PAYMENT_SUCCESS",
                       {"amount": body.payment_amount, "currency": body.payment_currency})
    return {"ok": True, "application": _public_app(await applications.find_one({"application_id": aid}))}


@router.get("/application/{application_id}/entitlements")
async def get_entitlements(application_id: str, user: dict = Depends(current_user)):
    await _ensure_indexes()
    await _load_app(application_id, user)
    doc = await entitlements.find_one({"application_id": application_id})
    return {"entitlements": _strip(doc)}


# ── Unified journey (drives the dashboard 6-step progress + CTA) ──────────────
def _step(num, key, title, status, detail=None):
    return {"step": num, "key": key, "title": title, "status": status, "detail": detail}


def _journey_steps(app: Optional[dict], ident: Optional[dict], ev: Optional[dict], asm: Optional[dict]) -> list:
    app = app or {}
    ident = ident or {}
    ev = ev or {}
    vstat = app.get("verification_status")
    cstat = app.get("credential_status")
    pstat = app.get("professional_evidence_status")
    estat = app.get("empanelment_status")

    # 1 — Payment
    if app.get("payment_status") == "PAYMENT_SUCCESS":
        s1 = _step(1, "payment", "Payment", "DONE", "Payment received.")
    elif app:
        s1 = _step(1, "payment", "Payment", "IN_PROGRESS" if vstat == "PAYMENT_PENDING" else "PENDING")
    else:
        s1 = _step(1, "payment", "Payment", "PENDING")

    # 2 — Identity Verification (InstaKYC reuse or Didit)
    istat = ident.get("verification_status")
    if istat == "IDENTITY_VERIFIED":
        s2 = _step(2, "identity", "Identity Verification", "DONE", f"Verified via {ident.get('provider') or app.get('verification_provider')}.")
    elif istat == "IDENTITY_FAILED":
        s2 = _step(2, "identity", "Identity Verification", "BLOCKED", "Identity verification failed.")
    elif istat in {"VERIFICATION_PENDING", "IN_REVIEW"} or vstat == "VERIFICATION_PENDING":
        s2 = _step(2, "identity", "Identity Verification", "IN_PROGRESS")
    elif app.get("payment_status") == "PAYMENT_SUCCESS":
        s2 = _step(2, "identity", "Identity Verification", "PENDING")
    else:
        s2 = _step(2, "identity", "Identity Verification", "LOCKED")

    # 3 — Credential Verification
    cmap = {"CREDENTIALS_VERIFIED": ("DONE", "Credentials verified."),
            "CREDENTIAL_VERIFICATION": ("IN_PROGRESS", None),
            "ADDITIONAL_INFORMATION_REQUIRED": ("ACTION_REQUIRED", "More information needed."),
            "COUNCIL_REVIEW": ("IN_PROGRESS", "Under Council review.")}
    c = cmap.get(cstat, ("LOCKED" if istat != "IDENTITY_VERIFIED" else "PENDING", None))
    s3 = _step(3, "credential", "Credential Verification", c[0], c[1])

    # 4 — Professional Evidence
    s4 = _step(4, "evidence", "Professional Evidence",
               "DONE" if pstat == "SUBMITTED" else ("PENDING" if istat == "IDENTITY_VERIFIED" else "LOCKED"))

    # 5 — Empanelment Assessment
    emap = {"EMPANELLED": ("DONE", "Empanelled."), "NOT_EMPANELLED": ("DONE", "Not empanelled."),
            "COUNCIL_REVIEW": ("IN_PROGRESS", "Council review."), "APPEAL_PENDING": ("IN_PROGRESS", "Appeal under review."),
            "ADDITIONAL_INFORMATION_REQUIRED": ("ACTION_REQUIRED", "More information needed."),
            "ASSESSMENT_PENDING": ("IN_PROGRESS", None), "ELIGIBLE": ("IN_PROGRESS", None)}
    e = emap.get(estat, ("PENDING" if cstat == "CREDENTIALS_VERIFIED" else "LOCKED", None))
    s5 = _step(5, "empanelment", "Empanelment Assessment", e[0], e[1] or ((asm or {}).get("decision_reason")))

    # 6 — Final Status
    if estat == "EMPANELLED":
        s6 = _step(6, "final", "Final Status", "DONE", "NOSTOPS Verified + Empanelled.")
    elif estat == "NOT_EMPANELLED":
        s6 = _step(6, "final", "Final Status", "DONE", "Not empanelled — you may submit an appeal.")
    elif estat in {"COUNCIL_REVIEW", "APPEAL_PENDING"}:
        s6 = _step(6, "final", "Final Status", "IN_PROGRESS", "Awaiting Council.")
    else:
        s6 = _step(6, "final", "Final Status", "LOCKED")
    return [s1, s2, s3, s4, s5, s6]


class JourneyIn(BaseModel):
    # Remote-derived context supplied by the BFF (never trusted from the browser).
    kyc_verified: Optional[bool] = None
    is_empanelled: Optional[bool] = None
    profile_complete: Optional[bool] = None
    country: Optional[str] = None
    teacher_level: Optional[str] = None
    teacher_handle: Optional[str] = None


@router.post("/me/journey")
async def my_journey(body: JourneyIn, user: dict = Depends(current_user)):
    """One call that drives the unified dashboard: 6-step progress, badges and the
    CTA decision (feature-flag + migration-policy aware)."""
    await _ensure_indexes()
    teacher_id = str(user["user_id"])
    cfg = await _get_platform_config()
    flag = cfg.get("unified_flag", FLAG_TEST_ONLY)
    role = str(user.get("role") or "").lower()

    app = await applications.find_one({"teacher_id": teacher_id}, sort=[("created_at", -1)])
    ident = ev = asm = None
    entitlement = None
    if app:
        aid = app["application_id"]
        ident = await identity.find_one({"application_id": aid})
        ev = await evidence.find_one({"application_id": aid})
        asm = await _latest_assessment(aid)
        entitlement = await entitlements.find_one({"application_id": aid})

    # Badges — honour the migration policy: an EXISTING verified/empanelled
    # teacher (remote) is grandfathered and shows badges without being forced
    # through the new flow.
    grandfathered = bool(body.is_empanelled) and (cfg.get("migration_policy") == "grandfather")
    local_empanelled = bool(app and app.get("empanelment_status") == "EMPANELLED")
    local_verified = bool(app and app.get("verification_status") == "VERIFIED")
    # B4.8 — identity and empanelment stay SEPARATE: grandfathering an existing
    # empanelment never implies a passed identity check.
    badges = {
        "nostops_verified": local_verified or bool(body.kyc_verified),
        "nostops_empanelled": local_empanelled or grandfathered,
    }
    complete = badges["nostops_empanelled"] and badges["nostops_verified"]

    steps = _journey_steps(app, ident, ev, asm)
    route = (app or {}).get("verification_route") or _route_for(body.country)
    price = _price_for(cfg, route, _norm_level(body.teacher_level) or (app or {}).get("teacher_level"))

    # CTA decision: when complete → NO CTA (badges instead). Otherwise, the
    # unified CTA shows per the feature flag (TRUE = all teachers; TEST_ONLY =
    # privileged/preview only; FALSE = legacy CTAs, unified hidden).
    unified_enabled = (flag == FLAG_TRUE) and UNIFIED_OFFER_PURCHASABLE
    cta_available = UNIFIED_OFFER_PURCHASABLE and (unified_enabled or (flag == FLAG_TEST_ONLY and _is_privileged(user)))
    cta = {
        "show": bool(cta_available and not complete),
        "label": "GET VERIFIED + EMPANELLED",
        "route": "/app/teacher/get-verified",
        "flag": flag,
        "unified_enabled": unified_enabled,
        "test_only": flag == FLAG_TEST_ONLY,
    }
    return {
        "flag": flag,
        "unified_enabled": unified_enabled,
        "migration_policy": cfg.get("migration_policy"),
        "grandfathered": grandfathered,
        "complete": complete,
        "badges": badges,
        "cta": cta,
        "route": route,
        "price": price,
        "offer_purchasable": UNIFIED_OFFER_PURCHASABLE,
        "international_available": INTERNATIONAL_VERIFICATION_AVAILABLE,
        "offer_detail": None if UNIFIED_OFFER_PURCHASABLE else UNIFIED_OFFER_PAUSED_DETAIL,
        "application": _public_app(app) if app else None,
        "entitlements": _strip(entitlement),
        "steps": steps,
        "overall": {
            "verification_status": (app or {}).get("verification_status"),
            "empanelment_status": (app or {}).get("empanelment_status"),
            "provider": (app or {}).get("verification_provider"),
        },
    }


# ── Cost tracking (admin) ─────────────────────────────────────────────────────
@router.get("/cost/summary")
async def cost_summary(user: dict = Depends(admin_user), limit: int = Query(200, le=1000)):
    """Internal economics per application — NEVER exposed to teachers (§17)."""
    await _ensure_indexes()
    apps = await applications.find({}).sort("created_at", -1).to_list(limit)
    rows = []
    totals = {"payment_amount": 0.0, "verification_cost": 0.0, "gross_contribution": 0.0}
    for app in apps:
        aid = app["application_id"]
        costs = await provider_costs.find({"application_id": aid}).to_list(100)
        vcost = sum(float(c.get("estimated_cost") or 0) for c in costs)
        pay = await payments.find_one({"application_id": aid})
        pay_amt = float((pay or {}).get("amount") or app.get("payment_amount") or 0)
        asm = await _latest_assessment(aid)
        creds = await credentials.count_documents({"application_id": aid})
        council = await council_decisions.count_documents({"application_id": aid})
        gross = pay_amt - vcost
        rows.append({
            "application_id": aid, "teacher_id": str(app.get("teacher_id")),
            "country": app.get("country"), "route": app.get("verification_route"),
            "provider": app.get("verification_provider"),
            "verification_modules": [c.get("event") for c in costs],
            "verification_cost": vcost, "credential_count": creds,
            "payment_amount": pay_amt, "currency": app.get("payment_currency") or (pay or {}).get("currency"),
            "nostops_revenue": pay_amt, "estimated_gross_contribution": gross,
            "council_reviews": council, "final_outcome": app.get("empanelment_status"),
        })
        totals["payment_amount"] += pay_amt
        totals["verification_cost"] += vcost
        totals["gross_contribution"] += gross
    return {"rows": rows, "totals": totals, "count": len(rows)}

