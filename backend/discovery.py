"""
NOSTOPS Teacher Discovery Engine — ISOLATED local feature (local FastAPI + local
Mongo `nostops_web`). Mounted BEFORE the catch-all proxy so /api/discovery/* is
served locally and never forwarded to the frozen remote business backend.

Phase 1 = DISCOVERY ONLY (no claim UI, no public provisional pages, no changes
to teacher onboarding). Pipeline:

  Google Places (New) Text Search  →  normalise  →  deduplicate (google_place_id)
  →  classify (individual teacher vs studio/centre/org/…)  →  campaign target gate

Google usage (official Places API New, NEVER scraping):
  POST https://places.googleapis.com/v1/places:searchText
  Headers: X-Goog-Api-Key, X-Goog-FieldMask
  FieldMask (minimal — needed for classification, nothing richer):
    places.id, places.displayName, places.types, places.location,
    places.formattedAddress, nextPageToken
  No reviews, no photos, no review text, no rich descriptions, no Place Details.

Security: same defense-in-depth as pulse.py — every request carries the shared
secret `X-Pulse-Secret`; identity is injected server-side by the Next.js BFF via
`X-Pulse-User`. Admin role required for every endpoint.
"""
import asyncio
import base64
import hmac
import json
import os
import re
import time
import uuid
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
GOOGLE_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()

# ── Cost & safety knobs (env-overridable) ────────────────────────────────────
MAX_REQUESTS_PER_RUN = int(os.environ.get("DISCOVERY_MAX_REQUESTS", "80"))  # per-run cap
MAX_PAGES_PER_QUERY = int(os.environ.get("DISCOVERY_MAX_PAGES", "5"))       # 5 x 20 = 100
# Three-level hard cost safeguards (env-overridable):
#   GLOBAL  — max discovery API requests across ALL cities per calendar month.
#   CAMPAIGN/CITY — max cumulative requests for one city campaign (one campaign
#                   per city, so campaign cap == city cap).
DEFAULT_CAMPAIGN_REQUEST_CAP = int(os.environ.get("DISCOVERY_CAMPAIGN_REQUEST_CAP", "120"))
MONTHLY_REQUEST_CAP = int(os.environ.get("DISCOVERY_MONTHLY_REQUEST_CAP", "5000"))
PAGE_SIZE = 20
REQ_DELAY_S = 0.5            # polite spacing between Google calls
TOKEN_WAIT_S = 2.2          # nextPageToken needs a moment to become valid
# Fake mode lets the engine be exercised end-to-end WITHOUT a Google key (tests).
FAKE = os.environ.get("DISCOVERY_FAKE", "").strip() in ("1", "true", "yes")

PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = (
    "places.id,places.displayName,places.types,places.location,"
    "places.formattedAddress,nextPageToken"
)

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]
campaigns = db["discovery_campaigns"]
candidates = db["discovery_candidates"]
jobs = db["discovery_jobs"]
usage = db["discovery_usage"]  # {_id: 'YYYY-MM', requests: int}

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

# Default, CONFIGURABLE discovery queries (a campaign may override).
DEFAULT_QUERIES = [
    "yoga teacher", "yoga instructor", "yoga classes", "yoga trainer",
    "yoga therapy", "yoga studio", "yoga centre", "yoga center",
    "yoga school", "yoga academy", "yoga institute",
]

# Cities the pilot supports. NONE are auto-activated — a city becomes "active"
# only when an admin creates/enables a campaign for it. Navi Mumbai is the pilot.
SUPPORTED_CITIES = [
    "Delhi", "Gurgaon", "Bangalore", "Mumbai", "Navi Mumbai",
    "Pune", "Nashik", "Chandigarh", "Hyderabad",
]

CLASSIFICATIONS = {
    "INDIVIDUAL_TEACHER", "TEACHER_BUSINESS", "YOGA_STUDIO", "YOGA_CENTRE",
    "YOGA_SCHOOL", "YOGA_ACADEMY", "YOGA_ORGANISATION", "RETREAT_CENTRE",
    "NON_TEACHER",
}
# Phase-1 teacher campaign accepts individual teachers + teacher-run businesses.
DEFAULT_ACCEPT = ["INDIVIDUAL_TEACHER", "TEACHER_BUSINESS"]

_ensured = False
_running: set = set()  # campaign_ids with an in-flight job (single-flight guard)


def now_ms() -> int:
    return int(time.time() * 1000)


def oid() -> str:
    return uuid.uuid4().hex


def _month() -> str:
    return time.strftime("%Y-%m", time.gmtime())


async def _global_usage() -> int:
    doc = await usage.find_one({"_id": _month()})
    return int((doc or {}).get("requests") or 0)


async def _inc_global(n: int = 1):
    await usage.update_one({"_id": _month()}, {"$inc": {"requests": n}}, upsert=True)


async def _ensure_indexes():
    global _ensured
    if _ensured:
        return
    # google_place_id is the GLOBAL external identity — unique across campaigns.
    await candidates.create_index("google_place_id", unique=True)
    await candidates.create_index([("campaign_id", 1), ("classification", 1)])
    await candidates.create_index([("campaign_id", 1), ("status", 1)])
    await candidates.create_index([("city_slug", 1), ("teacher_slug", 1)])
    await jobs.create_index([("campaign_id", 1), ("created_at", -1)])
    _ensured = True


# ── Auth (mirror of pulse.py) ────────────────────────────────────────────────
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


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return user


def _check_secret(x_pulse_secret: Optional[str]):
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


async def secret_only(x_pulse_secret: Optional[str] = Header(None)) -> bool:
    """Public reads: the server-only shared secret is required (SSR calls carry
    it), but no authenticated identity is needed."""
    _check_secret(x_pulse_secret)
    return True


async def signed_in_user(
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
) -> dict:
    """Any signed-in NOSTOPS account (the claimant need not be a teacher yet —
    claiming is what starts their teacher journey)."""
    _check_secret(x_pulse_secret)
    try:
        data = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="Please sign in to claim this profile.")
    uid = data.get("user_id")
    if not uid or str(data.get("role") or "").lower() == "public":
        raise HTTPException(status_code=401, detail="Please sign in to claim this profile.")
    return data


def _optional_user(x_pulse_user: Optional[str]) -> Optional[dict]:
    try:
        data = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
        if data.get("user_id") and str(data.get("role") or "").lower() != "public":
            return data
    except Exception:
        return None
    return None


def _public_view(c: dict, viewer: Optional[dict]) -> dict:
    """Public projection of a provisional candidate. Deliberately excludes the
    claimer's identity (PII) and any Google-restricted content. Only the
    NON-copyrightable factual signals Google permits (name, locality, city,
    coarse lat/lng) are surfaced, WITHOUT reviews/photos/descriptions."""
    is_claimer = bool(viewer and c.get("claimed_by") and viewer.get("user_id") == c.get("claimed_by"))
    return {
        "name": c.get("name"),
        "locality": c.get("locality") or "",
        "city": c.get("city"),
        "city_slug": c.get("city_slug"),
        "teacher_slug": c.get("teacher_slug"),
        "classification": c.get("classification"),
        "claim_state": c.get("claim_state") or "PROVISIONAL",
        "is_claimer": is_claimer,
        # Coarse map centring only (no Place Details, no rich data).
        "lat": c.get("lat"),
        "lng": c.get("lng"),
        "data_source": "google_places",  # for attribution rendering
        # When set, this candidate has GRADUATED to a live verified NOSTOPS
        # profile — the provisional URL should permanently redirect there.
        "verified_handle": c.get("verified_handle") or None,
    }


# ── Classification ───────────────────────────────────────────────────────────
_ORG_WORDS = ("institute", "foundation", "trust", "society", "sansthan",
              "sanstha", "mission", "ashram", "peeth", "gurukul", "gurukulam",
              "federation", "association", "council", "sangha")
_STUDIO_WORDS = ("studio", "studios")
_CENTRE_WORDS = ("centre", "center")
_SCHOOL_WORDS = ("school", "vidyalaya", "vidyapeeth", "shala", "shaala")
_ACADEMY_WORDS = ("academy", "academ")
_RETREAT_WORDS = ("retreat", "resort", "wellness retreat")
_NONTEACHER_WORDS = ("gym", "fitness", "hospital", "clinic", "physiotherapy",
                     "physio", "spa", "salon", "dance", "zumba", "crossfit",
                     "college", "university", "hotel")
_YOGA_WORDS = ("yoga", "yog ", "yog,", "asana", "pranayama", "meditation",
               "dhyana", "kriya")
_PERSON_HINTS = ("guru", "acharya", "acharyaji", "master", "guruji", "yogi",
                 "yogini", "teacher", "instructor", "trainer", "therapist",
                 "with ", "by ", "coach", "mentor", "sensei")
_PERSON_HONORIFICS = (" ji", "ji's", "'s yoga", "s yoga with")


def _has(text: str, words) -> bool:
    return any(w in text for w in words)


def _looks_like_person(name: str) -> bool:
    n = name.lower().strip()
    if _has(n, _PERSON_HONORIFICS):
        return True
    if "yoga with " in n or "yoga by " in n:
        return True
    # "Firstname Lastname Yoga" / "Firstname's Yoga" style, 2–3 short tokens.
    if re.search(r"\b[a-z]+'s\b", n):
        return True
    return False


def classify(name: str, types) -> str:
    """Rule-based classification from the venue NAME + Google place `types`.
    Conservative: a studio/centre is NOT auto-treated as an individual teacher."""
    n = (name or "").lower()
    tset = {str(t).lower() for t in (types or [])}
    name_yoga = _has(n, _YOGA_WORDS)
    has_yoga = name_yoga or ("yoga_studio" in tset)

    # Gym/fitness/clinic/etc named in the title with NO yoga word in the name is
    # not a teacher — even if Google tagged a yoga_studio type.
    if _has(n, _NONTEACHER_WORDS) and not name_yoga:
        return "NON_TEACHER"
    # No yoga signal at all → not part of the teacher pool.
    if not has_yoga:
        return "NON_TEACHER"

    # Organisation / school / academy / retreat take precedence over studio.
    if _has(n, _RETREAT_WORDS):
        return "RETREAT_CENTRE"
    if _has(n, _ORG_WORDS):
        return "YOGA_ORGANISATION"
    if _has(n, _SCHOOL_WORDS):
        return "YOGA_SCHOOL"
    if _has(n, _ACADEMY_WORDS):
        return "YOGA_ACADEMY"
    if _has(n, _STUDIO_WORDS):
        return "YOGA_STUDIO"
    if _has(n, _CENTRE_WORDS):
        return "YOGA_CENTRE"

    # Individual-teacher signals (a real person behind the listing).
    if _looks_like_person(n):
        return "INDIVIDUAL_TEACHER"
    if _has(n, _PERSON_HINTS):
        # e.g. "Priya Yoga Instructor", "Yoga Trainer Rahul"
        return "INDIVIDUAL_TEACHER"

    # Has yoga signal but no studio/org/person marker → likely a small
    # teacher-run practice/business.
    return "TEACHER_BUSINESS"


# ── Slugs, locality, claim state ─────────────────────────────────────────────
# Claim lifecycle tracked ON the discovery candidate. The remaining conceptual
# states (PROFILE_INCOMPLETE → ONBOARDING → APPLICATION_SUBMITTED → EMPANELLED)
# are owned by the EXISTING NOSTOPS teacher-status system after the claim hands
# off — we never duplicate them here.
CLAIM_STATES = {"PROVISIONAL", "CLAIM_INVITED", "CLAIMED"}
CLAIMABLE_FROM = {"PROVISIONAL", "CLAIM_INVITED"}
# Only individual teachers / teacher-run practices get a claimable profile.
CLAIMABLE_CLASSES = {"INDIVIDUAL_TEACHER", "TEACHER_BUSINESS"}


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)


def locality_from(addr: str, name: str, city: str) -> str:
    parts = [p.strip() for p in (addr or "").split(",") if p.strip()]
    segs = []
    for p in parts:
        pl = p.lower()
        if pl == (city or "").lower() or pl == "india":
            continue
        if re.fullmatch(r"\d{5,6}", p.replace(" ", "")):
            continue
        segs.append(p)
    if segs and name and segs[0].lower() == name.lower():
        segs = segs[1:]
    if len(segs) >= 2:
        return segs[-2]
    return segs[0] if segs else ""


async def _unique_teacher_slug(city_slug: str, name: str, place_id: str) -> str:
    base = slugify(name) or "teacher"
    existing = await candidates.find_one({"city_slug": city_slug, "teacher_slug": base})
    if not existing or existing.get("google_place_id") == place_id:
        return base
    return f"{base}-{place_id[-6:].lower()}"


# ── Google Places client (official API, minimal fields) ──────────────────────
async def _google_search_page(query_text: str, page_token: Optional[str]) -> dict:
    """One Text Search (New) page. Retries transient 429/5xx up to 3x."""
    if FAKE:
        return _fake_page(query_text, page_token)
    if not GOOGLE_KEY:
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not configured on the backend.")
    body = {"textQuery": query_text, "pageSize": PAGE_SIZE}
    if page_token:
        body["pageToken"] = page_token
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    last_err = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post(PLACES_URL, json=body, headers=headers)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 500, 502, 503, 504):
                last_err = f"Google {r.status_code}"
                await asyncio.sleep(2 ** attempt)
                continue
            # Non-retryable (400/403 etc.) — surface the reason.
            raise RuntimeError(f"Google {r.status_code}: {r.text[:200]}")
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_err = f"network: {e}"
            await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"Google request failed after retries ({last_err}).")


def _fake_page(query_text: str, page_token: Optional[str]) -> dict:
    """Deterministic fake so the whole engine is testable without a key."""
    idx = int(page_token) if page_token else 0
    kind = query_text.split(" in ")[0]
    places = []
    for i in range(PAGE_SIZE):
        seed = f"{kind}-{idx}-{i}"
        names = [
            f"{kind.title()} Studio {idx}{i}",
            f"Ananda Yoga Centre {idx}{i}",
            f"Priya Sharma Yoga {idx}{i}",
            f"Yoga with Rahul {idx}{i}",
            f"Shivananda Yoga Institute {idx}{i}",
            f"Serenity Yoga Academy {idx}{i}",
            f"Blue Lotus Fitness Gym {idx}{i}",
        ]
        nm = names[(idx * PAGE_SIZE + i) % len(names)]
        places.append({
            "id": f"FAKE_{uuid.uuid5(uuid.NAMESPACE_DNS, seed).hex[:20]}",
            "displayName": {"text": nm},
            "types": ["yoga_studio", "point_of_interest", "establishment"],
            "location": {"latitude": 19.03 + i * 0.001, "longitude": 73.02 + i * 0.001},
            "formattedAddress": f"{nm}, Navi Mumbai, Maharashtra, India",
        })
    out = {"places": places}
    if idx + 1 < 3:  # 3 fake pages max
        out["nextPageToken"] = str(idx + 1)
    return out


# ── Background discovery job ──────────────────────────────────────────────────
async def _run_job(campaign_id: str, job_id: str):
    try:
        camp = await campaigns.find_one({"_id": campaign_id})
        if not camp:
            await _finish_job(job_id, "error", error="campaign not found")
            return
        city = camp["city"]
        target = int(camp.get("target") or 100)
        queries = camp.get("queries") or DEFAULT_QUERIES
        accept = set(camp.get("accept_types") or DEFAULT_ACCEPT)
        # CAMPAIGN/CITY cap (cumulative across runs) + GLOBAL monthly cap.
        campaign_cap = int(camp.get("max_requests") or DEFAULT_CAMPAIGN_REQUEST_CAP)
        requests_used_before = int(camp.get("requests_used") or 0)
        region = (camp.get("region") or "").strip()
        cells = camp.get("area_cells") or [city]
        # City-scoped text queries so cities never bleed into each other
        # (e.g. Delhi vs Gurgaon, Mumbai vs Navi Mumbai). Each query is anchored
        # to a specific area cell (+ region) within THIS city only.
        search_targets = []
        for cell in cells:
            for q in queries:
                anchor = cell if cell else city
                search_targets.append((f"{q} in {anchor}" + (f", {region}" if region else ""), q))

        requests_made = 0
        discovered = 0   # new candidate rows created this run
        accepted = 0     # accepted-type rows created this run
        rejected = 0     # non-accepted rows created this run
        dupes = 0        # skipped because place_id already known
        errors = []
        stop_reason = "completed"

        # Current accepted total already stored for this campaign (resume-safe).
        accepted_total = await candidates.count_documents(
            {"campaign_id": campaign_id, "status": "accepted"}
        )

        for query_text, base_query in search_targets:
            if accepted_total >= target:
                stop_reason = "target_reached"
                break
            token = None
            for _page in range(MAX_PAGES_PER_QUERY):
                if requests_made >= MAX_REQUESTS_PER_RUN:
                    stop_reason = "request_cap"
                    break
                if requests_used_before + requests_made >= campaign_cap:
                    stop_reason = "campaign_request_cap"
                    break
                if (await _global_usage()) >= MONTHLY_REQUEST_CAP:
                    stop_reason = "global_request_cap"
                    break
                if accepted_total >= target:
                    stop_reason = "target_reached"
                    break
                try:
                    data = await _google_search_page(query_text, token)
                    requests_made += 1
                    await _inc_global(1)
                except Exception as e:  # noqa: BLE001
                    errors.append({"query": query_text, "error": str(e)[:300]})
                    break  # stop this query; move to next
                for p in data.get("places", []):
                    pid = p.get("id")
                    if not pid:
                        continue
                    name = (p.get("displayName") or {}).get("text") or ""
                    types = p.get("types") or []
                    cls = classify(name, types)
                    is_accept = cls in accept
                    # Stop ACCEPTING once target hit (still record dupes count).
                    if is_accept and accepted_total >= target:
                        stop_reason = "target_reached"
                        break
                    loc = p.get("location") or {}
                    city_slug = slugify(city)
                    teacher_slug = await _unique_teacher_slug(city_slug, name, pid)
                    doc = {
                        "_id": oid(),
                        "campaign_id": campaign_id,
                        "google_place_id": pid,
                        "name": name,
                        "types": types,
                        "classification": cls,
                        "status": "accepted" if is_accept else "rejected",
                        "formatted_address": p.get("formattedAddress") or "",
                        "locality": locality_from(p.get("formattedAddress") or "", name, city),
                        "lat": loc.get("latitude"),
                        "lng": loc.get("longitude"),
                        "source_query": base_query,
                        "city": city,
                        "city_slug": city_slug,
                        "teacher_slug": teacher_slug,
                        "claim_state": "PROVISIONAL" if is_accept else None,
                        "claimed_by": None,
                        "claimed_at": None,
                        "created_at": now_ms(),
                    }
                    try:
                        await candidates.insert_one(doc)
                        discovered += 1
                        if is_accept:
                            accepted += 1
                            accepted_total += 1
                        else:
                            rejected += 1
                    except Exception:
                        # Duplicate google_place_id (unique index) — never a dup row.
                        dupes += 1
                await jobs.update_one({"_id": job_id}, {"$set": {
                    "requests_made": requests_made, "discovered": discovered,
                    "accepted": accepted, "rejected": rejected, "duplicates": dupes,
                    "accepted_total": accepted_total, "updated_at": now_ms(),
                }})
                token = data.get("nextPageToken")
                if not token:
                    break
                await asyncio.sleep(TOKEN_WAIT_S)
            if stop_reason in ("request_cap", "campaign_request_cap", "global_request_cap"):
                break
            await asyncio.sleep(REQ_DELAY_S)

        # Determine terminal status: target → completed; a cost cap → auto-pause
        # THIS campaign only (other cities keep running); otherwise unchanged.
        requests_used_total = requests_used_before + requests_made
        if accepted_total >= target:
            new_status = "completed"
        elif stop_reason in ("campaign_request_cap", "global_request_cap"):
            new_status = "paused"
        else:
            new_status = camp.get("status", "active")
        await campaigns.update_one({"_id": campaign_id}, {"$set": {
            "last_run_at": now_ms(),
            "accepted_total": accepted_total,
            "requests_used": requests_used_total,
            "status": new_status,
            "pause_reason": stop_reason if new_status == "paused" else None,
        }})
        await _finish_job(job_id, "done", extra={
            "requests_made": requests_made, "discovered": discovered,
            "accepted": accepted, "rejected": rejected, "duplicates": dupes,
            "accepted_total": accepted_total, "stop_reason": stop_reason,
            "errors": errors,
        })
    except Exception as e:  # noqa: BLE001
        await _finish_job(job_id, "error", error=str(e)[:500])
    finally:
        _running.discard(campaign_id)


async def _finish_job(job_id: str, status: str, error: str = "", extra: dict = None):
    upd = {"status": status, "finished_at": now_ms(), "updated_at": now_ms()}
    if error:
        upd["error"] = error
    if extra:
        upd.update(extra)
    await jobs.update_one({"_id": job_id}, {"$set": upd})


# ── Pydantic payloads ────────────────────────────────────────────────────────
class CampaignIn(BaseModel):
    city: str = Field(min_length=2, max_length=120)
    target: int = Field(default=100, ge=1, le=2000)
    queries: Optional[list[str]] = None
    accept_types: Optional[list[str]] = None
    max_requests: Optional[int] = Field(default=None, ge=1, le=5000)
    region: Optional[str] = None            # e.g. "Delhi NCR", "Maharashtra"
    area_cells: Optional[list[str]] = None  # sub-areas to search within the city


class CampaignPatch(BaseModel):
    status: Optional[str] = None            # active | paused | completed | stopped
    target: Optional[int] = Field(default=None, ge=1, le=2000)
    queries: Optional[list[str]] = None
    accept_types: Optional[list[str]] = None
    max_requests: Optional[int] = Field(default=None, ge=1, le=5000)
    region: Optional[str] = None
    area_cells: Optional[list[str]] = None


# ── Endpoints (admin only) ───────────────────────────────────────────────────
async def _stats(campaign_id: str) -> dict:
    pipeline = [
        {"$match": {"campaign_id": campaign_id}},
        {"$group": {"_id": "$classification", "n": {"$sum": 1}}},
    ]
    by_class = {r["_id"]: r["n"] async for r in candidates.aggregate(pipeline)}
    accepted = await candidates.count_documents({"campaign_id": campaign_id, "status": "accepted"})
    rejected = await candidates.count_documents({"campaign_id": campaign_id, "status": "rejected"})
    return {"by_classification": by_class, "accepted": accepted, "rejected": rejected,
            "total": accepted + rejected}


@router.get("/health")
async def health():
    return {"ok": True, "google_key_configured": bool(GOOGLE_KEY), "fake_mode": FAKE}


@router.post("/campaigns")
async def create_campaign(payload: CampaignIn, user: dict = Depends(admin_user)):
    await _ensure_indexes()
    city = payload.city.strip()
    if city not in SUPPORTED_CITIES:
        raise HTTPException(400, f"Unsupported city. Choose one of: {', '.join(SUPPORTED_CITIES)}")
    queries = [q.strip() for q in (payload.queries or DEFAULT_QUERIES) if q and q.strip()]
    accept = [a.strip().upper() for a in (payload.accept_types or DEFAULT_ACCEPT) if a.strip().upper() in CLASSIFICATIONS]
    # ONE campaign per city. If a campaign already exists for this city, REUSE it
    # (re-activate + apply any provided settings) instead of creating a duplicate.
    existing = await campaigns.find_one({"city": city})
    if existing:
        upd: dict = {"status": "active"}
        if payload.target:
            upd["target"] = payload.target
        if payload.queries:
            upd["queries"] = queries or DEFAULT_QUERIES
        if payload.accept_types:
            upd["accept_types"] = accept or DEFAULT_ACCEPT
        if payload.max_requests:
            upd["max_requests"] = payload.max_requests
        if payload.region is not None:
            upd["region"] = (payload.region or "").strip() or None
        if payload.area_cells is not None:
            upd["area_cells"] = [a.strip() for a in payload.area_cells if a and a.strip()] or None
        await campaigns.update_one({"_id": existing["_id"]}, {"$set": upd})
        fresh = await campaigns.find_one({"_id": existing["_id"]})
        return {"campaign": fresh, "reused": True}
    doc = {
        "_id": oid(), "city": payload.city.strip(), "target": payload.target,
        "queries": queries or DEFAULT_QUERIES, "accept_types": accept or DEFAULT_ACCEPT,
        "status": "active", "accepted_total": 0,
        "max_requests": payload.max_requests or DEFAULT_CAMPAIGN_REQUEST_CAP,
        "requests_used": 0, "region": (payload.region or "").strip() or None,
        "area_cells": [a.strip() for a in (payload.area_cells or []) if a and a.strip()] or None,
        "created_by": user.get("user_id"), "created_at": now_ms(), "last_run_at": None,
    }
    await campaigns.insert_one(doc)
    return {"campaign": doc}


@router.get("/campaigns")
async def list_campaigns(user: dict = Depends(admin_user)):
    await _ensure_indexes()
    items = [c async for c in campaigns.find().sort("created_at", -1).limit(100)]
    for c in items:
        c["stats"] = await _stats(c["_id"])
    return {"items": items}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, user: dict = Depends(admin_user)):
    c = await campaigns.find_one({"_id": campaign_id})
    if not c:
        raise HTTPException(404, "campaign not found")
    c["stats"] = await _stats(campaign_id)
    last = await jobs.find_one({"campaign_id": campaign_id}, sort=[("created_at", -1)])
    c["last_job"] = last
    c["running"] = campaign_id in _running
    return {"campaign": c}


@router.patch("/campaigns/{campaign_id}")
async def patch_campaign(campaign_id: str, payload: CampaignPatch, user: dict = Depends(admin_user)):
    sets = {}
    if payload.status in ("active", "paused", "completed", "stopped"):
        sets["status"] = payload.status
    if payload.target is not None:
        sets["target"] = payload.target
    if payload.queries is not None:
        sets["queries"] = [q.strip() for q in payload.queries if q and q.strip()] or DEFAULT_QUERIES
    if payload.max_requests is not None:
        sets["max_requests"] = payload.max_requests
    if payload.region is not None:
        sets["region"] = payload.region.strip() or None
    if payload.area_cells is not None:
        sets["area_cells"] = [a.strip() for a in payload.area_cells if a and a.strip()] or None
    if payload.accept_types is not None:
        acc = [a.strip().upper() for a in payload.accept_types if a.strip().upper() in CLASSIFICATIONS]
        sets["accept_types"] = acc or DEFAULT_ACCEPT
    if not sets:
        raise HTTPException(400, "nothing to update")
    r = await campaigns.update_one({"_id": campaign_id}, {"$set": sets})
    if r.matched_count == 0:
        raise HTTPException(404, "campaign not found")
    return {"ok": True, "updated": sets}


@router.post("/campaigns/{campaign_id}/run")
async def run_campaign(campaign_id: str, user: dict = Depends(admin_user)):
    await _ensure_indexes()
    camp = await campaigns.find_one({"_id": campaign_id})
    if not camp:
        raise HTTPException(404, "campaign not found")
    if camp.get("status") in ("paused", "stopped"):
        raise HTTPException(400, f"campaign is {camp.get('status')}")
    if campaign_id in _running:
        raise HTTPException(409, "a discovery job is already running for this campaign")
    if not GOOGLE_KEY and not FAKE:
        raise HTTPException(400, "GOOGLE_MAPS_API_KEY is not configured on the backend.")
    job = {
        "_id": oid(), "campaign_id": campaign_id, "status": "running",
        "requests_made": 0, "discovered": 0, "accepted": 0, "rejected": 0,
        "duplicates": 0, "accepted_total": camp.get("accepted_total", 0),
        "max_requests": MAX_REQUESTS_PER_RUN, "target": camp.get("target"),
        "created_at": now_ms(), "updated_at": now_ms(), "finished_at": None,
    }
    await jobs.insert_one(job)
    _running.add(campaign_id)
    asyncio.create_task(_run_job(campaign_id, job["_id"]))
    return {"ok": True, "job_id": job["_id"], "status": "running"}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(admin_user)):
    j = await jobs.find_one({"_id": job_id})
    if not j:
        raise HTTPException(404, "job not found")
    return {"job": j}


@router.get("/campaigns/{campaign_id}/candidates")
async def list_candidates(
    campaign_id: str,
    user: dict = Depends(admin_user),
    status: Optional[str] = Query(None),
    classification: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    q: dict = {"campaign_id": campaign_id}
    if status:
        q["status"] = status
    if classification:
        q["classification"] = classification.upper()
    total = await candidates.count_documents(q)
    items = [c async for c in candidates.find(q).sort("created_at", -1).skip(skip).limit(limit)]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


# ── PUBLIC provisional profile + FREE claim ──────────────────────────────────
async def _find_claimable(city_slug: str, teacher_slug: str) -> Optional[dict]:
    c = await candidates.find_one({"city_slug": city_slug, "teacher_slug": teacher_slug})
    if not c:
        return None
    # Only accepted, teacher-type candidates have a real provisional profile.
    if c.get("status") != "accepted" or c.get("classification") not in CLAIMABLE_CLASSES:
        return None
    return c


@router.get("/public/provisional/{city_slug}/{teacher_slug}")
async def public_provisional(
    city_slug: str,
    teacher_slug: str,
    _ok: bool = Depends(secret_only),
    x_pulse_user: Optional[str] = Header(None),
):
    await _ensure_indexes()
    c = await _find_claimable(city_slug, teacher_slug)
    if not c:
        raise HTTPException(status_code=404, detail="No provisional profile here.")
    return {"profile": _public_view(c, _optional_user(x_pulse_user)), "indexable": _indexable(c)}


def _indexable(c: dict) -> bool:
    """Owner rule: a provisional page may be indexed (and listed in the sitemap +
    site search) once a teacher has CLAIMED it — the claim is their consent.
    Unclaimed / invited listings, admin-excluded entries and graduated entries
    (which redirect to the live profile) stay noindex."""
    return (
        (c.get("claim_state") or "PROVISIONAL") == "CLAIMED"
        and not c.get("verified_handle")
        and c.get("admin_status") not in EXCLUDED_ADMIN
    )


@router.get("/public/claimed")
async def public_claimed(city_slug: Optional[str] = Query(default=None, max_length=80),
                         _ok: bool = Depends(secret_only)):
    """Every claimed (indexable) provisional listing — feeds the sitemap and, with
    ?city_slug=, the city teacher page. Same factual fields the page shows; never
    the claimer's identity."""
    await _ensure_indexes()
    filt = {
        "status": "accepted",
        "classification": {"$in": list(CLAIMABLE_CLASSES)},
        "claim_state": "CLAIMED",
        "admin_status": {"$nin": EXCLUDED_ADMIN},
        "$or": [{"verified_handle": {"$exists": False}}, {"verified_handle": None}, {"verified_handle": ""}],
    }
    if city_slug:
        filt["city_slug"] = city_slug.strip().lower()
    items = []
    async for c in candidates.find(filt).sort("claimed_at", -1).limit(5000):
        if not (c.get("city_slug") and c.get("teacher_slug")):
            continue
        items.append({
            "name": c.get("name"),
            "locality": c.get("locality") or "",
            "city": c.get("city"),
            "city_slug": c.get("city_slug"),
            "teacher_slug": c.get("teacher_slug"),
            "claimed_at": c.get("claimed_at"),
            # The claimer has finished their teacher profile (not yet linked to this listing by an admin).
            "profile_done": bool(c.get("profile_completed_at") or c.get("onboarding_stage") in ONBOARDING_STAGES),
        })
    return {"items": items}


@router.get("/public/search")
async def public_search(
    q: str = Query("", max_length=80),
    city: Optional[str] = Query(None),
    _ok: bool = Depends(secret_only),
):
    """Public, search-visible claim-hub lookup: find claimable provisional
    entries by name / locality (optionally within a city). Returns ONLY the
    same non-restricted factual signals the provisional page shows (name +
    area). Graduated (verified) entries are excluded — they live at their real
    profile. A short query is required so this never dumps the whole store."""
    await _ensure_indexes()
    term = (q or "").strip()
    if len(term) < 2:
        return {"items": [], "query": term, "city": (city or None)}
    rx = re.compile(re.escape(term), re.I)
    filt: dict = {
        "status": "accepted",
        "classification": {"$in": list(CLAIMABLE_CLASSES)},
        "admin_status": {"$nin": EXCLUDED_ADMIN},
        "$or": [{"name": rx}, {"locality": rx}],
    }
    if city and city.strip():
        filt["city_slug"] = slugify(city.strip())
    items = []
    async for c in candidates.find(filt).limit(60):
        if c.get("verified_handle"):  # graduated → excluded (missing-field safe)
            continue
        items.append({
            "name": c.get("name"),
            "locality": c.get("locality") or "",
            "city": c.get("city"),
            "city_slug": c.get("city_slug"),
            "teacher_slug": c.get("teacher_slug"),
            "claim_state": c.get("claim_state") or "PROVISIONAL",
        })
        if len(items) >= 24:
            break
    # Unclaimed first, then alphabetical — the searcher's own entry is claimable.
    items.sort(key=lambda x: (x["claim_state"] == "CLAIMED", (x["name"] or "").lower()))
    return {"items": items, "query": term, "city": (city or None)}


@router.get("/claim/{city_slug}/{teacher_slug}/status")
async def claim_status(
    city_slug: str, teacher_slug: str, user: dict = Depends(signed_in_user),
):
    c = await _find_claimable(city_slug, teacher_slug)
    if not c:
        raise HTTPException(status_code=404, detail="No provisional profile here.")
    state = c.get("claim_state") or "PROVISIONAL"
    return {
        "claim_state": state,
        "claimed": state == "CLAIMED",
        "is_claimer": bool(c.get("claimed_by") and c["claimed_by"] == user["user_id"]),
    }


@router.get("/my-claim")
async def my_pending_claim(user: dict = Depends(signed_in_user)):
    """The signed-in account's own claimed-but-not-yet-live provisional listing.

    Used by the web app to route a teacher who has CLAIMED a provisional profile
    (but not yet completed onboarding on the remote backend) straight into the
    "Start Onboarding" empty state, and to pre-fill the onboarding wizard from the
    factual listing details. Returns null once the listing graduates to a live
    verified profile (verified_handle set) — by then they are a real teacher."""
    await _ensure_indexes()
    c = await candidates.find_one(
        {
            "claimed_by": user["user_id"],
            "claim_state": "CLAIMED",
            "$or": [{"verified_handle": {"$exists": False}}, {"verified_handle": None}],
        },
        sort=[("claimed_at", -1)],
    )
    if not c:
        return {"claim": None}
    em = _user_email(user)
    if em and c.get("claimed_by_email") != em:  # claims made before emails were kept: fill in on next visit
        await candidates.update_one({"_id": c["_id"]}, {"$set": {"claimed_by_email": em}})
    return {
        "claim": {
            "name": c.get("name") or "",
            "locality": c.get("locality") or "",
            "city": c.get("city") or "",
            "city_slug": c.get("city_slug"),
            "teacher_slug": c.get("teacher_slug"),
        }
    }


_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$")


def _user_email(user: dict) -> str:
    e = str(user.get("email") or "").strip().lower()[:200]
    return e if _EMAIL_RE.match(e) else ""


@router.post("/my-claim/profile-complete")
async def my_claim_profile_complete(user: dict = Depends(signed_in_user)):
    """The claimer finished their teacher profile in the web app → stop the finish-your-profile reminders.
    Idempotent; only ever touches the signed-in account's own claims."""
    await _ensure_indexes()
    res = await candidates.update_many(
        {"claimed_by": user["user_id"], "claim_state": "CLAIMED", "profile_completed_at": None},
        {"$set": {"profile_completed_at": now_ms()}},
    )
    return {"updated": res.modified_count}


class ClaimIn(BaseModel):
    is_authorised: bool = False


@router.post("/claim/{city_slug}/{teacher_slug}")
async def claim_profile(
    city_slug: str, teacher_slug: str, payload: ClaimIn, user: dict = Depends(signed_in_user),
):
    """FREE claim. No payment. Verification = the claimant is a signed-in,
    (OTP/email)-verified NOSTOPS account (handled by the existing auth system)
    who confirms they are the teacher or an authorised representative."""
    await _ensure_indexes()
    c = await _find_claimable(city_slug, teacher_slug)
    if not c:
        raise HTTPException(status_code=404, detail="No provisional profile here.")
    if not payload.is_authorised:
        raise HTTPException(
            status_code=400,
            detail="Please confirm you are this teacher or an authorised representative.",
        )
    state = c.get("claim_state") or "PROVISIONAL"
    if state == "CLAIMED":
        if c.get("claimed_by") == user["user_id"]:
            return {"ok": True, "claim_state": "CLAIMED", "is_claimer": True, "already": True}
        # Claimed by someone else — do not expose who.
        raise HTTPException(status_code=409, detail="This profile has already been claimed.")
    if state not in CLAIMABLE_FROM:
        raise HTTPException(status_code=409, detail="This profile cannot be claimed.")
    # Atomic single-winner claim (guards against a duplicate race).
    res = await candidates.update_one(
        {"_id": c["_id"], "claim_state": {"$in": list(CLAIMABLE_FROM)}},
        {"$set": {
            "claim_state": "CLAIMED",
            "claimed_by": user["user_id"],
            "claimed_by_name": user.get("name") or "",
            "claimed_at": now_ms(),
            # Kept server-side only (never in a public view) — for the finish-your-profile reminders.
            **({"claimed_by_email": em} if (em := _user_email(user)) else {}),
        }},
    )
    if res.modified_count == 0:
        # Someone claimed between our read and write.
        fresh = await candidates.find_one({"_id": c["_id"]})
        if fresh and fresh.get("claimed_by") == user["user_id"]:
            return {"ok": True, "claim_state": "CLAIMED", "is_claimer": True, "already": True}
        raise HTTPException(status_code=409, detail="This profile has already been claimed.")
    return {"ok": True, "claim_state": "CLAIMED", "is_claimer": True}


# ── Admin: cities, funnel analytics, candidate management, export ─────────────
ONBOARDING_STAGES = ["PROFILE_COMPLETE", "APPLICATION", "EMPANELLED"]
ADMIN_STATUSES = {"approved", "rejected", "irrelevant", "duplicate"}
EXCLUDED_ADMIN = ["irrelevant", "duplicate", "rejected"]


@router.get("/cities")
async def cities_config(user: dict = Depends(admin_user)):
    """Supported cities + whether each currently has any campaign (active or not).
    Nothing is auto-activated; a city is 'active' only if it has an active campaign."""
    out = []
    for name in SUPPORTED_CITIES:
        camps = [c async for c in campaigns.find({"city": name})]
        active = any(c.get("status") == "active" for c in camps)
        out.append({
            "city": name, "slug": slugify(name),
            "campaign_count": len(camps), "active": active,
            "is_pilot": name == "Navi Mumbai",
        })
    return {"cities": out}


async def _funnel(match: dict) -> dict:
    relevant_match = {**match, "status": "accepted",
                      "classification": {"$in": list(CLAIMABLE_CLASSES)},
                      "admin_status": {"$nin": EXCLUDED_ADMIN}}
    discovered = await candidates.count_documents(match)
    relevant = await candidates.count_documents(relevant_match)
    provisional = await candidates.count_documents({**relevant_match, "claim_state": {"$ne": None}})
    invited = await candidates.count_documents({**match, "invited_at": {"$ne": None}})
    claimed = await candidates.count_documents({**match, "claim_state": "CLAIMED"})
    completed = await candidates.count_documents({**match, "onboarding_stage": {"$in": ONBOARDING_STAGES}})
    applications = await candidates.count_documents({**match, "onboarding_stage": {"$in": ["APPLICATION", "EMPANELLED"]}})
    empanelled = await candidates.count_documents({**match, "onboarding_stage": "EMPANELLED"})

    def rate(n, d):
        return round(n / d, 4) if d else 0.0
    return {
        "funnel": {
            "discovered": discovered, "relevant": relevant, "provisional": provisional,
            "invited": invited, "claimed": claimed, "profile_complete": completed,
            "applications": applications, "empanelled": empanelled,
        },
        "rates": {
            "claim_rate": rate(claimed, invited),
            "profile_completion_rate": rate(completed, claimed),
            "application_rate": rate(applications, claimed),
            "empanelment_rate": rate(empanelled, applications),
        },
    }


async def _group_count(match: dict, field: str) -> dict:
    pipe = [{"$match": match}, {"$group": {"_id": f"${field}", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}}]
    return {(r["_id"] or "—"): r["n"] async for r in candidates.aggregate(pipe)}


@router.get("/analytics")
async def analytics(user: dict = Depends(admin_user)):
    await _ensure_indexes()
    overall = await _funnel({})
    # Per-city breakdown (candidates / claims / applications).
    per_city = {}
    for name in SUPPORTED_CITIES:
        m = {"city": name}
        cand = await candidates.count_documents(m)
        if cand == 0:
            continue
        per_city[name] = {
            "candidates": cand,
            "invited": await candidates.count_documents({**m, "invited_at": {"$ne": None}}),
            "claims": await candidates.count_documents({**m, "claim_state": "CLAIMED"}),
            "applications": await candidates.count_documents({**m, "onboarding_stage": {"$in": ["APPLICATION", "EMPANELLED"]}}),
        }
    by_query = await _group_count({}, "source_query")
    by_class = await _group_count({}, "classification")

    # API USAGE (NOT billing) — every discovery request is a minimal ID-first
    # Text Search (New); we never request Place Details / rich data.
    total_requests = 0
    async for j in jobs.find({}):
        total_requests += int(j.get("requests_made") or 0)
    global_used = await _global_usage()
    usage = {
        "api_requests": total_requests,
        "discovery_requests": total_requests,
        "id_only_requests": total_requests,   # minimal field-mask search only
        "rich_data_requests": 0,              # Place Details never called
        "max_requests_per_run": MAX_REQUESTS_PER_RUN,
        "max_pages_per_query": MAX_PAGES_PER_QUERY,
        "campaign_request_cap_default": DEFAULT_CAMPAIGN_REQUEST_CAP,
        "monthly_request_cap": MONTHLY_REQUEST_CAP,
        "monthly_requests_used": global_used,
        "monthly_requests_remaining": max(MONTHLY_REQUEST_CAP - global_used, 0),
        "month": _month(),
        "note": "API USAGE — request counts only, not a billing figure.",
    }

    # Campaign performance + hard-stop status.
    camps = []
    async for c in campaigns.find().sort("created_at", -1):
        last = await jobs.find_one({"campaign_id": c["_id"]}, sort=[("created_at", -1)])
        accepted_total = c.get("accepted_total", 0)
        target = c.get("target") or 0
        stop_reason = (last or {}).get("stop_reason")
        req_used = int(c.get("requests_used") or 0)
        req_cap = int(c.get("max_requests") or DEFAULT_CAMPAIGN_REQUEST_CAP)
        hard_stop = (
            accepted_total >= target > 0
            or stop_reason in ("request_cap", "campaign_request_cap", "global_request_cap")
            or req_used >= req_cap
            or global_used >= MONTHLY_REQUEST_CAP
            or c.get("status") in ("completed", "stopped", "paused")
        )
        camps.append({
            "id": c["_id"], "city": c["city"], "target": target,
            "status": c.get("status"), "accepted_total": accepted_total,
            "candidates_remaining": max(target - accepted_total, 0),
            "requests_made": (last or {}).get("requests_made", 0),
            "requests_used": req_used, "max_requests": req_cap,
            "requests_remaining": max(req_cap - req_used, 0),
            "region": c.get("region"), "area_cells": c.get("area_cells"),
            "last_stop_reason": stop_reason, "pause_reason": c.get("pause_reason"),
            "discovery_paused": hard_stop,
            "created_at": c.get("created_at"), "last_run_at": c.get("last_run_at"),
        })
    return {
        **overall, "per_city": per_city, "by_query": by_query,
        "by_classification": by_class, "usage": usage, "campaigns": camps,
    }


@router.post("/campaigns/activate-launch")
async def activate_launch(user: dict = Depends(admin_user)):
    """Idempotently create/activate ONE independent campaign per launch city
    (target 100 each). Never creates a single 900-result bulk operation — each
    city is its own record with its own metrics, caps and controls. Does NOT run
    any discovery (explicit admin action required per city)."""
    await _ensure_indexes()
    result = []
    for name in SUPPORTED_CITIES:
        existing = await campaigns.find_one({"city": name})
        if existing:
            # Re-activate + ensure a target without duplicating the campaign.
            await campaigns.update_one({"_id": existing["_id"]}, {"$set": {
                "status": "active",
                "target": existing.get("target") or 100,
                "max_requests": existing.get("max_requests") or DEFAULT_CAMPAIGN_REQUEST_CAP,
            }})
            result.append({"city": name, "id": existing["_id"], "created": False, "status": "active"})
        else:
            doc = {
                "_id": oid(), "city": name, "target": 100,
                "queries": DEFAULT_QUERIES, "accept_types": DEFAULT_ACCEPT,
                "status": "active", "accepted_total": 0,
                "max_requests": DEFAULT_CAMPAIGN_REQUEST_CAP, "requests_used": 0,
                "region": None, "area_cells": None,
                "created_by": user.get("user_id"), "created_at": now_ms(), "last_run_at": None,
            }
            await campaigns.insert_one(doc)
            result.append({"city": name, "id": doc["_id"], "created": True, "status": "active"})
    return {"ok": True, "cities": result, "total_target": sum(100 for _ in result),
            "note": "Nine independent city campaigns active. Run each explicitly; discovery needs GOOGLE_MAPS_API_KEY."}


@router.post("/campaigns/dedupe")
async def dedupe_campaigns(user: dict = Depends(admin_user)):
    """One campaign per city. Where a city has more than one campaign (legacy
    duplicates), KEEP the one holding the most candidates (tie → oldest),
    reassign every candidate from the duplicates onto the keeper, then delete
    the empty duplicates and their jobs. google_place_id is globally unique, so
    reassigning campaign_id can never create a duplicate candidate row."""
    await _ensure_indexes()
    from collections import defaultdict
    by_city: dict = defaultdict(list)
    async for c in campaigns.find():
        by_city[c["city"]].append(c)
    merged = []
    for city, camps in by_city.items():
        if len(camps) <= 1:
            continue
        counts = {}
        for c in camps:
            counts[c["_id"]] = await candidates.count_documents({"campaign_id": c["_id"]})
        keeper = max(camps, key=lambda c: (counts[c["_id"]], -(c.get("created_at") or 0)))
        losers = [c for c in camps if c["_id"] != keeper["_id"]]
        moved = 0
        for l in losers:
            r = await candidates.update_many({"campaign_id": l["_id"]}, {"$set": {"campaign_id": keeper["_id"]}})
            moved += r.modified_count
            await jobs.delete_many({"campaign_id": l["_id"]})
            await campaigns.delete_one({"_id": l["_id"]})
        acc = await candidates.count_documents({"campaign_id": keeper["_id"], "status": "accepted"})
        new_status = keeper.get("status") if keeper.get("status") != "stopped" else "active"
        await campaigns.update_one({"_id": keeper["_id"]}, {"$set": {"accepted_total": acc, "status": new_status}})
        merged.append({"city": city, "kept": keeper["_id"],
                       "removed": [l["_id"] for l in losers],
                       "candidates_moved": moved, "accepted_total": acc})
    return {"ok": True, "merged": merged, "cities_deduped": len(merged)}


@router.get("/campaigns/{campaign_id}/analytics")
async def campaign_analytics(campaign_id: str, user: dict = Depends(admin_user)):
    c = await campaigns.find_one({"_id": campaign_id})
    if not c:
        raise HTTPException(404, "campaign not found")
    f = await _funnel({"campaign_id": campaign_id})
    by_query = await _group_count({"campaign_id": campaign_id}, "source_query")
    last = await jobs.find_one({"campaign_id": campaign_id}, sort=[("created_at", -1)])
    return {**f, "by_query": by_query, "campaign": {
        "id": c["_id"], "city": c["city"], "target": c.get("target"),
        "status": c.get("status"), "accepted_total": c.get("accepted_total", 0),
        "last_job": last,
    }}


class CandidateAction(BaseModel):
    action: str  # mark_irrelevant | mark_duplicate | approve | reject | invite | resend_invite | set_stage | clear | unclaim | link_verified | unlink_verified
    stage: Optional[str] = None  # for set_stage
    handle: Optional[str] = None  # for link_verified (the live profile slug)


@router.post("/candidates/{candidate_id}/action")
async def candidate_action(candidate_id: str, payload: CandidateAction, user: dict = Depends(admin_user)):
    c = await candidates.find_one({"_id": candidate_id})
    if not c:
        raise HTTPException(404, "candidate not found")
    a = payload.action
    sets: dict = {}
    if a == "mark_irrelevant":
        sets = {"admin_status": "irrelevant"}
    elif a == "mark_duplicate":
        sets = {"admin_status": "duplicate"}
    elif a == "approve":
        sets = {"admin_status": "approved"}
    elif a == "reject":
        sets = {"admin_status": "rejected"}
    elif a == "clear":
        sets = {"admin_status": None}
    elif a == "unclaim":
        # Admin reversal of a wrongful/squatted claim → frees the profile for
        # the genuine teacher. Resets ownership + any onboarding stage.
        sets = {
            "claim_state": "CLAIM_INVITED" if c.get("invited_at") else "PROVISIONAL",
            "claimed_by": None, "claimed_by_name": "", "claimed_at": None,
            "onboarding_stage": None,
        }
    elif a in ("invite", "resend_invite"):
        if c.get("status") != "accepted" or c.get("classification") not in CLAIMABLE_CLASSES:
            raise HTTPException(400, "Only relevant teacher candidates can be invited.")
        sets = {"invited_at": now_ms(), "invite_count": int(c.get("invite_count") or 0) + 1}
        # Advance PROVISIONAL → CLAIM_INVITED (never downgrade a real claim).
        if (c.get("claim_state") or "PROVISIONAL") == "PROVISIONAL":
            sets["claim_state"] = "CLAIM_INVITED"
    elif a == "set_stage":
        if payload.stage not in ONBOARDING_STAGES and payload.stage is not None:
            raise HTTPException(400, f"stage must be one of {ONBOARDING_STAGES} or null")
        sets = {"onboarding_stage": payload.stage}
    elif a == "link_verified":
        # Graduation: point this provisional entry at the teacher's LIVE verified
        # profile. From now on the provisional URL permanently redirects there.
        h = slugify(payload.handle or "")
        if not h:
            raise HTTPException(400, "A verified profile handle is required.")
        if c.get("claim_state") != "CLAIMED":
            raise HTTPException(400, "Only a claimed profile can be linked to a verified profile.")
        sets = {"verified_handle": h, "onboarding_stage": "EMPANELLED"}
    elif a == "unlink_verified":
        sets = {"verified_handle": None}
    else:
        raise HTTPException(400, "unknown action")
    await candidates.update_one({"_id": candidate_id}, {"$set": sets})
    return {"ok": True, "updated": sets}


@router.get("/campaigns/{campaign_id}/export")
async def export_candidates(campaign_id: str, user: dict = Depends(admin_user)):
    """CSV export of campaign candidates. Contains only NON-restricted factual
    fields (no Google reviews/photos/descriptions)."""
    import csv
    import io
    c = await campaigns.find_one({"_id": campaign_id})
    if not c:
        raise HTTPException(404, "campaign not found")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "locality", "city", "classification", "status",
                "admin_status", "claim_state", "onboarding_stage", "invited",
                "source_query", "google_place_id", "created_at"])
    async for x in candidates.find({"campaign_id": campaign_id}).sort("created_at", -1):
        w.writerow([
            x.get("name", ""), x.get("locality", ""), x.get("city", ""),
            x.get("classification", ""), x.get("status", ""),
            x.get("admin_status") or "", x.get("claim_state") or "",
            x.get("onboarding_stage") or "", "yes" if x.get("invited_at") else "no",
            x.get("source_query", ""), x.get("google_place_id", ""),
            x.get("created_at", ""),
        ])
    from fastapi.responses import Response
    return Response(
        content=buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="discovery-{c["city"].replace(" ", "-").lower()}.csv"'},
    )


