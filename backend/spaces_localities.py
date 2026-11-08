"""Phase 2 — NOSTOPS Spaces: India-only PIN code + locality reference data and validation service.

Applies ONLY to NOSTOPS Spaces (and later Community Partners). Global Venues (`venue_submissions`, Studio
centres) never call this module, so international venues are unaffected.

  * Dataset: `data/in_pincodes.csv.gz`, built from the India Post all-India PIN directory (data.gov.in) by
    `scripts/build_in_pincodes.py`. One PIN maps to MANY localities (post offices).
  * Collection `in_pincodes`: one document per locality, `_id` = locality_id (`<pin>-<slug>`), indexed on `pin`.
    Loaded at startup in the background; reloaded only when DATASET_VERSION changes (idempotent).
  * `validate_india_location()` is the single server-side check later Spaces writes must call: it rejects
    non-Indian countries, bad PIN formats, unknown PINs and localities that don't belong to the PIN, and returns
    the normalised location with `country = "IN"` set server-side.
"""
import asyncio
import csv
import gzip
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from pymongo import ASCENDING, ReplaceOne

from venues import _check_secret, _now_iso, db

router = APIRouter(prefix="/api/spaces/localities", tags=["spaces-localities"])

DATASET_FILE = Path(__file__).resolve().parent / "data" / "in_pincodes.csv.gz"
DATASET_VERSION = "india-post-2026.06-v2"
DATASET_SOURCE = "India Post all-India PIN code directory (data.gov.in, Open Government Data Licence – India)"
PIN_RE = re.compile(r"^[1-9][0-9]{5}$")
INDIA = {"in", "ind", "india", "bharat"}
INDIA_ONLY = "NOSTOPS Spaces is available in India only (6-digit PIN code required)."

_state = {"ready": False, "error": ""}


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "po"


def locality_id(pin: str, locality: str) -> str:
    return f"{pin}-{_slug(locality)}"


def _locality_public(d: dict) -> dict:
    return {"id": d["_id"], "pin": d["pin"], "name": d["locality"], "office_name": d.get("office_name", ""),
            "office_type": d.get("office_type", ""), "delivery": bool(d.get("delivery")), "taluk": d.get("taluk", ""),
            "district": d.get("district", ""), "state": d.get("state", ""), "country": "IN"}


def _read_dataset() -> list[dict]:
    with gzip.open(DATASET_FILE, "rt", newline="", encoding="utf-8") as f:
        return [{"_id": locality_id(r["pin"], r["locality"]), "pin": r["pin"], "locality": r["locality"],
                 "locality_lc": r["locality"].lower(), "office_name": r["office_name"], "office_type": r["office_type"],
                 "delivery": r["delivery"] == "1", "taluk": r["taluk"], "district": r["district"], "state": r["state"],
                 "dataset_version": DATASET_VERSION}
                for r in csv.DictReader(f)]


async def ensure_dataset() -> None:
    """Idempotent loader. Skips work when the stored version already matches."""
    try:
        meta = await db.in_pincodes_meta.find_one({"_id": "dataset"})
        if not (meta and meta.get("version") == DATASET_VERSION and meta.get("complete")):
            rows = await asyncio.to_thread(_read_dataset)
            for i in range(0, len(rows), 5000):
                await db.in_pincodes.bulk_write([ReplaceOne({"_id": r["_id"]}, r, upsert=True) for r in rows[i:i + 5000]],
                                                ordered=False)
            # Rows from an older dataset version are never deleted; every read filters on the current version.
            await db.in_pincodes.create_index([("pin", ASCENDING), ("dataset_version", ASCENDING)])
            await db.in_pincodes.create_index([("state", ASCENDING), ("district", ASCENDING)])
            await db.in_pincodes_meta.replace_one({"_id": "dataset"}, {
                "_id": "dataset", "version": DATASET_VERSION, "source": DATASET_SOURCE, "complete": True,
                "localities": len(rows), "pins": len({r["pin"] for r in rows}),
                "states": len({r["state"] for r in rows}), "loaded_at": _now_iso()}, upsert=True)
        _state.update(ready=True, error="")
    except Exception as exc:  # noqa: BLE001 — never blocks the API; lookups answer 503 until loaded
        _state["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
        print("in_pincodes load failed, retrying in 60 s:", _state["error"])
        await asyncio.sleep(60)
        asyncio.create_task(ensure_dataset())


def _require_ready() -> None:
    if not _state["ready"]:
        raise HTTPException(status_code=503, detail={"error": "dataset_loading",
                                                     "message": "Locality data is loading. Please try again in a minute."})


def _check_pin_format(pin: str) -> str:
    pin = re.sub(r"\s+", "", pin or "")
    if not PIN_RE.match(pin):
        raise HTTPException(status_code=422, detail={"error": "invalid_pin",
                                                     "message": "Enter a valid 6-digit Indian PIN code. " + INDIA_ONLY})
    return pin


async def lookup_pin(pin: str) -> dict:
    pin = _check_pin_format(pin)
    _require_ready()
    docs = await db.in_pincodes.find({"pin": pin, "dataset_version": DATASET_VERSION}).sort([("office_type", ASCENDING), ("locality", ASCENDING)]).to_list(500)
    if not docs:
        raise HTTPException(status_code=404, detail={"error": "unknown_pin",
                                                     "message": "We couldn't find this PIN code. Please check it and try again."})
    localities = sorted((_locality_public(d) for d in docs), key=lambda x: x["name"].lower())
    counts: dict[tuple, int] = {}
    for loc in localities:
        counts[(loc["district"], loc["state"])] = counts.get((loc["district"], loc["state"]), 0) + 1
    district, state = max(counts, key=counts.get)
    return {"ok": True, "pin": pin, "country": "IN", "district": district, "state": state,
            "districts": sorted({d for d, _ in counts}), "localities": localities}


async def validate_india_location(pin: str, locality_id_: str, country: Optional[str] = None) -> dict:
    """Server-side gate for every Spaces / Community Partner write. Returns the normalised location."""
    if country is not None and str(country).strip() and str(country).strip().lower() not in INDIA:
        raise HTTPException(status_code=422, detail={"error": "india_only", "message": INDIA_ONLY})
    pin = _check_pin_format(pin)
    _require_ready()
    doc = await db.in_pincodes.find_one({"_id": str(locality_id_ or ""), "dataset_version": DATASET_VERSION})
    if not doc or doc["pin"] != pin:
        if not await db.in_pincodes.find_one({"pin": pin, "dataset_version": DATASET_VERSION}, {"_id": 1}):
            raise HTTPException(status_code=404, detail={"error": "unknown_pin",
                                                         "message": "We couldn't find this PIN code. Please check it and try again."})
        raise HTTPException(status_code=422, detail={"error": "locality_mismatch",
                                                     "message": "Choose a locality that belongs to this PIN code."})
    loc = _locality_public(doc)
    return {"ok": True, "pin": pin, "locality_id": loc["id"], "locality": loc["name"], "taluk": loc["taluk"],
            "district": loc["district"], "state": loc["state"], "country": "IN"}


class ValidateIn(BaseModel):
    pin: str = Field(max_length=12)
    locality_id: str = Field(max_length=80)
    country: Optional[str] = Field(default=None, max_length=60)


@router.get("/meta")
async def meta(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    m = await db.in_pincodes_meta.find_one({"_id": "dataset"}) or {}
    m.pop("_id", None)
    return {"ok": True, "ready": _state["ready"], "error": _state["error"], **m}


@router.get("/pin/{pin}")
async def pin_lookup(pin: str, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    return await lookup_pin(pin)


_name_indexed = False


async def _ensure_name_index() -> None:
    """Additive, idempotent index for locality-name prefix search (created once per process)."""
    global _name_indexed
    if not _name_indexed:
        await db.in_pincodes.create_index([("locality_lc", ASCENDING)], name="locality_lc_1")
        _name_indexed = True


@router.get("/name-search")
async def name_search(q: str, x_pulse_secret: Optional[str] = Header(None)):
    """Public: official India Post localities whose name STARTS WITH q (case-insensitive, min 3 letters).
    Exact official names only — no fuzzy or approximate matching. Returns reference fields only."""
    _check_secret(x_pulse_secret)
    _require_ready()
    q = (q or "").strip().lower()[:60]
    if len(q) < 3 or not re.fullmatch(r"[a-z0-9 .()&'/-]+", q):
        raise HTTPException(status_code=422, detail={"error": "bad_query", "message": "Type at least 3 letters of a locality name."})
    await _ensure_name_index()
    rows = await db.in_pincodes.find({"locality_lc": {"$regex": "^" + re.escape(q)}, "dataset_version": DATASET_VERSION},
                                     {"pin": 1, "locality": 1, "district": 1, "state": 1, "taluk": 1}
                                     ).sort([("locality_lc", ASCENDING), ("pin", ASCENDING)]).limit(31).to_list(31)
    return {"ok": True, "query": q, "truncated": len(rows) > 30,
            "localities": [{"id": r["_id"], "name": r["locality"], "pin": r["pin"], "district": r.get("district"),
                            "state": r.get("state"), "taluk": r.get("taluk")} for r in rows[:30]]}


@router.get("/id/{lid}")
async def locality_get(lid: str, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    _require_ready()
    doc = await db.in_pincodes.find_one({"_id": lid[:80], "dataset_version": DATASET_VERSION})
    if not doc:
        raise HTTPException(status_code=404, detail={"error": "unknown_locality", "message": "Locality not found."})
    return {"ok": True, "locality": _locality_public(doc)}


@router.post("/validate")
async def validate(body: ValidateIn, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    return await validate_india_location(body.pin, body.locality_id, body.country)
