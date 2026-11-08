"""
NOSTOPS Venue Centers — local fallback store (ISOLATED, additive).

The remote business endpoint `POST /retreats/centers` is currently returning
HTTP 500 for every eligible owner (verified: minimal valid payload also 500s),
which blocks all venue creation. The remote backend is frozen and cannot be
edited here, so — following the same proven pattern as knowledge.py / audit.py /
voices.py — this module provides a local persistence fallback for venue
"centers" in the local `nostops_web` Mongo (`venue_centers`).

The Next.js BFF tries the remote first and falls back to this store, and the
owner's Venue Studio merges local centers with remote ones. When the remote
endpoint is fixed, remote-first behaviour resumes automatically.

Security mirrors the other local modules: shared-secret header + a server-set
`X-Pulse-User` identity (the browser never holds the secret).
"""
import base64
import difflib
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Optional

from captcha.image import ImageCaptcha
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from email_util import send_email

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/venues", tags=["venues-local"])


def now_ms() -> int:
    return int(time.time() * 1000)


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
    return data


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    """Shared-secret-only guard for endpoints the BFF calls without a user
    identity (public submission intake, published-venues read)."""
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


class CenterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=80)
    capacity: int = Field(ge=1, le=1000)
    state: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=200)
    pincode: str = Field(default="", max_length=12)
    country: str = Field(default="", max_length=60)
    food_type: str = Field(default="", max_length=40)
    distinguishing_feature: str = Field(default="", max_length=500)
    amenities: list[str] = Field(default_factory=list)
    room_types: list[str] = Field(default_factory=list)
    open_to_partnerships: bool = True
    is_active: bool = True
    website_or_maps_url: str = Field(default="", max_length=400)
    photos: list[str] = Field(default_factory=list)


def _clean_list(v: list[str]) -> list[str]:
    out = []
    for x in v or []:
        if isinstance(x, str) and x.strip():
            out.append(x.strip()[:60])
        if len(out) >= 30:
            break
    return out


def _public(doc: dict) -> dict:
    return {
        "center_id": doc["_id"],
        "name": doc.get("name"),
        "city": doc.get("city"),
        "state": doc.get("state") or None,
        "address": doc.get("address") or None,
        "pincode": doc.get("pincode") or None,
        "country": doc.get("country") or None,
        "capacity": doc.get("capacity"),
        "amenities": doc.get("amenities", []),
        "food_type": doc.get("food_type") or None,
        "room_types": doc.get("room_types", []),
        "photos": doc.get("photos", []),
        "distinguishing_feature": doc.get("distinguishing_feature") or None,
        "website_or_maps_url": doc.get("website_or_maps_url") or None,
        "open_to_partnerships": doc.get("open_to_partnerships", True),
        "is_active": doc.get("is_active", True),
        "is_local": True,
        "created_at": doc.get("created_at"),
    }


@router.post("/centers")
async def create_center(payload: CenterIn, user: dict = Depends(current_user)):
    t = now_ms()
    cid = f"loc_{uuid.uuid4().hex}"
    doc = {
        "_id": cid,
        "owner_id": str(user.get("user_id")),
        "owner_name": str(user.get("name") or ""),
        "name": payload.name.strip()[:120],
        "city": payload.city.strip()[:80],
        "state": payload.state.strip()[:60],
        "address": payload.address.strip()[:200],
        "pincode": payload.pincode.strip()[:12],
        "country": payload.country.strip()[:60],
        "capacity": int(payload.capacity),
        "food_type": payload.food_type.strip()[:40],
        "distinguishing_feature": payload.distinguishing_feature.strip()[:500],
        "amenities": _clean_list(payload.amenities),
        "room_types": _clean_list(payload.room_types),
        "photos": [p for p in (payload.photos or []) if isinstance(p, str) and p.strip()][:5],
        "website_or_maps_url": payload.website_or_maps_url.strip()[:400],
        "open_to_partnerships": bool(payload.open_to_partnerships),
        "is_active": bool(payload.is_active),
        "created_at": t,
        "updated_at": t,
    }
    await db.venue_centers.insert_one(doc)
    return {"ok": True, "center": _public(doc)}


def _own_id(user: dict, owner_id: Optional[str]) -> str:
    """TVR-16: owner reads are scoped to the AUTHENTICATED user (X-Pulse-User,
    set server-side by the BFF) — never to a client-supplied owner id. The legacy
    `owner_id` query param is still accepted for compatibility but must match."""
    uid = str(user.get("user_id"))
    if owner_id is not None and owner_id != uid:
        raise HTTPException(status_code=403, detail="You can only view your own venues.")
    return uid


@router.get("/centers/mine")
async def my_centers(user: dict = Depends(current_user), owner_id: Optional[str] = Query(None)):
    docs = await db.venue_centers.find({"owner_id": _own_id(user, owner_id)}).sort("created_at", -1).to_list(200)
    return {"items": [_public(d) for d in docs], "count": len(docs)}


@router.get("/centers/{center_id}")
async def get_center(center_id: str, user: dict = Depends(current_user), owner_id: Optional[str] = Query(None)):
    d = await db.venue_centers.find_one({"_id": center_id, "owner_id": _own_id(user, owner_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Venue not found.")
    return {"center": _public(d)}


class CenterPatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, max_length=80)
    capacity: Optional[int] = Field(default=None, ge=1, le=1000)
    state: Optional[str] = Field(default=None, max_length=60)
    address: Optional[str] = Field(default=None, max_length=200)
    pincode: Optional[str] = Field(default=None, max_length=12)
    country: Optional[str] = Field(default=None, max_length=60)
    food_type: Optional[str] = Field(default=None, max_length=40)
    distinguishing_feature: Optional[str] = Field(default=None, max_length=500)
    amenities: Optional[list[str]] = None
    room_types: Optional[list[str]] = None
    photos: Optional[list[str]] = None
    website_or_maps_url: Optional[str] = Field(default=None, max_length=400)
    open_to_partnerships: Optional[bool] = None
    is_active: Optional[bool] = None


@router.patch("/centers/{center_id}")
async def update_center(center_id: str, payload: CenterPatch, user: dict = Depends(current_user)):
    owner_id = str(user.get("user_id"))
    existing = await db.venue_centers.find_one({"_id": center_id, "owner_id": owner_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Venue not found.")
    sets: dict = {"updated_at": now_ms()}
    data = payload.model_dump(exclude_none=True)
    for k in ["name", "city", "state", "address", "pincode", "country", "food_type", "distinguishing_feature", "website_or_maps_url"]:
        if k in data:
            sets[k] = str(data[k]).strip()
    if "capacity" in data:
        sets["capacity"] = int(data["capacity"])
    if "amenities" in data:
        sets["amenities"] = _clean_list(data["amenities"])
    if "room_types" in data:
        sets["room_types"] = _clean_list(data["room_types"])
    if "photos" in data:
        sets["photos"] = [p for p in (data["photos"] or []) if isinstance(p, str) and p.strip()][:5]
    if "open_to_partnerships" in data:
        sets["open_to_partnerships"] = bool(data["open_to_partnerships"])
    if "is_active" in data:
        sets["is_active"] = bool(data["is_active"])
    await db.venue_centers.update_one({"_id": center_id}, {"$set": sets})
    doc = await db.venue_centers.find_one({"_id": center_id})
    return {"ok": True, "center": _public(doc)}


# ── Center "extras" override ──────────────────────────────────────────────────
# The frozen remote /retreats/centers model doesn't persist website_or_maps_url,
# so for remote (ctr_*) centers that field is dropped on create. We keep it in a
# small local store keyed by center_id and merge it back at read (getMyCenter),
# so the owner's Google/website link round-trips regardless of remote vs local.
class CenterExtraIn(BaseModel):
    website_or_maps_url: Optional[str] = Field(default=None, max_length=400)
    country: Optional[str] = Field(default=None, max_length=60)


@router.post("/center-extras/{center_id}")
async def save_center_extra(center_id: str, payload: CenterExtraIn, user: dict = Depends(current_user)):
    sets: dict = {"owner_id": str(user.get("user_id")), "updated_at": now_ms()}
    if payload.website_or_maps_url is not None:
        sets["website_or_maps_url"] = payload.website_or_maps_url.strip()[:400]
    if payload.country is not None:
        sets["country"] = payload.country.strip()[:60]
    await db.venue_center_extras.update_one({"_id": center_id}, {"$set": sets}, upsert=True)
    return {"ok": True}


@router.get("/center-extras/{center_id}")
async def get_center_extra(center_id: str, user: dict = Depends(current_user)):
    d = await db.venue_center_extras.find_one({"_id": center_id})
    return {
        "website_or_maps_url": (d or {}).get("website_or_maps_url") or "",
        "country": (d or {}).get("country") or "",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Owner venue MIRROR → local admin "venue submissions" review store.
#
# The remote admin endpoint GET /admin/venue-submissions is not live, and there
# is NO remote way for an admin to list venues created by owners across the
# platform (owner centers are only visible per-owner via /retreats/centers/mine).
# So owner-created venues never reached the admin Venue Submissions console.
#
# Following the local-override pattern, when an owner opens their Venue Studio we
# mirror a shadow copy of their real centers into `venue_submissions` here, so
# admins can review/verify/publish them. It never fabricates data — it reflects
# the owner's actual venues — and preserves admin status/notes/history across
# re-mirrors.
# ─────────────────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(user: dict) -> None:
    if str(user.get("role") or "") != "admin":
        raise HTTPException(status_code=403, detail="admin only")


def _dedupe_key(name: str, city: str) -> str:
    def norm(s: str) -> str:
        return "".join(ch for ch in (s or "").lower() if ch.isalnum())
    return f"{norm(name)}|{norm(city)}"


# ── Venue version history + pending owner changes ────────────────────────────
# A live (approved/published) venue is NEVER changed by an owner edit directly:
# the edit is stored as "pending changes" next to the live listing until an
# admin approves or rejects it. Typo-sized fixes to free-text fields go live
# straight away. Every applied version is kept in `venue_revisions`, tagged by
# actor (owner / admin / ai / system), and admins can restore any of them.
_LIVE_STATUSES = {"approved", "published"}
_REV_FIELDS = (
    "name", "city", "state", "country", "address", "venue_type", "capacity", "best_for",
    "amenities", "description", "website_or_maps_url", "google_business_url", "photos",
)
_MINOR_FIELDS = {"description", "address", "state"}
# Venue capacity accepted from the public listing form and the owner's edit form (the website
# BFF already applies the same range: app/bff/venue/public-submissions{,/edit}/route.ts).
PUBLIC_CAPACITY_MIN, PUBLIC_CAPACITY_MAX = 1, 5000
_MINOR_MAX_CHARS = 12
_MINOR_MIN_RATIO = 0.9
_AI_IMPORT_FIELDS = {"description", "address", "submitter_phone"}


def _norm_val(v):
    if v is None:
        return ""
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        return v.strip()
    return v


def _snapshot(doc: dict) -> dict:
    return {k: doc.get(k) for k in _REV_FIELDS}


def _changed_fields(old: dict, new: dict) -> list:
    return [k for k in new if k in _REV_FIELDS and _norm_val(old.get(k)) != _norm_val(new.get(k))]


# Prompt 2E (TVR-21) — a typo-sized edit can still flip the meaning ("No alcohol is served" →
# "Alcohol is served", "Silence after 9pm" → "after 11pm"). Adding or removing a negation, or
# changing any number, therefore always goes to admin review.
#
# Prompt 2F — the same rule also covers a negation written without its apostrophe ("dont",
# "cant"), a "non-" prefix ("Non-smoking" → "Smoking"), words whose opposite flips the meaning
# ("Free" → "Paid", "allowed" → "banned", "before" → "after", "only" removed) and numbers written
# as words ("nine" → "ten", "single" → "double"). Each list is compared in order, so swapping two
# of these words ("Free parking, paid meals" → "Paid parking, free meals") also goes to review.
_NEGATION = re.compile(
    r"\b(?:no|not|never|none|nothing|nobody|nowhere|neither|nor|without|cannot"
    r"|dont|doesnt|didnt|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|hadnt"
    r"|shouldnt|couldnt|wouldnt|mustnt|neednt|aint)\b"
    r"|n['’]t\b"
    r"|\bnon(?=[-‐‑–\s]?[a-z])",
    re.I,
)
_OPPOSITE = re.compile(
    r"\b(?:free|paid|charged|chargeable|complimentary|included|including|inclusive|excluded|excluding|extra"
    r"|refundable|allowed|permitted|welcome|prohibited|forbidden|banned|disallowed|restricted"
    r"|mandatory|compulsory|required|optional|must|available|unavailable|open|closed|only|except"
    r"|before|after|under|over|above|below|minimum|maximum|min|max|more|less|fewer|least|most)\b",
    re.I,
)
_NUMBER = re.compile(
    r"\d+(?:[.,:]\d+)*"
    r"|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen"
    r"|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred"
    r"|thousand|lakhs?|crores?|million|dozen|half|single|double|twin|triple|once|twice|first|second|third)\b",
    re.I,
)


def _meaning_markers(text: str) -> tuple:
    """The negation / opposite words and the numbers (digits or words) a text contains, in order."""
    words = sorted(
        ((m.start(), m.group(0).lower().replace("’", "'")) for rx in (_NEGATION, _OPPOSITE) for m in rx.finditer(text)),
    )
    return [w for _, w in words], [n.lower() for n in _NUMBER.findall(text)]


def _is_minor_edit(old: dict, new: dict, changed: list) -> bool:
    """A typo-sized fix: only free-text fields, each a small in-place correction that keeps
    every negation and number as it was."""
    if not changed or any(k not in _MINOR_FIELDS for k in changed):
        return False
    for k in changed:
        a, b = str(old.get(k) or "").strip(), str(new.get(k) or "").strip()
        if not a or not b:
            return False
        if _meaning_markers(a) != _meaning_markers(b):
            return False
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        edited = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal")
        if edited > _MINOR_MAX_CHARS or sm.ratio() < _MINOR_MIN_RATIO:
            return False
    return True


async def _add_revision(sid: str, fields: dict, *, kind: str, action: str, actor: str, actor_type: str,
                        changed: list, note: str = "", state: Optional[str] = None, ai_fields: Optional[list] = None) -> dict:
    """kind 'applied' = a version that was the listing (restorable); 'proposed' = owner changes awaiting review."""
    last = await db.venue_revisions.find_one({"venue_id": sid}, sort=[("version", -1)])
    rev = {
        "_id": f"rev_{uuid.uuid4().hex[:16]}",
        "venue_id": sid,
        "version": int((last or {}).get("version") or 0) + 1,
        "kind": kind,
        "action": action,
        "state": state,
        "actor": (actor or "")[:120],
        "actor_type": actor_type,
        "changed": list(changed),
        "ai_fields": list(ai_fields or []),
        "fields": fields,
        "note": (note or "")[:500],
        "created_at": _now_iso(),
    }
    await db.venue_revisions.insert_one(rev)
    return rev


async def _ensure_baseline(doc: dict) -> None:
    if not await db.venue_revisions.find_one({"venue_id": doc["_id"]}, {"_id": 1}):
        await _add_revision(doc["_id"], _snapshot(doc), kind="applied", action="baseline", actor="NOSTOPS",
                            actor_type="system", changed=[], note="The listing as it was before version history began.")


def _revision_public(r: dict) -> dict:
    out = {k: v for k, v in r.items() if k != "_id"}
    out["id"] = r["_id"]
    return out


# ── Public-form anti-spam (the /venues/submit form is unauthenticated) ────────
# Layered so real users feel zero friction: honeypot + time-trap are enforced at
# the BFF; these are backend defense-in-depth — spam heuristics + Mongo-backed
# per-IP / per-email rate limiting. IPs are stored only as a salted hash.
_SPAM_TERMS = (
    "viagra", "cialis", "casino", "porn", "escort", "loan approved",
    "bitcoin doubler", "forex signals", "seo service", "buy backlinks",
    "cheap meds", "crypto pump", "make money fast", "weight loss pills",
    "adult dating", "onlyfans",
)
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)


def _client_ip(xff: Optional[str]) -> str:
    if not xff:
        return ""
    return xff.split(",")[0].strip()[:64]


def _ip_hash(ip: str) -> str:
    if not ip or not SECRET:
        return ""
    return hmac.new(SECRET.encode(), ip.encode(), hashlib.sha256).hexdigest()


def _count_urls(*vals: str) -> int:
    return sum(len(_URL_RE.findall(v or "")) for v in vals)


def _spam_reason(payload: "PublicSubmissionIn") -> Optional[str]:
    blob = " ".join([
        payload.venue_name, payload.city, payload.description or "",
        payload.relationship_note or "", payload.submitter_name,
    ]).lower()
    for term in _SPAM_TERMS:
        if term in blob:
            return "flagged content"
    # Links belong only in the website/maps field.
    if _count_urls(payload.venue_name, payload.city, payload.submitter_name) > 0:
        return "links are not allowed in the name fields"
    if _count_urls(payload.description or "", payload.relationship_note or "") > 3:
        return "too many links"
    return None


async def _rate_limited(ip_hash: str, email: str) -> bool:
    now = datetime.now(timezone.utc)
    hour_ago = (now - timedelta(hours=1)).isoformat()
    day_ago = (now - timedelta(hours=24)).isoformat()
    if ip_hash:
        if await db.venue_submissions.count_documents({"submitter_ip_hash": ip_hash, "created_at": {"$gte": hour_ago}}) >= 3:
            return True
        if await db.venue_submissions.count_documents({"submitter_ip_hash": ip_hash, "created_at": {"$gte": day_ago}}) >= 8:
            return True
    if email:
        if await db.venue_submissions.count_documents({"submitter_email": email, "created_at": {"$gte": day_ago}}) >= 5:
            return True
    return False


# ── Self-hosted image CAPTCHA (no third-party keys) ───────────────────────────
# GET /captcha issues a distorted-text PNG + a signed, time-limited, single-use
# token. The plaintext answer is NEVER sent to the client — the token carries
# only HMAC(answer). The public submit endpoint verifies token+answer and burns
# the token (unique _id in captcha_consumed, TTL-expired) so it can't be reused.
_CAPTCHA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I/L
_CAPTCHA_LEN = 5
_CAPTCHA_TTL = 300
_captcha_img = ImageCaptcha(width=220, height=80)
_captcha_idx_ready = False


async def _ensure_captcha_index() -> None:
    global _captcha_idx_ready
    if _captcha_idx_ready:
        return
    try:
        await db.captcha_consumed.create_index("expireAt", expireAfterSeconds=0)
    except Exception:
        pass
    _captcha_idx_ready = True


def _captcha_answer_hash(code: str) -> str:
    return hashlib.sha256(f"{(code or '').strip().lower()}|{SECRET}".encode()).hexdigest()


def _make_captcha_token(cid: str, code: str, exp: int) -> str:
    payload = {"cid": cid, "exp": exp, "h": _captcha_answer_hash(code)}
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{raw}.{sig}"


async def _verify_captcha(token: str, answer: str) -> bool:
    if not SECRET or not token or not answer or "." not in token:
        return False
    raw, _, sig = token.partition(".")
    expected = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        pad = "=" * (-len(raw) % 4)
        payload = json.loads(base64.urlsafe_b64decode(raw + pad).decode())
    except Exception:
        return False
    if int(payload.get("exp", 0)) < int(time.time()):
        return False
    if not hmac.compare_digest(str(payload.get("h", "")), _captcha_answer_hash(answer)):
        return False
    cid = str(payload.get("cid", ""))
    if not cid:
        return False
    try:
        # Single-use: unique _id. A duplicate means the token was already used.
        await db.captcha_consumed.insert_one({"_id": cid, "expireAt": datetime.now(timezone.utc) + timedelta(minutes=10)})
    except Exception:
        return False
    return True


@router.get("/captcha")
async def get_captcha(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    await _ensure_captcha_index()
    code = "".join(secrets.choice(_CAPTCHA_ALPHABET) for _ in range(_CAPTCHA_LEN))
    cid = uuid.uuid4().hex
    exp = int(time.time()) + _CAPTCHA_TTL
    data = base64.b64encode(_captcha_img.generate(code).getvalue()).decode()
    return {"token": _make_captcha_token(cid, code, exp), "image": f"data:image/png;base64,{data}", "expires_in": _CAPTCHA_TTL}


def _sub_public(doc: dict) -> dict:
    return {
        "submission_id": doc["_id"],
        "id": doc["_id"],
        "name": doc.get("name"),
        "venue_name": doc.get("name"),
        "city": doc.get("city"),
        "state": doc.get("state") or None,
        "country": doc.get("country") or None,
        "address": doc.get("address") or None,
        "venue_type": doc.get("venue_type") or None,
        "capacity": doc.get("capacity"),
        "amenities": doc.get("amenities", []),
        "room_types": doc.get("room_types", []),
        "food_type": doc.get("food_type") or None,
        "photos": doc.get("photos", []),
        "description": doc.get("description") or None,
        "distinguishing_feature": doc.get("distinguishing_feature") or None,
        "website_or_maps_url": doc.get("website_or_maps_url") or None,
        "google_business_url": doc.get("google_business_url") or None,
        "best_for": doc.get("best_for", []),
        "yoga_suitable": doc.get("yoga_suitable", True),
        "retreat_suitable": doc.get("retreat_suitable", True),
        "open_to_partnerships": doc.get("open_to_partnerships", True),
        "retreat_count": doc.get("retreat_count", 0),
        "submitter_role": doc.get("submitter_role"),
        "submitter_type": doc.get("submitter_role"),
        "submitter_name": doc.get("submitter_name"),
        "submitter_email": doc.get("submitter_email"),
        "owner_name": doc.get("owner_name") or None,
        "owner_email": doc.get("owner_email") or None,
        "owner_claimed_at": doc.get("owner_claimed_at") or None,
        "status": doc.get("status", "submitted"),
        "verification_status": doc.get("verification_status"),
        "verified": doc.get("verification_status") == "verified",
        "dedupe_key": doc.get("dedupe_key"),
        "venue_partner_id": doc.get("venue_partner_id"),
        "notes": doc.get("notes", []),
        "history": doc.get("history", []),
        "pending_changes": doc.get("pending_changes") or None,
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "source_kind": doc.get("source_kind") or "owner_center",
    }


class MirrorItem(BaseModel):
    center_id: str
    name: str = ""
    city: str = ""
    state: str = ""
    address: str = ""
    capacity: Optional[int] = None
    amenities: list[str] = Field(default_factory=list)
    room_types: list[str] = Field(default_factory=list)
    food_type: str = ""
    distinguishing_feature: str = ""
    photos: list[str] = Field(default_factory=list)
    open_to_partnerships: bool = True
    website_or_maps_url: str = ""
    retreat_count: int = 0
    retreat_title: str = ""
    retreat_theme: str = ""


class MirrorIn(BaseModel):
    items: list[MirrorItem] = Field(default_factory=list)


@router.post("/submissions/mirror")
async def mirror_submissions(payload: MirrorIn, user: dict = Depends(current_user)):
    owner_id = str(user.get("user_id"))
    owner_name = str(user.get("name") or "")
    owner_email = str(user.get("email") or "")
    role = str(user.get("role") or "teacher")
    now = _now_iso()
    n = 0
    for it in payload.items[:100]:
        cid = (it.center_id or "").strip()
        if not cid:
            continue
        theme = (it.retreat_theme or "").strip()[:40]
        photos = [p for p in (it.photos or []) if isinstance(p, str) and p.strip()][:10]
        venue_fields = {
            "name": (it.name or "").strip()[:120] or "Venue",
            "city": (it.city or "").strip()[:80],
            "state": (it.state or "").strip()[:60],
            "address": (it.address or "").strip()[:200],
            "capacity": int(it.capacity) if isinstance(it.capacity, int) else None,
            "amenities": _clean_list(it.amenities),
            "room_types": _clean_list(it.room_types),
            "food_type": (it.food_type or "").strip()[:40],
            "distinguishing_feature": (it.distinguishing_feature or "").strip()[:500],
            "description": ((it.distinguishing_feature or "").strip()[:500] or None),
            "photos": photos,
            "open_to_partnerships": bool(it.open_to_partnerships),
            "website_or_maps_url": (it.website_or_maps_url or "").strip()[:300],
            "venue_type": theme or "retreat_center",
            "best_for": ([theme] if theme else []),
            "retreat_count": int(it.retreat_count or 0),
            "retreat_title": (it.retreat_title or "").strip()[:160],
            "yoga_suitable": True,
            "retreat_suitable": True,
            "owner_id": owner_id,
            "submitter_role": ("teacher" if role == "teacher" else "owner"),
            "submitter_name": owner_name,
            "submitter_email": owner_email,
            "updated_at": now,
            "dedupe_key": _dedupe_key(it.name or "", it.city or ""),
        }
        # Phase 1 sync fix: INSERT-ONLY by stable centre id. An existing review record (possibly
        # published + admin-curated) is never overwritten here, and nothing is ever deleted by a
        # name+city match. Owners change live listings only through the moderated owner editor.
        existing = await db.venue_submissions.find_one({"_id": cid}, {"_id": 1})
        if existing:
            continue
        await db.venue_submissions.update_one(
            {"_id": cid},
            {
                "$setOnInsert": {
                    **venue_fields,
                    "created_at": now,
                    "status": "submitted",
                    "notes": [],
                    "history": [{"action": "submitted", "actor": owner_name or role, "at": now}],
                    "source_kind": "owner_center",
                },
            },
            upsert=True,
        )
        n += 1
    return {"ok": True, "mirrored": n}


@router.get("/submissions")
async def list_submissions(user: dict = Depends(current_user)):
    _require_admin(user)
    docs = await db.venue_submissions.find({}).sort("created_at", -1).to_list(500)
    return {"submissions": [_sub_public(d) for d in docs], "count": len(docs)}


class AdminAddSubmissionIn(BaseModel):
    venue_name: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(default="", max_length=60)
    country: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=200)
    venue_type: str = Field(default="", max_length=60)
    capacity: Optional[int] = None
    website_or_maps_url: str = Field(default="", max_length=400)
    google_business_url: str = Field(default="", max_length=400)
    description: str = Field(default="", max_length=4000)
    submitter_role: str = Field(default="owner", max_length=40)
    submitter_name: str = Field(default="", max_length=120)
    submitter_email: str = Field(default="", max_length=160)
    submitter_phone: str = Field(default="", max_length=40)
    relationship_note: str = Field(default="", max_length=1000)
    source_note: str = Field(default="", max_length=1000)


async def _admin_dep(user: dict = Depends(current_user)) -> dict:
    """B4.7 — admin check as a dependency, so it runs before body validation."""
    _require_admin(user)
    return user


@router.post("/submissions/admin-add")
async def admin_add_submission(payload: AdminAddSubmissionIn, user: dict = Depends(_admin_dep)):
    """Admin-only: manually add a venue into the review queue — for venues that
    reach out by email/phone instead of using the public form. Writes to the SAME
    `venue_submissions` collection the admin console reads, with status 'submitted'
    so it enters the normal review lifecycle. Idempotent on (name, city)."""
    _require_admin(user)
    name = payload.venue_name.strip()[:120]
    city = payload.city.strip()[:80]
    if len(name) < 2 or len(city) < 1:
        raise HTTPException(status_code=422, detail="Venue name and city are required.")
    dk = _dedupe_key(name, city)
    existing = await db.venue_submissions.find_one({"dedupe_key": dk})
    if existing:
        return {"ok": True, "submission_id": existing["_id"], "deduped": True}
    now = _now_iso()
    sid = f"adm_{uuid.uuid4().hex}"
    admin_name = user.get("name") or user.get("email") or "admin"
    note_text = payload.source_note.strip()[:1000] or (
        f"Added manually by {admin_name} from an external request (e.g. email). "
        "Verify contact, capacity, address and photos before approval."
    )
    doc = {
        "_id": sid,
        "name": name,
        "city": city,
        "state": payload.state.strip()[:60],
        "country": payload.country.strip()[:60] or None,
        "address": payload.address.strip()[:200],
        "venue_type": (payload.venue_type.strip()[:60] or "retreat_center"),
        "capacity": int(payload.capacity) if isinstance(payload.capacity, int) else None,
        "best_for": [],
        "amenities": [],
        "description": payload.description.strip()[:4000] or None,
        "website_or_maps_url": payload.website_or_maps_url.strip()[:400],
        "google_business_url": payload.google_business_url.strip()[:400] or None,
        "photos": [],
        "yoga_suitable": True,
        "retreat_suitable": True,
        "submitter_role": (payload.submitter_role or "owner").strip().lower()[:40],
        "submitter_name": payload.submitter_name.strip()[:120] or name,
        "submitter_email": payload.submitter_email.strip()[:160],
        "submitter_phone": payload.submitter_phone.strip()[:40],
        "relationship_note": payload.relationship_note.strip()[:1000] or None,
        "status": "submitted",
        "dedupe_key": dk,
        "submitter_ip_hash": None,
        "notes": [{"id": uuid.uuid4().hex, "author": admin_name, "text": note_text, "created_at": now}],
        "history": [
            {"action": "submitted", "actor": payload.submitter_name.strip()[:120] or name, "at": now},
            {"action": "added_by_admin", "actor": admin_name, "at": now, "note": "Recorded from external request"},
        ],
        "source_kind": "admin_added",
        "created_at": now,
        "updated_at": now,
    }
    await db.venue_submissions.insert_one(doc)
    return {"ok": True, "submission_id": sid, "deduped": False}


@router.get("/submissions/{sid}")
async def get_submission(sid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    return {"submission": _sub_public(d)}


class NoteIn(BaseModel):
    text: str = ""


@router.post("/submissions/{sid}/notes")
async def add_submission_note(sid: str, payload: NoteIn, user: dict = Depends(current_user)):
    """Append an internal admin note (never public). Local fallback for the
    intended remote POST /admin/venue-submissions/{id}/notes. Declared BEFORE the
    generic /{action} route so 'notes' is never captured as an action."""
    _require_admin(user)
    text = (payload.text or "").strip()[:2000]
    if not text:
        raise HTTPException(status_code=400, detail="A note is required.")
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    now = _now_iso()
    actor = str(user.get("name") or "admin")
    note = {"author": actor, "text": text, "created_at": now}
    await db.venue_submissions.update_one(
        {"_id": sid},
        {"$set": {"updated_at": now}, "$push": {"notes": note, "history": {"action": "note_added", "actor": actor, "at": now}}},
    )
    return {"ok": True, "note": note}


_ACTION_STATUS = {
    "approve": "approved",
    "approve-publish": "published",
    "reject": "rejected",
    "request-info": "needs_information",
    "mark-duplicate": "duplicate",
    "archive": "archived",
    "publish": "published",
    "unpublish": "approved",
    "hide": "hidden",
}


class ActionIn(BaseModel):
    note: str = ""
    reason: str = ""
    site_base: str = ""


# Owner-facing copy for the two "good news" transitions we email about.
_STATUS_EMAIL = {
    "approved": ("Your NOSTOPS venue is approved 🎉",
                 "your venue has been <strong>approved</strong> by our team. We&rsquo;ll publish it to NOSTOPS shortly — we&rsquo;ll let you know the moment it&rsquo;s live."),
    "published": ("Your NOSTOPS venue is now live 🌿",
                  "your venue is now <strong>published and live</strong> on NOSTOPS, discoverable by seekers and teachers. Thank you for listing with us!"),
}


async def _email_status_change(doc: dict, new_status: str, site_base: str) -> None:
    to_addr = doc.get("submitter_email")
    if not to_addr or new_status not in _STATUS_EMAIL:
        return
    subject, line = _STATUS_EMAIL[new_status]
    base = site_base.strip()
    if not base.startswith("https://"):
        base = "https://www.nostops.org"
    venue = escape(doc.get("name") or "your venue")
    token = _make_edit_token(doc["_id"], to_addr, now_ms() + _EDIT_TTL_MS)
    link = f"{base.rstrip('/')}/venues/submit/edit?token={token}"
    cta = "See it on NOSTOPS" if new_status == "published" else "View your submission status"
    import venue_growth  # Venue Partner Growth Engine — optional, free toolkit (read-only link, 30 days)

    kit = f"{base.rstrip('/')}/venues/submit/thank-you?k={venue_growth.make_kit_token(doc['_id'])}"
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937">'
        '<p style="font-size:16px">Namaste,</p>'
        f'<p>Good news — {line}</p>'
        f'<p style="margin:4px 0 0"><strong>{venue}</strong></p>'
        f'<p style="margin:24px 0"><a href="{escape(link)}" '
        'style="background:#c2410c;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">'
        f'{cta}</a></p>'
        '<p style="font-size:13px;color:#6b7280">This status link expires in 45 minutes; you can always request a fresh one from the venue submission page.</p>'
        '<p style="margin:20px 0 4px;font-weight:bold">Grow with NOSTOPS (optional, free)</p>'
        '<p style="margin:0 0 8px;font-size:14px">Help yoga teachers discover your venue: add a NOSTOPS widget to your website, '
        'share an invitation on WhatsApp or download your venue QR code.</p>'
        f'<p style="margin:0"><a href="{escape(kit)}" style="color:#0f766e;font-weight:bold">Open your venue toolkit</a></p>'
        '<p style="font-size:12px;color:#9ca3af;margin-top:24px">Sent by NOSTOPS. We never ask for your '
        'password or payment details by email.</p>'
        '</td></tr></table>'
    )
    try:
        await send_email(to=to_addr, subject=subject, html=html)
    except Exception:
        pass


class AdminImportIn(BaseModel):
    url: str = Field(default="", max_length=400)


@router.post("/submissions/{sid}/import-draft")
async def admin_import_draft(sid: str, payload: AdminImportIn, user: dict = Depends(current_user)):
    """Admin-only: run the website importer for a submission and RETURN suggested
    factual fields (description/address/phone) for review in the edit form. Writes
    NOTHING — the admin reviews and saves via the existing edit PATCH (a draft; it
    is never auto-published). Uses the admin-provided URL override or the
    submission's stored website. Declared BEFORE /submissions/{sid}/{action} so it
    is not captured as a moderation action. No payment of any kind."""
    _require_admin(user)
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    url = (payload.url.strip() or d.get("website_or_maps_url") or "").strip()[:400]
    if not url:
        return {"ok": True, "proposed": {}, "unverified": [],
                "message": "No website URL on file — add a website link and run import again."}
    res = await _fetch_site_metadata(url)
    if not res.get("ok"):
        return {"ok": True, "proposed": {}, "unverified": [], "source": url,
                "message": res.get("message") or "Couldn't read suggestions from that website."}
    md = res.get("meta") or {}
    proposed: dict = {}
    if md.get("description"):
        proposed["description"] = md["description"]
    if md.get("address"):
        proposed["address"] = md["address"]
    if md.get("phone"):
        proposed["submitter_phone"] = md["phone"]
    return {
        "ok": True,
        "source": url,
        "proposed": proposed,
        "unverified": list(proposed.keys()),
        "message": "AI-assisted suggestions from the venue website. Unverified — review and Save to apply. Nothing is published.",
    }


@router.post("/submissions/{sid}/{action}")
async def act_submission(sid: str, action: str, payload: ActionIn, user: dict = Depends(current_user)):
    _require_admin(user)
    if action not in _ACTION_STATUS:
        raise HTTPException(status_code=400, detail="unsupported action")
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    now = _now_iso()
    new_status = _ACTION_STATUS[action]
    actor = str(user.get("name") or "admin")
    ev = {"action": action, "actor": actor, "at": now, "from": d.get("status"), "to": new_status}
    note_text = (payload.note or payload.reason or "").strip()[:2000]
    push: dict = {"history": ev}
    if note_text:
        push["notes"] = {"author": actor, "text": note_text, "created_at": now}
    await db.venue_submissions.update_one(
        {"_id": sid},
        {"$set": {"status": new_status, "updated_at": now}, "$push": push},
    )
    doc = await db.venue_submissions.find_one({"_id": sid})
    # Auto-status refresh: email the owner when the venue moves to approved/published.
    if new_status in _STATUS_EMAIL and d.get("status") != new_status:
        await _email_status_change(doc, new_status, payload.site_base)
    return {"ok": True, "submission": _sub_public(doc)}


_EDIT_FIELDS = {
    "venue_name": "name",
    "venue_type": "venue_type",
    "city": "city",
    "state": "state",
    "address": "address",
    "website_or_maps_url": "website_or_maps_url",
    "google_business_url": "google_business_url",
    "description": "description",
    "capacity": "capacity",
}


class EditIn(BaseModel):
    venue_name: Optional[str] = None
    venue_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    website_or_maps_url: Optional[str] = None
    google_business_url: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    # Admin may curate the submitted photos before publication (remove unwanted
    # ones). An explicit [] clears all photos; None leaves them unchanged.
    photos: Optional[list[str]] = None
    # Fields whose new value came from the AI website import (provenance tag).
    ai_fields: Optional[list[str]] = None


@router.patch("/submissions/{sid}")
async def edit_submission(sid: str, payload: EditIn, user: dict = Depends(current_user)):
    """Admin edit/enrich before publication. Retains the ORIGINAL submitted
    values once (provenance) and records a versioned snapshot."""
    _require_admin(user)
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    raw = {
        "venue_name": payload.venue_name, "venue_type": payload.venue_type, "city": payload.city,
        "state": payload.state, "address": payload.address, "website_or_maps_url": payload.website_or_maps_url,
        "google_business_url": payload.google_business_url,
        "description": payload.description, "capacity": payload.capacity,
    }
    updates: dict = {}
    _url_fields = {"website_or_maps_url", "google_business_url"}
    for src, dst in _EDIT_FIELDS.items():
        v = raw.get(src)
        if v is None or v == "":
            continue
        if dst == "capacity":
            updates[dst] = int(v)
        elif dst in _url_fields:
            s = str(v).strip()[:400]
            low = s.lower()
            if not (low.startswith("http://") or low.startswith("https://")):
                raise HTTPException(status_code=422, detail="Enter a valid http(s) link (for example a Google Maps URL).")
            updates[dst] = s
        else:
            updates[dst] = str(v)[:4000]
    # Photo curation — an explicit list (possibly empty) replaces the stored set.
    if payload.photos is not None:
        updates["photos"] = [p for p in payload.photos if isinstance(p, str) and p.strip()][:5]
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    now = _now_iso()
    actor = str(user.get("name") or "admin")
    if not d.get("original"):
        _orig_keys = set(_EDIT_FIELDS.values()) | {"photos"}
        await db.venue_submissions.update_one(
            {"_id": sid}, {"$set": {"original": {k: d.get(k) for k in _orig_keys}}}
        )
    changed = _changed_fields(d, updates)
    if changed:
        await _ensure_baseline(d)
    updates["updated_at"] = now
    await db.venue_submissions.update_one(
        {"_id": sid},
        {"$set": updates, "$push": {"history": {"action": "edited", "actor": actor, "at": now, "fields": list(updates.keys())}}},
    )
    doc = await db.venue_submissions.find_one({"_id": sid})
    if changed:
        ai = [f for f in (payload.ai_fields or []) if f in changed][:10]
        await _add_revision(sid, _snapshot(doc), kind="applied", action="admin_edit", actor=actor,
                            actor_type="ai" if ai else "admin", changed=changed, ai_fields=ai,
                            note="Edited by an admin" + (" using AI website import suggestions." if ai else "."))
    return {"ok": True, "submission": _sub_public(doc)}


# ── Admin: pending owner changes + version history ──────────────────────────
class PendingDecisionIn(BaseModel):
    note: str = Field(default="", max_length=1000)
    site_base: str = Field(default="", max_length=200)


async def _email_owner(doc: dict, subject: str, line: str) -> None:
    # Phase 1: a claimed venue's approved owner is the accountable contact.
    to_addr = doc.get("owner_email") or doc.get("submitter_email")
    if not to_addr:
        return
    venue = escape(doc.get("name") or "your venue")
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937">'
        '<p style="font-size:16px">Namaste,</p>'
        f'<p>{line}</p>'
        f'<p style="margin:4px 0 0"><strong>{venue}</strong></p>'
        '<p style="font-size:12px;color:#9ca3af;margin-top:24px">Sent by NOSTOPS. We never ask for your '
        'password or payment details by email.</p>'
        '</td></tr></table>'
    )
    try:
        await send_email(to=to_addr, subject=subject, html=html)
    except Exception:
        pass


@router.post("/submissions/{sid}/pending/{decision}")
async def decide_pending_changes(sid: str, decision: str, payload: PendingDecisionIn, user: dict = Depends(current_user)):
    """Admin approves (applies to the live listing) or rejects an owner's pending changes."""
    _require_admin(user)
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="unsupported decision")
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    pc = d.get("pending_changes") or None
    if not pc:
        raise HTTPException(status_code=409, detail="There are no pending changes on this venue.")
    now = _now_iso()
    actor = str(user.get("name") or "admin")
    note = (payload.note or "").strip()[:1000]
    fields = {k: v for k, v in (pc.get("fields") or {}).items() if k in _REV_FIELDS}
    if decision == "approve":
        await _ensure_baseline(d)
        sets = dict(fields)
        sets["dedupe_key"] = _dedupe_key(sets.get("name", d.get("name") or ""), sets.get("city", d.get("city") or ""))
        sets["updated_at"] = now
        await db.venue_submissions.update_one(
            {"_id": sid},
            {"$set": sets, "$unset": {"pending_changes": ""},
             "$push": {"history": {"action": "pending_changes_approved", "actor": actor, "at": now, "fields": list(fields), "note": note or None}}},
        )
        after = await db.venue_submissions.find_one({"_id": sid})
        await _add_revision(sid, _snapshot(after), kind="applied", action="changes_approved", actor=actor, actor_type="admin",
                            changed=list(fields), note=note or f"Approved changes proposed by {pc.get('actor') or 'the owner'} (v{pc.get('version')}).")
        await _email_owner(after, "Your venue updates are now live 🌿",
                           "Good news — our team reviewed your recent changes and they are now <strong>live</strong> on NOSTOPS.")
    else:
        await db.venue_submissions.update_one(
            {"_id": sid},
            {"$set": {"updated_at": now}, "$unset": {"pending_changes": ""},
             "$push": {"history": {"action": "pending_changes_rejected", "actor": actor, "at": now, "note": note or None}}},
        )
        after = await db.venue_submissions.find_one({"_id": sid})
        reason = f" Note from our team: {escape(note)}" if note else ""
        await _email_owner(after, "About your recent venue updates",
                           "Thank you for your recent changes. Our team couldn&rsquo;t apply them this time, so your live listing "
                           f"stays as it was.{reason} You can request a fresh edit link any time from the venue submission page.")
    if pc.get("revision_id"):
        await db.venue_revisions.update_one(
            {"_id": pc["revision_id"]},
            {"$set": {"state": "approved" if decision == "approve" else "rejected", "decided_by": actor, "decided_at": now, "decision_note": note or None}},
        )
    return {"ok": True, "submission": _sub_public(after)}


@router.get("/submissions/{sid}/revisions")
async def list_revisions(sid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    revs = await db.venue_revisions.find({"venue_id": sid}).sort("version", -1).to_list(200)
    return {"revisions": [_revision_public(r) for r in revs]}


@router.post("/submissions/{sid}/revisions/{rid}/restore")
async def restore_revision(sid: str, rid: str, user: dict = Depends(current_user)):
    """Admin restores a previous version of the listing (creates a new version)."""
    _require_admin(user)
    d = await db.venue_submissions.find_one({"_id": sid})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    rev = await db.venue_revisions.find_one({"_id": rid, "venue_id": sid})
    if not rev:
        raise HTTPException(status_code=404, detail="Version not found.")
    if rev.get("kind") != "applied":
        raise HTTPException(status_code=400, detail="Only versions that were part of the listing can be restored.")
    fields = {k: (rev.get("fields") or {}).get(k) for k in _REV_FIELDS if k in (rev.get("fields") or {})}
    changed = _changed_fields(d, fields)
    if not changed:
        return {"ok": True, "unchanged": True, "submission": _sub_public(d)}
    now = _now_iso()
    actor = str(user.get("name") or "admin")
    sets = dict(fields)
    sets["dedupe_key"] = _dedupe_key(fields.get("name") or d.get("name") or "", fields.get("city") or d.get("city") or "")
    sets["updated_at"] = now
    await db.venue_submissions.update_one(
        {"_id": sid},
        {"$set": sets, "$push": {"history": {"action": "version_restored", "actor": actor, "at": now, "note": f"Restored version {rev.get('version')}"}}},
    )
    after = await db.venue_submissions.find_one({"_id": sid})
    await _add_revision(sid, _snapshot(after), kind="applied", action="restored", actor=actor, actor_type="admin",
                        changed=changed, note=f"Restored version {rev.get('version')}.")
    return {"ok": True, "submission": _sub_public(after)}


# ── Owner status visibility (owner reads status of their own venues) ──────────
@router.get("/my-venue-status")
async def my_submission_statuses(user: dict = Depends(current_user), owner_id: Optional[str] = Query(None)):
    docs = await db.venue_submissions.find({"owner_id": _own_id(user, owner_id)}).to_list(200)

    def _last_note(d: dict) -> Optional[str]:
        notes = d.get("notes") or []
        for n in reversed(notes):
            if isinstance(n, dict) and n.get("text"):
                return str(n["text"])
            if isinstance(n, str) and n.strip():
                return n.strip()
        return None

    return {
        "items": [
            {
                "id": d["_id"],
                "status": d.get("status", "submitted"),
                "verified": d.get("verification_status") == "verified",
                "dedupe_key": d.get("dedupe_key"),
                "note": _last_note(d),
            }
            for d in docs
        ]
    }


# ── Retroactive backfill: sweep local fallback centers + public-retreat venues ─
class RetreatVenueItem(BaseModel):
    name: str = ""
    city: str = ""
    state: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    host_name: str = ""
    host_user_id: str = ""
    retreat_id: str = ""
    retreat_title: str = ""
    retreat_theme: str = ""
    retreat_count: int = 1
    venue_partner_id: str = ""


class BackfillIn(BaseModel):
    retreat_venues: list[RetreatVenueItem] = Field(default_factory=list)


@router.post("/submissions/backfill")
async def backfill(payload: BackfillIn, user: dict = Depends(current_user)):
    _require_admin(user)
    now = _now_iso()
    swept_local = 0
    # (a) local fallback centers
    async for c in db.venue_centers.find({}):
        cid = c["_id"]
        dk = _dedupe_key(c.get("name") or "", c.get("city") or "")
        await db.venue_submissions.delete_many({"dedupe_key": dk, "source_kind": "public_retreat", "_id": {"$ne": cid}})
        await db.venue_submissions.update_one(
            {"_id": cid},
            {
                "$set": {
                    "name": c.get("name") or "Venue",
                    "city": c.get("city") or "",
                    "state": c.get("state") or "",
                    "address": c.get("address") or "",
                    "capacity": c.get("capacity"),
                    "amenities": c.get("amenities", []),
                    "room_types": c.get("room_types", []),
                    "food_type": c.get("food_type") or "",
                    "distinguishing_feature": c.get("distinguishing_feature") or "",
                    "description": c.get("distinguishing_feature") or None,
                    "photos": c.get("photos", []),
                    "open_to_partnerships": c.get("open_to_partnerships", True),
                    "venue_type": "retreat_center",
                    "yoga_suitable": True,
                    "retreat_suitable": True,
                    "owner_id": c.get("owner_id"),
                    "submitter_role": "owner",
                    "submitter_name": c.get("owner_name") or "",
                    "dedupe_key": dk,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                    "status": "submitted",
                    "notes": [],
                    "history": [{"action": "backfilled", "actor": "admin", "at": now}],
                    "source_kind": "owner_center",
                },
            },
            upsert=True,
        )
        swept_local += 1

    # (b) venues discovered via published public retreats (no center_id → synthetic id)
    added = 0
    for rv in payload.retreat_venues[:800]:
        name = (rv.name or "").strip()
        city = (rv.city or "").strip()
        if not name:
            continue
        dk = _dedupe_key(name, city)
        # Skip if any submission already covers this physical venue (mirror/backfill).
        if await db.venue_submissions.find_one({"dedupe_key": dk}):
            continue
        sid = f"own_{hashlib.sha1(dk.encode('utf-8')).hexdigest()[:16]}"
        theme = (rv.retreat_theme or "").strip()[:40]
        await db.venue_submissions.update_one(
            {"_id": sid},
            {
                "$set": {
                    "name": name[:120],
                    "city": city[:80],
                    "state": (rv.state or "").strip()[:60],
                    "venue_type": theme or "retreat_center",
                    "best_for": ([theme] if theme else []),
                    "retreat_count": int(rv.retreat_count or 1),
                    "retreat_title": (rv.retreat_title or "").strip()[:160],
                    "yoga_suitable": True,
                    "retreat_suitable": True,
                    "owner_id": (rv.host_user_id or "").strip() or None,
                    "submitter_role": "teacher",
                    "submitter_name": (rv.host_name or "").strip()[:120],
                    "lat": rv.lat,
                    "lng": rv.lng,
                    "venue_partner_id": (rv.venue_partner_id or "").strip() or None,
                    "dedupe_key": dk,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                    "status": "submitted",
                    "notes": [],
                    "history": [{"action": "backfilled", "actor": "admin", "at": now}],
                    "source_kind": "public_retreat",
                },
            },
            upsert=True,
        )
        added += 1

    return {"ok": True, "swept_local": swept_local, "added_from_retreats": added, "count": swept_local + added}


# ── Verification (admin marks a venue Verified → trust badge on public pages) ──
class VerifyIn(BaseModel):
    id: str
    verified: bool = True
    name: str = ""
    city: str = ""
    venue_partner_id: str = ""


@router.post("/verify")
async def verify_venue(payload: VerifyIn, user: dict = Depends(current_user)):
    _require_admin(user)
    vid = (payload.id or "").strip()
    if not vid:
        raise HTTPException(status_code=400, detail="missing id")
    now = _now_iso()
    actor = str(user.get("name") or "admin")
    new_val = "verified" if payload.verified else None
    ev = {"action": "verify" if payload.verified else "unverify", "actor": actor, "at": now, "to": new_val or "unverified"}
    existing = await db.venue_submissions.find_one({"_id": vid})
    set_fields: dict = {"verification_status": new_val, "updated_at": now}
    if not existing:
        # Published directory venue (no submission doc yet) — create a light record.
        set_fields.update({
            "name": (payload.name or "Venue")[:120],
            "city": (payload.city or "")[:80],
            "venue_partner_id": (payload.venue_partner_id or vid),
            "dedupe_key": _dedupe_key(payload.name or "", payload.city or ""),
            "source_kind": "published",
        })
    await db.venue_submissions.update_one(
        {"_id": vid},
        {"$set": set_fields, "$push": {"history": ev}, "$setOnInsert": {"created_at": now, "status": "published" if not existing else "submitted", "notes": []}},
        upsert=True,
    )
    doc = await db.venue_submissions.find_one({"_id": vid})
    return {"ok": True, "submission": _sub_public(doc)}


@router.get("/verified")
async def verified_venues(x_pulse_secret: Optional[str] = Header(None)):
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    docs = await db.venue_submissions.find({"verification_status": "verified"}).to_list(500)
    return {
        "venues": [
            {
                "id": d["_id"],
                "name": d.get("name"),
                "city": d.get("city") or None,
                "state": d.get("state") or None,
                "dedupe_key": d.get("dedupe_key"),
                "venue_partner_id": d.get("venue_partner_id"),
            }
            for d in docs
        ]
    }


# ── Public venue submission (unauthenticated intake via the BFF) ──────────────
# Anyone (owner / manager / host / community) can submit a venue for review from
# the public /venues/submit form. The BFF attaches the shared secret; no user
# identity is required. Feeds the same admin review queue as owner mirrors.
class PublicSubmissionIn(BaseModel):
    venue_name: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(default="", max_length=60)
    country: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=200)
    venue_type: str = Field(default="", max_length=60)
    # Prompt 2E (TVR-20) — same range the website form enforces; refused (422) before anything is saved.
    capacity: Optional[int] = Field(default=None, ge=PUBLIC_CAPACITY_MIN, le=PUBLIC_CAPACITY_MAX)
    best_for: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    description: str = Field(default="", max_length=4000)
    website_or_maps_url: str = Field(default="", max_length=400)
    photos: list[str] = Field(default_factory=list)
    submitter_role: str = Field(default="owner", max_length=40)
    submitter_name: str = Field(min_length=1, max_length=120)
    submitter_email: str = Field(min_length=3, max_length=160)
    submitter_phone: str = Field(default="", max_length=40)
    relationship_note: str = Field(default="", max_length=1000)
    # Anti-spam (invisible to real users; primary enforcement is at the BFF).
    honeypot: str = Field(default="", max_length=200)
    # CAPTCHA (from GET /captcha): signed single-use token + the user's answer.
    captcha_token: str = Field(default="", max_length=512)
    captcha_answer: str = Field(default="", max_length=16)


async def _keep_repeat_photos(doc: dict, photos: list, actor: str, now: str) -> None:
    """Photos from a repeat (deduped) submission. A record without photos gets them:
    directly while not yet live, or as owner changes awaiting admin review when live.
    Anything else is kept as an internal note so the admin still sees them."""
    if not photos:
        return
    sid = doc["_id"]
    if not doc.get("photos") and doc.get("status") not in _LIVE_STATUSES:
        await db.venue_submissions.update_one(
            {"_id": sid},
            {"$set": {"photos": photos, "updated_at": now},
             "$push": {"history": {"action": "photos_added_by_repeat_submission", "actor": actor, "at": now}}},
        )
        return
    if not doc.get("photos") and not doc.get("pending_changes"):
        await _ensure_baseline(doc)
        rev = await _add_revision(sid, {**_snapshot(doc), "photos": photos}, kind="proposed", action="owner_proposed",
                                  state="pending", actor=actor, actor_type="owner", changed=["photos"],
                                  note="Photos sent with a repeat submission, awaiting admin review.")
        await db.venue_submissions.update_one(
            {"_id": sid},
            {"$set": {"pending_changes": {"revision_id": rev["_id"], "version": rev["version"], "fields": {"photos": photos},
                                          "changed": ["photos"], "actor": actor, "actor_type": "owner", "ai_fields": [],
                                          "submitted_at": now},
                      "updated_at": now},
             "$push": {"history": {"action": "changes_submitted_for_review", "actor": actor, "at": now, "fields": ["photos"]}}},
        )
        return
    await db.venue_submissions.update_one(
        {"_id": sid},
        {"$push": {"notes": {"author": "NOSTOPS", "text": "A repeat submission included these photos: " + ", ".join(photos), "created_at": now}}},
    )


@router.post("/public-submissions")
async def create_public_submission(
    payload: PublicSubmissionIn,
    x_pulse_secret: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
):
    _check_secret(x_pulse_secret)

    # 1) Honeypot — a real user never fills this. Pretend it worked and drop it.
    if payload.honeypot.strip():
        return {"ok": True, "submission_id": f"pub_{uuid.uuid4().hex}", "deduped": False}

    # 2) CAPTCHA — signed, time-limited, single-use.
    if not await _verify_captcha(payload.captcha_token, payload.captcha_answer):
        raise HTTPException(status_code=400, detail="The verification code was incorrect or has expired. Please try the new code.")

    # 3) Content heuristics.
    reason = _spam_reason(payload)
    if reason:
        raise HTTPException(status_code=422, detail=f"Submission rejected: {reason}.")

    name = payload.venue_name.strip()[:120]
    city = payload.city.strip()[:80]
    email = payload.submitter_email.strip()[:160]

    # 4) Rate limiting (per IP + per email, Mongo-backed).
    ip = _client_ip(x_forwarded_for)
    iphash = _ip_hash(ip)
    if await _rate_limited(iphash, email):
        raise HTTPException(status_code=429, detail="You've submitted a few venues recently — please try again later.")

    dk = _dedupe_key(name, city)
    now = _now_iso()
    photos = [p for p in payload.photos if isinstance(p, str) and p.strip()][:5]
    existing = await db.venue_submissions.find_one({"dedupe_key": dk})
    if existing:
        # A repeat submission of a known venue must not silently drop the photos
        # it carries: they fill an empty record, or wait for admin review on a live one.
        await _keep_repeat_photos(existing, photos, payload.submitter_name.strip()[:120] or "public", now)
        return {"ok": True, "submission_id": existing["_id"], "deduped": True}
    sid = f"pub_{uuid.uuid4().hex}"
    role = (payload.submitter_role or "owner").strip().lower()[:40]
    doc = {
        "_id": sid,
        "name": name,
        "city": city,
        "state": payload.state.strip()[:60],
        "country": payload.country.strip()[:60] or None,
        "address": payload.address.strip()[:200],
        "venue_type": (payload.venue_type.strip()[:60] or "retreat_center"),
        "capacity": int(payload.capacity) if isinstance(payload.capacity, int) else None,
        "best_for": _clean_list(payload.best_for),
        "amenities": _clean_list(payload.amenities),
        "description": payload.description.strip()[:4000] or None,
        "website_or_maps_url": payload.website_or_maps_url.strip()[:400],
        "photos": photos,
        "yoga_suitable": True,
        "retreat_suitable": True,
        "submitter_role": role,
        "submitter_name": payload.submitter_name.strip()[:120],
        "submitter_email": email,
        "submitter_phone": payload.submitter_phone.strip()[:40],
        "relationship_note": payload.relationship_note.strip()[:1000] or None,
        "status": "submitted",
        "dedupe_key": dk,
        "submitter_ip_hash": iphash,
        "notes": [],
        "history": [{"action": "submitted", "actor": payload.submitter_name.strip()[:120] or "public", "at": now}],
        "source_kind": "public_submission",
        "created_at": now,
        "updated_at": now,
    }
    await db.venue_submissions.insert_one(doc)
    import venue_growth  # Venue Partner Growth Engine: read-only toolkit link for the new submitter

    return {"ok": True, "submission_id": sid, "kit_token": venue_growth.make_kit_token(sid)}


# ── Published venues (admin-approved) → merged into the public directory ───────
# The public /venue-partners directory is frozen/remote-only, so admin
# "publish" would be a no-op there. This exposes locally-published submissions
# so the Next.js directory can merge them in. Shared-secret read.
@router.get("/published")
async def published_venues(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    import venue_growth

    docs = await db.venue_submissions.find({"status": "published"}).sort("updated_at", -1).to_list(500)
    out = []
    for d in docs:
        photos = [p for p in (d.get("photos") or []) if isinstance(p, str) and p.strip()]
        best = d.get("best_for") or []
        out.append({
            "venue_id": d["_id"],
            "name": d.get("name") or "Venue",
            "city": d.get("city") or None,
            "state": d.get("state") or None,
            "country": d.get("country") or None,
            "capacity": d.get("capacity"),
            "cover_image": photos[0] if photos else None,
            "summary": d.get("description") or d.get("distinguishing_feature") or None,
            "best_for_framings": best if isinstance(best, list) else [],
            "photos": photos[:10],
            "amenities": [a for a in (d.get("amenities") or []) if isinstance(a, str) and a.strip()],
            "getting_there": d.get("getting_there") or None,
            "open_months": d.get("open_months") if isinstance(d.get("open_months"), list) else [],
            "weather_band": d.get("weather_band") or None,
            "things_to_carry": [t for t in (d.get("things_to_carry") or []) if isinstance(t, str) and t.strip()],
            "sattvic_certified": bool(d.get("sattvic_certified")),
            "website_or_maps_url": d.get("website_or_maps_url") or None,
            "google_business_url": d.get("google_business_url") or None,
            "lat": d.get("lat"),
            "lng": d.get("lng"),
            "dedupe_key": d.get("dedupe_key"),
            "verified": d.get("verification_status") == "verified",
            # Venue Partner Growth Engine — widget seen on the venue's own site (never a verification).
            "growth_partner": venue_growth.badge_eligible(d),
            "status": "active",
            "source": "local",
            "updated_at": d.get("updated_at"),
        })
    return {"venues": out}


# ── Google photos & reviews switched on by an admin (no purchase needed) ──────
# Separate from the paid AI-onboarding entitlements: an admin confirms the exact
# Google place for a venue listing, which then shows that place's photos/reviews.
class GoogleGrantIn(BaseModel):
    place_id: str = Field(default="", max_length=300)


@router.get("/google-grants")
async def list_google_grants(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    docs = await db.venue_google_grants.find({}).to_list(2000)
    return {"venues": [{"venue_id": d["_id"], "place_id": d.get("place_id")} for d in docs if d.get("place_id")]}


@router.get("/google-grants/{vid}")
async def get_google_grant(vid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await db.venue_google_grants.find_one({"_id": vid}) or {}
    return {"active": bool(d.get("place_id")), "place_id": d.get("place_id") or None,
            "granted_by": d.get("granted_by"), "granted_at": d.get("granted_at")}


@router.put("/google-grants/{vid}")
async def set_google_grant(vid: str, payload: GoogleGrantIn, user: dict = Depends(current_user)):
    """Admin switches Google content on for one venue (or off, with an empty place id)."""
    _require_admin(user)
    pid = (payload.place_id or "").strip()
    if pid and not re.fullmatch(r"[A-Za-z0-9_-]{10,300}", pid):
        raise HTTPException(status_code=422, detail="That doesn't look like a Google Place ID (e.g. ChIJ…).")
    actor = str(user.get("name") or "admin")
    if pid:
        await db.venue_google_grants.update_one(
            {"_id": vid}, {"$set": {"place_id": pid, "granted_by": actor, "granted_at": now_ms()}}, upsert=True
        )
    else:
        await db.venue_google_grants.delete_one({"_id": vid})
    await db.venue_submissions.update_one(
        {"_id": vid},
        {"$push": {"history": {"action": "google_content_on" if pid else "google_content_off", "actor": actor, "at": _now_iso()}}},
    )
    return {"ok": True, "place_id": pid or None}



# ── Public submission SELF-EDIT via emailed magic link ────────────────────────
# A public submitter has no account, so to let them edit their submission we
# email a short-lived signed link to the email ON THE RECORD. The token carries
# HMAC(submission_id|email|exp). Recipients come from server records (G4).
_EDIT_TTL_MS = 45 * 60 * 1000  # 45 minutes
# Owners can request a fresh edit link for these. Live (approved/published)
# venues are included: their edits become pending changes, never a direct overwrite.
_EDITABLE_STATUSES = {"submitted", "in_review", "needs_info", "needs_information", "resubmitted", "changes_requested", "approved", "published"}
_CLOSED_MSG = "This listing is closed, so it can't be changed or upgraded. Please contact the NOSTOPS team if you think this is a mistake."


def _make_edit_token(sid: str, email: str, exp_ms: int) -> str:
    raw = f"{sid}|{email}|{exp_ms}"
    b = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
    sig = hmac.new(SECRET.encode(), b.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{b}.{sig}"


def _verify_edit_token(token: str) -> Optional[dict]:
    if not SECRET or not token or "." not in token:
        return None
    b, _, sig = token.partition(".")
    expected = hmac.new(SECRET.encode(), b.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        raw = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)).decode()
        sid, email, exp = raw.split("|")
        if int(exp) < now_ms():
            return None
        return {"sid": sid, "email": email}
    except Exception:
        return None


def _submission_for_edit(doc: dict) -> dict:
    return {
        "submission_id": doc["_id"],
        "venue_name": doc.get("name") or "",
        "city": doc.get("city") or "",
        "state": doc.get("state") or "",
        "country": doc.get("country") or "",
        "address": doc.get("address") or "",
        "venue_type": doc.get("venue_type") or "",
        "capacity": doc.get("capacity"),
        "best_for": doc.get("best_for") or [],
        "amenities": doc.get("amenities") or [],
        "description": doc.get("description") or "",
        "website_or_maps_url": doc.get("website_or_maps_url") or "",
        "photos": doc.get("photos") or [],
        "submitter_role": doc.get("submitter_role") or "owner",
        "submitter_name": doc.get("submitter_name") or "",
        "submitter_email": doc.get("submitter_email") or "",
        "submitter_phone": doc.get("submitter_phone") or "",
        "relationship_note": doc.get("relationship_note") or "",
        "status": doc.get("status") or "submitted",
    }


class RequestEditIn(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    site_base: str = Field(default="", max_length=200)
    captcha_token: str = Field(default="", max_length=512)
    captcha_answer: str = Field(default="", max_length=16)
    honeypot: str = Field(default="", max_length=200)


@router.post("/public-submissions/request-edit")
async def request_submission_edit(
    payload: RequestEditIn,
    x_pulse_secret: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
):
    _check_secret(x_pulse_secret)
    if payload.honeypot.strip():
        return {"ok": True}
    if not await _verify_captcha(payload.captcha_token, payload.captcha_answer):
        raise HTTPException(status_code=400, detail="The verification code was incorrect or has expired. Please try the new code.")
    email = payload.email.strip()[:160]
    iphash = _ip_hash(_client_ip(x_forwarded_for))
    if await _rate_limited(iphash, email.lower()):
        raise HTTPException(status_code=429, detail="Too many requests just now — please try again in a little while.")
    doc = await db.venue_submissions.find_one(
        {"submitter_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
         "status": {"$in": list(_EDITABLE_STATUSES)}},
        sort=[("created_at", -1)],
    )
    if doc and doc.get("submitter_email"):
        token = _make_edit_token(doc["_id"], doc["submitter_email"], now_ms() + _EDIT_TTL_MS)
        base = payload.site_base.strip()
        if not base.startswith("https://"):
            base = "https://www.nostops.org"
        link = f"{base.rstrip('/')}/venues/submit/edit?token={token}"
        venue = escape(doc.get("name") or "your venue")
        html = (
            '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937">'
            '<p style="font-size:16px">Namaste,</p>'
            f'<p>You asked to edit your NOSTOPS venue submission for <strong>{venue}</strong>. '
            'Use the secure button below to open your submission and make changes — no account needed.</p>'
            f'<p style="margin:24px 0"><a href="{escape(link)}" '
            'style="background:#c2410c;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">'
            'Edit my venue submission</a></p>'
            '<p style="font-size:13px;color:#6b7280">This link expires in 45 minutes. '
            'If you did not request it, you can safely ignore this email — nothing changes.</p>'
            '<p style="font-size:12px;color:#9ca3af;margin-top:24px">Sent by NOSTOPS. We never ask for your '
            'password or payment details by email.</p>'
            '</td></tr></table>'
        )
        try:
            await send_email(to=doc["submitter_email"], subject="Edit your NOSTOPS venue submission", html=html)
        except Exception:
            pass
    return {"ok": True}


@router.get("/public-submissions/by-token")
async def get_submission_by_token(token: str = Query(...), x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    v = _verify_edit_token(token)
    if not v:
        raise HTTPException(status_code=400, detail="This edit link is invalid or has expired. Please request a new one.")
    doc = await db.venue_submissions.find_one({"_id": v["sid"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found.")
    sub = _submission_for_edit(doc)
    sub["live"] = doc.get("status") in _LIVE_STATUSES
    pc = doc.get("pending_changes") or None
    if pc:
        # The owner keeps editing from their pending version, not the live one.
        for k, val in (pc.get("fields") or {}).items():
            sub["venue_name" if k == "name" else k] = val if val is not None else ""
        sub["pending"] = {"submitted_at": pc.get("submitted_at"), "changed": pc.get("changed") or []}
    return {"submission": sub}


class PublicEditIn(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    site_base: str = Field(default="", max_length=200)
    venue_name: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(default="", max_length=60)
    country: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=200)
    venue_type: str = Field(default="", max_length=60)
    capacity: Optional[int] = Field(default=None, ge=PUBLIC_CAPACITY_MIN, le=PUBLIC_CAPACITY_MAX)  # TVR-20
    best_for: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    description: str = Field(default="", max_length=4000)
    website_or_maps_url: str = Field(default="", max_length=400)
    # None = leave photos unchanged (the owner edit form does not manage photos).
    photos: Optional[list[str]] = None
    submitter_name: str = Field(default="", max_length=120)
    submitter_phone: str = Field(default="", max_length=40)
    relationship_note: str = Field(default="", max_length=1000)
    # Fields whose value the owner accepted from the AI website import.
    ai_fields: list[str] = Field(default_factory=list)


@router.post("/public-submissions/edit")
async def edit_public_submission(payload: PublicEditIn, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    v = _verify_edit_token(payload.token)
    if not v:
        raise HTTPException(status_code=400, detail="This edit link is invalid or has expired. Please request a new one.")
    sid = v["sid"]
    doc = await db.venue_submissions.find_one({"_id": sid})
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if doc.get("status") not in _EDITABLE_STATUSES:
        # A link issued before the listing was rejected / hidden / archived must not reopen it.
        raise HTTPException(status_code=409, detail=_CLOSED_MSG)
    name = payload.venue_name.strip()[:120]
    city = payload.city.strip()[:80]
    now = _now_iso()
    proposed = {
        "name": name,
        "city": city,
        "state": payload.state.strip()[:60],
        "country": payload.country.strip()[:60] or None,
        "address": payload.address.strip()[:200],
        "venue_type": (payload.venue_type.strip()[:60] or "retreat_center"),
        "capacity": int(payload.capacity) if isinstance(payload.capacity, int) else None,
        "best_for": _clean_list(payload.best_for),
        "amenities": _clean_list(payload.amenities),
        "description": payload.description.strip()[:4000] or None,
        "website_or_maps_url": payload.website_or_maps_url.strip()[:400],
    }
    if payload.photos is not None:
        proposed["photos"] = [p for p in payload.photos if isinstance(p, str) and p.strip()][:5]
    # Contact details are private (never shown publicly) — always applied directly.
    private = {
        "submitter_name": payload.submitter_name.strip()[:120] or doc.get("submitter_name"),
        "submitter_phone": payload.submitter_phone.strip()[:40],
        "relationship_note": payload.relationship_note.strip()[:1000] or None,
    }
    actor = private["submitter_name"] or "Venue owner"
    changed = _changed_fields(doc, proposed)
    ai = [f for f in payload.ai_fields if f in _AI_IMPORT_FIELDS and f in changed][:10]
    actor_type = "ai" if ai else "owner"
    history = list(doc.get("history") or [])
    sets: dict = {**private, "updated_at": now}
    unset: dict = {}

    if doc.get("status") in _LIVE_STATUSES:
        # LIVE venue: the public listing is never overwritten by an owner edit.
        await _ensure_baseline(doc)
        if not changed:
            mode = "private_only"
            if doc.get("pending_changes"):
                # The owner reverted everything they had proposed — withdraw it.
                unset["pending_changes"] = ""
                await db.venue_revisions.update_many(
                    {"venue_id": sid, "kind": "proposed", "state": "pending"}, {"$set": {"state": "withdrawn", "decided_at": now}}
                )
                history.append({"action": "pending_changes_withdrawn", "actor": actor, "at": now})
        elif not ai and _is_minor_edit(doc, proposed, changed):
            mode = "minor_applied"
            for k in changed:
                sets[k] = proposed[k]
            history.append({"action": "minor_edit_auto_approved", "actor": actor, "at": now, "fields": changed})
        else:
            mode = "pending"
            await db.venue_revisions.update_many(
                {"venue_id": sid, "kind": "proposed", "state": "pending"}, {"$set": {"state": "superseded", "decided_at": now}}
            )
            proposal = {k: proposed[k] for k in changed}
            rev = await _add_revision(sid, {**_snapshot(doc), **proposal}, kind="proposed", action="owner_proposed",
                                      state="pending", actor=actor, actor_type=actor_type, changed=changed, ai_fields=ai,
                                      note="Owner changes awaiting admin review.")
            sets["pending_changes"] = {
                "revision_id": rev["_id"], "version": rev["version"], "fields": proposal, "changed": changed,
                "actor": actor, "actor_type": actor_type, "ai_fields": ai, "submitted_at": now,
            }
            history.append({"action": "changes_submitted_for_review", "actor": actor, "at": now, "fields": changed})
    else:
        # Not live yet: edits apply directly and the venue returns to the review queue.
        mode = "resubmitted"
        if changed:
            await _ensure_baseline(doc)
        sets.update(proposed)
        sets["dedupe_key"] = _dedupe_key(name, city)
        sets["status"] = "submitted"
        history.append({"action": "edited_by_submitter", "actor": actor, "at": now})

    sets["history"] = history
    update: dict = {"$set": sets}
    if unset:
        update["$unset"] = unset
    await db.venue_submissions.update_one({"_id": sid}, update)
    if changed and mode in ("minor_applied", "resubmitted"):
        after = await db.venue_submissions.find_one({"_id": sid})
        await _add_revision(sid, _snapshot(after), kind="applied",
                            action="minor_edit_auto_approved" if mode == "minor_applied" else "owner_edit",
                            actor=actor, actor_type=actor_type, changed=changed, ai_fields=ai,
                            note="Small correction applied automatically." if mode == "minor_applied" else "Edited by the owner before publication.")
    # Best-effort "we received your changes" confirmation to the email on record.
    to_addr = doc.get("submitter_email")
    if to_addr:
        base = payload.site_base.strip()
        if not base.startswith("https://"):
            base = "https://www.nostops.org"
        status_link = f"{base.rstrip('/')}/venues/submit/edit?token={payload.token}"
        venue = escape(name or "your venue")
        line = {
            "pending": (f'Thank you — we&rsquo;ve received your updates to <strong>{venue}</strong>. Your live listing stays exactly '
                        'as it is while our team reviews them, and we&rsquo;ll let you know once they&rsquo;re approved.'),
            "minor_applied": f'Thank you — your small correction to <strong>{venue}</strong> is now live on NOSTOPS.',
            "private_only": f'Thank you — we&rsquo;ve updated your contact details for <strong>{venue}</strong>.',
        }.get(mode, (f'Thank you — we&rsquo;ve received your updates to <strong>{venue}</strong> and put it back in the '
                     'NOSTOPS review queue. Our team will take another look and reach out if anything else is needed.'))
        html = (
            '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937">'
            '<p style="font-size:16px">Namaste,</p>'
            f'<p>{line}</p>'
            f'<p style="margin:24px 0"><a href="{escape(status_link)}" '
            'style="background:#c2410c;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">'
            'View your submission status</a></p>'
            '<p style="font-size:13px;color:#6b7280">This link expires with your current edit session. '
            'You can always request a fresh link from the venue submission page.</p>'
            '<p style="font-size:12px;color:#9ca3af;margin-top:24px">Sent by NOSTOPS. We never ask for your '
            'password or payment details by email.</p>'
            '</td></tr></table>'
        )
        try:
            await send_email(to=to_addr, subject="We received your venue updates", html=html)
        except Exception:
            pass
    return {"ok": True, "submission_id": sid, "mode": mode, "changed": changed}



# ── TIER 2 AI-ASSISTED ONBOARDING (FREE EARLY-ACCESS PREVIEW) ───────────────
# Website import → reviewable draft → explicit owner approval. Reuses the
# existing signed edit-token ownership proof + the existing edit mechanism.
# NO payment, NO Cashfree, NO entitlement anywhere in this path.

class ImportDraftIn(BaseModel):
    token: str = Field(min_length=8, max_length=512)


# ── Tier-2 website importer: SSRF / compliance hardening ─────────────────────
# Outbound fetches for the owner-initiated website importer are locked down:
#   • scheme allowlist (http/https) + PORT allowlist (80/443)
#   • every destination IP (IPv4/IPv6, incl. v4-mapped) is validated and the
#     connection is DIALLED AT THE VALIDATED IP — httpx never re-resolves the
#     hostname — which closes the DNS-rebinding / time-of-check-time-of-use window.
#   • TLS SNI + certificate verification stay bound to the real hostname.
#   • redirects ARE followed, but MANUALLY, revalidated each hop, with a strict cap.
#   • robots.txt is honoured (politeness) but is NOT a substitute for the SSRF
#     guard — the robots fetch itself goes through the same validated/pinned path.
#   • request timeout + STREAMED response-size cap bound resource use.
_IMPORT_ALLOWED_PORTS = {80, 443}
_IMPORT_MAX_BYTES = 512_000
_ROBOTS_MAX_BYTES = 65_536
_IMPORT_MAX_REDIRECTS = 4
_IMPORT_TIMEOUT = 8.0
_IMPORT_UA = "NOSTOPS-VenueImport/1.0 (+https://www.nostops.org)"
_IMPORT_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"


def _ip_blocked(ip_str: str) -> bool:
    """True if an address must never be dialled: loopback / private / link-local /
    reserved / multicast / unspecified / IPv6 site-local — for IPv4, IPv6 and
    IPv4-mapped IPv6 (so ::ffff:127.0.0.1 can't slip past)."""
    import ipaddress as _ipaddress
    try:
        ip = _ipaddress.ip_address(ip_str)
    except Exception:
        return True
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped
    return bool(
        ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
        or ip.is_multicast or ip.is_unspecified
        or (ip.version == 6 and ip.is_site_local)
    )


def _resolve_public_ips(host: str, port: int) -> list:
    """Resolve host→IPs and return them ONLY if EVERY resolved address is a
    permitted public address (fail-closed: a mixed public/private answer, as a
    rebinding attacker might serve, yields [] so nothing is dialled)."""
    import socket as _socket
    try:
        infos = _socket.getaddrinfo(host, port, proto=_socket.IPPROTO_TCP)
    except Exception:
        return []
    ips = []
    for info in infos:
        ip_str = info[4][0]
        if _ip_blocked(ip_str):
            return []
        ips.append(ip_str)
    return ips


def _validate_import_url(raw: str):
    """(ok, scheme, host, port, path_query, message). Enforces http/https, the
    PORT allowlist and a Maps-link reject. DNS is NOT resolved here — that happens
    at dial time (_pinned_fetch) so the check and the connection cannot diverge."""
    from urllib.parse import urlparse as _urlparse
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        pp = _urlparse(candidate)
    except Exception:
        return (False, "", "", 0, "", "That website link could not be read.")
    if pp.scheme not in ("http", "https") or not pp.hostname:
        return (False, "", "", 0, "", "Only http/https website links are supported.")
    h = pp.hostname.lower()
    if h.startswith("maps.") or "/maps" in (pp.path or "") or h in ("goo.gl", "maps.app.goo.gl"):
        return (False, "", "", 0, "", "This looks like a Maps link — add your website URL for suggestions.")
    try:
        port = pp.port or (443 if pp.scheme == "https" else 80)
    except ValueError:
        return (False, "", "", 0, "", "That website link could not be read.")
    if port not in _IMPORT_ALLOWED_PORTS:
        return (False, "", "", 0, "", "Only standard web ports (80 and 443) are supported.")
    pathq = pp.path or "/"
    if pp.query:
        pathq = f"{pathq}?{pp.query}"
    return (True, pp.scheme, h, port, pathq, "")


async def _pinned_fetch(client, scheme: str, host: str, port: int, pathq: str, cap: int, ip: str = ""):
    """GET scheme://host:port/pathq by DIALLING a validated IP (httpx does not
    re-resolve the hostname), with TLS verified against the hostname, NOT
    following redirects, reading at most `cap` bytes via streaming. When `ip` is
    given it is used directly (already validated by the caller); otherwise the
    host is resolved and validated here. Returns (status, location, text, err)."""
    if not ip:
        ips = _resolve_public_ips(host, port)
        if not ips:
            return (0, "", "", "That website address isn't reachable.")
        ip = ips[0]
    netloc_ip = f"[{ip}]" if ":" in ip else ip
    ip_url = f"{scheme}://{netloc_ip}:{port}{pathq}"
    headers = {"Host": host, "User-Agent": _IMPORT_UA, "Accept": _IMPORT_ACCEPT,
               "Accept-Language": "en-US,en;q=0.9"}
    # sni_hostname keeps TLS SNI + certificate verification bound to the real
    # hostname even though the URL authority is the pinned IP.
    ext = {"sni_hostname": host} if scheme == "https" else {}
    try:
        async with client.stream("GET", ip_url, headers=headers, extensions=ext) as resp:
            status = resp.status_code
            if status in (301, 302, 303, 307, 308):
                return (status, resp.headers.get("location", ""), "", "")
            if status >= 400:
                return (status, "", "", "")
            buf = bytearray()
            async for chunk in resp.aiter_bytes():
                buf.extend(chunk)
                if len(buf) >= cap:
                    break
            text = bytes(buf[:cap]).decode(resp.encoding or "utf-8", errors="replace")
            return (status, "", text, "")
    except Exception:
        return (0, "", "", "We couldn't reach that website just now.")


async def _robots_allows(client, scheme: str, host: str, port: int, pathq: str, ip: str = "") -> bool:
    """Honour robots.txt for our user-agent. 2xx → parse + obey; 4xx (no policy) →
    allowed; everything else (3xx / 5xx / network error) → fail SAFE (disallow).
    The robots fetch uses the SAME validated/pinned IP, so it is never an SSRF
    hole and is NOT a substitute for the SSRF guard above."""
    import urllib.robotparser as _rp
    status, _loc, text, _err = await _pinned_fetch(client, scheme, host, port, "/robots.txt", _ROBOTS_MAX_BYTES, ip)
    if 200 <= status < 300 and text.strip():
        rp = _rp.RobotFileParser()
        try:
            rp.parse(text.splitlines())
        except Exception:
            return False
        return bool(rp.can_fetch(_IMPORT_UA, pathq))
    if 400 <= status < 500:
        return True
    return False


async def _fetch_site_metadata(url: str) -> dict:
    """TIER 2 preview — read PUBLIC metadata from the owner's OWN website
    (owner-initiated, edit-token gated). No third-party scraping. Hardened:
    scheme + PORT allowlist, SSRF validation with the connection DIALLED AT the
    validated IP (DNS-rebinding / TOCTOU safe), TLS hostname + certificate
    verification preserved, robots.txt honoured, request timeout and a streamed
    response-size cap. Redirects ARE followed, but MANUALLY — each hop is
    re-validated and the hop count is capped. All returned values are UNVERIFIED.
    Admin URL overrides flow through this same function, so they cannot bypass any
    of these restrictions."""
    import re as _re
    import json as _json
    from urllib.parse import urljoin as _urljoin
    import httpx as _httpx

    ok, scheme, host, port, pathq, msg = _validate_import_url(url)
    if not ok:
        return {"ok": False, "message": msg}

    html = ""
    async with _httpx.AsyncClient(timeout=_IMPORT_TIMEOUT, follow_redirects=False) as client:
        for _ in range(_IMPORT_MAX_REDIRECTS + 1):
            # Resolve + validate ONCE per hop, then pin: robots and the page are
            # dialled at the SAME validated IP so nothing can be re-resolved.
            ips = _resolve_public_ips(host, port)
            if not ips:
                return {"ok": False, "message": "That website address isn't reachable."}
            ip = ips[0]
            if not await _robots_allows(client, scheme, host, port, pathq, ip):
                return {"ok": False, "message": "This website doesn't allow automated reading (robots.txt). Please add the details manually."}
            status, loc, text, err = await _pinned_fetch(client, scheme, host, port, pathq, _IMPORT_MAX_BYTES, ip)
            if err:
                return {"ok": False, "message": err}
            if status in (301, 302, 303, 307, 308) and loc:
                nxt = _urljoin(f"{scheme}://{host}:{port}{pathq}", loc)
                ok, scheme, host, port, pathq, msg = _validate_import_url(nxt)
                if not ok:
                    return {"ok": False, "message": msg}
                continue
            if status >= 400 or not text:
                return {"ok": False, "message": "We couldn't read suggestions from that website."}
            html = text
            break
        else:
            return {"ok": False, "message": "That website redirected too many times."}

    def _meta_content(keys):
        """First <meta> content for any of the given name/property keys, tolerant of
        attribute order (content may appear before OR after the name/property)."""
        for tag in _re.finditer(r"<meta\b[^>]*>", html, _re.I):
            t = tag.group(0)
            km = _re.search(r'(?:name|property)\s*=\s*["\']([^"\']+)["\']', t, _re.I)
            if not km or km.group(1).strip().lower() not in keys:
                continue
            cm = _re.search(r'content\s*=\s*["\']([^"\']*)["\']', t, _re.I)
            if cm:
                val = _re.sub(r"\s+", " ", cm.group(1)).strip()
                if val:
                    return val[:2000]
        return ""

    desc = _meta_content({"og:description", "description", "twitter:description"})
    address = ""
    phone = ""
    for m in _re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, _re.I | _re.S):
        try:
            data = _json.loads(m.group(1).strip())
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if not isinstance(it, dict):
                continue
            if not desc and isinstance(it.get("description"), str):
                desc = it["description"].strip()[:2000]
            if not phone and isinstance(it.get("telephone"), str):
                phone = it["telephone"].strip()[:40]
            addr = it.get("address")
            if not address and isinstance(addr, dict):
                parts = [addr.get(k) for k in ("streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry")]
                address = ", ".join([str(x) for x in parts if x])[:200]
            elif not address and isinstance(addr, str):
                address = addr.strip()[:200]
    if not phone:
        tm = _re.search(r'href=["\']tel:([+0-9().\-\s]{6,20})["\']', html, _re.I)
        if tm:
            phone = _re.sub(r"\s+", " ", tm.group(1)).strip()[:40]
    meta = {}
    if desc:
        meta["description"] = desc
    if address:
        meta["address"] = address
    if phone:
        meta["phone"] = phone
    return {"ok": True, "meta": meta}


@router.post("/public-submissions/import-draft")
async def import_draft(payload: ImportDraftIn, x_pulse_secret: Optional[str] = Header(None)):
    """PAID one-time service: generate a REVIEWABLE import draft for the owner of
    a submission (authenticated by the existing signed edit token). Gated by an
    active ai_onboarding entitlement for the submission's email (purchased on
    /venues/ai-onboarding). Pulls PUBLIC factual hints from the owner's OWN stored
    website URL and writes NOTHING to the listing — the owner reviews/edits and
    must click Save to apply. The free MANUAL listing/edit path is unaffected."""
    _check_secret(x_pulse_secret)
    v = _verify_edit_token(payload.token)
    if not v:
        raise HTTPException(status_code=400, detail="This link is invalid or has expired. Please request a new one.")
    doc = await db.venue_submissions.find_one({"_id": v["sid"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if doc.get("status") not in _EDITABLE_STATUSES:
        raise HTTPException(status_code=409, detail=_CLOSED_MSG)
    # Defence-in-depth: the signed token must belong to THIS submission's owner
    # email (tokens are only ever issued to the submitter's address), so one
    # owner's link can never read another owner's draft.
    tok_email = (v.get("email") or "").strip().lower()
    own_email = str(doc.get("submitter_email") or "").strip().lower()
    if tok_email and own_email and tok_email != own_email:
        raise HTTPException(status_code=403, detail="This link does not match this venue.")
    # PAID GATE: AI-assisted onboarding is a one-time paid service bought FOR THIS
    # venue listing (entitlement keyed by submission id). The free manual
    # listing/edit path is NOT affected.
    ent = await db.ai_onboarding_entitlements.find_one({"_id": doc["_id"]})
    if not (ent and ent.get("active")):
        raise HTTPException(
            status_code=402,
            detail="AI-assisted onboarding is a one-time paid upgrade for this venue listing. Unlock it once, then return here.",
        )
    url = (doc.get("website_or_maps_url") or "").strip()
    if not url:
        return {"ok": True, "proposed": {}, "unverified": [],
                "message": "Add your website URL to your listing, then try again for AI-assisted suggestions."}
    res = await _fetch_site_metadata(url)
    if not res.get("ok"):
        return {"ok": True, "proposed": {}, "unverified": [], "source": url,
                "message": res.get("message") or "We couldn't read suggestions from your website. You can still edit your listing manually."}
    md = res.get("meta") or {}
    proposed = {}
    if md.get("description"):
        proposed["description"] = md["description"]
    if md.get("address"):
        proposed["address"] = md["address"]
    if md.get("phone"):
        proposed["submitter_phone"] = md["phone"]
    return {
        "ok": True,
        "source": url,
        "proposed": proposed,
        "unverified": list(proposed.keys()),
        "message": "AI-assisted suggestions from your website. Everything is UNVERIFIED — review and edit, then Save to approve. Nothing is saved until you approve.",
    }
