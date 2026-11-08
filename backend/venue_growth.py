"""Venue Partner Growth Engine — the free, optional toolkit venue owners get after listing a venue:
Thank You page, two centrally managed website widgets, invitation note (+ PDF), WhatsApp / copy
sharing, a stable QR code, and privacy-conscious referral attribution.

Public-safety rules (everything here):
  * A venue is referenced publicly only by its stable `growth_code` (e.g. "vq7k2m9x4p"), stored on the
    venue submission. It is never a token, never contact data. Unpublished venues expose NOTHING but
    "pending" (the widget then shows a general NOSTOPS invitation).
  * Owners open their toolkit with a read-only "kit" token (HMAC, 30 days, its own key, so it can never
    be used as the 45-minute edit link, and an edit link can never be used as a kit token).
  * The shared widget configuration (messaging, labels, colours, layout, destinations) is versioned,
    validated and admin-managed; venue-specific data is never stored in it, so a global change can
    never overwrite a venue's information.
  * Attribution is first-party and anonymous: a random visitor id hashed with a server salt, one count
    per venue + kind + visitor + day; registrations and completed profiles count once per user id.
  * No payments, commissions, referral rewards or paid tiers.
"""
import base64
import hashlib
import hmac
import io
import re
import secrets
import time
from typing import Optional
from urllib.parse import urlparse
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import venues

router = APIRouter(prefix="/api/venue-growth", tags=["venue-growth"])
db = venues.db

KIT_TTL_MS = 30 * 24 * 60 * 60 * 1000
CODE_RE = re.compile(r"^v[a-z2-9]{9}$")
_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
# Moderation status → (key, owner-facing label). Anything else (rejected, duplicate, archived,
# hidden) is closed: no toolkit, and the widget/QR show nothing about the venue.
_STATUS = {
    "published": ("published", "Published"),
    "approved": ("approved", "Approved — publishing soon"),
    "submitted": ("review", "Submitted for review"),
    "in_review": ("review", "Submitted for review"),
    "resubmitted": ("review", "Submitted for review"),
    "needs_info": ("needs_info", "Awaiting further information"),
    "needs_information": ("needs_info", "Awaiting further information"),
    "changes_requested": ("needs_info", "Awaiting further information"),
}
EVENT_KINDS = ("invite_visit", "profile_view", "register_start", "register_complete", "existing_signin",
               "profile_complete", "widget_load")
# Once per user, ever: a NEW teacher account, an EXISTING teacher signing in, a completed profile.
_USER_KINDS = ("register_complete", "existing_signin", "profile_complete")
BADGE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000
_OWN_HOSTS = ("nostops.org", "preview.emergentagent.com", "emergent.host", "localhost", "127.0.0.1")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    if not venues.SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, venues.SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


def _kit_key() -> bytes:
    return hashlib.sha256(f"{venues.SECRET}|venue-growth-kit-v1".encode()).digest()


def make_kit_token(sid: str, exp_ms: Optional[int] = None) -> str:
    raw = f"kit|{sid}|{exp_ms or _now_ms() + KIT_TTL_MS}"
    b = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
    return f"{b}.{hmac.new(_kit_key(), b.encode(), hashlib.sha256).hexdigest()[:32]}"


def verify_kit_token(token: str) -> Optional[str]:
    if not venues.SECRET or not token or "." not in token or len(token) > 400:
        return None
    b, _, sig = token.partition(".")
    if not hmac.compare_digest(sig, hmac.new(_kit_key(), b.encode(), hashlib.sha256).hexdigest()[:32]):
        return None
    try:
        kind, sid, exp = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)).decode().split("|")
        return sid if kind == "kit" and int(exp) >= _now_ms() else None
    except Exception:
        return None


async def ensure_code(sid: str) -> str:
    """The venue's stable public code; created once, never changed (QR codes stay valid)."""
    doc = await db.venue_submissions.find_one({"_id": sid}, {"growth_code": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Venue not found.")
    if doc.get("growth_code"):
        return doc["growth_code"]
    for _ in range(5):
        code = "v" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(9))
        if await db.venue_submissions.find_one({"growth_code": code}, {"_id": 1}):
            continue
        await db.venue_submissions.update_one({"_id": sid, "growth_code": {"$exists": False}}, {"$set": {"growth_code": code}})
        return (await db.venue_submissions.find_one({"_id": sid}, {"growth_code": 1}))["growth_code"]
    raise HTTPException(status_code=503, detail="Please try again.")


def _website(doc: dict) -> Optional[str]:
    """The venue's own website (not a maps link), http(s) only."""
    u = str(doc.get("website_or_maps_url") or "").strip()
    if not re.match(r"^https?://[^\s<>\"']+$", u, re.I) or len(u) > 400:
        return None
    if re.search(r"(google\.[^/]+/maps|maps\.app\.goo\.gl|goo\.gl/maps|g\.page|maps\.google|[?&]cid=)", u, re.I):
        return None
    return u


def _host_of(value: str) -> str:
    try:
        return (urlparse(value if "//" in value else f"https://{value}").hostname or "").lower().strip(".")
    except ValueError:
        return ""


def _is_own_host(host: str) -> bool:
    return not host or any(host == h or host.endswith("." + h) for h in _OWN_HOSTS)


def badge_eligible(doc: dict) -> bool:
    """Partner badge: the widget was seen in the last 60 days on an external site — and on the venue's
    own website domain when the listing names one. Never a verification or endorsement."""
    host, seen = str(doc.get("growth_widget_host") or ""), doc.get("growth_widget_seen_at") or 0
    if not host or _now_ms() - int(seen) > BADGE_WINDOW_MS:
        return False
    site = _host_of(_website(doc) or "")
    if not site:
        return True
    bare = site[4:] if site.startswith("www.") else site
    return host == bare or host.endswith("." + bare)


def widget_on_own_site(doc: dict) -> bool:
    """The widget is live on the venue's OWN website (a website is listed and the badge host matches it)."""
    return bool(_host_of(_website(doc) or "")) and badge_eligible(doc)


async def _counts(code: str) -> dict:
    out = {k: 0 for k in EVENT_KINDS if k != "widget_load"}
    async for row in db.venue_growth_events.aggregate([{"$match": {"code": code}}, {"$group": {"_id": "$kind", "n": {"$sum": 1}}}]):
        if row["_id"] in out:
            out[row["_id"]] = row["n"]
    return out


# ── Shared widget configuration (central, versioned) ────────────────────────
DEFAULT_CONFIG = {
    "brand": {"name": "NOSTOPS", "tagline": "A teacher-first yoga cooperative"},
    "colors": {"accent": "#0F766E", "text": "#1F2A2E", "muted": "#5B6670", "background": "#FBF8F3"},
    "font": "serif",
    "layout": {"radius": 18, "max_width": 640},
    "listed": {"eyebrow": "LISTED ON NOSTOPS", "title": "A space for meaningful yoga retreats.",
               "body": "Discover our venue and explore opportunities to collaborate with yoga teachers.",
               "button": "Explore Our Venue"},
    "teacher": {"eyebrow": "FOR YOGA TEACHERS", "title": "Are You a Yoga Teacher?",
                "body": "Looking for a venue to host your next yoga retreat? Discover our property, explore the "
                        "possibilities and connect with us to discuss a collaboration.",
                "button": "Explore This Venue", "secondary": "Create Your Free Teacher Profile"},
    "pending": {"eyebrow": "NOSTOPS", "title": "Are You a Yoga Teacher?",
                "body": "NOSTOPS is a teacher-first yoga cooperative. Create your free professional profile and "
                        "discover venues for your next retreat.",
                "button": "Discover Venues on NOSTOPS", "secondary": "Create Your Free Teacher Profile"},
    "destinations": {"teacher_signup": "/join", "venues": "/venues"},
}
_TEXT_LIMITS = {"eyebrow": 40, "title": 90, "body": 320, "button": 40, "secondary": 50, "name": 30, "tagline": 80}
_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
_PATH = re.compile(r"^/(?!/)[A-Za-z0-9\-_/]{0,80}$")
_FONTS = ("serif", "system")


def _clean_text(v, limit: int, field: str) -> str:
    raw = str(v if v is not None else "")
    if "<" in raw or ">" in raw:  # refuse markup outright (never silently rewrite what an admin typed)
        raise HTTPException(status_code=422, detail=f"{field}: no < or > characters.")
    s = re.sub(r"[\x00-\x1f\x7f]", "", raw).strip()
    if not s or len(s) > limit:
        raise HTTPException(status_code=422, detail=f"{field}: 1–{limit} characters, no < or >.")
    return s


def validate_config(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise HTTPException(status_code=422, detail="config must be an object")
    out: dict = {}
    for group in ("brand", "listed", "teacher", "pending"):
        src = raw.get(group) if isinstance(raw.get(group), dict) else {}
        out[group] = {k: _clean_text(src.get(k, d), _TEXT_LIMITS[k], f"{group}.{k}") for k, d in DEFAULT_CONFIG[group].items()}
    colors = raw.get("colors") if isinstance(raw.get("colors"), dict) else {}
    out["colors"] = {}
    for k, d in DEFAULT_CONFIG["colors"].items():
        c = str(colors.get(k, d)).strip()
        if not _COLOR.match(c):
            raise HTTPException(status_code=422, detail=f"colors.{k}: use a #RRGGBB colour.")
        out["colors"][k] = c.upper()
    font = str(raw.get("font", DEFAULT_CONFIG["font"]))
    if font not in _FONTS:
        raise HTTPException(status_code=422, detail="font: serif or system.")
    out["font"] = font
    layout = raw.get("layout") if isinstance(raw.get("layout"), dict) else {}
    try:
        radius, width = int(layout.get("radius", 18)), int(layout.get("max_width", 640))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="layout: whole numbers only.")
    if not (0 <= radius <= 28 and 320 <= width <= 960):
        raise HTTPException(status_code=422, detail="layout: radius 0–28, max width 320–960.")
    out["layout"] = {"radius": radius, "max_width": width}
    dest = raw.get("destinations") if isinstance(raw.get("destinations"), dict) else {}
    out["destinations"] = {}
    for k, d in DEFAULT_CONFIG["destinations"].items():
        p = str(dest.get(k, d)).strip()
        if not _PATH.match(p):  # NOSTOPS-relative paths only: never another site, never a script URL
            raise HTTPException(status_code=422, detail=f"destinations.{k}: a NOSTOPS path such as /join.")
        out["destinations"][k] = p
    return out


async def current_config() -> dict:
    doc = await db.venue_growth_config.find_one({}, sort=[("version", -1)])
    if not doc:
        return {"version": 0, "config": DEFAULT_CONFIG, "updated_at": None}
    return {"version": doc["version"], "config": doc["config"], "updated_at": doc.get("created_at")}


@router.get("/config")
async def get_config(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    return {**await current_config(), "defaults": DEFAULT_CONFIG}


class ConfigIn(BaseModel):
    config: dict
    actor: str = Field(default="admin", max_length=120)
    note: str = Field(default="", max_length=300)


@router.put("/config")
async def put_config(payload: ConfigIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """Admin-only (the website BFF checks the admin session). Publishes a NEW version; history kept."""
    _check_secret(x_pulse_secret)
    cfg = validate_config(payload.config)
    for _ in range(3):
        version = (await current_config())["version"] + 1
        try:
            await db.venue_growth_config.insert_one({"_id": f"cfg_{version}", "version": version, "config": cfg,
                                                     "created_at": venues._now_iso(), "created_by": payload.actor[:120],
                                                     "note": payload.note[:300]})
            return {"version": version, "config": cfg}
        except DuplicateKeyError:
            continue
    raise HTTPException(status_code=409, detail="Someone else just saved. Please reload and try again.")


@router.get("/config/history")
async def config_history(x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    rows = await db.venue_growth_config.find({}, {"config": 0}).sort("version", -1).to_list(20)
    return {"history": [{"version": r["version"], "created_at": r.get("created_at"), "created_by": r.get("created_by"),
                         "note": r.get("note") or ""} for r in rows]}


# ── Owner toolkit (kit token) ───────────────────────────────────────────────
async def _kit_doc(token: str) -> dict:
    sid = verify_kit_token(token)
    doc = await db.venue_submissions.find_one({"_id": sid}) if sid else None
    if not doc:
        raise HTTPException(status_code=403, detail="This toolkit link is invalid or has expired.")
    if doc.get("status") not in _STATUS:
        raise HTTPException(status_code=410, detail=venues._CLOSED_MSG)
    return doc


@router.get("/kit")
async def get_kit(token: str = Query(..., max_length=400), base: str = Query(default="", max_length=200),
                  x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    doc = await _kit_doc(token)
    code = await ensure_code(doc["_id"])
    key, label = _STATUS[doc["status"]]
    b = _allowed_base(base)
    name = str(doc.get("name") or "Our venue")[:120]
    links = {"listing": f"{b}/v/{code}", "join": f"{b}/v/{code}/join", "script": f"{b}/widgets/venue.js"}
    seen = doc.get("growth_widget_seen_at")
    return {
        "code": code,
        "venue": {"name": name, "city": doc.get("city") or None,
                  "state": doc.get("state") or None, "country": doc.get("country") or None,
                  "website": _website(doc), "status": key, "status_label": label,
                  "venue_id": doc["_id"] if key == "published" else None},
        "links": links,
        "note": [{"style": s, "text": t, "url": u} for s, t, u in
                 invitation_lines(name, _website(doc), links["listing"], links["join"], key == "published")],
        "note_hi": [{"style": s, "text": t, "url": u} for s, t, u in
                    invitation_lines_hi(name, _website(doc), links["listing"], links["join"], key == "published")],
        "counts": await _counts(code),
        "badge": badge_eligible(doc),
        "widget": {"host": doc.get("growth_widget_host") or None, "seen_at": int(seen) if seen else None},
        "monthly": {"enabled": not doc.get("growth_monthly_optout"), "widget_on_own_site": widget_on_own_site(doc)},
    }


class KitFromEditIn(BaseModel):
    edit_token: str = Field(min_length=10, max_length=400)


@router.post("/kit-token")
async def kit_from_edit(payload: KitFromEditIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """The owner's emailed edit link opens their toolkit too (a read-only kit token is issued)."""
    _check_secret(x_pulse_secret)
    v = venues._verify_edit_token(payload.edit_token)
    doc = await db.venue_submissions.find_one({"_id": v["sid"]}) if v else None
    if not doc or (doc.get("submitter_email") or "").lower() != (v or {}).get("email", "").lower():
        raise HTTPException(status_code=403, detail="This link is invalid or has expired.")
    if doc.get("status") not in _STATUS:
        raise HTTPException(status_code=410, detail=venues._CLOSED_MSG)
    return {"kit_token": make_kit_token(doc["_id"])}


# ── Public resolution (code → state), widget loads and attribution events ────
async def _resolve(code: str) -> tuple[Optional[dict], str]:
    if not CODE_RE.match(code or ""):
        return None, "unknown"
    doc = await db.venue_submissions.find_one({"growth_code": code})
    if not doc:
        return None, "unknown"
    if doc.get("status") == "published":
        return doc, "published"
    return doc, "pending" if doc.get("status") in _STATUS else "closed"


@router.get("/resolve/{code}")
async def resolve(code: str, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    doc, state = await _resolve(code)
    return {"code": code if doc else None, "state": state, "venue_id": doc["_id"] if state == "published" else None}


def _visitor_hash(visitor: str) -> str:
    return hashlib.sha256(f"{venues.SECRET}|visitor|{visitor}".encode()).hexdigest()[:32]


async def _record(code: str, kind: str, *, visitor: str = "", user_id: str = "") -> bool:
    """One count per venue + kind + visitor + day (per user, ever, for registrations/profiles)."""
    day = time.strftime("%Y-%m-%d", time.gmtime())
    if kind in _USER_KINDS:
        if not user_id:
            return False
        key = f"{kind}|{hashlib.sha256(user_id.encode()).hexdigest()[:32]}"  # a teacher counts for ONE venue only
    else:
        if not visitor:
            return False
        key = f"{code}|{kind}|{_visitor_hash(visitor)}|{day}"
    try:
        await db.venue_growth_events.insert_one({"_id": hashlib.sha256(key.encode()).hexdigest(), "code": code,
                                                 "kind": kind, "day": day, "at": _now_ms()})
        return True
    except DuplicateKeyError:
        return False


class EventIn(BaseModel):
    code: str = Field(min_length=10, max_length=10)
    kind: str = Field(max_length=30)
    visitor: str = Field(default="", max_length=64)
    user_id: str = Field(default="", max_length=120)
    venue_id: str = Field(default="", max_length=80)  # profile_view: must be THIS venue's public page


@router.post("/events")
async def record_event(payload: EventIn, x_pulse_secret: Optional[str] = Header(None)) -> dict:
    _check_secret(x_pulse_secret)
    if payload.kind not in EVENT_KINDS or payload.kind == "widget_load":
        raise HTTPException(status_code=400, detail="unknown kind")
    doc, state = await _resolve(payload.code)
    if not doc or state == "closed":
        return {"counted": False}
    if payload.kind == "profile_view" and (state != "published" or payload.venue_id != doc["_id"]):
        return {"counted": False}
    return {"counted": await _record(payload.code, payload.kind, visitor=payload.visitor, user_id=payload.user_id)}


@router.get("/widget/{code}")
async def widget(code: str, host: str = Query(default="", max_length=253), visitor: str = Query(default="", max_length=64),
                 x_pulse_secret: Optional[str] = Header(None)) -> dict:
    """What an installed widget needs: the venue's state (+ public id once published) and the CURRENT
    shared configuration. A load from an external site is remembered for the partner badge."""
    _check_secret(x_pulse_secret)
    doc, state = await _resolve(code)
    cfg = await current_config()
    out = {"state": state, "venue_id": doc["_id"] if state == "published" else None,
           "config_version": cfg["version"], "config": cfg["config"]}
    h = _host_of(host)
    if doc and state != "closed" and h and not _is_own_host(h) and re.match(r"^[a-z0-9.-]{3,253}$", h):
        now = _now_ms()
        prev = str(doc.get("growth_widget_host") or "")
        # A recent sighting on the venue's OWN website is never replaced by another site embedding it.
        keep_own = prev and prev != h and widget_on_own_site(doc) and not widget_on_own_site({**doc, "growth_widget_host": h})
        # Write at most once an hour per venue + site (a widget loads on every page view).
        if not keep_own and (prev != h or now - int(doc.get("growth_widget_seen_at") or 0) > 60 * 60 * 1000):
            await db.venue_submissions.update_one({"_id": doc["_id"]},
                                                  {"$set": {"growth_widget_host": h, "growth_widget_seen_at": now}})
            await _record(code, "widget_load", visitor=f"{h}|{visitor}")
    return out


# ── Invitation PDF ──────────────────────────────────────────────────────────
def _allowed_base(base: str) -> str:
    b = base.strip().rstrip("/")
    h = _host_of(b)
    if b.startswith("https://") and (h in ("www.nostops.org", "nostops.org") or h.endswith(".preview.emergentagent.com")):
        return b
    if b.startswith("http://") and h in ("localhost", "127.0.0.1"):
        return b
    return "https://www.nostops.org"


def invitation_lines(name: str, website: Optional[str], listing_url: str, join_url: str, published: bool = True) -> list:
    """The approved invitation note, as (style, text, url) lines. Website omitted when there is none.
    Until the venue is published the note never claims a listing; its link opens a general NOSTOPS page."""
    intro = (f"Our venue, {name}, is listed on NOSTOPS, a teacher-first yoga cooperative." if published
             else f"Our venue, {name}, is joining NOSTOPS, a teacher-first yoga cooperative.")
    lines = [("h1", "AN INVITATION TO YOGA TEACHERS", None), ("p", "Namaste!", None),
             ("p", intro, None),
             ("p", "We invite yoga teachers to discover our property and explore opportunities to host meaningful yoga retreats.", None),
             ("p", "We would love to discuss the facilities, possible dates and commercial arrangements with interested teachers.", None)]
    if website:
        lines += [("h2", "EXPLORE OUR VENUE:", None), ("link", website, website)]
    lines += [("h2", "VIEW OUR NOSTOPS LISTING:" if published else "DISCOVER VENUES ON NOSTOPS:", None),
              ("link", listing_url, listing_url),
              ("h2", "ARE YOU A YOGA TEACHER?", None),
              ("p", "Create your free professional profile on NOSTOPS and discover opportunities to connect with venues and the wider yoga community.", None),
              ("h2", "CREATE YOUR FREE TEACHER PROFILE:", None), ("link", join_url, join_url),
              ("p", "We look forward to exploring the possibilities together.", None),
              ("p", "Warm regards,", None), ("strong", name, None)]
    return lines


def invitation_lines_hi(name: str, website: Optional[str], listing_url: str, join_url: str, published: bool = True) -> list:
    """The invitation note in Hindi (same structure; see /app/memory/HINDI_POSTER_COPY.md). NOSTOPS, the venue
    name and links stay exactly as they are."""
    tag = "जो शिक्षक-प्रथम योग सहकारी संस्था है।"
    intro = (f"हमारा स्थल, {name}, NOSTOPS पर सूचीबद्ध है, {tag}" if published
             else f"हमारा स्थल, {name}, NOSTOPS से जुड़ रहा है, {tag}")
    lines = [("h1", "योग शिक्षकों के लिए निमंत्रण", None), ("p", "नमस्ते!", None),
             ("p", intro, None),
             ("p", "हम योग शिक्षकों को हमारे स्थल को देखने और यहाँ सार्थक योग रिट्रीट आयोजित करने की संभावनाएँ "
                   "तलाशने के लिए आमंत्रित करते हैं।", None),
             ("p", "इच्छुक शिक्षकों के साथ हम सुविधाओं, संभावित तिथियों और व्यावसायिक व्यवस्थाओं पर चर्चा करना चाहेंगे।", None)]
    if website:
        lines += [("h2", "हमारा स्थल देखें:", None), ("link", website, website)]
    lines += [("h2", "NOSTOPS पर हमारी लिस्टिंग देखें:" if published else "NOSTOPS पर स्थल खोजें:", None),
              ("link", listing_url, listing_url),
              ("h2", "क्या आप योग शिक्षक हैं?", None),
              ("p", "NOSTOPS पर अपनी निःशुल्क पेशेवर प्रोफ़ाइल बनाएँ और स्थलों तथा व्यापक योग समुदाय से जुड़ने के अवसर खोजें।", None),
              ("h2", "अपनी निःशुल्क शिक्षक प्रोफ़ाइल बनाएँ:", None), ("link", join_url, join_url),
              ("p", "हम साथ मिलकर संभावनाएँ तलाशने के लिए उत्सुक हैं।", None),
              ("p", "सादर,", None), ("strong", name, None)]
    return lines


def _invitation_pdf_hi(name: str, lines: list) -> bytes:
    """Hindi note: drawn line by line in Hind with HarfBuzz shaping (as the Hindi posters), so conjuncts
    and matras render correctly; links stay clickable."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.utils import simpleSplit
    from reportlab.pdfgen import canvas

    import venue_growth_partners as vgp  # lazy: that module imports this one

    regular, bold = vgp._hindi_fonts()
    ink, accent, muted = colors.HexColor("#1F2A2E"), colors.HexColor("#0F766E"), colors.HexColor("#5B6670")
    spec = {  # font, size, leading, colour, space before, space after
        "h1": (bold, 18, 26, accent, 0, 10), "h2": (bold, 11, 17, ink, 8, 0), "p": (regular, 11.5, 18, ink, 0, 6),
        "link": (regular, 10.5, 16, accent, 0, 4), "strong": (bold, 11.5, 18, ink, 0, 0),
    }
    W, H = A4
    left, width = 22 * mm, W - 44 * mm
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"योग शिक्षकों के लिए निमंत्रण — {name}")
    c.setAuthor(name)
    c.setSubject("NOSTOPS venue invitation (Hindi)")

    def draw(y: float, text: str, font: str, size: float, color, url: Optional[str] = None) -> None:
        s, w = vgp._shaped(text, font, size)
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawString(left, y, s)
        if url:
            c.setStrokeColor(color)
            c.setLineWidth(0.6)
            c.line(left, y - 1.6, left + w, y - 1.6)
            c.linkURL(url, (left, y - 3, left + w, y + size), relative=0)

    y = H - 22 * mm
    for style, text, url in lines:
        font, size, lead, color, before, after = spec[style]
        y -= before
        for ln in simpleSplit(text, font, size, width):
            y -= lead
            draw(y, ln, font, size, color, url)
        y -= after
    foot = ("NOSTOPS · www.nostops.org · शिक्षक-प्रथम योग सहकारी संस्था। "
            "NOSTOPS पर सूचीबद्ध होना स्थल का सत्यापन या समर्थन नहीं है।")
    fy = y - 22
    for ln in simpleSplit(foot, regular, 8.5, width):
        draw(fy, ln, regular, 8.5, muted)
        fy -= 12
    c.showPage()
    c.save()
    return buf.getvalue()


def build_invitation_pdf(name: str, website: Optional[str], listing_url: str, join_url: str, published: bool = True) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    ink, accent = colors.HexColor("#1F2A2E"), colors.HexColor("#0F766E")
    st = {
        "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=17, leading=22, textColor=accent, spaceAfter=10),
        "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=ink, spaceBefore=8),
        "p": ParagraphStyle("p", fontName="Helvetica", fontSize=11, leading=16, textColor=ink, spaceAfter=6),
        "link": ParagraphStyle("link", fontName="Helvetica", fontSize=10.5, leading=15, textColor=accent, spaceAfter=4),
        "strong": ParagraphStyle("strong", fontName="Helvetica-Bold", fontSize=11, leading=16, textColor=ink),
    }
    buf = io.BytesIO()
    pdf = SimpleDocTemplate(buf, pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm, topMargin=22 * mm, bottomMargin=20 * mm,
                            title=f"Invitation to yoga teachers — {name}", author=name, subject="NOSTOPS venue invitation")
    story = []
    for style, text, url in invitation_lines(name, website, listing_url, join_url, published):
        t = xml_escape(text)
        if url:
            t = f'<link href="{xml_escape(url, {chr(34): "&quot;"})}" color="#0F766E"><u>{t}</u></link>'
        story.append(Paragraph(t, st[style]))
    story += [Spacer(1, 14), Paragraph("NOSTOPS · www.nostops.org · A teacher-first yoga cooperative. Listing on NOSTOPS is not a "
                                       "verification or endorsement of the venue.",
                                       ParagraphStyle("foot", fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#5B6670")))]
    pdf.build(story)
    return buf.getvalue()


@router.get("/invitation.pdf")
async def invitation_pdf(token: str = Query(..., max_length=400), base: str = Query(default="", max_length=200),
                         inline: bool = Query(default=False), lang: str = Query(default="en", max_length=2),
                         x_pulse_secret: Optional[str] = Header(None)) -> Response:
    _check_secret(x_pulse_secret)
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=422, detail="lang: en or hi")
    doc = await _kit_doc(token)
    code = await ensure_code(doc["_id"])
    b = _allowed_base(base)
    name = str(doc.get("name") or "Our venue")[:120]
    args = (name, _website(doc), f"{b}/v/{code}", f"{b}/v/{code}/join", doc.get("status") == "published")
    pdf = _invitation_pdf_hi(name, invitation_lines_hi(*args)) if lang == "hi" else build_invitation_pdf(*args)
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "venue"
    disposition = "inline" if inline else "attachment"
    suffix = "-hi" if lang == "hi" else ""
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disposition}; filename="nostops-invitation-{slug}{suffix}.pdf"',
                             "Cache-Control": "no-store"})
