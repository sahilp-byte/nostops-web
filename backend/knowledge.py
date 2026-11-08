"""
NOSTOPS Yogic Paramparā Knowledge Graph — normalized data layer
(local FastAPI router + local Mongo `nostops_web`).

This is an ISOLATED, ADDITIVE feature module. It does NOT touch the remote
business backend and it does NOT modify any existing collection. Every
collection it owns is namespaced `kg_*`, so it is fully backward compatible with
the existing pulse_* / audit_ledger data and reversible (drop kg_* only).

Design principles (see /app/KNOWLEDGE_GRAPH_ARCHITECTURE.md):
  • Normalized entities with FOREIGN-KEY references (ids), never duplicated text.
  • Every node carries an explicit `classification` — a modern methodology is
    NEVER represented as an ancient Paramparā.
  • A teacher's self-declared affiliation is NEVER auto-promoted to a verified
    lineage. Verification is an explicit, evidence-backed admin action.
  • Read endpoints (GET) are open, non-PII, and NOT linked from any public UI
    yet (the data must not be publicly indexed until reviewed). Write endpoints
    require the internal shared secret + admin role (same model as Teacher Pulse).

The remote backend stays 100% untouched.
"""
import base64
import hmac
import json
import os
import time
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
# Reuse the existing internal shared-secret used by Pulse/Audit so no new env
# var / deployment secret is required. Writes are internal-only regardless.
SECRET = os.environ.get("PULSE_SHARED_SECRET", "")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/api/knowledge", tags=["knowledge-graph"])

# ── Controlled vocabularies ──────────────────────────────────────────────────
# Historically honest classifications — the SINGLE most important guardrail.
CLASSIFICATIONS = [
    "Source Tradition",            # civilizational root (Vedic, Śramaṇa, Tantric)
    "Darśana",                     # philosophical school (Sāṃkhya, Yoga, Vedānta …)
    "Sampradāya",                  # initiatory religious order
    "Historical Paramparā",        # documented pre-modern lineage / classical yoga path
    "Yogic Practice Tradition",    # Haṭha / Nātha / Siddha practice streams
    "Modern Teacher Lineage",      # 19th–21st c. guru-student lineages
    "Modern Methodology",          # branded modern method / technique
    "Modern Institution",          # organisation / trust / foundation
    "Related Contemplative Tradition",  # adjacent (Jain, Buddhist, Sant, etc.)
]

# Node-level verification (curatorial confidence in the record itself).
NODE_VERIFICATION = [
    "Verified",
    "Partially Verified",
    "Historically Documented",
    "Requires Scholarly Verification",
    "Unverified",
]

# Teacher↔Paramparā affiliation states (a self-declaration is never a lineage).
AFFILIATION_STATES = [
    "Verified",
    "Teacher-declared",
    "Institutionally verified",
    "Historically documented",
    "Methodological association",
    "Influenced by",
    "Unverified",
]
# States that assert an authoritative, evidence-backed affiliation. Reaching one
# of these ALWAYS requires an explicit admin verify action carrying evidence.
AFFILIATION_VERIFIED_STATES = {"Verified", "Institutionally verified", "Historically documented"}

CONFIDENCE_LEVELS = ["High", "Medium", "Low", "Uncertain"]

# Full moderation lifecycle statuses (governance layer).
RECORD_STATUSES = [
    "DRAFT", "UNDER_REVIEW", "VERIFIED", "TEACHER_DECLARED", "INSTITUTIONALLY_VERIFIED",
    "HISTORICALLY_DOCUMENTED", "REQUIRES_SCHOLARLY_VERIFICATION", "REJECTED", "ARCHIVED",
]

LINEAGE_RELATIONSHIP_TYPES = [
    "guru-disciple",
    "initiated-by",
    "principal-teacher",
    "influenced-by",
    "commentator",
    "successor",
    "traditional-attribution",
]

# Every kg_* collection this module owns (used by the migration for reversibility).
COLLECTIONS = [
    "kg_paramparas",
    "kg_gurus",
    "kg_guru_lineage",
    "kg_scriptures",
    "kg_practices",
    "kg_methodologies",
    "kg_institutions",
    "kg_teacher_parampara",
    "kg_city_parampara",
    "kg_parampara_guru",
    "kg_parampara_scripture",
    "kg_parampara_practice",
    "kg_parampara_methodology",
    "kg_sources",
    "kg_migrations",
]


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


# ── Auth (writes only; identical model to Pulse/Audit) ───────────────────────
async def _internal(x_pulse_secret: Optional[str] = Header(None)) -> bool:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    return True


async def admin_user(
    _ok: bool = Depends(_internal),
    x_pulse_user: Optional[str] = Header(None),
) -> dict:
    try:
        data = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="bad user context")
    role = str(data.get("role") or "").lower()
    if role != "admin":
        raise HTTPException(status_code=403, detail="Administrators only.")
    return data


async def current_user(
    _ok: bool = Depends(_internal),
    x_pulse_user: Optional[str] = Header(None),
) -> dict:
    """Any authenticated user (identity set server-side by the BFF)."""
    try:
        data = json.loads(base64.b64decode(x_pulse_user or "").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="bad user context")
    data["role"] = str(data.get("role") or "").lower()
    return data


def _clean(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def _find(coll: str, flt: dict, limit: int = 500, sort=None):
    cur = db[coll].find(flt, {"_id": 0})
    if sort:
        cur = cur.sort(sort)
    return [d async for d in cur.limit(limit)]


async def _audit(actor: dict, action: str, entity: str, entity_id: str, before=None, after=None, notes: Optional[str] = None):
    """Append-only audit history for every governance mutation."""
    await db.kg_audit.insert_one({
        "id": new_id("aud"), "action": action, "entity": entity, "entity_id": entity_id,
        "actor": actor.get("user_id") or actor.get("email") or "system",
        "actor_name": actor.get("name"), "before": before, "after": after, "notes": notes,
        "at": now_ms(),
    })


async def _snapshot_revision(coll: str, doc: dict, actor: dict):
    """Preserve the prior state of a record so lineage changes stay auditable."""
    if not doc:
        return
    await db.kg_revisions.insert_one({
        "id": new_id("rev"), "collection": coll, "entity_id": doc.get("id"),
        "snapshot": {k: v for k, v in doc.items() if k != "_id"},
        "revised_by": actor.get("user_id") or actor.get("email"), "at": now_ms(),
    })


# ── Read models ──────────────────────────────────────────────────────────────
@router.get("/health")
async def health() -> dict:
    counts = {}
    for c in COLLECTIONS:
        if c == "kg_migrations":
            continue
        counts[c] = await db[c].count_documents({})
    applied = await _find("kg_migrations", {}, sort=[("version", 1)])
    return {"status": "healthy", "module": "knowledge-graph", "counts": counts, "migrations": applied}


@router.get("/classifications")
async def classifications() -> dict:
    return {
        "classifications": CLASSIFICATIONS,
        "node_verification": NODE_VERIFICATION,
        "affiliation_states": AFFILIATION_STATES,
        "confidence_levels": CONFIDENCE_LEVELS,
        "lineage_relationship_types": LINEAGE_RELATIONSHIP_TYPES,
    }


@router.get("/paramparas")
async def list_paramparas(
    classification: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    parent: Optional[str] = Query(None),
    darshana: Optional[str] = Query(None),
    sampradaya: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(500, le=1000),
) -> dict:
    flt: dict = {"archived": {"$ne": True}}
    if classification:
        flt["classification"] = classification
    if verification_status:
        flt["verification_status"] = verification_status
    if parent:
        flt["parent_id"] = parent
    if darshana:
        flt["darshana_id"] = darshana
    if sampradaya:
        flt["sampradaya_id"] = sampradaya
    if q:
        flt["$or"] = [
            {"canonical_name": {"$regex": q, "$options": "i"}},
            {"display_name": {"$regex": q, "$options": "i"}},
            {"slug": {"$regex": q, "$options": "i"}},
        ]
    items = await _find("kg_paramparas", flt, limit=limit, sort=[("classification", 1), ("display_name", 1)])
    return {"count": len(items), "paramparas": items}


async def _summaries(coll: str, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    rows = await _find(coll, {"id": {"$in": ids}})
    by = {r["id"]: r for r in rows}
    out = []
    for i in ids:
        r = by.get(i)
        if r:
            out.append({k: r.get(k) for k in ("id", "slug", "canonical_name", "display_name", "name", "classification", "verification_status") if k in r})
    return out


@router.get("/paramparas/{slug}")
async def get_parampara(slug: str) -> dict:
    node = _clean(await db.kg_paramparas.find_one({"slug": slug}))
    if not node:
        raise HTTPException(status_code=404, detail="parampara not found")
    if node.get("archived"):
        raise HTTPException(status_code=404, detail="parampara archived")
    pid = node["id"]

    guru_edges = await _find("kg_parampara_guru", {"parampara_id": pid})
    scr_edges = await _find("kg_parampara_scripture", {"parampara_id": pid})
    prac_edges = await _find("kg_parampara_practice", {"parampara_id": pid})
    meth_edges = await _find("kg_parampara_methodology", {"parampara_id": pid})

    gurus = await _summaries("kg_gurus", [e["guru_id"] for e in guru_edges])
    scriptures = await _summaries("kg_scriptures", [e["scripture_id"] for e in scr_edges])
    practices = await _summaries("kg_practices", [e["practice_id"] for e in prac_edges])
    methodologies = await _summaries("kg_methodologies", [e["methodology_id"] for e in meth_edges])

    related_ids = [x for x in [node.get("parent_id"), node.get("sampradaya_id"), node.get("darshana_id"), node.get("civilizational_root_id")] if x]
    related = await _summaries("kg_paramparas", related_ids)
    related_map = {r["id"]: r for r in related}

    src_ids = node.get("source_ids") or []
    sources = await _find("kg_sources", {"id": {"$in": src_ids}}) if src_ids else []

    institutions = await _find("kg_institutions", {"associated_parampara_id": pid})

    return {
        "parampara": node,
        "parent": related_map.get(node.get("parent_id")),
        "sampradaya": related_map.get(node.get("sampradaya_id")),
        "darshana": related_map.get(node.get("darshana_id")),
        "civilizational_root": related_map.get(node.get("civilizational_root_id")),
        "gurus": [{**g, **{k: e.get(k) for k in ("role", "confidence_level", "verification_status")}} for g, e in _zip_edges(gurus, guru_edges, "guru_id")],
        "scriptures": scriptures,
        "practices": practices,
        "methodologies": methodologies,
        "institutions": [_clean_ref(i) for i in institutions],
        "sources": sources,
    }


def _zip_edges(summaries: list[dict], edges: list[dict], key: str):
    by = {e[key]: e for e in edges}
    for s in summaries:
        yield s, by.get(s["id"], {})


def _clean_ref(d: dict) -> dict:
    return {k: d.get(k) for k in ("id", "slug", "name", "location", "website", "verification_status") if k in d}


@router.get("/gurus")
async def list_gurus(q: Optional[str] = Query(None), limit: int = Query(500, le=1000)) -> dict:
    flt: dict = {}
    if q:
        flt["$or"] = [
            {"canonical_name": {"$regex": q, "$options": "i"}},
            {"alternate_names": {"$regex": q, "$options": "i"}},
        ]
    items = await _find("kg_gurus", flt, limit=limit, sort=[("canonical_name", 1)])
    return {"count": len(items), "gurus": items}


@router.get("/gurus/{slug}")
async def get_guru(slug: str) -> dict:
    guru = _clean(await db.kg_gurus.find_one({"slug": slug}))
    if not guru:
        raise HTTPException(status_code=404, detail="guru not found")
    gid = guru["id"]
    teachers_of = await _find("kg_guru_lineage", {"teacher_guru_id": gid})   # this guru taught…
    learned_from = await _find("kg_guru_lineage", {"guru_id": gid})          # …learned from
    disciple_ids = [e["guru_id"] for e in teachers_of]
    teacher_ids = [e["teacher_guru_id"] for e in learned_from]
    paramparas = await _find("kg_parampara_guru", {"guru_id": gid})
    src_ids = guru.get("source_ids") or []
    sources = await _find("kg_sources", {"id": {"$in": src_ids}}) if src_ids else []
    return {
        "guru": guru,
        "disciples": await _summaries("kg_gurus", disciple_ids),
        "teachers": await _summaries("kg_gurus", teacher_ids),
        "lineage_edges": teachers_of + learned_from,
        "paramparas": await _summaries("kg_paramparas", [e["parampara_id"] for e in paramparas]),
        "sources": sources,
    }


@router.get("/scriptures")
async def list_scriptures(limit: int = Query(500, le=1000)) -> dict:
    items = await _find("kg_scriptures", {}, limit=limit, sort=[("canonical_name", 1)])
    return {"count": len(items), "scriptures": items}


@router.get("/scriptures/{slug}")
async def get_scripture(slug: str) -> dict:
    """Scripture (Śāstra) detail: the text record + every Paramparā that holds it
    as a key text, resolved sources. Read-only, non-PII."""
    scr = _clean(await db.kg_scriptures.find_one({"slug": slug}))
    if not scr:
        raise HTTPException(status_code=404, detail="scripture not found")
    sid = scr["id"]
    edges = await _find("kg_parampara_scripture", {"scripture_id": sid})
    paramparas = await _summaries("kg_paramparas", [e["parampara_id"] for e in edges])
    src_ids = scr.get("source_ids") or []
    sources = await _find("kg_sources", {"id": {"$in": src_ids}}) if src_ids else []
    return {"scripture": scr, "paramparas": paramparas, "sources": sources}


@router.get("/practices")
async def list_practices(limit: int = Query(500, le=1000)) -> dict:
    items = await _find("kg_practices", {}, limit=limit, sort=[("name", 1)])
    return {"count": len(items), "practices": items}


@router.get("/methodologies")
async def list_methodologies(limit: int = Query(500, le=1000)) -> dict:
    items = await _find("kg_methodologies", {}, limit=limit, sort=[("name", 1)])
    return {"count": len(items), "methodologies": items}


@router.get("/institutions")
async def list_institutions(limit: int = Query(500, le=1000)) -> dict:
    items = await _find("kg_institutions", {}, limit=limit, sort=[("name", 1)])
    return {"count": len(items), "institutions": items}


@router.get("/lineages")
async def list_lineages(limit: int = Query(1000, le=2000)) -> dict:
    items = await _find("kg_guru_lineage", {}, limit=limit)
    return {"count": len(items), "lineages": items}


@router.get("/cities/{city_id}/paramparas")
async def city_paramparas(city_id: str) -> dict:
    edges = await _find("kg_city_parampara", {"city_id": city_id})
    summaries = await _summaries("kg_paramparas", [e["parampara_id"] for e in edges])
    by = {s["id"]: s for s in summaries}
    out = [{**by.get(e["parampara_id"], {"id": e["parampara_id"]}), "teacher_count": e.get("teacher_count", 0), "availability_status": e.get("availability_status")} for e in edges]
    return {"city_id": city_id, "count": len(out), "paramparas": out}


@router.get("/teachers/{teacher_id}/paramparas")
async def teacher_paramparas(teacher_id: str) -> dict:
    edges = await _find("kg_teacher_parampara", {"teacher_id": teacher_id})
    summaries = await _summaries("kg_paramparas", [e["parampara_id"] for e in edges])
    by = {s["id"]: s for s in summaries}
    out = []
    for e in edges:
        out.append({
            "parampara": by.get(e["parampara_id"], {"id": e["parampara_id"]}),
            "relationship_type": e.get("relationship_type"),
            "verification_status": e.get("verification_status"),
            "guru_id": e.get("guru_id"),
            "training_institution": e.get("training_institution"),
            "years_of_training": e.get("years_of_training"),
            "certification": e.get("certification"),
            "evidence_document": e.get("evidence_document"),
        })
    return {"teacher_id": teacher_id, "count": len(out), "affiliations": out}


@router.get("/paramparas/{slug}/teachers")
async def parampara_teachers(slug: str) -> dict:
    """Paramparā → Teachers (with declared/verified affiliation state + city)."""
    node = await db.kg_paramparas.find_one({"slug": slug}, {"id": 1})
    if not node:
        raise HTTPException(status_code=404, detail="parampara not found")
    edges = await _find("kg_teacher_parampara", {"parampara_id": node["id"]})
    return {"parampara_slug": slug, "count": len(edges), "teachers": [
        {k: e.get(k) for k in ("teacher_id", "relationship_type", "verification_status", "city_id", "guru_id", "training_institution", "years_of_training", "certification")}
        for e in edges
    ]}


@router.get("/paramparas/{slug}/cities")
async def parampara_cities(slug: str) -> dict:
    """Paramparā → Cities where NOSTOPS teachers are available."""
    node = await db.kg_paramparas.find_one({"slug": slug}, {"id": 1})
    if not node:
        raise HTTPException(status_code=404, detail="parampara not found")
    edges = await _find("kg_city_parampara", {"parampara_id": node["id"]})
    # also fold in distinct cities from teacher affiliations
    tp = await _find("kg_teacher_parampara", {"parampara_id": node["id"]})
    seen = {e["city_id"]: e for e in edges}
    for t in tp:
        c = t.get("city_id")
        if c and c not in seen:
            seen[c] = {"city_id": c, "teacher_count": 0, "availability_status": "available"}
    return {"parampara_slug": slug, "count": len(seen), "cities": list(seen.values())}


@router.get("/stats")
async def stats() -> dict:
    """Machine-readable data-quality snapshot (counts by classification +
    verification), used by the curatorial data-quality report."""
    paramparas = await _find("kg_paramparas", {}, limit=2000)
    by_class: dict = {}
    by_verif: dict = {}
    for p in paramparas:
        by_class[p.get("classification", "?")] = by_class.get(p.get("classification", "?"), 0) + 1
        by_verif[p.get("verification_status", "?")] = by_verif.get(p.get("verification_status", "?"), 0) + 1
    lineages = await _find("kg_guru_lineage", {}, limit=2000)
    ambiguous = [e for e in lineages if e.get("verification_status") == "Requires Scholarly Verification" or e.get("confidence_level") in ("Low", "Uncertain")]
    return {
        "paramparas_total": len(paramparas),
        "by_classification": by_class,
        "by_verification": by_verif,
        "gurus": await db.kg_gurus.count_documents({}),
        "scriptures": await db.kg_scriptures.count_documents({}),
        "practices": await db.kg_practices.count_documents({}),
        "methodologies": await db.kg_methodologies.count_documents({}),
        "institutions": await db.kg_institutions.count_documents({}),
        "guru_lineage_edges": len(lineages),
        "ambiguous_lineage_edges": len(ambiguous),
        "sources": await db.kg_sources.count_documents({}),
    }


# ── Admin writes (internal secret + admin role; evidence-gated verification) ──
DISCOVERY_DIMENSIONS = {
    "asana": {"label": "Āsana / movement", "practices": ["asana", "surya-namaskara"]},
    "pranayama": {"label": "Prāṇāyāma / breath", "practices": ["pranayama"]},
    "meditation": {"label": "Meditation", "practices": ["dhyana", "dharana", "samadhi"]},
    "mantra": {"label": "Mantra", "practices": ["mantra-japa"]},
    "bhakti": {"label": "Bhakti / devotion", "practices": ["kirtan"], "paramparas": ["bhakti-yoga"]},
    "self-inquiry": {"label": "Self-inquiry", "practices": ["self-enquiry"]},
    "philosophy": {"label": "Yoga philosophy", "classifications": ["Darśana"]},
    "hatha": {"label": "Traditional Haṭha Yoga", "paramparas": ["hatha-yoga", "hatha-pradipika-tradition", "gheranda-tradition", "natha-sampradaya", "gorakshanatha-tradition"]},
    "therapy": {"label": "Yoga therapy", "paramparas": ["viniyoga", "ag-mohan-lineage", "kaivalyadhama-lineage"]},
    "nada": {"label": "Nāda / sound", "practices": ["nada", "mantra-japa"]},
    "kriya": {"label": "Kriyā", "paramparas": ["kriya-yoga-yogananda", "kundalini-yoga-classical", "kundalini-yoga-3ho"]},
    "beginner": {"label": "Beginner-friendly practice", "paramparas": ["hatha-yoga", "sivananda-yoga", "the-yoga-institute-lineage", "art-of-living"]},
    "parampara": {"label": "A specific Paramparā", "classifications": ["Sampradāya", "Historical Paramparā"]},
    "lineage": {"label": "A teacher's lineage", "classifications": ["Modern Teacher Lineage"]},
    "location": {"label": "By location", "by_city": True},
}


@router.get("/discovery/dimensions")
async def discovery_dimensions() -> dict:
    return {"dimensions": [{"key": k, "label": v["label"]} for k, v in DISCOVERY_DIMENSIONS.items()]}


@router.get("/discovery")
async def discovery(dimension: str = Query(...)) -> dict:
    """Seeker discovery: given an interest DIMENSION, return matching traditions
    (with real teacher inventory), the relevant practices, and cities where
    teachers are available — all from actual graph relationships. Purely
    exploratory: it never prescribes a tradition."""
    spec = DISCOVERY_DIMENSIONS.get(dimension)
    if not spec:
        raise HTTPException(status_code=400, detail="unknown dimension")

    pids: set[str] = set(spec.get("paramparas", []))
    if spec.get("practices"):
        pr_ids = [f"pr-{s}" for s in spec["practices"]]
        for e in await _find("kg_parampara_practice", {"practice_id": {"$in": pr_ids}}, limit=2000):
            pids.add(e["parampara_id"])
    if spec.get("classifications"):
        for p in await _find("kg_paramparas", {"classification": {"$in": spec["classifications"]}}, limit=2000):
            pids.add(p["id"])
    if spec.get("by_city"):
        # location dimension: surface cities that actually have inventory
        cedges = await _find("kg_city_parampara", {}, limit=2000)
        by_city: dict = {}
        for e in cedges:
            by_city[e["city_id"]] = by_city.get(e["city_id"], 0) + (e.get("teacher_count") or 0)
        cities = sorted(({"city_id": c, "teacher_count": n} for c, n in by_city.items()), key=lambda x: -x["teacher_count"])
        return {"dimension": dimension, "label": spec["label"], "by_city": True, "cities": cities, "traditions": [], "practices": []}

    # teacher inventory per matched tradition (only surface traditions that have teachers)
    tp = await _find("kg_teacher_parampara", {"parampara_id": {"$in": list(pids)}}, limit=5000)
    counts: dict = {}
    city_counts: dict = {}
    for e in tp:
        counts[e["parampara_id"]] = counts.get(e["parampara_id"], 0) + 1
        c = e.get("city_id")
        if c:
            city_counts[c] = city_counts.get(c, 0) + 1
    nodes = await _find("kg_paramparas", {"id": {"$in": list(pids)}}, limit=2000)
    traditions = []
    for n in nodes:
        traditions.append({
            "id": n["id"], "slug": n["slug"], "display_name": n["display_name"],
            "classification": n["classification"], "description": n.get("description"),
            "verification_status": n["verification_status"], "teacher_count": counts.get(n["id"], 0),
        })
    traditions.sort(key=lambda t: (-t["teacher_count"], t["display_name"]))
    practices = []
    if spec.get("practices"):
        practices = await _find("kg_practices", {"id": {"$in": [f"pr-{s}" for s in spec["practices"]]}})
    cities = sorted(({"city_id": c, "teacher_count": n} for c, n in city_counts.items()), key=lambda x: -x["teacher_count"])[:12]
    return {"dimension": dimension, "label": spec["label"], "traditions": traditions, "practices": practices, "cities": cities}


@router.get("/indexable-slugs")
async def indexable_slugs() -> dict:
    """Authoritative list of Paramparā slugs eligible for indexing — computed with
    the SAME rule as the frontend `isIndexable`, so the sitemap can include ONLY
    genuinely indexable pages (never a noindex URL). Excludes archived records."""
    paramparas = await _find("kg_paramparas", {"archived": {"$ne": True}}, limit=2000)
    graph: dict = {}
    for coll, tgt in [("kg_parampara_guru", 1), ("kg_parampara_scripture", 1), ("kg_parampara_practice", 1), ("kg_parampara_methodology", 1)]:
        for e in await _find(coll, {}, limit=5000):
            graph[e["parampara_id"]] = graph.get(e["parampara_id"], 0) + 1
    teach: dict = {}
    for e in await _find("kg_teacher_parampara", {}, limit=5000):
        if e.get("verification_status") != "Rejected":
            teach[e["parampara_id"]] = teach.get(e["parampara_id"], 0) + 1
    out = []
    for p in paramparas:
        strong = p["verification_status"] in ("Verified", "Historically Documented")
        body = len(p.get("description") or "") + len(p.get("contemporary_description") or "")
        g = graph.get(p["id"], 0)
        t = teach.get(p["id"], 0)
        if (strong and body >= 160 and g >= 3) or (strong and body >= 90 and g >= 4) or (body >= 90 and t >= 3) or (strong and body >= 320):
            out.append(p["slug"])
    return {"count": len(out), "slugs": sorted(out)}


class TeacherAffiliationIn(BaseModel):
    teacher_id: str
    parampara_id: str
    relationship_type: str = "Teacher-declared"
    guru_id: Optional[str] = None
    guru_name: Optional[str] = None
    guru_guru_name: Optional[str] = None
    city_id: Optional[str] = None
    training_institution: Optional[str] = None
    years_of_training: Optional[int] = None
    certification: Optional[str] = None
    practices_taught: list[str] = Field(default_factory=list)
    practices_learned: list[str] = Field(default_factory=list)
    scriptures_studied: list[str] = Field(default_factory=list)
    evidence_document: Optional[str] = None
    notes: Optional[str] = None


@router.post("/teacher-parampara")
async def declare_teacher_affiliation(payload: TeacherAffiliationIn, _user: dict = Depends(current_user)) -> dict:
    """Record/declare a teacher's parampara affiliation. Callable by any
    authenticated user (the BFF sets teacher_id to the session teacher's own
    handle). A declaration is NEVER auto-verified — it always lands as an
    UNVERIFIED, teacher-declared claim (or a soft 'influenced-by' /
    'methodological association') and enters the admin review queue. Promotion
    to a verified state requires the evidence-gated admin /verify endpoint."""
    if not await db.kg_paramparas.find_one({"id": payload.parampara_id}):
        raise HTTPException(status_code=400, detail="unknown parampara_id")
    rel = payload.relationship_type if payload.relationship_type in AFFILIATION_STATES else "Teacher-declared"
    # Guardrail: an incoming declaration can never assert a verified state here.
    if rel in AFFILIATION_VERIFIED_STATES:
        rel = "Teacher-declared"
    doc = {
        "id": new_id("tp"),
        "teacher_id": payload.teacher_id,
        "parampara_id": payload.parampara_id,
        "relationship_type": rel,
        "guru_id": payload.guru_id,
        "guru_name": payload.guru_name,
        "guru_guru_name": payload.guru_guru_name,
        "city_id": payload.city_id,
        "training_institution": payload.training_institution,
        "years_of_training": payload.years_of_training,
        "certification": payload.certification,
        "practices_taught": payload.practices_taught,
        "practices_learned": payload.practices_learned,
        "scriptures_studied": payload.scriptures_studied,
        # A teacher-supplied document is retained for REVIEW; it never
        # auto-verifies the claim — an admin must act on it explicitly.
        "evidence_document": payload.evidence_document,
        "verification_status": "Unverified",
        "review_state": "pending_review",
        "verified_by": None,
        "verified_at": None,
        "notes": payload.notes,
        "created_at": now_ms(),
        "updated_at": now_ms(),
    }
    await db.kg_teacher_parampara.update_one(
        {"teacher_id": doc["teacher_id"], "parampara_id": doc["parampara_id"], "relationship_type": doc["relationship_type"]},
        {"$setOnInsert": {"id": doc["id"], "created_at": doc["created_at"]}, "$set": {k: doc[k] for k in doc if k not in ("id", "created_at")}},
        upsert=True,
    )
    saved = _clean(await db.kg_teacher_parampara.find_one({"teacher_id": doc["teacher_id"], "parampara_id": doc["parampara_id"], "relationship_type": doc["relationship_type"]}))
    return {"ok": True, "affiliation": saved}


class VerifyAffiliationIn(BaseModel):
    affiliation_id: str
    new_state: str            # must be one of AFFILIATION_VERIFIED_STATES
    evidence_document: str    # required — no evidence, no verification
    evidence_source_id: Optional[str] = None


@router.post("/admin/teacher-parampara/verify")
async def verify_teacher_affiliation(payload: VerifyAffiliationIn, admin: dict = Depends(admin_user)) -> dict:
    if payload.new_state not in AFFILIATION_VERIFIED_STATES:
        raise HTTPException(status_code=400, detail=f"new_state must be one of {sorted(AFFILIATION_VERIFIED_STATES)}")
    if not (payload.evidence_document or "").strip():
        raise HTTPException(status_code=400, detail="evidence_document is required to verify an affiliation")
    existing = await db.kg_teacher_parampara.find_one({"id": payload.affiliation_id})
    if not existing:
        raise HTTPException(status_code=404, detail="affiliation not found")
    await db.kg_teacher_parampara.update_one(
        {"id": payload.affiliation_id},
        {"$set": {
            "relationship_type": payload.new_state,
            "verification_status": payload.new_state,
            "review_state": "verified",
            "evidence_document": payload.evidence_document,
            "evidence_source_id": payload.evidence_source_id,
            "verified_by": admin.get("user_id") or admin.get("email"),
            "verified_at": now_ms(),
            "updated_at": now_ms(),
        }},
    )
    return {"ok": True, "affiliation": _clean(await db.kg_teacher_parampara.find_one({"id": payload.affiliation_id}))}


@router.get("/admin/review-queue")
async def review_queue(_admin: dict = Depends(admin_user)) -> dict:
    """Teacher-declared affiliations awaiting scholarly/admin review. Verification
    is ALWAYS a manual, evidence-backed decision — never automatic."""
    rows = await _find("kg_teacher_parampara", {"verification_status": "Unverified"}, sort=[("created_at", -1)])
    pids = list({r["parampara_id"] for r in rows})
    names = {p["id"]: p for p in await _find("kg_paramparas", {"id": {"$in": pids}})}
    for r in rows:
        p = names.get(r["parampara_id"], {})
        r["parampara_name"] = p.get("display_name")
        r["parampara_slug"] = p.get("slug")
    return {"count": len(rows), "pending": rows}


@router.post("/admin/upsert/{entity}")
async def upsert_entity(entity: str, doc: dict = Body(...), _admin: dict = Depends(admin_user)) -> dict:
    """Generic editorial upsert for graph nodes (paramparas, gurus, scriptures,
    practices, methodologies, institutions, sources). Keyed by `id`."""
    coll_map = {
        "paramparas": "kg_paramparas",
        "gurus": "kg_gurus",
        "scriptures": "kg_scriptures",
        "practices": "kg_practices",
        "methodologies": "kg_methodologies",
        "institutions": "kg_institutions",
        "sources": "kg_sources",
    }
    coll = coll_map.get(entity)
    if not coll:
        raise HTTPException(status_code=404, detail="unknown entity")
    if coll == "kg_paramparas" and doc.get("classification") not in CLASSIFICATIONS:
        raise HTTPException(status_code=400, detail=f"classification must be one of {CLASSIFICATIONS}")
    doc = dict(doc)
    doc.setdefault("id", new_id(entity[:2]))
    before = _clean(await db[coll].find_one({"id": doc["id"]}))
    if before:
        await _snapshot_revision(coll, before, _admin)
    doc["updated_at"] = now_ms()
    doc.setdefault("created_at", now_ms())
    await db[coll].update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await _audit(_admin, "edit" if before else "create", entity, doc["id"], before, doc)
    return {"ok": True, "id": doc["id"], "entity": entity}


# ── Governance: archive / merge / status / reject / guru-lineage / audit ──────
_GOV_COLLS = {
    "paramparas": "kg_paramparas", "gurus": "kg_gurus", "scriptures": "kg_scriptures",
    "practices": "kg_practices", "methodologies": "kg_methodologies", "institutions": "kg_institutions",
}


@router.post("/admin/records/{entity}/{rec_id}/status")
async def set_record_status(entity: str, rec_id: str, body: dict = Body(...), _admin: dict = Depends(admin_user)) -> dict:
    """Set a record's moderation/verification status (e.g. mark REQUIRES
    SCHOLARLY VERIFICATION, ARCHIVED, REJECTED). Snapshots + audits."""
    coll = _GOV_COLLS.get(entity)
    if not coll:
        raise HTTPException(status_code=404, detail="unknown entity")
    status = str(body.get("status") or "")
    if status not in RECORD_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {RECORD_STATUSES}")
    before = _clean(await db[coll].find_one({"id": rec_id}))
    if not before:
        raise HTTPException(status_code=404, detail="record not found")
    await _snapshot_revision(coll, before, _admin)
    upd = {"lifecycle_status": status, "updated_at": now_ms()}
    # keep the public verification_status coherent for paramparas
    if coll == "kg_paramparas" and status in ("VERIFIED", "REQUIRES_SCHOLARLY_VERIFICATION", "HISTORICALLY_DOCUMENTED", "ARCHIVED"):
        upd["verification_status"] = {"VERIFIED": "Verified", "REQUIRES_SCHOLARLY_VERIFICATION": "Requires Scholarly Verification",
                                       "HISTORICALLY_DOCUMENTED": "Historically Documented", "ARCHIVED": before.get("verification_status")}[status]
    if status == "ARCHIVED":
        upd["archived"] = True
    await db[coll].update_one({"id": rec_id}, {"$set": upd})
    await _audit(_admin, f"status:{status}", entity, rec_id, before, {**before, **upd}, str(body.get("notes") or ""))
    return {"ok": True, "id": rec_id, "status": status}


@router.post("/admin/paramparas/merge")
async def merge_paramparas(body: dict = Body(...), _admin: dict = Depends(admin_user)) -> dict:
    """Merge a duplicate parampara INTO a canonical target: repoint all edges
    (guru/scripture/practice/methodology/teacher/city/parent refs) to the
    target, then ARCHIVE the source. Fully audited + reversible via revisions."""
    src, tgt = str(body.get("source_id") or ""), str(body.get("target_id") or "")
    if not src or not tgt or src == tgt:
        raise HTTPException(status_code=400, detail="distinct source_id and target_id required")
    s = _clean(await db.kg_paramparas.find_one({"id": src}))
    t = _clean(await db.kg_paramparas.find_one({"id": tgt}))
    if not s or not t:
        raise HTTPException(status_code=404, detail="source or target not found")
    moved = {}
    for coll, field in [("kg_parampara_guru", "parampara_id"), ("kg_parampara_scripture", "parampara_id"),
                        ("kg_parampara_practice", "parampara_id"), ("kg_parampara_methodology", "parampara_id"),
                        ("kg_teacher_parampara", "parampara_id"), ("kg_city_parampara", "parampara_id")]:
        r = await db[coll].update_many({field: src}, {"$set": {field: tgt, "updated_at": now_ms()}})
        moved[coll] = r.modified_count
    for field in ("parent_id", "sampradaya_id", "darshana_id", "civilizational_root_id"):
        await db.kg_paramparas.update_many({field: src}, {"$set": {field: tgt}})
    await _snapshot_revision("kg_paramparas", s, _admin)
    await db.kg_paramparas.update_one({"id": src}, {"$set": {"lifecycle_status": "ARCHIVED", "archived": True, "merged_into": tgt, "updated_at": now_ms()}})
    await _audit(_admin, "merge", "paramparas", src, s, {"merged_into": tgt, "moved": moved}, f"merged into {tgt}")
    return {"ok": True, "source": src, "target": tgt, "moved_edges": moved}


@router.post("/admin/guru-lineage")
async def create_guru_lineage(body: dict = Body(...), _admin: dict = Depends(admin_user)) -> dict:
    """Create a Guru→teacher-Guru relationship (evidence + confidence required)."""
    disciple, teacher = str(body.get("guru_id") or ""), str(body.get("teacher_guru_id") or "")
    if not disciple or not teacher or disciple == teacher:
        raise HTTPException(status_code=400, detail="distinct guru_id and teacher_guru_id required")
    for gid in (disciple, teacher):
        if not await db.kg_gurus.find_one({"id": gid}):
            raise HTTPException(status_code=400, detail=f"unknown guru {gid}")
    doc = {
        "id": f"gl-{disciple}-{teacher}", "guru_id": disciple, "teacher_guru_id": teacher,
        "relationship_type": str(body.get("relationship_type") or "guru-disciple"),
        "period": body.get("period"), "evidence_source_id": body.get("evidence_source_id"),
        "confidence_level": body.get("confidence_level") or "Medium",
        "verification_status": body.get("verification_status") or "Requires Scholarly Verification",
        "note": body.get("note"), "updated_at": now_ms(), "created_at": now_ms(),
    }
    await db.kg_guru_lineage.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await _audit(_admin, "create", "guru_lineage", doc["id"], None, doc)
    return {"ok": True, "id": doc["id"]}


@router.post("/admin/teacher-parampara/reject")
async def reject_affiliation(body: dict = Body(...), admin: dict = Depends(admin_user)) -> dict:
    """Reject an unsupported teacher affiliation. Kept for audit; never shown publicly."""
    aid = str(body.get("affiliation_id") or "")
    before = await db.kg_teacher_parampara.find_one({"id": aid})
    if not before:
        raise HTTPException(status_code=404, detail="affiliation not found")
    await db.kg_teacher_parampara.update_one({"id": aid}, {"$set": {
        "verification_status": "Rejected", "review_state": "rejected",
        "rejection_reason": str(body.get("reason") or ""), "reviewed_by": admin.get("user_id") or admin.get("email"),
        "updated_at": now_ms()}})
    await _audit(admin, "reject", "teacher_parampara", aid, _clean(before), None, str(body.get("reason") or ""))
    return {"ok": True, "id": aid}


@router.get("/admin/audit")
async def audit_log(limit: int = Query(100, le=500), _admin: dict = Depends(admin_user)) -> dict:
    rows = await _find("kg_audit", {}, limit=limit, sort=[("at", -1)])
    return {"count": len(rows), "audit": rows}


@router.get("/admin/records")
async def admin_records(entity: str = Query("paramparas"), _admin: dict = Depends(admin_user)) -> dict:
    coll = _GOV_COLLS.get(entity)
    if not coll:
        raise HTTPException(status_code=404, detail="unknown entity")
    rows = await _find(coll, {}, limit=2000, sort=[("classification", 1)] if coll == "kg_paramparas" else None)
    return {"entity": entity, "count": len(rows), "records": rows, "statuses": RECORD_STATUSES}
