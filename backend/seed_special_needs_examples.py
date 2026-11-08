"""
Special Needs illustrative examples for the demonstration showcase.

Runs at backend startup right after the demo ecosystem seed (server.py) — the
owner approved creating these 3 records in production. Writes nothing else.

Creates ONE clearly labelled illustrative Special Needs example per cohort,
attached to an existing demonstration organisation:
  • DRAFT + PRIVATE + registration CLOSED → no public page, not bookable,
    never indexed, never in the sitemap; publishing is refused (illustrative_only).
  • No date and NO teacher: no preview teacher holds a reviewed adaptive-practice
    verification, so nothing claims a teacher is assigned or verified.
  • is_demo_seeded → excluded from auto-matching and from the admin awaiting list.
Idempotent (keyed by demo_seed_key). Run: python seed_special_needs_examples.py
Restart safety (Prompt 3C): an existing example is written only if one of its
safety fields has drifted, so a restart leaves it (and its updated_at) unchanged.
"""
import asyncio

import institutional as I
from seed_demo_ecosystem import DEMO_LABEL, HR

EXAMPLES = [
    # (cohort demo org key, example key, Council programme seed_key, title)
    ("DEMO-ORG-COMPANY-001", "DEMO-EVT-COMPANY-SN-ILLUSTRATIVE", "special-needs-accessible-chair",
     "Accessible Chair Yoga — Illustrative Special Needs Example"),
    ("DEMO-ORG-EDU-001", "DEMO-EVT-EDU-SN-ILLUSTRATIVE", "special-needs-gentle-mobility",
     "Gentle Yoga for Limited Mobility — Illustrative Special Needs Example"),
    ("DEMO-ORG-NETWORK-001", "DEMO-EVT-NETWORK-SN-ILLUSTRATIVE", "special-needs-accessible-chair",
     "Accessible Chair Yoga — Illustrative Special Needs Example"),
]
SUBTITLE = ("Illustrative Special Needs example — same self-service flow as Mind and Body. Not a real session, "
            "not bookable; a teacher is offered only after NOSTOPS verifies adaptive-practice competence.")
assert len(SUBTITLE) <= 240


async def ensure() -> list:
    await I._ensure()
    await I._ensure_seed()
    out = []
    for org_key, ev_key, prog_key, title in EXAMPLES:
        org = await I.organisations.find_one({"demo_seed_key": org_key, "is_demo_seeded": True})
        prog = await I.council_programmes.find_one({"seed_key": prog_key})
        if not org or not prog:
            print(f"  !! missing demo org {org_key} or programme {prog_key} — skipped")
            continue
        ev = await I.events.find_one({"demo_seed_key": ev_key})
        created = not ev
        if created:
            res = await I.create_event(I.EventCreate(
                organisation_id=org["organisation_id"], programme_id=prog["programme_id"], title=title,
                subtitle=SUBTITLE, city=org.get("primary_city"), venue_type=I.VENUE_EXISTING,
                capacity=15, language="English", visibility=I.VIS_PRIVATE,
                registration_access=I.REG_CLOSED, pricing_type=I.PRICING_FREE,
            ), user=HR)
            ev = res["event"]
        safety = {
            "lifecycle": "DRAFT", "visibility": I.VIS_PRIVATE, "registration_access": I.REG_CLOSED,
            "pricing_type": I.PRICING_FREE, "event_date": None, "slug": None, "assigned_teacher": None,
            "illustrative_only": True, "is_demo_seeded": True, "demo_label": DEMO_LABEL,
            "demo_seed_key": ev_key,
        }
        if created or any(ev.get(k) != v for k, v in safety.items()):
            await I.events.update_one({"event_id": ev["event_id"]}, {"$set": {**safety, "updated_at": I._now()}})
        out.append(await I.events.find_one({"event_id": ev["event_id"]}))
        print(f"  ✓ {I.COHORT_LABELS[org['cohort_type']]:<26} | {org.get('short_name')} | {ev['event_id']} | {title}")
    return out


if __name__ == "__main__":
    asyncio.run(ensure())
