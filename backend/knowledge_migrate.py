"""
NOSTOPS Knowledge Graph — reversible migration + seed + verify + data-quality report.

Usage (from /app/backend):
    python knowledge_migrate.py up          # create indexes; record migration
    python knowledge_migrate.py down        # DROP only kg_* collections (reversible)
    python knowledge_migrate.py seed-small  # ~10 curated proof records
    python knowledge_migrate.py seed-full   # full Master Registry (idempotent upsert)
    python knowledge_migrate.py verify       # counts + FK integrity check
    python knowledge_migrate.py report       # curatorial data-quality report

SAFETY: this script only ever touches collections named kg_*. It NEVER reads or
writes existing pulse_* / audit_ledger / teacher_status_log data, so existing
production records cannot be affected. `down` is a clean, complete rollback.
"""
import os
import sys
import time

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

import knowledge_data as D  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
db = MongoClient(MONGO_URL)[DB_NAME]

KG_COLLECTIONS = [
    "kg_paramparas", "kg_gurus", "kg_guru_lineage", "kg_scriptures", "kg_practices",
    "kg_methodologies", "kg_institutions", "kg_teacher_parampara", "kg_city_parampara",
    "kg_parampara_guru", "kg_parampara_scripture", "kg_parampara_practice",
    "kg_parampara_methodology", "kg_sources", "kg_migrations",
]


def _now():
    return int(time.time() * 1000)


def up():
    """Create indexes (idempotent). Requested indexes: parampara slug,
    teacher-parampara, city-parampara, guru-parampara, scripture-parampara,
    practice-parampara — plus supporting classification/verification indexes."""
    db.kg_paramparas.create_index([("slug", ASCENDING)], unique=True, name="ux_parampara_slug")
    db.kg_paramparas.create_index([("classification", ASCENDING)], name="ix_parampara_classification")
    db.kg_paramparas.create_index([("verification_status", ASCENDING)], name="ix_parampara_verification")
    db.kg_paramparas.create_index([("parent_id", ASCENDING)], name="ix_parampara_parent")
    db.kg_paramparas.create_index([("darshana_id", ASCENDING)], name="ix_parampara_darshana")
    db.kg_paramparas.create_index([("sampradaya_id", ASCENDING)], name="ix_parampara_sampradaya")

    db.kg_gurus.create_index([("slug", ASCENDING)], unique=True, name="ux_guru_slug")
    db.kg_scriptures.create_index([("slug", ASCENDING)], unique=True, name="ux_scripture_slug")
    db.kg_practices.create_index([("slug", ASCENDING)], unique=True, name="ux_practice_slug")
    db.kg_methodologies.create_index([("slug", ASCENDING)], unique=True, name="ux_methodology_slug")
    db.kg_institutions.create_index([("slug", ASCENDING)], unique=True, name="ux_institution_slug")
    db.kg_sources.create_index([("id", ASCENDING)], unique=True, name="ux_source_id")

    db.kg_guru_lineage.create_index([("guru_id", ASCENDING)], name="ix_lineage_guru")
    db.kg_guru_lineage.create_index([("teacher_guru_id", ASCENDING)], name="ix_lineage_teacher_guru")
    db.kg_guru_lineage.create_index([("guru_id", ASCENDING), ("teacher_guru_id", ASCENDING)], unique=True, name="ux_lineage_edge")

    db.kg_teacher_parampara.create_index([("teacher_id", ASCENDING)], name="ix_tp_teacher")
    db.kg_teacher_parampara.create_index([("parampara_id", ASCENDING)], name="ix_tp_parampara")
    db.kg_teacher_parampara.create_index([("teacher_id", ASCENDING), ("parampara_id", ASCENDING), ("relationship_type", ASCENDING)], unique=True, name="ux_tp_edge")
    db.kg_teacher_parampara.create_index([("verification_status", ASCENDING)], name="ix_tp_verification")

    db.kg_city_parampara.create_index([("city_id", ASCENDING)], name="ix_cp_city")
    db.kg_city_parampara.create_index([("parampara_id", ASCENDING)], name="ix_cp_parampara")
    db.kg_city_parampara.create_index([("city_id", ASCENDING), ("parampara_id", ASCENDING)], unique=True, name="ux_cp_edge")

    for coll, a in [("kg_parampara_guru", "guru_id"), ("kg_parampara_scripture", "scripture_id"),
                    ("kg_parampara_practice", "practice_id"), ("kg_parampara_methodology", "methodology_id")]:
        db[coll].create_index([("parampara_id", ASCENDING)], name=f"ix_{coll}_parampara")
        db[coll].create_index([(a, ASCENDING)], name=f"ix_{coll}_target")
        db[coll].create_index([("parampara_id", ASCENDING), (a, ASCENDING)], unique=True, name=f"ux_{coll}_edge")

    # Prompt 4E — record the schema migration ONCE. A restart must not rewrite applied_at
    # (it is the first-applied time); an existing record is left exactly as it is.
    db.kg_migrations.update_one(
        {"version": D.SCHEMA_VERSION},
        {"$setOnInsert": {"version": D.SCHEMA_VERSION, "name": "kg_initial_schema", "applied_at": _now()}},
        upsert=True,
    )
    print(f"up: indexes ensured; migration v{D.SCHEMA_VERSION} recorded.")


def down():
    """Full, reversible rollback: drop ONLY kg_* collections."""
    dropped = []
    for c in KG_COLLECTIONS:
        if c in db.list_collection_names():
            db[c].drop()
            dropped.append(c)
    print(f"down: dropped {len(dropped)} kg_* collections: {dropped}")


def _upsert(coll, docs):
    n = 0
    for d in docs:
        d = dict(d)
        d.setdefault("created_at", _now())
        d["updated_at"] = _now()
        db[coll].update_one({"id": d["id"]}, {"$set": d}, upsert=True)
        n += 1
    return n


def _seed(paramparas, gurus, scriptures, practices, methodologies, institutions,
          guru_lineage, pg, ps, pp, pm, teacher_parampara, city_parampara, sources):
    counts = {
        "kg_sources": _upsert("kg_sources", sources),
        "kg_paramparas": _upsert("kg_paramparas", paramparas),
        "kg_gurus": _upsert("kg_gurus", gurus),
        "kg_scriptures": _upsert("kg_scriptures", scriptures),
        "kg_practices": _upsert("kg_practices", practices),
        "kg_methodologies": _upsert("kg_methodologies", methodologies),
        "kg_institutions": _upsert("kg_institutions", institutions),
        "kg_guru_lineage": _upsert("kg_guru_lineage", guru_lineage),
        "kg_parampara_guru": _upsert("kg_parampara_guru", pg),
        "kg_parampara_scripture": _upsert("kg_parampara_scripture", ps),
        "kg_parampara_practice": _upsert("kg_parampara_practice", pp),
        "kg_parampara_methodology": _upsert("kg_parampara_methodology", pm),
        "kg_teacher_parampara": _upsert("kg_teacher_parampara", teacher_parampara),
        "kg_city_parampara": _upsert("kg_city_parampara", city_parampara),
    }
    return counts


def seed_full():
    up()
    counts = _seed(D.PARAMPARAS, D.GURUS, D.SCRIPTURES, D.PRACTICES, D.METHODOLOGIES,
                   D.INSTITUTIONS, D.GURU_LINEAGE, D.PARAMPARA_GURU, D.PARAMPARA_SCRIPTURE,
                   D.PARAMPARA_PRACTICE, D.PARAMPARA_METHODOLOGY, D.TEACHER_PARAMPARA,
                   D.CITY_PARAMPARA, D.SOURCES)
    print("seed-full:", counts)


def seed_small():
    """Insert a self-consistent ~10-node proof: the curated paramparas plus every
    entity they reference (gurus, scriptures, practices, methodologies + edges)."""
    up()
    pset = set(D.SEED_SMALL_SLUGS)
    paramparas = [p for p in D.PARAMPARAS if p["id"] in pset]
    # include referenced parent/darshana/sampradaya/civ so refs resolve
    ref_ids = set()
    for p in paramparas:
        for k in ("parent_id", "darshana_id", "sampradaya_id", "civilizational_root_id"):
            if p.get(k):
                ref_ids.add(p[k])
    extra = [p for p in D.PARAMPARAS if p["id"] in ref_ids and p["id"] not in pset]
    paramparas += extra
    all_p = {p["id"] for p in paramparas}

    pg = [e for e in D.PARAMPARA_GURU if e["parampara_id"] in all_p]
    ps = [e for e in D.PARAMPARA_SCRIPTURE if e["parampara_id"] in all_p]
    pp = [e for e in D.PARAMPARA_PRACTICE if e["parampara_id"] in all_p]
    pm = [e for e in D.PARAMPARA_METHODOLOGY if e["parampara_id"] in all_p]

    guru_ids = {e["guru_id"] for e in pg}
    gurus = [g for g in D.GURUS if g["id"] in guru_ids]
    gl = [e for e in D.GURU_LINEAGE if e["guru_id"] in guru_ids and e["teacher_guru_id"] in guru_ids]
    scr_ids = {e["scripture_id"] for e in ps}
    scriptures = [s for s in D.SCRIPTURES if s["id"] in scr_ids]
    prac_ids = {e["practice_id"] for e in pp}
    practices = [x for x in D.PRACTICES if x["id"] in prac_ids]
    meth_ids = {e["methodology_id"] for e in pm}
    methodologies = [m for m in D.METHODOLOGIES if m["id"] in meth_ids]
    institutions = [i for i in D.INSTITUTIONS if i.get("associated_parampara_id") in all_p]
    src_ids = set()
    for coll in (paramparas, gurus, scriptures):
        for d in coll:
            for s in d.get("source_ids", []):
                src_ids.add(s)
    sources = [s for s in D.SOURCES if s["id"] in src_ids]

    counts = _seed(paramparas, gurus, scriptures, practices, methodologies, institutions,
                   gl, pg, ps, pp, pm, [], [], sources)
    print("seed-small:", counts)
    print("seed-small paramparas:", sorted(all_p))


def _all_node_ids():
    ids = set()
    for coll in ("kg_paramparas", "kg_gurus", "kg_scriptures", "kg_practices", "kg_methodologies"):
        ids |= {d["id"] for d in db[coll].find({}, {"id": 1})}
    return ids


def verify():
    print("── VERIFY ──")
    for c in KG_COLLECTIONS:
        if c == "kg_migrations":
            continue
        print(f"  {c}: {db[c].count_documents({})}")
    # FK integrity: every edge target must exist.
    p_ids = {d["id"] for d in db.kg_paramparas.find({}, {"id": 1})}
    g_ids = {d["id"] for d in db.kg_gurus.find({}, {"id": 1})}
    s_ids = {d["id"] for d in db.kg_scriptures.find({}, {"id": 1})}
    pr_ids = {d["id"] for d in db.kg_practices.find({}, {"id": 1})}
    m_ids = {d["id"] for d in db.kg_methodologies.find({}, {"id": 1})}
    dangling = []
    for e in db.kg_parampara_guru.find({}):
        if e["parampara_id"] not in p_ids or e["guru_id"] not in g_ids:
            dangling.append(("kg_parampara_guru", e["id"]))
    for e in db.kg_parampara_scripture.find({}):
        if e["parampara_id"] not in p_ids or e["scripture_id"] not in s_ids:
            dangling.append(("kg_parampara_scripture", e["id"]))
    for e in db.kg_parampara_practice.find({}):
        if e["parampara_id"] not in p_ids or e["practice_id"] not in pr_ids:
            dangling.append(("kg_parampara_practice", e["id"]))
    for e in db.kg_parampara_methodology.find({}):
        if e["parampara_id"] not in p_ids or e["methodology_id"] not in m_ids:
            dangling.append(("kg_parampara_methodology", e["id"]))
    for e in db.kg_guru_lineage.find({}):
        if e["guru_id"] not in g_ids or e["teacher_guru_id"] not in g_ids:
            dangling.append(("kg_guru_lineage", e["id"]))
    # parampara parent/darshana/etc.
    for p in db.kg_paramparas.find({}):
        for k in ("parent_id", "darshana_id", "sampradaya_id", "civilizational_root_id"):
            if p.get(k) and p[k] not in p_ids:
                dangling.append((f"kg_paramparas.{k}", f'{p["id"]}→{p[k]}'))
    if dangling:
        print(f"  ⚠ {len(dangling)} DANGLING references:")
        for d in dangling:
            print("     ", d)
    else:
        print("  ✓ FK integrity OK (no dangling references)")
    return not dangling


def report():
    ps = list(db.kg_paramparas.find({}, {"_id": 0}))
    by_class, by_verif = {}, {}
    for p in ps:
        by_class[p["classification"]] = by_class.get(p["classification"], 0) + 1
        by_verif[p["verification_status"]] = by_verif.get(p["verification_status"], 0) + 1

    lineages = list(db.kg_guru_lineage.find({}, {"_id": 0}))
    ambiguous = [e for e in lineages if e.get("verification_status") == "Requires Scholarly Verification" or e.get("confidence_level") in ("Low", "Uncertain")]

    # Modern nodes wrongly tagged as a historical/ancient paramparā (integrity check).
    misclassified = [p for p in ps if p.get("historical_status") == "Modern" and p["classification"] in ("Historical Paramparā", "Source Tradition", "Darśana")]
    # Duplicate canonical names.
    names = {}
    for p in ps:
        names.setdefault(p["canonical_name"].lower(), []).append(p["id"])
    dupes = {k: v for k, v in names.items() if len(v) > 1}

    verified = [p["slug"] for p in ps if p["verification_status"] == "Verified"]
    partial = [p["slug"] for p in ps if p["verification_status"] == "Partially Verified"]
    needs = [p["slug"] for p in ps if p["verification_status"] == "Requires Scholarly Verification"]

    print("=" * 72)
    print("NOSTOPS YOGIC PARAMPARĀ — DATA-QUALITY REPORT")
    print("=" * 72)
    print(f"\nTotal parampara/tradition nodes: {len(ps)}")
    print("\nBy classification:")
    for k in sorted(by_class):
        print(f"  {k:<34} {by_class[k]}")
    print("\nBy verification status:")
    for k in sorted(by_verif):
        print(f"  {k:<34} {by_verif[k]}")
    print(f"\nVerified records ({len(verified)}): {verified}")
    print(f"\nRequires Scholarly Verification ({len(needs)}): {needs}")
    print(f"\nPartially verified ({len(partial)}): {partial}")
    print(f"\nAmbiguous guru-lineage relationships ({len(ambiguous)}):")
    for e in ambiguous:
        print(f"  {e['guru_id']} ← {e['teacher_guru_id']}  [{e['relationship_type']}, {e['confidence_level']}]  {e.get('note') or ''}")
    print(f"\nDuplicate canonical names: {dupes if dupes else 'none'}")
    print(f"\nModern methods mis-classified as ancient Paramparā/Darśana/Source: {[p['slug'] for p in misclassified] if misclassified else 'none ✓'}")
    print("\nCurated notes — traditions that must remain SEPARATE (not merged):")
    for a, b, why in [
        ("sri-aurobindo-integral-yoga", "integral-yoga-satchidananda", "Two unrelated 'Integral Yoga' traditions sharing a name."),
        ("brahma-kumaris", "raja-yoga", "Brahma Kumaris' 'Raja Yoga' is doctrinally NOT Patañjala Rāja Yoga."),
        ("kundalini-yoga-3ho", "kundalini-yoga-classical", "Yogi Bhajan's modern method vs classical tantric kuṇḍalinī."),
        ("ashtanga-vinyasa", "yoga-darshana", "Modern Vinyāsa method vs Patañjali's aṣṭāṅga (eight limbs)."),
        ("kriya-yoga-yogananda", "kriya-yoga-classical", "Yogananda's modern Kriyā vs classical tantric kriyā."),
    ]:
        print(f"  • {a}  ≠  {b}  — {why}")
    print("=" * 72)


def enrich():
    """Apply editorial enrichment (richer descriptions) to existing nodes so
    well-documented traditions carry non-thin content and can index."""
    import knowledge_enrich as E
    n = 0
    for slug, fields in E.ENRICH.items():
        doc = db.kg_paramparas.find_one({"slug": slug})
        if not doc:
            print("  skip (missing):", slug)
            continue
        upd = {"updated_at": _now()}
        if fields.get("description"):
            upd["description"] = fields["description"]
        if fields.get("contemporary_description"):
            upd["contemporary_description"] = fields["contemporary_description"]
        db.kg_paramparas.update_one({"slug": slug}, {"$set": upd})
        n += 1
    print(f"enrich: updated {n} nodes")


def bootstrap():
    """Idempotent one-call setup for deploys. On an EMPTY database it seeds the
    full registry; on any database it (re)applies enrichment. It never re-runs
    seed_full over existing data (which could clobber enrichment or collide with
    bridge-derived edges). NEVER touches non-kg_* collections."""
    up()
    if db.kg_paramparas.count_documents({}) < len(D.PARAMPARAS):
        seed_full()
    marker = db.kg_migrations.find_one({"version": "content-v2"})
    if not marker:
        try:
            enrich()
        except Exception as e:  # noqa: BLE001
            print("bootstrap enrich skipped:", e)
        db.kg_migrations.update_one({"version": "content-v2"}, {"$set": {"version": "content-v2", "applied_at": _now()}}, upsert=True)
    # content-v3: idempotently upsert the guru roster + lineage edges so newly
    # added disciples/links land in every environment on deploy. Touches ONLY
    # kg_gurus + kg_guru_lineage — never paramparas (so enrichment is preserved).
    if not db.kg_migrations.find_one({"version": "content-v3"}):
        gn = _upsert("kg_gurus", D.GURUS)
        ln = _upsert("kg_guru_lineage", D.GURU_LINEAGE)
        db.kg_migrations.update_one({"version": "content-v3"}, {"$set": {"version": "content-v3", "applied_at": _now()}}, upsert=True)
        print(f"bootstrap content-v3: gurus={gn}, lineage={ln}")
    # content-v4: stamp Wikimedia-Commons portrait metadata onto matching gurus
    # (images already live in shared object storage). Only $set portrait_* fields.
    if not db.kg_migrations.find_one({"version": "content-v4"}):
        pn = 0
        for slug, fields in getattr(D, "GURU_PORTRAITS", {}).items():
            r = db.kg_gurus.update_one({"slug": slug}, {"$set": {**fields, "updated_at": _now()}})
            pn += r.matched_count
        db.kg_migrations.update_one({"version": "content-v4"}, {"$set": {"version": "content-v4", "applied_at": _now()}}, upsert=True)
        print(f"bootstrap content-v4: portraits stamped on {pn} gurus")
    total = db.kg_paramparas.count_documents({})
    print(f"bootstrap: paramparas={total}")
    return total


CMDS = {"up": up, "down": down, "seed-small": seed_small, "seed-full": seed_full, "verify": verify, "report": report, "enrich": enrich, "bootstrap": bootstrap}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "verify"
    fn = CMDS.get(cmd)
    if not fn:
        print(f"unknown command '{cmd}'. one of: {list(CMDS)}")
        sys.exit(1)
    fn()
