"""Phase 1 — Global Venue Owner claims + owner-managed editing (local sidecar).

Ownership lives on the EXISTING canonical public venue record (`venue_submissions`):
`owner_id`, `owner_name`, `owner_email`, `owner_claimed_at`, `owner_claim_id`, `owner_history[]`.
No new venue collection, no new auth: the user identity comes from the BFF-signed
X-Pulse-User header (venues.current_user), never from the browser.

  * Claims (`venue_claims`) — every claim needs explicit admin approval. Evidence is advisory.
  * Evidence documents (`venue_claim_docs`) — private; only the admin BFF route can read them.
  * Owner edits — D1: low-risk fields publish immediately (history + revision); sensitive fields
    become `pending_changes` (reusing the existing admin approve/reject flow in venues.py).
"""
import base64
import re
import uuid
from html import escape
from typing import Optional

from email_util import send_email

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from venues import (
    _add_revision, _ensure_baseline, _now_iso, _require_admin, _snapshot, current_user, db,
)

router = APIRouter(prefix="/api/venues", tags=["venue-ownership"])

CLAIM_STATUSES = {"submitted", "verification_pending", "under_review", "approved", "rejected", "disputed"}
OPEN_CLAIM = {"submitted", "verification_pending", "under_review", "disputed"}
EVIDENCE_METHODS = {"business_email", "website_domain", "google_business", "business_document", "authorization_letter", "other"}
DOC_TYPES = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_DOC_BYTES = 4 * 1024 * 1024
CLAIMABLE = {"published", "approved"}

# D1 — exact classification. Anything not listed here is treated as sensitive.
LOW_RISK = ("contact_phone", "contact_email", "website_or_maps_url", "amenities", "open_months", "getting_there", "things_to_carry",
            "open_to_partnerships")
SENSITIVE = ("name", "city", "address", "country", "state", "capacity", "description", "photos", "venue_type", "best_for")
MONTHS = {"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"}


NOT_ELIGIBLE = "Only empanelled NOSTOPS teachers (Level 2 and Level 3) and Council Gurus can claim and manage venues."


def _require_venue_eligible(user: dict) -> None:
    # The BFF sets venue_eligible only after checking empanelment / Council status (owner decision).
    if not (user.get("venue_eligible") is True or str(user.get("role") or "") == "admin"):
        raise HTTPException(status_code=403, detail=NOT_ELIGIBLE)


def _uid(user: dict) -> str:
    return str(user.get("user_id"))


def _actor(user: dict) -> str:
    return str(user.get("name") or user.get("email") or user.get("user_id"))


async def _audit(venue_id: str, user: dict, action: str, **extra) -> None:
    await db.venue_ownership_audit.insert_one({
        "_id": f"voa_{uuid.uuid4().hex[:16]}", "venue_id": venue_id, "actor_id": _uid(user), "actor": _actor(user),
        "actor_role": str(user.get("role") or ""), "action": action, "at": _now_iso(), **extra,
    })


def _claim_public(c: dict, admin: bool = False) -> dict:
    out = {k: c.get(k) for k in ("venue_id", "venue_name", "venue_city", "status", "relationship", "evidence_methods",
                                 "business_email", "website", "google_business_url", "note", "created_at", "updated_at",
                                 "decision_note", "is_transfer", "duplicate_of", "conflict")}
    out["id"] = c["_id"]
    out["documents"] = [{"id": d["id"], "name": d["name"], "type": d["type"]} for d in c.get("documents", [])]
    if admin:
        out.update({k: c.get(k) for k in ("claimant_id", "claimant_name", "claimant_email", "decided_by", "decided_at", "history",
                                           "email_domain_matches_website")})
    return out


# ── Claims ────────────────────────────────────────────────────────────────────
class ClaimDoc(BaseModel):
    name: str = Field(max_length=120)
    type: str = Field(max_length=60)
    base64: str = Field(max_length=6_000_000)


class ClaimIn(BaseModel):
    venue_id: str = Field(min_length=3, max_length=80)
    relationship: str = Field(min_length=2, max_length=60)
    evidence_methods: list[str] = Field(default_factory=list)
    business_email: str = Field(default="", max_length=160)
    website: str = Field(default="", max_length=300)
    google_business_url: str = Field(default="", max_length=400)
    note: str = Field(default="", max_length=2000)
    documents: list[ClaimDoc] = Field(default_factory=list, max_length=3)


def _domain(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"^[a-z]+://", "", s).split("/")[0]
    return s[4:] if s.startswith("www.") else s


@router.post("/claims")
async def create_claim(payload: ClaimIn, user: dict = Depends(current_user)):
    _require_venue_eligible(user)
    venue = await db.venue_submissions.find_one({"_id": payload.venue_id})
    if not venue or venue.get("status") not in CLAIMABLE:
        raise HTTPException(status_code=404, detail="This venue is not available to claim.")
    uid = _uid(user)
    if venue.get("owner_id") == uid:
        raise HTTPException(status_code=409, detail="You already manage this venue.")
    mine = await db.venue_claims.find_one({"venue_id": payload.venue_id, "claimant_id": uid, "status": {"$in": list(OPEN_CLAIM)}})
    if mine:
        raise HTTPException(status_code=409, detail="You already have a claim under review for this venue.")
    methods = [m for m in payload.evidence_methods if m in EVIDENCE_METHODS]
    if not methods:
        raise HTTPException(status_code=400, detail="Choose at least one type of evidence.")
    docs = []
    for d in payload.documents:
        if d.type not in DOC_TYPES:
            raise HTTPException(status_code=400, detail="Documents must be PDF, JPG, PNG or WebP.")
        try:
            raw = base64.b64decode(d.base64.split(",", 1)[-1], validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="A document could not be read.")
        if len(raw) > MAX_DOC_BYTES:
            raise HTTPException(status_code=400, detail="Each document must be 4 MB or smaller.")
        did = f"doc_{uuid.uuid4().hex[:16]}"
        await db.venue_claim_docs.insert_one({"_id": did, "data": raw, "type": d.type, "name": d.name[:120]})
        docs.append({"id": did, "name": d.name[:120], "type": d.type})
    email = payload.business_email.strip().lower()
    site_dom = _domain(payload.website or venue.get("website_or_maps_url") or "")
    other_open = await db.venue_claims.find_one({"venue_id": payload.venue_id, "claimant_id": {"$ne": uid}, "status": {"$in": list(OPEN_CLAIM)}})
    now = _now_iso()
    is_transfer = bool(venue.get("owner_id"))
    claim = {
        "_id": f"vcl_{uuid.uuid4().hex[:16]}", "venue_id": payload.venue_id, "venue_name": venue.get("name"),
        "venue_city": venue.get("city"), "claimant_id": uid, "claimant_name": str(user.get("name") or ""),
        "claimant_email": str(user.get("email") or ""), "relationship": payload.relationship.strip()[:60],
        "evidence_methods": methods, "business_email": email, "website": payload.website.strip()[:300],
        "google_business_url": payload.google_business_url.strip()[:400], "note": payload.note.strip()[:2000],
        "documents": docs,
        # Advisory signal only — never grants ownership by itself.
        "email_domain_matches_website": bool(email and "@" in email and site_dom and email.split("@", 1)[1] == site_dom),
        # Contested claims (venue already owned, or another open claim) go straight to dispute handling.
        "status": "disputed" if (is_transfer or other_open) else "under_review",
        "is_transfer": is_transfer, "duplicate_of": other_open["_id"] if other_open else None,
        # Ownership state this claim was made against — approval is a compare-and-set on exactly this value.
        "expected_owner_claim_id": venue.get("owner_claim_id"),
        "created_at": now, "updated_at": now,
        "history": [{"action": "submitted", "actor": _actor(user), "at": now}],
    }
    await db.venue_claims.insert_one(claim)
    if other_open:
        await db.venue_claims.update_one({"_id": other_open["_id"]}, {"$set": {"status": "disputed", "updated_at": now},
                                                                       "$push": {"history": {"action": "duplicate_claim_flagged", "actor": "system", "at": now, "note": claim["_id"]}}})
    await _audit(payload.venue_id, user, "claim_submitted", claim_id=claim["_id"], evidence_methods=methods, is_transfer=is_transfer)
    return {"ok": True, "claim": _claim_public(claim)}


@router.get("/claims/mine")
async def my_claims(user: dict = Depends(current_user)):
    docs = await db.venue_claims.find({"claimant_id": _uid(user)}).sort("created_at", -1).to_list(100)
    return {"items": [_claim_public(c) for c in docs]}


@router.get("/claims")
async def list_claims(user: dict = Depends(current_user)):
    _require_admin(user)
    docs = await db.venue_claims.find({}).sort("created_at", -1).to_list(500)
    return {"items": [_claim_public(c, admin=True) for c in docs]}


@router.get("/claims/doc/{did}")
async def claim_doc(did: str, user: dict = Depends(current_user)):
    _require_admin(user)
    d = await db.venue_claim_docs.find_one({"_id": did})
    if not d:
        raise HTTPException(status_code=404, detail="not found")
    return {"type": d["type"], "name": d["name"], "base64": base64.b64encode(d["data"]).decode()}


class DecisionIn(BaseModel):
    note: str = Field(default="", max_length=1000)


@router.post("/claims/{cid}/{decision}")
async def decide_claim(cid: str, decision: str, payload: DecisionIn, user: dict = Depends(current_user)):
    _require_admin(user)
    if decision not in ("approve", "reject", "dispute", "review"):
        raise HTTPException(status_code=400, detail="unsupported decision")
    c = await db.venue_claims.find_one({"_id": cid})
    if not c:
        raise HTTPException(status_code=404, detail="not found")
    if c["status"] == "rejected" and c.get("conflict"):
        raise HTTPException(status_code=409, detail={"conflict": True, "msg": "Another claim for this venue was approved at the same moment. This claim has been closed."})
    if c["status"] in ("approved", "rejected"):
        raise HTTPException(status_code=409, detail="This claim has already been decided.")
    if c.get("claimant_id") == _uid(user):
        raise HTTPException(status_code=403, detail="You cannot decide your own claim.")
    now, actor, note = _now_iso(), _actor(user), payload.note.strip()[:1000]
    status = {"approve": "approved", "reject": "rejected", "dispute": "disputed", "review": "under_review"}[decision]
    # Atomic guard: move the claim out of the open set first, so two admins can never both decide it.
    claimed = await db.venue_claims.find_one_and_update(
        {"_id": cid, "status": {"$in": list(OPEN_CLAIM)}, "deciding": {"$ne": True}}, {"$set": {"deciding": True}})
    if not claimed:
        latest = await db.venue_claims.find_one({"_id": cid}) or {}
        if latest.get("conflict"):
            raise HTTPException(status_code=409, detail={"conflict": True, "msg": "Another claim for this venue was approved at the same moment. This claim has been closed."})
        raise HTTPException(status_code=409, detail="This claim has already been decided.")
    try:
        if decision == "approve":
            won = await _approve(c, cid, actor, note, now)
            if not won:
                # Lost a simultaneous approval race: exactly one claim wins; this one is closed with a clear conflict note.
                await db.venue_claims.update_one({"_id": cid}, {
                    "$set": {"status": "rejected", "conflict": True, "decision_note": SUPERSEDED, "decided_by": actor, "decided_at": now, "updated_at": now},
                    "$unset": {"deciding": ""},
                    "$push": {"history": {"action": "approve_conflict", "actor": actor, "at": now, "note": SUPERSEDED}},
                })
                await _audit(c["venue_id"], user, "claim_approve_conflict", claim_id=cid)
                await _email_claimant(c, False, SUPERSEDED)
                raise HTTPException(status_code=409, detail={"conflict": True, "msg": "Another claim for this venue was approved at the same moment. This claim has been closed."})
    except HTTPException as e:
        if not (isinstance(e.detail, dict) and e.detail.get("conflict")):
            await db.venue_claims.update_one({"_id": cid}, {"$unset": {"deciding": ""}})
        raise
    except Exception:
        await db.venue_claims.update_one({"_id": cid}, {"$unset": {"deciding": ""}})
        raise
    await db.venue_claims.update_one({"_id": cid, "deciding": True}, {
        "$set": {"status": status, "decision_note": note or None, "decided_by": actor if status in ("approved", "rejected") else None,
                 "decided_at": now if status in ("approved", "rejected") else None, "updated_at": now},
        "$unset": {"deciding": ""},
        "$push": {"history": {"action": decision, "actor": actor, "at": now, "note": note or None}},
    })
    await _audit(c["venue_id"], user, f"claim_{decision}", claim_id=cid, note=note or None, evidence_methods=c.get("evidence_methods"))
    if status in ("approved", "rejected"):
        await _email_claimant(c, status == "approved", note)
    return {"ok": True, "claim": _claim_public(await db.venue_claims.find_one({"_id": cid}), admin=True)}


async def _email_claimant(c: dict, approved: bool, note: str) -> None:
    to_addr = c.get("claimant_email")
    if not to_addr or "@" not in to_addr:
        return
    venue = escape(c.get("venue_name") or "the venue")
    if approved:
        subject, line = "Your venue claim is approved 🌿", f"Your claim for <strong>{venue}</strong> has been approved. You can now manage it from Venue Studio in your NOSTOPS account."
    else:
        subject, line = "About your venue claim", f"We could not approve your claim for <strong>{venue}</strong>." + (f" Note from our team: {escape(note)}" if note else "")
    html = ('<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2937">'
            f'<p style="font-size:16px">Namaste,</p><p>{line}</p>'
            '<p style="font-size:12px;color:#9ca3af;margin-top:24px">Sent by NOSTOPS. We never ask for your password or payment details by email.</p>'
            '</td></tr></table>')
    try:
        await send_email(to=to_addr, subject=subject, html=html)
    except Exception:
        pass


SUPERSEDED = "Another claim for this venue was approved."


async def _approve(c: dict, cid: str, actor: str, note: str, now: str) -> bool:
    """Returns True if this claim won ownership, False if a competing approval got there first."""
    venue = await db.venue_submissions.find_one({"_id": c["venue_id"]})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found.")
    prev = venue.get("owner_id")
    # Single atomic compare-and-set on the venue document: it only matches while owner_claim_id is
    # still the value we read, so of N simultaneous approvals exactly one can succeed.
    expected = c["expected_owner_claim_id"] if "expected_owner_claim_id" in c else (venue.get("owner_claim_id") if c.get("is_transfer") else None)
    res = await db.venue_submissions.update_one({"_id": c["venue_id"], "owner_claim_id": expected}, {
        "$set": {"owner_id": c["claimant_id"], "owner_name": c.get("claimant_name"), "owner_email": c.get("claimant_email"),
                 "owner_relationship": c.get("relationship"),
                 "owner_claimed_at": now, "owner_claim_id": cid, "updated_at": now},
        "$push": {"owner_history": {"action": "transferred" if prev else "assigned", "from": prev, "to": c["claimant_id"],
                                    "claim_id": cid, "by": actor, "at": now, "note": note or None},
                  "history": {"action": "owner_claim_approved", "actor": actor, "at": now, "note": cid}},
    })
    if res.matched_count != 1:
        return False
    # Transfer: the previous owner's unapproved changes must never be inherited or published under the new owner.
    if prev and prev != c["claimant_id"]:
        dropped = await db.venue_submissions.find_one_and_update(
            {"_id": c["venue_id"], "owner_claim_id": cid, "pending_changes": {"$ne": None}},
            {"$unset": {"pending_changes": ""},
             "$push": {"history": {"action": "pending_changes_discarded", "actor": actor, "at": now, "note": "Ownership transferred; previous owner's pending changes discarded."}}})
        if dropped and dropped.get("pending_changes"):
            await db.venue_ownership_audit.insert_one({
                "_id": f"voa_{uuid.uuid4().hex[:16]}", "venue_id": c["venue_id"], "actor": actor, "action": "pending_changes_discarded_on_transfer",
                "at": now, "claim_id": cid, "previous_owner": prev, "discarded": dropped["pending_changes"],
            })
    # Every other open claim on this venue is now superseded — rejected with a note, never silently dropped.
    # Claims mid-decision are skipped here: their own request loses the compare-and-set and closes itself.
    superseded = SUPERSEDED
    others = await db.venue_claims.find({"venue_id": c["venue_id"], "_id": {"$ne": cid}, "status": {"$in": list(OPEN_CLAIM)}, "deciding": {"$ne": True}}).to_list(100)
    await db.venue_claims.update_many(
        {"_id": {"$in": [o["_id"] for o in others]}},
        {"$set": {"status": "rejected", "conflict": True, "decision_note": superseded, "decided_by": actor, "decided_at": now, "updated_at": now}},
    )
    for o in others:
        await _email_claimant(o, False, superseded)
    return True


# ── Owner-managed editing ─────────────────────────────────────────────────────
OWNER_FIELDS = LOW_RISK + SENSITIVE + ("submitter_phone", "relationship_note", "owner_name", "owner_email", "status")


def _owned_view(d: dict) -> dict:
    out = {k: d.get(k) for k in LOW_RISK + SENSITIVE}
    out.update({"id": d["_id"], "status": d.get("status"), "updated_at": d.get("updated_at"),
                "owner_claimed_at": d.get("owner_claimed_at"), "pending": None,
                "owner_name": d.get("owner_name"), "owner_relationship": d.get("owner_relationship"),
                "verification_status": d.get("verification_status"), "open_to_partnerships": d.get("open_to_partnerships", True)})
    pc = d.get("pending_changes")
    if pc:
        out["pending"] = {"fields": pc.get("fields") or {}, "changed": pc.get("changed") or [], "submitted_at": pc.get("submitted_at")}
    out["recent"] = [h for h in (d.get("history") or []) if str(h.get("action", "")).startswith(("owner_", "pending_changes"))][-10:]
    return out


async def _owned_or_404(sid: str, user: dict) -> dict:
    d = await db.venue_submissions.find_one({"_id": sid, "owner_id": _uid(user)})
    if not d:
        raise HTTPException(status_code=404, detail="Venue not found.")
    return d


@router.get("/owned")
async def my_owned(user: dict = Depends(current_user)):
    docs = await db.venue_submissions.find({"owner_id": _uid(user), "owner_claim_id": {"$exists": True}}).to_list(100)
    return {"items": [_owned_view(d) for d in docs]}


@router.get("/owned/{sid}")
async def get_owned(sid: str, user: dict = Depends(current_user)):
    return {"venue": _owned_view(await _owned_or_404(sid, user))}


class GettingThere(BaseModel):
    nearestAirport: str = Field(default="", max_length=200)
    nearestRailway: str = Field(default="", max_length=200)
    nearestRoadHub: str = Field(default="", max_length=200)
    localTransport: str = Field(default="", max_length=400)
    text: str = Field(default="", max_length=1000)


class OwnerEditIn(BaseModel):
    contact_phone: Optional[str] = Field(default=None, max_length=40)
    contact_email: Optional[str] = Field(default=None, max_length=160)
    website_or_maps_url: Optional[str] = Field(default=None, max_length=400)
    amenities: Optional[list[str]] = None
    open_months: Optional[list[str]] = None
    getting_there: Optional[GettingThere] = None
    things_to_carry: Optional[list[str]] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    city: Optional[str] = Field(default=None, min_length=2, max_length=80)
    state: Optional[str] = Field(default=None, max_length=60)
    address: Optional[str] = Field(default=None, max_length=200)
    country: Optional[str] = Field(default=None, max_length=60)
    capacity: Optional[int] = Field(default=None, ge=1, le=5000)
    description: Optional[str] = Field(default=None, max_length=4000)
    photos: Optional[list[str]] = None
    open_to_partnerships: Optional[bool] = None
    venue_type: Optional[str] = Field(default=None, max_length=80)
    best_for: Optional[list[str]] = None
    # Optimistic concurrency: the updated_at the owner's form was loaded from.
    base_updated_at: Optional[str] = Field(default=None, max_length=40)


def _clean_list(v: list, n: int = 40, ln: int = 80) -> list:
    return [str(x).strip()[:ln] for x in v if isinstance(x, str) and str(x).strip()][:n]


def _same(a, b) -> bool:
    norm = lambda x: x if not isinstance(x, str) else x.strip()
    return norm(a or None) == norm(b or None)


@router.patch("/owned/{sid}")
async def edit_owned(sid: str, payload: OwnerEditIn, user: dict = Depends(current_user)):
    _require_venue_eligible(user)
    d = await _owned_or_404(sid, user)
    data = payload.model_dump(exclude_none=True)
    base = data.pop("base_updated_at", None)
    if base and d.get("updated_at") and base != d.get("updated_at"):
        # Someone (an admin, or the owner in another tab) changed the listing after this form was opened —
        # never overwrite their work with stale values.
        raise HTTPException(status_code=409, detail="This listing was updated since you opened it. Reload the page to see the latest version, then make your changes again.")
    for k in ("amenities", "things_to_carry", "best_for"):
        if k in data:
            data[k] = _clean_list(data[k])
    if "open_months" in data:
        data["open_months"] = [m.lower()[:3] for m in data["open_months"] if isinstance(m, str) and m.lower()[:3] in MONTHS]
    if "photos" in data:
        # Only this owner's own NOSTOPS uploads (/bff/venue/photo) or photos already on the listing.
        safe_uid = re.sub(r"[^a-zA-Z0-9_-]", "", _uid(user))[:40] or "owner"
        own = re.compile(rf"^/bff/media/retreats/{re.escape(safe_uid)}/[0-9a-f-]{{36}}\.(jpg|png|webp)$")
        bad = [p for p in data["photos"] if not (isinstance(p, str) and (own.match(p) or p in (d.get("photos") or [])))]
        if bad:
            raise HTTPException(status_code=400, detail="Photos must be uploaded through NOSTOPS.")
        data["photos"] = data["photos"][:10]
    if "contact_email" in data and data["contact_email"] and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", data["contact_email"]):
        raise HTTPException(status_code=400, detail="Enter a valid contact email.")
    for k in ("website_or_maps_url",):
        if data.get(k) and not re.match(r"^https?://", data[k]):
            raise HTTPException(status_code=400, detail="The website must start with http:// or https://")
    for k, v in list(data.items()):
        if isinstance(v, str):
            data[k] = v.strip()
    # An empty "getting there" block is "nothing", not a change.
    if "getting_there" in data:
        gt = {k: v.strip() for k, v in data["getting_there"].items() if isinstance(v, str) and v.strip()}
        if not gt and not d.get("getting_there"):
            data.pop("getting_there")
        else:
            data["getting_there"] = gt
    cur = lambda k: d.get(k, True) if k == "open_to_partnerships" else d.get(k)
    low = {k: v for k, v in data.items() if k in LOW_RISK and (cur(k) != v if isinstance(v, bool) else not _same(cur(k), v))}
    pc = d.get("pending_changes") or {}
    pending_fields = dict(pc.get("fields") or {})
    sens = {k: v for k, v in data.items() if k in SENSITIVE and not _same(d.get(k), v) and not _same(pending_fields.get(k), v)}
    if not low and not sens:
        return {"ok": True, "applied": [], "pending": [], "venue": _owned_view(d)}
    now, actor = _now_iso(), _actor(user)
    # Atomic optimistic lock: only one save can move updated_at forward from the value this request read.
    locked = await db.venue_submissions.find_one_and_update(
        {"_id": sid, "owner_id": _uid(user), "updated_at": d.get("updated_at")}, {"$set": {"updated_at": now}})
    if not locked:
        raise HTTPException(status_code=409, detail="This listing was updated since you opened it. Reload the page to see the latest version, then make your changes again.")
    if low:
        await _ensure_baseline(d)
        await db.venue_submissions.update_one({"_id": sid}, {
            "$set": {**low, "updated_at": now},
            "$push": {"history": {"action": "owner_edit_published", "actor": actor, "at": now, "fields": list(low),
                                  "previous": {k: d.get(k) for k in low}}},
        })
        after = await db.venue_submissions.find_one({"_id": sid})
        await _add_revision(sid, _snapshot(after), kind="applied", action="owner_low_risk_edit", actor=actor, actor_type="owner",
                            changed=list(low), note="Low-risk owner edit published immediately.")
    if sens:
        pending_fields.update(sens)
        changed = sorted(set(pc.get("changed") or []) | set(sens))
        version = int(pc.get("version") or 0) + 1
        rev = await _add_revision(sid, pending_fields, kind="proposed", action="owner_sensitive_edit", actor=actor, actor_type="owner",
                                  changed=changed, note="Awaiting admin review.", state="pending")
        await db.venue_submissions.update_one({"_id": sid}, {
            "$set": {"pending_changes": {"fields": pending_fields, "changed": changed, "submitted_at": now, "actor": actor,
                                         "version": version, "revision_id": rev.get("_id"), "source": "owner_dashboard"}, "updated_at": now},
            "$push": {"history": {"action": "owner_edit_pending", "actor": actor, "at": now, "fields": list(sens),
                                  "previous": {k: d.get(k) for k in sens}, "proposed": sens}},
        })
    await _audit(sid, user, "owner_edit", applied=list(low), pending=list(sens),
                 previous={k: d.get(k) for k in list(low) + list(sens)}, proposed={**low, **sens})
    return {"ok": True, "applied": list(low), "pending": list(sens), "venue": _owned_view(await db.venue_submissions.find_one({"_id": sid}))}


@router.get("/ownership-audit/{sid}")
async def ownership_audit(sid: str, user: dict = Depends(current_user)):
    _require_admin(user)
    docs = await db.venue_ownership_audit.find({"venue_id": sid}).sort("at", -1).to_list(200)
    return {"items": [{k: v for k, v in x.items() if k != "_id"} for x in docs]}
