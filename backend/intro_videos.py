"""NOSTOPS intro-video library — Cloudflare R2 storage + Mongo metadata (collection `intro_videos`).

Frontend → website BFF (/bff/media/*, /bff/admin/intro-videos) → this router → Cloudflare R2.

Every route needs the internal X-Pulse-Secret (only the website BFF has it). The viewer / admin identity
travels in X-Pulse-User, built by the BFF from the httpOnly session — never from browser input.

  * Viewers: GET /published (metadata only) and GET /{id}/playback → a presigned GET link valid for
    1 hour (or the verified public domain for PUBLIC videos, once R2_PUBLIC_BASE_URL is set).
    PUBLIC + PUBLISHED → anyone; PRIVATE + PUBLISHED → any signed-in member; DRAFT → admins only.
  * Admins: overview (settings check, bucket connection, library, read-only bucket listing), upload
    (≤ 10 MB, MP4 / MOV / WebM checked by the file's own bytes), add an existing bucket file to the
    library, edit title / description / visibility / status, and delete.
  * Keys are generated here (intro-videos/<id>.<ext>) — never from the uploaded file name. The same
    file is stored only once (SHA-256 fingerprint). New videos start PRIVATE + DRAFT.
  * Delete removes the R2 object only for files uploaded through NOSTOPS (intro-videos/ prefix);
    files that were already in the bucket are only ever removed from the library, never deleted.
  * Signed links, credentials and object contents are never logged.
"""
import asyncio
import base64
import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

import r2_storage as r2
import test_tag
import venues
from org_enquiries import _check_secret, _require_admin

router = APIRouter(prefix="/api/intro-videos", tags=["intro-videos"])
log = logging.getLogger("intro_videos")
coll = venues.db["intro_videos"]

MAX_UPLOAD_BYTES = 10 * 1024 * 1024       # owner decision: 10 MB per video
UPLOADS_PER_HOUR = 20                     # per admin
PLAYBACK_TTL_S = 3600                     # presigned links live for 1 hour
STALE_UPLOAD = timedelta(minutes=10)      # an upload that never finished stops blocking a retry
VISIBILITY = ("PRIVATE", "PUBLIC")
STATUS = ("DRAFT", "PUBLISHED")
ID_RE = re.compile(r"^iv_[0-9a-f]{16}$")
# Keys of files already in the bucket that an admin may add to the library (no traversal, no oddities).
LINK_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._()\-/]{0,510}$")

_indexes_ready = False


async def _ensure_indexes() -> None:
    global _indexes_ready
    if _indexes_ready:
        return
    await coll.create_index("sha256", unique=True, name="uniq_active_sha256",
                            partialFilterExpression={"active": True, "sha256": {"$type": "string"}})
    await coll.create_index("object_key", unique=True, name="uniq_active_key",
                            partialFilterExpression={"active": True})
    await coll.create_index([("active", 1), ("status", 1), ("created_at", -1)], name="by_status")
    _indexes_ready = True


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d) -> Optional[str]:
    if not isinstance(d, datetime):
        return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat()


def _viewer(x_pulse_user: Optional[str]) -> Optional[dict]:
    """Signed-in member (set by the BFF from the session) or None for a signed-out visitor."""
    if not x_pulse_user:
        return None
    try:
        u = json.loads(base64.b64decode(x_pulse_user).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="unauthorized")
    return u if isinstance(u, dict) and str(u.get("user_id") or "").strip() else None


def _storage_error(e: r2.R2Error) -> JSONResponse:
    return JSONResponse({"detail": e.message, "code": e.code}, status_code=e.status)


async def _r2(fn, *args, **kw):
    return await asyncio.to_thread(fn, *args, **kw)


# ── File checks (the file's own bytes; the browser's file name / type are ignored) ──────────────
MP4_BRANDS = {b"isom", b"iso2", b"iso3", b"iso4", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1",
              b"M4V ", b"M4VH", b"M4VP", b"dash", b"mmp4", b"MSNV", b"XAVC"}
QT_BRAND = b"qt  "


def _boxes(buf: bytes, start: int, end: int):
    """ISO-BMFF boxes between start/end. Raises ValueError on anything malformed."""
    off = start
    while off < end:
        if off + 8 > end:
            raise ValueError("truncated box header")
        size, typ, hdr = int.from_bytes(buf[off:off + 4], "big"), buf[off + 4:off + 8], 8
        if size == 1:
            if off + 16 > end:
                raise ValueError("truncated large box")
            size, hdr = int.from_bytes(buf[off + 8:off + 16], "big"), 16
        elif size == 0:
            size = end - off
        if size < hdr or off + size > end or not all(0x20 <= c <= 0x7E for c in typ):
            raise ValueError("bad box")
        yield typ, off + hdr, off + size
        off += size


def _child(buf: bytes, start: int, end: int, typ: bytes):
    return [(s, e) for t, s, e in _boxes(buf, start, end) if t == typ]


def _brand_type(buf: bytes) -> Optional[tuple[str, str]]:
    if len(buf) >= 12 and buf[4:8] == b"ftyp":
        brand = buf[8:12]
        if brand == QT_BRAND:
            return "video/quicktime", "mov"
        if brand in MP4_BRANDS:
            return "video/mp4", "mp4"
        return None
    if buf[:4] == b"\x1a\x45\xdf\xa3":
        i = buf.find(b"\x42\x82", 4, 64)
        if i != -1 and b"webm" in buf[i:i + 16]:
            return "video/webm", "webm"
    return None


def inspect_video(buf: bytes) -> tuple[str, str, Optional[float]]:
    """Whole-file check for uploads → (content_type, ext, duration_seconds | None)."""
    kind = _brand_type(buf)
    if not kind:
        raise HTTPException(status_code=415, detail="Only MP4, MOV or WebM video files can be uploaded.")
    if kind[0] == "video/webm":
        if b"\x18\x53\x80\x67" not in buf[:4096]:  # Segment element
            raise HTTPException(status_code=415, detail="This WebM file looks damaged.")
        return kind[0], kind[1], None
    try:
        top = list(_boxes(buf, 0, len(buf)))
        if top[0][0] != b"ftyp":
            raise ValueError("ftyp first")
        moov = [(s, e) for t, s, e in top if t == b"moov"]
        if not moov:
            raise ValueError("no moov")
        ms, me = moov[0]
        has_video = False
        for ts, te in _child(buf, ms, me, b"trak"):
            for ds, de in _child(buf, ts, te, b"mdia"):
                for hs, he in _child(buf, ds, de, b"hdlr"):
                    if buf[hs + 8:hs + 12] == b"vide":
                        has_video = True
        if not has_video:
            raise HTTPException(status_code=415, detail="This file has no video track.")
        duration = None
        for hs, he in _child(buf, ms, me, b"mvhd"):
            v = buf[hs]
            if v == 1 and he - hs >= 32:
                ts_, dur = int.from_bytes(buf[hs + 20:hs + 24], "big"), int.from_bytes(buf[hs + 24:hs + 32], "big")
            elif he - hs >= 20:
                ts_, dur = int.from_bytes(buf[hs + 12:hs + 16], "big"), int.from_bytes(buf[hs + 16:hs + 20], "big")
            else:
                continue
            if ts_ and 0 < dur / ts_ < 36000:
                duration = round(dur / ts_, 2)
    except (ValueError, IndexError):
        raise HTTPException(status_code=415, detail="This video file looks damaged or incomplete.")
    return kind[0], kind[1], duration


# ── Shapes ──────────────────────────────────────────────────────────────────────────────────────
def _public(d: dict) -> dict:
    return {"id": d["_id"], "title": d.get("title", ""), "description": d.get("description", ""),
            "content_type": d.get("content_type", ""), "size": d.get("size", 0),
            "duration_s": d.get("duration_s"), "visibility": d.get("visibility", "PRIVATE")}


def _admin(d: dict) -> dict:
    return {**_public(d), "status": d.get("status", "DRAFT"), "object_key": d.get("object_key", ""),
            "source": d.get("source", "uploaded"), "state": d.get("state", "ready"),
            "created_at": _iso(d.get("created_at")), "updated_at": _iso(d.get("updated_at")),
            "created_by": (d.get("created_by") or {}).get("name", "")}


def _clean_text(v: str, field: str, lo: int, hi: int) -> str:
    v = re.sub(r"\s+", " ", str(v or "")).strip()
    if not lo <= len(v) <= hi:
        raise HTTPException(status_code=422, detail=f"{field} must be {lo}–{hi} characters.")
    return v


# ── Viewer routes ───────────────────────────────────────────────────────────────────────────────
@router.get("/published")
async def published(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    viewer = _viewer(x_pulse_user)
    q = {"active": True, "state": "ready", "status": "PUBLISHED"}
    if not viewer:
        q["visibility"] = "PUBLIC"
    rows = await coll.find(q).sort("created_at", -1).to_list(200)
    return {"videos": [_public(d) for d in rows]}


@router.get("/{vid}/playback")
async def playback(vid: str, x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    viewer = _viewer(x_pulse_user)
    if not ID_RE.match(vid):
        raise HTTPException(status_code=404, detail="Video not found.")
    d = await coll.find_one({"_id": vid, "active": True, "state": "ready"})
    is_admin = bool(viewer) and str(viewer.get("role") or "") == "admin"
    if not d or (d.get("status") != "PUBLISHED" and not is_admin):
        raise HTTPException(status_code=404, detail="Video not found.")
    if d.get("visibility") != "PUBLIC" and not viewer:
        raise HTTPException(status_code=401, detail="Sign in to watch this video.")
    try:
        await _r2(r2.head, d["object_key"])
        base = r2.public_base_url()
        if base and d.get("visibility") == "PUBLIC" and d.get("status") == "PUBLISHED":
            return {"url": f"{base}/{quote(d['object_key'])}", "expires_in": None,
                    "content_type": d.get("content_type", "")}
        url = await _r2(r2.presign_get, d["object_key"], PLAYBACK_TTL_S)
    except r2.R2Error as e:
        if e.code == "not_found":
            return JSONResponse({"detail": "This video is unavailable right now.", "code": "not_found"}, status_code=404)
        return _storage_error(e)
    return {"url": url, "expires_in": PLAYBACK_TTL_S,
            "expires_at": (_now() + timedelta(seconds=PLAYBACK_TTL_S)).isoformat(),
            "content_type": d.get("content_type", "")}


# ── Admin routes ────────────────────────────────────────────────────────────────────────────────
@router.get("/admin/overview")
async def admin_overview(x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    await _ensure_indexes()
    missing = r2.missing_settings()
    lib = await coll.find({"active": True}).sort("created_at", -1).to_list(500)
    out = {
        "settings": {"configured": not missing, "missing": missing, "bucket": r2.bucket() or None,
                     "public_domain": bool(r2.public_base_url()), "max_bytes": MAX_UPLOAD_BYTES,
                     "prefix": r2.PREFIX, "playback_ttl_s": PLAYBACK_TTL_S},
        "connection": {"ok": False, "code": "not_configured" if missing else None, "message": None},
        "videos": [_admin(d) for d in lib],
        "bucket": {"objects": [], "truncated": False},
    }
    if missing:
        out["connection"]["message"] = "Video storage is not configured yet."
        return out
    try:
        await _r2(r2.check)
        objects, truncated = await _r2(r2.list_objects, 1000)
    except r2.R2Error as e:
        out["connection"].update(code=e.code, message=e.message)
        return out
    by_key = {d.get("object_key"): d["_id"] for d in lib}
    out["connection"] = {"ok": True, "code": None, "message": None}
    out["bucket"] = {"truncated": truncated, "objects": [
        {**o, "in_library": o["key"] in by_key, "library_id": by_key.get(o["key"]),
         "managed": o["key"].startswith(r2.PREFIX)} for o in objects]}
    return out


@router.post("/admin/videos")
async def admin_upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    x_pulse_secret: Optional[str] = Header(None),
    x_pulse_user: Optional[str] = Header(None),
):
    admin = _require_admin(x_pulse_secret, x_pulse_user)
    await _ensure_indexes()
    title = _clean_text(title, "Title", 3, 120)
    description = _clean_text(description, "Description", 0, 600)
    if r2.missing_settings():
        return _storage_error(r2.R2Error("not_configured", "Video storage is not configured yet.", 503))
    uid = str(admin.get("user_id") or "")
    recent = await coll.count_documents({"created_by.user_id": uid, "created_at": {"$gte": _now() - timedelta(hours=1)}})
    if recent >= UPLOADS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Upload limit reached — please try again in an hour.")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Videos can be at most 10 MB.")
    content_type, ext, duration = inspect_video(data)
    sha = hashlib.sha256(data).hexdigest()

    # Same file already uploading/in the library → point to it. A stale unfinished upload is released.
    await coll.update_many({"sha256": sha, "active": True, "state": "uploading", "created_at": {"$lt": _now() - STALE_UPLOAD}},
                           {"$set": {"active": False, "state": "failed", "updated_at": _now()}})
    vid = f"iv_{uuid.uuid4().hex[:16]}"
    run = test_tag.current()
    key = f"{r2.PREFIX}{'_test/' if run else ''}{vid}.{ext}"
    doc = {"_id": vid, "title": title, "description": description, "object_key": key,
           "content_type": content_type, "size": len(data), "duration_s": duration, "sha256": sha,
           "source": "uploaded", "visibility": "PRIVATE", "status": "DRAFT", "active": True,
           "state": "uploading", "created_at": _now(), "updated_at": _now(),
           "created_by": {"user_id": uid, "name": str(admin.get("name") or "")[:120]}}
    if run:
        doc["test_run"] = run
    try:
        await coll.insert_one(doc)
    except DuplicateKeyError:
        dup = await coll.find_one({"sha256": sha, "active": True})
        return JSONResponse({"detail": f"This video is already in the library as “{(dup or {}).get('title', 'another video')}”.",
                             "code": "duplicate", "existing_id": (dup or {}).get("_id")}, status_code=409)
    try:
        await _r2(r2.put, key, data, content_type, {"library-id": vid, "sha256": sha})
        meta = await _r2(r2.head, key)
    except r2.R2Error as e:
        await coll.update_one({"_id": vid}, {"$set": {"active": False, "state": "failed", "updated_at": _now()}})
        return _storage_error(e)
    if meta["size"] != len(data):
        await coll.update_one({"_id": vid}, {"$set": {"active": False, "state": "failed", "updated_at": _now()}})
        return JSONResponse({"detail": "The upload could not be confirmed — please try again.", "code": "mismatch"}, status_code=502)
    d = await coll.find_one_and_update({"_id": vid}, {"$set": {"state": "ready", "etag": meta["etag"], "updated_at": _now()}},
                                       return_document=ReturnDocument.AFTER)
    log.info("intro video uploaded id=%s size=%s by=%s", vid, len(data), uid)
    return {"ok": True, "video": _admin(d)}


class LinkIn(BaseModel):
    key: str = Field(..., max_length=512)
    title: str = Field(..., max_length=200)
    description: str = Field("", max_length=1000)


@router.post("/admin/videos/link")
async def admin_link(payload: LinkIn, x_pulse_secret: Optional[str] = Header(None), x_pulse_user: Optional[str] = Header(None)):
    """Add a file that is already in the bucket to the library. The file itself is never changed."""
    admin = _require_admin(x_pulse_secret, x_pulse_user)
    await _ensure_indexes()
    key = payload.key.strip()
    if not LINK_KEY_RE.match(key) or ".." in key or "//" in key or key.endswith("/"):
        raise HTTPException(status_code=422, detail="That file name can't be added.")
    title = _clean_text(payload.title, "Title", 3, 120)
    description = _clean_text(payload.description, "Description", 0, 600)
    if await coll.find_one({"object_key": key, "active": True}):
        raise HTTPException(status_code=409, detail="That file is already in the library.")
    try:
        meta = await _r2(r2.head, key)
        start = await _r2(r2.read_start, key, 65536)
    except r2.R2Error as e:
        return _storage_error(e)
    kind = _brand_type(start)
    if not kind:
        raise HTTPException(status_code=415, detail="That file is not an MP4, MOV or WebM video.")
    vid = f"iv_{uuid.uuid4().hex[:16]}"
    doc = {"_id": vid, "title": title, "description": description, "object_key": key,
           "content_type": kind[0], "size": meta["size"], "duration_s": None, "source": "linked",
           "visibility": "PRIVATE", "status": "DRAFT", "active": True, "state": "ready", "etag": meta["etag"],
           "created_at": _now(), "updated_at": _now(),
           "created_by": {"user_id": str(admin.get("user_id") or ""), "name": str(admin.get("name") or "")[:120]}}
    if test_tag.current():
        doc["test_run"] = test_tag.current()
    try:
        await coll.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="That file is already in the library.")
    return {"ok": True, "video": _admin(doc)}


class PatchIn(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[str] = None
    status: Optional[str] = None


@router.patch("/admin/videos/{vid}")
async def admin_update(vid: str, payload: PatchIn, x_pulse_secret: Optional[str] = Header(None),
                       x_pulse_user: Optional[str] = Header(None)):
    _require_admin(x_pulse_secret, x_pulse_user)
    if not ID_RE.match(vid):
        raise HTTPException(status_code=404, detail="Video not found.")
    upd: dict = {}
    if payload.title is not None:
        upd["title"] = _clean_text(payload.title, "Title", 3, 120)
    if payload.description is not None:
        upd["description"] = _clean_text(payload.description, "Description", 0, 600)
    if payload.visibility is not None:
        if payload.visibility not in VISIBILITY:
            raise HTTPException(status_code=422, detail="Visibility must be PRIVATE or PUBLIC.")
        upd["visibility"] = payload.visibility
    if payload.status is not None:
        if payload.status not in STATUS:
            raise HTTPException(status_code=422, detail="Status must be DRAFT or PUBLISHED.")
        upd["status"] = payload.status
    if not upd:
        raise HTTPException(status_code=422, detail="Nothing to change.")
    upd["updated_at"] = _now()
    d = await coll.find_one_and_update({"_id": vid, "active": True, "state": "ready"}, {"$set": upd},
                                       return_document=ReturnDocument.AFTER)
    if not d:
        raise HTTPException(status_code=404, detail="Video not found.")
    return {"ok": True, "video": _admin(d)}


class DeleteIn(BaseModel):
    confirm: str = Field("", max_length=20)


@router.post("/admin/videos/{vid}/delete")
async def admin_delete(vid: str, payload: DeleteIn, x_pulse_secret: Optional[str] = Header(None),
                       x_pulse_user: Optional[str] = Header(None)):
    """Uploaded through NOSTOPS → the R2 file is deleted. Already in the bucket → only leaves the library."""
    admin = _require_admin(x_pulse_secret, x_pulse_user)
    if payload.confirm.strip().upper() != "DELETE":
        raise HTTPException(status_code=422, detail="Type DELETE to confirm.")
    if not ID_RE.match(vid):
        raise HTTPException(status_code=404, detail="Video not found.")
    d = await coll.find_one({"_id": vid, "active": True})
    if not d:
        raise HTTPException(status_code=404, detail="Video not found.")
    owned = d.get("source") == "uploaded" and str(d.get("object_key", "")).startswith(r2.PREFIX)
    if owned and d.get("state") == "ready":
        try:
            await _r2(r2.delete, d["object_key"])
        except r2.R2Error as e:
            return _storage_error(e)
    await coll.update_one({"_id": vid}, {"$set": {
        "active": False, "updated_at": _now(), "deleted_at": _now(),
        "deleted_by": {"user_id": str(admin.get("user_id") or ""), "name": str(admin.get("name") or "")[:120]},
        "object_deleted": owned}})
    log.info("intro video removed id=%s object_deleted=%s", vid, owned)
    return {"ok": True, "object_deleted": owned}
