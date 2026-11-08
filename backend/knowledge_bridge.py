"""
Inventory bridge: map EXISTING remote teachers' declared parampara / styles /
specializations into the Knowledge Graph as Teacher-declared / Unverified
affiliations, and derive city↔parampara counts.

STRICTLY additive & honest:
  • Reads the PUBLIC remote directory only (never writes to the remote backend).
  • Every bridged row is `verification_status='Unverified'` and tagged
    `source='directory-bridge'` — a self-declaration is NEVER a verified lineage.
  • Idempotent: `--rebuild` clears prior bridge rows before re-inserting.

Usage:  python knowledge_bridge.py rebuild   |   python knowledge_bridge.py status
"""
import os
import sys
import time
import re

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))
import knowledge_data as D  # noqa: E402

DB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "nostops_web")]
REMOTE = (os.environ.get("BACKEND_ORIGIN") or "https://pro-learn-connect-1.emergent.host").rstrip("/")
GENERIC_CITIES = {"", "india", "online", "remote", "n/a", "anywhere"}

# Hand-curated alias → kg parampara slug (lowercased keys). Conservative: only
# map terms with a defensible tradition; ambiguous/generic styles are skipped.
STYLE_ALIAS = {
    "hatha": "hatha-yoga", "hatha yoga": "hatha-yoga",
    "iyengar": "iyengar-yoga", "iyengar yoga": "iyengar-yoga",
    "ashtanga": "ashtanga-vinyasa", "ashtanga yoga": "ashtanga-vinyasa", "ashtanga vinyasa": "ashtanga-vinyasa",
    "vinyasa": "ashtanga-vinyasa",
    "viniyoga": "viniyoga",
    "sivananda": "sivananda-yoga", "sivananda yoga": "sivananda-yoga",
    "satyananda": "satyananda-yoga", "bihar yoga": "satyananda-yoga",
    "kundalini": "kundalini-yoga-classical", "kundalini kriya": "kundalini-yoga-classical", "kundalini yoga": "kundalini-yoga-classical",
    "kriya": "kriya-yoga-yogananda", "kriya yoga": "kriya-yoga-yogananda",
    "raja yoga": "raja-yoga", "raja": "raja-yoga",
    "jnana yoga": "jnana-yoga", "bhakti yoga": "bhakti-yoga", "karma yoga": "karma-yoga",
    "mantra yoga": "mantra-yoga", "mantra meditation": "mantra-yoga",
    "nada yoga": "nada-yoga", "nada": "nada-yoga",
    "dhyana": "dhyana-yoga",
    "transcendental meditation": "transcendental-meditation", "trancendental meditation": "transcendental-meditation",
    "vipassana": "vipassana-goenka",
    "isha": "isha-yoga", "art of living": "art-of-living",
}


def _slugify_city(c):
    c = (c or "").strip().lower()
    if c in GENERIC_CITIES:
        return None
    return re.sub(r"[^a-z0-9]+", "-", c).strip("-") or None


def _match(term):
    return STYLE_ALIAS.get((term or "").strip().lower())


def rebuild():
    valid = {p["id"] for p in DB.kg_paramparas.find({}, {"id": 1})}
    r = requests.get(f"{REMOTE}/api/teachers/directory", timeout=25)
    teachers = r.json().get("teachers") or []
    DB.kg_teacher_parampara.delete_many({"source": "directory-bridge"})
    DB.kg_city_parampara.delete_many({"source": "directory-bridge"})

    now = int(time.time() * 1000)
    inserted, city_counts = 0, {}
    for t in teachers:
        handle = (t.get("handle") or "").strip()
        if not handle:
            continue
        city = _slugify_city(t.get("city"))
        # explicit parampara → Teacher-declared; styles/specializations → Methodological association
        claims = []
        if t.get("parampara"):
            s = _match(t["parampara"]) or (t["parampara"] if t["parampara"] in valid else None)
            if s:
                claims.append((s, "Teacher-declared"))
        for term in (t.get("styles") or []) + (t.get("specializations") or []):
            s = _match(term)
            if s:
                claims.append((s, "Methodological association"))
        seen = set()
        for slug, rel in claims:
            if slug not in valid or (slug, rel) in seen:
                continue
            seen.add((slug, rel))
            DB.kg_teacher_parampara.update_one(
                {"teacher_id": handle, "parampara_id": slug, "relationship_type": rel},
                {"$set": {"id": f"tpb-{handle}-{slug}-{rel[:4]}", "teacher_id": handle, "parampara_id": slug,
                          "relationship_type": rel, "city_id": city, "verification_status": "Unverified",
                          "review_state": "auto_declared", "source": "directory-bridge",
                          "guru_id": None, "guru_name": None, "training_institution": None,
                          "years_of_training": None, "certification": None, "evidence_document": None,
                          "practices_taught": [], "scriptures_studied": [], "updated_at": now, "created_at": now}},
                upsert=True,
            )
            inserted += 1
            if city:
                city_counts[(city, slug)] = city_counts.get((city, slug), 0) + 1

    for (city, slug), n in city_counts.items():
        DB.kg_city_parampara.update_one(
            {"city_id": city, "parampara_id": slug},
            {"$set": {"id": f"cpb-{city}-{slug}", "city_id": city, "parampara_id": slug,
                      "teacher_count": n, "availability_status": "available",
                      "source": "directory-bridge", "updated_at": now}},
            upsert=True,
        )
    print(f"bridge rebuild: teachers={len(teachers)} affiliations={inserted} city_edges={len(city_counts)}")


def status():
    print("teacher_parampara (bridge):", DB.kg_teacher_parampara.count_documents({"source": "directory-bridge"}))
    print("city_parampara (bridge):", DB.kg_city_parampara.count_documents({"source": "directory-bridge"}))
    top = list(DB.kg_teacher_parampara.aggregate([
        {"$group": {"_id": "$parampara_id", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}, {"$limit": 12}]))
    print("top traditions by teacher count:", [(x["_id"], x["n"]) for x in top])


if __name__ == "__main__":
    {"rebuild": rebuild, "status": status}.get(sys.argv[1] if len(sys.argv) > 1 else "status", status)()
