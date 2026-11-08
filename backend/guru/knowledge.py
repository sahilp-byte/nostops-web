"""
NOSTOPS "Ask AI Guru" — authoritative product knowledge (domains A–G).

Every line here is curated, approved NOSTOPS knowledge. The ONLY prices and
percentages it contains are the PUBLISHED organisation rate card and teacher
share shown on the /for-organisations cohort pages (mirrors
frontend/lib/org/pricing.ts — keep both in sync). It contains NO other prices,
NO personal earnings figures, NO medical claims and NO invented programme
content or Guru attribution — those are governed by guardrails.py.

The Council programme taxonomy is STRICT and appears exactly as:
    MIND · BODY · SPECIAL NEEDS
The term "Specific Needs" must NEVER appear anywhere.
"""
from typing import Optional

# Real per-programme schedule, session length and group size come straight from
# the Council catalogue the event engine seeds (single source — no copy here).
from institutional import TAXONOMY_LABELS as _PILLAR_LABEL, _SEED_PROGRAMMES
from pricing_rules import TEACHER_SHARE_OTHER_WORK, TEACHER_SHARE_SENTENCE

# ─────────────────────────── STRICT TAXONOMY ────────────────────────────────
# Mirrors backend/institutional.py TAXONOMY_LABELS. Single source for the Guru.
TAXONOMY_LABELS = ["Mind", "Body", "Special Needs"]
TAXONOMY_DISPLAY = "MIND · BODY · SPECIAL NEEDS"

# Real, current Council-curated programmes (names only) — authoritative examples
# drawn from the live catalogue at /programmes. Names are safe to state; benefits,
# claims and attributions are NOT invented here.
CURRENT_PROGRAMME_EXAMPLES = {
    "Mind": [
        "Yoga for Focus & Attention",
        "Yoga for Stress Resilience",
        "Yoga for Better Sleep",
        "Yoga for Emotional Wellbeing",
    ],
    "Body": [
        "Yoga for Strength & Mobility",
        "Yoga for Posture & Back Care",
        "Yoga for Energy & Stamina",
    ],
    "Special Needs": [
        "Accessible Chair Yoga",
        "Gentle Yoga for Limited Mobility",
        "Calming Practices for Sensory Wellbeing",
    ],
}


# ─────────────────────────── KNOWLEDGE SECTIONS ─────────────────────────────
# Each section: domain key, title, concise authoritative body, and the CTA ids
# (see cta.py) that are genuinely relevant. "audience" is used to prioritise
# sections against page/role context; it never restricts what the Guru may say.
def knowledge_sections() -> list[dict]:
    return [
        # ── A. NOSTOPS ──────────────────────────────────────────────────────
        {
            "domain": "nostops",
            "title": "What NOSTOPS is",
            "audience": ["any"],
            "body": (
                "NOSTOPS is a teacher-first yoga cooperative that connects seekers, organisations and "
                "venues with verified Indian yoga teachers, retreats and living lineages, overseen by a "
                "Council of Gurus. It honours the Guru–Shishya Paramparā: authentic knowledge passed from "
                "teacher to student. The platform exists to put teachers first — protecting their livelihood, "
                "surfacing genuine opportunities, and keeping practice rooted in tradition."
            ),
            "ctas": ["find_a_teacher", "for_organisations", "become_a_teacher"],
        },
        {
            "domain": "nostops",
            "title": "Roles on the platform",
            "audience": ["any"],
            "body": (
                "The main roles are: Yoga Teachers (empanelled, verified teachers who teach and host), "
                "Venue Owners (spaces listed for sessions and retreats), Retreat Hosts, Organisations "
                "(companies, educational institutions, and startup & networking groups running wellness "
                "programmes), Participants (people who join programmes and sessions), City Coordinators "
                "(empanelled teachers who lead NOSTOPS in a city), and the Council of Gurus (who curate "
                "programmes and safeguard quality)."
            ),
            "ctas": ["become_a_teacher", "for_organisations", "find_a_teacher"],
        },

        # ── B. YOGA TEACHERS ────────────────────────────────────────────────
        {
            "domain": "teacher",
            "title": "Becoming a NOSTOPS teacher",
            "audience": ["teacher", "anon"],
            "body": (
                "A teacher either claims an existing directory profile or creates a new one, then completes "
                "verification. Verification includes identity and credential checks (InstaKYC) and Council "
                "empanelment, so seekers can book with confidence. Only verified, empanelled teachers appear "
                "on public profiles. Teachers build a profile (bio, lineage, styles, city, media, reviews) "
                "that represents them across the platform."
            ),
            "ctas": ["become_a_teacher", "claim_profile", "complete_verification"],
        },
        {
            "domain": "teacher",
            "title": "Teacher levels, dashboard & opportunities",
            "audience": ["teacher"],
            "body": (
                "Verified teachers get a dashboard showing their profile, bookings, offerings, sessions, "
                "wallet and opportunities. NOSTOPS gives teachers MULTIPLE ways to earn — one-to-one teaching, "
                "institutional programmes, courses and retreats — always subject to the specific engagement. "
                "Exact terms depend on the particular programme or engagement and are shown in the relevant "
                "workflow. " + TEACHER_SHARE_SENTENCE + " " + TEACHER_SHARE_OTHER_WORK + " No payout amount is "
                "promised. Teacher levels and empanelment "
                "reflect verification and standing."
            ),
            "ctas": ["open_dashboard", "complete_verification", "create_retreat"],
        },

        # ── C. VENUE OWNERS ─────────────────────────────────────────────────
        {
            "domain": "venue",
            "title": "Listing and running a venue",
            "audience": ["venue", "anon"],
            "body": (
                "Venue owners list their space so teachers, hosts and organisations can discover it for "
                "sessions, retreats and institutional programmes. A listing describes the space, location, "
                "facilities and photos, and can receive enquiries. Listing improves discovery by teachers and "
                "hosts looking for the right setting, and opens venue opportunities for retreats and programmes."
            ),
            "ctas": ["list_my_venue", "explore_venues", "open_dashboard"],
        },

        # ── D. RETREATS ─────────────────────────────────────────────────────
        {
            "domain": "retreat",
            "title": "Creating and hosting retreats",
            "audience": ["teacher", "venue", "any"],
            "body": (
                "Teachers can create and host retreats, selecting a venue and defining the experience and "
                "cohorts; venues can host retreats by providing the space. Participants discover and book "
                "retreats from the public retreats pages. NOSTOPS supports hosts with the tooling to run the "
                "retreat; the host is responsible for delivering the experience they publish. Commercial terms "
                "depend on the specific retreat configuration."
            ),
            "ctas": ["create_retreat", "explore_retreats", "list_my_venue"],
        },

        # ── E. ORGANISATIONS (3 cohorts only) ───────────────────────────────
        {
            "domain": "organisation",
            "title": "Organisations: three cohorts, one engine",
            "audience": ["organisation", "anon"],
            "body": (
                "NOSTOPS serves exactly three organisation cohorts: Companies, Educational Institutions, and "
                "Startup & Networking Groups. They use the SAME engine and Council-curated programmes — the "
                "cohort is context, not a different product. Programmes are curated by the Council of Gurus "
                f"across three pillars: {TAXONOMY_DISPLAY}."
            ),
            "ctas": ["for_organisations", "explore_programmes", "create_programme"],
        },
        {
            "domain": "organisation",
            "title": "Programme content status (honest labelling)",
            "audience": ["organisation", "participant", "anon", "any"],
            "body": (
                "Every current NOSTOPS programme is Council-curated, and its content is still in development — "
                "pending Council review. Programme and event pages show the note 'In development — pending Council "
                "review' beside the Council-curated label until the Council of Gurus has approved the content. "
                "Describe programmes as Council-curated and in development, pending Council review. Never say a "
                "programme is Council-approved, approved by the Council, reviewed or signed off by the Council, "
                "certified or final."
            ),
            "ctas": ["explore_programmes", "for_organisations"],
        },
        {
            "domain": "organisation",
            "title": "The three equal pathways: Mind, Body and Special Needs",
            "audience": ["organisation", "participant", "anon", "any"],
            "body": (
                "Mind, Body and Special Needs are three equal programme pathways, available to all three "
                "cohorts through the same self-service flow: choose a Council-curated programme, create the "
                "event and publish. Special Needs covers adapted yoga for participants whose physical "
                "limitations, functional needs or circumstances call for modified practice — for example neck "
                "or back pain, cervical spondylosis, shoulder pain, frozen shoulder or reduced mobility. These "
                "are illustrative examples, not diagnoses, and NOSTOPS never recommends a programme from a "
                "condition name: suitability depends on the individual's circumstances, the proposed practice, "
                "relevant precautions and the teacher's verified competence. Special Needs programmes are "
                "offered only to teachers whose adaptive-practice competence NOSTOPS has verified (a separate "
                "review, distinct from standard empanelment, recorded by NOSTOPS admins or the Council — declaring "
                "the pathway is not enough); if none is "
                "available yet, the event shows 'No teacher available yet' and NOSTOPS follows up. Choosing "
                "Special Needs never requires a custom enquiry — a customised programme can be requested when "
                "no existing programme fits. Yoga teachers do not replace doctors, physiotherapists or other "
                "healthcare professionals; anyone with pain, an injury or a health condition should follow "
                "their healthcare professional's advice and tell the teacher before starting."
            ),
            "ctas": ["explore_programmes", "create_programme", "for_organisations"],
        },
        {
            "domain": "organisation",
            "title": "The organisation programme lifecycle",
            "audience": ["organisation"],
            "body": (
                "A programme flows through clear steps: the Organisation chooses a Council-curated programme → "
                "creates an Event (venue, capacity and schedule) → NOSTOPS matches an eligible, verified Teacher "
                "for that city → the Teacher confirms → Participants register → attendance is recorded for each "
                "session → participants and the teacher give feedback → the organisation can Create Again / renew. "
                "The schedule is either a single session, or a repeating programme of 1 or 2 sessions a week on "
                "weekdays the organiser picks, from a start date to an end date the organiser picks — all the "
                "session dates are created in one go and one teacher is matched for the whole programme. "
                "Participants register for each session separately: registering for one session does not book "
                "the others. Capacity applies to each session. If the capacity is above the programme's "
                "recommended group size, the event wizard shows a warning but still lets the organiser continue. "
                "Who pays: participants pay, not the organisation. In the wizard the organiser sets a fee per "
                "participant, per session (the wizard suggests the NOSTOPS list rate for the cohort; no group-size "
                "or commitment discount applies), "
                "and each person pays it online by card or UPI when they register. Their "
                "place is confirmed once the payment goes through; in a repeating programme they pay for each "
                "session they register for. Organisation pricing follows the published rate card below."
            ),
            "ctas": ["create_programme", "explore_programmes", "open_dashboard"],
        },
        {
            "domain": "organisation",
            "title": "Organisation pricing (published rate card)",
            "audience": ["organisation", "organisations", "anon"],
            "body": (
                "Prices are per participant, per session, for on-site sessions, 2 sessions a week (8 a month). "
                "Educational Institutions: ₹175 per student or faculty member per session — an exclusive flat "
                "campus rate for students and faculty only, with no further discounts: ₹1,400 (1 month), "
                "₹4,200 (3 months), ₹8,400 (6 months), ₹16,800 (12 months) per participant. "
                "Companies and Startup & Networking Groups: a list rate of ₹300 per participant per session, for "
                "any group size and any programme length: ₹2,400 (1 month), ₹7,200 (3 months), ₹14,400 "
                "(6 months), ₹28,800 (12 months) per participant. Total = rate × sessions × participants. "
                "Group-size discounts for 15–28 and 29–40 participants: UNAPPROVED — NOT A CONFIRMED PRICE — "
                "BOOKING UNAVAILABLE. No group-size or commitment discount is offered, and no discounted price "
                "or saving is ever quoted. Each programme has its own recommended group size (see Programme facts). "
                "How the price is actually set: when an organisation creates a programme in the event wizard, the "
                "organiser sets the fee each participant pays per session; the wizard suggests the list rate "
                "for the cohort, and each participant pays that fee online "
                "(card or UPI) when they register. The event page shows the fee. A proposal is only needed when an "
                "organisation wants a customised programme or help planning — it does not set the price of a "
                "self-service programme. "
                "Teacher share: " + TEACHER_SHARE_SENTENCE + " " + TEACHER_SHARE_OTHER_WORK + " No share is "
                "published for any other programme length, and no other split is published."
            ),
            "ctas": ["for_organisations", "explore_programmes", "create_programme"],
        },

        # ── F. PARTICIPANTS ─────────────────────────────────────────────────
        {
            "domain": "participant",
            "title": "Participants: finding and joining programmes",
            "audience": ["participant", "any"],
            "body": (
                "Participants find programmes and events (often via an invite link from their organisation or a "
                "public event page), register, and attend. When a programme repeats over several weeks, "
                "participants register for each session they want to attend separately. Attendance is marked by "
                "the teacher for each session, and participants can leave feedback once the programme is "
                "complete. Participants can see what they have joined under "
                "their programmes. Programmes created by an organisation have a per-session fee that the "
                "participant pays online (card or UPI) when registering; the event page shows the fee. A few "
                "older events are free to attend."
            ),
            "ctas": ["explore_programmes", "register_for_event", "find_a_teacher"],
        },

        # ── G. ACCOUNT / SUPPORT ────────────────────────────────────────────
        {
            "domain": "support",
            "title": "Account, verification & payments",
            "audience": ["any"],
            "body": (
                "Teachers sign in; other people create a free account where required to confirm a booking or "
                "registration. Verification (identity, credentials, empanelment) is handled in the teacher "
                "onboarding flow. Payments and settlements are handled securely inside the relevant workflow. "
                "If a profile, verification, payment, booking or event issue cannot be resolved by self-service, "
                "the Guru should offer to Create a Support Request so a NOSTOPS person can help — without the "
                "user having to repeat everything. As a last resort, people can email the NOSTOPS team "
                "directly at nostops.org@gmail.com."
            ),
            "ctas": ["open_dashboard", "create_support_request", "log_in"],
        },
    ]


PROGRAMME_FACTS_RULE = (
    "These are the ONLY published figures for each programme's recommended frequency, session length and "
    "group size — state them exactly. Every programme below is Council-curated and in development — pending "
    "Council review (never call it Council-approved). The frequency is the Council's recommendation; when "
    "scheduling, an organiser can choose 1 or 2 sessions a week. Never promise a different cadence, longer "
    "sessions or a "
    "bigger recommended group, and never promise extras that are not part of any programme, such as baseline "
    "assessments, impact reports, HR check-ins, wellbeing reports or executive 1:1 sessions."
)


def programme_facts_lines() -> list[str]:
    """One line per Council programme: pillar, recommended frequency, session
    length and recommended group size (from the engine's seed catalogue)."""
    return [
        f"- {s['name']} ({_PILLAR_LABEL[s['taxonomy']]}): {s['frequency']}; "
        f"{s['duration_label']}; recommended group size {s['group_size']}."
        for s in _SEED_PROGRAMMES
    ]


def _priority_for(section: dict, context: Optional[dict]) -> int:
    """Lower sorts first. Sections matching the page/role context float up."""
    if not context:
        return 50
    aud = set(section.get("audience") or [])
    hints = {
        (context.get("page_type") or "").lower(),
        (context.get("role") or "").lower(),
        (context.get("journey") or "").lower(),
    }
    hints.discard("")
    if aud & hints:
        return 0
    if "any" in aud:
        return 40
    return 50


def assemble_knowledge_text(context: Optional[dict] = None) -> str:
    """Render the knowledge base into a compact text block for the system prompt.

    When page/role context is supplied, the most relevant sections are ordered
    first so the Guru leads with what matters on the current screen. The full KB
    is always included — context only re-orders, it never hides knowledge.
    """
    sections = sorted(
        knowledge_sections(),
        key=lambda s: (_priority_for(s, context), s["domain"]),
    )
    lines: list[str] = [
        "=== NOSTOPS KNOWLEDGE BASE (authoritative) ===",
        f"Council programme taxonomy (STRICT, the only pillars): {TAXONOMY_DISPLAY}.",
        "Never use the phrase 'Specific Needs'.",
        "",
    ]
    for s in sections:
        lines.append(f"## {s['title']}")
        lines.append(s["body"])
        lines.append("")
    # Real current programme examples (names are authoritative; benefits are not).
    lines.append("## Current Council-curated programmes (examples; live list at /programmes; all in development — "
                 "pending Council review)")
    for pillar, names in CURRENT_PROGRAMME_EXAMPLES.items():
        lines.append(f"- {pillar}: " + "; ".join(names))
    lines.append("")
    lines.append("## Programme facts (schedule, session length, group size)")
    lines.append(PROGRAMME_FACTS_RULE)
    lines.extend(programme_facts_lines())
    lines.append("")
    return "\n".join(lines).strip()
