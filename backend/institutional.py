"""
NOSTOPS Institutional Program Engine — ISOLATED local feature (local FastAPI +
local Mongo `nostops_web`, `inst_*` collections). Mounted BEFORE the catch-all
proxy in server.py so /api/institutional/* is served locally and is NEVER
forwarded to the frozen remote business backend, which stays authoritative and
untouched.

PROMPT 1 scope = FOUNDATION, ARCHITECTURE & DATA MODEL ONLY.

Safety guarantees (Prompt 1):
  • Purely additive. This module touches ONLY new `inst_*` collections.
  • It NEVER reads/writes/deletes any existing teacher, organisation (HR),
    booking, payment, InstaKYC, Empanelment, Council or Verification record —
    those live on the remote backend (or the verification_* engine) and remain
    authoritative and untouched.
  • No Event Creator UI is built here — only the data model, immutable-ID
    generator, governance constants and a minimal foundation API surface
    (health / meta / config + Organisation create-read) to prove the foundation.

Core product principle (Prompt 1 §1): NOSTOPS is a distributed, technology-
enabled institutional Yoga network with THREE entry points into ONE common
institutional programme engine:
    Companies · Educational Institutions · Startup & Networking Groups
The common architecture chain is:
    Council of Yoga Gurus → Council-Curated Programme → Programme Template →
    Organisation Programme → Group Configuration → Teacher Matching →
    Event / Session → Participant → Booking → Attendance → Feedback →
    Payout → Renewal

Security: same defense-in-depth as pulse.py / verification.py — every request
carries the shared secret `X-Pulse-Secret`; identity is injected server-side by
the Next.js BFF via `X-Pulse-User` (never trusted from the browser).

Anti-poaching (platform CORE ETHOS): participant / registration / attendance
records are always scoped to their owning organisation + event creator and are
NEVER cross-exposed to another teacher or organisation. Foundation models carry
no cross-teacher student rosters.
"""
import base64
import datetime as _dt
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import uuid
from zoneinfo import ZoneInfo
from typing import Any, List, Optional
from io import BytesIO
from urllib.parse import quote
from urllib.request import urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import pricing_engine

try:
    from email_util import send_email          # when run from /app/backend
    from receipt_pdf import build_receipt_pdf, format_money_pdf
except ImportError:  # pragma: no cover
    from backend.email_util import send_email  # when imported as a package
    from backend.receipt_pdf import build_receipt_pdf, format_money_pdf

load_dotenv()
logger = logging.getLogger("institutional")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

ENGINE_VERSION = "INSTITUTIONAL_ENGINE_V1.0"

# ── Feature flag (Prompt 1 §15 safe-migration) ────────────────────────────────
# Tri-state, mirroring the verification engine: FALSE | TEST_ONLY | TRUE.
#   FALSE     → engine dormant; writes rejected (reads/meta still answer).
#   TEST_ONLY → engine writable for staff/QA only (gated in later prompts).
#   TRUE      → engine active.
# Default TRUE: the engine is purely additive and has no public UI in Prompt 1.
def flag() -> str:
    v = (os.environ.get("INSTITUTIONAL_ENGINE_ENABLED", "TRUE") or "").strip().upper()
    return v if v in {"FALSE", "TEST_ONLY", "TRUE"} else "TRUE"


def engine_active() -> bool:
    return flag() != "FALSE"


# ══════════════════════════════════════════════════════════════════════════════
# STRICT GOVERNANCE CONSTANTS (Prompt 1)
# ══════════════════════════════════════════════════════════════════════════════

# §1 — the THREE institutional cohort entry points into ONE engine.
COHORT_COMPANY = "COMPANY"
COHORT_EDUCATIONAL = "EDUCATIONAL_INSTITUTION"
COHORT_STARTUP = "STARTUP_NETWORK"
COHORT_TYPES = {COHORT_COMPANY, COHORT_EDUCATIONAL, COHORT_STARTUP}
COHORT_LABELS = {
    COHORT_COMPANY: "Company",
    COHORT_EDUCATIONAL: "Educational Institution",
    COHORT_STARTUP: "Startup & Networking Group",
}

# §2 — PRIMARY TAXONOMY — STRICT. Exactly these three terms everywhere.
# NEVER use "Specific Needs". The canonical term is "Special Needs".
TAX_MIND = "MIND"
TAX_BODY = "BODY"
TAX_SPECIAL_NEEDS = "SPECIAL_NEEDS"
TAXONOMY = {TAX_MIND, TAX_BODY, TAX_SPECIAL_NEEDS}
TAXONOMY_LABELS = {TAX_MIND: "Mind", TAX_BODY: "Body", TAX_SPECIAL_NEEDS: "Special Needs"}
TAXONOMY_SLUGS = {TAX_MIND: "mind", TAX_BODY: "body", TAX_SPECIAL_NEEDS: "special-needs"}

# §3 — COURSE / PROGRAMME / EVENT / SESSION conceptual distinction (documented;
# enforced by which collection owns which fields — see the data model below).
ASSET_LAYERS = {
    "COURSE": "Knowledge/curriculum asset originating from a Guru or knowledge creator.",
    "PROGRAMME": "Council-curated institutional application of that knowledge.",
    "EVENT": "A specific organisation-created occurrence of a programme.",
    "SESSION": "An actual teacher-delivered session within an event engagement.",
}

# §5 — EVENT LIFECYCLE (ordered).
EVENT_LIFECYCLE = ["DRAFT", "PUBLISHED", "LIVE", "COMPLETED", "ARCHIVED", "EVERGREEN"]
EVENT_LIFECYCLE_SET = set(EVENT_LIFECYCLE)
# Completed PUBLIC events remain available as historical web assets for ≥ this
# many days before an archive/evergreen decision.
PUBLIC_RETENTION_DAYS = 90

# §6 — EVENT VISIBILITY (modeled as the EventVisibility enum stored on Event).
VIS_PRIVATE = "PRIVATE"
VIS_UNLISTED = "UNLISTED"
VIS_PUBLIC = "PUBLIC"
EVENT_VISIBILITY = {VIS_PRIVATE, VIS_UNLISTED, VIS_PUBLIC}
# Only PUBLIC events are discoverable + eligible for SEO indexing + sitemaps.
PUBLICLY_INDEXABLE_VISIBILITY = {VIS_PUBLIC}

# §6b — VENUE MODEL (Prompt 3 §6). An event uses EITHER the organisation's own /
# community space — a "Community Space Contribution" with no external venue cost —
# OR an external venue whose cost is surfaced in the dynamic programme economics.
# External venues are NOT assumed to be required.
VENUE_EXISTING = "EXISTING_SPACE"
VENUE_EXTERNAL = "EXTERNAL_VENUE"
VENUE_TYPES = {VENUE_EXISTING, VENUE_EXTERNAL}
# Default event timezone (launch footprint is India). Stored per event; UI may override.
DEFAULT_TIMEZONE = "Asia/Kolkata"
SUPPORTED_TIMEZONES = [
    "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Hong_Kong",
    "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles",
]

# ══════════════════════════════════════════════════════════════════════════════
# §8 PARTICIPANT ENGINE constants
# ══════════════════════════════════════════════════════════════════════════════
# Registration Access is SEPARATE from Event Visibility (a public event can still
# restrict who may register).
REG_OPEN = "OPEN"
REG_ORG_ONLY = "ORGANISATION_ONLY"
REG_INVITE_ONLY = "INVITE_ONLY"
REG_CLOSED = "CLOSED"
REGISTRATION_ACCESS = {REG_OPEN, REG_ORG_ONLY, REG_INVITE_ONLY, REG_CLOSED}
REGISTRATION_ACCESS_LABELS = {
    REG_OPEN: "Open Registration", REG_ORG_ONLY: "Organisation Only",
    REG_INVITE_ONLY: "Invite Only", REG_CLOSED: "Closed",
}
PARTICIPANT_TYPES = {"EMPLOYEE", "STUDENT", "MEMBER", "OTHER"}
PRICING_FREE = "FREE"
PRICING_PAID = "PAID"
PRICING_TYPES = {PRICING_FREE, PRICING_PAID}
# Booking + payment status (immutable registration record).
BOOKING_CONFIRMED = "CONFIRMED"
BOOKING_PENDING_PAYMENT = "PENDING_PAYMENT"
BOOKING_CANCELLED = "CANCELLED"
BOOKING_WAITLISTED = "WAITLISTED"
PAY_NOT_REQUIRED = "NOT_REQUIRED"
PAY_PENDING = "PENDING"
PAY_PAID = "PAID"
PAY_FAILED = "FAILED"
PAY_REFUNDED = "REFUNDED"
# B2.2 — programme schedule. SINGLE = one session on the event date. RECURRING =
# 1 or 2 sessions a week on chosen weekdays, from the event date to an end date
# the organiser picks. Every date is an inst_event_sessions row, ONE teacher is
# matched for the whole programme, and participants register per session.
SCHEDULE_SINGLE = "SINGLE"
SCHEDULE_RECURRING = "RECURRING"
MAX_SCHEDULE_DAYS = 366
WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MAGIC_TTL_SECONDS = 20 * 60              # magic-link validity
PARTICIPANT_SESSION_TTL = 30 * 24 * 3600  # participant session token validity
SITE_FALLBACK = "https://www.nostops.org"
# Canonical public app origin used to build participant magic links. The link
# must point at our OWN Next.js app (never the API host). Overridable via env.
SITE_URL = (os.environ.get("INSTITUTIONAL_SITE_URL")
            or os.environ.get("NEXT_PUBLIC_SITE_URL")
            or SITE_FALLBACK).rstrip("/")
# Server-only pepper mixed into magic-link / session token hashes so a DB-only
# compromise cannot verify guessed tokens offline (falls back to the shared
# secret which is already server-only).
TOKEN_PEPPER = os.environ.get("PARTICIPANT_TOKEN_PEPPER") or SECRET or "nostops-participant"
# QA ONLY: when TRUE the auth/request response also returns the raw magic token
# so automated E2E can complete the flow without reading a mailbox. MUST be
# FALSE in production (the email is the only channel). Default FALSE.
def magic_debug() -> bool:
    return (os.environ.get("PARTICIPANT_MAGIC_DEBUG", "FALSE") or "").strip().upper() == "TRUE"
# §16 — shared secret the Emergent webhook-cron presents as `Authorization:
# Bearer <WEBHOOK_CRON_SECRET>` when triggering scheduled jobs. Set in prod .env.
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET") or ""
# Co-branded certificate (§ completion certificates) — local NOSTOPS logo asset.
NOSTOPS_LOGO_PATH = os.environ.get("NOSTOPS_LOGO_PATH") or "/app/frontend/public/brand/nostops-logo.png"
# §16 human-escalation inbox (exceptions/complaints/teacher/venue/quality).
NOSTOPS_SUPPORT_EMAIL = os.environ.get("NOSTOPS_SUPPORT_EMAIL") or "care@nostops.org"

# §7 — ORGANISATION TRUST MODEL.
ORG_TRUST_UNVERIFIED = "UNVERIFIED"
ORG_TRUST_PENDING = "VERIFICATION_PENDING"
ORG_TRUST_VERIFIED = "VERIFIED"
ORG_TRUST_EXCEPTION = "EXCEPTION_MANUAL_REVIEW"
ORG_TRUST_STATES = {
    ORG_TRUST_UNVERIFIED, ORG_TRUST_PENDING, ORG_TRUST_VERIFIED, ORG_TRUST_EXCEPTION,
}

# §4 + §10 — EventCreatorRole enum (stored on OrganisationMember, NOT a separate
# collection — it is intrinsically an attribute of a membership).
ECR_HR = "HR"
ECR_FACULTY = "FACULTY"
ECR_STUDENT_COORDINATOR = "STUDENT_COORDINATOR"
ECR_FOUNDER = "FOUNDER"
ECR_COMMUNITY_MANAGER = "COMMUNITY_MANAGER"
ECR_WELLNESS_CHAMPION = "WELLNESS_CHAMPION"
ECR_PROGRAMME_CHAMPION = "NOSTOPS_PROGRAMME_CHAMPION"  # owns the continuing relationship
EVENT_CREATOR_ROLES = {
    ECR_HR, ECR_FACULTY, ECR_STUDENT_COORDINATOR, ECR_FOUNDER,
    ECR_COMMUNITY_MANAGER, ECR_WELLNESS_CHAMPION, ECR_PROGRAMME_CHAMPION,
}

# Organisation membership roles (authorisation inside an org).
MEMBER_OWNER = "OWNER"
MEMBER_ADMIN = "ADMIN"
MEMBER_CREATOR = "EVENT_CREATOR"
MEMBER_VIEWER = "VIEWER"
MEMBER_ROLES = {MEMBER_OWNER, MEMBER_ADMIN, MEMBER_CREATOR, MEMBER_VIEWER}

# §10 — operational personas (6) + non-login public persona (1).
PERSONAS = [
    "EVENT_CREATOR", "PARTICIPANT", "TEACHER",
    "CITY_COORDINATOR", "COUNCIL_GURU", "NOSTOPS_ADMIN",
]
PUBLIC_PERSONA = "PUBLIC_VISITOR"

# §12 — NINE launch cities. City is a DATA DIMENSION (never per-city systems).
LAUNCH_CITIES = [
    {"name": "Mumbai", "slug": "mumbai"},
    {"name": "Navi Mumbai", "slug": "navi-mumbai"},
    {"name": "Pune", "slug": "pune"},
    {"name": "Nashik", "slug": "nashik"},
    {"name": "Delhi", "slug": "delhi"},
    {"name": "Gurgaon", "slug": "gurgaon"},
    {"name": "Bangalore", "slug": "bangalore"},
    {"name": "Chandigarh", "slug": "chandigarh"},
    {"name": "Hyderabad", "slug": "hyderabad"},
]
LAUNCH_CITY_SLUGS = {c["slug"] for c in LAUNCH_CITIES}

# Council programme curation lifecycle.
PROGRAMME_STATUSES = {"DRAFT", "APPROVED", "PUBLISHED", "DEPRECATED"}

# Sub-record statuses (lightweight; detailed flows arrive in later prompts).
REGISTRATION_STATUSES = {
    "PENDING", "CONFIRMED", "WAITLISTED", "CANCELLED", "ATTENDED", "NO_SHOW",
}
PARTICIPANT_STATUSES = {"ACTIVE", "INACTIVE", "BLOCKED"}
ATTENDANCE_STATUSES = {"PRESENT", "ABSENT", "PARTIAL", "EXCUSED"}
TEACHER_ASSIGNMENT_STATUSES = {
    "RECOMMENDED", "PROPOSED", "ACCEPTED", "DECLINED", "CONFIRMED", "REASSIGNED",
}
# Assignment statuses that occupy an event's teacher slot / are visible to the teacher.
ACTIVE_ASSIGNMENT_STATUSES = ["PROPOSED", "ASSIGNED", "ACCEPTED", "CONFIRMED"]
# §4 — default teacher offer response window (configurable via platform_config singleton).
DEFAULT_TEACHER_RESPONSE_WINDOW_HOURS = 48
TEACHER_RECOMMENDATION_STATUSES = {"SUGGESTED", "SHORTLISTED", "REJECTED", "CONVERTED"}
CITY_COORDINATOR_ASSIGNMENT_STATUSES = {"ACTIVE", "PAUSED", "ENDED"}
SETTLEMENT_STATUSES = {"PENDING", "CALCULATED", "APPROVED", "PAID", "DISPUTED"}
RENEWAL_STATUSES = {"NOT_DUE", "DUE", "OFFERED", "RENEWED", "LAPSED"}

# ── Immutable internal-ID prefixes (Prompt 1 §14). Format:
#    NOSTOPS-<PREFIX>-<YEAR>-<6-digit zero-padded sequence>
#    e.g. NOSTOPS-PGM-2026-000184, NOSTOPS-EVT-2026-000291
ID_PREFIXES = {
    "Organisation": "ORG",
    "OrganisationMember": "MBR",
    "CouncilProgramme": "PGM",
    "ProgrammeVersion": "PGV",
    "OrganisationProgramme": "OPG",
    "Event": "EVT",
    "EventSession": "SES",
    "Participant": "PTP",
    "Registration": "REG",
    "Attendance": "ATT",
    "Feedback": "FBK",
    "TeacherAssignment": "TAS",
    "TeacherRecommendation": "TRC",
    "TeacherFeedback": "TFB",
    "CityCoordinatorAssignment": "CCA",
    "ProgrammeIPMetadata": "IPM",
    "PricingCalculation": "PRC",
    "RevenueAllocation": "RVA",
    "Settlement": "STL",
    "Renewal": "RNW",
    "EventSEO": "SEO",
    "Escalation": "ESC",
}

# ══════════════════════════════════════════════════════════════════════════════
# DATA MODEL — collections (Prompt 1 §14). 21 standalone collections.
# EventCreatorRole + EventVisibility are modeled as ENUMS (above) stored on
# OrganisationMember / Event respectively — NOT separate collections — to avoid
# unnecessary duplicate entities, per the owner's instruction. See FOUNDATION doc.
# ══════════════════════════════════════════════════════════════════════════════
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

organisations = db["inst_organisations"]                 # Organisation (NOSTOPS-ORG)
org_members = db["inst_org_members"]                     # OrganisationMember (+EventCreatorRole enum field)
council_programmes = db["inst_council_programmes"]       # CouncilProgramme (NOSTOPS-PGM)
programme_versions = db["inst_programme_versions"]       # ProgrammeVersion (immutable snapshots, NOSTOPS-PGV)
org_programmes = db["inst_org_programmes"]               # OrganisationProgramme (NOSTOPS-OPG)
events = db["inst_events"]                               # Event (+EventVisibility enum field, NOSTOPS-EVT)
event_sessions = db["inst_event_sessions"]               # EventSession (NOSTOPS-SES)
participants = db["inst_participants"]                   # Participant (NOSTOPS-PTP)
registrations = db["inst_registrations"]                 # Registration (NOSTOPS-REG)
attendance = db["inst_attendance"]                       # Attendance (NOSTOPS-ATT)
feedback = db["inst_feedback"]                           # Feedback (NOSTOPS-FBK)
# §8 participant passwordless auth (magic-link + opaque session). Isolated to
# the institutional engine; never touches the remote auth backend.
participant_magic = db["inst_participant_magic"]         # one-time magic links (hashed)
participant_sessions = db["inst_participant_sessions"]   # opaque participant sessions (hashed)
# §11 teacher matching + §12 attendance/feedback + §16 reminders.
teacher_directory = db["inst_teacher_directory"]         # empanelled-teacher registry (city-matchable)
cron_runs = db["inst_cron_runs"]                         # idempotency ledger for scheduled jobs
teacher_assignments = db["inst_teacher_assignments"]     # TeacherAssignment (NOSTOPS-TAS)
teacher_recommendations = db["inst_teacher_recommendations"]  # TeacherRecommendation (NOSTOPS-TRC)
teacher_feedback = db["inst_teacher_feedback"]           # TeacherFeedback (teacher→programme quality signal)
city_coordinator_assignments = db["inst_city_coordinator_assignments"]  # CityCoordinatorAssignment (NOSTOPS-CCA)
programme_ip_metadata = db["inst_programme_ip_metadata"] # ProgrammeIPMetadata (NOSTOPS-IPM)
pricing_calculations = db["inst_pricing_calculations"]   # PricingCalculation (NOSTOPS-PRC)
revenue_allocations = db["inst_revenue_allocations"]     # RevenueAllocation (NOSTOPS-RVA)
settlements = db["inst_settlements"]                     # Settlement (NOSTOPS-STL)
renewals = db["inst_renewals"]                           # Renewal (NOSTOPS-RNW)
event_seo = db["inst_event_seo"]                         # EventSEO (NOSTOPS-SEO, one per event)
event_audit_log = db["inst_event_audit_log"]             # EventAuditLog (append-only / immutable)
# Infrastructure collections (not business entities).
counters = db["inst_counters"]                           # atomic immutable-ID sequences
platform_config = db["inst_platform_config"]             # engine flag / config singleton

router = APIRouter(prefix="/api/institutional", tags=["institutional"])

_ensured = False


# ── Helpers ───────────────────────────────────────────────────────────────────
def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _year() -> str:
    return time.strftime("%Y", time.gmtime())


async def _next_id(entity: str) -> str:
    """Atomic, immutable, human-readable internal ID: NOSTOPS-<PREFIX>-<YEAR>-NNNNNN."""
    prefix = ID_PREFIXES.get(entity)
    if not prefix:
        raise ValueError(f"no id prefix for entity {entity!r}")
    year = _year()
    doc = await counters.find_one_and_update(
        {"_id": f"{prefix}:{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"NOSTOPS-{prefix}-{year}-{int(doc['seq']):06d}"


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").strip().lower()).strip("-")
    return s[:60] or "org"


_MONTHS = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def _date_slug(event_date: Optional[str]) -> Optional[str]:
    """'2026-11-18' -> 'nov-18-2026' (human-readable date segment for event URLs)."""
    d = _parse_date(event_date)
    if not d:
        return None
    return f"{_MONTHS[d.month]}-{d.day}-{d.year}"


def _build_event_slug(title: str, event_date: Optional[str], event_id: str) -> str:
    """§6 — human-readable, stable event URL, e.g.
    'yoga-for-focus-attention-acme-mumbai-nov-18-2026'. The immutable Event ID is
    retained internally; the slug is assigned ONCE at publish and never changes."""
    base = _slugify(title)
    ds = _date_slug(event_date)
    return f"{base}-{ds}" if ds else base


def _event_end_dt(ev: dict) -> Optional["_dt.datetime"]:
    """§9 — the timezone-aware END datetime of an event, from the configured
    event_date + (end_time, else start_time + duration_minutes, else end-of-day).
    Returned in UTC. None when the date is unknown. Completion is gated on THIS
    (the end), never merely on the start having passed. A repeating programme
    ends with its LAST session."""
    evd = _parse_date(ev.get("last_session_date") if _is_recurring(ev) else None) or _parse_date(ev.get("event_date"))
    if not evd:
        return None
    try:
        tz = ZoneInfo(ev.get("timezone") or DEFAULT_TIMEZONE)
    except Exception:
        tz = ZoneInfo(DEFAULT_TIMEZONE)

    def _hm(t):
        try:
            parts = str(t).strip().split(":")
            return int(parts[0]), int(parts[1])
        except Exception:
            return None

    end_hm = _hm(ev.get("end_time")) if ev.get("end_time") else None
    if end_hm:
        end_local = _dt.datetime(evd.year, evd.month, evd.day, end_hm[0], end_hm[1], tzinfo=tz)
    else:
        start_hm = _hm(ev.get("start_time")) if ev.get("start_time") else None
        if start_hm:
            dur = int(ev.get("duration_minutes") or 0) or 60
            end_local = (_dt.datetime(evd.year, evd.month, evd.day, start_hm[0], start_hm[1], tzinfo=tz)
                         + _dt.timedelta(minutes=dur))
        else:
            # No time configured → treat the whole local day as the window.
            end_local = _dt.datetime(evd.year, evd.month, evd.day, 23, 59, 59, tzinfo=tz)
    return end_local.astimezone(_dt.timezone.utc)


def _effective_lifecycle(ev: dict) -> str:
    """§7/§9 — derive the live status from the stored lifecycle + the configured
    schedule. DRAFT / ARCHIVED / EVERGREEN are explicit (admin-controlled) and
    never auto-derived. A published event becomes LIVE on its day and COMPLETED
    only once its scheduled END time (date + end/start+duration) has passed —
    NOT merely because the start time passed."""
    lc = ev.get("lifecycle")
    if lc in {"DRAFT", "ARCHIVED", "EVERGREEN"}:
        return lc
    evd = _parse_date(ev.get("event_date"))
    if not evd:
        return lc or "PUBLISHED"
    now = _dt.datetime.now(_dt.timezone.utc)
    # event_date is a LOCAL calendar date — compare it with "today" in the
    # event's own timezone (a UTC date is a day behind IST until 05:30 IST).
    try:
        tz = ZoneInfo(ev.get("timezone") or DEFAULT_TIMEZONE)
    except Exception:
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    today = now.astimezone(tz).date()
    # A repeating programme runs from its first session to its LAST session.
    last = (_parse_date(ev.get("last_session_date")) if _is_recurring(ev) else None) or evd
    if evd > today:
        return "PUBLISHED"
    if last < today:
        return "COMPLETED"
    if last > today:
        return "LIVE"
    # Final (or only) session day: LIVE until the computed END time, then COMPLETED.
    end_dt = _event_end_dt(ev)
    if end_dt and now >= end_dt:
        return "COMPLETED"
    return "LIVE"


def _retention_until(ev: dict) -> Optional[str]:
    """§7 — public COMPLETED events stay available ≥90 days. Returns the ISO date
    until which a completed event is retained (for NOSTOPS archive/evergreen review)."""
    if _effective_lifecycle(ev) != "COMPLETED":
        return None
    evd = _parse_date(ev.get("last_session_date") if _is_recurring(ev) else None) or _parse_date(ev.get("event_date"))
    if not evd:
        return None
    return (evd + _dt.timedelta(days=90)).isoformat()


def _is_recurring(ev: Optional[dict]) -> bool:
    return ((ev or {}).get("schedule") or {}).get("type") == SCHEDULE_RECURRING


def _local_today(ev: Optional[dict]) -> "_dt.date":
    """Today's calendar date in the event's own timezone."""
    try:
        tz = ZoneInfo((ev or {}).get("timezone") or DEFAULT_TIMEZONE)
    except Exception:
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    return _dt.datetime.now(_dt.timezone.utc).astimezone(tz).date()


def _schedule_label(ev: dict) -> Optional[str]:
    """'12 sessions · every Mon & Thu · until 2026-09-28' for a repeating programme."""
    if not _is_recurring(ev):
        return None
    s = ev.get("schedule") or {}
    days = " & ".join(WEEKDAY_SHORT[d] for d in s.get("weekdays") or [])
    until_d = _parse_date(ev.get("last_session_date") or s.get("end_date"))
    until = f"{until_d.day} {_MONTHS[until_d.month].title()} {until_d.year}" if until_d else None
    parts = [f"{s.get('session_count') or 0} sessions" if s.get("session_count") else None,
             f"every {days}" if days else None, f"until {until}" if until else None]
    return " · ".join(p for p in parts if p) or "Repeating programme"


class ScheduleIn(BaseModel):
    type: str = SCHEDULE_SINGLE                                   # SINGLE | RECURRING
    sessions_per_week: Optional[int] = Field(default=None, ge=1, le=2)
    weekdays: Optional[List[int]] = None                         # 0 = Monday … 6 = Sunday
    end_date: Optional[str] = None


def _build_schedule(sched: Optional[ScheduleIn], event_date: Optional[str]) -> tuple:
    """Validate a programme schedule → (schedule doc | None, [session ISO dates]).
    SINGLE (or no schedule) → (None, []). A draft may hold a RECURRING pattern
    before its start/end dates are set (no sessions yet)."""
    if not sched or (sched.type or SCHEDULE_SINGLE).strip().upper() != SCHEDULE_RECURRING:
        return None, []
    per_week = sched.sessions_per_week or 1
    days = sorted(set(sched.weekdays or []))
    if len(days) != per_week or any(d < 0 or d > 6 for d in days):
        raise HTTPException(status_code=400, detail="schedule_weekdays_invalid")
    end_s = (sched.end_date or "").strip()[:10] or None
    doc = {"type": SCHEDULE_RECURRING, "sessions_per_week": per_week, "weekdays": days,
           "end_date": end_s, "session_count": 0}
    start, end = _parse_date(event_date), _parse_date(end_s)
    if not start or not end:
        return doc, []
    if start.weekday() not in days:
        raise HTTPException(status_code=400, detail="schedule_start_not_on_weekday")
    if end <= start:
        raise HTTPException(status_code=400, detail="schedule_end_before_start")
    if (end - start).days > MAX_SCHEDULE_DAYS:
        raise HTTPException(status_code=400, detail="schedule_too_long")
    dates = [start + _dt.timedelta(days=i) for i in range((end - start).days + 1)
             if (start + _dt.timedelta(days=i)).weekday() in days]
    if len(dates) < 2:
        raise HTTPException(status_code=400, detail="schedule_needs_two_sessions")
    doc["session_count"] = len(dates)
    return doc, [d.isoformat() for d in dates]


async def _replace_sessions(event_id: str, dates: list) -> None:
    """(Re)write a programme's session rows. Only ever called before publish,
    so no registration can point at a removed session."""
    await event_sessions.delete_many({"event_id": event_id})
    if dates:
        now = _now()
        await event_sessions.insert_many([{
            "session_id": f"{event_id}-S{i:03d}", "event_id": event_id, "seq": i, "date": d,
            "starts_at": d, "status": "SCHEDULED", "reminder_sent_at": None, "created_at": now,
        } for i, d in enumerate(dates, 1)])


async def _session_rows(ev: dict) -> list:
    """A repeating programme's sessions with per-session confirmed counts and
    seats left (capacity applies to EACH session)."""
    rows = await event_sessions.find({"event_id": ev["event_id"]}).sort("seq", 1).to_list(length=500)
    counts: dict = {}
    async for g in registrations.aggregate([
            {"$match": {"event_id": ev["event_id"], "booking_status": BOOKING_CONFIRMED}},
            {"$group": {"_id": "$session_id", "n": {"$sum": 1}}}]):
        counts[g["_id"]] = g["n"]
    today = _local_today(ev)
    cap = ev.get("capacity")
    out = []
    for s in rows:
        c = counts.get(s["session_id"], 0)
        left = max(cap - c, 0) if isinstance(cap, int) and cap > 0 else None
        out.append({"session_id": s["session_id"], "seq": s["seq"], "date": s["date"], "confirmed": c,
                    "seats_remaining": left, "is_full": left == 0,
                    "is_past": (_parse_date(s["date"]) or today) < today})
    return out


async def _best_registration(event_id: str, participant_id: str) -> tuple:
    """The participant's most representative CONFIRMED registration for an event
    (a repeating programme has one per session): attended first, then unmarked,
    then absent. Returns (registration | None, attendance | None)."""
    regs = await registrations.find({"event_id": event_id, "participant_id": participant_id,
                                     "booking_status": BOOKING_CONFIRMED}).to_list(length=500)
    best = None
    for r in regs:
        att = await attendance.find_one({"event_id": event_id, "registration_id": r["registration_id"]})
        rank = {"PRESENT": 0, "ABSENT": 2}.get((att or {}).get("status"), 1)
        if best is None or rank < best[0]:
            best = (rank, r, att)
    return (best[1], best[2]) if best else (None, None)


def _teacher_publicly_confirmed(ev: dict) -> bool:
    """Whether the public page may name the assigned teacher. A PROPOSED offer
    (teacher hasn't accepted yet) stays hidden so we never advertise a teacher who
    might decline; ACCEPTED/CONFIRMED (and legacy rows with no status) are shown."""
    at = ev.get("assigned_teacher") or {}
    if not at:
        return False
    return at.get("status") in (None, "ASSIGNED", "ACCEPTED", "CONFIRMED")


def _event_teacher_verified(ev: dict) -> bool:
    """Public "Verified Teacher": confirmed AND verified (B4.7). Demo events never."""
    if ev.get("is_demo_seeded"):
        return False
    return _teacher_publicly_confirmed(ev) and (ev.get("assigned_teacher") or {}).get("verified") is True


# §1/§2 — explicit teacher operational states, derived from the event + its
# current offer (no duplicate collection; the assignment records are the source).
TEACHER_STATE_LABELS = {
    "TEACHER_MATCHING": "Finding your NOSTOPS teacher",
    "TEACHER_OFFERED": "Teacher offer sent — awaiting teacher confirmation",
    "TEACHER_CONFIRMED": "Teacher Confirmed",
    "TEACHER_REASSIGNMENT_REQUIRED": "Finding another teacher",
    "TEACHER_UNAVAILABLE": "No teacher available yet — NOSTOPS is on it",
}


def _teacher_state(ev: dict) -> Optional[str]:
    """Accurate teacher state for an event. A teacher is CONFIRMED only after an
    explicit accept; an auto-selected offer is OFFERED, never confirmed."""
    if not ev or ev.get("lifecycle") == "DRAFT":
        return None
    at = ev.get("assigned_teacher") or {}
    if at.get("teacher_id"):
        return "TEACHER_OFFERED" if at.get("status") == "PROPOSED" else "TEACHER_CONFIRMED"
    if ev.get("teacher_search_exhausted"):
        return "TEACHER_UNAVAILABLE"
    if ev.get("teacher_declined_once"):
        return "TEACHER_REASSIGNMENT_REQUIRED"
    return "TEACHER_MATCHING"


async def _maybe_complete(ev: dict) -> dict:
    """Live Completion Sweep (opportunistic) — when an event is read and its date
    has reached/passed, flip the STORED lifecycle to match the derived state so
    LIVE/COMPLETED becomes authoritative instantly (certificates + feedback gate on
    it). Idempotent; audits once per transition."""
    if not ev or ev.get("lifecycle") not in {"PUBLISHED", "LIVE"}:
        return ev
    eff = _effective_lifecycle(ev)
    if eff != ev.get("lifecycle") and eff in {"LIVE", "COMPLETED"}:
        patch = {"lifecycle": eff, "updated_at": _now()}
        if eff == "COMPLETED":
            patch["completed_at"] = ev.get("completed_at") or _now()
        await events.update_one({"event_id": ev["event_id"]}, {"$set": patch})
        await _audit("Event", ev["event_id"], f"EVENT_{eff}", {"user_id": "system", "role": "engine"}, {})
        ev = {**ev, **patch}
    return ev


async def _on_event_completed(ev: dict, now: str) -> dict:
    """§9 — one-time finalisation side-effects when an event reaches COMPLETED.
    Idempotent (gated per-effect + an overall completion_finalized_at). Returns a
    patch of flags to persist. Analytics, organisation dashboards and participant
    'My Programmes' all read live off the lifecycle, so they update automatically;
    this handles the active triggers (feedback, certificates, settlement)."""
    patch: dict = {}
    # 1. Participant feedback — thank-you + feedback email (idempotent).
    if not ev.get("thankyou_sent_at"):
        try:
            await _email_event_participants({**ev, "lifecycle": "COMPLETED"}, "thankyou")
        except Exception as e:
            logger.error(f"completion participant feedback email failed: {e}")
        patch["thankyou_sent_at"] = now
    # 2. Teacher feedback — prompt the CONFIRMED teacher to rate the programme.
    at = ev.get("assigned_teacher") or {}
    if (at.get("teacher_id") and at.get("status") in ("ACCEPTED", "CONFIRMED")
            and not ev.get("teacher_feedback_requested_at")):
        patch["teacher_feedback_requested_at"] = now
    # 3. Certificates — available on COMPLETED for every Council programme
    #    (generic completion certificate); flag the initiation moment.
    if not ev.get("certificates_initiated_at"):
        patch["certificates_initiated_at"] = now
    # 4. Settlement — initiate a PENDING settlement ONLY where applicable (a PAID
    #    event). FREE community sessions have no settlement to run.
    if (ev.get("pricing_type") == PRICING_PAID) and not ev.get("settlement_initiated_at"):
        try:
            sid = await _next_id("Settlement")
            await settlements.update_one(
                {"event_id": ev["event_id"]},
                {"$setOnInsert": {"settlement_id": sid, "event_id": ev["event_id"],
                                  "organisation_id": ev.get("organisation_id"),
                                  "status": "PENDING", "created_at": now}},
                upsert=True)
            patch["settlement_initiated_at"] = now
        except Exception as e:
            logger.error(f"completion settlement init failed: {e}")
    return patch


def _city_slug(city: Optional[str]) -> Optional[str]:
    if not city:
        return None
    s = _slugify(city)
    return s or None


def _clean(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def _safe_index(coll, *args, **kwargs):
    """Best-effort index creation: a single failing index (e.g. existing
    duplicate/null data on a unique key, or an option conflict with an index
    already present in the production DB) is logged and skipped so it can never
    turn every /api/institutional endpoint into an HTTP 500."""
    try:
        return await coll.create_index(*args, **kwargs)
    except Exception:  # noqa: BLE001
        logger.exception("index creation failed on %s keys=%r opts=%r", coll.name, args, kwargs)
        return None


async def _ensure():
    """Idempotent index creation across all inst_* collections."""
    global _ensured
    if _ensured:
        return
    await _safe_index(organisations, "organisation_id", unique=True)
    await _safe_index(organisations, "slug")
    await _safe_index(organisations, [("created_by", 1), ("created_at", -1)])
    await _safe_index(org_members, "member_id", unique=True)
    await _safe_index(org_members, [("organisation_id", 1), ("user_id", 1)], unique=True)
    await _safe_index(org_members, "user_id")
    await _safe_index(council_programmes, "programme_id", unique=True)
    await _safe_index(council_programmes, "slug")
    await _safe_index(council_programmes, "taxonomy")
    await _safe_index(programme_versions, "programme_version_id", unique=True)
    await _safe_index(programme_versions, [("programme_id", 1), ("version", -1)])
    await _safe_index(org_programmes, "org_programme_id", unique=True)
    await _safe_index(org_programmes, [("organisation_id", 1), ("programme_id", 1)])
    await _safe_index(events, "event_id", unique=True)
    await _safe_index(events, "slug")
    await _safe_index(events, "slug_aliases")
    await _safe_index(events, [("organisation_id", 1), ("created_at", -1)])
    await _safe_index(events, [("visibility", 1), ("lifecycle", 1), ("city_slug", 1)])
    await _safe_index(event_sessions, "session_id", unique=True)
    await _safe_index(event_sessions, [("event_id", 1), ("starts_at", 1)])
    await _safe_index(participants, "participant_id", unique=True)
    await _safe_index(participants, [("organisation_id", 1), ("email", 1)])
    await _safe_index(registrations, "registration_id", unique=True)
    # B2.2 — one registration per participant per SESSION (a repeating programme
    # has many sessions; single-session events have session_id null). Replaces the
    # older per-event unique index.
    try:
        await registrations.drop_index("event_id_1_participant_id_1")
    except Exception:  # noqa: BLE001 — already dropped
        pass
    await _safe_index(registrations, [("event_id", 1), ("participant_id", 1), ("session_id", 1)], unique=True)
    await _safe_index(attendance, "attendance_id", unique=True)
    # Session-level uniqueness applies ONLY to true per-session attendance; event-level
    # attendance (session_id absent) is keyed by (event_id, registration_id) below, so a
    # participant can attend MANY events (repeat participation). Partial index avoids a
    # null-session collision across events.
    await _safe_index(attendance, [("session_id", 1), ("participant_id", 1)], unique=True,
                                  partialFilterExpression={"session_id": {"$type": "string"}})
    await _safe_index(feedback, "feedback_id", unique=True)
    await _safe_index(feedback, [("event_id", 1), ("participant_id", 1)])
    await _safe_index(teacher_assignments, "assignment_id", unique=True)
    await _safe_index(teacher_assignments, [("event_id", 1), ("teacher_id", 1)])
    await _safe_index(teacher_recommendations, "recommendation_id", unique=True)
    await _safe_index(teacher_recommendations, [("event_id", 1), ("teacher_id", 1)])
    await _safe_index(city_coordinator_assignments, "cca_id", unique=True)
    await _safe_index(city_coordinator_assignments, [("city_slug", 1), ("status", 1)])
    await _safe_index(programme_ip_metadata, "ip_metadata_id", unique=True)
    await _safe_index(programme_ip_metadata, "programme_id", unique=True)
    await _safe_index(pricing_calculations, "pricing_id", unique=True)
    await _safe_index(pricing_calculations, "event_id")
    await _safe_index(revenue_allocations, "allocation_id", unique=True)
    await _safe_index(revenue_allocations, "event_id")
    await _safe_index(settlements, "settlement_id", unique=True)
    await _safe_index(settlements, [("event_id", 1), ("status", 1)])
    await _safe_index(renewals, "renewal_id", unique=True)
    await _safe_index(renewals, [("organisation_id", 1), ("status", 1)])
    await _safe_index(event_seo, "event_seo_id", unique=True)
    await _safe_index(event_seo, "event_id", unique=True)
    await _safe_index(event_seo, "slug")
    await _safe_index(event_audit_log, [("entity_type", 1), ("entity_id", 1), ("created_at", 1)])
    await _safe_index(event_audit_log, "created_at")
    _ensured = True


_ensured_participant = False


async def _ensure_participant():
    """Idempotent index creation for the §8 participant-auth collections.
    TTL indexes auto-purge expired magic links / sessions; expiry is STILL
    enforced in every auth query (TTL deletion is eventual, not authorisation)."""
    global _ensured_participant
    if _ensured_participant:
        return
    # Global email identity for a participant (passwordless auth key).
    await _safe_index(participants, "email", unique=True, sparse=True)
    await _safe_index(participant_magic, "token_hash", unique=True)
    await _safe_index(participant_magic, "expires_at", expireAfterSeconds=0)
    await _safe_index(participant_magic, "participant_id")
    await _safe_index(participant_sessions, "session_hash", unique=True)
    await _safe_index(participant_sessions, "expires_at", expireAfterSeconds=0)
    await _safe_index(participant_sessions, [("participant_id", 1), ("revoked_at", 1)])
    _ensured_participant = True


_ensured_teacher = False


async def _ensure_teacher():
    """Idempotent indexes for §11 teacher matching + §12 attendance/feedback."""
    global _ensured_teacher
    if _ensured_teacher:
        return
    await _safe_index(teacher_directory, "teacher_id", unique=True)
    await _safe_index(teacher_directory, [("city_slug", 1), ("active", 1)])
    await _safe_index(teacher_assignments, "teacher_id")
    await _safe_index(teacher_assignments, [("teacher_id", 1), ("status", 1)])
    await _safe_index(teacher_assignments, [("event_id", 1), ("status", 1)])
    await _safe_index(teacher_feedback, [("event_id", 1), ("teacher_id", 1)], unique=True)
    # One attendance record per participant per event.
    await _safe_index(attendance, [("event_id", 1), ("registration_id", 1)], unique=True)
    # Non-guessable public certificate verification code (employer QR / verify link).
    await _safe_index(registrations, "verify_code", sparse=True)
    # NOTE: inst_feedback already has a non-unique (event_id, participant_id) index
    # from _ensure(); uniqueness is enforced via the upsert key, so we don't add a
    # conflicting unique index here.
    await _safe_index(cron_runs, "run_key", unique=True)
    await _b47_reconcile_teacher_status()
    _ensured_teacher = True


async def _b47_reconcile_teacher_status():
    """B4.7 — idempotent. Before B4.7, opening the teacher Institutional Events page
    stored the teacher as `empanelled: True` without checking anything. Those rows
    are kept (history preserved) but flagged for review, and they stay ineligible
    until the main backend's own status is synced (see `_match_eligible`). The
    stored "verified" badge of every assigned event is recomputed from that rule."""
    now = _now()
    await teacher_directory.update_many(
        {"status_source": {"$ne": STATUS_SOURCE_MAIN}, "is_demo_seeded": {"$ne": True},
         "status_review": {"$exists": False}},
        [{"$set": {"status_review": {
            "flag": "LEGACY_UNCONFIRMED_STATUS",
            "reason": ("Empanelment flag was set automatically by a page-load sync before B4.7; "
                       "it was never confirmed by the main backend. Not eligible until re-synced."),
            "legacy_empanelled": {"$ifNull": ["$empanelled", None]},
            "flagged_at": now,
        }}}])
    docs = await events.find({"assigned_teacher.teacher_id": {"$exists": True}},
                             {"event_id": 1, "assigned_teacher": 1}).to_list(length=5000)
    for ev in docs:
        at = ev.get("assigned_teacher") or {}
        d = await teacher_directory.find_one({"teacher_id": at.get("teacher_id")})
        eligible = _match_eligible(d)
        if at.get("verified") is not eligible:
            await events.update_one({"event_id": ev["event_id"]}, {"$set": {"assigned_teacher.verified": eligible}})


# B4.7 — ONE authoritative eligibility rule for institutional matching AND the
# public "Verified Teacher" badge (owner decision): the MAIN backend's own record
# says the ID check passed AND the teacher is empanelled. It is written only by the
# BFF-attested directory sync (from /teachers/me/native-profile) — never by browsing
# a page, appearing in a matching list, receiving a lead or accepting an offer.
STATUS_SOURCE_MAIN = "main_backend"


def _match_eligible(t: Optional[dict]) -> bool:
    return (bool(t) and t.get("active") is True and not t.get("is_demo_seeded")
            and t.get("status_source") == STATUS_SOURCE_MAIN
            and t.get("empanelled") is True and t.get("id_verified") is True)


async def _audit(entity_type: str, entity_id: str, action: str, actor: dict, meta: Optional[dict] = None):
    """Append-only EventAuditLog entry. Records all engine state changes
    (events + governance). Never updated or deleted."""
    await event_audit_log.insert_one({
        "audit_id": uuid.uuid4().hex,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "actor_user_id": str(actor.get("user_id") or ""),
        "actor_role": str(actor.get("role") or ""),
        "meta": meta or {},
        "created_at": _now(),
    })


# ── Auth (mirror of pulse.py / verification.py) ───────────────────────────────
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


# B4.7 — role checks as DEPENDENCIES so a non-admin gets 403 before the request
# body is validated (never a 422 that hints at the payload shape).
async def admin_only_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    return user


async def competence_reviewer_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") not in {"admin", "council"}:
        raise HTTPException(status_code=403, detail="admin_or_council_only")
    return user


def _require_active():
    if not engine_active():
        raise HTTPException(status_code=403, detail="institutional_engine_disabled")


# ══════════════════════════════════════════════════════════════════════════════
# FOUNDATION API (Prompt 1) — health / meta / config + minimal Organisation.
# No Event Creator UI. Programmes / events / sessions / registrations are built
# in Prompts 2–6 on top of these collections.
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/health")
async def health() -> dict:
    db_ok = True
    try:
        await db.command("ping")
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "healthy",
        "engine": "institutional",
        "version": ENGINE_VERSION,
        "flag": flag(),
        "active": engine_active(),
        "db_ok": db_ok,
    }


@router.get("/meta")
async def meta() -> dict:
    """The complete, strict governance vocabulary of the engine. Read-only; the
    frontend + later prompts consume this so terms never drift (e.g. taxonomy
    is always MIND/BODY/SPECIAL NEEDS, never 'Specific Needs')."""
    return {
        "version": ENGINE_VERSION,
        "flag": flag(),
        "active": engine_active(),
        "cohorts": [{"key": k, "label": COHORT_LABELS[k]} for k in sorted(COHORT_TYPES)],
        "taxonomy": [
            {"key": k, "label": TAXONOMY_LABELS[k], "slug": TAXONOMY_SLUGS[k]}
            for k in (TAX_MIND, TAX_BODY, TAX_SPECIAL_NEEDS)
        ],
        "asset_layers": ASSET_LAYERS,
        "event_lifecycle": EVENT_LIFECYCLE,
        "public_retention_days": PUBLIC_RETENTION_DAYS,
        "event_visibility": sorted(EVENT_VISIBILITY),
        "publicly_indexable_visibility": sorted(PUBLICLY_INDEXABLE_VISIBILITY),
        "venue_types": [
            {"key": VENUE_EXISTING, "label": "Existing organisation / community space"},
            {"key": VENUE_EXTERNAL, "label": "Other (external) venue"},
        ],
        "default_timezone": DEFAULT_TIMEZONE,
        "timezones": SUPPORTED_TIMEZONES,
        "org_trust_states": sorted(ORG_TRUST_STATES),
        "member_roles": sorted(MEMBER_ROLES),
        "event_creator_roles": sorted(EVENT_CREATOR_ROLES),
        "personas": PERSONAS,
        "public_persona": PUBLIC_PERSONA,
        "launch_cities": LAUNCH_CITIES,
        "programme_statuses": sorted(PROGRAMME_STATUSES),
        "registration_statuses": sorted(REGISTRATION_STATUSES),
        "registration_access": [
            {"key": k, "label": REGISTRATION_ACCESS_LABELS[k]}
            for k in (REG_OPEN, REG_ORG_ONLY, REG_INVITE_ONLY, REG_CLOSED)
        ],
        "pricing_types": sorted(PRICING_TYPES),
        "participant_types": sorted(PARTICIPANT_TYPES),
        "attendance_statuses": sorted(ATTENDANCE_STATUSES),
        "teacher_assignment_statuses": sorted(TEACHER_ASSIGNMENT_STATUSES),
        "settlement_statuses": sorted(SETTLEMENT_STATUSES),
        "renewal_statuses": sorted(RENEWAL_STATUSES),
        "id_prefixes": ID_PREFIXES,
        "id_format": "NOSTOPS-<PREFIX>-<YEAR>-<NNNNNN>",
        # Governance boundary (Prompt 1 §8) — surfaced so UIs never let an org
        # rewrite Council knowledge or make unsupported health/clinical claims.
        "council_controlled_fields": [
            "programme_name", "programme_essence", "objectives", "taxonomy",
            "guru_attribution", "provenance", "approved_claims",
            "teacher_competency_requirements", "programme_version",
            "approved_delivery_structure",
        ],
        "organisation_controlled_fields": [
            "organisation_name", "organisation_logo", "organisation_description",
            "event_title", "event_subtitle", "date", "time", "venue", "city",
            "capacity", "language", "registration_closing_date", "event_visibility",
        ],
        # IP principle (Prompt 1 §9) — structure only, NO hard-coded percentages.
        "ip_principle": {
            "guru_background_ip_separate_from_council_programme_ip": True,
            "records": [
                "guru_attribution", "programme_provenance",
                "ip_licensing_metadata", "royalty_knowledge_participation",
            ],
            "hard_coded_commercial_percentages": False,
        },
        # City Coordinator principle (Prompt 1 §11) — NOT a gate for org self-creation.
        "city_coordinator_is_gate_for_event_creation": False,
    }


@router.get("/config")
async def config(user: dict = Depends(current_user)) -> dict:
    """Engine config singleton (flag + launch cities + taxonomy). Admin-oriented
    read; identity-gated so it isn't a public surface."""
    await _ensure()
    cfg = await platform_config.find_one({"_id": "singleton"})
    return {
        "flag": flag(),
        "active": engine_active(),
        "version": ENGINE_VERSION,
        "launch_cities": LAUNCH_CITIES,
        "taxonomy": [TAXONOMY_LABELS[k] for k in (TAX_MIND, TAX_BODY, TAX_SPECIAL_NEEDS)],
        "teacher_response_window_hours": int((cfg or {}).get("teacher_response_window_hours")
                                             or DEFAULT_TEACHER_RESPONSE_WINDOW_HOURS),
        "stored": _clean(cfg) if cfg else None,
    }


# ── Organisation (minimal foundation CRUD — proves immutable-ID + membership) ──
class OrganisationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    cohort_type: str
    description: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[str] = None
    website: Optional[str] = None
    city: Optional[str] = None
    contact_email: Optional[str] = None
    contact_person: Optional[str] = Field(default=None, max_length=120)
    contact_phone: Optional[str] = Field(default=None, max_length=40)
    # Optional self-declared EventCreatorRole for the creating member.
    creator_role: Optional[str] = None


_ORG_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ORG_PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,22}$")


def _validate_org_contact(email: Optional[str], phone: Optional[str]) -> None:
    """OEA-13 — organisation contact details must be usable: a well-formed email
    and (when given) a phone number of 7–15 digits. Empty values are allowed."""
    e = (email or "").strip()
    if e and not _ORG_EMAIL_RE.match(e):
        raise HTTPException(status_code=400, detail="Please enter a valid contact email address.")
    p = (phone or "").strip()
    if p:
        digits = re.sub(r"\D", "", p)
        if not _ORG_PHONE_RE.match(p) or not (7 <= len(digits) <= 15):
            raise HTTPException(status_code=400,
                                detail="Please enter a valid contact phone number (7–15 digits).")


def _public_org(doc: dict) -> dict:
    """Public-safe organisation projection (drops internal mongo _id)."""
    return _clean(dict(doc)) or {}


@router.post("/organisations")
async def create_organisation(
    body: OrganisationCreate,
    user: dict = Depends(current_user),
) -> dict:
    """Self-service organisation creation (Prompt 1 §11 — a City Coordinator is
    NOT a prerequisite). Creates the Organisation (trust_state UNVERIFIED) plus
    an OrganisationMember OWNER/EventCreator for the caller."""
    _require_active()
    await _ensure()

    cohort = (body.cohort_type or "").strip().upper()
    if cohort not in COHORT_TYPES:
        raise HTTPException(status_code=400, detail="invalid cohort_type")

    creator_role = (body.creator_role or "").strip().upper() or None
    if creator_role and creator_role not in EVENT_CREATOR_ROLES:
        raise HTTPException(status_code=400, detail="invalid creator_role")

    name = body.name.strip()
    _validate_org_contact(body.contact_email, body.contact_phone)
    contact_email = (body.contact_email or "").strip().lower() or None
    email_domain = contact_email.split("@", 1)[1] if contact_email and "@" in contact_email else None
    city_slug = _city_slug(body.city)

    org_id = await _next_id("Organisation")
    now = _now()
    org_doc = {
        "organisation_id": org_id,
        "name": name,
        "slug": f"{_slugify(name)}-{org_id[-6:]}",
        "cohort_type": cohort,
        "description": (body.description or "").strip() or None,
        "logo_url": (body.logo_url or "").strip() or None,
        "website": (body.website or "").strip() or None,
        "primary_city": (body.city or "").strip() or None,
        "city_slug": city_slug,
        "is_launch_city": city_slug in LAUNCH_CITY_SLUGS if city_slug else False,
        "contact_email": contact_email,
        "email_domain": email_domain,
        "contact_person": (body.contact_person or "").strip() or None,
        "contact_phone": (body.contact_phone or "").strip() or None,
        # §7 trust model — starts UNVERIFIED; domain/manual verification later.
        "trust_state": ORG_TRUST_UNVERIFIED,
        "domain_verified": False,
        "created_by": str(user.get("user_id")),
        "created_at": now,
        "updated_at": now,
    }
    await organisations.insert_one(dict(org_doc))

    member_id = await _next_id("OrganisationMember")
    member_doc = {
        "member_id": member_id,
        "organisation_id": org_id,
        "user_id": str(user.get("user_id")),
        "name": user.get("name") or user.get("email") or "Member",
        "email": (user.get("email") or "").strip().lower() or None,
        "member_role": MEMBER_OWNER,
        # EventCreatorRole enum fields live on the membership (not a collection).
        "event_creator": True,
        "event_creator_role": creator_role or ECR_PROGRAMME_CHAMPION,
        "programme_champion": True,
        "status": "ACTIVE",
        "created_at": now,
    }
    await org_members.insert_one(dict(member_doc))

    await _audit("Organisation", org_id, "ORGANISATION_CREATED", user, {"cohort_type": cohort})

    return {"organisation": _public_org(org_doc), "member": _clean(dict(member_doc))}


@router.get("/organisations")
async def list_my_organisations(user: dict = Depends(current_user)) -> dict:
    """Organisations the caller is a member of (membership-scoped — never leaks
    other orgs)."""
    await _ensure()
    uid = str(user.get("user_id"))
    mems = await org_members.find({"user_id": uid}).to_list(length=500)
    org_ids = [m["organisation_id"] for m in mems]
    docs = await organisations.find({"organisation_id": {"$in": org_ids}}).sort("created_at", -1).to_list(length=500)
    role_by_org = {m["organisation_id"]: m.get("member_role") for m in mems}
    out = []
    for d in docs:
        o = _public_org(d)
        o["my_role"] = role_by_org.get(d["organisation_id"])
        out.append(o)
    return {"organisations": out, "count": len(out)}


@router.get("/organisations/{organisation_id}")
async def get_organisation(organisation_id: str, user: dict = Depends(current_user)) -> dict:
    """Single organisation — only if the caller is a member (else 404 to avoid
    leaking existence)."""
    await _ensure()
    uid = str(user.get("user_id"))
    mem = await org_members.find_one({"organisation_id": organisation_id, "user_id": uid})
    if not mem:
        raise HTTPException(status_code=404, detail="not_found")
    doc = await organisations.find_one({"organisation_id": organisation_id})
    if not doc:
        raise HTTPException(status_code=404, detail="not_found")
    o = _public_org(doc)
    o["my_role"] = mem.get("member_role")
    return {"organisation": o}


@router.get("/organisations/{organisation_id}/members")
async def list_members(organisation_id: str, user: dict = Depends(current_user)) -> dict:
    """Members of an org — caller must be a member. Participant/learner rosters
    are NOT exposed here (anti-poaching); this lists authorised org staff only."""
    await _ensure()
    uid = str(user.get("user_id"))
    mem = await org_members.find_one({"organisation_id": organisation_id, "user_id": uid, "status": "ACTIVE"})
    if not mem:
        raise HTTPException(status_code=404, detail="not_found")
    docs = await org_members.find({"organisation_id": organisation_id}).sort("created_at", 1).to_list(length=500)
    return {"members": [_clean(d) for d in docs], "count": len(docs)}


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT 2 — Event Creator workflow (Council programmes · org update+logo · event
# draft/publish · public event page). Participant registration + teacher matching
# are DEFERRED to a later prompt and are NOT implemented here.
# ══════════════════════════════════════════════════════════════════════════════

# Secret-only dependency (no user context) for non-PII Council programme reads.
async def require_secret(x_pulse_secret: Optional[str] = Header(None)) -> bool:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    return True


# ── Council-curated programme SEED CATALOGUE ─────────────────────────────────
# DEVELOPMENT SEED ONLY — clearly marked content_status=SEED_DEVELOPMENT. No
# invented Guru biographies, IP claims, medical/clinical claims or elaborate
# curriculum. Neutral, evidence-informed essence/objectives only. Taxonomy is
# strictly MIND / BODY / SPECIAL_NEEDS.
# Bumped to v2 to roll out the Prompt-3 enriched Council-controlled fields
# (recommended audience / group size / frequency / duration / languages /
# teacher competency / Council attribution) and an APPROVED programme version.
SEED_VERSION = "inst-seed-v2"
SEED_DISCLAIMER = "Development seed content — not final Council-approved programme content."

# Prompt 3/4 §4 — every seed programme is pinned to a single APPROVED version.
# Events created against a programme snapshot THIS version; a future Council
# change bumps the version and leaves historical events untouched.
APPROVED_VERSION = "v1.0"
# Generic, non-invented attribution (no fabricated individual Guru bios/claims).
COUNCIL_ATTRIBUTION = "Curated by the NOSTOPS Council of Yoga Gurus"

# Enriched seed catalogue (Prompt 3). All fields are neutral/operational — NO
# clinical/medical claims and NO invented Guru biographies. Taxonomy is strictly
# MIND / BODY / SPECIAL_NEEDS.
_SEED_PROGRAMMES = [
    # ── MIND ──────────────────────────────────────────────────────────────────
    {"seed_key": "mind-focus-attention", "name": "Yoga for Focus & Attention", "taxonomy": TAX_MIND,
     "essence": "Breath, posture and attention practices that support focus and mental clarity.",
     "objectives": ["Support focus and attention", "Build everyday mental clarity", "Settle a busy mind"],
     "audience": ["Working professionals", "Students", "Teams"],
     "group_size": "15–30 participants", "frequency": "Weekly",
     "duration_label": "45–60 minutes per session", "duration_minutes": 60,
     "languages": ["English", "Hindi", "Marathi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience facilitating group practice"]},
    {"seed_key": "mind-stress-resilience", "name": "Yoga for Stress Resilience", "taxonomy": TAX_MIND,
     "essence": "Practices to help manage everyday stress and build resilience.",
     "objectives": ["Ease everyday stress", "Build resilience", "Support calm and balance"],
     "audience": ["Working professionals", "Teams", "Caregivers"],
     "group_size": "15–30 participants", "frequency": "Weekly",
     "duration_label": "45–60 minutes per session", "duration_minutes": 60,
     "languages": ["English", "Hindi", "Marathi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with breath and relaxation practices"]},
    {"seed_key": "mind-better-sleep", "name": "Yoga for Better Sleep", "taxonomy": TAX_MIND,
     "essence": "Calming practices that support relaxation and restful sleep.",
     "objectives": ["Support relaxation", "Wind down the day", "Encourage restful sleep"],
     "audience": ["Working professionals", "Shift workers", "Adults"],
     "group_size": "12–25 participants", "frequency": "Weekly",
     "duration_label": "30–45 minutes per session", "duration_minutes": 45,
     "languages": ["English", "Hindi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with restorative practice"]},
    {"seed_key": "mind-emotional-wellbeing", "name": "Yoga for Emotional Wellbeing", "taxonomy": TAX_MIND,
     "essence": "Practices that support emotional balance and mental wellbeing.",
     "objectives": ["Support emotional balance", "Build everyday wellbeing", "Encourage self-awareness"],
     "audience": ["Working professionals", "Students", "Community groups"],
     "group_size": "12–25 participants", "frequency": "Weekly",
     "duration_label": "45–60 minutes per session", "duration_minutes": 60,
     "languages": ["English", "Hindi", "Marathi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with mindful group facilitation"]},
    # ── BODY ──────────────────────────────────────────────────────────────────
    {"seed_key": "body-strength-mobility", "name": "Yoga for Strength & Mobility", "taxonomy": TAX_BODY,
     "essence": "Postural practices that support strength, flexibility and mobility.",
     "objectives": ["Build functional strength", "Improve flexibility", "Support everyday mobility"],
     "audience": ["Working professionals", "Active adults", "Teams"],
     "group_size": "15–30 participants", "frequency": "2× per week",
     "duration_label": "45–60 minutes per session", "duration_minutes": 60,
     "languages": ["English", "Hindi", "Marathi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with postural practice"]},
    {"seed_key": "body-posture-back-care", "name": "Yoga for Posture & Back Care", "taxonomy": TAX_BODY,
     "essence": "Gentle practices that support posture and everyday back care.",
     "objectives": ["Support healthy posture", "Care for the back", "Ease everyday stiffness"],
     "audience": ["Desk-based professionals", "Adults"],
     "group_size": "12–25 participants", "frequency": "Weekly",
     "duration_label": "30–45 minutes per session", "duration_minutes": 45,
     "languages": ["English", "Hindi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with posture and back-care practice"]},
    {"seed_key": "body-energy-stamina", "name": "Yoga for Energy & Stamina", "taxonomy": TAX_BODY,
     "essence": "Active practices that support energy and stamina.",
     "objectives": ["Build steady energy", "Support stamina", "Enliven the body"],
     "audience": ["Working professionals", "Active adults", "Teams"],
     "group_size": "15–30 participants", "frequency": "2× per week",
     "duration_label": "45 minutes per session", "duration_minutes": 45,
     "languages": ["English", "Hindi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with active group practice"]},
    # ── SPECIAL NEEDS ───────────────────────────────────────────────────────────
    {"seed_key": "special-needs-accessible-chair", "name": "Accessible Chair Yoga", "taxonomy": TAX_SPECIAL_NEEDS,
     "essence": "Seated, accessible practices adaptable to varied mobility.",
     "objectives": ["Practise while seated", "Adapt to varied mobility", "Support gentle movement"],
     "audience": ["Seated participants", "Older adults", "Workplaces"],
     "group_size": "8–20 participants", "frequency": "Weekly",
     "duration_label": "30–45 minutes per session", "duration_minutes": 45,
     "languages": ["English", "Hindi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with accessible / adaptive practice"]},
    {"seed_key": "special-needs-gentle-mobility", "name": "Gentle Yoga for Limited Mobility", "taxonomy": TAX_SPECIAL_NEEDS,
     "essence": "Gentle, adaptable practices suited to limited mobility.",
     "objectives": ["Move gently", "Adapt practices to ability", "Support comfort and ease"],
     "audience": ["Participants with limited mobility", "Older adults"],
     "group_size": "8–20 participants", "frequency": "Weekly",
     "duration_label": "30–45 minutes per session", "duration_minutes": 45,
     "languages": ["English", "Hindi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with adaptive / accessible practice"]},
    {"seed_key": "special-needs-calm-sensory", "name": "Calming Practices for Sensory Wellbeing", "taxonomy": TAX_SPECIAL_NEEDS,
     "essence": "Calming, predictable practices that support sensory wellbeing.",
     "objectives": ["Offer calm and predictability", "Support sensory wellbeing", "Encourage ease"],
     "audience": ["Sensory-sensitive participants", "Support groups"],
     "group_size": "6–15 participants", "frequency": "Weekly",
     "duration_label": "30 minutes per session", "duration_minutes": 30,
     "languages": ["English", "Hindi"],
     "competency": ["NOSTOPS-empanelled teacher", "Experience with calming / sensory-aware facilitation"]},
]


def _seed_council_fields(s: dict) -> dict:
    """The full set of Council-controlled content for a seed programme at the
    current APPROVED_VERSION. Organisations can NEVER rewrite these fields."""
    tax = s["taxonomy"]
    return {
        "name": s["name"],
        "taxonomy": tax,
        "taxonomy_label": TAXONOMY_LABELS[tax],
        "taxonomy_slug": TAXONOMY_SLUGS[tax],
        "essence": s["essence"],
        "objectives": list(s["objectives"]),
        "recommended_audience": list(s["audience"]),
        "recommended_group_size": s["group_size"],
        "recommended_frequency": s["frequency"],
        "recommended_duration_label": s["duration_label"],
        "default_duration_minutes": s.get("duration_minutes", 60),
        "languages": list(s["languages"]),
        "teacher_competency_requirements": list(s["competency"]),
        "council_attribution": COUNCIL_ATTRIBUTION,
        "guru_attribution": None,            # no invented individual Guru bios
        "provenance": "NOSTOPS Council (development seed)",
        "approved_claims": [],               # NO clinical/medical claims
        "approved_delivery_structure": None,
        "level": "All levels",
        "version": APPROVED_VERSION,
    }


async def _ensure_seed():
    """Idempotent Council programme seed (upsert by seed_key). Runs once per
    SEED_VERSION. Each record is a CouncilProgramme + an immutable, APPROVED
    ProgrammeVersion snapshot + a ProgrammeIPMetadata stub (no hard-coded
    percentages).

    Prompt 3/4 versioning: enriching the catalogue bumps the programme to the
    new APPROVED_VERSION and inserts a NEW immutable ProgrammeVersion snapshot.
    Any event created earlier keeps the exact programme_snapshot (and version)
    it was created with — a Council change never silently rewrites history."""
    await _ensure()
    cfg = await platform_config.find_one({"_id": "singleton"})
    if cfg and cfg.get("seed_version") == SEED_VERSION:
        return
    now = _now()
    for s in _SEED_PROGRAMMES:
        fields = _seed_council_fields(s)
        existing = await council_programmes.find_one({"seed_key": s["seed_key"]})
        if existing:
            pid = existing["programme_id"]
            # Enrich/refresh the Council-controlled content to the approved version.
            await council_programmes.update_one(
                {"programme_id": pid},
                {"$set": {**fields, "status": "PUBLISHED", "content_status": "SEED_DEVELOPMENT",
                          "is_seed": True, "disclaimer": SEED_DISCLAIMER, "updated_at": now}},
            )
        else:
            pid = await _next_id("CouncilProgramme")
            await council_programmes.insert_one({
                "programme_id": pid,
                "seed_key": s["seed_key"],
                "slug": _slugify(s["name"]),
                "status": "PUBLISHED",            # selectable in the wizard
                "content_status": "SEED_DEVELOPMENT",
                "is_seed": True,
                "disclaimer": SEED_DISCLAIMER,
                "created_at": now,
                "updated_at": now,
                **fields,
            })
            ipid = await _next_id("ProgrammeIPMetadata")
            await programme_ip_metadata.insert_one({
                "ip_metadata_id": ipid,
                "programme_id": pid,
                "guru_background_ip": None,        # kept distinct; not invented
                "programme_ip_owner": "NOSTOPS Council (development seed)",
                "licensing": None,
                "royalty_arrangement": None,       # NO hard-coded commercial percentages
                "is_seed": True,
                "created_at": now,
            })
        # Ensure the APPROVED ProgrammeVersion snapshot exists (immutable; one per
        # programme+version). This is what new events pin themselves to.
        ver = fields["version"]
        existing_pv = await programme_versions.find_one({"programme_id": pid, "version": ver})
        if not existing_pv:
            pvid = await _next_id("ProgrammeVersion")
            await programme_versions.insert_one({
                "programme_version_id": pvid,
                "programme_id": pid,
                "version": ver,
                "status": "APPROVED",
                "is_seed": True,
                "snapshot": dict(fields),          # full Council content, frozen
                "created_at": now,
            })
    await platform_config.update_one(
        {"_id": "singleton"},
        {"$set": {"seed_version": SEED_VERSION, "seeded_at": now}},
        upsert=True,
    )


def _public_programme(doc: dict) -> dict:
    return {
        "programme_id": doc.get("programme_id"),
        "slug": doc.get("slug"),
        "name": doc.get("name"),
        "taxonomy": doc.get("taxonomy"),
        "taxonomy_label": doc.get("taxonomy_label"),
        "taxonomy_slug": doc.get("taxonomy_slug"),
        "essence": doc.get("essence"),
        "objectives": doc.get("objectives") or [],
        "default_duration_minutes": doc.get("default_duration_minutes"),
        "level": doc.get("level"),
        # Prompt 3 — Council-controlled recommendation fields.
        "recommended_audience": doc.get("recommended_audience") or [],
        "recommended_group_size": doc.get("recommended_group_size"),
        "recommended_frequency": doc.get("recommended_frequency"),
        "recommended_duration_label": doc.get("recommended_duration_label"),
        "languages": doc.get("languages") or [],
        "teacher_competency_requirements": doc.get("teacher_competency_requirements") or [],
        "council_attribution": doc.get("council_attribution"),
        "guru_attribution": doc.get("guru_attribution"),
        "provenance": doc.get("provenance"),
        "version": doc.get("version"),
        "content_status": doc.get("content_status"),
        "is_seed": bool(doc.get("is_seed")),
        "disclaimer": doc.get("disclaimer"),
        "council_curated": True,
    }


@router.get("/programmes")
async def list_programmes(
    taxonomy: Optional[str] = Query(None),
    _: bool = Depends(require_secret),
) -> dict:
    """Council-curated programme catalogue grouped/filtered by taxonomy
    (MIND/BODY/SPECIAL_NEEDS). Non-PII Council knowledge — secret-gated read."""
    await _ensure_seed()
    q: dict = {"status": "PUBLISHED"}
    if taxonomy:
        t = taxonomy.strip().upper().replace(" ", "_").replace("-", "_")
        if t not in TAXONOMY:
            raise HTTPException(status_code=400, detail="invalid taxonomy")
        q["taxonomy"] = t
    docs = await council_programmes.find(q).sort("name", 1).to_list(length=200)
    items = [_public_programme(d) for d in docs]
    groups = {t: [i for i in items if i["taxonomy"] == t] for t in (TAX_MIND, TAX_BODY, TAX_SPECIAL_NEEDS)}
    return {
        "programmes": items,
        "count": len(items),
        "by_taxonomy": groups,
        "taxonomy": [{"key": k, "label": TAXONOMY_LABELS[k], "slug": TAXONOMY_SLUGS[k]} for k in (TAX_MIND, TAX_BODY, TAX_SPECIAL_NEEDS)],
    }


@router.get("/programmes/{programme_id}")
async def get_programme(programme_id: str, _: bool = Depends(require_secret)) -> dict:
    await _ensure_seed()
    doc = await council_programmes.find_one({"programme_id": programme_id})
    if not doc:
        # also allow lookup by slug for public catalogue deep-links
        doc = await council_programmes.find_one({"slug": programme_id})
    if not doc:
        raise HTTPException(status_code=404, detail="not_found")
    return {"programme": _public_programme(doc)}


# ── Authorisation: Event Creator must be an ACTIVE authorised org member ──────
async def _membership(org_id: str, uid: str) -> Optional[dict]:
    return await org_members.find_one({"organisation_id": org_id, "user_id": uid, "status": "ACTIVE"})


def _can_create_events(mem: Optional[dict]) -> bool:
    if not mem:
        return False
    return bool(mem.get("event_creator")) or mem.get("member_role") in {MEMBER_OWNER, MEMBER_ADMIN}


async def _authorise_event_creator(org_id: str, user: dict) -> dict:
    mem = await _membership(org_id, str(user.get("user_id")))
    if not _can_create_events(mem):
        raise HTTPException(status_code=403, detail="not_an_authorised_event_creator")
    return mem


# ── Organisation update (details + logo) ──────────────────────────────────────
class OrganisationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    city: Optional[str] = None
    contact_email: Optional[str] = None
    contact_person: Optional[str] = Field(default=None, max_length=120)
    contact_phone: Optional[str] = Field(default=None, max_length=40)


@router.patch("/organisations/{organisation_id}")
async def update_organisation(
    organisation_id: str,
    body: OrganisationUpdate,
    user: dict = Depends(current_user),
) -> dict:
    """Update org profile (incl. logo_url — stored once on the reusable
    Organisation Profile). Authorised org members only."""
    _require_active()
    await _ensure()
    await _authorise_event_creator(organisation_id, user)
    doc = await organisations.find_one({"organisation_id": organisation_id})
    if not doc:
        raise HTTPException(status_code=404, detail="not_found")
    _validate_org_contact(body.contact_email, body.contact_phone)
    upd: dict = {"updated_at": _now()}
    if body.name is not None:
        upd["name"] = body.name.strip()
    if body.description is not None:
        upd["description"] = body.description.strip() or None
    if body.logo_url is not None:
        upd["logo_url"] = body.logo_url.strip() or None
    if body.website is not None:
        upd["website"] = body.website.strip() or None
    if body.contact_person is not None:
        upd["contact_person"] = body.contact_person.strip() or None
    if body.contact_phone is not None:
        upd["contact_phone"] = body.contact_phone.strip() or None
    if body.contact_email is not None:
        ce = body.contact_email.strip().lower() or None
        upd["contact_email"] = ce
        upd["email_domain"] = ce.split("@", 1)[1] if ce and "@" in ce else None
    if body.city is not None:
        cs = _city_slug(body.city)
        upd["primary_city"] = body.city.strip() or None
        upd["city_slug"] = cs
        upd["is_launch_city"] = cs in LAUNCH_CITY_SLUGS if cs else False
    await organisations.update_one({"organisation_id": organisation_id}, {"$set": upd})
    await _audit("Organisation", organisation_id, "ORGANISATION_UPDATED", user, {"fields": sorted(upd.keys())})
    out = await organisations.find_one({"organisation_id": organisation_id})
    return {"organisation": _public_org(out)}


# ── Events ────────────────────────────────────────────────────────────────────
class EventCreate(BaseModel):
    organisation_id: str
    programme_id: str
    title: str = Field(min_length=3, max_length=180)
    subtitle: Optional[str] = Field(default=None, max_length=240)
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = 60
    timezone: Optional[str] = DEFAULT_TIMEZONE
    city: Optional[str] = None
    venue: Optional[str] = None
    venue_type: Optional[str] = VENUE_EXISTING
    external_venue_cost: Optional[float] = None
    capacity: Optional[int] = None
    language: Optional[str] = "English"
    registration_closing_date: Optional[str] = None
    visibility: str = VIS_PRIVATE
    registration_access: Optional[str] = REG_OPEN
    pricing_type: Optional[str] = PRICING_FREE
    participant_fee: Optional[int] = Field(default=None, ge=0, le=1000000)  # configurable per-event INR fee (PAID only)
    programme_champion_member_id: Optional[str] = None
    schedule: Optional[ScheduleIn] = None                  # B2.2 — single session or a repeating programme


class EventUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    timezone: Optional[str] = None
    city: Optional[str] = None
    venue: Optional[str] = None
    venue_type: Optional[str] = None
    external_venue_cost: Optional[float] = None
    capacity: Optional[int] = None
    language: Optional[str] = None
    registration_closing_date: Optional[str] = None
    visibility: Optional[str] = None
    registration_access: Optional[str] = None
    pricing_type: Optional[str] = None
    participant_fee: Optional[int] = Field(default=None, ge=0, le=1000000)
    programme_champion_member_id: Optional[str] = None
    schedule: Optional[ScheduleIn] = None


async def _resolve_champion(org_id: str, member_id: Optional[str]) -> Optional[dict]:
    """Programme Champion = an authorised org member designated by the Event
    Creator (SEPARATE from the org's public contact). Returns internal-safe ref."""
    if not member_id:
        return None
    mem = await org_members.find_one({"organisation_id": org_id, "member_id": member_id})
    if not mem:
        raise HTTPException(status_code=400, detail="invalid_programme_champion")
    return {"member_id": mem["member_id"], "user_id": mem.get("user_id"),
            "name": mem.get("name"), "email": mem.get("email"), "role": mem.get("member_role")}


def _event_city(city: Optional[str]) -> tuple:
    cs = _city_slug(city)
    return (city.strip() if city else None, cs, (cs in LAUNCH_CITY_SLUGS) if cs else False)


def _parse_date(date_s: Optional[str]) -> Optional[_dt.date]:
    if not date_s:
        return None
    try:
        return _dt.datetime.strptime(date_s.strip()[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _validate_reg_close(event_date: Optional[str], reg_close: Optional[str]) -> None:
    """Prompt 3 §8 — the registration closing date cannot be AFTER the event
    start (date-level). Same-day closing is allowed."""
    rc = _parse_date(reg_close)
    evd = _parse_date(event_date)
    if rc and evd and rc > evd:
        raise HTTPException(status_code=400, detail="registration_closing_after_event_start")


def _normalise_venue_type(v: Optional[str]) -> str:
    vt = (v or VENUE_EXISTING).strip().upper()
    return vt if vt in VENUE_TYPES else VENUE_EXISTING


def _normalise_reg_access(v: Optional[str]) -> str:
    """Registration Access is SEPARATE from Event Visibility (§8). A PUBLIC event
    can still restrict who may register. Defaults to OPEN."""
    ra = (v or REG_OPEN).strip().upper()
    return ra if ra in REGISTRATION_ACCESS else REG_OPEN


def _normalise_pricing(v: Optional[str]) -> str:
    """§8 — FREE events bypass payment; PAID events require a Cashfree order
    (deferred until the pricing engine + Cashfree whitelist are live). Default FREE."""
    pt = (v or PRICING_FREE).strip().upper()
    return pt if pt in PRICING_TYPES else PRICING_FREE


def _economics_inputs(snap: dict, *, capacity, duration_minutes, city, venue_type,
                      external_venue_cost) -> dict:
    """Transparent ECONOMICS INPUTS (Prompt 3 §6/§7) — the variables that drive
    dynamic programme economics. NO price/percentage is computed or hard-coded
    here (final pricing is a later prompt); we only capture the inputs so the
    organisation can see what affects cost, incl. an external venue cost line."""
    external = venue_type == VENUE_EXTERNAL
    return {
        "group_size": capacity,                          # configurable; not a fixed group size
        "frequency": snap.get("recommended_frequency"),
        "duration_minutes": duration_minutes,
        "location": city,
        "venue_type": venue_type,
        "community_space_contribution": not external,    # existing space = contribution
        "external_venue_cost": external_venue_cost if external else None,
        "teacher_travel": "TBD",                          # resolved during teacher matching
        "programme_complexity": snap.get("taxonomy_label"),
        "pricing_status": "CALCULATED_BY_NOSTOPS",        # honest: no hard-coded price
    }


def _matching_inputs(snap: dict, *, language, city) -> dict:
    """Inputs the later teacher-matching prompt consumes (Prompt 3 §9 — the
    selected language becomes a matching input)."""
    return {
        "language": language,
        "city": city,
        "taxonomy": snap.get("taxonomy"),
        "programme_id": snap.get("programme_id"),
        "teacher_competency_requirements": snap.get("teacher_competency_requirements") or [],
    }


async def _programme_snapshot(programme_id: str) -> dict:
    """Freeze the programme's CURRENT approved content onto the event (Prompt 4
    §4). The event retains this exact snapshot + the programme_version_id and
    version string it was created against — a future Council change never
    rewrites a historical event."""
    prog = await council_programmes.find_one({"programme_id": programme_id})
    if not prog:
        raise HTTPException(status_code=400, detail="invalid_programme")
    ver = prog.get("version")
    # Pin to the programme's currently-approved version; fall back to latest.
    pv = await programme_versions.find_one({"programme_id": programme_id, "version": ver}) \
        or await programme_versions.find_one({"programme_id": programme_id}, sort=[("created_at", -1)])
    return {
        "programme_id": prog["programme_id"],
        "programme_version_id": pv.get("programme_version_id") if pv else None,
        "version": ver,
        "name": prog.get("name"),
        "taxonomy": prog.get("taxonomy"),
        "taxonomy_label": prog.get("taxonomy_label"),
        "taxonomy_slug": prog.get("taxonomy_slug"),
        "essence": prog.get("essence"),
        "objectives": prog.get("objectives") or [],
        "recommended_audience": prog.get("recommended_audience") or [],
        "recommended_group_size": prog.get("recommended_group_size"),
        "recommended_frequency": prog.get("recommended_frequency"),
        "recommended_duration_label": prog.get("recommended_duration_label"),
        "languages": prog.get("languages") or [],
        "teacher_competency_requirements": prog.get("teacher_competency_requirements") or [],
        "council_attribution": prog.get("council_attribution"),
        "level": prog.get("level"),
        "content_status": prog.get("content_status"),
        "council_curated": True,
        "snapshotted_at": _now(),
    }


def _owner_event(doc: dict) -> dict:
    out = _clean(dict(doc)) or {}
    out["lifecycle_effective"] = _effective_lifecycle(doc)
    out["completed_retention_until"] = _retention_until(doc)
    # §8 — defaults for events created before registration fields existed.
    out.setdefault("registration_access", REG_OPEN)
    out.setdefault("pricing_type", PRICING_FREE)
    # §1 — surface the accurate teacher state; NEVER present an unconfirmed offer
    # as a teacher (the org only sees a name once the teacher has accepted).
    state = _teacher_state(doc)
    out["teacher_state"] = state
    out["teacher_state_label"] = TEACHER_STATE_LABELS.get(state) if state else None
    out["teacher_confirmed"] = state == "TEACHER_CONFIRMED"
    out["schedule_label"] = _schedule_label(doc)
    if state != "TEACHER_CONFIRMED":
        out["assigned_teacher"] = None
    return out


@router.post("/events")
async def create_event(body: EventCreate, user: dict = Depends(current_user)) -> dict:
    """Create a DRAFT event. Council knowledge is snapshotted from the programme
    (org cannot rewrite it). Authorised org Event Creator only."""
    _require_active()
    await _ensure_seed()
    mem = await _authorise_event_creator(body.organisation_id, user)
    org = await organisations.find_one({"organisation_id": body.organisation_id})
    if not org:
        raise HTTPException(status_code=404, detail="organisation_not_found")
    vis = (body.visibility or VIS_PRIVATE).strip().upper()
    if vis not in EVENT_VISIBILITY:
        raise HTTPException(status_code=400, detail="invalid_visibility")
    schedule, session_dates = _build_schedule(body.schedule, body.event_date)
    # A repeating programme has no single closing date — each session closes itself.
    reg_close = None if schedule else (body.registration_closing_date or None)
    _validate_reg_close(body.event_date, reg_close)
    snap = await _programme_snapshot(body.programme_id)
    champion = await _resolve_champion(body.organisation_id, body.programme_champion_member_id)
    city_name, city_slug, is_launch = _event_city(body.city)
    venue_type = _normalise_venue_type(body.venue_type)
    ext_cost = body.external_venue_cost if venue_type == VENUE_EXTERNAL else None
    tz = (body.timezone or DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    language = (body.language or "English").strip() or "English"
    now = _now()
    event_id = await _next_id("Event")
    doc = {
        "event_id": event_id,
        "slug": None,  # assigned at publish
        "organisation_id": org["organisation_id"],
        "cohort_type": org.get("cohort_type"),
        "programme_id": body.programme_id,
        "programme_snapshot": snap,            # Council-controlled, frozen
        # Org-controlled presentation + logistics:
        "title": body.title.strip(),
        "subtitle": (body.subtitle or "").strip() or None,
        "event_date": body.event_date or None,
        "start_time": body.start_time or None,
        "end_time": body.end_time or None,
        "duration_minutes": body.duration_minutes or 60,
        "timezone": tz,
        "city": city_name,
        "city_slug": city_slug,
        "is_launch_city": is_launch,
        "venue": (body.venue or "").strip() or None,
        "venue_type": venue_type,
        "community_space_contribution": venue_type == VENUE_EXISTING,
        "external_venue_cost": ext_cost,
        "capacity": body.capacity,
        "language": language,
        "registration_closing_date": reg_close,
        "schedule": schedule,
        "last_session_date": session_dates[-1] if session_dates else None,
        "visibility": vis,
        "registration_access": _normalise_reg_access(body.registration_access),
        "pricing_type": _normalise_pricing(body.pricing_type),
        "participant_fee": int(body.participant_fee) if body.participant_fee else None,  # configurable, not hard-coded
        "programme_champion": champion,
        "preferred_teacher_id": None,          # reserved (teacher matching → Create Again prepopulation)
        "source_event_id": None,               # set when duplicated from another event
        # Transparent economics inputs + teacher-matching inputs (no price here).
        "economics_inputs": _economics_inputs(
            snap, capacity=body.capacity, duration_minutes=body.duration_minutes or 60,
            city=city_name, venue_type=venue_type, external_venue_cost=ext_cost),
        "matching_inputs": _matching_inputs(snap, language=language, city=city_name),
        "lifecycle": "DRAFT",
        "created_by": str(user.get("user_id")),
        "created_at": now,
        "updated_at": now,
        "published_at": None,
    }
    await events.insert_one(dict(doc))
    await _replace_sessions(event_id, session_dates)
    await _audit("Event", event_id, "EVENT_DRAFT_CREATED", user, {"organisation_id": org["organisation_id"]})
    return {"event": _owner_event(doc)}


@router.patch("/events/{event_id}")
async def update_event(event_id: str, body: EventUpdate, user: dict = Depends(current_user)) -> dict:
    _require_active()
    await _ensure()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    await _authorise_event_creator(ev["organisation_id"], user)
    # §8 — registration closing date cannot be after the (new or existing) event date.
    new_date = body.event_date if body.event_date is not None else ev.get("event_date")
    # B2.2 — schedule: re-validate the (new or stored) pattern against the start date.
    if body.schedule is not None:
        sched_in = body.schedule
    elif _is_recurring(ev):
        s = ev["schedule"]
        sched_in = ScheduleIn(type=SCHEDULE_RECURRING, sessions_per_week=s.get("sessions_per_week"),
                              weekdays=s.get("weekdays"), end_date=s.get("end_date"))
    else:
        sched_in = None
    schedule, session_dates = _build_schedule(sched_in, new_date)
    schedule_changed = schedule != (ev.get("schedule") or None) or (
        schedule is not None and new_date != ev.get("event_date"))
    if schedule_changed and ev.get("lifecycle") != "DRAFT":
        # Registrations point at individual sessions — never move them after publish.
        raise HTTPException(status_code=409, detail="schedule_locked_after_publish")
    new_regclose = body.registration_closing_date if body.registration_closing_date is not None else ev.get("registration_closing_date")
    if schedule:
        new_regclose = None
    _validate_reg_close(new_date, new_regclose)
    upd: dict = {"updated_at": _now()}
    simple = ["title", "subtitle", "event_date", "start_time", "end_time", "duration_minutes",
              "venue", "capacity", "language", "registration_closing_date", "timezone"]
    for f in simple:
        v = getattr(body, f)
        if v is not None:
            upd[f] = (v.strip() if isinstance(v, str) else v) or (None if isinstance(v, str) else v)
    if schedule_changed:
        upd["schedule"] = schedule
        upd["last_session_date"] = session_dates[-1] if session_dates else None
    if schedule:
        upd["registration_closing_date"] = None
    if body.visibility is not None:
        vis = body.visibility.strip().upper()
        if vis not in EVENT_VISIBILITY:
            raise HTTPException(status_code=400, detail="invalid_visibility")
        upd["visibility"] = vis
    if body.city is not None:
        city_name, city_slug, is_launch = _event_city(body.city)
        upd["city"], upd["city_slug"], upd["is_launch_city"] = city_name, city_slug, is_launch
    if body.venue_type is not None:
        upd["venue_type"] = _normalise_venue_type(body.venue_type)
        upd["community_space_contribution"] = upd["venue_type"] == VENUE_EXISTING
    if body.external_venue_cost is not None:
        upd["external_venue_cost"] = body.external_venue_cost
    if body.registration_access is not None:
        upd["registration_access"] = _normalise_reg_access(body.registration_access)
    # B2.3 — pricing is locked once published: participants pay (or have paid)
    # this fee, so it can't be switched, changed or cleared afterwards.
    if ev.get("lifecycle") != "DRAFT":
        pt_changed = body.pricing_type is not None and _normalise_pricing(body.pricing_type) != (
            ev.get("pricing_type") or PRICING_FREE)
        fee_changed = body.participant_fee is not None and body.participant_fee != ev.get("participant_fee")
        if pt_changed or fee_changed:
            raise HTTPException(status_code=409, detail="pricing_locked_after_publish")
    if body.pricing_type is not None:
        upd["pricing_type"] = _normalise_pricing(body.pricing_type)
    if body.participant_fee is not None:
        upd["participant_fee"] = int(body.participant_fee) or None
    if body.programme_champion_member_id is not None:
        upd["programme_champion"] = await _resolve_champion(ev["organisation_id"], body.programme_champion_member_id)
    await events.update_one({"event_id": event_id}, {"$set": upd})
    if schedule_changed:
        await _replace_sessions(event_id, session_dates)
    # Recompute the transparent economics + matching inputs from the merged event.
    merged = await events.find_one({"event_id": event_id})
    snap = merged.get("programme_snapshot") or {}
    vt = _normalise_venue_type(merged.get("venue_type"))
    ext_cost = merged.get("external_venue_cost") if vt == VENUE_EXTERNAL else None
    await events.update_one({"event_id": event_id}, {"$set": {
        "external_venue_cost": ext_cost,
        "economics_inputs": _economics_inputs(
            snap, capacity=merged.get("capacity"), duration_minutes=merged.get("duration_minutes") or 60,
            city=merged.get("city"), venue_type=vt, external_venue_cost=ext_cost),
        "matching_inputs": _matching_inputs(snap, language=merged.get("language") or "English", city=merged.get("city")),
    }})
    out = await events.find_one({"event_id": event_id})
    return {"event": _owner_event(out)}


@router.post("/events/{event_id}/publish")
async def publish_event(event_id: str, user: dict = Depends(current_user)) -> dict:
    """DRAFT → PUBLISHED. Validates required logistics, assigns an immutable
    public slug and an EventSEO record (indexable ONLY when visibility=PUBLIC)."""
    _require_active()
    await _ensure()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    await _authorise_event_creator(ev["organisation_id"], user)
    if ev.get("illustrative_only"):
        raise HTTPException(status_code=409, detail="illustrative_example_cannot_be_published")
    missing = [f for f in ("title", "event_date", "city", "visibility") if not ev.get(f)]
    # A repeating programme needs its end date (i.e. its generated sessions).
    if _is_recurring(ev) and not ev.get("last_session_date"):
        missing.append("end_date")
    if missing:
        raise HTTPException(status_code=400, detail={"error": "missing_required", "fields": missing})
    # §12/§13 — a PAID event needs a configurable participant fee before it can be
    # published (no hard-coded price; the organiser/NOSTOPS sets it per event).
    if ev.get("pricing_type") == PRICING_PAID and not (ev.get("participant_fee") and ev["participant_fee"] > 0):
        raise HTTPException(status_code=400, detail={"error": "paid_event_requires_fee"})
    # §6 — assign a human-readable slug ONCE, then keep it stable forever.
    if ev.get("slug"):
        slug = ev["slug"]
    else:
        base = _build_event_slug(ev["title"], ev.get("event_date"), event_id)
        slug = base
        # Guarantee uniqueness without ever mutating a historical URL.
        if await events.find_one({"slug": slug, "event_id": {"$ne": event_id}}):
            slug = f"{base}-{event_id[-6:].lower()}"
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    # §8 — guard the registration closing date at publish too.
    _validate_reg_close(ev.get("event_date"), ev.get("registration_closing_date"))
    # §10 — PUBLIC events are DISCOVERABLE on NOSTOPS, but eligible for SEARCH
    # INDEXING only AFTER the organisation is verified/validated. UNLISTED &
    # PRIVATE are never indexable.
    org_verified = bool(org and org.get("trust_state") == ORG_TRUST_VERIFIED)
    discovery_eligible = ev["visibility"] == VIS_PUBLIC
    indexable = discovery_eligible and org_verified
    now = _now()
    await events.update_one({"event_id": event_id}, {"$set": {
        "slug": slug, "lifecycle": "PUBLISHED", "published_at": now, "updated_at": now,
    }})
    seo_id = await _next_id("EventSEO")
    await event_seo.update_one(
        {"event_id": event_id},
        {"$set": {
            "event_id": event_id,
            "slug": slug,
            "meta_title": f"{ev['title']} · NOSTOPS",
            "meta_description": (ev.get("subtitle") or ev["programme_snapshot"].get("essence") or "")[:300],
            "indexable": indexable,
            "canonical_path": f"/events/{slug}",
            "og_image": (org or {}).get("logo_url"),
            "updated_at": now,
        }, "$setOnInsert": {"event_seo_id": seo_id, "created_at": now}},
        upsert=True,
    )
    await _audit("Event", event_id, "EVENT_PUBLISHED", user, {"visibility": ev["visibility"], "slug": slug})
    out = await events.find_one({"event_id": event_id})
    # §11 — auto-match the nearest empanelled teacher (best-effort; silent if none).
    try:
        await _auto_assign_teacher(out)
        out = await events.find_one({"event_id": event_id})
    except Exception as e:
        logger.error(f"auto-assign teacher failed for {event_id}: {e}")
    return {"event": _owner_event(out), "public_path": f"/events/{slug}", "indexable": indexable}


@router.get("/events")
async def list_my_events(user: dict = Depends(current_user)) -> dict:
    """Events across all orgs the caller is an authorised member of."""
    await _ensure()
    uid = str(user.get("user_id"))
    mems = await org_members.find({"user_id": uid, "status": "ACTIVE"}).to_list(length=500)
    org_ids = [m["organisation_id"] for m in mems if _can_create_events(m)]
    if not org_ids:
        return {"events": [], "count": 0}
    docs = await events.find({"organisation_id": {"$in": org_ids}}).sort("created_at", -1).to_list(length=500)
    return {"events": [_owner_event(d) for d in docs], "count": len(docs)}


@router.get("/events/{event_id}")
async def get_event_owner(event_id: str, user: dict = Depends(current_user)) -> dict:
    """Owner/member read (any visibility)."""
    await _ensure()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    mem = await _membership(ev["organisation_id"], str(user.get("user_id")))
    if not mem:
        raise HTTPException(status_code=404, detail="not_found")
    ev = await _maybe_complete(ev)
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    return {"event": _owner_event(ev), "organisation": _public_org(org) if org else None}


# ── Create Again (Prompt 3 §12 foundation) ───────────────────────────────────
@router.post("/events/{event_id}/duplicate")
async def duplicate_event(event_id: str, user: dict = Depends(current_user)) -> dict:
    """Duplicate a prior event into a NEW DRAFT (Create Again foundation). Copies
    organisation, programme (re-pinned to the CURRENT approved version), venue,
    language, group configuration, visibility, champion and preferred teacher —
    the creator only needs to set a new date/time. Authorised org member only."""
    _require_active()
    await _ensure()
    src = await events.find_one({"event_id": event_id})
    if not src:
        raise HTTPException(status_code=404, detail="not_found")
    await _authorise_event_creator(src["organisation_id"], user)
    snap = await _programme_snapshot(src["programme_id"])   # current approved version
    now = _now()
    new_id = await _next_id("Event")
    venue_type = _normalise_venue_type(src.get("venue_type"))
    ext_cost = src.get("external_venue_cost") if venue_type == VENUE_EXTERNAL else None
    doc = {
        "event_id": new_id,
        "slug": None,
        "organisation_id": src["organisation_id"],
        "cohort_type": src.get("cohort_type"),
        "programme_id": src["programme_id"],
        "programme_snapshot": snap,
        "title": src.get("title"),
        "subtitle": src.get("subtitle"),
        # Date/time intentionally cleared — the only thing the creator must re-set.
        "event_date": None,
        "start_time": None,
        "end_time": None,
        "duration_minutes": src.get("duration_minutes") or 60,
        "timezone": src.get("timezone") or DEFAULT_TIMEZONE,
        "city": src.get("city"),
        "city_slug": src.get("city_slug"),
        "is_launch_city": src.get("is_launch_city", False),
        "venue": src.get("venue"),
        "venue_type": venue_type,
        "community_space_contribution": venue_type == VENUE_EXISTING,
        "external_venue_cost": ext_cost,
        "capacity": src.get("capacity"),
        "language": src.get("language") or "English",
        "registration_closing_date": None,
        # Keep the repeating pattern (weekdays / per week); the dates are re-set.
        "schedule": ({**src["schedule"], "end_date": None, "session_count": 0} if _is_recurring(src) else None),
        "last_session_date": None,
        "visibility": src.get("visibility") or VIS_PRIVATE,
        "registration_access": _normalise_reg_access(src.get("registration_access")),
        "pricing_type": _normalise_pricing(src.get("pricing_type")),
        "programme_champion": src.get("programme_champion"),
        "preferred_teacher_id": src.get("preferred_teacher_id"),
        "source_event_id": src["event_id"],
        "economics_inputs": _economics_inputs(
            snap, capacity=src.get("capacity"), duration_minutes=src.get("duration_minutes") or 60,
            city=src.get("city"), venue_type=venue_type, external_venue_cost=ext_cost),
        "matching_inputs": _matching_inputs(snap, language=src.get("language") or "English", city=src.get("city")),
        "lifecycle": "DRAFT",
        "created_by": str(user.get("user_id")),
        "created_at": now,
        "updated_at": now,
        "published_at": None,
    }
    await events.insert_one(dict(doc))
    await _audit("Event", new_id, "EVENT_DUPLICATED", user, {"source_event_id": src["event_id"]})
    return {"event": _owner_event(doc)}


# ── Programme usage (Prompt 3 §13 — Council attribution foundation) ───────────
@router.get("/programmes/{programme_id}/usage")
async def programme_usage(programme_id: str, _: bool = Depends(require_secret)) -> dict:
    """Aggregate usage of a Council programme across events (non-PII). Lets the
    Council eventually attribute programme adoption. No participant data."""
    await _ensure()
    total = await events.count_documents({"programme_id": programme_id})
    published = await events.count_documents({"programme_id": programme_id, "lifecycle": {"$ne": "DRAFT"}})
    drafts = await events.count_documents({"programme_id": programme_id, "lifecycle": "DRAFT"})
    orgs = await events.distinct("organisation_id", {"programme_id": programme_id})
    return {"programme_id": programme_id, "event_count": total, "published_count": published,
            "draft_count": drafts, "organisation_count": len(orgs)}


# ── Admin overview (Prompt 3 §13 — NOSTOPS Admin visibility) ──────────────────
@router.get("/admin/overview")
async def admin_overview(user: dict = Depends(current_user)) -> dict:
    """NOSTOPS Admin read of the institutional engine — organisations, events
    (INCLUDING drafts) and programme usage. Admin role only. No participant PII."""
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    await _ensure()
    orgs = await organisations.find({}).sort("created_at", -1).to_list(length=500)
    ev_docs = await events.find({}).sort("created_at", -1).to_list(length=1000)
    by_prog: dict = {}
    for e in ev_docs:
        by_prog.setdefault(e.get("programme_id"), {"programme_id": e.get("programme_id"),
                            "name": (e.get("programme_snapshot") or {}).get("name"), "count": 0})["count"] += 1
    return {
        "organisations": [_public_org(o) for o in orgs],
        "organisation_count": len(orgs),
        "events": [{
            "event_id": e.get("event_id"), "title": e.get("title"), "lifecycle": e.get("lifecycle"),
            "visibility": e.get("visibility"), "organisation_id": e.get("organisation_id"),
            "programme": (e.get("programme_snapshot") or {}).get("name"),
            "programme_version": (e.get("programme_snapshot") or {}).get("version"),
            "city": e.get("city"), "event_date": e.get("event_date"), "created_at": e.get("created_at"),
        } for e in ev_docs],
        "event_count": len(ev_docs),
        "draft_count": sum(1 for e in ev_docs if e.get("lifecycle") == "DRAFT"),
        "programme_usage": sorted(by_prog.values(), key=lambda x: -x["count"]),
    }


# ── Admin platform settings (§5 — configurable teacher response window) ───────
class PlatformSettingsIn(BaseModel):
    teacher_response_window_hours: int = Field(ge=1, le=720)


@router.get("/admin/settings")
async def admin_settings(user: dict = Depends(current_user)) -> dict:
    """Read the configurable platform settings (admin-only). The teacher response
    window drives §5 offer expiry — NOT a hard-coded constant; a default applies
    only until an admin overrides it here."""
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    await _ensure()
    cfg = await platform_config.find_one({"_id": "singleton"}) or {}
    stored = cfg.get("teacher_response_window_hours")
    return {
        "teacher_response_window_hours": int(stored or DEFAULT_TEACHER_RESPONSE_WINDOW_HOURS),
        "teacher_response_window_default": DEFAULT_TEACHER_RESPONSE_WINDOW_HOURS,
        "is_default": stored is None,
    }


@router.patch("/admin/settings")
async def admin_update_settings(body: PlatformSettingsIn, user: dict = Depends(admin_only_user)) -> dict:
    """Update the configurable teacher response window (admin-only, 1–720h)."""
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    await _ensure()
    now = _now()
    hours = int(body.teacher_response_window_hours)
    await platform_config.update_one(
        {"_id": "singleton"},
        {"$set": {"teacher_response_window_hours": hours, "updated_at": now}},
        upsert=True,
    )
    await _audit("PlatformConfig", "singleton", "SETTINGS_UPDATED",
                 {"user_id": str(user.get("user_id")), "role": "admin"},
                 {"teacher_response_window_hours": hours})
    return {"ok": True, "teacher_response_window_hours": hours}


# ── Admin organisation verification (§10 — approved manual exception) ──────────
class OrgTrustIn(BaseModel):
    trust_state: str
    note: Optional[str] = Field(default=None, max_length=1000)


@router.patch("/admin/organisations/{organisation_id}/trust")
async def admin_set_org_trust(organisation_id: str, body: OrgTrustIn,
                              user: dict = Depends(admin_only_user)) -> dict:
    """§10 — NOSTOPS Admin approves an organisation's verification (the 'approved
    manual exception' mechanism) or adjusts its trust state. Admin-only. Only a
    VERIFIED organisation's PUBLIC events become search-indexable; the rest keep
    working through draft/private/unlisted flows."""
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    await _ensure()
    target = (body.trust_state or "").strip().upper()
    if target not in ORG_TRUST_STATES:
        raise HTTPException(status_code=400, detail="invalid_trust_state")
    org = await organisations.find_one({"organisation_id": organisation_id})
    if not org:
        raise HTTPException(status_code=404, detail="not_found")
    now = _now()
    await organisations.update_one(
        {"organisation_id": organisation_id},
        {"$set": {"trust_state": target, "trust_updated_at": now,
                  "trust_note": (body.note or "").strip() or None, "updated_at": now}})
    await _audit("Organisation", organisation_id, "ORG_TRUST_SET",
                 {"user_id": str(user.get("user_id")), "role": "admin"},
                 {"trust_state": target, "note": (body.note or "").strip() or None})
    return {"ok": True, "organisation_id": organisation_id, "trust_state": target}


# ── Coordinator city events (Prompt 3 §13 — operational record, NO approval) ──
@router.get("/coordinator/city-events")
async def coordinator_city_events(
    city: Optional[str] = Query(None),
    user: dict = Depends(current_user),
) -> dict:
    """A City Coordinator (or admin) may SEE institutional events in a city as an
    operational record. They do NOT approve events. Non-PII; no participant data."""
    role = str(user.get("role") or "").lower()
    if role not in {"coordinator", "admin"}:
        raise HTTPException(status_code=403, detail="coordinator_only")
    await _ensure()
    q: dict = {"lifecycle": {"$ne": "DRAFT"}}
    cs = _city_slug(city)
    if cs:
        q["city_slug"] = cs
    docs = await events.find(q).sort("event_date", 1).to_list(length=500)
    return {
        "city": city, "approval_required": False,
        "events": [{
            "event_id": e.get("event_id"), "title": e.get("title"), "city": e.get("city"),
            "programme": (e.get("programme_snapshot") or {}).get("name"),
            "event_date": e.get("event_date"), "visibility": e.get("visibility"),
            "lifecycle": e.get("lifecycle"), "slug": e.get("slug"),
            "flag": _flag_summary(e),
        } for e in docs],
        "count": len(docs),
    }


# ── Coordinator Alerts (Prompt 6 §14 — flag an at-risk event, NON-PII) ─────────
AT_RISK_REASONS = {"VENUE_PROBLEM", "TEACHER_AT_RISK", "LOW_TURNOUT", "SAFETY_CONCERN", "OTHER"}
AT_RISK_LABELS = {
    "VENUE_PROBLEM": "Venue problem", "TEACHER_AT_RISK": "Teacher at risk / no-show",
    "LOW_TURNOUT": "Low turnout risk", "SAFETY_CONCERN": "Safety concern", "OTHER": "Other",
}


def _flag_summary(e: dict) -> Optional[dict]:
    """Compact public-safe view of an event's coordinator flag (no PII)."""
    f = e.get("coordinator_flag")
    if not f or f.get("status") != "OPEN":
        return None
    return {"reason": f.get("reason"), "reason_label": AT_RISK_LABELS.get(f.get("reason"), f.get("reason")),
            "note": f.get("note"), "flagged_at": f.get("flagged_at"),
            "flagged_by_name": f.get("flagged_by_name"), "reference": f.get("reference"),
            "replies": [{"by_name": r.get("by_name"), "by_role": r.get("by_role"),
                         "message": r.get("message"), "created_at": r.get("created_at")}
                        for r in (f.get("replies") or [])]}


class EventFlagIn(BaseModel):
    reason: str
    note: str = Field(default="", max_length=1000)


@router.post("/coordinator/events/{event_id}/flag")
async def coordinator_flag_event(event_id: str, body: EventFlagIn,
                                 user: dict = Depends(current_user)) -> dict:
    """§14 — a City Coordinator flags an institutional event as at-risk. Notifies
    the organiser (org contact) + NOSTOPS care, and lands in the Admin escalation
    inbox. Only the event is referenced — never any participant data."""
    _require_active()
    role = str(user.get("role") or "").lower()
    if role not in {"coordinator", "admin"}:
        raise HTTPException(status_code=403, detail="coordinator_only")
    await _ensure()
    reason = (body.reason or "").strip().upper()
    if reason not in AT_RISK_REASONS:
        raise HTTPException(status_code=400, detail="invalid_reason")
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="event_not_found")
    note = (body.note or "").strip()
    eid = await _next_id("Escalation")
    flag = {
        "reason": reason, "note": note, "status": "OPEN", "reference": eid,
        "flagged_by": str(user.get("user_id")), "flagged_by_name": user.get("name"),
        "flagged_by_role": role, "flagged_at": _now(),
    }
    await events.update_one({"event_id": event_id}, {"$set": {"coordinator_flag": flag}})
    ctx = {"category": "AT_RISK_EVENT", "risk": True, "reason": reason, "status": "OPEN",
           "message": f"[{AT_RISK_LABELS.get(reason, reason)}] {note}".strip(),
           "event_id": event_id, "event_title": ev.get("title"), "event_city": ev.get("city"),
           "user_id": str(user.get("user_id")), "role": role, "name": user.get("name")}
    await _audit("Escalation", eid, "HUMAN_ESCALATION",
                 {"user_id": str(user.get("user_id")), "role": role}, ctx)
    # Notify organiser contact + NOSTOPS care — event reference only, no PII.
    org = await organisations.find_one({"organisation_id": ev.get("organisation_id")})
    when = " · ".join([x for x in [ev.get("event_date"), ev.get("start_time")] if x]) or "soon"
    body_html = (
        f'<p style="margin:0 0 8px"><strong>Risk flagged:</strong> {AT_RISK_LABELS.get(reason, reason)}</p>'
        f'<p style="margin:0 0 8px"><strong>Event:</strong> {ev.get("title")} ({ev.get("event_id")})</p>'
        f'<p style="margin:0 0 8px"><strong>When · Where:</strong> {when} · {ev.get("city") or "—"}</p>'
        f'<p style="margin:0 0 8px"><strong>Flagged by:</strong> City Coordinator {user.get("name") or ""}</p>'
        f'<p style="margin:0 0 8px"><strong>Reference:</strong> {eid}</p>'
        + (f'<p style="margin:12px 0 0;white-space:pre-wrap;line-height:1.5">{note}</p>' if note else '')
        + '<p style="margin:16px 0 0;color:#9ca3af;font-size:12px">Your city coordinator flagged this programme so we can help resolve it. No participant information is shared.</p>'
    )
    recipients = {NOSTOPS_SUPPORT_EMAIL}
    if org and org.get("contact_email"):
        recipients.add(org["contact_email"])
    for to in recipients:
        try:
            await send_email(to=to, subject=f"[At-risk event · {AT_RISK_LABELS.get(reason, reason)}] {ev.get('title')}",
                             html=_simple_email("An event was flagged as at-risk ⚠️", body_html))
        except Exception as e:
            logger.error(f"at-risk flag email to {to} failed: {e}")
    return {"ok": True, "reference": eid, "flag": _flag_summary({"coordinator_flag": flag})}


@router.post("/coordinator/events/{event_id}/flag/resolve")
async def coordinator_resolve_flag(event_id: str, user: dict = Depends(current_user)) -> dict:
    """§14 — clear an at-risk flag once handled. The coordinator who raised it (or
    an admin) may resolve. Closes the matching Admin-inbox ticket."""
    _require_active()
    role = str(user.get("role") or "").lower()
    if role not in {"coordinator", "admin"}:
        raise HTTPException(status_code=403, detail="coordinator_only")
    await _ensure()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="event_not_found")
    flag = ev.get("coordinator_flag")
    if not flag or flag.get("status") != "OPEN":
        raise HTTPException(status_code=400, detail="no_open_flag")
    if role != "admin" and flag.get("flagged_by") != str(user.get("user_id")):
        raise HTTPException(status_code=403, detail="not_flag_owner")
    await events.update_one({"event_id": event_id}, {"$set": {
        "coordinator_flag.status": "RESOLVED",
        "coordinator_flag.resolved_by": str(user.get("user_id")),
        "coordinator_flag.resolved_at": _now(),
    }})
    ref = flag.get("reference")
    if ref:
        await event_audit_log.update_one(
            {"entity_id": ref, "action": "HUMAN_ESCALATION"},
            {"$set": {"meta.status": "RESOLVED"}})
    return {"ok": True, "reference": ref}


class FlagReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.post("/events/{event_id}/flag/reply")
async def organiser_flag_reply(event_id: str, body: FlagReplyIn,
                               user: dict = Depends(current_user)) -> dict:
    """§14 — the ORGANISER (authorised event creator for the event's org; or admin)
    replies to a coordinator's at-risk flag with the fix / update. The reply is
    visible to the coordinator (on their events list) and to NOSTOPS (admin inbox)
    — all in-app. No participant data involved."""
    _require_active()
    await _ensure()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="event_not_found")
    role = str(user.get("role") or "").lower()
    if role != "admin":
        mem = await _membership(ev.get("organisation_id"), str(user.get("user_id")))
        if not _can_create_events(mem):
            raise HTTPException(status_code=403, detail="not_an_authorised_event_creator")
    flag = ev.get("coordinator_flag")
    if not flag:
        raise HTTPException(status_code=400, detail="no_flag")
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="message_required")
    reply = {"by": str(user.get("user_id")), "by_name": user.get("name"),
             "by_role": "admin" if role == "admin" else "organiser",
             "message": msg, "created_at": _now()}
    await events.update_one({"event_id": event_id}, {"$push": {"coordinator_flag.replies": reply}})
    ref = flag.get("reference")
    if ref:
        await event_audit_log.update_one(
            {"entity_id": ref, "action": "HUMAN_ESCALATION"},
            {"$set": {"meta.last_reply": msg, "meta.last_reply_by": user.get("name"),
                      "meta.last_reply_at": reply["created_at"]},
             "$inc": {"meta.reply_count": 1}})
    return {"ok": True, "reply": {"by_name": reply["by_name"], "by_role": reply["by_role"],
                                  "message": reply["message"], "created_at": reply["created_at"]}}


# ── Council Guru dashboard (Prompt 6 §12 — programme adoption, NON-PII) ───────
def _council_user(user: dict) -> None:
    """Council authority = council / guru / admin. Raises 403 otherwise."""
    role = str(user.get("role") or "").lower()
    if role not in {"council", "guru", "admin"}:
        raise HTTPException(status_code=403, detail="council_only")


@router.get("/council/programme-usage")
async def council_programme_usage(user: dict = Depends(current_user)) -> dict:
    """§12 — how the institutional engine is ADOPTING Council-curated programmes.
    Pure aggregate counts per programme (events / published / orgs / cities) +
    taxonomy rollup. NO participant data, NO organisation-private fields, NO PII
    — honours the anti-poaching ethos (a Guru sees adoption, never attendees)."""
    _council_user(user)
    await _ensure_seed()
    progs = await council_programmes.find({"status": "PUBLISHED"}).sort("name", 1).to_list(length=200)
    # One pass over events → per-programme aggregates.
    ev_docs = await events.find({}).to_list(length=2000)
    agg: dict = {}
    for e in ev_docs:
        pid = e.get("programme_id")
        if not pid:
            continue
        a = agg.setdefault(pid, {"events": 0, "published": 0, "drafts": 0, "orgs": set(), "cities": set()})
        a["events"] += 1
        if e.get("lifecycle") == "DRAFT":
            a["drafts"] += 1
        else:
            a["published"] += 1
        if e.get("organisation_id"):
            a["orgs"].add(e.get("organisation_id"))
        if e.get("city_slug"):
            a["cities"].add(e.get("city_slug"))
    items = []
    for p in progs:
        pid = p.get("programme_id")
        a = agg.get(pid, {"events": 0, "published": 0, "drafts": 0, "orgs": set(), "cities": set()})
        items.append({
            "programme_id": pid,
            "name": p.get("name"),
            "taxonomy": p.get("taxonomy"),
            "taxonomy_label": p.get("taxonomy_label"),
            "version": p.get("version"),
            "council_attribution": p.get("council_attribution"),
            "provenance": p.get("provenance"),
            "event_count": a["events"],
            "published_count": a["published"],
            "draft_count": a["drafts"],
            "organisation_count": len(a["orgs"]),
            "city_count": len(a["cities"]),
        })
    items.sort(key=lambda x: (-x["event_count"], x["name"] or ""))
    by_tax: dict = {}
    for it in items:
        t = it["taxonomy"]
        bt = by_tax.setdefault(t, {"taxonomy": t, "taxonomy_label": it["taxonomy_label"],
                                   "programme_count": 0, "event_count": 0})
        bt["programme_count"] += 1
        bt["event_count"] += it["event_count"]
    return {
        "programmes": items,
        "programme_count": len(items),
        "total_events": sum(it["event_count"] for it in items),
        "total_published": sum(it["published_count"] for it in items),
        "adopting_organisations": len({e.get("organisation_id") for e in ev_docs if e.get("organisation_id")}),
        "by_taxonomy": sorted(by_tax.values(), key=lambda x: -x["event_count"]),
        "council_attribution": COUNCIL_ATTRIBUTION,
    }


# ── §12 Council programme QUALITY intelligence (knowledge layer, NON-PII) ─────
_THEME_STOPWORDS = {
    "the", "and", "was", "were", "this", "that", "with", "have", "has", "had", "for",
    "very", "really", "just", "they", "them", "there", "here", "what", "when", "which",
    "will", "would", "could", "should", "been", "being", "from", "into", "than", "then",
    "your", "yours", "their", "ours", "about", "also", "some", "such", "more", "most",
    "much", "many", "good", "great", "nice", "well", "session", "class", "programme",
    "program", "yoga", "event", "today", "time", "lot", "like", "feel", "felt", "made",
    "make", "after", "before", "during", "because", "while", "overall", "thank", "thanks",
    "teacher", "instructor", "everyone", "everything", "something", "nothing",
}


def _themes_from_comments(comments: List[str], top_n: int = 8) -> List[dict]:
    """Deterministic, PII-free theme extraction: most frequent meaningful words
    across free-text comments (no identities, no AI, no commercial data)."""
    from collections import Counter
    cnt: Counter = Counter()
    for c in comments:
        for w in re.findall(r"[a-zA-Z]{4,}", (c or "").lower()):
            if w in _THEME_STOPWORDS:
                continue
            cnt[w] += 1
    return [{"theme": w, "count": n} for w, n in cnt.most_common(top_n)]


@router.get("/council/programme-quality")
async def council_programme_quality(user: dict = Depends(current_user)) -> dict:
    """§12 — programme-level QUALITY intelligence for Council Gurus: adoption,
    participation, attendance, repeat participation, participant + teacher ratings,
    anonymised feedback themes, city spread and a monthly trend. STRICTLY aggregate
    — never a participant identity or contact (the knowledge layer, not the CRM)."""
    _council_user(user)
    await _ensure()
    await _ensure_teacher()
    await _ensure_seed()
    progs = await council_programmes.find({"status": "PUBLISHED"}).sort("name", 1).to_list(length=200)
    ev_docs = await events.find({}).to_list(length=4000)
    ev_by_prog: dict = {}
    for e in ev_docs:
        ev_by_prog.setdefault(e.get("programme_id"), []).append(e)
    items = []
    for p in progs:
        pid = p.get("programme_id")
        pevs = [e for e in ev_by_prog.get(pid, []) if e.get("lifecycle") != "DRAFT"]
        event_ids = [e["event_id"] for e in pevs]
        orgs = {e.get("organisation_id") for e in pevs if e.get("organisation_id")}
        cities = {e.get("city") for e in pevs if e.get("city")}
        participation = attended = 0
        attendee_counts: dict = {}
        prating = trating = None
        prating_count = trating_count = 0
        themes: list = []
        tthemes: list = []
        if event_ids:
            regs = await registrations.find(
                {"event_id": {"$in": event_ids}, "booking_status": BOOKING_CONFIRMED}).to_list(length=50000)
            participation = len(regs)
            atts = await attendance.find(
                {"event_id": {"$in": event_ids}, "status": "PRESENT"}).to_list(length=50000)
            attended = len(atts)
            for at in atts:
                pidd = at.get("participant_id")
                if pidd:
                    attendee_counts[pidd] = attendee_counts.get(pidd, 0) + 1
            fbs = await feedback.find({"event_id": {"$in": event_ids}}).to_list(length=50000)
            prating_count = len(fbs)
            if fbs:
                prating = round(sum(int(f.get("rating") or 0) for f in fbs) / prating_count, 2)
                themes = _themes_from_comments([f.get("comment") for f in fbs if f.get("comment")])
            tfs = await teacher_feedback.find({"event_id": {"$in": event_ids}}).to_list(length=20000)
            trating_count = len(tfs)
            if tfs:
                trating = round(sum(int(f.get("rating") or 0) for f in tfs) / trating_count, 2)
                tthemes = _themes_from_comments([f.get("comment") for f in tfs if f.get("comment")])
        distinct_attendees = len(attendee_counts)
        repeat = sum(1 for _k, n in attendee_counts.items() if n >= 2)
        repeat_rate = round(repeat / distinct_attendees * 100, 1) if distinct_attendees else 0.0
        attendance_rate = round(attended / participation * 100, 1) if participation else 0.0
        trend: dict = {}
        for e in pevs:
            m = (e.get("event_date") or "")[:7]
            if m:
                trend.setdefault(m, {"month": m, "events": 0})["events"] += 1
        trend_list = sorted(trend.values(), key=lambda x: x["month"])[-6:]
        # §8 — read-only governance classification. Heuristic display signals that
        # help the Council identify programmes to celebrate or refine; they NEVER
        # mutate the Council-controlled programme knowledge/IP (no write path here).
        event_count = len(pevs)
        gov_signals: list = []
        if event_count > 0 and participation < 5:
            gov_signals.append("LOW_PARTICIPATION")
        if (prating is not None and prating < 3.5) or (participation >= 5 and attendance_rate < 50):
            gov_signals.append("NEEDS_REFINEMENT")
        if participation >= 10 and attendance_rate >= 80 and (prating is None or prating >= 4.0):
            gov_signals.append("PERFORMING_STRONGLY")
        if repeat_rate >= 40 and repeat >= 2:
            gov_signals.append("STRONG_REPEAT")
        if "PERFORMING_STRONGLY" in gov_signals:
            health = "STRONG"
        elif "NEEDS_REFINEMENT" in gov_signals:
            health = "NEEDS_REFINEMENT"
        elif "LOW_PARTICIPATION" in gov_signals:
            health = "LOW_PARTICIPATION"
        else:
            health = "STEADY"
        items.append({
            "programme_id": pid, "name": p.get("name"),
            "taxonomy": p.get("taxonomy"), "taxonomy_label": p.get("taxonomy_label"),
            "version": p.get("version"),
            "organisation_count": len(orgs), "event_count": len(pevs),
            "participation": participation, "attended": attended,
            "attendance_rate": attendance_rate,
            "distinct_attendees": distinct_attendees,
            "repeat_participation": repeat, "repeat_rate": repeat_rate,
            "participant_rating": prating, "participant_rating_count": prating_count,
            "participant_themes": themes,
            "teacher_rating": trating, "teacher_rating_count": trating_count,
            "teacher_themes": tthemes,
            "cities": sorted(c for c in cities if c),
            "trend": trend_list,
            "governance": {"health": health, "signals": gov_signals},
        })
    items.sort(key=lambda x: (-x["event_count"], -(x["participation"] or 0), x["name"] or ""))
    tot_part = sum(i["participation"] for i in items)
    tot_att = sum(i["attended"] for i in items)
    rated = [i for i in items if i["participant_rating"] is not None]
    overall_rating = round(sum(i["participant_rating"] for i in rated) / len(rated), 2) if rated else None
    gov_summary = {
        "performing_strongly": sum(1 for i in items if i["governance"]["health"] == "STRONG"),
        "needs_refinement": sum(1 for i in items if i["governance"]["health"] == "NEEDS_REFINEMENT"),
        "low_participation": sum(1 for i in items if i["governance"]["health"] == "LOW_PARTICIPATION"),
        "strong_repeat": sum(1 for i in items if "STRONG_REPEAT" in i["governance"]["signals"]),
    }
    return {
        "programmes": items,
        "programme_count": len(items),
        "total_events": sum(i["event_count"] for i in items),
        "total_participation": tot_part,
        "total_attended": tot_att,
        "overall_attendance_rate": round(tot_att / tot_part * 100, 1) if tot_part else 0.0,
        "overall_participant_rating": overall_rating,
        "adopting_organisations": len({e.get("organisation_id") for e in ev_docs
                                       if e.get("organisation_id") and e.get("lifecycle") != "DRAFT"}),
        "governance_summary": gov_summary,
        "governance_note": ("Read-only programme governance intelligence. Signals inform Council "
                            "refinement decisions; they never modify Council-curated programme knowledge."),
        "council_attribution": COUNCIL_ATTRIBUTION,
        "privacy_note": "Aggregate knowledge layer only — no participant identity or contact is ever shown.",
    }


# ── Admin escalation inbox (Prompt 6 §13 — human-escalation tickets) ──────────
@router.get("/admin/escalations")
async def admin_escalations(user: dict = Depends(current_user)) -> dict:
    """§13 — NOSTOPS Admin reads the §16 human-escalation tickets (logged in the
    append-only audit trail). Admin role only. Shows category / message / source
    role / reference — the operational record for support follow-up."""
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    await _ensure()
    docs = await event_audit_log.find({"action": "HUMAN_ESCALATION"}).sort("created_at", -1).to_list(length=300)
    rows = []
    open_count = 0
    for d in docs:
        meta = d.get("meta") or {}
        if (meta.get("status") or "OPEN") == "OPEN":
            open_count += 1
        rows.append({
            "reference": d.get("entity_id"),
            "category": meta.get("category") or "OTHER",
            "message": meta.get("message") or "",
            "event_id": meta.get("event_id"),
            "from_role": meta.get("role") or d.get("actor_role"),
            "from_name": meta.get("name"),
            "created_at": d.get("created_at"),
            "reply_count": int(meta.get("reply_count") or 0),
            "last_reply": meta.get("last_reply"),
            "last_reply_by": meta.get("last_reply_by"),
        })
    return {"escalations": rows, "count": len(rows), "open_count": open_count,
            "categories": sorted(ESCALATION_CATEGORIES)}


# ── Public event read (visibility-aware; PRIVATE never resolvable publicly) ───
def _registration_state(ev: dict, confirmed_count: int = 0) -> dict:
    """§8 — compute the live registration window + capacity for the public page.
    Registration Access is independent of SEO indexing/org verification: a PUBLIC
    or UNLISTED event (resolvable by slug) can accept registrations even when the
    organisation is not yet SEO-verified."""
    access = ev.get("registration_access") or REG_OPEN
    pricing = ev.get("pricing_type") or PRICING_FREE
    life = _effective_lifecycle(ev)
    capacity = ev.get("capacity")
    seats_remaining = None
    is_full = False
    if isinstance(capacity, int) and capacity > 0:
        seats_remaining = max(capacity - confirmed_count, 0)
        is_full = seats_remaining <= 0
    open_, reason = True, None
    if life not in {"PUBLISHED", "LIVE"}:
        open_, reason = False, "NOT_OPEN"
    elif access == REG_CLOSED:
        open_, reason = False, "CLOSED"
    elif access != REG_OPEN:
        open_, reason = False, "RESTRICTED"
    else:
        rc = _parse_date(ev.get("registration_closing_date"))
        if rc and _dt.datetime.utcnow().date() > rc:
            open_, reason = False, "CLOSED_DATE"
    if not open_:
        label = "Registration is restricted to invited participants" if reason == "RESTRICTED" else "Registration is closed"
    elif is_full:
        label = "Event is full — join the waitlist"
    elif pricing == PRICING_FREE:
        label = "Free · Open for registration"
    else:
        label = "Open for registration"
    return {
        "registration_access": access,
        "pricing_type": pricing,
        "is_free": pricing == PRICING_FREE,
        "registration_open": open_,
        "registration_closed_reason": reason,
        "seats_remaining": seats_remaining,
        "is_full": is_full,
        "confirmed_count": confirmed_count,
        "registration_status": label,
        "participant_fee": ev.get("participant_fee") if pricing == PRICING_PAID else None,
    }


def _public_event(ev: dict, org: Optional[dict], confirmed_count: int = 0,
                  sessions: Optional[list] = None) -> dict:
    """Public-safe event projection. NO participant data, NO champion PII, NO
    internal costs (anti-poaching + privacy). `sessions` (repeating programmes
    only) carries each session's date + seats left; capacity is per session."""
    verified = bool(org and org.get("trust_state") == ORG_TRUST_VERIFIED)
    snap = ev.get("programme_snapshot") or {}
    reg = _registration_state(ev, confirmed_count)
    if sessions is not None:
        upcoming = [s for s in sessions if not s["is_past"]]
        reg["seats_remaining"] = None
        reg["is_full"] = bool(upcoming) and all(s["is_full"] for s in upcoming)
        reg["confirmed_count"] = sum(s["confirmed"] for s in sessions)
        if reg["registration_open"] and not upcoming:
            reg.update(registration_open=False, registration_closed_reason="NO_UPCOMING_SESSIONS",
                       registration_status="Registration is closed")
        elif reg["registration_open"]:
            reg["registration_status"] = ("All upcoming sessions are full — join a waitlist" if reg["is_full"]
                                          else "Free · Register for each session" if reg["is_free"]
                                          else "Register for each session")
    # Demonstration (illustrative) events are never search-indexed (OEA-11).
    demo = bool((org or {}).get("is_demo_seeded")) or bool(ev.get("is_demo_seeded"))
    return {
        "event_id": ev.get("event_id"),
        "slug": ev.get("slug"),
        "title": ev.get("title"),
        "subtitle": ev.get("subtitle"),
        "cohort_type": ev.get("cohort_type"),
        "programme": {
            "name": snap.get("name"),
            "taxonomy": snap.get("taxonomy"),
            "taxonomy_label": snap.get("taxonomy_label"),
            "essence": snap.get("essence"),
            "objectives": snap.get("objectives") or [],
            "level": snap.get("level"),
            "recommended_audience": snap.get("recommended_audience") or [],
            "recommended_group_size": snap.get("recommended_group_size"),
            "recommended_frequency": snap.get("recommended_frequency"),
            "recommended_duration_label": snap.get("recommended_duration_label"),
            "languages": snap.get("languages") or [],
            "council_attribution": snap.get("council_attribution"),
            "provenance": snap.get("provenance") or "NOSTOPS Council",
            "version": snap.get("version"),
            "council_curated": True,
            "content_status": snap.get("content_status"),
        },
        "event_date": ev.get("event_date"),
        "start_time": ev.get("start_time"),
        "end_time": ev.get("end_time"),
        "duration_minutes": ev.get("duration_minutes"),
        "timezone": ev.get("timezone") or DEFAULT_TIMEZONE,
        "city": ev.get("city"),
        "city_slug": ev.get("city_slug"),
        "venue": ev.get("venue"),
        "venue_type": ev.get("venue_type") or VENUE_EXISTING,
        "community_space_contribution": bool(ev.get("community_space_contribution", ev.get("venue_type", VENUE_EXISTING) == VENUE_EXISTING)),
        "capacity": ev.get("capacity"),
        "language": ev.get("language"),
        "registration_closing_date": ev.get("registration_closing_date"),
        # B2.2 — repeating programme: pattern + every session (registration is per session).
        "schedule": ev.get("schedule"),
        "schedule_label": _schedule_label(ev),
        "last_session_date": ev.get("last_session_date"),
        "sessions": sessions,
        "visibility": ev.get("visibility"),
        "lifecycle": ev.get("lifecycle"),
        "lifecycle_effective": _effective_lifecycle(ev),
        "completed_retention_until": _retention_until(ev),
        "published_at": ev.get("published_at"),
        "organisation": {
            "name": (org or {}).get("name"),
            "logo_url": (org or {}).get("logo_url"),
            "description": (org or {}).get("description"),
            "verified": verified,
            "trust_state": (org or {}).get("trust_state"),
        } if org else None,
        # B4.7 — two SEPARATE facts: the teacher has accepted (confirmed), and the
        # teacher is verified (ID check passed + empanelled, `_match_eligible`, mirrored
        # on assigned_teacher.verified). Accepting an offer never implies verification.
        "teacher": ({"name": (ev.get("assigned_teacher") or {}).get("name"),
                     "handle": (ev.get("assigned_teacher") or {}).get("handle"),
                     "verified": _event_teacher_verified(ev)} if _teacher_publicly_confirmed(ev) else None),
        "teacher_confirmed": _teacher_publicly_confirmed(ev),
        "teacher_verified": _event_teacher_verified(ev),
        "teacher_status": ("Led by a NOSTOPS-verified teacher" if _event_teacher_verified(ev)
                           else "Teacher confirmed" if _teacher_publicly_confirmed(ev)
                           else "NOSTOPS teacher matching"),
        # §8 — live registration window + capacity (drives the public Register CTA).
        "registration_access": reg["registration_access"],
        "pricing_type": reg["pricing_type"],
        "is_free": reg["is_free"],
        "participant_fee": reg.get("participant_fee"),
        "registration_open": reg["registration_open"],
        "registration_closed_reason": reg["registration_closed_reason"],
        "seats_remaining": reg["seats_remaining"],
        "is_full": reg["is_full"],
        "confirmed_count": reg["confirmed_count"],
        "registration_status": reg["registration_status"],
        # SEO helpers (consumed by the public page metadata/JSON-LD).
        "canonical_path": f"/events/{ev.get('slug')}" if ev.get("slug") else None,
        "og_image": (org or {}).get("logo_url"),
        # §10 — PUBLIC = discoverable on NOSTOPS; search-indexable only once the
        # organisation is verified/validated. EVERGREEN stays indexable; ARCHIVED
        # is kept resolvable (never deleted) but drops out of index + discovery.
        "discovery_eligible": ev.get("visibility") == VIS_PUBLIC and _effective_lifecycle(ev) in {"PUBLISHED", "LIVE", "COMPLETED", "EVERGREEN"},
        "indexable": (ev.get("visibility") == VIS_PUBLIC
                      and _effective_lifecycle(ev) in {"PUBLISHED", "LIVE", "COMPLETED", "EVERGREEN"}
                      and verified and not demo),
        # Transparency — a tasteful "Demonstration" disclosure when the org/event
        # is part of the NOSTOPS public demonstration ecosystem (never "fake/test").
        "demo": demo,
        "demo_label": (org or {}).get("demo_label") or ev.get("demo_label"),
    }


@router.patch("/admin/events/{event_id}/lifecycle")
async def set_event_lifecycle(event_id: str, body: dict = Body(...), user: dict = Depends(current_user)) -> dict:
    """§7 — NOSTOPS Admin decides a COMPLETED public event's long-term fate:
    ARCHIVED (kept resolvable but de-indexed / out of discovery) or EVERGREEN
    (kept indexable). Completed public events are NEVER blindly deleted."""
    if str(user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    await _ensure()
    target = str(body.get("lifecycle") or "").strip().upper()
    if target not in {"ARCHIVED", "EVERGREEN"}:
        raise HTTPException(status_code=400, detail="invalid_lifecycle_target")
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    now = _now()
    await events.update_one({"event_id": event_id}, {"$set": {"lifecycle": target, "updated_at": now}})
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    verified = bool(org and org.get("trust_state") == ORG_TRUST_VERIFIED)
    indexable = ev.get("visibility") == VIS_PUBLIC and target == "EVERGREEN" and verified
    await event_seo.update_one({"event_id": event_id}, {"$set": {"indexable": indexable, "updated_at": now}})
    await _audit("Event", event_id, "EVENT_LIFECYCLE_SET", user, {"lifecycle": target})
    out = await events.find_one({"event_id": event_id})
    return {"event": _owner_event(out), "indexable": indexable}


@router.get("/public/events")
async def list_public_events(_: bool = Depends(require_secret)) -> dict:
    """Indexable PUBLIC events for the public sitemap (§5 sitemap inclusion).
    ONLY visibility=PUBLIC + published/evergreen + VERIFIED-org events are
    returned; UNLISTED/PRIVATE, ARCHIVED, unverified-org and DEMONSTRATION
    events are excluded (demo events are illustrative — never advertised to
    search engines, OEA-11)."""
    await _ensure()
    verified_org_ids = await organisations.distinct(
        "organisation_id", {"trust_state": ORG_TRUST_VERIFIED, "is_demo_seeded": {"$ne": True}})
    docs = await events.find({
        "visibility": VIS_PUBLIC,
        "lifecycle": {"$in": ["PUBLISHED", "LIVE", "COMPLETED", "EVERGREEN"]},
        "organisation_id": {"$in": verified_org_ids},
        "is_demo_seeded": {"$ne": True},
        "slug": {"$ne": None},
    }).sort("published_at", -1).to_list(length=1000)
    org_names = {o["organisation_id"]: o.get("name") async for o in organisations.find(
        {"organisation_id": {"$in": list({d["organisation_id"] for d in docs})}}, {"organisation_id": 1, "name": 1})}
    rows = [{
        "slug": d.get("slug"),
        "title": d.get("title"),
        "organisation_name": org_names.get(d["organisation_id"]),
        "city": d.get("city"),
        "event_date": d.get("event_date"),
        "updated_at": d.get("updated_at") or d.get("published_at"),
    } for d in docs]
    # Phase 5B — Space programmes use the Space-specific rule (live re-validation), never org verification.
    import space_programmes
    rows += [{"slug": d.get("slug"), "title": d.get("title"), "organisation_name": None, "host_kind": "SPACE",
              "space_name": (d.get("space_snapshot") or {}).get("name"), "city": d.get("city"),
              "event_date": d.get("event_date"), "updated_at": d.get("updated_at") or d.get("published_at")}
             for d in await space_programmes.public_space_events()]
    return {"events": rows, "count": len(rows)}


@router.get("/public/events/{slug}")
async def get_public_event(slug: str, _: bool = Depends(require_secret)) -> dict:
    """Public event page data. PUBLIC + UNLISTED resolve by slug (UNLISTED via
    direct link only); PRIVATE and unpublished DRAFTs are NOT publicly resolvable."""
    await _ensure()
    ev = await events.find_one({"slug": slug})
    if not ev:
        # Retired slugs (e.g. a demo event's earlier dated URL) still resolve; the
        # page then redirects to the canonical `slug` returned here (OEA-24).
        ev = await events.find_one({"slug_aliases": slug})
    if not ev or ev.get("lifecycle") == "DRAFT" or ev.get("visibility") == VIS_PRIVATE:
        raise HTTPException(status_code=404, detail="not_found")
    if ev.get("host_kind") == "SPACE":
        # Phase 5B — Space programmes: re-validate the live Space / enquiry / teacher / owner-approval
        # conditions on every public read; an invalid one is unavailable (record + audit kept).
        import space_programmes
        if await space_programmes.space_public_problems(ev):
            raise HTTPException(status_code=404, detail="not_found")
        sess = await _session_rows(ev) if _is_recurring(ev) else None
        return {"event": await space_programmes.public_space_projection(ev, _public_event(ev, None, 0, sess))}
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    if _is_recurring(ev):
        return {"event": _public_event(ev, org, 0, await _session_rows(ev))}
    confirmed = await registrations.count_documents({"event_id": ev["event_id"], "booking_status": BOOKING_CONFIRMED})
    return {"event": _public_event(ev, org, confirmed)}


@router.get("/public/showcase")
async def public_showcase(_: bool = Depends(require_secret)) -> dict:
    """Permanent public DEMONSTRATION showcase (Prompt 5). Returns the demo-seeded
    organisations grouped by the three institutional cohorts, each with their
    PUBLIC, published demonstration events — so a first-time visitor can SEE the
    NOSTOPS institutional model end to end. Clearly flagged as demonstration data
    (is_demo). No participant PII; no internal costs."""
    await _ensure()
    orgs = await organisations.find({"is_demo_seeded": True}).sort("created_at", 1).to_list(length=200)
    by_cohort: dict = {COHORT_COMPANY: [], COHORT_EDUCATIONAL: [], COHORT_STARTUP: []}
    for o in orgs:
        if not o.get("organisation_id"):
            logger.warning("showcase: skipping organisation without organisation_id: %s", o.get("_id"))
            continue
        evs = await events.find({"organisation_id": o["organisation_id"], "$or": [
            {"visibility": VIS_PUBLIC, "lifecycle": {"$in": ["PUBLISHED", "LIVE", "COMPLETED", "EVERGREEN"]},
             "slug": {"$ne": None}},
            # Illustrative examples: PRIVATE, unbookable, no public page, no teacher.
            {"illustrative_only": True, "is_demo_seeded": True},
        ]}).sort("event_date", 1).to_list(length=50)
        ev_views = []
        for ev in evs:
            snap = ev.get("programme_snapshot") or {}
            illustrative = bool(ev.get("illustrative_only"))
            tconf = False if illustrative else _teacher_publicly_confirmed(ev)
            ev_views.append({
                "slug": None if illustrative else ev.get("slug"), "title": ev.get("title"),
                "subtitle": ev.get("subtitle"),
                "programme_name": snap.get("name"), "taxonomy": snap.get("taxonomy"),
                "taxonomy_label": snap.get("taxonomy_label"),
                "city": ev.get("city"), "event_date": None if illustrative else ev.get("event_date"),
                "lifecycle": "ILLUSTRATIVE" if illustrative else _effective_lifecycle(ev),
                "illustrative_only": illustrative,
                "registration_access": ev.get("registration_access"),
                "registration_access_label": ("Not open for booking" if illustrative else
                                              REGISTRATION_ACCESS_LABELS.get(ev.get("registration_access") or REG_OPEN)),
                "teacher_name": (ev.get("assigned_teacher") or {}).get("name") if tconf else None,
                "teacher_confirmed": tconf,
                "teacher_verified": tconf and _event_teacher_verified(ev),
            })
        if o.get("cohort_type") in by_cohort:
            by_cohort[o["cohort_type"]].append({
                "organisation_id": o.get("organisation_id"), "name": o.get("name"),
                "short_name": o.get("short_name"), "slug": o.get("slug"),
                "cohort_type": o.get("cohort_type"), "city": o.get("primary_city"),
                "industry": o.get("industry"), "org_size": o.get("org_size"),
                "logo_url": o.get("logo_url"), "website": o.get("website"),
                "description": o.get("description"),
                "verified": o.get("trust_state") == ORG_TRUST_VERIFIED,
                "demo_label": o.get("demo_label"), "events": ev_views,
            })
    cohorts = [{"key": k, "label": COHORT_LABELS[k], "organisations": by_cohort[k]}
               for k in (COHORT_COMPANY, COHORT_EDUCATIONAL, COHORT_STARTUP)]
    return {"cohorts": cohorts, "organisation_count": len(orgs)}


# ══════════════════════════════════════════════════════════════════════════════
# §8 PARTICIPANT ENGINE — passwordless magic-link auth + event registration.
#
#   Register → email magic-link → authenticate → details → booking →
#   (payment only for PAID events; FREE events bypass) → confirmation → dashboard.
#
# Auth is SELF-CONTAINED in the institutional engine (local Mongo); it NEVER
# touches the remote business-auth backend. Participants are identified globally
# by email. Opaque, hashed, single-use magic links (20 min) issue opaque, hashed,
# revocable 30-day sessions. Pricing is FREE-only for now (the pricing engine +
# Cashfree land in a later prompt); the record already carries pricing_type /
# payment_status so PAID plugs in without a migration.
# ══════════════════════════════════════════════════════════════════════════════
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _utcnow() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc)


def _token_digest(raw: str) -> str:
    """HMAC-SHA256 with a server pepper — only digests are stored, never raw
    tokens, so a DB-only read cannot verify guessed tokens offline."""
    return hmac.new(TOKEN_PEPPER.encode(), (raw or "").encode(), hashlib.sha256).hexdigest()


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _norm_email(e: Optional[str]) -> str:
    return (e or "").strip().lower()


def _public_participant(p: Optional[dict]) -> Optional[dict]:
    if not p:
        return None
    return {
        "participant_id": p.get("participant_id"),
        "email": p.get("email"),
        "name": p.get("name"),
        "phone": p.get("phone"),
    }


def _participant_registration_view(r: dict, ev: Optional[dict], org: Optional[dict]) -> dict:
    ev = ev or {}
    snap = ev.get("programme_snapshot") or {}
    sdate = r.get("session_date")
    return {
        "registration_id": r.get("registration_id"),
        "event_id": r.get("event_id"),
        "event_slug": ev.get("slug"),
        "event_title": ev.get("title"),
        "event_subtitle": ev.get("subtitle"),
        # A session registration shows ITS session's date.
        "event_date": sdate or ev.get("event_date"),
        "session_id": r.get("session_id"),
        "session_date": sdate,
        "session_seq": r.get("session_seq"),
        "session_count": (ev.get("schedule") or {}).get("session_count") if r.get("session_id") else None,
        "session_past": bool(sdate and (_parse_date(sdate) or _local_today(ev)) < _local_today(ev)),
        "start_time": ev.get("start_time"),
        "end_time": ev.get("end_time"),
        "city": ev.get("city"),
        "venue": ev.get("venue"),
        "timezone": ev.get("timezone") or DEFAULT_TIMEZONE,
        "programme_name": snap.get("name"),
        "programme_taxonomy_label": snap.get("taxonomy_label"),
        "organisation_name": (org or {}).get("name"),
        "organisation_logo": (org or {}).get("logo_url"),
        "lifecycle_effective": _effective_lifecycle(ev) if ev else None,
        "registration_status": r.get("registration_status"),
        "booking_status": r.get("booking_status"),
        "payment_status": r.get("payment_status"),
        "pricing_type": r.get("pricing_type"),
        "amount": r.get("amount"),
        "currency": r.get("currency") or "INR",
        "payment_order_id": r.get("payment_order_id"),
        "participant_name": r.get("participant_name"),
        "participant_type": r.get("participant_type"),
        "created_at": r.get("created_at"),
    }


def _magic_html(name: Optional[str], event_title: str, link: str) -> str:
    """Server-side, form-free magic-link email. All links are absolute https to
    our own app (passes email_util._assert_safe_email guardrails)."""
    hi = f" {name}" if name else ""
    return (
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
        'max-width:480px;margin:0 auto;padding:24px;color:#232A4D">'
        '<h2 style="margin:0 0 12px;font-size:20px">Confirm your NOSTOPS registration</h2>'
        f'<p style="margin:0 0 8px;line-height:1.5">Namaste{hi}, you\'re one step away from '
        f'registering for <strong>{event_title}</strong>.</p>'
        '<p style="margin:16px 0">'
        f'<a href="{link}" style="display:inline-block;background:#0E7C7B;color:#ffffff;'
        'text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">'
        'Confirm my registration</a></p>'
        '<p style="margin:12px 0 0;color:#6b7280;font-size:13px;line-height:1.5">'
        'This secure link expires in 20 minutes and can be used once. '
        'If you did not request this, you can safely ignore this email.</p>'
        '<p style="margin:16px 0 0;color:#9ca3af;font-size:12px">NOSTOPS — A Teachers-First Yoga Cooperative.</p>'
        '</div>'
    )


# ── Participant auth dependency ───────────────────────────────────────────────
async def current_participant(
    x_pulse_secret: Optional[str] = Header(None),
    x_participant_session: Optional[str] = Header(None),
) -> dict:
    """Authenticate a participant from the opaque session token the BFF forwards
    as X-Participant-Session (server-only; never trusted from the browser). The
    shared secret proves the call came from our BFF."""
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    await _ensure_participant()
    raw = (x_participant_session or "").strip()
    if not raw or len(raw) > 512:
        raise HTTPException(status_code=401, detail="participant_unauthorized")
    sess = await participant_sessions.find_one({
        "session_hash": _token_digest(raw),
        "revoked_at": None,
        "expires_at": {"$gt": _utcnow()},   # expiry enforced in-query (TTL is eventual)
    })
    if not sess:
        raise HTTPException(status_code=401, detail="participant_unauthorized")
    p = await participants.find_one({"participant_id": sess["participant_id"]})
    if not p or p.get("status") == "BLOCKED":
        raise HTTPException(status_code=401, detail="participant_unauthorized")
    return p


# ── Models ────────────────────────────────────────────────────────────────────
class ParticipantRequestIn(BaseModel):
    email: str
    event_slug: Optional[str] = None
    session_id: Optional[str] = Field(default=None, max_length=80)
    name: Optional[str] = None


class ParticipantVerifyIn(BaseModel):
    token: str


class ParticipantRegisterIn(BaseModel):
    event_slug: Optional[str] = None
    event_id: Optional[str] = None
    session_id: Optional[str] = Field(default=None, max_length=80)   # required for a repeating programme
    name: str = Field(min_length=1, max_length=120)
    participant_type: Optional[str] = "OTHER"
    department: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=32)
    notes: Optional[str] = Field(default=None, max_length=500)
    # Payments Prompt 2C — required for a PAID event (the registration holds a place pending payment).
    billing_country: Optional[str] = Field(default=None, max_length=8)


# ── Endpoints ─────────────────────────────────────────────────────────────────
def _register_path(slug: Optional[str], session_id: Optional[str] = None) -> str:
    """Where a magic link lands: the event's register page (keeping the chosen
    session of a repeating programme), else the participant dashboard."""
    if not slug:
        return "/participant"
    return f"/events/{slug}/register" + (f"?session={session_id}" if session_id else "")


@router.post("/participant/auth/request")
async def participant_auth_request(body: ParticipantRequestIn, _: bool = Depends(require_secret)) -> dict:
    """Step 1 — a visitor submits their email to register for an event. We upsert
    the participant, issue a single-use magic link (20 min) and email it. The
    response is intentionally identical for new/returning emails (no enumeration)."""
    _require_active()
    await _ensure()
    await _ensure_participant()
    email = _norm_email(body.email)
    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(status_code=400, detail="invalid_email")

    intended_id = intended_slug = intended_session = None
    event_title = "a NOSTOPS programme"
    if body.event_slug:
        ev = await events.find_one({"slug": body.event_slug})
        if ev and ev.get("visibility") != VIS_PRIVATE and ev.get("lifecycle") != "DRAFT":
            intended_id, intended_slug = ev["event_id"], ev.get("slug")
            event_title = ev.get("title") or event_title
            if body.session_id and await event_sessions.find_one(
                    {"session_id": body.session_id, "event_id": ev["event_id"]}):
                intended_session = body.session_id

    now = _utcnow()
    p = await participants.find_one({"email": email})
    if not p:
        pid = await _next_id("Participant")
        p = {"participant_id": pid, "email": email, "name": (body.name or "").strip() or None,
             "phone": None, "status": "ACTIVE", "created_at": _now(), "updated_at": _now()}
        await participants.insert_one(dict(p))
    elif body.name and not p.get("name"):
        await participants.update_one({"participant_id": p["participant_id"]},
                                      {"$set": {"name": body.name.strip(), "updated_at": _now()}})

    # Invalidate any previous unredeemed links for this participant.
    await participant_magic.update_many(
        {"participant_id": p["participant_id"], "used_at": None},
        {"$set": {"used_at": now, "invalidated": "replaced"}},
    )
    raw = _new_token()
    await participant_magic.insert_one({
        "token_hash": _token_digest(raw),
        "participant_id": p["participant_id"],
        "email": email,
        "intended_event_id": intended_id,
        "intended_slug": intended_slug,
        "intended_session_id": intended_session,
        "created_at": now,
        "expires_at": now + _dt.timedelta(seconds=MAGIC_TTL_SECONDS),
        "used_at": None,
    })
    next_path = _register_path(intended_slug, intended_session)
    link = f"{SITE_URL}/participant/verify?token={raw}&next={quote(next_path, safe='/')}"
    try:
        await send_email(to=email, subject="Your NOSTOPS registration link",
                         html=_magic_html(p.get("name"), event_title, link))
        sent = True
    except Exception as e:  # never reveal delivery / existence details to the client
        logger.error(f"participant magic email failed: {e}")
        sent = False
    out: dict = {"ok": True, "sent": sent}
    if magic_debug():   # QA ONLY (PARTICIPANT_MAGIC_DEBUG=TRUE) — never in production
        out.update({"debug_token": raw, "debug_link": link, "debug_next": next_path})
    return out


@router.post("/participant/auth/verify")
async def participant_auth_verify(body: ParticipantVerifyIn, _: bool = Depends(require_secret)) -> dict:
    """Step 2 — redeem the magic link (atomically single-use) and issue an opaque
    30-day participant session token."""
    _require_active()
    await _ensure_participant()
    raw = (body.token or "").strip()
    if not raw or len(raw) > 512:
        raise HTTPException(status_code=400, detail="invalid_or_expired")
    now = _utcnow()
    # Atomic single-use: only the first concurrent request matches used_at:None.
    link = await participant_magic.find_one_and_update(
        {"token_hash": _token_digest(raw), "used_at": None, "expires_at": {"$gt": now}},
        {"$set": {"used_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if not link:
        raise HTTPException(status_code=400, detail="invalid_or_expired")
    session_raw = _new_token()
    await participant_sessions.insert_one({
        "session_hash": _token_digest(session_raw),
        "participant_id": link["participant_id"],
        "created_at": now,
        "expires_at": now + _dt.timedelta(seconds=PARTICIPANT_SESSION_TTL),
        "revoked_at": None,
    })
    p = await participants.find_one({"participant_id": link["participant_id"]})
    intended_slug = link.get("intended_slug")
    await _audit("Participant", link["participant_id"], "PARTICIPANT_AUTHENTICATED",
                 {"user_id": link["participant_id"], "role": "participant"}, {})
    return {
        "ok": True,
        "session_token": session_raw,
        "session_ttl": PARTICIPANT_SESSION_TTL,
        "participant": _public_participant(p),
        "intended_slug": intended_slug,
        "next": _register_path(intended_slug, link.get("intended_session_id")),
    }


@router.post("/participant/auth/logout")
async def participant_auth_logout(
    x_pulse_secret: Optional[str] = Header(None),
    x_participant_session: Optional[str] = Header(None),
) -> dict:
    """Revoke the current participant session (best-effort; always returns ok)."""
    if SECRET and x_pulse_secret and hmac.compare_digest(x_pulse_secret, SECRET) and x_participant_session:
        await _ensure_participant()
        await participant_sessions.update_one(
            {"session_hash": _token_digest(x_participant_session.strip())},
            {"$set": {"revoked_at": _utcnow()}},
        )
    return {"ok": True}


@router.get("/participant/me")
async def participant_me(p: dict = Depends(current_participant)) -> dict:
    return {"participant": _public_participant(p)}


@router.get("/participant/me/registrations")
async def participant_my_registrations(p: dict = Depends(current_participant)) -> dict:
    """The participant's OWN registrations only (anti-poaching: never another
    participant's or an org's full roster)."""
    rows = await registrations.find({"participant_id": p["participant_id"]}).sort("created_at", -1).to_list(length=500)
    out = []
    best_ids: dict = {}   # repeating programme → the one registration that carries feedback/certificate
    for r in rows:
        ev = await events.find_one({"event_id": r["event_id"]})
        org = await organisations.find_one({"organisation_id": ev["organisation_id"]}) if ev else None
        view = _participant_registration_view(r, ev, org)
        if _is_recurring(ev) and r["event_id"] not in best_ids:
            best, _ = await _best_registration(r["event_id"], p["participant_id"])
            best_ids[r["event_id"]] = (best or {}).get("registration_id")
        carries = not _is_recurring(ev) or best_ids.get(r["event_id"]) == r.get("registration_id")
        # §12 — surface feedback eligibility (COMPLETED events the participant attended/registered).
        life = view.get("lifecycle_effective")
        completed = life in {"COMPLETED", "EVERGREEN"}
        fb = await feedback.find_one({"event_id": r["event_id"], "participant_id": p["participant_id"]})
        att = await attendance.find_one({"event_id": r["event_id"], "registration_id": r.get("registration_id")})
        view["is_completed"] = completed
        view["attendance_status"] = (att or {}).get("status")
        view["feedback_given"] = bool(fb)
        view["feedback_rating"] = (fb or {}).get("rating")
        view["can_feedback"] = bool(carries and completed and not fb and r.get("booking_status") == BOOKING_CONFIRMED)
        # Completion certificate: COMPLETED event, confirmed, and not marked ABSENT.
        view["can_certificate"] = bool(
            carries and completed and r.get("booking_status") == BOOKING_CONFIRMED
            and (att or {}).get("status") != "ABSENT"
        )
        out.append(view)
    return {"registrations": out, "count": len(out)}


@router.post("/participant/register")
async def participant_register(body: ParticipantRegisterIn, p: dict = Depends(current_participant)) -> dict:
    """Step 3 — the authenticated participant confirms their booking. FREE events
    confirm immediately (payment bypassed); full events are WAITLISTED. The PAID
    path is structurally reserved (pricing engine + Cashfree are a later prompt)."""
    _require_active()
    await _ensure()
    await _ensure_participant()
    ev = None
    if body.event_id:
        ev = await events.find_one({"event_id": body.event_id})
    elif body.event_slug:
        ev = await events.find_one({"slug": body.event_slug})
    if not ev or ev.get("lifecycle") == "DRAFT" or ev.get("visibility") == VIS_PRIVATE:
        raise HTTPException(status_code=404, detail="event_not_found")
    if ev.get("host_kind") == "SPACE":  # Phase 5B — no registration for Space programmes (even FREE)
        raise HTTPException(status_code=409, detail="Registration isn't available for NOSTOPS Spaces programmes yet.")

    # B2.2 — a repeating programme is booked one SESSION at a time; capacity and
    # the waitlist apply to that session only.
    session = None
    if _is_recurring(ev):
        if not body.session_id:
            raise HTTPException(status_code=400, detail="Please choose a session to register for.")
        session = await event_sessions.find_one({"session_id": body.session_id, "event_id": ev["event_id"]})
        if not session:
            raise HTTPException(status_code=404, detail="session_not_found")
        if (_parse_date(session["date"]) or _local_today(ev)) < _local_today(ev):
            raise HTTPException(status_code=400,
                                detail={"error": "registration_closed", "reason": "SESSION_PAST"})
    sid = session["session_id"] if session else None

    confirmed = await registrations.count_documents({"event_id": ev["event_id"], "session_id": sid,
                                                     "booking_status": BOOKING_CONFIRMED})
    reg = _registration_state(ev, confirmed)
    if not reg["registration_open"]:
        raise HTTPException(status_code=400,
                            detail={"error": "registration_closed", "reason": reg["registration_closed_reason"]})

    # Payments Prompt 2C — a PAID registration holds a place pending payment, so the buyer's billing
    # country is checked BEFORE anything is written (India → Cashfree, INR only; no international
    # checkout exists yet). Refused → no registration, no profile change, no order.
    pricing = reg["pricing_type"]
    billing = {}
    if pricing == PRICING_PAID:
        import payment_routing  # noqa: E402 — local import keeps startup order unchanged
        d = payment_routing.decide("event_fee", body.billing_country)
        if not (d["allowed"] and d["provider"] == "cashfree" and d["currency"] == "INR"):
            raise HTTPException(status_code=d["status"] if not d["allowed"] else 503, detail={
                "error": (d["message"] or payment_routing.MESSAGES["provider_unavailable"]) + payment_routing.HOLD_SUFFIX,
                "reason": d["reason"], "routing_refused": True, "hold_refused": True})
        billing = {"billing_country": d["billing_country"]}

    ptype = (body.participant_type or "OTHER").strip().upper()
    if ptype not in PARTICIPANT_TYPES:
        ptype = "OTHER"
    name = body.name.strip()
    phone = (body.phone or "").strip() or None

    # Keep the participant profile fresh + tie to the org of their registration.
    await participants.update_one({"participant_id": p["participant_id"]}, {"$set": {
        "name": name, "phone": phone, "organisation_id": ev["organisation_id"], "updated_at": _now(),
    }})

    if pricing == PRICING_PAID:
        booking, reg_status, pay_status = BOOKING_PENDING_PAYMENT, "PENDING", PAY_PENDING
    elif reg["is_full"]:
        booking, reg_status, pay_status = BOOKING_WAITLISTED, "WAITLISTED", PAY_NOT_REQUIRED
    else:
        booking, reg_status, pay_status = BOOKING_CONFIRMED, "CONFIRMED", PAY_NOT_REQUIRED

    now = _now()
    # Snapshot the configured per-event fee onto the PAID registration (the
    # authoritative amount for checkout; the client never supplies a price).
    fee = int(ev["participant_fee"]) if (pricing == PRICING_PAID and ev.get("participant_fee")) else None
    fields = {
        "event_id": ev["event_id"],
        "session_id": sid,
        "session_date": session["date"] if session else None,
        "session_seq": session["seq"] if session else None,
        "organisation_id": ev["organisation_id"],
        "participant_id": p["participant_id"],
        "participant_email": p.get("email"),
        "participant_name": name,
        "participant_type": ptype,
        "department": (body.department or "").strip() or None,
        "phone": phone,
        "notes": (body.notes or "").strip() or None,
        "registration_status": reg_status,
        "booking_status": booking,
        "pricing_type": pricing,
        "payment_status": pay_status,
        "amount": fee,          # configurable per-event fee (None for FREE)
        "currency": "INR",
        "payment_order_id": None,
        "updated_at": now,
        **billing,
    }

    existing = await registrations.find_one({"event_id": ev["event_id"], "participant_id": p["participant_id"],
                                             "session_id": sid})
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    if existing:
        if existing.get("booking_status") != BOOKING_CANCELLED:
            # Idempotent — already registered / waitlisted / pending.
            return {"ok": True, "already_registered": True,
                    "registration": _participant_registration_view(existing, ev, org)}
        # Re-activate a previously cancelled registration (unique index forbids a 2nd row).
        await registrations.update_one({"registration_id": existing["registration_id"]}, {"$set": fields})
        doc = await registrations.find_one({"registration_id": existing["registration_id"]})
        await _audit("Registration", existing["registration_id"], "PARTICIPANT_REREGISTERED",
                     {"user_id": p["participant_id"], "role": "participant"}, {"event_id": ev["event_id"]})
        await _send_registration_confirmation(doc, ev, org, p)
        return {"ok": True, "registration": _participant_registration_view(doc, ev, org)}

    reg_id = await _next_id("Registration")
    doc = {"registration_id": reg_id, "created_at": now, **fields}
    try:
        await registrations.insert_one(dict(doc))
    except Exception:
        again = await registrations.find_one({"event_id": ev["event_id"], "participant_id": p["participant_id"],
                                              "session_id": sid})
        return {"ok": True, "already_registered": True,
                "registration": _participant_registration_view(again, ev, org)}
    await _audit("Registration", reg_id, "PARTICIPANT_REGISTERED",
                 {"user_id": p["participant_id"], "role": "participant"},
                 {"event_id": ev["event_id"], "booking_status": booking})
    # §16 — event confirmation email (best-effort; CONFIRMED or WAITLISTED).
    await _send_registration_confirmation(doc, ev, org, p)
    return {"ok": True, "registration": _participant_registration_view(doc, ev, org)}


# ── §12/§13 Institutional event PAID registration (Cashfree, server-only) ─────
# Reuses the existing remote Cashfree module (BFF → remote /payments/cashfree/
# orders). These endpoints are SHARED-SECRET only: the BFF derives the
# authoritative amount here (never from the client) and confirms the booking
# ONLY after it has re-verified the order is PAID with the gateway.
class PaymentIntentIn(BaseModel):
    registration_id: str = Field(min_length=3, max_length=64)


class PaymentAttachIn(BaseModel):
    registration_id: str = Field(min_length=3, max_length=64)
    order_id: str = Field(min_length=3, max_length=200)
    # Payments Prompt 2A — the routing decision (backend/payment_routing.py) the order was created under.
    routing_decision_id: Optional[str] = Field(default=None, max_length=64)
    billing_country: Optional[str] = Field(default=None, max_length=8)


class PaymentConfirmIn(BaseModel):
    order_id: str = Field(min_length=3, max_length=200)
    amount_paid: Optional[float] = None
    currency: Optional[str] = Field(default=None, max_length=8)
    reference_id: Optional[str] = Field(default=None, max_length=200)  # the order's reference (= registration id)


@router.post("/participant/payment/intent")
async def participant_payment_intent(body: PaymentIntentIn, _: bool = Depends(require_secret)) -> dict:
    """Authoritative payable amount for a PENDING_PAYMENT registration + the
    customer details to pass to Cashfree. Amount comes from the event's
    configured fee, NEVER from the client."""
    await _ensure()
    r = await registrations.find_one({"registration_id": body.registration_id})
    if not r:
        raise HTTPException(status_code=404, detail="registration_not_found")
    await _refuse_space_payment(r)
    if r.get("booking_status") == BOOKING_CONFIRMED:
        return {"ok": True, "already_confirmed": True,
                "amount": r.get("amount"), "currency": r.get("currency") or "INR"}
    if r.get("pricing_type") != PRICING_PAID or r.get("booking_status") != BOOKING_PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail="not_payable")
    # Prompt 3 — the canonical engine validates the snapshotted fee (whole rupees, 1 – 10,00,000).
    try:
        fee_minor = pricing_engine.event_fee_minor(r.get("amount"))
    except pricing_engine.PricingError:
        raise HTTPException(status_code=400, detail="fee_not_configured") from None
    pt = await participants.find_one({"participant_id": r.get("participant_id")}) or {}
    ev = await events.find_one({"event_id": r.get("event_id")}) or {}
    return {"ok": True, "amount": fee_minor // 100, "currency": r.get("currency") or "INR",
            "customer_name": r.get("participant_name") or pt.get("name"),
            "customer_email": r.get("participant_email") or pt.get("email"),
            "customer_phone": r.get("phone") or pt.get("phone"),
            "event_title": ev.get("title")}


@router.post("/participant/payment/attach-order")
async def participant_payment_attach(body: PaymentAttachIn, _: bool = Depends(require_secret)) -> dict:
    """Link the Cashfree order to its PENDING_PAYMENT registration before checkout."""
    await _ensure()
    await _refuse_space_payment(await registrations.find_one({"registration_id": body.registration_id}, {"event_id": 1}))
    bc = (body.billing_country or "").strip().upper() or None
    routing = ({"decision_id": body.routing_decision_id, "billing_country": bc, "provider": "cashfree"}
               if (body.routing_decision_id or bc) else None)
    res = await registrations.update_one(
        {"registration_id": body.registration_id, "booking_status": BOOKING_PENDING_PAYMENT},
        # Every order ever started is kept, so a payment on an earlier checkout is still matched.
        {"$set": {"payment_order_id": body.order_id, "updated_at": _now(), **({"payment_routing": routing} if routing else {})},
         "$addToSet": {"payment_order_ids": body.order_id}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="pending_registration_not_found")
    return {"ok": True}


async def _refuse_space_payment(r: Optional[dict]) -> None:
    """Phase 5B — no payment operation may run for a Space-linked programme."""
    if r and r.get("event_id"):
        ev = await events.find_one({"event_id": r["event_id"]}, {"host_kind": 1})
        if ev and ev.get("host_kind") == "SPACE":
            raise HTTPException(status_code=409, detail="Payments aren't available for NOSTOPS Spaces programmes.")


async def _audit_payment_once(rid: str, action: str, order_id: str, meta: dict) -> None:
    """One audit row per (registration, action, order) — duplicate deliveries add nothing."""
    if not await event_audit_log.find_one({"entity_id": rid, "action": action, "meta.order_id": order_id}):
        await _audit("Registration", rid, action, {"user_id": "system", "role": "engine"}, {"order_id": order_id, **meta})


@router.post("/participant/payment/confirm")
async def participant_payment_confirm(body: PaymentConfirmIn, _: bool = Depends(require_secret)) -> dict:
    """Confirm a PENDING_PAYMENT registration AFTER the BFF has re-verified with
    the gateway that the order is PAID. Matched by the Cashfree order_id (current or an
    earlier checkout); the paid amount + currency must equal the configured fee. Idempotent.
    P0 Decision 2: a verified payment that can't confirm a seat (registration no longer
    pending, or a second payment for a confirmed seat) is RECORDED for review, never lost."""
    await _ensure()
    oid = body.order_id
    r = await registrations.find_one({"$or": [{"payment_order_id": oid}, {"payment_order_ids": oid}]})
    if not r:
        raise HTTPException(status_code=404, detail="order_not_found")
    await _refuse_space_payment(r)
    rid = r["registration_id"]
    fee = float(r.get("amount") or 0)
    expected_ccy = str(r.get("currency") or "INR").upper()
    if (body.amount_paid is None or fee <= 0 or abs(float(body.amount_paid) - fee) > 0.01
            or str(body.currency or "").upper() != expected_ccy
            or (body.reference_id is not None and body.reference_id != rid)):
        await _audit("Registration", rid, "PARTICIPANT_PAYMENT_MISMATCH", {"user_id": "system", "role": "engine"},
                     {"order_id": oid, "amount_paid": body.amount_paid, "currency": body.currency,
                      "reference_id": body.reference_id})
        raise HTTPException(status_code=400, detail="amount_mismatch")
    if r.get("booking_status") == BOOKING_CONFIRMED:
        if r.get("paid_order_id") in (None, oid):
            return {"ok": True, "already_confirmed": True, "registration_id": rid}
        await _audit_payment_once(rid, "PARTICIPANT_DUPLICATE_PAYMENT", oid, {"amount_paid": body.amount_paid})
        return {"ok": True, "already_confirmed": True, "duplicate_payment": True, "registration_id": rid}
    if r.get("booking_status") != BOOKING_PENDING_PAYMENT:
        await _audit_payment_once(rid, "PARTICIPANT_PAYMENT_RECEIVED_NOT_PENDING", oid,
                                  {"amount_paid": body.amount_paid, "booking_status": r.get("booking_status")})
        raise HTTPException(status_code=409, detail="registration_not_pending")
    now = _now()
    res = await registrations.update_one(
        {"registration_id": rid, "booking_status": BOOKING_PENDING_PAYMENT},
        {"$set": {"booking_status": BOOKING_CONFIRMED, "registration_status": "CONFIRMED",
                  "payment_status": PAY_PAID, "paid_at": now, "paid_order_id": oid, "updated_at": now}})
    if res.modified_count:
        await _audit("Registration", rid, "PARTICIPANT_PAYMENT_CONFIRMED",
                     {"user_id": "system", "role": "engine"}, {"order_id": oid})
        ev = await events.find_one({"event_id": r.get("event_id")})
        org = await organisations.find_one({"organisation_id": r.get("organisation_id")})
        pt = await participants.find_one({"participant_id": r.get("participant_id")})
        doc = await registrations.find_one({"registration_id": rid})
        await _send_payment_receipt(doc, ev, org, oid)
    return {"ok": True, "registration_id": rid}


# ══════════════════════════════════════════════════════════════════════════════
# §11 TEACHER MATCHING · §12 ATTENDANCE & FEEDBACK · §16 REMINDERS
#
# Teachers are auto-matched to published events (nearest city, then least-loaded
# empanelled teacher). The assigned teacher sees a PII-lite roster (names + type,
# never email/phone — anti-poaching) and marks attendance on the event day.
# Participants rate COMPLETED events (1–5 + comment); organiser + assigned teacher
# see the aggregate. Scheduled jobs send a 24h-before reminder and a post-event
# thank-you/feedback email (idempotent; only fire on the deployed app).
# ══════════════════════════════════════════════════════════════════════════════
async def require_cron(
    authorization: Optional[str] = Header(None),
    x_pulse_secret: Optional[str] = Header(None),
) -> bool:
    """Scheduled jobs auth: the Emergent webhook-cron presents Bearer
    WEBHOOK_CRON_SECRET; internal/QA callers may use the engine shared secret."""
    if x_pulse_secret and SECRET and hmac.compare_digest(x_pulse_secret, SECRET):
        return True
    if authorization and WEBHOOK_CRON_SECRET and hmac.compare_digest(authorization, "Bearer " + WEBHOOK_CRON_SECRET):
        return True
    raise HTTPException(status_code=401, detail="unauthorized")


def _teacher_dir_view(d: Optional[dict]) -> Optional[dict]:
    if not d:
        return None
    return {"teacher_id": d.get("teacher_id"), "name": d.get("name"),
            "handle": d.get("handle"), "city": d.get("city"),
            "email": d.get("email"), "verified": _match_eligible(d)}


def _adaptive_verified(t: Optional[dict]) -> bool:
    """Verified adaptive-practice competence (required for SPECIAL NEEDS). Only an
    appropriately REVIEWED record counts: the flag AND who verified it and when
    (written only by the admin/Council endpoint). This single definition drives
    matching, the admin awaiting list and the public 1:1 badge."""
    return (bool(t) and t.get("adaptive_practice_verified") is True
            and bool(t.get("adaptive_practice_verified_by")) and bool(t.get("adaptive_practice_verified_at")))


def _split_pathways(values) -> tuple:
    """Validate declared pathways against the three canonical keys. Case and
    separators of a canonical key are normalised ('special_needs', 'Body',
    'special-needs'); anything else (e.g. 'SLEEP') is returned as invalid and
    is NEVER mapped onto a valid pathway."""
    valid: list = []
    invalid: list = []
    for x in values or []:
        raw = str(x).strip() if x is not None else ""
        if not raw:
            continue
        key = raw.upper().replace("-", "_").replace(" ", "_")
        if key in TAXONOMY:
            if key not in valid:
                valid.append(key)
        elif raw not in invalid:
            invalid.append(raw)
    return valid, invalid


def _is_special_needs(ev: Optional[dict]) -> bool:
    return ((ev or {}).get("programme_snapshot") or {}).get("taxonomy") == TAX_SPECIAL_NEEDS


_LEVEL_RANK = {"L1": 1, "L2": 2, "L3": 3, "SHIKSHAK": 1, "PRACHARAK": 2, "ACHARYA": 3,
               "L1 SHIKSHAK": 1, "L2 PRACHARAK": 2, "L3 ACHARYA": 3}


def _level_rank(level) -> int:
    return _LEVEL_RANK.get(str(level or "").strip().upper(), 0)


async def _select_teacher(ev: dict, skip: set) -> Optional[dict]:
    """§4 — pick the best ELIGIBLE teacher using the FULL matching criteria
    (programme eligibility, continuity, city, language, level, experience,
    performance, availability & fair load) — NOT merely the geographically
    nearest. Returns the chosen directory doc annotated with `_match_quality`,
    or None when no eligible teacher remains. MIND and BODY have NO taxonomy gate
    (a declared pathway is a ranking signal only); SPECIAL NEEDS adds the
    verified adaptive-practice gate."""
    active = {"$in": ["PROPOSED", "ACCEPTED", "CONFIRMED"]}
    org_id = ev.get("organisation_id")
    city_slug = ev.get("city_slug")
    language = (ev.get("language") or "").strip().lower()
    taxonomy = (ev.get("programme_snapshot") or {}).get("taxonomy")
    evdate = ev.get("event_date")
    # B4.7 — only teachers the main backend confirms as ID-checked AND empanelled
    # (never demo fixtures, never legacy auto-flagged rows) can be offered work.
    cands = await teacher_directory.find({"active": True, "empanelled": True, "id_verified": True,
                                          "status_source": STATUS_SOURCE_MAIN,
                                          "is_demo_seeded": {"$ne": True}}).to_list(length=1000)
    scored = []
    for t in cands:
        tid = t.get("teacher_id")
        if not tid or tid in skip:
            continue
        # §4 / Prompt-18 TEST D — city is a HARD eligibility gate for in-person
        # institutional delivery: only teachers in the event's city are eligible.
        # This prevents a FALSE out-of-city assignment when no local teacher exists
        # (matching then correctly returns None → TEACHER_UNAVAILABLE + escalation).
        # The richer criteria below still rank AMONG eligible in-city teachers, so
        # selection is never "merely geographic proximity".
        if city_slug and (t.get("city_slug") or "") != city_slug:
            continue
        # SPECIAL NEEDS — a HARD competence gate: only a teacher whose adaptive-
        # practice competence has been VERIFIED by NOSTOPS (admin/Council, never
        # self-declared) may be offered a Special Needs programme. When none is
        # eligible, matching returns None → TEACHER_UNAVAILABLE (safe fallback),
        # never an unqualified teacher.
        if taxonomy == TAX_SPECIAL_NEEDS and not _adaptive_verified(t):
            continue
        rating = t.get("rating")
        if rating is not None and rating < 3:                     # performance gate
            continue
        score = 0.0
        reasons = []
        cont = await teacher_assignments.count_documents(          # continuity with THIS org
            {"organisation_id": org_id, "teacher_id": tid, "status": {"$in": ["ACCEPTED", "CONFIRMED"]}})
        if cont:
            score += 100; reasons.append("CONTINUITY")
        if city_slug and t.get("city_slug") == city_slug:         # city / travel
            score += 40; reasons.append("CITY")
        langs = [str(x).strip().lower() for x in (t.get("languages") or [])]
        if language and language in langs:                        # language
            score += 20; reasons.append("LANGUAGE")
        if taxonomy and taxonomy in (t.get("taxonomies") or []):  # speciality / taxonomy
            score += 15; reasons.append("SPECIALITY")
        if taxonomy == TAX_SPECIAL_NEEDS:
            reasons.append("ADAPTIVE_VERIFIED")
        score += _level_rank(t.get("level")) * 5                  # teacher level
        score += min(int(t.get("experience_years") or 0), 20)     # experience
        inst_exp = await teacher_assignments.count_documents(      # institutional experience
            {"teacher_id": tid, "status": {"$in": ["ACCEPTED", "CONFIRMED"]}})
        score += min(inst_exp, 10) * 2
        if rating:                                                 # performance
            score += float(rating) * 6
        load = await teacher_assignments.count_documents(          # fair load / viability
            {"teacher_id": tid, "status": active})
        score -= load * 8
        scored.append((score, reasons, load, t))
    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], x[2]))
    for _score, reasons, _load, t in scored:                       # availability (no same-date clash)
        if evdate:
            others = await teacher_assignments.find(
                {"teacher_id": t["teacher_id"], "status": active,
                 "event_id": {"$ne": ev["event_id"]}}).to_list(length=200)
            clash = False
            for o in others:
                oev = await events.find_one({"event_id": o["event_id"]}, {"event_date": 1})
                if oev and oev.get("event_date") == evdate:
                    clash = True
                    break
            if clash:
                continue
        chosen = dict(t)
        chosen["_match_quality"] = "+".join(reasons) if reasons else "BEST_MATCH"
        return chosen
    return None


async def _auto_assign_teacher(ev: dict, exclude_teacher_ids: Optional[set] = None) -> Optional[dict]:
    """§1/§4 — OFFER the event to the best eligible teacher as a PROPOSED
    assignment (never auto-confirmed). Skips anyone who already declined. No-op
    when an active offer exists; flags teacher_search_exhausted when none remain."""
    await _ensure_teacher()
    if not ev or ev.get("lifecycle") == "DRAFT":
        return None
    # Phase 5B — Space-linked programmes are led by the teacher who created them: they are NEVER
    # offered to another teacher by any path (publish, directory sync, adaptive re-run, re-offer, cron).
    if ev.get("host_kind") == "SPACE" or ev.get("space_id"):
        return None
    # Demonstration events are never offered to real teachers (the demo seeder
    # matches them to demo teachers itself; illustrative examples stay unassigned).
    if ev.get("is_demo_seeded"):
        return None
    active = {"$in": ACTIVE_ASSIGNMENT_STATUSES}
    existing = await teacher_assignments.find_one({"event_id": ev["event_id"], "status": active})
    if existing:
        return existing
    declined = await teacher_assignments.distinct(
        "teacher_id", {"event_id": ev["event_id"], "status": {"$in": ["DECLINED", "REASSIGNED"]}})
    skip = set(declined) | set(exclude_teacher_ids or set())
    best = await _select_teacher(ev, skip)
    if not best:
        reason = "NO_VERIFIED_ADAPTIVE_TEACHER" if _is_special_needs(ev) else "NO_ELIGIBLE_TEACHER"
        await events.update_one({"event_id": ev["event_id"]},
                                {"$set": {"teacher_search_exhausted": True, "teacher_unavailable_reason": reason,
                                          "updated_at": _now()}})
        await _audit("Event", ev["event_id"], "TEACHER_UNAVAILABLE",
                     {"user_id": "system", "role": "engine"}, {"event_id": ev["event_id"], "reason": reason})
        return None
    quality = best.get("_match_quality") or "BEST_MATCH"
    now = _now()
    aid = await _next_id("TeacherAssignment")
    assignment = {
        "assignment_id": aid, "event_id": ev["event_id"], "organisation_id": ev["organisation_id"],
        "teacher_id": best["teacher_id"], "teacher_name": best.get("name"),
        "teacher_handle": best.get("handle"), "city_slug": ev.get("city_slug"),
        "match_quality": quality, "status": "PROPOSED", "matched_by": "AUTO_BEST_MATCH",
        "created_at": now, "updated_at": now,
    }
    await teacher_assignments.insert_one(dict(assignment))
    await events.update_one({"event_id": ev["event_id"]}, {"$set": {
        "assigned_teacher": {"teacher_id": best["teacher_id"], "name": best.get("name"),
                             "handle": best.get("handle"), "assignment_id": aid, "status": "PROPOSED",
                             "verified": _match_eligible(best)},
        "teacher_search_exhausted": False, "teacher_unavailable_reason": None, "updated_at": now,
    }})
    await _audit("TeacherAssignment", aid, "TEACHER_PROPOSED",
                 {"user_id": "system", "role": "engine"},
                 {"event_id": ev["event_id"], "teacher_id": best["teacher_id"], "quality": quality})
    if best.get("email"):
        try:
            await send_email(to=best["email"], subject="New NOSTOPS programme offer — please respond",
                             html=_teacher_match_html(best.get("name"), ev))
        except Exception as e:
            logger.error(f"teacher offer email failed: {e}")
    return assignment


class TeacherSyncIn(BaseModel):
    name: Optional[str] = None
    handle: Optional[str] = None
    city: Optional[str] = None
    email: Optional[str] = None
    # §4 — richer matching signals (optional; sent from the teacher's profile).
    level: Optional[str] = None
    languages: Optional[List[str]] = None
    specializations: Optional[List[str]] = None
    taxonomies: Optional[List[str]] = None
    experience_years: Optional[int] = None
    rating: Optional[float] = None
    # B4.7 — the MAIN backend's own status for this teacher, read server-side by the
    # BFF from /teachers/me/native-profile (never from the browser). Both must be
    # sent for the status to be recorded; omitted → stored status is left unchanged.
    empanelled: Optional[bool] = None
    id_verified: Optional[bool] = None


# ── SPECIAL NEEDS — verified adaptive-practice competence (admin / Council) ──
# Teachers can self-declare taxonomies, but the competence that unlocks Special
# Needs programmes is only ever set here, by NOSTOPS. Directory sync never
# touches these fields.
def _require_competence_reviewer(user: dict) -> None:
    if str(user.get("role") or "").lower() not in {"admin", "council"}:
        raise HTTPException(status_code=403, detail="admin_or_council_only")


class AdaptiveCompetenceIn(BaseModel):
    verified: bool
    note: Optional[str] = Field(default=None, max_length=500)


async def _special_needs_awaiting(directory_docs: list) -> list:
    """Upcoming, real (non-demo) SPECIAL NEEDS events with NO active offer held
    by a teacher who passes the verified adaptive-practice gate — i.e. events
    that still need an eligible teacher. Eligibility uses `_adaptive_verified`
    (reviewed record), never self-declared pathways."""
    by_id = {d.get("teacher_id"): d for d in directory_docs}
    eligible_by_city: dict = {}
    for d in directory_docs:
        if _match_eligible(d) and _adaptive_verified(d):
            eligible_by_city[d.get("city_slug") or ""] = eligible_by_city.get(d.get("city_slug") or "", 0) + 1
    today = _dt.date.today()
    evs = await events.find({"programme_snapshot.taxonomy": TAX_SPECIAL_NEEDS,
                             "lifecycle": {"$in": ["PUBLISHED", "LIVE"]},
                             "is_demo_seeded": {"$ne": True}}).sort("event_date", 1).to_list(length=1000)
    out = []
    for ev in evs:
        evd = _parse_date(ev.get("event_date"))
        if evd and evd < today:
            continue
        active = await teacher_assignments.find(
            {"event_id": ev["event_id"], "status": {"$in": ACTIVE_ASSIGNMENT_STATUSES}}).to_list(length=20)
        if any(_adaptive_verified(by_id.get(a.get("teacher_id"))) for a in active):
            continue
        org = await organisations.find_one({"organisation_id": ev.get("organisation_id")}, {"name": 1})
        n_city = eligible_by_city.get(ev.get("city_slug") or "", 0)
        out.append({
            "event_id": ev["event_id"], "title": ev.get("title"), "city": ev.get("city"),
            "event_date": ev.get("event_date"), "organisation_name": (org or {}).get("name"),
            "programme_name": (ev.get("programme_snapshot") or {}).get("name"),
            "verified_teachers_in_city": n_city,
            "status": ("OFFER_HELD_BY_UNVERIFIED_TEACHER" if active
                       else "NO_VERIFIED_TEACHER_IN_CITY" if n_city == 0
                       else "VERIFIED_TEACHERS_UNAVAILABLE"),
        })
    return out


@router.get("/admin/teacher-directory")
async def admin_teacher_directory(user: dict = Depends(current_user)) -> dict:
    _require_competence_reviewer(user)
    await _ensure_teacher()
    docs = await teacher_directory.find({"active": True}).sort("name", 1).to_list(length=1000)
    awaiting = await _special_needs_awaiting(docs)
    teachers = []
    for d in docs:
        valid, invalid = _split_pathways(d.get("taxonomies"))
        teachers.append({
            "teacher_id": d.get("teacher_id"), "name": d.get("name"), "handle": d.get("handle"),
            "city": d.get("city"), "taxonomies": valid, "invalid_taxonomies": invalid,
            "languages": d.get("languages") or [], "level": d.get("level"),
            "adaptive_practice_verified": _adaptive_verified(d),
            "adaptive_practice_verified_at": d.get("adaptive_practice_verified_at"),
            "adaptive_practice_note": d.get("adaptive_practice_note"),
            "is_demo": bool(d.get("is_demo_seeded")),
            # B4.7 — eligibility + legacy review flag, for admin review.
            "eligible_for_matching": _match_eligible(d),
            "status_source": d.get("status_source"),
            "status_review": d.get("status_review"),
        })
    return {"teachers": teachers, "special_needs_awaiting": awaiting,
            "special_needs_awaiting_count": len(awaiting)}


@router.get("/admin/special-needs-review")
async def admin_special_needs_review(user: dict = Depends(current_user)) -> dict:
    """READ-ONLY audit (admin / Council): active teachers who DECLARED the Special
    Needs pathway but hold no reviewed adaptive-practice verification record.
    Changes nothing — no profile, qualification or contact is touched here."""
    _require_competence_reviewer(user)
    await _ensure_teacher()
    docs = await teacher_directory.find({"active": True}).sort("name", 1).to_list(length=5000)
    revoked = set(await event_audit_log.distinct(
        "entity_id", {"entity_type": "TeacherDirectory", "action": "ADAPTIVE_COMPETENCE_REVOKED"}))
    rows = []
    for d in docs:
        valid, _invalid = _split_pathways(d.get("taxonomies"))
        if TAX_SPECIAL_NEEDS not in valid or _adaptive_verified(d):
            continue
        tid = d.get("teacher_id")
        status = ("FLAG_WITHOUT_REVIEW_RECORD" if d.get("adaptive_practice_verified") is True
                  else "REVOKED" if tid in revoked else "NOT_REVIEWED")
        rows.append({
            "teacher_id": tid, "name": d.get("name"), "handle": d.get("handle"), "city": d.get("city"),
            "level": d.get("level"), "declared_pathways": valid, "verification_status": status,
            "is_demo_seeded": bool(d.get("is_demo_seeded")),
        })
    return {"teachers": rows, "count": len(rows), "generated_at": _now()}


@router.get("/public/adaptive-verified")
async def public_adaptive_verified(_: bool = Depends(require_secret)) -> dict:
    """Handles of active teachers with a REVIEWED adaptive-practice verification
    record — powers the 1:1 'Adaptive practice verified' badge. Self-declared
    pathways and keyword matches never appear here."""
    await _ensure_teacher()
    docs = await teacher_directory.find(
        {"active": True, "adaptive_practice_verified": True, "handle": {"$nin": [None, ""]}},
        {"handle": 1, "adaptive_practice_verified": 1, "adaptive_practice_verified_by": 1,
         "adaptive_practice_verified_at": 1}).to_list(length=2000)
    handles = sorted({d["handle"] for d in docs if _adaptive_verified(d)})
    return {"handles": handles, "count": len(handles)}


@router.patch("/admin/teacher-directory/{teacher_id}/adaptive-practice")
async def admin_set_adaptive_competence(teacher_id: str, body: AdaptiveCompetenceIn,
                                        user: dict = Depends(competence_reviewer_user)) -> dict:
    """Record (or revoke) VERIFIED adaptive-practice competence for a teacher.
    On verification, unmatched upcoming Special Needs events are re-offered."""
    _require_competence_reviewer(user)
    await _ensure_teacher()
    d = await teacher_directory.find_one({"teacher_id": teacher_id})
    if not d:
        raise HTTPException(status_code=404, detail="teacher_not_found")
    now = _now()
    await teacher_directory.update_one({"teacher_id": teacher_id}, {"$set": {
        "adaptive_practice_verified": body.verified,
        "adaptive_practice_verified_at": now if body.verified else None,
        "adaptive_practice_verified_by": str(user.get("user_id")) if body.verified else None,
        "adaptive_practice_note": (body.note or "").strip() or None,
        "updated_at": now,
    }})
    await _audit("TeacherDirectory", teacher_id,
                 "ADAPTIVE_COMPETENCE_VERIFIED" if body.verified else "ADAPTIVE_COMPETENCE_REVOKED",
                 user, {"note": (body.note or "").strip() or None})
    matched = 0
    if body.verified:
        today = _dt.date.today()
        pending = await events.find({"lifecycle": "PUBLISHED", "assigned_teacher": None,
                                     "programme_snapshot.taxonomy": TAX_SPECIAL_NEEDS}).to_list(length=500)
        for ev in pending:
            evd = _parse_date(ev.get("event_date"))
            if evd and evd < today:
                continue
            a = await _auto_assign_teacher(ev)
            if a and a.get("teacher_id") == teacher_id:
                matched += 1
    return {"ok": True, "teacher_id": teacher_id, "adaptive_practice_verified": body.verified, "newly_matched": matched}


def _require_teacher(user: dict):
    if (user.get("role") or "").lower() != "teacher":
        raise HTTPException(status_code=403, detail="teacher_only")


@router.post("/teacher/directory/sync")
async def teacher_directory_sync(body: TeacherSyncIn, user: dict = Depends(current_user)) -> dict:
    """Register/refresh the signed-in teacher in the matchable directory, then
    auto-match them to still-unmatched published future events (city-first)."""
    _require_active()
    _require_teacher(user)
    await _ensure()
    await _ensure_teacher()
    tid = str(user.get("user_id"))
    now = _now()
    existing = await teacher_directory.find_one({"teacher_id": tid}, {"name": 1, "status_review": 1})
    # Only fields the caller actually SENT are written: an omitted field keeps
    # its stored value (a partial sync must never wipe pathways / languages /
    # level). Adaptive-practice competence is never touched here.
    # B4.7 — this sync NEVER grants empanelment or verification. It only records
    # the main backend's own status when the BFF supplies it.
    fields: dict = {"teacher_id": tid, "active": True, "updated_at": now,
                    "name": body.name or (existing or {}).get("name") or user.get("name") or "Teacher"}
    if body.empanelled is not None and body.id_verified is not None:
        # B4.8 — a reviewer's SUSPEND / REVOKE decision withdraws empanelment on our side.
        import trust_review
        withdrawn = bool(body.handle) and body.handle.strip() in await trust_review.withdrawn_handles()
        fields.update({"empanelled": bool(body.empanelled) and not withdrawn, "id_verified": bool(body.id_verified),
                       "status_source": STATUS_SOURCE_MAIN, "status_synced_at": now})
        review = (existing or {}).get("status_review") or {}
        if review and not review.get("resolved_at"):
            fields["status_review.resolved_at"] = now
            fields["status_review.resolution"] = "SYNCED_FROM_MAIN_BACKEND"
    if body.handle is not None:
        fields["handle"] = body.handle.strip() or None
    if body.city is not None:
        city = body.city.strip() or None
        fields["city"], fields["city_slug"] = city, _city_slug(city)
    if body.email is not None:
        fields["email"] = _norm_email(body.email) or None
    if body.level is not None:
        fields["level"] = body.level.strip() or None
    if body.languages is not None:
        fields["languages"] = [str(x).strip() for x in body.languages if str(x).strip()]
    if body.specializations is not None:
        fields["specializations"] = [str(x).strip() for x in body.specializations if str(x).strip()]
    rejected: list = []
    if body.taxonomies is not None:
        fields["taxonomies"], rejected = _split_pathways(body.taxonomies)
        fields["taxonomies_rejected"] = rejected
    if body.experience_years is not None:
        fields["experience_years"] = body.experience_years
    if body.rating is not None:
        fields["rating"] = body.rating
    on_insert = {k: v for k, v in {"created_at": now, "empanelled": False, "id_verified": False}.items()
                 if k not in fields}
    await teacher_directory.update_one({"teacher_id": tid}, {"$set": fields,
                                                              "$setOnInsert": on_insert}, upsert=True)
    # Keep the stored "verified" badge of this teacher's events in line with the rule.
    d_now = await teacher_directory.find_one({"teacher_id": tid})
    await events.update_many({"assigned_teacher.teacher_id": tid},
                             {"$set": {"assigned_teacher.verified": _match_eligible(d_now)}})
    today = _dt.date.today()
    matched = 0
    unassigned = await events.find({"lifecycle": "PUBLISHED", "assigned_teacher": None}).to_list(length=500)
    for ev in unassigned:
        evd = _parse_date(ev.get("event_date"))
        if evd and evd < today:
            continue
        a = await _auto_assign_teacher(ev)
        if a and a.get("teacher_id") == tid:
            matched += 1
    d = await teacher_directory.find_one({"teacher_id": tid})
    return {"teacher": _teacher_dir_view(d), "newly_matched": matched,
            "profile": {"taxonomies": d.get("taxonomies") or [], "languages": d.get("languages") or [],
                        "level": d.get("level"), "specializations": d.get("specializations") or [],
                        "experience_years": d.get("experience_years"),
                        "adaptive_practice_verified": _adaptive_verified(d)},
            "rejected_pathways": rejected}


def _teacher_assignment_view(a: dict, ev: Optional[dict], org: Optional[dict],
                             roster_count: int = 0, attended: int = 0, fb: Optional[dict] = None) -> dict:
    ev = ev or {}
    snap = ev.get("programme_snapshot") or {}
    return {
        "assignment_id": a.get("assignment_id"), "status": a.get("status"),
        "match_quality": a.get("match_quality"), "event_id": a.get("event_id"),
        "event_slug": ev.get("slug"), "event_title": ev.get("title"),
        "event_date": ev.get("event_date"), "start_time": ev.get("start_time"),
        "end_time": ev.get("end_time"), "city": ev.get("city"), "venue": ev.get("venue"),
        "timezone": ev.get("timezone") or DEFAULT_TIMEZONE, "programme_name": snap.get("name"),
        "programme_taxonomy_label": snap.get("taxonomy_label"),
        "programme_essence": snap.get("essence"),
        "organisation_name": (org or {}).get("name"),
        # §3 — the offer payload the teacher needs to decide.
        "capacity": ev.get("capacity"),
        "duration_minutes": ev.get("duration_minutes"),
        "language": ev.get("language"),
        "schedule_label": _schedule_label(ev),
        "session_count": (ev.get("schedule") or {}).get("session_count") if _is_recurring(ev) else None,
        "last_session_date": ev.get("last_session_date"),
        "venue_type": ev.get("venue_type"),
        "community_space_contribution": ev.get("community_space_contribution"),
        "economics": ev.get("economics_inputs"),
        "lifecycle_effective": _effective_lifecycle(ev) if ev else None,
        "roster_count": roster_count, "attended_count": attended, "feedback": fb,
    }


@router.get("/teacher/assignments")
async def teacher_assignments_list(user: dict = Depends(current_user)) -> dict:
    _require_active()
    _require_teacher(user)
    await _ensure_teacher()
    tid = str(user.get("user_id"))
    rows = await teacher_assignments.find(
        {"teacher_id": tid, "status": {"$in": ACTIVE_ASSIGNMENT_STATUSES}}
    ).sort("created_at", -1).to_list(length=500)
    out = []
    for a in rows:
        ev = await events.find_one({"event_id": a["event_id"]})
        if not ev:
            continue
        org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
        roster_count = await registrations.count_documents({"event_id": a["event_id"], "booking_status": BOOKING_CONFIRMED})
        attended = await attendance.count_documents({"event_id": a["event_id"], "status": "PRESENT"})
        out.append(_teacher_assignment_view(a, ev, org, roster_count, attended))
    return {"assignments": out, "count": len(out)}


async def _teacher_event_or_404(event_id: str, user: dict) -> tuple:
    tid = str(user.get("user_id"))
    a = await teacher_assignments.find_one({"event_id": event_id, "teacher_id": tid,
                                            "status": {"$in": ACTIVE_ASSIGNMENT_STATUSES}})
    if not a:
        raise HTTPException(status_code=404, detail="not_assigned")
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    return a, ev


@router.get("/teacher/events/{event_id}")
async def teacher_event_detail(event_id: str, user: dict = Depends(current_user)) -> dict:
    """Assigned teacher's view: event + roster (names + type ONLY, no contact
    PII — anti-poaching) + attendance state + feedback summary."""
    _require_active()
    _require_teacher(user)
    await _ensure_teacher()
    a, ev = await _teacher_event_or_404(event_id, user)
    ev = await _maybe_complete(ev)
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    regs = await registrations.find(
        {"event_id": event_id, "booking_status": {"$in": [BOOKING_CONFIRMED, BOOKING_WAITLISTED]}}
    ).sort([("session_seq", 1), ("created_at", 1)]).to_list(length=5000)
    roster = []
    for r in regs:
        att = await attendance.find_one({"event_id": event_id, "registration_id": r["registration_id"]})
        roster.append({
            "registration_id": r["registration_id"], "name": r.get("participant_name"),
            "participant_type": r.get("participant_type"), "booking_status": r.get("booking_status"),
            "attendance_status": (att or {}).get("status"),
            "session_id": r.get("session_id"), "session_date": r.get("session_date"),
            "session_seq": r.get("session_seq"),
        })
    life = _effective_lifecycle(ev)
    # Repeating programme — attendance opens per session, on that session's day.
    today = _local_today(ev)
    sessions = [{"session_id": s["session_id"], "seq": s["seq"], "date": s["date"],
                 "can_mark": life in {"LIVE", "COMPLETED"} and (_parse_date(s["date"]) or today) <= today}
                for s in (await _session_rows(ev) if _is_recurring(ev) else [])]
    fb = await _feedback_summary(event_id)
    tid = str(user.get("user_id"))
    my_tf = await teacher_feedback.find_one({"event_id": event_id, "teacher_id": tid})
    return {
        "assignment": _teacher_assignment_view(
            a, ev, org,
            roster_count=sum(1 for x in roster if x["booking_status"] == BOOKING_CONFIRMED),
            attended=sum(1 for x in roster if x["attendance_status"] == "PRESENT"), fb=fb),
        "can_mark_attendance": life in {"LIVE", "COMPLETED"},
        "assignment_status": a.get("status"),
        "can_respond": a.get("status") in {"PROPOSED", "ASSIGNED"},
        "can_give_feedback": life in {"LIVE", "COMPLETED", "EVERGREEN"},
        "my_feedback": ({"rating": my_tf.get("rating"), "comment": my_tf.get("comment")} if my_tf else None),
        "roster": roster,
        "sessions": sessions,
        "feedback": fb,
    }


class AttendanceEntry(BaseModel):
    registration_id: str
    status: str


class AttendanceIn(BaseModel):
    entries: List[AttendanceEntry]


@router.post("/teacher/events/{event_id}/attendance")
async def teacher_mark_attendance(event_id: str, body: AttendanceIn, user: dict = Depends(current_user)) -> dict:
    """Assigned teacher marks attendance (only once the event is LIVE/COMPLETED)."""
    _require_active()
    _require_teacher(user)
    await _ensure_teacher()
    a, ev = await _teacher_event_or_404(event_id, user)
    if _effective_lifecycle(ev) not in {"LIVE", "COMPLETED"}:
        raise HTTPException(status_code=400, detail="attendance_not_open")
    tid = str(user.get("user_id"))
    now = _now()
    today = _local_today(ev)
    updated = skipped = 0
    for e in body.entries:
        status = (e.status or "").strip().upper()
        if status not in ATTENDANCE_STATUSES:
            continue
        r = await registrations.find_one({"registration_id": e.registration_id, "event_id": event_id})
        if not r:
            continue
        # A future session of a repeating programme cannot be marked yet.
        if r.get("session_date") and (_parse_date(r["session_date"]) or today) > today:
            skipped += 1
            continue
        await attendance.update_one(
            {"event_id": event_id, "registration_id": e.registration_id},
            {"$set": {"status": status, "marked_by": tid, "updated_at": now, "participant_id": r.get("participant_id")},
             "$setOnInsert": {"attendance_id": await _next_id("Attendance"), "created_at": now}},
            upsert=True,
        )
        reg_status = "ATTENDED" if status == "PRESENT" else ("NO_SHOW" if status == "ABSENT" else r.get("registration_status"))
        await registrations.update_one({"registration_id": e.registration_id},
                                       {"$set": {"registration_status": reg_status, "updated_at": now}})
        updated += 1
    await _audit("TeacherAssignment", a["assignment_id"], "ATTENDANCE_MARKED",
                 {"user_id": tid, "role": "teacher"}, {"event_id": event_id, "count": updated})
    present = await attendance.count_documents({"event_id": event_id, "status": "PRESENT"})
    return {"ok": True, "updated": updated, "skipped_future": skipped, "present": present}


class TeacherRespondIn(BaseModel):
    action: str                                      # ACCEPT | DECLINE
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/teacher/events/{event_id}/respond")
async def teacher_respond_assignment(event_id: str, body: TeacherRespondIn,
                                     user: dict = Depends(current_user)) -> dict:
    """The offered teacher ACCEPTS or DECLINES. A decline is recorded and the
    engine auto-reassigns to the next-nearest eligible teacher (skipping anyone
    who already declined). When no teacher remains, the event is left unmatched
    (organiser sees 'being matched')."""
    _require_active()
    _require_teacher(user)
    await _ensure_teacher()
    tid = str(user.get("user_id"))
    action = (body.action or "").strip().upper()
    if action not in {"ACCEPT", "DECLINE"}:
        raise HTTPException(status_code=400, detail="invalid_action")
    a = await teacher_assignments.find_one(
        {"event_id": event_id, "teacher_id": tid, "status": {"$in": ["PROPOSED", "ASSIGNED"]}})
    if not a:
        raise HTTPException(status_code=404, detail="no_pending_assignment")
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    now = _now()
    if action == "ACCEPT" and _is_special_needs(ev) \
            and not _adaptive_verified(await teacher_directory.find_one({"teacher_id": tid})):
        # An offer made before the Special Needs competence gate existed must not
        # be confirmed by a teacher without VERIFIED adaptive-practice competence:
        # release it and re-route to an eligible teacher (or the safe fallback).
        await teacher_assignments.update_one({"assignment_id": a["assignment_id"]}, {"$set": {
            "status": "REASSIGNED", "reassign_reason": "ADAPTIVE_COMPETENCE_REQUIRED", "updated_at": now}})
        await events.update_one({"event_id": event_id, "assigned_teacher.assignment_id": a["assignment_id"]},
                                {"$set": {"assigned_teacher": None, "updated_at": now}})
        await _audit("TeacherAssignment", a["assignment_id"], "TEACHER_ACCEPT_BLOCKED_ADAPTIVE",
                     {"user_id": tid, "role": "teacher"}, {"event_id": event_id})
        await _auto_assign_teacher(await events.find_one({"event_id": event_id}))
        raise HTTPException(status_code=403, detail=(
            "This is a Special Needs programme. It needs verified adaptive-practice competence, "
            "so NOSTOPS has passed it to an eligible teacher. Contact NOSTOPS to get your competence verified."))
    if action == "ACCEPT":
        # §5 — atomically confirm ONLY if this offer is STILL the event's current
        # PROPOSED offer. Guarantees a single confirmed teacher per event: an offer
        # that was expired / withdrawn / reassigned in the meantime cannot be
        # back-confirmed (→ 409), so two teachers can never both be 'confirmed'.
        res = await events.update_one(
            {"event_id": event_id,
             "assigned_teacher.assignment_id": a["assignment_id"],
             "assigned_teacher.status": "PROPOSED"},
            {"$set": {"assigned_teacher.status": "ACCEPTED", "updated_at": now}})
        if res.modified_count == 0:
            raise HTTPException(status_code=409, detail="offer_no_longer_available")
        await teacher_assignments.update_one({"assignment_id": a["assignment_id"]},
            {"$set": {"status": "ACCEPTED", "responded_at": now, "updated_at": now}})
        await _audit("TeacherAssignment", a["assignment_id"], "TEACHER_ACCEPTED",
                     {"user_id": tid, "role": "teacher"}, {"event_id": event_id})
        return {"ok": True, "status": "ACCEPTED"}
    # DECLINE → record, then auto-reassign to the next-nearest teacher.
    await teacher_assignments.update_one({"assignment_id": a["assignment_id"]},
        {"$set": {"status": "DECLINED", "decline_reason": (body.reason or "").strip() or None,
                  "responded_at": now, "updated_at": now}})
    await _audit("TeacherAssignment", a["assignment_id"], "TEACHER_DECLINED",
                 {"user_id": tid, "role": "teacher"},
                 {"event_id": event_id, "reason": (body.reason or "").strip() or None})
    await events.update_one({"event_id": event_id},
                            {"$set": {"assigned_teacher": None, "teacher_declined_once": True, "updated_at": now}})
    fresh = await events.find_one({"event_id": event_id})
    nxt = await _auto_assign_teacher(fresh)   # skips declined teachers automatically
    if nxt:
        await _audit("Event", event_id, "TEACHER_REASSIGNED",
                     {"user_id": "system", "role": "engine"},
                     {"from_teacher_id": tid, "to_teacher_id": nxt.get("teacher_id")})
        return {"ok": True, "status": "DECLINED", "reassigned": True, "to_teacher": nxt.get("teacher_name")}
    await _audit("Event", event_id, "TEACHER_UNMATCHED",
                 {"user_id": "system", "role": "engine"}, {"event_id": event_id})
    return {"ok": True, "status": "DECLINED", "reassigned": False}


class TeacherFeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)


@router.post("/teacher/events/{event_id}/feedback")
async def teacher_event_feedback(event_id: str, body: TeacherFeedbackIn,
                                 user: dict = Depends(current_user)) -> dict:
    """The assigned teacher's post-delivery feedback on the programme — a quality
    signal for the Council. Never shown to participants or used commercially."""
    _require_active()
    _require_teacher(user)
    await _ensure_teacher()
    a, ev = await _teacher_event_or_404(event_id, user)
    if _effective_lifecycle(ev) not in {"LIVE", "COMPLETED", "EVERGREEN"}:
        raise HTTPException(status_code=400, detail="event_not_delivered")
    tid = str(user.get("user_id"))
    now = _now()
    await teacher_feedback.update_one(
        {"event_id": event_id, "teacher_id": tid},
        {"$set": {"rating": int(body.rating), "comment": (body.comment or "").strip() or None,
                  "programme_id": ev.get("programme_id"), "organisation_id": ev.get("organisation_id"),
                  "city_slug": ev.get("city_slug"), "updated_at": now},
         "$setOnInsert": {"teacher_feedback_id": await _next_id("TeacherFeedback"), "created_at": now}},
        upsert=True)
    await _audit("TeacherFeedback", event_id, "TEACHER_FEEDBACK_SUBMITTED",
                 {"user_id": tid, "role": "teacher"}, {"event_id": event_id, "rating": int(body.rating)})
    return {"ok": True}


async def _feedback_summary(event_id: str) -> dict:
    """Anonymous aggregate (no participant identity) for organiser + teacher."""
    rows = await feedback.find({"event_id": event_id}).sort("created_at", -1).to_list(length=2000)
    count = len(rows)
    avg = round(sum(int(r.get("rating") or 0) for r in rows) / count, 2) if count else None
    dist = {str(i): 0 for i in range(1, 6)}
    comments = []
    for r in rows:
        rk = str(int(r.get("rating") or 0))
        if rk in dist:
            dist[rk] += 1
        if (r.get("comment") or "").strip():
            comments.append({"rating": r.get("rating"), "comment": r.get("comment"), "created_at": r.get("created_at")})
    return {"count": count, "average": avg, "distribution": dist, "comments": comments}


@router.get("/events/{event_id}/registrations")
async def org_event_roster(event_id: str, user: dict = Depends(current_user)) -> dict:
    """Organiser roster for THEIR OWN event (caller must be an org member). Contact
    details are shown — these are the org's own invited participants; cross-org
    data is never exposed."""
    _require_active()
    await _ensure()
    await _ensure_teacher()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="not_found")
    mem = await _membership(ev["organisation_id"], str(user.get("user_id")))
    if not mem:
        raise HTTPException(status_code=404, detail="not_found")
    regs = await registrations.find({"event_id": event_id}).sort([("session_seq", 1), ("created_at", 1)]).to_list(length=5000)
    summary = {"total": 0, "confirmed": 0, "waitlisted": 0, "cancelled": 0, "pending": 0, "attended": 0}
    rows = []
    for r in regs:
        bs = r.get("booking_status")
        summary["total"] += 1
        if bs == BOOKING_CONFIRMED:
            summary["confirmed"] += 1
        elif bs == BOOKING_WAITLISTED:
            summary["waitlisted"] += 1
        elif bs == BOOKING_CANCELLED:
            summary["cancelled"] += 1
        elif bs == BOOKING_PENDING_PAYMENT:
            summary["pending"] += 1
        att = await attendance.find_one({"event_id": event_id, "registration_id": r["registration_id"]})
        if (att or {}).get("status") == "PRESENT":
            summary["attended"] += 1
        rows.append({
            "registration_id": r.get("registration_id"), "name": r.get("participant_name"),
            "email": r.get("participant_email"), "participant_type": r.get("participant_type"),
            "department": r.get("department"), "phone": r.get("phone"),
            "booking_status": bs, "payment_status": r.get("payment_status"),
            "attendance_status": (att or {}).get("status"), "created_at": r.get("created_at"),
            "session_id": r.get("session_id"), "session_date": r.get("session_date"),
            "session_seq": r.get("session_seq"),
        })
    summary["attendance_rate"] = round(100 * summary["attended"] / summary["confirmed"]) if summary["confirmed"] else 0
    # B2.2 — per-session breakdown for a repeating programme.
    sessions = []
    if _is_recurring(ev):
        for s in await _session_rows(ev):
            mine = [x for x in rows if x["session_id"] == s["session_id"]]
            sessions.append({**s, "waitlisted": sum(1 for x in mine if x["booking_status"] == BOOKING_WAITLISTED),
                             "attended": sum(1 for x in mine if x["attendance_status"] == "PRESENT")})
    fb = await _feedback_summary(event_id)
    # §1 — surface the accurate teacher confirmation state to the organiser, and
    # NEVER reveal a teacher name until the teacher has explicitly accepted (a
    # PROPOSED offer stays anonymous — confirm-first principle).
    t_state = _teacher_state(ev)
    t_confirmed = t_state == "TEACHER_CONFIRMED"
    # §6 / B4.7 — only badge the confirmed teacher as "Verified" when the main
    # backend confirms ID check + empanelment (`_match_eligible`, read live).
    t_verified = False
    if t_confirmed and not ev.get("is_demo_seeded"):
        at = ev.get("assigned_teacher") or {}
        t_verified = _match_eligible(await teacher_directory.find_one({"teacher_id": at.get("teacher_id")}))
    return {
        "event": {"event_id": ev["event_id"], "title": ev.get("title"), "slug": ev.get("slug"),
                  "event_date": ev.get("event_date"), "city": ev.get("city"),
                  "schedule_label": _schedule_label(ev),
                  "lifecycle_effective": _effective_lifecycle(ev),
                  "teacher_state": t_state,
                  "teacher_state_label": TEACHER_STATE_LABELS.get(t_state) if t_state else None,
                  "teacher_confirmed": t_confirmed,
                  "teacher_verified": t_verified,
                  "assigned_teacher": ev.get("assigned_teacher") if t_confirmed else None},
        "summary": summary, "registrations": rows, "sessions": sessions, "feedback": fb,
        # §15 — renewal readiness (surfaced on COMPLETED events).
        "renewal": {
            "can_renew": _effective_lifecycle(ev) in {"COMPLETED", "EVERGREEN"},
            "participants": summary["confirmed"],
            "attended": summary["attended"],
            "attendance_rate": summary["attendance_rate"],
            "avg_rating": fb["average"],
            "feedback_count": fb["count"],
        },
    }


class FeedbackIn(BaseModel):
    event_id: Optional[str] = None
    event_slug: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


@router.post("/participant/feedback")
async def participant_feedback(body: FeedbackIn, p: dict = Depends(current_participant)) -> dict:
    """A participant rates a COMPLETED event they were CONFIRMED for."""
    _require_active()
    await _ensure()
    await _ensure_teacher()
    ev = None
    if body.event_id:
        ev = await events.find_one({"event_id": body.event_id})
    elif body.event_slug:
        ev = await events.find_one({"slug": body.event_slug})
    if not ev:
        raise HTTPException(status_code=404, detail="event_not_found")
    reg, _ = await _best_registration(ev["event_id"], p["participant_id"])
    if not reg:
        raise HTTPException(status_code=403, detail="not_registered")
    if _effective_lifecycle(ev) not in {"COMPLETED", "EVERGREEN"}:
        raise HTTPException(status_code=400, detail="event_not_completed")
    now = _now()
    await feedback.update_one(
        {"event_id": ev["event_id"], "participant_id": p["participant_id"]},
        {"$set": {"rating": int(body.rating), "comment": (body.comment or "").strip() or None,
                  "organisation_id": ev["organisation_id"], "updated_at": now},
         "$setOnInsert": {"feedback_id": await _next_id("Feedback"), "created_at": now}},
        upsert=True,
    )
    await _audit("Feedback", ev["event_id"], "FEEDBACK_SUBMITTED",
                 {"user_id": p["participant_id"], "role": "participant"},
                 {"event_id": ev["event_id"], "rating": int(body.rating)})
    return {"ok": True}


# ── Co-branded completion certificate (downloadable PDF) ──────────────────────
def _fetch_image_reader(url_or_path: Optional[str]):
    """Load a logo for the certificate from a local path or https URL. Returns a
    reportlab ImageReader or None (never raises — a missing logo just omits it)."""
    if not url_or_path:
        return None
    try:
        from reportlab.lib.utils import ImageReader
        if url_or_path.startswith("http"):
            with urlopen(url_or_path, timeout=6) as resp:   # noqa: S310 (trusted org/NOSTOPS asset)
                return ImageReader(BytesIO(resp.read()))
        if os.path.exists(url_or_path):
            return ImageReader(url_or_path)
    except Exception as e:
        logger.error(f"certificate logo load failed ({url_or_path}): {e}")
    return None


def _draw_logo(c, reader, x, y, max_h, align_right=False, max_w=55):
    from reportlab.lib.units import mm
    if not reader:
        return
    try:
        iw, ih = reader.getSize()
        h = max_h * mm
        w = h * (iw / ih) if ih else h
        if w > max_w * mm:
            w = max_w * mm
            h = w * (ih / iw) if iw else h
        dx = (x * mm - w) if align_right else x * mm
        c.drawImage(reader, dx, y * mm, width=w, height=h, mask="auto", preserveAspectRatio=True)
    except Exception as e:
        logger.error(f"certificate drawImage failed: {e}")


def _certificate_pdf(participant_name: str, ev: dict, org: Optional[dict], teacher_name: Optional[str], cert_ref: str, verify_url: Optional[str] = None) -> bytes:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    W, H = landscape(A4)
    c = canvas.Canvas(buf, pagesize=(W, H))
    brand = colors.HexColor("#0E7C7B")
    ink = colors.HexColor("#232A4D")
    muted = colors.HexColor("#6B7280")
    gold = colors.HexColor("#C9A227")

    # Background + double co-brand border.
    c.setFillColor(colors.HexColor("#FFFDF7"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(brand); c.setLineWidth(3)
    c.rect(14 * mm, 14 * mm, W - 28 * mm, H - 28 * mm, fill=0, stroke=1)
    c.setStrokeColor(gold); c.setLineWidth(1)
    c.rect(17 * mm, 17 * mm, W - 34 * mm, H - 34 * mm, fill=0, stroke=1)

    top = H / mm - 30  # mm from bottom reference for the logo row
    _draw_logo(c, _fetch_image_reader(NOSTOPS_LOGO_PATH), 26, top, 14)
    if org and org.get("logo_url"):
        _draw_logo(c, _fetch_image_reader(org.get("logo_url")), (W / mm) - 26, top, 14, align_right=True)

    def center(text, y_mm, font, size, color):
        c.setFont(font, size); c.setFillColor(color)
        c.drawCentredString(W / 2, y_mm * mm, text)

    def clip(s, n):
        s = (s or "").strip()
        return s if len(s) <= n else s[: n - 1] + "…"

    base = H / mm
    center("CERTIFICATE OF PARTICIPATION", base - 58, "Helvetica-Bold", 26, ink)
    c.setStrokeColor(gold); c.setLineWidth(1)
    c.line((W / 2) - 28 * mm, (base - 62) * mm, (W / 2) + 28 * mm, (base - 62) * mm)
    center("This certifies that", base - 74, "Helvetica", 12, muted)
    center(clip(participant_name, 48), base - 88, "Helvetica-Bold", 28, brand)
    center("has participated in", base - 99, "Helvetica", 12, muted)
    center(clip(ev.get("title") or "a NOSTOPS programme", 64), base - 110, "Helvetica-Bold", 17, ink)

    prog = (ev.get("programme_snapshot") or {}).get("name")
    meta = " · ".join([x for x in [ev.get("event_date"), ev.get("city"), prog] if x])
    if meta:
        center(clip(meta, 90), base - 120, "Helvetica", 11, muted)
    if teacher_name:
        center(f"Facilitated by {clip(teacher_name, 40)}", base - 128, "Helvetica-Oblique", 11, muted)

    org_name = (org or {}).get("name") or "the organisation"
    center(f"{clip(org_name, 50)}  in partnership with  NOSTOPS", 32, "Helvetica-Bold", 11, ink)
    center("A Teachers-First Yoga Cooperative", 27, "Helvetica", 9, muted)
    c.setFont("Helvetica", 8); c.setFillColor(muted)
    c.drawString(20 * mm, 20 * mm, f"Certificate ref: {cert_ref}")
    if verify_url:
        c.drawString(20 * mm, 16 * mm, f"Verify: {clip(verify_url, 70)}")

    # QR code (bottom-right, inside the border) for instant employer verification.
    if verify_url:
        try:
            from reportlab.graphics.barcode import qr
            from reportlab.graphics.shapes import Drawing
            from reportlab.graphics import renderPDF
            widget = qr.QrCodeWidget(verify_url)
            b = widget.getBounds()
            bw, bh = (b[2] - b[0]) or 1, (b[3] - b[1]) or 1
            size = 22 * mm
            d = Drawing(size, size, transform=[size / bw, 0, 0, size / bh, 0, 0])
            d.add(widget)
            qx, qy = W - 42 * mm, 20 * mm
            renderPDF.draw(d, c, qx, qy)
            c.setFont("Helvetica", 7); c.setFillColor(muted)
            c.drawCentredString(qx + size / 2, qy - 3.5 * mm, "Scan to verify")
        except Exception as e:
            logger.error(f"certificate QR render failed: {e}")
            c.setFont("Helvetica", 8); c.setFillColor(muted)
            c.drawRightString(W - 20 * mm, 20 * mm, "Verified by NOSTOPS")
    else:
        c.setFont("Helvetica", 8); c.setFillColor(muted)
        c.drawRightString(W - 20 * mm, 20 * mm, "Verified by NOSTOPS")

    c.showPage()
    c.save()
    return buf.getvalue()


async def _ensure_verify_code(reg: dict) -> str:
    """Stable, non-guessable public verification code for a registration's
    certificate (prevents enumeration of participant names by sequential ref)."""
    code = reg.get("verify_code")
    if code:
        return code
    code = secrets.token_hex(6).upper()   # 12 hex chars
    await registrations.update_one({"registration_id": reg["registration_id"]},
                                   {"$set": {"verify_code": code}})
    return code


@router.get("/participant/certificate/{event_id}")
async def participant_certificate(event_id: str, p: dict = Depends(current_participant)) -> Response:
    """Stream a co-branded completion certificate PDF for a COMPLETED event the
    participant was CONFIRMED for (and not marked ABSENT)."""
    _require_active()
    await _ensure()
    await _ensure_teacher()
    ev = await events.find_one({"event_id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="event_not_found")
    reg, att = await _best_registration(event_id, p["participant_id"])
    if not reg:
        raise HTTPException(status_code=403, detail="not_registered")
    if _effective_lifecycle(ev) not in {"COMPLETED", "EVERGREEN"}:
        raise HTTPException(status_code=400, detail="event_not_completed")
    if (att or {}).get("status") == "ABSENT":
        raise HTTPException(status_code=403, detail="did_not_attend")
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    teacher_name = (ev.get("assigned_teacher") or {}).get("name")
    pname = reg.get("participant_name") or p.get("name") or "Participant"
    code = await _ensure_verify_code(reg)
    verify_url = f"{SITE_URL}/verify/{code}"
    pdf = _certificate_pdf(pname, ev, org, teacher_name, reg["registration_id"], verify_url)
    fname = f"NOSTOPS-Certificate-{ev.get('slug') or event_id}.pdf"
    await _audit("Registration", reg["registration_id"], "CERTIFICATE_DOWNLOADED",
                 {"user_id": p["participant_id"], "role": "participant"}, {"event_id": event_id})
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/public/certificate/verify/{code}")
async def public_certificate_verify(code: str, _: bool = Depends(require_secret)) -> dict:
    """Public, unauthenticated-friendly certificate check (employers scan the QR /
    open the verify link). Returns ONLY the certificate's public face — no contact
    PII. An invalid/revoked/not-yet-completed certificate returns valid:false."""
    await _ensure()
    await _ensure_teacher()
    code = (code or "").strip().upper()
    if not re.fullmatch(r"[A-F0-9]{8,24}", code or ""):
        return {"valid": False}
    reg = await registrations.find_one({"verify_code": code})
    if not reg or reg.get("booking_status") != BOOKING_CONFIRMED:
        return {"valid": False}
    ev = await events.find_one({"event_id": reg["event_id"]})
    if not ev or _effective_lifecycle(ev) not in {"COMPLETED", "EVERGREEN"}:
        return {"valid": False}
    att = await attendance.find_one({"event_id": reg["event_id"], "registration_id": reg["registration_id"]})
    if (att or {}).get("status") == "ABSENT":
        return {"valid": False}
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    snap = ev.get("programme_snapshot") or {}
    return {
        "valid": True,
        "reference": reg["registration_id"],
        "participant_name": reg.get("participant_name"),
        "event_title": ev.get("title"),
        "programme_name": snap.get("name"),
        "programme_taxonomy_label": snap.get("taxonomy_label"),
        "event_date": ev.get("event_date"),
        "city": ev.get("city"),
        "organisation_name": (org or {}).get("name"),
        "teacher_name": (ev.get("assigned_teacher") or {}).get("name"),
        "attended": (att or {}).get("status") == "PRESENT",
    }


def _reminder_html(name: Optional[str], ev: dict, org: Optional[dict], kind: str) -> str:
    hi = f" {name}" if name else ""
    title = ev.get("title") or "your NOSTOPS programme"
    when = " · ".join([x for x in [ev.get("event_date"), ev.get("start_time")] if x]) or "soon"
    if ev.get("_session_note"):
        when = f"{ev['_session_note']} · {when}"
    where = ev.get("venue") or ev.get("city") or ""
    if kind == "reminder":
        head = "See you tomorrow 🧘"
        body_p = (f"This is a friendly reminder that <strong>{title}</strong> is happening "
                  f"<strong>tomorrow</strong> ({when}){(' at ' + where) if where else ''}.")
        cta_text, cta_path = "View event details", f"/events/{ev.get('slug')}"
    else:
        head = "Thank you for joining 🙏"
        body_p = (f"Thank you for attending <strong>{title}</strong>. We hope it was restorative. "
                  "Share your feedback and download your certificate of participation from your dashboard.")
        cta_text, cta_path = "View my dashboard", "/participant"
    link = f"{SITE_URL}{cta_path}"
    return (
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
        'max-width:480px;margin:0 auto;padding:24px;color:#232A4D">'
        f'<h2 style="margin:0 0 12px;font-size:20px">{head}</h2>'
        f'<p style="margin:0 0 8px;line-height:1.5">Namaste{hi}, {body_p}</p>'
        '<p style="margin:16px 0">'
        f'<a href="{link}" style="display:inline-block;background:#0E7C7B;color:#ffffff;'
        'text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">'
        f'{cta_text}</a></p>'
        '<p style="margin:16px 0 0;color:#9ca3af;font-size:12px">NOSTOPS — A Teachers-First Yoga Cooperative.</p>'
        '</div>'
    )


async def _email_event_participants(ev: dict, kind: str, session: Optional[dict] = None) -> int:
    """Email an event's CONFIRMED participants — once per person (a repeating
    programme has one registration per session). With `session`, only that
    session's registrants, and the email shows the session's date."""
    org = await organisations.find_one({"organisation_id": ev["organisation_id"]})
    q = {"event_id": ev["event_id"], "booking_status": BOOKING_CONFIRMED}
    if session:
        q["session_id"] = session["session_id"]
        n = (ev.get("schedule") or {}).get("session_count")
        ev = {**ev, "event_date": session["date"],
              "_session_note": f"Session {session.get('seq')}{f' of {n}' if n else ''}"}
    regs = await registrations.find(q).to_list(length=5000)
    subj = ("Reminder: your NOSTOPS session is tomorrow" if kind == "reminder"
            else "Thank you for attending — share your feedback")
    sent = 0
    seen: set = set()
    for r in regs:
        email = r.get("participant_email")
        if not email or email in seen:
            continue
        seen.add(email)
        try:
            await send_email(to=email, subject=subj, html=_reminder_html(r.get("participant_name"), ev, org, kind))
            sent += 1
        except Exception as e:
            logger.error(f"{kind} email to {email} failed: {e}")
    return sent


@router.post("/jobs/reminders")
async def job_reminders(_: bool = Depends(require_cron)) -> dict:
    """Daily — email CONFIRMED participants of events happening TOMORROW.
    Idempotent per event via reminder_sent_at."""
    _require_active()
    await _ensure()
    # Calendar date in India (the platform default timezone), not the server's UTC date.
    tomorrow = (_local_today(None) + _dt.timedelta(days=1)).isoformat()
    evs = await events.find({"lifecycle": {"$in": ["PUBLISHED", "LIVE"]},
                             "event_date": tomorrow, "reminder_sent_at": None,
                             "schedule.type": {"$ne": SCHEDULE_RECURRING}}).to_list(length=500)
    emails = n = 0
    for ev in evs:
        emails += await _email_event_participants(ev, "reminder")
        await events.update_one({"event_id": ev["event_id"]}, {"$set": {"reminder_sent_at": _now()}})
        n += 1
    # Repeating programmes — remind each session's own registrants the day before.
    for s in await event_sessions.find({"date": tomorrow, "reminder_sent_at": None,
                                        "status": {"$ne": "CANCELLED"}}).to_list(length=2000):
        ev = await events.find_one({"event_id": s["event_id"], "lifecycle": {"$in": ["PUBLISHED", "LIVE"]}})
        if not ev:
            continue
        emails += await _email_event_participants(ev, "reminder", s)
        await event_sessions.update_one({"session_id": s["session_id"]}, {"$set": {"reminder_sent_at": _now()}})
        n += 1
    # Also sweep for PAID registrations awaiting payment (gentle one-time nudge).
    pay_reminders = await _sweep_pending_payment_reminders()
    return {"ok": True, "events": n, "emails": emails, "payment_reminders": pay_reminders, "for_date": tomorrow}


@router.post("/jobs/payment-reminders")
async def job_payment_reminders(_: bool = Depends(require_cron)) -> dict:
    """Gentle ONE-TIME reminder to participants who started a PAID registration
    but haven't completed payment (2h–7d old, event still upcoming). Idempotent
    per registration via payment_reminder_sent_at. Also runs inside /jobs/reminders."""
    _require_active()
    await _ensure()
    sent = await _sweep_pending_payment_reminders()
    return {"ok": True, "payment_reminders": sent}


@router.post("/jobs/post-event")
async def job_post_event(_: bool = Depends(require_cron)) -> dict:
    """Daily — thank-you + feedback email to CONFIRMED participants of events that
    ran YESTERDAY. Idempotent per event via thankyou_sent_at."""
    _require_active()
    await _ensure()
    yesterday = (_local_today(None) - _dt.timedelta(days=1)).isoformat()
    # A repeating programme is thanked once, after its LAST session.
    evs = await events.find({"lifecycle": {"$nin": ["DRAFT"]}, "thankyou_sent_at": None, "$or": [
        {"schedule.type": {"$ne": SCHEDULE_RECURRING}, "event_date": yesterday},
        {"schedule.type": SCHEDULE_RECURRING, "last_session_date": yesterday},
    ]}).to_list(length=500)
    emails = n = 0
    for ev in evs:
        emails += await _email_event_participants(ev, "thankyou")
        await events.update_one({"event_id": ev["event_id"]}, {"$set": {"thankyou_sent_at": _now()}})
        n += 1
    return {"ok": True, "events": n, "emails": emails, "for_date": yesterday}


@router.post("/jobs/completion-sweep")
async def job_completion_sweep(_: bool = Depends(require_cron)) -> dict:
    """§9 Automatic Event Completion — promote PUBLISHED→LIVE on the event day and
    LIVE→COMPLETED once the scheduled END time (date + end/start+duration) has
    passed (never merely on start). On completion, run one-time finalisation
    (participant + teacher feedback, certificates, settlement where applicable);
    analytics / organisation dashboards / participant 'My Programmes' update live
    off the lifecycle. Idempotent; completed events are never deleted."""
    _require_active()
    await _ensure()
    # Include already-COMPLETED events that haven't been finalised yet (an on-read
    # flip may have completed them before this sweep ran).
    rows = await events.find({"lifecycle": {"$in": ["PUBLISHED", "LIVE", "COMPLETED"]}}).to_list(length=4000)
    moved_live = moved_completed = finalized = emails = 0
    for ev in rows:
        if not _parse_date(ev.get("event_date")):
            continue
        eff = _effective_lifecycle(ev)
        now = _now()
        if eff == "LIVE" and ev.get("lifecycle") == "PUBLISHED":
            await events.update_one({"event_id": ev["event_id"]},
                                    {"$set": {"lifecycle": "LIVE", "updated_at": now}})
            await _audit("Event", ev["event_id"], "EVENT_LIVE", {"user_id": "system", "role": "engine"}, {})
            moved_live += 1
        elif eff == "COMPLETED":
            if ev.get("lifecycle") != "COMPLETED":
                await events.update_one({"event_id": ev["event_id"]}, {"$set": {
                    "lifecycle": "COMPLETED", "completed_at": ev.get("completed_at") or now, "updated_at": now}})
                await _audit("Event", ev["event_id"], "EVENT_COMPLETED", {"user_id": "system", "role": "engine"}, {})
                ev = {**ev, "lifecycle": "COMPLETED"}
                moved_completed += 1
            if not ev.get("completion_finalized_at"):
                had_thankyou = bool(ev.get("thankyou_sent_at"))
                patch = await _on_event_completed(ev, now)
                if patch.get("thankyou_sent_at") and not had_thankyou:
                    emails += 1
                patch["completion_finalized_at"] = now
                await events.update_one({"event_id": ev["event_id"]}, {"$set": patch})
                finalized += 1
    return {"ok": True, "moved_live": moved_live, "moved_completed": moved_completed,
            "finalized": finalized, "emails": emails}


@router.post("/jobs/teacher-offer-sweep")
async def job_teacher_offer_sweep(_: bool = Depends(require_cron)) -> dict:
    """§4 — expire PROPOSED teacher offers unanswered beyond the configured
    response window, then auto-reassign to the next eligible teacher."""
    _require_active()
    await _ensure_teacher()
    cfg = await platform_config.find_one({"_id": "singleton"}) or {}
    window_h = int(cfg.get("teacher_response_window_hours") or DEFAULT_TEACHER_RESPONSE_WINDOW_HOURS)
    cutoff = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(hours=window_h)).isoformat()
    stale = await teacher_assignments.find(
        {"status": "PROPOSED", "created_at": {"$lt": cutoff}}).to_list(length=1000)
    expired = reassigned = 0
    now = _now()
    for a in stale:
        await teacher_assignments.update_one({"assignment_id": a["assignment_id"]},
            {"$set": {"status": "DECLINED", "decline_reason": "no_response", "auto_declined": True,
                      "responded_at": now, "updated_at": now}})
        await _audit("TeacherAssignment", a["assignment_id"], "TEACHER_OFFER_EXPIRED",
                     {"user_id": "system", "role": "engine"}, {"event_id": a.get("event_id")})
        expired += 1
        ev = await events.find_one({"event_id": a["event_id"]})
        if not ev:
            continue
        if (ev.get("assigned_teacher") or {}).get("assignment_id") == a["assignment_id"]:
            await events.update_one({"event_id": a["event_id"]},
                {"$set": {"assigned_teacher": None, "teacher_declined_once": True, "updated_at": now}})
            ev = await events.find_one({"event_id": a["event_id"]})
        if await _auto_assign_teacher(ev):
            reassigned += 1
    return {"ok": True, "window_hours": window_h, "expired": expired, "reassigned": reassigned}


# ══════════════════════════════════════════════════════════════════════════════
# §16 — transactional emails (confirmation, teacher match) + human escalation
# ══════════════════════════════════════════════════════════════════════════════
def _simple_email(head: str, body_html: str, cta_text: Optional[str] = None, cta_path: Optional[str] = None) -> str:
    cta = ""
    if cta_text and cta_path:
        link = f"{SITE_URL}{cta_path}"
        cta = ('<p style="margin:16px 0">'
               f'<a href="{link}" style="display:inline-block;background:#0E7C7B;color:#ffffff;'
               'text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">'
               f'{cta_text}</a></p>')
    return (
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
        'max-width:480px;margin:0 auto;padding:24px;color:#232A4D">'
        f'<h2 style="margin:0 0 12px;font-size:20px">{head}</h2>'
        f'{body_html}{cta}'
        '<p style="margin:16px 0 0;color:#9ca3af;font-size:12px">NOSTOPS — A Teachers-First Yoga Cooperative.</p>'
        '</div>'
    )


def _teacher_match_html(name: Optional[str], ev: dict) -> str:
    hi = f" {name}" if name else ""
    when = " · ".join([x for x in [ev.get("event_date"), ev.get("start_time")] if x]) or "a date to be confirmed"
    if _is_recurring(ev):
        when = f"{when} ({_schedule_label(ev)})"
    where = ev.get("venue") or ev.get("city") or ""
    body = (f'<p style="margin:0 0 8px;line-height:1.5">Namaste{hi}, you&rsquo;ve been offered to lead '
            f'<strong>{ev.get("title") or "a NOSTOPS programme"}</strong> on {when}'
            f'{(" at " + where) if where else ""}. Please open your dashboard to <strong>accept or decline</strong> — '
            f'if you decline, we&rsquo;ll offer it to the next-nearest teacher.</p>')
    return _simple_email("New programme offer 🧘 — please respond", body, "Review &amp; respond", "/app/teacher/institutional")


async def _send_registration_confirmation(reg: dict, ev: dict, org: Optional[dict], p: dict) -> None:
    email = reg.get("participant_email") or p.get("email")
    if not email:
        return
    waitlisted = reg.get("booking_status") == BOOKING_WAITLISTED
    title = ev.get("title") or "your NOSTOPS programme"
    when = " · ".join([x for x in [reg.get("session_date") or ev.get("event_date"), ev.get("start_time")] if x]) or "soon"
    if reg.get("session_id"):
        n = (ev.get("schedule") or {}).get("session_count")
        when = f"Session {reg.get('session_seq')}{f' of {n}' if n else ''} · {when}"
    where = ev.get("venue") or ev.get("city") or ""
    org_name = (org or {}).get("name")
    if waitlisted:
        head = "You&rsquo;re on the waitlist ⏳"
        body = (f'<p style="margin:0 0 8px;line-height:1.5">Namaste, this event is currently full. '
                f'You&rsquo;re on the waitlist for <strong>{title}</strong>{(" by " + org_name) if org_name else ""} '
                f'and we&rsquo;ll notify you if a seat opens.</p>')
        subj = "You're on the waitlist — NOSTOPS"
    else:
        head = "Your place is confirmed ✓"
        body = (f'<p style="margin:0 0 8px;line-height:1.5">Namaste, your registration for '
                f'<strong>{title}</strong>{(" by " + org_name) if org_name else ""} is confirmed.</p>'
                f'<p style="margin:0 0 8px;line-height:1.5">🗓️ {when}{("<br/>📍 " + where) if where else ""}</p>')
        subj = "Registration confirmed — NOSTOPS"
    try:
        await send_email(to=email, subject=subj,
                         html=_simple_email(head, body, "View event", f"/events/{ev.get('slug')}" if ev.get("slug") else None))
    except Exception as e:
        logger.error(f"registration confirmation email failed: {e}")


def _fmt_amount(amount, currency: Optional[str]) -> str:
    """Human-friendly money string for receipts/reminders (₹ for INR)."""
    cur = (currency or "INR").upper()
    try:
        amt = int(round(float(amount)))
    except (TypeError, ValueError):
        return ""
    if amt <= 0:
        return ""
    return f"₹{amt:,}" if cur == "INR" else f"{cur} {amt:,}"


async def _send_payment_receipt(reg: dict, ev: Optional[dict], org: Optional[dict], order_id: Optional[str]) -> None:
    """§13 — clear payment receipt emailed the moment a PAID registration is
    confirmed: programme, organiser, date/time, venue, amount, paid date, and a
    booking reference. Never includes any other participant's data."""
    ev = ev or {}
    email = reg.get("participant_email")
    if not email:
        return
    title = ev.get("title") or "your NOSTOPS programme"
    when = " · ".join([x for x in [reg.get("session_date") or ev.get("event_date"), ev.get("start_time")] if x]) or "to be announced"
    where = ev.get("venue") or ev.get("city") or ""
    org_name = (org or {}).get("name")
    amt_str = _fmt_amount(reg.get("amount"), reg.get("currency")) or "—"
    paid_on = (reg.get("paid_at") or _now())[:10]
    ref = reg.get("registration_id") or ""
    pairs = [("Programme", title)]
    if org_name:
        pairs.append(("Organised by", org_name))
    pairs.append(("When", when))
    if where:
        pairs.append(("Where", where))
    pairs.append(("Amount paid", amt_str))
    pairs.append(("Paid on", paid_on))
    if ref:
        pairs.append(("Booking reference", ref))
    rows = "".join(
        f'<tr><td style="padding:4px 14px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap">{k}</td>'
        f'<td style="padding:4px 0;font-size:13px;font-weight:600;color:#232A4D">{v}</td></tr>'
        for (k, v) in pairs
    )
    order_note = (f'<p style="margin:12px 0 0;color:#9ca3af;font-size:12px">Payment ref: {order_id}</p>'
                  if order_id else "")
    body = (
        '<p style="margin:0 0 12px;line-height:1.5">Namaste, thank you — your payment has been received and your '
        f'place for <strong>{title}</strong> is confirmed. Here is your receipt:</p>'
        f'<table style="border-collapse:collapse;margin:0">{rows}</table>'
        f'{order_note}'
        '<p style="margin:14px 0 0;color:#6b7280;font-size:12px">A PDF copy of this receipt is attached for your records and expense claims.</p>'
    )
    # Build a one-page PDF receipt to attach (server-generated; filing-friendly).
    attachments = None
    try:
        import asyncio as _asyncio
        pdf_bytes = await _asyncio.to_thread(
            build_receipt_pdf,
            title=title,
            org_name=org_name,
            when=when,
            where=where or None,
            participant=reg.get("participant_name"),
            amount_str=format_money_pdf(reg.get("amount"), reg.get("currency")),
            paid_on=paid_on,
            booking_ref=ref or None,
            order_ref=order_id,
        )
        safe_ref = re.sub(r"[^A-Za-z0-9_-]", "", ref or "receipt") or "receipt"
        attachments = [{
            "filename": f"NOSTOPS-receipt-{safe_ref}.pdf",
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
        }]
    except Exception as e:
        logger.error(f"receipt PDF generation failed (sending email without attachment): {e}")
    try:
        await send_email(to=email, subject="Payment receipt — NOSTOPS",
                         html=_simple_email("Payment received ✓", body, "View my programmes", "/participant"),
                         attachments=attachments)
    except Exception as e:
        logger.error(f"payment receipt email failed: {e}")


def _payment_reminder_html(reg: dict, ev: dict, org: Optional[dict]) -> str:
    title = ev.get("title") or "your NOSTOPS programme"
    when = " · ".join([x for x in [reg.get("session_date") or ev.get("event_date"), ev.get("start_time")] if x]) or "soon"
    where = ev.get("venue") or ev.get("city") or ""
    org_name = (org or {}).get("name")
    amt_str = _fmt_amount(reg.get("amount"), reg.get("currency"))
    name = reg.get("participant_name")
    hi = f" {name}" if name else ""
    body = (
        f'<p style="margin:0 0 8px;line-height:1.5">Namaste{hi}, your seat for <strong>{title}</strong>'
        f'{(" by " + org_name) if org_name else ""} is being held, but your payment'
        f'{(" of " + amt_str) if amt_str else ""} isn&rsquo;t complete yet.</p>'
        f'<p style="margin:0 0 8px;line-height:1.5">🗓️ {when}{("<br/>📍 " + where) if where else ""}</p>'
        '<p style="margin:0 0 8px;line-height:1.5">Complete your payment to confirm your place — seats are limited.</p>'
    )
    slug = ev.get("slug")
    return _simple_email("Complete your registration 🧘", body,
                         "Complete payment", _register_path(slug, reg.get("session_id")))


async def _sweep_pending_payment_reminders(max_age_days: int = 7) -> int:
    """§16 — gentle, ONE-TIME nudge to participants who started a PAID
    registration but haven't paid yet. Only fires for registrations between 2h
    and `max_age_days` old whose event is still upcoming; idempotent per
    registration via payment_reminder_sent_at (never nags)."""
    now = _dt.datetime.utcnow()
    recent_cutoff = (now - _dt.timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    old_cutoff = (now - _dt.timedelta(days=max_age_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    today = _dt.date.today().isoformat()
    rows = await registrations.find({
        "booking_status": BOOKING_PENDING_PAYMENT,
        "payment_status": PAY_PENDING,
        "payment_reminder_sent_at": None,
    }).to_list(length=1000)
    sent = 0
    for r in rows:
        created = r.get("created_at") or ""
        # nudge only the 2h–max_age_days window (too-fresh waits; too-stale is left alone)
        if created and (created > recent_cutoff or created < old_cutoff):
            continue
        email = r.get("participant_email")
        if not email:
            continue
        ev = await events.find_one({"event_id": r.get("event_id")})
        if not ev or ev.get("lifecycle") not in {"PUBLISHED", "LIVE"}:
            continue
        ed = r.get("session_date") or ev.get("event_date")
        if ed and ed < today:
            continue
        org = await organisations.find_one({"organisation_id": r.get("organisation_id")})
        try:
            await send_email(to=email, subject="Complete your NOSTOPS registration",
                             html=_payment_reminder_html(r, ev, org))
            await registrations.update_one({"registration_id": r["registration_id"]},
                                           {"$set": {"payment_reminder_sent_at": _now()}})
            sent += 1
        except Exception as e:
            logger.error(f"payment reminder email to {email} failed: {e}")
    return sent


ESCALATION_CATEGORIES = {
    "EXCEPTION", "COMPLAINT", "TEACHER_ISSUE", "VENUE_PROBLEM",
    "COMMERCIAL", "QUALITY_ISSUE", "AT_RISK_EVENT", "OTHER",
}


class EscalationIn(BaseModel):
    category: str
    message: str = Field(min_length=3, max_length=2000)
    event_id: Optional[str] = None


@router.post("/support/escalate")
async def support_escalate(body: EscalationIn, user: dict = Depends(current_user)) -> dict:
    """§16 — human-escalation path for exceptions / complaints / teacher / venue /
    commercial / quality issues. Logged + emailed to the NOSTOPS care inbox."""
    _require_active()
    await _ensure()
    cat = (body.category or "OTHER").strip().upper()
    if cat not in ESCALATION_CATEGORIES:
        cat = "OTHER"
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="message_required")
    eid = await _next_id("Escalation")
    ctx = {"category": cat, "message": msg, "event_id": body.event_id,
           "user_id": str(user.get("user_id")), "role": user.get("role"), "name": user.get("name")}
    await _audit("Escalation", eid, "HUMAN_ESCALATION", {"user_id": str(user.get("user_id")), "role": user.get("role")}, ctx)
    ev_line = ""
    if body.event_id:
        ev = await events.find_one({"event_id": body.event_id})
        if ev:
            ev_line = f'<p style="margin:0 0 8px"><strong>Event:</strong> {ev.get("title")} ({ev.get("event_id")})</p>'
    body_html = (
        f'<p style="margin:0 0 8px"><strong>Category:</strong> {cat.replace("_", " ").title()}</p>'
        f'<p style="margin:0 0 8px"><strong>From:</strong> {user.get("name") or "User"} · {user.get("role")} · {user.get("user_id")}</p>'
        f'{ev_line}'
        f'<p style="margin:0 0 8px"><strong>Reference:</strong> {eid}</p>'
        f'<p style="margin:12px 0 0;white-space:pre-wrap;line-height:1.5">{msg}</p>'
    )
    try:
        await send_email(to=NOSTOPS_SUPPORT_EMAIL, subject=f"[Escalation · {cat}] {eid}",
                         html=_simple_email("New human-escalation request", body_html))
    except Exception as e:
        logger.error(f"escalation email failed: {e}")
    return {"ok": True, "reference": eid}
