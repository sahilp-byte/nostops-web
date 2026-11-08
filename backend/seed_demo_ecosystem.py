"""
NOSTOPS — Demonstration Ecosystem Seeder (institutional engine).

Creates a PERMANENT, SAFE, IDEMPOTENT demonstration ecosystem that lets a
first-time visitor SEE how the NOSTOPS institutional model works end to end:

    6 fictional organisations (2 Companies · 2 Educational Institutions ·
    2 Startup & Networking Groups)  →  one Council-curated programme each
    (REUSED from the existing APPROVED Council catalogue — no duplicate IP)
    →  demo teachers matched via the REAL matching architecture  →  teacher
    confirmed  →  one PUBLIC single-date demonstration event each (PUBLISHED /
    COMPLETED)  →  public event page  →  safe FREE registration.

Design rules honoured:
  • REUSE the production institutional engine (handlers + collections). No
    parallel / second architecture.
  • IDEMPOTENT — keyed by stable demo_seed_key. Re-running never duplicates
    organisations, members, programmes, teachers, events, coordinators.
  • SAFE — every demo event is PUBLIC + pricing FREE. No real payment, payout,
    settlement or financial liability is ever created. Demo teachers carry
    email=None so the matcher never emails anyone, and demo events are matched
    ONLY to demo teachers (real/QA teachers are excluded) so nothing leaks into
    a real teacher's dashboard.
  • Bound to the existing hr.demo@nostops.com account as the Event Creator /
    OWNER of all six organisations (per owner instruction), so logging in as
    hr.demo shows all six in the Event Creator dashboard.
  • Taxonomy is strictly MIND / BODY / SPECIAL_NEEDS (labels Mind/Body/Special
    Needs). Never "Specific Needs".
  • City Coordinators are support/local-execution records only — NEVER approval
    gates (the engine already lets organisations publish without them).

Restart safety (Prompt 3C): the backend runs main() on EVERY start-up and
auto-reload. In that mode it only CREATES demonstration records that are
missing (a fresh deploy) and never rewrites an existing one: no timestamp,
date, slug, SEO row, ID counter or teacher match changes on a restart.
Re-applying the showcase copy and moving the demo dates relative to today is
an explicit, manual step:

Run:  python seed_demo_ecosystem.py              (creates only what is missing)
      python seed_demo_ecosystem.py --refresh    (re-applies copy + dates; rewrites updated_at)
"""
import asyncio
import datetime as _dt
import sys

import institutional as I

DEMO_SEED_VERSION = "demo-ecosystem-v2"
DEMO_LABEL = "NOSTOPS Demonstration"

# Event Creator / OWNER for all six demo orgs — the real hr.demo account so the
# owner can log in and manage them. (user_id resolved from the live /auth/me.)
HR = {
    "user_id": "user_57805db4058c",
    "name": "Priya HR",
    "email": "hr.demo@nostops.com",
    "role": "hr",
}
ADMIN = {"user_id": "user_demo_admin_seed", "name": "NOSTOPS Admin", "role": "admin"}


def _ist_today() -> _dt.date:
    return (_dt.datetime.utcnow() + _dt.timedelta(hours=5, minutes=30)).date()


TODAY = _ist_today()


def _d(offset_days: int) -> str:
    return (TODAY + _dt.timedelta(days=offset_days)).isoformat()


# ── Demonstration teachers (fictional; email=None so no emails are ever sent) ──
DEMO_TEACHERS = [
    {"teacher_id": "demo_tch_mum_001", "name": "Ananya Deshmukh", "handle": "ananya-deshmukh",
     "city": "Mumbai", "level": "L2", "languages": ["English", "Hindi", "Marathi"],
     "specializations": ["Breath & focus", "Workplace Yoga"], "taxonomies": ["MIND", "BODY"],
     "experience_years": 9, "rating": 4.8, "lineage": "Hatha / Pranayama",
     "institutional_experience": "Corporate & campus programmes", "availability": "Weekday mornings",
     "performance_history": "48 sessions · 4.8★"},
    {"teacher_id": "demo_tch_mum_002", "name": "Rohan Kulkarni", "handle": "rohan-kulkarni",
     "city": "Mumbai", "level": "L2", "languages": ["English", "Hindi"],
     "specializations": ["Mobility", "Posture"], "taxonomies": ["BODY", "MIND"],
     "experience_years": 7, "rating": 4.7, "lineage": "Iyengar-informed Hatha",
     "institutional_experience": "Startup & community groups", "availability": "Evenings & weekends",
     "performance_history": "36 sessions · 4.7★"},
    {"teacher_id": "demo_tch_pun_001", "name": "Meera Joshi", "handle": "meera-joshi",
     "city": "Pune", "level": "L3", "languages": ["English", "Hindi", "Marathi"],
     "specializations": ["Strength & mobility", "Energy"], "taxonomies": ["BODY", "MIND"],
     "experience_years": 12, "rating": 4.9, "lineage": "Ashtanga / Hatha",
     "institutional_experience": "Corporate wellness lead", "availability": "Flexible",
     "performance_history": "70 sessions · 4.9★"},
    {"teacher_id": "demo_tch_pun_002", "name": "Aditya Rao", "handle": "aditya-rao",
     "city": "Pune", "level": "L2", "languages": ["English", "Hindi"],
     "specializations": ["Focus", "Resilience"], "taxonomies": ["MIND", "BODY"],
     "experience_years": 8, "rating": 4.6, "lineage": "Pranayama / Mindful movement",
     "institutional_experience": "Founder & networking groups", "availability": "Weekday mornings",
     "performance_history": "41 sessions · 4.6★"},
    {"teacher_id": "demo_tch_nmum_001", "name": "Sneha Nair", "handle": "sneha-nair",
     "city": "Navi Mumbai", "level": "L2", "languages": ["English", "Hindi", "Marathi"],
     "specializations": ["Student well-being", "Focus"], "taxonomies": ["MIND", "BODY"],
     "experience_years": 8, "rating": 4.7, "lineage": "Hatha / Yoga Nidra",
     "institutional_experience": "Campus & examination-support programmes", "availability": "Weekday afternoons",
     "performance_history": "39 sessions · 4.7★"},
    {"teacher_id": "demo_tch_nsk_001", "name": "Vikram Patil", "handle": "vikram-patil",
     "city": "Nashik", "level": "L2", "languages": ["English", "Hindi", "Marathi"],
     "specializations": ["Posture", "Campus mobility"], "taxonomies": ["BODY", "MIND"],
     "experience_years": 10, "rating": 4.8, "lineage": "Hatha",
     "institutional_experience": "College & faculty programmes", "availability": "Mornings",
     "performance_history": "52 sessions · 4.8★"},
]

# ── Demonstration City Coordinators (support / local execution ONLY — NO gate) ─
DEMO_COORDINATORS = [
    {"key": "DEMO-CCA-MUM", "name": "Kavita Menon", "city": "Mumbai"},
    {"key": "DEMO-CCA-NMUM", "name": "Imran Shaikh", "city": "Navi Mumbai"},
    {"key": "DEMO-CCA-PUN", "name": "Nikhil Gokhale", "city": "Pune"},
    {"key": "DEMO-CCA-NSK", "name": "Prerna Deshpande", "city": "Nashik"},
]

# ── Six demonstration organisations + one event each ──────────────────────────
# B2.3 rewrite: every demo event is ONE single-date session of its Council
# programme. Titles name the programme, capacities sit inside the programme's
# recommended group size, session lengths match the programme, and the copy
# states only the programme's own aims (no outcome claims, no ongoing-series
# wording).
ORGS = [
    # ===================== COMPANIES =====================
    {
        "key": "DEMO-ORG-COMPANY-001", "cohort": I.COHORT_COMPANY,
        "name": "Arclight Technologies India Pvt. Ltd.", "short_name": "Arclight Technologies",
        "city": "Mumbai", "industry": "Technology & Digital Services", "org_size": "≈ 650 employees",
        "website": "https://www.arclighttech.example", "contact_email": "programmes@arclighttech.example",
        "contact_person": "Priya Sharma, Head of People & Culture", "contact_phone": "+91 22 4000 1200",
        "logo": "/brand/demo/arclight.svg", "creator_role": I.ECR_HR,
        "description": (
            "Arclight Technologies is an illustrative Mumbai technology and digital-services company of about 650 "
            "engineers, designers and product specialists working across two Mumbai campuses. Its People & "
            "Culture team uses NOSTOPS to run a single on-site session of the Council-curated Mind programme "
            "“Yoga for Focus & Attention” for up to 30 employees, led by a NOSTOPS-verified teacher in the "
            "campus wellness studio. The programme’s stated aims are to support focus and attention, build "
            "everyday mental clarity and settle a busy mind."
        ),
        "event": {
            "key": "DEMO-EVT-COMPANY-001", "programme": "mind-focus-attention",
            "title": "Yoga for Focus & Attention — Arclight Technologies",
            "subtitle": "A single 60-minute on-site session of the Council-curated Mind programme Yoga for Focus & Attention, for up to 30 Arclight employees.",
            "date_offset": 21, "start": "08:30", "end": "09:30", "duration": 60,
            "venue": "Arclight Campus — Wellness Studio, Powai", "capacity": 30, "language": "English",
            "reg_close_offset": 19, "reg_access": I.REG_ORG_ONLY, "lifecycle": "PUBLISHED",
        },
    },
    {
        "key": "DEMO-ORG-COMPANY-002", "cohort": I.COHORT_COMPANY,
        "name": "Meridian BioSystems India Pvt. Ltd.", "short_name": "Meridian BioSystems",
        "city": "Pune", "industry": "Healthcare Technology / Life Sciences", "org_size": "≈ 400 employees",
        "website": "https://www.meridianbio.example", "contact_email": "wellbeing@meridianbio.example",
        "contact_person": "Dr. Anand Menon, VP Human Resources", "contact_phone": "+91 20 6700 4500",
        "logo": "/brand/demo/meridian.svg", "creator_role": I.ECR_HR,
        "description": (
            "Meridian BioSystems is an illustrative Pune healthcare-technology and life-sciences company of about "
            "400 scientists, lab technicians and engineers across its R&D and manufacturing sites. Its HR team "
            "uses NOSTOPS to run a single on-site session of the Council-curated Body programme “Yoga for "
            "Strength & Mobility” for up to 25 staff, led by a NOSTOPS-verified teacher in the R&D campus "
            "community hall. The programme’s stated aims are to build functional strength, improve flexibility "
            "and support everyday mobility."
        ),
        "event": {
            "key": "DEMO-EVT-COMPANY-002", "programme": "body-strength-mobility",
            "title": "Yoga for Strength & Mobility — Meridian BioSystems",
            "subtitle": "A single 60-minute on-site session of the Council-curated Body programme Yoga for Strength & Mobility, for up to 25 Meridian staff.",
            "date_offset": 28, "start": "17:30", "end": "18:30", "duration": 60,
            "venue": "Meridian R&D Campus — Community Hall, Hinjawadi", "capacity": 25, "language": "English",
            "reg_close_offset": 26, "reg_access": I.REG_ORG_ONLY, "lifecycle": "PUBLISHED",
        },
    },
    # ================ EDUCATIONAL INSTITUTIONS ================
    {
        "key": "DEMO-ORG-EDU-001", "cohort": I.COHORT_EDUCATIONAL,
        "name": "Western Institute of Applied Sciences", "short_name": "WIAS",
        "city": "Navi Mumbai", "industry": "Higher Education / University Campus", "org_size": "≈ 4,200 students",
        "website": "https://www.wias.example", "contact_email": "studentlife@wias.example",
        "contact_person": "Prof. Rhea Fernandes, Dean of Student Life", "contact_phone": "+91 22 2770 3300",
        "logo": "/brand/demo/wias.svg", "creator_role": I.ECR_FACULTY,
        "description": (
            "The Western Institute of Applied Sciences (WIAS) is an illustrative Navi Mumbai campus of about 4,200 "
            "students in applied sciences, computing and engineering. Its student-life team uses NOSTOPS to run a "
            "single on-campus session of the Council-curated Mind programme “Yoga for Focus & Attention” "
            "for up to 30 students, led by a NOSTOPS-verified teacher at the Student Activity Centre. The "
            "programme’s stated aims are to support focus and attention, build everyday mental clarity and "
            "settle a busy mind."
        ),
        "event": {
            "key": "DEMO-EVT-EDU-001", "programme": "mind-focus-attention",
            "title": "Yoga for Focus & Attention — WIAS Campus",
            "subtitle": "A single 60-minute on-campus session of the Council-curated Mind programme Yoga for Focus & Attention, for up to 30 WIAS students.",
            "date_offset": 7, "start": "07:30", "end": "08:30", "duration": 60,
            "venue": "WIAS Campus — Student Activity Centre", "capacity": 30, "language": "English",
            "reg_close_offset": 5, "reg_access": I.REG_ORG_ONLY, "lifecycle": "PUBLISHED",
        },
    },
    {
        "key": "DEMO-ORG-EDU-002", "cohort": I.COHORT_EDUCATIONAL,
        "name": "Vidyadeep Institute of Technology & Management", "short_name": "VITM",
        "city": "Nashik", "industry": "Higher Education / Professional Education", "org_size": "≈ 3,100 students",
        "website": "https://www.vitm.example", "contact_email": "wellness@vitm.example",
        "contact_person": "Dr. Sameer Kulkarni, Registrar", "contact_phone": "+91 253 660 2100",
        "logo": "/brand/demo/vitm.svg", "creator_role": I.ECR_FACULTY,
        "description": (
            "Vidyadeep Institute of Technology & Management (VITM) is an illustrative Nashik campus of about 3,100 "
            "engineering, management and technology students. Its student-affairs office uses NOSTOPS to run a "
            "single on-campus session of the Council-curated Body programme “Yoga for Posture & Back Care” "
            "for up to 25 students, led by a NOSTOPS-verified teacher in the Sports & Wellness Hall. The "
            "programme’s stated aims are to support healthy posture, care for the back and ease everyday "
            "stiffness."
        ),
        "event": {
            "key": "DEMO-EVT-EDU-002", "programme": "body-posture-back-care",
            "title": "Yoga for Posture & Back Care — VITM Campus",
            "subtitle": "A single 45-minute on-campus session of the Council-curated Body programme Yoga for Posture & Back Care, for up to 25 VITM students.",
            "date_offset": 18, "start": "16:30", "end": "17:15", "duration": 45,
            "venue": "VITM Campus — Sports & Wellness Hall", "capacity": 25, "language": "English",
            "reg_close_offset": 16, "reg_access": I.REG_ORG_ONLY, "lifecycle": "PUBLISHED",
        },
    },
    # ============== STARTUP & NETWORKING GROUPS ==============
    {
        "key": "DEMO-ORG-NETWORK-001", "cohort": I.COHORT_STARTUP,
        "name": "Founders Circle Mumbai", "short_name": "Founders Circle Mumbai",
        "city": "Mumbai", "industry": "Startup & Networking Group", "org_size": "≈ 180 members",
        "website": "https://www.founderscirclemumbai.example", "contact_email": "hello@founderscirclemumbai.example",
        "contact_person": "Neha Kapoor, Community Lead", "contact_phone": "+91 98200 55512",
        "logo": "/brand/demo/founders-circle.svg", "creator_role": I.ECR_COMMUNITY_MANAGER,
        "description": (
            "Founders Circle Mumbai is an illustrative peer network of about 180 early- and growth-stage founders. "
            "Its community team used NOSTOPS to run a single shared session of the Council-curated Mind programme "
            "“Yoga for Stress Resilience” for up to 30 members and their core teams, led by a "
            "NOSTOPS-verified teacher at The Commons, Bandra Kurla Complex. The programme’s stated aims are to "
            "ease everyday stress, build resilience and support calm and balance."
        ),
        "event": {
            "key": "DEMO-EVT-NETWORK-001", "programme": "mind-stress-resilience",
            "title": "Yoga for Stress Resilience — Founders Circle Mumbai",
            "subtitle": "A single 60-minute shared session of the Council-curated Mind programme Yoga for Stress Resilience, held for up to 30 Circle members.",
            "date_offset": -16, "start": "07:30", "end": "08:30", "duration": 60,
            "venue": "The Commons — Bandra Kurla Complex", "capacity": 30, "language": "English",
            "reg_close_offset": -17, "reg_access": I.REG_ORG_ONLY, "lifecycle": "COMPLETED",
        },
    },
    {
        "key": "DEMO-ORG-NETWORK-002", "cohort": I.COHORT_STARTUP,
        "name": "ScaleUp Founders Network Pune", "short_name": "ScaleUp Founders Network",
        "city": "Pune", "industry": "Startup & Networking Group", "org_size": "≈ 220 members",
        "website": "https://www.scaleuppune.example", "contact_email": "connect@scaleuppune.example",
        "contact_person": "Rahul Varma, Network Convener", "contact_phone": "+91 98220 33421",
        "logo": "/brand/demo/scaleup.svg", "creator_role": I.ECR_COMMUNITY_MANAGER,
        "description": (
            "ScaleUp Founders Network Pune is an illustrative community of about 220 founders and operating teams. "
            "Its convener uses NOSTOPS to run a single shared session of the Council-curated Body programme "
            "“Yoga for Energy & Stamina” for up to 30 members and their teams, led by a NOSTOPS-verified "
            "teacher at the ScaleUp Loft in Baner. The programme’s stated aims are to build steady energy, "
            "support stamina and enliven the body."
        ),
        "event": {
            "key": "DEMO-EVT-NETWORK-002", "programme": "body-energy-stamina",
            "title": "Yoga for Energy & Stamina — ScaleUp Founders Network",
            "subtitle": "A single 45-minute shared session of the Council-curated Body programme Yoga for Energy & Stamina, for up to 30 ScaleUp members.",
            "date_offset": 25, "start": "18:00", "end": "18:45", "duration": 45,
            "venue": "ScaleUp Loft — Baner", "capacity": 30, "language": "English",
            "reg_close_offset": 23, "reg_access": I.REG_ORG_ONLY, "lifecycle": "PUBLISHED",
        },
    },
]


async def _seed_teachers(refresh: bool):
    now = I._now()
    written = 0
    for t in DEMO_TEACHERS:
        # Start-up (refresh=False) never rewrites an existing demo teacher.
        if not refresh and await I.teacher_directory.find_one({"teacher_id": t["teacher_id"]}, {"_id": 1}):
            continue
        written += 1
        await I.teacher_directory.update_one(
            {"teacher_id": t["teacher_id"]},
            {"$set": {
                "teacher_id": t["teacher_id"], "name": t["name"], "handle": t["handle"],
                "city": t["city"], "city_slug": I._city_slug(t["city"]), "email": None,
                "level": t["level"], "languages": t["languages"],
                "specializations": t["specializations"], "taxonomies": t["taxonomies"],
                "experience_years": t["experience_years"], "rating": t["rating"],
                "lineage": t["lineage"], "specialisation": ", ".join(t["specializations"]),
                "institutional_experience": t["institutional_experience"],
                "availability": t["availability"], "performance_history": t["performance_history"],
                "empanelled": True, "active": True,
                "is_demo_seeded": True, "demo_label": DEMO_LABEL, "demo_seed_version": DEMO_SEED_VERSION,
                "updated_at": now,
            }, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    print(f"  teachers: {written} of {len(DEMO_TEACHERS)} demo teachers "
          f"{'refreshed' if refresh else 'created (existing ones left unchanged)'}")


async def _seed_coordinators():
    now = I._now()
    for c in DEMO_COORDINATORS:
        existing = await I.city_coordinator_assignments.find_one({"demo_seed_key": c["key"]})
        if existing:
            continue
        cca_id = await I._next_id("CityCoordinatorAssignment")
        await I.city_coordinator_assignments.insert_one({
            "cca_id": cca_id,
            "coordinator_name": c["name"], "city": c["city"], "city_slug": I._city_slug(c["city"]),
            "status": "ACTIVE",
            # Explicitly a SUPPORT / local-execution partner — NOT an approval gate.
            "role_scope": ["support", "local_execution", "quality", "coordination", "exception_handling"],
            "approval_gate": False,
            "is_demo_seeded": True, "demo_label": DEMO_LABEL, "demo_seed_version": DEMO_SEED_VERSION,
            "demo_seed_key": c["key"], "created_at": now,
        })
    print(f"  coordinators: {len(DEMO_COORDINATORS)} demo city coordinators ensured (support-only, no gate)")


async def _ensure_org(spec, non_demo_ids, programme_id, refresh):
    now = I._now()
    demo_fields = {
        "short_name": spec["short_name"], "industry": spec["industry"], "org_size": spec["org_size"],
        "contact_person": spec["contact_person"], "contact_phone": spec["contact_phone"],
        "logo_url": spec["logo"], "website": spec["website"], "description": spec["description"],
        "primary_city": spec["city"], "city_slug": I._city_slug(spec["city"]),
        "trust_state": I.ORG_TRUST_VERIFIED, "domain_verified": True,
        "trust_note": "Demonstration organisation — verified for the NOSTOPS public showcase.",
        "is_demo_seeded": True, "demo_label": DEMO_LABEL, "demo_seed_version": DEMO_SEED_VERSION,
        "updated_at": now,
    }
    existing = await I.organisations.find_one({"demo_seed_key": spec["key"]})
    if existing:
        org_id = existing["organisation_id"]
        if refresh:  # start-up leaves an existing demo organisation exactly as it is
            await I.organisations.update_one({"organisation_id": org_id}, {"$set": demo_fields})
    else:
        res = await I.create_organisation(I.OrganisationCreate(
            name=spec["name"], cohort_type=spec["cohort"], description=spec["description"],
            logo_url=spec["logo"], website=spec["website"], city=spec["city"],
            contact_email=spec["contact_email"], creator_role=spec["creator_role"],
        ), user=HR)
        org_id = res["organisation"]["organisation_id"]
        await I.organisations.update_one(
            {"organisation_id": org_id}, {"$set": {**demo_fields, "demo_seed_key": spec["key"]}})
    # Ensure the hr.demo OWNER / Event-Creator membership exists (idempotent).
    mem = await I.org_members.find_one({"organisation_id": org_id, "user_id": HR["user_id"]})
    if not mem:
        mid = await I._next_id("OrganisationMember")
        await I.org_members.insert_one({
            "member_id": mid, "organisation_id": org_id, "user_id": HR["user_id"],
            "name": HR["name"], "email": HR["email"], "member_role": I.MEMBER_OWNER,
            "event_creator": True, "event_creator_role": spec["creator_role"],
            "programme_champion": True, "status": "ACTIVE", "created_at": now,
        })
    return org_id


async def _ensure_event(spec, org_id, programme_id, non_demo_ids, refresh):
    ev_spec = spec["event"]
    now = I._now()
    existing = await I.events.find_one({"demo_seed_key": ev_spec["key"]})

    if existing and not refresh:
        # Start-up: an existing demo event (its dates, slug, SEO row, teacher match, lifecycle and
        # timestamps) is left exactly as it is, and no ID counter moves.
        existing["_teacher_name"] = (existing.get("assigned_teacher") or {}).get("name")
        return existing
    if existing:
        event_id = existing["event_id"]
    else:
        body = I.EventCreate(
            organisation_id=org_id, programme_id=programme_id,
            title=ev_spec["title"], subtitle=ev_spec["subtitle"],
            event_date=_d(ev_spec["date_offset"]), start_time=ev_spec["start"], end_time=ev_spec["end"],
            duration_minutes=ev_spec["duration"], city=spec["city"], venue=ev_spec["venue"],
            venue_type=I.VENUE_EXISTING, capacity=ev_spec["capacity"], language=ev_spec["language"],
            registration_closing_date=_d(ev_spec["reg_close_offset"]),
            visibility=I.VIS_PUBLIC, registration_access=ev_spec["reg_access"], pricing_type=I.PRICING_FREE,
        )
        res = await I.create_event(body, user=HR)
        event_id = res["event"]["event_id"]

    # New event, or an explicit --refresh: apply the copy, capacity, venue,
    # schedule and demo metadata (the refresh keeps the COMPLETED event historical).
    await I.events.update_one({"event_id": event_id}, {"$set": {
        "title": ev_spec["title"], "subtitle": ev_spec["subtitle"],
        "capacity": ev_spec["capacity"], "venue": ev_spec["venue"],
        "event_date": _d(ev_spec["date_offset"]), "start_time": ev_spec["start"], "end_time": ev_spec["end"],
        "duration_minutes": ev_spec["duration"],
        "registration_closing_date": _d(ev_spec["reg_close_offset"]),
        "registration_access": ev_spec["reg_access"],
        "is_demo_seeded": True, "demo_label": DEMO_LABEL, "demo_seed_version": DEMO_SEED_VERSION,
        "demo_seed_key": ev_spec["key"], "updated_at": now,
    }})

    # ── Publish (mirror of publish_event, but WITHOUT its auto-match so demo
    #    events are matched ONLY to demo teachers — no real teacher is emailed) ──
    # OEA-24 — demo schedules float relative to "today" on every seed run, so a
    # date-stamped slug drifts from the event's real date. Demo events use a
    # stable, DATE-FREE slug; an earlier dated slug is kept in `slug_aliases` and
    # the public page redirects it to the canonical URL. Registrations are keyed
    # by event_id, so existing registrations are untouched.
    ev = await I.events.find_one({"event_id": event_id})
    slug = I._slugify(ev["title"])
    if await I.events.find_one({"slug": slug, "event_id": {"$ne": event_id}}):
        slug = f"{slug}-demo"
    old_slug = ev.get("slug")
    alias = {"$addToSet": {"slug_aliases": old_slug}} if old_slug and old_slug != slug else {}
    org = await I.organisations.find_one({"organisation_id": org_id})
    await I.events.update_one({"event_id": event_id}, {"$set": {
        "slug": slug, "lifecycle": "PUBLISHED",
        "published_at": ev.get("published_at") or now, "updated_at": now,
    }, **alias})
    seo_id = await I._next_id("EventSEO")
    await I.event_seo.update_one({"event_id": event_id}, {
        "$set": {
            "event_id": event_id, "slug": slug,
            "meta_title": f"{ev['title']} · NOSTOPS",
            "meta_description": (ev.get("subtitle") or (ev.get("programme_snapshot") or {}).get("essence") or "")[:300],
            # Demonstration events are illustrative — never search-indexed (OEA-11).
            "indexable": False, "canonical_path": f"/events/{slug}",
            "og_image": (org or {}).get("logo_url"), "updated_at": now,
        },
        "$setOnInsert": {"event_seo_id": seo_id, "created_at": now},
    }, upsert=True)

    # ── Teacher matching (REAL selection scoring) restricted to demo teachers,
    #    then CONFIRMED (teacher confirmation). Only match if not already assigned;
    #    no email (demo teachers carry email=None). ──
    fresh = await I.events.find_one({"event_id": event_id})
    teacher_name = (fresh.get("assigned_teacher") or {}).get("name")
    if not (fresh.get("assigned_teacher") or {}).get("teacher_id"):
        best = await I._select_teacher(fresh, set(non_demo_ids))
        if best:
            teacher_name = best.get("name")
            aid = await I._next_id("TeacherAssignment")
            await I.teacher_assignments.update_one(
                {"event_id": event_id, "teacher_id": best["teacher_id"]},
                {"$set": {
                    "event_id": event_id, "organisation_id": org_id, "teacher_id": best["teacher_id"],
                    "teacher_name": best.get("name"), "teacher_handle": best.get("handle"),
                    "city_slug": ev.get("city_slug"), "match_quality": best.get("_match_quality") or "BEST_MATCH",
                    "status": "CONFIRMED", "matched_by": "AUTO_BEST_MATCH",
                    "responded_at": now, "updated_at": now, "is_demo_seeded": True,
                }, "$setOnInsert": {"assignment_id": aid, "created_at": now}},
                upsert=True,
            )
            asg = await I.teacher_assignments.find_one({"event_id": event_id, "teacher_id": best["teacher_id"]})
            await I.events.update_one({"event_id": event_id}, {"$set": {
                "assigned_teacher": {
                    "teacher_id": best["teacher_id"], "name": best.get("name"), "handle": best.get("handle"),
                    "assignment_id": asg.get("assignment_id"), "status": "CONFIRMED", "verified": True,
                },
                "teacher_search_exhausted": False, "updated_at": now,
            }})

    # ── Lifecycle for LIVE / COMPLETED demonstration states (stored explicitly so
    #    no completion side-effects / emails are triggered) ──
    lc = ev_spec["lifecycle"]
    if lc in ("LIVE", "COMPLETED"):
        patch = {"lifecycle": lc, "updated_at": now}
        if lc == "COMPLETED":
            patch["completed_at"] = now
        await I.events.update_one({"event_id": event_id}, {"$set": patch})

    out = await I.events.find_one({"event_id": event_id})
    out["_teacher_name"] = teacher_name
    return out


async def main(refresh: bool = False):
    """refresh=False (backend start-up): create only missing demo records. refresh=True: the manual
    `--refresh` run, which re-applies the copy and dates to existing records too."""
    print("NOSTOPS demonstration ecosystem seed —", DEMO_SEED_VERSION, "(refresh)" if refresh else "(create missing only)")
    await I._ensure()
    await I._ensure_seed()

    # Reused Council programmes (by seed_key → programme_id).
    prog_map = {}
    async for p in I.council_programmes.find({"is_seed": True}):
        prog_map[p["seed_key"]] = p["programme_id"]

    await _seed_teachers(refresh)
    await _seed_coordinators()

    # Everything NOT a demo teacher is excluded from demo-event matching.
    non_demo_ids = [t["teacher_id"] async for t in
                    I.teacher_directory.find({"is_demo_seeded": {"$ne": True}}, {"teacher_id": 1})]

    print(f"  excluding {len(non_demo_ids)} non-demo teachers from demo-event matching")

    for spec in ORGS:
        programme_id = prog_map.get(spec["event"]["programme"])
        if not programme_id:
            print(f"  !! missing Council programme {spec['event']['programme']!r} — skipping {spec['name']}")
            continue
        org_id = await _ensure_org(spec, non_demo_ids, programme_id, refresh)
        ev = await _ensure_event(spec, org_id, programme_id, non_demo_ids, refresh)
        print(f"  ✓ {I.COHORT_LABELS[spec['cohort']]:<26} | {spec['short_name']:<26} | "
              f"{ev.get('lifecycle'):<10} | /events/{ev.get('slug')} | teacher: "
              f"{ev.get('_teacher_name') or (ev.get('assigned_teacher') or {}).get('name') or '—'}")

    n_orgs = await I.organisations.count_documents({"is_demo_seeded": True})
    n_events = await I.events.count_documents({"is_demo_seeded": True})
    print(f"DONE — {n_orgs} demo organisations, {n_events} demo events. Bound to {HR['email']}.")


if __name__ == "__main__":
    asyncio.run(main(refresh="--refresh" in sys.argv[1:]))
